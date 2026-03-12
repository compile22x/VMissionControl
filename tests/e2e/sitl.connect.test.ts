import { test, expect } from '@playwright/test';

test.describe('SITL - Connection', () => {
  test.skip('connects to SITL ArduPilot', async ({ page }) => {
    // Requires SITL running - skipped in CI
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
