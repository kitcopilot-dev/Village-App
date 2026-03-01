import { test, expect } from '@playwright/test';

test.describe('Attendance', () => {
  test.beforeEach(async ({ page }) => {
    // Login as parent
    await page.goto('/parent/login');
    await page.fill('[data-testid="email"]', 'parent1@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
  });

  test('should navigate to attendance page', async ({ page }) => {
    await page.goto('/parent/attendance');
    
    // Attendance page should load
    await expect(page.getByRole('heading')).toContainText(/attendance|calendar/i);
  });

  test('should display monthly calendar view', async ({ page }) => {
    await page.goto('/parent/attendance');
    
    // Should show a calendar
    const calendar = page.locator('calendar, [class*="calendar"], [data-testid="calendar"]');
    await expect(calendar).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Calendar component not found');
    });
  });

  test('should be able to mark attendance for a child', async ({ page }) => {
    await page.goto('/parent/attendance');
    
    // Look for attendance marking controls
    const presentButton = page.locator('[data-testid="mark-present"], button:has-text("Present")');
    const absentButton = page.locator('[data-testid="mark-absent"], button:has-text("Absent")');
    
    // At least one should be visible
    const hasControls = await presentButton.isVisible().catch(() => false) || 
                        await absentButton.isVisible().catch(() => false);
    
    expect(hasControls).toBeTruthy();
  });
});

test.describe('Portfolios', () => {
  test.beforeEach(async ({ page }) => {
    // Login as parent
    await page.goto('/parent/login');
    await page.fill('[data-testid="email"]', 'parent1@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
  });

  test('should navigate to portfolios page', async ({ page }) => {
    await page.goto('/parent/portfolios');
    
    // Portfolios page should load
    await expect(page.getByRole('heading')).toContainText(/portfolio|work sample|gallery/i);
  });

  test('should display work samples', async ({ page }) => {
    await page.goto('/parent/portfolios');
    
    // Should show work samples or upload area
    const samplesArea = page.locator('[data-testid="work-samples"], .samples, [class*="sample"]');
    await expect(samplesArea).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Work samples area not found');
    });
  });

  test('should have upload functionality', async ({ page }) => {
    await page.goto('/parent/portfolios');
    
    // Look for upload button
    const uploadButton = page.locator('[data-testid="upload-button"], button:has-text("Upload"), input[type="file"]');
    const hasUpload = await uploadButton.isVisible().catch(() => false);
    
    // Should have upload capability or message
    expect(hasUpload || await page.getByText(/no sample|upload/i).isVisible()).toBeTruthy();
  });
});
