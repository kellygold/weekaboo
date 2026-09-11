import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

let fixture: string;
test.beforeAll(async () => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {AccountSetup} from './src/AccountSetup';
    import {ServiceProvider} from './src/services/context';
    let rows = [], request, finish, fail, finishList, deferList = false;
    window.proof = {
      finish: () => finish(), fail: () => fail(new Error('Could not connect. Please try again.')),
      finishList: (empty = false) => finishList(empty ? [] : rows), request: () => request,
      redirect: () => finish('redirecting'),
    };
    const services = {
      accounts: {
        availability: async () => ({google:true,microsoft:true,icloud:true}),
        cancelConnection: async () => { fail(new Error('Connection cancelled. Your existing accounts are unchanged.')); },
        disconnect: async () => { rows = []; deferList = false; },
        list: async () => deferList ? new Promise(resolve => { finishList = resolve; }) : rows,
        connect: async value => {
          request = value;
          const outcome = await new Promise((resolve,reject) => {finish=resolve;fail=reject;});
          if (outcome === 'redirecting') return outcome;
          rows = [{id:'new',provider:value.provider,email:'new@example.test',status:'active'}];
          deferList = true;
        },
      },
      calendars: {pendingWrites: async () => []},
    };
    createRoot(document.getElementById('proof')).render(<ServiceProvider services={services}><AccountSetup close={() => {window.closedProof=true}} calendars={() => {window.choseCalendars=true}} /></ServiceProvider>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
  fixture = bundle.outputFiles[0].text;
});
async function open(page: import('@playwright/test').Page, provider: string) {
  await page.route('**/connection-proof', r => r.fulfill({ contentType: 'text/html', body: '<html><head><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/calendar-controls.css"><link rel="stylesheet" href="/src/app-shell.css"></head><body><div id="proof"></div></body></html>' }));
  await page.goto('/connection-proof');
  await page.addScriptTag({ content: fixture });
  await page.getByRole('button', {name: `Connect ${provider}`, exact:true}).click();
  if(provider==='Microsoft') await page.getByRole('button',{name:'Continue to Microsoft'}).click();
  if(provider==='iCloud') {
    await page.getByLabel('Apple ID').fill('new@example.test');
    await page.getByLabel('App-specific password').fill('synthetic-only');
    await page.getByRole('button',{name:'Connect iCloud account'}).click();
  }
}
for(const provider of ['Google','Microsoft','iCloud']) test(`${provider} remains visibly connecting through discovery and account refresh, then confirms success`, async ({page}) => {
  await open(page,provider);
  const status=page.getByRole('status');
  await expect(status).toContainText(`${provider} is connecting`);
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeDisabled();
  await expect(page.getByText('Your first connected account will appear here.')).toHaveCount(0);
  await page.evaluate(() => (window as any).proof.finish());
  await expect(status).toContainText(`${provider} is connecting`);
  await expect(page.locator('.connected-account')).toHaveCount(0);
  await page.evaluate(() => (window as any).proof.finishList());
  await expect(status).toContainText(`${provider} connected`);
  await expect(page.locator('.connected-account')).toContainText('new@example.test');
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeEnabled();
  expect(await page.evaluate(() => (window as any).choseCalendars)).toBeUndefined();
  await page.screenshot({path:`output/production-validation/account-feedback/${provider.toLowerCase()}-connected.png`});
  await page.getByRole('button',{name:'Choose calendars →'}).click();
  expect(await page.evaluate(() => (window as any).choseCalendars)).toBe(true);
});
test('iCloud failure clears password and allows a fresh attempt without dismissing setup', async({page}) => {
  await open(page,'iCloud');
  await expect(page.getByLabel('App-specific password')).toBeDisabled();
  await page.evaluate(() => (window as any).proof.fail());
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByLabel('App-specific password')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Connect iCloud account'})).toBeDisabled();
  await page.getByLabel('App-specific password').fill('another-synthetic');
  await page.getByRole('button',{name:'Connect iCloud account'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('iCloud is connecting');
});
test('browser redirect is not announced as a successful connection before OAuth completes', async({page}) => {
  await open(page,'Google');
  await page.evaluate(() => (window as any).proof.redirect());
  await expect(page.getByRole('status')).toContainText('Google is connecting');
  await expect(page.getByRole('button',{name:'Connect Google',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true})));
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.getByRole('alert')).toContainText('Sign-in was not completed');
  await expect(page.locator('.connected-account')).toHaveCount(0);
});

test('account refresh without the newly connected provider does not announce success', async({page}) => {
  await open(page,'iCloud');
  await page.evaluate(() => (window as any).proof.finish());
  await page.evaluate(() => (window as any).proof.finishList(true));
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.getByRole('alert')).toContainText('account is not visible yet');
});
test('disconnect clears the preceding connection confirmation', async({page}) => {
  await open(page,'iCloud');
  await page.evaluate(() => (window as any).proof.finish());
  await page.evaluate(() => (window as any).proof.finishList());
  await expect(page.getByRole('status')).toContainText('iCloud connected');
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await page.getByRole('button',{name:'Disconnect account',exact:true}).click();
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.locator('.connected-account')).toHaveCount(0);
});
test('phone-width connecting feedback fits and respects reduced motion', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'iCloud');
  await expect(page.getByRole('status')).toContainText('iCloud is connecting');
  expect(await page.locator('.connection-spinner').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  expect(await page.locator('.connection-feedback').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({path:'output/production-validation/account-feedback/phone-connecting.png'});
});

for (const provider of ['Google', 'Microsoft', 'iCloud']) test(`${provider} failure stops progress and unlocks navigation`, async ({page}) => {
  await open(page,provider);
  await page.evaluate(() => (window as any).proof.fail());
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Connect '+provider,exact:true})).toBeEnabled();
});
for (const provider of ['Google', 'Microsoft']) test(`${provider} abandoned browser sign-in can be cancelled and retried`, async ({page}) => {
  await open(page,provider);
  await page.getByRole('button',{name:'Cancel sign-in',exact:true}).click();
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.getByRole('alert')).toContainText('Connection cancelled');
  await expect(page.getByRole('button',{name:'Close accounts'})).toBeEnabled();
  if(provider==='Google') await page.getByRole('button',{name:'Connect Google',exact:true}).click();
  else await page.getByRole('button',{name:'Continue to Microsoft'}).click();
  await expect(page.getByRole('status')).toContainText(provider+' is connecting');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('long browser wait explains recovery without inventing an error',async({page})=>{
  await page.clock.install();
  await open(page,'Microsoft');
  await page.clock.fastForward(16000);
  await expect(page.getByRole('status')).toContainText('Still waiting for sign-in');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Cancel sign-in',exact:true})).toBeEnabled();
});
