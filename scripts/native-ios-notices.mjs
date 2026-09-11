// Preserve notices from the exact locally resolved Swift package revisions.
// No network access or dependency installation; generated output is ignored.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {readFile, readdir, mkdir, mkdtemp, rm, rename, writeFile} from 'node:fs/promises';
import {resolve, join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], {maxBuffer: 16 * 1024 * 1024});
async function children(directory) {
  try { return await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function defaultCheckoutRoots() {
  if (process.env.WEEKABOO_SWIFT_CHECKOUTS) return [resolve(process.env.WEEKABOO_SWIFT_CHECKOUTS)];
  const derived = join(homedir(), 'Library/Developer/Xcode/DerivedData');
  return [join(projectRoot, 'output/ios-build/SourcePackages/checkouts'),
    ...(await children(derived)).filter(item => item.isDirectory()).map(item => join(derived, item.name, 'SourcePackages/checkouts'))];
}
export async function collectNativeIosNotices({lockPath, checkoutRoots}) {
  const lockBytes = await readFile(lockPath);
  const lock = JSON.parse(lockBytes);
  if (!Array.isArray(lock.pins) || !lock.pins.length) throw new Error('Swift Package.resolved has no pinned packages.');
  const checkouts = new Map();
  for (const directory of checkoutRoots) for (const item of await children(directory)) {
    if (!item.isDirectory()) continue;
    const key = item.name.toLowerCase();
    checkouts.set(key, [...(checkouts.get(key) || []), join(directory, item.name)]);
  }
  const files = new Map();
  const packages = [];
  const seen = new Set();
  for (const pin of [...lock.pins].sort((a,b) => a.identity.localeCompare(b.identity, 'en'))) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(pin.identity) || seen.has(pin.identity)) throw new Error('Invalid or duplicate Swift package identity.');
    seen.add(pin.identity);
    const {version, revision} = pin.state || {};
    if (typeof version !== 'string' || !/^[a-zA-Z0-9._+-]+$/.test(version) || !/^[a-f0-9]{40}$/.test(revision || '')) throw new Error(`Package must have a version and commit pin: ${pin.identity}`);
    let checkout;
    for (const candidate of checkouts.get(pin.identity) || []) {
      try { if (git(candidate, 'rev-parse', 'HEAD').toString().trim() === revision) { checkout = candidate; break; } }
      catch { /* An unrelated/non-git directory is not a resolved package. */ }
    }
    if (!checkout) throw new Error(`Missing local checkout at locked revision: ${pin.identity} ${version}. Run sh scripts/ios.sh resolve once from the project root to resolve the committed Swift package versions (requires full Xcode and network access), then retry. For a custom Xcode package cache, set WEEKABOO_SWIFT_CHECKOUTS to its checkouts directory.`);
    if (git(checkout, 'status', '--porcelain', '--untracked-files=no').toString().trim()) throw new Error(`Swift checkout has modified tracked files: ${pin.identity}`);
    const notices = [];
    const submodules = [];
    function collectTree(directory, commit, prefix = '') {
      const tree = git(directory, 'ls-tree', '-r', '-z', commit).toString().split('\0').filter(Boolean);
      for (const entry of tree.sort()) {
        const match = /^(\d+) (blob|commit) ([a-f0-9]{40})\t(.+)$/.exec(entry);
        if (!match) throw new Error(`Unsupported Git tree entry: ${pin.identity}`);
        const [, mode, kind, object, relative] = match;
        const path = prefix + relative;
        if (path.split('/').includes('..') || path.startsWith('/')) throw new Error('Unsafe upstream notice path.');
        if (kind === 'commit') {
          const nested = join(directory, relative);
          if (git(nested, 'rev-parse', 'HEAD').toString().trim() !== object) throw new Error(`Submodule differs from locked commit: ${pin.identity}/${path}`);
          if (git(nested, 'status', '--porcelain', '--untracked-files=no').toString().trim()) throw new Error(`Submodule has modified tracked files: ${pin.identity}/${path}`);
          submodules.push({path, revision: object});
          collectTree(nested, object, path + '/');
          continue;
        }
        if (!/^(?:licen[sc]e|notice|copying)(?:[._-].*)?$/i.test(basename(path))) continue;
        if (mode !== '100644' && mode !== '100755') throw new Error(`Notice must be an ordinary tracked file: ${pin.identity}/${path}`);
        const bytes = git(directory, 'show', `${commit}:${relative}`);
        if (!bytes.length || !bytes.toString('utf8').trim() || bytes.includes(0)) throw new Error(`Empty or binary notice: ${pin.identity}/${path}`);
        const outputPath = `${pin.identity}@${version}/${path}`;
        files.set(outputPath, bytes);
        notices.push({path, file: outputPath, sha256: hash(bytes)});
      }
    }
    collectTree(checkout, revision);
    if (!notices.length) throw new Error(`Missing upstream license/notice text: ${pin.identity} ${version}`);
    notices.sort((a,b) => a.path.localeCompare(b.path, 'en'));
    submodules.sort((a,b) => a.path.localeCompare(b.path, 'en'));
    packages.push({identity: pin.identity, version, revision, source: pin.location, submodules, notices});
  }
  const inventory = {schemaVersion: 1, scope: 'License/NOTICE/COPYING files from all pinned Swift package checkouts. Package presence does not establish linked binary coverage or complete native SDK, project, or generated asset compliance.', lockSha256: hash(lockBytes), packages};
  files.set('inventory.json', Buffer.from(JSON.stringify(inventory, null, 2) + '\n'));
  files.set('README.txt', Buffer.from('Weekaboo iOS native dependency acknowledgments\n\nOriginal upstream license, NOTICE and COPYING files are preserved verbatim for the locked Swift packages in inventory.json, including nested texts. These notices do not relicense dependencies. This inventory covers resolved package checkouts; linked binary dependencies, project licensing and generated asset redistribution require separate review. JavaScript dependency notices are in ../shared.\n'));
  return {files, inventory};
}
export async function writeNativeIosNotices({outputPath, ...options}) {
  const result = await collectNativeIosNotices(options);
  await mkdir(dirname(outputPath), {recursive: true});
  const temporary = await mkdtemp(join(dirname(outputPath), '.native-ios-notices-'));
  try {
    for (const [path, bytes] of result.files) { const target = join(temporary, path); await mkdir(dirname(target), {recursive: true}); await writeFile(target, bytes); }
    await rm(outputPath, {recursive: true, force: true});
    await rename(temporary, outputPath);
  } finally { await rm(temporary, {recursive: true, force: true}); }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {files, inventory} = await writeNativeIosNotices({
    lockPath: join(projectRoot, 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved'),
    checkoutRoots: await defaultCheckoutRoots(),
    outputPath: join(projectRoot, 'ios/App/App/public/licenses/native-ios'),
  });
  console.log(`iOS native notices: ${inventory.packages.length} locked packages, ${files.size - 2} verbatim notices.`);
}
