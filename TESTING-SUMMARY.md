# Village Testing & QA - Complete Guide

**Created:** 2026-02-14  
**Status:** Ready for use  

---

## 📦 What Was Created

### 1. **`TESTING.md`** - Comprehensive Manual Testing Checklist
✅ **Created**  
**Location:** `village-v2/TESTING.md`  
**Purpose:** Step-by-step manual testing guide  

**Covers:**
- 🎯 Critical user flows (parent onboarding, student login, daily ops, community)
- 🔧 Backend testing (PocketBase, email/PDF generation)
- 🎨 Frontend testing (page-by-page checklist)
- 📱 Cross-cutting concerns (responsive, performance, accessibility, security)
- 📊 Success metrics

**How to use:**
```bash
# Read the checklist
cat village-v2/TESTING.md

# Work through each section
# Mark items as ✅ Pass, ❌ Fail, ⏸️ Blocked, or ➖ N/A
# Document bugs in GitHub Issues
```

---

### 2. **`ux-scorecard.html`** - Interactive UX Scoring Tool
✅ **Created**  
**Location:** `village-v2/ux-scorecard.html`  
**Purpose:** Score Village UX quality (0-100 points)  

**Features:**
- 5 categories: Ease of Use, Visual Design, Performance, Accessibility, Functionality
- 17 criteria total
- Auto-calculates score and grade
- Saves progress to localStorage
- Export results as text file

**How to use:**
```bash
# Open in browser
open village-v2/ux-scorecard.html
# (or drag file into Chrome/Firefox)

# Check boxes as you test
# Watch score update in real-time
# Click "Export Results" to save report
```

**Grading scale:**
- 90-100 = Excellent ✨ (ship it!)
- 75-89 = Good 👍 (minor improvements)
- 60-74 = Fair 🤔 (needs work)
- <60 = Needs Work 🔧 (major issues)

---

### 3. **`PRELIMINARY-ASSESSMENT.md`** - Initial UX Review
✅ **Created**  
**Location:** `village-v2/PRELIMINARY-ASSESSMENT.md`  
**Purpose:** Baseline assessment from code review  

**Key findings:**
- **Score: ~72/100 (Fair)**
- **Strengths:** Solid architecture, good design, clever features
- **Weaknesses:** No onboarding, cache bug, missing empty states, no testing
- **Blockers:** Onboarding flow, dashboard bug, PocketBase schema update
- **Timeline:** 2-3 weeks to reach 80+ score

**Read it:**
```bash
cat village-v2/PRELIMINARY-ASSESSMENT.md
```

---

### 4. **Automated E2E Tests (Playwright)**
✅ **Created**  
**Location:** `village-v2/tests/`  
**Purpose:** Automated regression testing  

**Test suites:**
- `student-login.spec.ts` - Student login flow (5 tests)
- `parent-profile.spec.ts` - Profile CRUD + faith preference (6 tests)
- `accessibility.spec.ts` - Accessibility audits (5 tests)

**Setup:**
```bash
cd village-v2

# Install Playwright browsers
npx playwright install

# Run tests
npm test

# Run with UI
npm run test:ui

# Debug
npm run test:debug
```

**Coverage:**
- ✅ Student login (family code, PIN, localStorage)
- ✅ Parent profile (edit, save, faith preference)
- ✅ Accessibility (axe scans, keyboard nav, alt text)
- ⏳ TODO: Dashboard, portfolio, events

---

## 🗺️ Complete Testing Workflow

### Step 1: Manual Testing
1. Open `TESTING.md`
2. Work through each section systematically
3. Document bugs in GitHub Issues
4. Mark completion status

**Time estimate:** 4-6 hours for full pass

---

### Step 2: UX Scoring
1. Open `ux-scorecard.html` in browser
2. Test each criterion
3. Check boxes as you complete
4. Export results when done

**Time estimate:** 1-2 hours

---

### Step 3: Automated Tests
1. Run Playwright tests: `npm test`
2. Review failures
3. Fix bugs
4. Re-run until all green

**Time estimate:** 30 minutes (once set up)

---

