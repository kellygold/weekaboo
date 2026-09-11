// Isolated Mac profile and disposable fixtures. No existing accounts or tasks touched.
import { _electron, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const profile = mkdtempSync(join(tmpdir(), 'weekaboo-desktop-proof-'));
const env = { ...process.env, WEEKABOO_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
const entry = join(profile, 'proof-entry.mjs');
// Playwright normally uses a mock Keychain. Remove that test flag before app readiness.
writeFileSync(entry, `import { app } from 'electron'; app.commandLine.removeSwitch('use-mock-keychain'); app.commandLine.removeSwitch('password-store'); await import(${JSON.stringify(pathToFileURL(resolve('desktop/main.mjs')).href)});`);
let app; const checks = [];
try {
  app = await _electron.launch({ args: [entry], env, timeout: 30000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(12000);
  await expect(page.getByRole('heading', { name: 'Your things', exact: true })).toBeVisible();
  await page.getByPlaceholder('Something to get done…').fill('Mac standalone fixture');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Mac standalone fixture', exact: true })).toBeVisible();
  checks.push('Shared React capture renders in isolated native Mac window');
  const native = await page.evaluate(async () => {
    const raw = window.weekabooNative;
    const bridge = Object.fromEntries(Object.keys(raw).map(name => [name, async input => { const result = await raw[name](input); if (!result.ok) throw result.error; return result.value; }]));
    const tasks = await bridge.readTasks();
    let stale, fractional, unsafeHost, unsafeReference;
    stale = await bridge.writeTasks({ revision: tasks.revision - 1, tasks: [] });
    try { await bridge.writeTasks({ revision: 0.5, tasks: [] }); } catch (e) { fractional = e.code; }
    try { await bridge.request({ url: 'https://attacker.example/', method: 'GET', headers: { Authorization: 'synthetic' } }); } catch (e) { unsafeHost = e.code; }
    try { await bridge.vaultGet({ reference: '../private' }); } catch (e) { unsafeReference = e.code; }
    await bridge.vaultPut({ reference: 'fixture-secret', value: 'synthetic-desktop-vault-value' });
    const value = await bridge.vaultGet({ reference: 'fixture-secret' });
    await bridge.vaultRemove({ reference: 'fixture-secret' });
    return { tasks: tasks.tasks.length, stale: stale.committed, fractional, unsafeHost, unsafeReference, vault: value.value === 'synthetic-desktop-vault-value', removed: (await bridge.vaultGet({ reference: 'fixture-secret' })).value === null };
  });
  expect(native).toEqual({ tasks: 1, stale: false, fractional: 'validation', unsafeHost: 'validation', unsafeReference: 'validation', vault: true, removed: true });
  checks.push('SQLite tasks/CAS and real Mac safeStorage vault round-trip; unsafe targets rejected');
  expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('use-mock-keychain'))).toBe(false);
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(preferences.sandbox).toBe(true); expect(preferences.contextIsolation).toBe(true); expect(preferences.nodeIntegration).toBe(false);
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  checks.push('Renderer sandbox/context isolation enabled and Node absent');
  const auth = await page.evaluate(async () => {
    const bridge = window.weekabooNative;
    const setup = await bridge.authSetup();
    const negative = await bridge.authAcquire({ provider: 'microsoft', interactive: false, accountRef: 'missing-fixture-account' });
    return { setup: setup.ok, microsoft: setup.value.microsoftConfigured, negative };
  });
  expect(auth.setup).toBe(true);
  expect(auth.negative.ok).toBe(false);
  expect(auth.negative.error.code).toBe(auth.microsoft ? 'interaction-required' : 'configuration');
  checks.push('Native desktop SDK bridge reports missing account/configuration without exposing diagnostics');

  // File chooser selections are mocked; actual native filesystem exchange runs.
  const backup = join(profile, 'tasks.json');
  await app.evaluate(({ dialog }, backup) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: backup });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backup] });
  }, backup);
  await page.evaluate(() => window.weekabooNative.saveFile({ name: 'weekaboo-tasks-2026-09-11.json', contents: '{"fixture":true}' }));
  expect(readFileSync(backup, 'utf8')).toBe('{"fixture":true}');
  expect(await page.evaluate(() => window.weekabooNative.pickFile())).toEqual({ ok: true, value: '{"fixture":true}' });
  checks.push('Native file read/write with synthetic chooser selection');
  const http = await page.evaluate(() => window.weekabooNative.request({ url: 'https://caldav.icloud.com/', method: 'PROPFIND', headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>' }));
  expect(http.ok).toBe(true); expect(http.value.status).toBe(401); checks.push('Real unauthenticated iCloud PROPFIND returns 401 through native HTTPS');
  writeFileSync('output/standalone-desktop/foundation.png', await page.screenshot());
  await app.close(); app = null;
  app = await _electron.launch({ args: [entry], env, timeout: 30000 });
  const restarted = await app.firstWindow();
  await expect(restarted.getByRole('button', { name: 'Edit Mac standalone fixture', exact: true })).toBeVisible();
  checks.push('Task survives full desktop process restart');
  writeFileSync('output/standalone-desktop/foundation.json', JSON.stringify({ checks, googleMicrosoftLiveConsent: false, liveICloudConsent: false, systemFileDialogInteraction: false, packaged: false, isolatedProfile: true }, null, 2));
  console.log('Desktop foundation passed:', checks);
} finally {
  await app?.close(); rmSync(profile, { recursive: true, force: true });
  writeFileSync('output/standalone-desktop/cleanup.json', JSON.stringify({ isolatedProfileRemoved: true }));
}
