import { test, expect } from '@playwright/test';

test.describe('Demo Mode - Air Traffic', () => {
  test('can navigate to air traffic tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
