import { version } from './release-version.mjs';
// Local preview disk image; optional explicit existing Developer ID. Never notarizes or publishes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const identity = process.env.WEEKABOO_SIGN_IDENTITY;
// Match package-desktop: a supplied signing identity selects the signed app.
const signed = process.argv.includes('--signed') || Boolean(identity);
if (signed && !/^[A-F0-9]{40}$/.test(identity || '')) throw new Error('Signed disk image requires an explicit existing Developer ID identity.');
const root = resolve(import.meta.dirname, '..'), output = join(root, 'output/standalone-desktop');
const application = join(output, (signed ? 'package-signed' : 'package') + '/Weekaboo-darwin-arm64/Weekaboo.app');
const stage = mkdtempSync(join(tmpdir(), 'weekaboo-dmg-'));
const image = join(output, `Weekaboo-${version}-arm64-` + (signed ? 'signed-' : '') + 'preview.dmg');
try {
  execFileSync('codesign', ['--verify', '--deep', '--strict', application], { stdio: 'pipe' });
  execFileSync('ditto', [application, join(stage, 'Weekaboo.app')], { stdio: 'pipe' });
  symlinkSync('/Applications', join(stage, 'Applications'));
  writeFileSync(join(stage, 'Preview.txt'), 'Weekaboo development preview\n\nLocal build for testing. Not notarized or approved for public distribution. Connect your calendar accounts on this Mac. Tasks and accounts are local to this installation; the browser database is not imported.\n');
  execFileSync('hdiutil', ['create', '-ov', '-format', 'UDZO', '-volname', 'Weekaboo Preview', '-srcfolder', stage, image], { stdio: 'pipe' });
  execFileSync('hdiutil', ['verify', image], { stdio: 'pipe' });
  if (signed) { execFileSync('codesign', ['--force', '--sign', identity, '--timestamp', image], { stdio: 'pipe' }); execFileSync('codesign', ['--verify', '--strict', image], { stdio: 'pipe' }); }
  writeFileSync(join(output, signed ? 'dmg-signed.json' : 'dmg.json'), JSON.stringify({ file: image, sha256: createHash('sha256').update(readFileSync(image)).digest('hex'), integrityVerified: true, notarized: false, developerIDSigned: signed, publicRelease: false }, null, 2));
  console.log(image);
} finally { rmSync(stage, { recursive: true, force: true }); }
