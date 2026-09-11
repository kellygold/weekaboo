import { test, expect } from '@playwright/test';
import { fakeService } from './service-fixture';

const html = '<html><head><style>.secret{color:red}</style></head><body><div>First &amp; second</div><p>A <strong>clear</strong> paragraph</p><ul><li>Bring notes</li><li>Bring water</li></ul><p><a href="https://example.test/agenda">Agenda</a></p><script>window.badNotes = true</script><img src="https://tracker.invalid/pixel"></body></html>';
async function openNotes(page: import('@playwright/test').Page, provider: string, meeting = false) {
  const api = await fakeService(page);
  api.calendars[0].account_provider = provider;
  api.addEvents([{ id: 45, calendar_id: 7, title: 'Readable notes test', start_at: '2026-09-09T12:00:00+10:00', end_at: '2026-09-09T13:00:00+10:00', all_day: false, editable: true, description: html, meeting_url: meeting ? 'https://teams.live.com/meet/123?p=fake' : undefined, source_url: 'https://outlook.live.com/calendar/item/fake' }]);
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));
  await page.goto('/');
  await page.getByRole('button', { name: /Readable notes test/ }).click();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  return api;
}

for (const provider of ['google', 'microsoft']) {
  test(`${provider}: readable draft preserves original HTML when only title changes`, async ({ page }) => {
    const api = await openNotes(page, provider);
    const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
    await expect(notes).toContainText('First & second');
    await expect(notes.locator('strong')).toHaveText('clear');
    await expect(notes.locator('li')).toHaveCount(2);
    await expect(notes.locator('script, style, img')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Event title' }).fill('Only title changed');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
    expect(api.writes.find(w => w.path === 'events/45')!.body).toEqual({ title: 'Only title changed' });
  });
  test(`${provider}: edited notes preserve literal characters and line breaks`, async ({ page }) => {
    const api = await openNotes(page, provider);
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Budget < 50 & > 20\n<reminder>Bring water</reminder>');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
    expect(api.writes.find(w => w.path === 'events/45')!.body.description).toMatch(/Budget &lt; 50 &amp; &gt; 20[\s\S]*&lt;reminder&gt;Bring water&lt;\/reminder&gt;/);
  });
}

test('Teams notes are editable in Weekaboo with no external detour', async ({ page }) => {
  const api = await openNotes(page, 'microsoft', true);
  const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
  await expect(notes).toBeEditable();
  await expect(notes.locator('strong')).toHaveText('clear');
  await expect(notes.locator('script, style, img')).toHaveCount(0);
  await notes.fill('Updated inside Weekaboo');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  expect(api.writes.find(w => w.path === 'events/45')!.body).toEqual({ description: '<p>Updated inside Weekaboo</p>' });
});

test('iCloud notes remain plain text on save', async ({ page }) => {
  const api = await openNotes(page, 'icloud');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Budget < 50 & > 20\nSecond line');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  expect(api.writes.find(w => w.path === 'events/45')!.body.description).toBe('Budget < 50 & > 20\nSecond line');
});


test('plain single-line notes round-trip without exposing encoded entities', async ({ page }) => {
  const api = await openNotes(page, 'google');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Budget < 50 & a reminder');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: /Readable notes test/ }).click();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveText('Budget < 50 & a reminder');
});

 test('formatting, links and undo work inside the editor', async ({ page }) => {
  const api = await openNotes(page, 'microsoft', true);
  const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
  await notes.fill('Meeting agenda');
  await notes.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(notes.locator('strong')).toHaveText('Meeting agenda');
  await page.getByRole('button', { name: 'Bulleted list', exact: true }).click();
  await expect(notes.locator('ul li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo notes', exact: true }).click();
  await expect(notes.locator('ul')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo notes', exact: true }).click();
  await expect(notes.locator('ul li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add or edit link', exact: true }).click();
  await page.getByRole('textbox', { name: 'Link address' }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Apply link' }).click();
  await expect(page.getByRole('alert')).toContainText('complete https://');
  await page.getByRole('textbox', { name: 'Link address' }).fill('https://example.test/agenda');
  await page.getByRole('button', { name: 'Apply link' }).click();
  await expect(notes.locator('a')).toHaveAttribute('href', 'https://example.test/agenda');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  const saved = api.writes.find(w => w.path === 'events/45')!.body.description;
  expect(saved).toContain('<ul>'); expect(saved).toContain('<strong>');
  expect(saved).toContain('https://example.test/agenda');
});

test('clearing notes saves null and dismissing edits offers to keep them', async ({ page }) => {
  const api = await openNotes(page, 'microsoft', true);
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('');
  await page.getByRole('button', { name: 'Close event editor' }).click();
  await expect(page.getByText('You have unsaved changes.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  expect(api.writes.find(w => w.path === 'events/45')!.body).toEqual({ description: null });
});

test('undo back to the original notes leaves the provider HTML untouched', async ({ page }) => {
  const api = await openNotes(page, 'microsoft', true);
  const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
  await notes.fill('Temporary replacement');
  await page.getByRole('button', { name: 'Undo notes', exact: true }).click();
  await expect(notes).toContainText('First & second');
  await page.getByRole('textbox', { name: 'Event title' }).fill('Title after undo');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect.poll(() => api.writes.some(w => w.path === 'events/45')).toBe(true);
  expect(api.writes.find(w => w.path === 'events/45')!.body).toEqual({ title: 'Title after undo' });
});

test('pasted HTML keeps formatting but drops executable and tracking markup', async ({ page }) => {
  await openNotes(page, 'microsoft', true);
  const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
  await notes.fill('');
  await notes.evaluate(el => {
    const data = new DataTransfer();
    data.setData('text/html', '<p onclick="window.badNotes=true">Safe <b>formatted</b> paste</p><img src="https://tracker.invalid/pixel"><script>window.badNotes=true</script><a href="javascript:alert(1)">Unsafe link</a>');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(notes).toContainText('Safe formatted paste');
  await expect(notes.locator('strong')).toHaveText('formatted');
  await expect(notes.locator('script, img, [onclick], a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).badNotes)).toBeUndefined();
});


test('meeting details stay available in the preview but are separated from editable notes', async ({ page }) => {
  const api = await fakeService(page);
  api.calendars[0].account_provider = 'microsoft';
  api.addEvents([{id:45,calendar_id:7,title:'Meeting details kept',start_at:'2026-09-09T12:00:00+10:00',end_at:'2026-09-09T13:00:00+10:00',all_day:false,editable:true,
    description:'<p>Agenda</p><div class="me-email-text">Conference ID 1234<a href="https://teams.live.com/meetingOptions/meetings/fake/view">Meeting options</a></div>',editable_description:'<p>Agenda</p>'}]);
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+10:00'));
  await page.goto('/');
  await page.getByRole('button',{name:/Meeting details kept/}).click();
  await expect(page.getByText('Conference ID 1234',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Meeting options',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit event',exact:true}).click();
  const notes=page.getByRole('textbox',{name:'Notes',exact:true});
  await expect(notes).toHaveText('Agenda');
  await expect(notes).not.toContainText('Conference ID');
  await notes.fill('Updated agenda');
  await page.getByRole('button',{name:'Save event',exact:true}).click();
  await expect.poll(()=>api.writes.some(w=>w.path==='events/45')).toBe(true);
  expect(api.writes.find(w=>w.path==='events/45')!.body).toEqual({description:'<p>Updated agenda</p>'});
});
