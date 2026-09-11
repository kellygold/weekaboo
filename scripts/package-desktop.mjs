import { version, buildNumber } from './release-version.mjs';
// Local macOS preview. Optional explicit existing Developer ID; never notarizes or uploads.
import { desktopNotices } from './desktop-notices.mjs';
import { build } from 'esbuild';
import { loadAuthConfig } from '../desktop/auth-config.mjs';
import { packager } from '@electron/packager';
import { mkdtemp, cp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('This preview script currently validates Apple Silicon macOS only.');
const identity = process.env.WEEKABOO_SIGN_IDENTITY;
if (identity && !/^[A-F0-9]{40}$/.test(identity)) throw new Error('Use a valid existing Developer ID identity SHA-1.');
const stage = await mkdtemp(join(tmpdir(), 'weekaboo-package-'));
const output = join(root, 'output/standalone-desktop');
await mkdir(output, { recursive: true });
try {
  // Explicit source allowlist: never package the repository, backend, private data or .env.
  await mkdir(join(stage, 'desktop'));
  const bundle = await build({ entryPoints: [join(root, 'desktop/main.mjs')], outfile: join(stage, 'desktop/main.cjs'), bundle: true, platform: 'node', target: 'node24', format: 'cjs', external: ['electron'], legalComments: 'external', metafile: true, logOverride: { 'empty-import-meta': 'silent' } });
  await cp(join(root, 'desktop/preload.cjs'), join(stage, 'desktop/preload.cjs'));
  // Only the parsed native registration fields enter the artifact; unrelated keys are excluded.
  await writeFile(join(stage, 'desktop/native-auth.json'), JSON.stringify(loadAuthConfig(join(root, 'desktop/native-auth.json'))));
  await cp(join(root, 'dist-desktop'), join(stage, 'dist-desktop'), { recursive: true, filter: path => !path.endsWith('/.DS_Store') });
  // Android SDK supplements belong only in Android artifacts.
  await cp(join(root, 'licenses'), join(stage, 'licenses'), { recursive: true, filter: path => path !== join(root, 'licenses/android') && !path.endsWith('/.DS_Store') });
  const notices = await desktopNotices(root, stage, bundle.metafile);
  await writeFile(join(output, 'notice-inventory.json'), JSON.stringify(notices, null, 2));
  await cp(join(root, 'docs/attribution.md'), join(stage, 'ATTRIBUTION.md'));
  await writeFile(join(stage, 'package.json'), JSON.stringify({ name: 'weekaboo', version, private: true, type: 'module', main: 'desktop/main.cjs' }, null, 2));
  await writeFile(join(output, 'bundle-inputs.json'), JSON.stringify(bundle.metafile, null, 2));
  const result = await packager({ dir: stage, out: join(output, identity ? 'package-signed' : 'package'), name: 'Weekaboo', executableName: 'Weekaboo',
    appBundleId: 'app.weekaboo.calendar', icon: join(root, 'native/branding/Weekaboo.icns'), platform: 'darwin', arch: 'arm64', electronVersion: '44.3.0', asar: true,
    overwrite: true, prune: false, appVersion: version, buildVersion: String(buildNumber),
    osxSign: { identity: identity || '-', identityValidation: Boolean(identity), preAutoEntitlements: false, preEmbedProvisioningProfile: false, optionsForFile: () => ({ hardenedRuntime: Boolean(identity), entitlements: ['com.apple.security.cs.allow-jit'], ...(identity ? {} : { timestamp: 'none' }) }) },
  });
  const application = join(result[0], 'Weekaboo.app');
  execFileSync('codesign', ['--verify', '--deep', '--strict', application], { stdio: 'pipe' });
  const archive = await readFile(join(application, 'Contents/Resources/app.asar'));
  await writeFile(join(output, identity ? 'package-signed.json' : 'package.json'), JSON.stringify({ application, architecture: 'arm64', codeSignature: identity ? 'Developer ID, hardened runtime, strict verification passed' : 'ad-hoc, strict verification passed', notarized: false, publicRelease: false, appArchiveSha256: createHash('sha256').update(archive).digest('hex') }, null, 2));
  console.log(application);
} finally { await rm(stage, { recursive: true, force: true }); }
