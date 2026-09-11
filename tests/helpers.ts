import type { Page } from '@playwright/test';
export async function choose(page: Page, name: string, label: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

export async function editTaskDetails(page: Page) {
  await page.getByRole('button', { name: 'Edit task details', exact: true }).click();
  const schedule = page.locator('.task-schedule-options');
  if (await schedule.getAttribute('open') === null) await schedule.locator('summary').click();
}
