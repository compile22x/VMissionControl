import { test, expect } from '@playwright/test';

test.describe('SITL - Arm & Takeoff', () => {
  test.skip('arms and takes off in SITL', async ({ page }) => {
    // Requires SITL running - skipped in CI
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
