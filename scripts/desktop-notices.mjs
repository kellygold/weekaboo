// Preserve upstream notices for code actually bundled into the desktop main process.
import { readFile, mkdir, cp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { collectModuleNotices } from './module-notices.mjs';

export async function desktopNotices(root, stage, metafile) {
  const { assets, inventory } = await collectModuleNotices(root, Object.keys(metafile.inputs));
  const missing = inventory.filter(pkg => !pkg.noticeFiles.length);
  if (missing.length) throw new Error('Missing desktop dependency notices: ' + missing.map(pkg => pkg.name).join(', '));
  for (const [file, contents] of assets) {
    const target = join(stage, 'licenses/desktop', file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  const electron = join(root, 'node_modules/electron');
  const { version } = JSON.parse(await readFile(join(electron, 'package.json'), 'utf8'));
  await mkdir(join(stage, 'licenses/desktop/electron'), { recursive: true });
  for (const file of ['LICENSE', 'LICENSES.chromium.html']) {
    await cp(join(electron, 'dist', file), join(stage, 'licenses/desktop/electron', file));
  }
  await writeFile(join(stage, 'licenses/desktop/inventory.json'), JSON.stringify({
    packages: inventory,
    electron: version,
    scope: 'Desktop main-process SDK code and Electron. Renderer notices are in dist-desktop/licenses/shared. Native-mobile SDK and generated asset rights remain separate public-release gates.',
  }, null, 2) + '\n');
  return inventory;
}
