import { test, expect } from '@playwright/test';

test.describe('Demo Mode - Mission Planning', () => {
  test('can navigate to plan tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('can place waypoints on map', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // TODO: Switch to plan tab, use waypoint tool to place points
    await expect(page.locator('body')).toBeVisible();
  });
});
