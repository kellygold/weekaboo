import { test, expect } from '@playwright/test';
import { mascotSounds } from '../src/mascotSounds';

test('mascot sound is click-only, restarts one player and respects persisted mute', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { plays: 0, players: new Set<HTMLMediaElement>(), sources: [] as string[] };
    Object.assign(window, { mascotAudioTest: state });
    HTMLMediaElement.prototype.play = function () {
      state.plays++; state.players.add(this); state.sources.push(new URL(this.src).pathname); return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.goto('/?demo=1');
  const played = () => page.evaluate(() => {
    const state = (window as any).mascotAudioTest;
    return { plays: state.plays, players: state.players.size };
  });
  expect(await played()).toEqual({ plays: 0, players: 0 });
  const mascot = page.getByRole('button', { name: 'Replay Weekaboo animation' });
  for (let i = 0; i < 12; i++) await mascot.click();
  expect(await played()).toEqual({ plays: 12, players: 1 });
  const sources: string[] = await page.evaluate(() => (window as any).mascotAudioTest.sources);
  expect(sources.every(source => mascotSounds.includes(source as typeof mascotSounds[number]))).toBe(true);
  expect(sources.every((source, i) => i === 0 || source !== sources[i - 1])).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Mascot sound' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await mascot.click();
  expect(await played()).toEqual({ plays: 12, players: 1 });
  await page.reload(); await mascot.click();
  expect(await played()).toEqual({ plays: 0, players: 0 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Mascot sound' })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Mascot sound' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await mascot.click();
  expect(await played()).toEqual({ plays: 1, players: 1 });
  // Check the actual bundled asset can load and decode, beyond the play spy.
  for (const source of mascotSounds) expect(await page.evaluate(async source => {
    const clip = new Audio(source);
    return await new Promise<boolean>(resolve => {
      clip.onloadedmetadata = () => resolve(clip.duration > 0 && clip.duration < 3.6);
      clip.onerror = () => resolve(false);
      clip.load();
    });
  }, source)).toBe(true);
});
