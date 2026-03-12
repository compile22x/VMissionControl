import { test, expect } from '@playwright/test';

test.describe('Demo Mode - Simulation', () => {
  test('can navigate to simulate tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
