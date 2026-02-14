import { test, expect } from '@playwright/test';

test.describe('Student Login Flow', () => {
  test('should display family code entry on first visit', async ({ page }) => {
    await page.goto('/student');
    
    // Should see the login page
    await expect(page.locator('h1')).toContainText('Student Login');
    
    // Should see family code input
    await expect(page.getByPlaceholder(/family code/i)).toBeVisible();
    
    // Should see "Ask your parent" help text
    await expect(page.getByText(/ask your parent/i)).toBeVisible();
  });

  test('should show error for invalid family code', async ({ page }) => {
    await page.goto('/student');
    
    // Enter invalid code
    await page.getByPlaceholder(/family code/i).fill('INVALID123');
    await page.getByRole('button', { name: /continue/i }).click();
    
    // Should show error message
    await expect(page.getByText(/no students found/i)).toBeVisible();
  });

  test('should remember family code in localStorage', async ({ page, context }) => {
    // Clear storage first
    await context.clearCookies();
    await page.goto('/student');
    
    // Enter a family code (this test assumes we have a test family)
    const testFamilyCode = 'TEST1234';
    await page.getByPlaceholder(/family code/i)).fill(testFamilyCode);
    await page.getByRole('button', { name: /continue/i }).click();
    
    // Reload the page
    await page.reload();
    
    // Should not ask for family code again (skip to student selection)
    await expect(page.getByPlaceholder(/family code/i)).not.toBeVisible();
  });

  test('should require 4-digit PIN', async ({ page }) => {
    // This test assumes we've already entered a family code
    // and are on the PIN entry screen
    await page.goto('/student');
    
    // Simulate already having a saved family code
    await page.evaluate(() => {
      localStorage.setItem('village_family_code', 'TEST1234');
    });
    
    await page.reload();
    
    // Select a student (assuming one exists)
    await page.getByText(/select.*name/i).first().click();
    
    // PIN input should appear
    const pinInput = page.locator('input[type="password"][maxlength="4"]');
    await expect(pinInput).toBeVisible();
    
    // Enter button should be disabled with < 4 digits
    await pinInput.fill('123');
    await expect(page.getByRole('button', { name: /enter/i })).toBeDisabled();
    
    // Enter button should be enabled with 4 digits
    await pinInput.fill('1234');
    await expect(page.getByRole('button', { name: /enter/i })).toBeEnabled();
  });

  test('should show error for wrong PIN', async ({ page }) => {
    await page.goto('/student');
    
    // Simulate selecting student and entering wrong PIN
    // (Implementation depends on test data setup)
    
    // Should show "Wrong PIN" error
    await expect(page.getByText(/wrong pin/i)).toBeVisible();
  });
});
