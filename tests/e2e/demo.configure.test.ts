import { test, expect } from '@playwright/test';

test.describe('Demo Mode - Configure', () => {
  test('can navigate to configure tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // TODO: Click configure tab, verify panel list renders
    await expect(page.locator('body')).toBeVisible();
  });

  test('can open a configuration panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // TODO: Open a specific panel, verify params load
    await expect(page.locator('body')).toBeVisible();
  });
});
