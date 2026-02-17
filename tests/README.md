# Village E2E Tests

Automated end-to-end tests using Playwright.

## Setup

```bash
# Install dependencies (already done)
npm install

# Install Playwright browsers
npx playwright install
```

## Running Tests

```bash
# Run all tests (headless)
npm test

# Run with UI (interactive mode)
npm run test:ui

# Run with browser visible
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# View test report
npm run test:report
```

## Test Structure

- **`student-login.spec.ts`** - Student login flow (family code, PIN, etc.)
- **`parent-profile.spec.ts`** - Parent profile CRUD, faith preference
- **`accessibility.spec.ts`** - Accessibility audits with axe

## Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('/my-page');
  await expect(page.getByRole('heading')).toContainText('My Page');
});
```

## CI/CD

Tests run automatically in GitHub Actions (when configured).

## Coverage

Current coverage:
- ✅ Student login flow
- ✅ Parent profile edit
- ✅ Faith preference selection
- ✅ Basic accessibility checks
- ⏳ TODO: Dashboard flows
- ⏳ TODO: Portfolio upload
- ⏳ TODO: Event creation

## Troubleshooting

**Tests fail with "baseURL not found":**
- Make sure dev server is running: `npm run dev`
- Or let Playwright start it automatically (configured in playwright.config.ts)

**Browser not installed:**
```bash
npx playwright install chromium
```

**Slow tests:**
- Use `test.only()` to run specific tests
- Use `--workers=1` to run serially