### Step 4: Performance Audit
1. Open Chrome DevTools
2. Run Lighthouse on key pages:
   - Homepage
   - /profile
   - /dashboard
   - /student
3. Aim for 90+ scores

**Time estimate:** 1 hour

---

### Step 5: Real Device Testing
1. Test on actual iPhone
2. Test on actual Android device
3. Test on tablet (iPad/Android)
4. Verify touch targets, responsiveness

**Time estimate:** 2 hours

---

## 📊 Success Criteria

Before launching Village:

**Must Have (Blockers):**
- [ ] All critical user flows work end-to-end
- [ ] 0 critical bugs
- [ ] UX score ≥75 (Good)
- [ ] Lighthouse performance ≥80
- [ ] Lighthouse accessibility ≥90
- [ ] Tested on mobile devices
- [ ] Onboarding flow implemented

**Should Have:**
- [ ] UX score ≥80
- [ ] All Playwright tests passing
- [ ] Dashboard cache bug fixed
- [ ] Empty states for all pages
- [ ] Loading states throughout

**Nice to Have:**
- [ ] UX score ≥90 (Excellent)
- [ ] Lighthouse scores all ≥90
- [ ] User testing with 5+ families
- [ ] Help documentation/FAQ

---

## 🐛 Bug Tracking

### High Priority Bugs (Already Identified)
1. **Dashboard cache** - Requires hard refresh to see updates
2. **No onboarding** - New users confused
3. **Empty states missing** - Pages look broken with no data
4. **Faith preference schema** - Not in PocketBase yet
5. **Loading states missing** - No spinners during fetch

### Report New Bugs
Create GitHub issue with:
- **Title:** [Bug] Brief description
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots (if visual)**
- **Browser/device info**
- **Severity:** Critical / High / Medium / Low

---

## 🔄 Continuous Testing

### Every Code Change:
1. Run Playwright tests: `npm test`
2. Manually test affected feature
3. Check no regressions

### Before Every PR:
1. Run full Playwright suite
2. Check UX scorecard for affected areas
3. Run Lighthouse on changed pages

### Weekly:
1. Full manual testing pass (TESTING.md)
2. Re-run UX scorecard
3. Device testing

---

## 🛠️ Tools Reference

| Tool | Purpose | Command |
|------|---------|---------|
| TESTING.md | Manual checklist | `cat TESTING.md` |
| ux-scorecard.html | UX scoring | `open ux-scorecard.html` |
| Playwright | E2E tests | `npm test` |
| Lighthouse | Performance | DevTools → Lighthouse |
| axe DevTools | Accessibility | Browser extension |

---

## 📈 Progress Tracking

**Current Status:**
- ✅ Testing infrastructure set up
- ✅ Manual checklist created
- ✅ UX scorecard built
- ✅ Automated tests started
- ⏳ Onboarding design in progress (sub-agent)
- ⏳ Full testing pass pending

**Next Actions:**
1. Run `ux-scorecard.html` and get baseline score
2. Fix top 3 bugs from PRELIMINARY-ASSESSMENT.md
3. Complete onboarding flow (wait for sub-agent)
4. Run full manual testing pass
5. User test with real families

---

## 🎯 2-Week Sprint Plan

### Week 1: Fix Critical Issues
- Day 1-2: Dashboard cache bug + empty states
- Day 3-4: Onboarding flow implementation
- Day 5: Loading states + error handling

### Week 2: Quality & Testing
- Day 1: Full manual testing pass
- Day 2: Fix all high-priority bugs
- Day 3: Performance optimization
- Day 4: Accessibility audit + fixes
- Day 5: User testing + polish

**Goal:** Hit UX score of 80+ by end of Week 2

---

## 💡 Tips

**Manual Testing:**
- Test in small batches (don't do everything at once)
- Take screenshots of bugs
- Test on different browsers (Chrome, Safari, Firefox)
- Clear cache between tests

**UX Scorecard:**
- Be honest (don't inflate scores)
- Re-run weekly to track progress
- Focus on failing criteria

**Automated Tests:**
- Run locally before pushing
- Keep tests fast (<5 min total)
- Add tests for every bug fix

---

**Questions?** Review this guide or ping Kitt! 🐾
