// Packaged app smoke check; assert an isolated OS profile before any write.
import { _electron, expect } from '@playwright/test';
import { loadAuthConfig } from '../desktop/auth-config.mjs';
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const signed = process.argv.includes('--signed');
const profile = mkdtempSync(join(tmpdir(), 'weekaboo-packaged-proof-'));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await _electron.launch({ executablePath: resolve('output/standalone-desktop/' + (signed ? 'package-signed' : 'package') + '/Weekaboo-darwin-arm64/Weekaboo.app/Contents/MacOS/Weekaboo'), args: ['--user-data-dir=' + profile], env, timeout: 30000 });
  const state = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, profile: app.getPath('userData') }));
  expect(state.packaged).toBe(true); expect(realpathSync(state.profile)).toBe(realpathSync(profile));
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Your things', exact: true })).toBeVisible();
  await page.getByPlaceholder('Something to get done…').fill('Packaged Mac fixture');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Packaged Mac fixture', exact: true })).toBeVisible();
  const configured = loadAuthConfig(resolve('desktop/native-auth.json'));
  await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Manage accounts', exact: true }).click();
  await expect(page.getByText('Your first connected account will appear here.', { exact: true })).toBeVisible();
  for (const [provider, ready] of [['Google', Boolean(configured.google)], ['Microsoft', Boolean(configured.microsoft)], ['iCloud', true]]) {
    const button = page.getByRole('button', { name: 'Connect ' + provider, exact: true });
    if (ready) await expect(button).toBeEnabled(); else await expect(button).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Close accounts', exact: true }).click();
  writeFileSync('output/standalone-desktop/packaged' + (signed ? '-signed' : '') + '.png', await page.screenshot());
  writeFileSync('output/standalone-desktop/packaged' + (signed ? '-signed' : '') + '-proof.json', JSON.stringify({ packaged: true, developerIDSigned: signed, taskCreated: true, isolatedProfile: true, connectionAvailabilityMatchesConfiguration: true, liveConsent: false, publicRelease: false, notarized: false }, null, 2));
  console.log('Packaged macOS app opens and saves a task in isolated profile.');
} finally { await app?.close(); rmSync(profile, { recursive: true, force: true }); }
