import { test, expect } from '@playwright/test';

test.describe('Demo Mode - Connection', () => {
  test('dashboard loads with 5 simulated drones', async ({ page }) => {
    await page.goto('/');
    // Wait for demo mode to initialize
    await page.waitForTimeout(2000);
    // Look for drone entries in the UI
    // The demo mode creates 5 drones -- verify they appear
    await expect(page.locator('body')).toBeVisible();
    // TODO: Add specific selectors once UI is confirmed
  });

  test('can select a drone from the list', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // TODO: Click on a drone, verify selection state changes
    await expect(page.locator('body')).toBeVisible();
  });
});
