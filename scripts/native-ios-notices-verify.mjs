// Verify generated native acknowledgments in an actual built .app without mutation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), path + '/'));
    else if (entry.isFile()) result.push(path);
    else throw new Error('Unexpected native notice resource type.');
  }
  return result.sort();
}
const app = process.argv[2];
if (!app || process.argv.length !== 3) throw new Error('Usage: node scripts/native-ios-notices-verify.mjs /path/to/App.app');
const generated = join(root, 'ios/App/App/public/licenses/native-ios');
const embedded = join(resolve(app), 'public/licenses/native-ios');
const manifest = JSON.parse(await readFile(join(generated, 'inventory.json'), 'utf8'));
assert.equal(manifest.lockSha256, hash(await readFile(join(root, 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved'))), 'Generated acknowledgment manifest is stale; run ios:sync');
const expected = ['README.txt', 'inventory.json', ...manifest.packages.flatMap(pkg => pkg.notices.map(notice => notice.file))].sort();
assert.deepEqual(await files(generated), expected, 'Generated notice set differs from manifest');
assert.deepEqual(await files(embedded), expected, 'Bundled native notice set differs from manifest');
for (const path of expected) assert.deepEqual(await readFile(join(embedded, path)), await readFile(join(generated, path)), 'Bundled native notice mismatch: ' + path);
for (const pkg of manifest.packages) for (const notice of pkg.notices) assert.equal(hash(await readFile(join(embedded, notice.file))), notice.sha256, 'Bundled notice digest mismatch: ' + notice.file);
console.log(JSON.stringify({at: new Date().toISOString(), app: resolve(app), packages: manifest.packages.length, verbatimNotices: expected.length - 2, matchingResourceFiles: expected.length, lockSha256: manifest.lockSha256, exactBytes: true, scope: manifest.scope}, null, 2));
