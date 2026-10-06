const { test, expect } = require('@playwright/test');

async function fillValidForm(page) {
  await page.locator('#employeeId').fill(`pw-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await page.locator('#fromDate').fill('2026-03-01');
  await page.locator('#toDate').fill('2026-03-03');
  await page.locator('#reason').fill('Playwright integration test');
}

async function createRequest(page) {
  await fillValidForm(page);
  await page.locator('#leave-form button[type="submit"]').click();
  await expect(page.locator('#details-view')).toBeVisible();
  await expect(page.locator('#state-span')).toHaveText('PENDING');
}

async function assertCompletedAction(page, buttonId, expectedState) {
  await expect(page.locator('#state-span')).toHaveText('PENDING');
  await expect(page.locator(buttonId)).toBeVisible();
  await page.locator(buttonId).click();
  await expect(page.locator('#state-span')).toHaveText(expectedState);
  await expect(page.locator('#action-msg')).toHaveText('عملیات با موفقیت انجام شد');
  for (const id of ['#approve-btn', '#reject-btn', '#cancel-btn']) {
    await expect(page.locator(id)).toBeHidden();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('فرم درخواست و کنترل اعتبارسنجی فیلد اجباری', async ({ page }) => {
  await expect(page.locator('#leave-form')).toBeVisible();
  await expect(page.locator('#employeeId')).toBeVisible();
  await expect(page.locator('#fromDate')).toBeVisible();
  await expect(page.locator('#toDate')).toBeVisible();
  await expect(page.locator('#reason')).toBeVisible();

  const valid = await page.locator('#employeeId').evaluate(el => el.validity.valid);
  expect(valid).toBe(false);

  await page.locator('#leave-form button[type="submit"]').click();
  await expect(page.locator('#main-view')).toBeVisible();
  await expect(page.locator('#details-view')).toBeHidden();
});

test('ثبت موفق، نمایش PENDING، پیام موفقیت اقدام، بازگشت و reset فرم', async ({ page }) => {
  await createRequest(page);
  await expect(page.locator('#approve-btn')).toBeVisible();
  await expect(page.locator('#reject-btn')).toBeVisible();
  await expect(page.locator('#cancel-btn')).toBeVisible();
  await page.locator('#approve-btn').click();
  await expect(page.locator('#state-span')).toHaveText('APPROVED');
  await expect(page.locator('#action-msg')).toHaveText('عملیات با موفقیت انجام شد');
  for (const id of ['#approve-btn', '#reject-btn', '#cancel-btn']) await expect(page.locator(id)).toBeHidden();

  await page.locator('#back-btn').click();
  await expect(page.locator('#details-view')).toBeHidden();
  await expect(page.locator('#main-view')).toBeVisible();
  for (const id of ['#employeeId', '#fromDate', '#toDate', '#reason']) {
    await expect(page.locator(id)).toHaveValue('');
  }
  await expect(page.locator('#form-msg')).toBeEmpty();
});

test('اقدام تأیید: PENDING به APPROVED و مخفی شدن همه actionها', async ({ page }) => {
  await createRequest(page);
  await assertCompletedAction(page, '#approve-btn', 'APPROVED');
});

test('اقدام رد: PENDING به REJECTED و مخفی شدن همه actionها', async ({ page }) => {
  await createRequest(page);
  await assertCompletedAction(page, '#reject-btn', 'REJECTED');
});

test('اقدام لغو: PENDING به CANCELLED و مخفی شدن همه actionها', async ({ page }) => {
  await createRequest(page);
  await assertCompletedAction(page, '#cancel-btn', 'CANCELLED');
});
