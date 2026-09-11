import { test, expect } from '@playwright/test';
import { fakeService } from './service-fixture';

// The normal app header has a New event action that demo-only checks omit.
for (const width of [375, 390]) {
  test(`header actions and event editor remain reachable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));
    await fakeService(page);
    await page.goto('/');
    const add = page.getByRole('button', { name: 'New event', exact: true });
    await expect(add).toBeVisible();
    for (const selector of ['.app-header .brand, .header-right > button', '.calendar-view-controls .view-pills, .schedule-toggle, .calendar-source-control, .tasks-toggle']) {
      const boxes = await page.locator(selector).evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width };
      }));
      for (let i = 0; i < boxes.length; i++) {
        expect(boxes[i].left).toBeGreaterThanOrEqual(0);
        expect(boxes[i].right).toBeLessThanOrEqual(width);
        if (i) expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
      }
    }
    // Both text and icon must be contained; a visible overflowing label is a defect.
    expect(await add.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('phone-header.png') });
    await add.click();
    const editor = page.getByRole('complementary', { name: 'Event editor' });
    await expect(editor).toBeVisible();
    const save = page.getByRole('button', { name: 'Save event', exact: true });
    const close = page.getByRole('button', { name: 'Close event editor' });
    for (const action of [save, close]) {
      const box = (await action.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(812);
    }
    await close.click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button', { name: 'Connected calendars', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Connected calendars', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close calendars', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  });
}
