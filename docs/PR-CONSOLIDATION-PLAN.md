# PR Consolidation Plan

**Generated:** March 26, 2026  
**Current PRs:** 30 open  
**After Consolidation:** ~18 PRs

## 🔴 Duplicate PRs to Close (12 PRs)

These PRs have better/newer versions. Close them to reduce noise.

### Study Timer Duplicates
| PR | Title | Recommendation |
|----|-------|----------------|
| #8 | Study Timer with Pomodoro Focus Sessions | ❌ **CLOSE** - Original version |
| #16 | ⏱️ Study Timer - Pomodoro & Focus Tracking | ✅ **KEEP** - Better features (goals, streaks, analytics) |

**Close command:** `gh pr close 8 -c "Superseded by #16 (more complete implementation)"`

### Weekly Reports Duplicates  
| PR | Title | Recommendation |
|----|-------|----------------|
| #10 | 📊 Weekly Progress Reports - Compliance | ❌ **CLOSE** - Basic version |
| #11 | Weekly Progress Report Generator 📊 | ❌ **CLOSE** - Mid version |
| #19 | Weekly Progress Reports | ✅ **KEEP** - Most complete |

**Close commands:**
```bash
gh pr close 10 -c "Superseded by #19 (more complete implementation)"
gh pr close 11 -c "Superseded by #19 (more complete implementation)"
```

### Morning Dashboard Duplicates
| PR | Title | Recommendation |
|----|-------|----------------|
| #18 | Morning Briefing / Today Page | ❌ **CLOSE** - Earlier version |
| #20 | Today View - Morning Dashboard | ✅ **KEEP** - More polished |

**Close command:** `gh pr close 18 -c "Superseded by #20 (better UX)"`

### Curriculum Library Duplicates
| PR | Title | Recommendation |
|----|-------|----------------|
| #13 | Curriculum Resource Library 📚 | ❌ **CLOSE** - Basic version |
| #23 | 📚 Curriculum Library - Track Materials | ✅ **KEEP** - More features |

**Close command:** `gh pr close 13 -c "Superseded by #23 (more comprehensive)"`

### Progress Reports Duplicates
| PR | Title | Recommendation |
|----|-------|----------------|
| #1 | Progress Reports page with charts | ✅ **KEEP** - Visual analytics focus |
| #19 | Weekly Progress Reports | ✅ **KEEP** - Weekly focus (different purpose) |

*These are different enough to keep both.*

---

## 🟢 Safe to Merge Immediately (No DB Changes)

These PRs require NO PocketBase schema changes:

| PR | Title | Risk | Action |
|----|-------|------|--------|
| #29 | PR Review Guide & Merge Helper | 🟢 Docs | Merge now |
| #22 | Mobile Navigation Drawer | 🟢 Frontend | **CRITICAL - Merge first** |
| #28 | Weekly Schedule Planner | 🟢 localStorage | Merge now |
| #27 | Settings Page | 🟢 localStorage | Merge now |

**Batch merge command:**
```bash
gh pr merge 22 --squash --delete-branch  # Mobile Nav - CRITICAL
gh pr merge 29 --squash --delete-branch  # Docs
gh pr merge 28 --squash --delete-branch  # Schedule
gh pr merge 27 --squash --delete-branch  # Settings
```

---

## 🟡 Requires DB Setup - Tier 1 (High Value)

These features add significant value but need PocketBase collections:

| PR | Title | Collections Needed |
|----|-------|--------------------|
| #30 | Portfolio Share Links | `portfolio_shares` |
| #25 | Year-End Summary | None (uses existing) |
| #20 | Today View | None (uses existing) |
| #26 | Quick Daily Log | `daily_logs` |
| #21 | Hours Tracker | `hours_log`, `weekly_goals` |
| #16 | Study Timer v2 | `study_sessions`, `study_goals` |

---

## 🟡 Requires DB Setup - Tier 2 (Nice to Have)

| PR | Title | Collections Needed |
|----|-------|--------------------|
| #7 | Reading Log | `reading_entries`, `reading_books` |
| #23 | Curriculum Library | `curriculum_items` |
| #24 | Family Activity Feed | None (uses existing) |
| #12 | Learning Goals | `goals` |
| #19 | Weekly Reports | None (uses existing) |
| #9 | Achievements & Badges | `achievements`, `earned_achievements` |

---

## 🟠 Lower Priority / Complex

| PR | Title | Notes |
|----|-------|-------|
| #17 | Field Trip Logger | Nice but complex (photos, GPS) |
| #15 | Learning Journal | Overlaps with Daily Log |
| #14 | Expense Tracker | Lower priority for MVP |
| #6 | Student Onboarding | Requires parent onboarding first |
| #4 | AI Homework Helper | Needs OpenRouter key |
| #3 | Faith Preference | Schema change to profiles |
| #2 | Weekly Planner | Overlaps with #28 |

---

## 📋 Recommended Action Plan

### Step 1: Close Duplicates (5 mins)
```bash
gh pr close 8 -c "Superseded by #16"
gh pr close 10 -c "Superseded by #19"
gh pr close 11 -c "Superseded by #19"
gh pr close 18 -c "Superseded by #20"
gh pr close 13 -c "Superseded by #23"
```
**Result:** 30 PRs → 25 PRs

### Step 2: Merge Safe PRs (10 mins)
```bash
gh pr merge 22 --squash --delete-branch
gh pr merge 29 --squash --delete-branch
gh pr merge 28 --squash --delete-branch
gh pr merge 27 --squash --delete-branch
```
**Result:** 25 PRs → 21 PRs

### Step 3: Review Tier 1 Features (30 mins)
Pick 2-3 high-value features, set up their DB collections, merge.

Recommended first picks:
- #25 Year-End Summary (no DB changes!)
- #20 Today View (no DB changes!)
- #30 Portfolio Share (1 collection)

---

## 📊 Summary

| Category | Count | Action |
|----------|-------|--------|
| Duplicates | 5 | Close |
| Safe to Merge | 4 | Merge now |
| High Value + DB | 6 | Prioritize |
| Nice to Have | 6 | Queue |
| Lower Priority | 7 | Later |
| Remaining PRs | 2 | Docs/misc |

**After this plan:** 30 PRs → ~18 PRs (with 4 merged!)

---

*Generated by Kitt 🐾*
