// Disposable emulator only. Never clears/edits data on a physical device.
import { _android, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const serial = process.env.WEEKABOO_TEST_SERIAL || 'emulator-5554';
if (!serial.startsWith('emulator-')) throw new Error('Foundation proof requires a disposable emulator.');
const out = 'output/standalone-stage1'; mkdirSync(out, { recursive: true });
const adb = (...args) => {
  try { return execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (error) {
    if (!String(error.stderr).includes('offline')) throw error;
    execFileSync('adb', ['-s', serial, 'wait-for-device'], { timeout: 15000 });
    return execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000 }).trim();
  }
};
const receipt = { serial, apkSha256: createHash('sha256').update(readFileSync('android/app/build/outputs/apk/debug/app-debug.apk')).digest('hex'), checks: [], cleanup: false };
const devices = await _android.devices(); let device = devices.find(d => d.serial() === serial);
if (!device) throw new Error('Start the Weekaboo test emulator first.');
const pageForApp = async () => (await device.webView({ pkg: 'app.weekaboo.calendar' })).page();
let page = await pageForApp();
const check = name => receipt.checks.push(name);
let before;
try {
  await expect(page.getByRole('textbox', { name: 'New task' })).toBeVisible();
  before = await page.evaluate(() => window.Capacitor.Plugins.WeekabooStorage.readTasks());
  await page.getByRole('textbox', { name: 'New task' }).fill('WB native persistence fixture');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit WB native persistence fixture', exact: true })).toBeVisible();
  check('normal UI capture reaches SQLite');
  const storage = await page.evaluate(async () => {
    const p = window.Capacitor.Plugins.WeekabooStorage;
    const snapshot = await p.readTasks();
    const accepted = await p.writeTasks(snapshot);
    const rejected = await p.writeTasks({ ...snapshot, tasks: [] });
    await p.vaultPut({ reference: 'proof.accountA', value: 'SYNTHETIC-VAULT-A' });
    await p.vaultPut({ reference: 'proof.accountB', value: 'SYNTHETIC-VAULT-B' });
    await p.vaultRemove({ reference: 'proof.accountA' });
    return { accepted: accepted.committed, rejected: rejected.committed, count: (await p.readTasks()).tasks.length,
      removed: (await p.vaultGet({ reference: 'proof.accountA' })).value, retained: (await p.vaultGet({ reference: 'proof.accountB' })).value === 'SYNTHETIC-VAULT-B' };
  });
  expect(storage).toEqual({ accepted: true, rejected: false, count: before.tasks.length + 1, removed: null, retained: true });
  check('SQLite compare-and-swap rejects stale snapshot without data loss');
  check('vault account isolation and deletion');
  const ciphertext = adb('shell', 'run-as', 'app.weekaboo.calendar', 'cat', 'shared_prefs/weekaboo-vault.xml');
  expect(ciphertext.includes('SYNTHETIC-VAULT')).toBe(false); check('vault file contains ciphertext, not synthetic plaintext');
  await page.screenshot({ path: `${out}/android-task.png` });
  await device.close();
  adb('shell', 'svc', 'wifi', 'disable'); adb('shell', 'svc', 'data', 'disable');
  adb('shell', 'am', 'force-stop', 'app.weekaboo.calendar');
  adb('shell', 'am', 'start', '-n', 'app.weekaboo.calendar/.MainActivity');
  device = (await _android.devices()).find(d => d.serial() === serial);
  page = await pageForApp();
  await expect(page.getByRole('button', { name: 'Edit WB native persistence fixture', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await window.Capacitor.Plugins.WeekabooStorage.vaultGet({ reference: 'proof.accountB' })).value === 'SYNTHETIC-VAULT-B')).toBe(true);
  check('offline force-stop/relaunch preserves UI, SQLite task and vault secret');
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name));
  expect(resources.every(url => new URL(url).hostname === 'localhost')).toBe(true);
  expect(resources.some(url => new URL(url).pathname.startsWith('/api/'))).toBe(false);
  check('offline launch loads bundled assets without legacy API requests');
  await page.screenshot({ path: `${out}/android-offline.png` });
} finally {
  try {
    // Reconnect in a fresh driver after cold-start inspection. Playwright's
    // Android WebView cache can retain a closed pre-restart context.
    const cleanupScript = `
      import { _android } from '@playwright/test';
      const device = (await _android.devices()).find(d => d.serial() === ${JSON.stringify(serial)});
      const page = await (await device.webView({pkg:'app.weekaboo.calendar'})).page();
      const result = await page.evaluate(async snapshot => {
        const p = window.Capacitor.Plugins.WeekabooStorage;
        await p.vaultRemove({reference:'proof.accountA'}); await p.vaultRemove({reference:'proof.accountB'});
        if (snapshot) { const current = await p.readTasks(); await p.writeTasks({revision:current.revision,tasks:snapshot.tasks}); }
        return {tasks:(await p.readTasks()).tasks,secret:(await p.vaultGet({reference:'proof.accountB'})).value};
      }, ${JSON.stringify(before || null)});
      console.log(JSON.stringify(result)); await device.close();
    `;
    const cleanup = JSON.parse(execFileSync(process.execPath, ['--input-type=module'], {input:cleanupScript,encoding:'utf8',timeout:20000}));
    receipt.cleanup = cleanup.secret === null && JSON.stringify(cleanup.tasks) === JSON.stringify(before?.tasks || []);
  } finally {
    writeFileSync(`${out}/android-foundation.json`, JSON.stringify(receipt, null, 2));
    await device.close();
    adb('shell', 'svc', 'wifi', 'enable'); adb('shell', 'svc', 'data', 'enable');
  }
}
console.log(JSON.stringify(receipt, null, 2));
