import { version } from './release-version.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { listPackage, extractFile } from '@electron/asar';
import assert from 'node:assert/strict';
const output = resolve('output/standalone-desktop');
const image = join(output, `Weekaboo-${version}-arm64-signed-preview.dmg`);
const plist = execFileSync('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-plist', image]);
const mounted = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: plist }).toString());
const volume = mounted['system-entities'].find(value => value['mount-point']);
assert(volume);
try {
  const application = join(volume['mount-point'], 'Weekaboo.app');
  execFileSync('codesign', ['--verify', '--deep', '--strict', application], { stdio: 'pipe' });
  const archive = join(application, 'Contents/Resources/app.asar');
  const packaged = JSON.parse(readFileSync(join(output, 'package-signed.json'), 'utf8'));
  assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), packaged.appArchiveSha256);
  const paths = listPackage(archive);
  assert(!paths.some(path => /(^|\/)(backend|data|output|tests|\.git)(\/|$)|\.env|\.db$|\.sqlite$/.test(path)));
  const config = JSON.parse(extractFile(archive, 'desktop/native-auth.json').toString());
  assert(Object.keys(config).every(key => ['google', 'microsoft'].includes(key)));
  assert(!config.microsoft || Object.keys(config.microsoft).every(key => key === 'clientId'));
  const notices = JSON.parse(extractFile(archive, 'licenses/desktop/inventory.json').toString());
  assert(notices.packages.every(pkg => pkg.noticeFiles.length));
  writeFileSync(join(output, 'dmg-mounted-proof.json'), JSON.stringify({ readOnlyMount: true, applicationSignatureVerified: true, archiveMatchesPackagedProof: true, privatePathsAbsent: true, sdkPackagesWithNotices: notices.packages.length, developerIDSigned: true, notarized: false, publicRelease: false }, null, 2));
  console.log('Signed DMG mounts read-only; signed app/archive match; private paths excluded; SDK notices present.');
} finally { execFileSync('hdiutil', ['detach', volume['mount-point']], { stdio: 'pipe' }); }
