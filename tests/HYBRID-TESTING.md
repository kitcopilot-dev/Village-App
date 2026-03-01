# Village Testing Strategy - Hybrid Approach

## Overview
We use **agent-browser** for fast PDF generation and simple tasks, and **Playwright** for comprehensive E2E testing.

## Quick Scripts (agent-browser)

### Generate PDFs for homeschool assignments
```bash
# Quick PDF generation - FAST!
agent-browser open "file:///path/to/assignment.html"
agent-browser pdf output.pdf
agent-browser close
```

### Screenshot capture
```bash
agent-browser open "http://localhost:3001"
agent-browser screenshot screenshot.png
```

### Quick page tests
```bash
bash tests/agent-browser-test.sh
```

## Full Test Suite (Playwright)

### Run all tests
```bash
npm test                    # All browsers
npm run test:headed        # Visible browser
npm run test:ui            # Interactive UI
```

### Run specific categories
```bash
npm test -- --grep "smoke"         # Quick smoke tests
npm test -- --grep "critical"       # Critical paths only
npm test -- --grep "accessibility" # Accessibility tests
```

## When to Use What

| Task | Tool | Why |
|------|------|-----|
| PDF generation | **agent-browser** | 2-3x faster |
| Quick screenshots | **agent-browser** | Instant CLI |
| Page navigation checks | **agent-browser** | Lightweight |
| Full E2E with assertions | **Playwright** | Rich API |
| Accessibility audits | **Playwright** | axe integration |
| Cross-browser testing | **Playwright** | Chrome/FF/Safari |
| CI/CD pipelines | **Playwright** | Better reporting |

## Performance Benchmarks

| Operation | agent-browser | Playwright |
|-----------|--------------|------------|
| 7 page navigations | ~8 sec | ~67 sec |
| Screenshot | 205ms | ~500ms |
| PDF generation | 163ms | ~400ms |

## Files

- `tests/agent-browser-test.sh` - Quick navigation tests
- `tests/agent-browser-pdf.sh` - PDF generation script
- `tests/*.spec.ts` - Full Playwright test suites
- `TEST-CHECKLIST.md` - Test coverage checklist
