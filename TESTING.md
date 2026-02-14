# Village App - Testing Checklist

**Last Updated:** 2026-02-14

---

## 🎯 Critical User Flows

### Flow A: Parent Onboarding (New User)

**Steps:**
- [ ] 1. Visit homepage (`/`)
- [ ] 2. Click "Get Started" or "Sign Up"
- [ ] 3. Register account (email + password)
- [ ] 4. Verify email (if required)
- [ ] 5. Complete profile:
  - [ ] Family name
  - [ ] Location (autocomplete works)
  - [ ] Children ages
  - [ ] Faith preference (secular/christian/lds)
- [ ] 6. Receive family code
- [ ] 7. Navigate to "Manage Kids"
- [ ] 8. Add first child:
  - [ ] Name
  - [ ] Age
  - [ ] Set PIN (4 digits)
- [ ] 9. View dashboard

**Expected Result:** Parent can see their child listed, family code displayed, dashboard shows placeholder/welcome state

**Time:** Should take <5 minutes

---

### Flow B: Student First Login

**Steps:**
- [ ] 1. Navigate to `/student`
- [ ] 2. Enter family code (if first time)
- [ ] 3. See list of children from that family
- [ ] 4. Select student name
- [ ] 5. Enter 4-digit PIN
- [ ] 6. Land on student dashboard
- [ ] 7. See courses/lessons (or empty state)

**Expected Result:** Student can access their personalized dashboard, family code remembered for next visit

**Time:** Should take <2 minutes (first time), <30 seconds (returning)

---

### Flow C: Daily Operations

**Steps:**
- [ ] 1. Parent receives daily assignments email (Mon-Fri 9am CT)
- [ ] 2. Parent opens email, sees 4 PDFs (ages 2/6/9/13)
- [ ] 3. Parent navigates to `/dashboard`
- [ ] 4. Parent sees today's lessons/assignments
- [ ] 5. Parent prints or shares assignments
- [ ] 6. Student completes lesson
- [ ] 7. Parent marks lesson complete
- [ ] 8. Progress updates on dashboard
- [ ] 9. Parent adds portfolio item:
  - [ ] Upload photo/video
  - [ ] Add title + description
  - [ ] Tag subject
- [ ] 10. Portfolio item appears in `/portfolio`

**Expected Result:** Seamless daily workflow, clear progress tracking, easy portfolio management

---

### Flow D: Community Features

**Steps:**
- [ ] 1. Navigate to `/map`
- [ ] 2. See family markers on map
- [ ] 3. Click a marker, see family info (respects privacy)
- [ ] 4. Navigate to `/events`
- [ ] 5. Browse upcoming events
- [ ] 6. Create new event
- [ ] 7. Event appears in list
- [ ] 8. Other families can see it

**Expected Result:** Families can discover each other, coordinate events, build community

---

## 🔧 Backend Testing

### PocketBase Collections

**profiles:**
- [ ] Can create profile
- [ ] Can update profile
- [ ] `family_code` auto-generated on create
- [ ] `faith_preference` saves correctly (none/christian/lds)
- [ ] Location autocomplete stores lat/lon
- [ ] Can delete profile

**children:**
- [ ] Can create child
- [ ] `family_code` matches parent profile
- [ ] `pin` stores correctly (4 digits)
- [ ] Can update child info
- [ ] Can delete child
- [ ] Privacy: children filtered by family_code

**courses:**
- [ ] Can create course for child
- [ ] `current_lesson` increments on completion
- [ ] Progress percentage calculates correctly
- [ ] Can mark lessons complete
- [ ] Can delete course

**portfolio:**
- [ ] Can upload image
- [ ] Can upload video
- [ ] Can add title/description
- [ ] Can tag subject
- [ ] Can filter by child
- [ ] Can delete item

**events:**
- [ ] Can create event
- [ ] Event appears in list
- [ ] Can RSVP/join event
- [ ] Can delete event

### Email/PDF Generation

**Daily Assignments (Cron Job):**
- [ ] Runs Mon-Fri at 9am CT
- [ ] Queries user's `faith_preference`
- [ ] Generates appropriate content:
  - [ ] Secular: No scripture, Character Value instead
  - [ ] Christian: Bible-only scripture
  - [ ] LDS: All Standard Works scripture
- [ ] Creates HTML for all 4 ages (2/6/9/13)
- [ ] Renders to PDF
- [ ] Emails PDFs to correct address
- [ ] Friday bonus: Kitchen science experiments included

---

## 🎨 Frontend Testing

### Page-by-Page

**`/` (Homepage)**
- [ ] Loads without errors
- [ ] Hero section displays
- [ ] CTA buttons work
- [ ] Navigation menu functional
- [ ] Mobile responsive

**`/profile`**
- [ ] Displays current profile info
- [ ] "Edit Profile" button works
- [ ] Form validation on save
- [ ] Location autocomplete works
- [ ] Faith preference selector functional
- [ ] Family code displayed
- [ ] Telegram ID saves
- [ ] Returns to view mode after save

**`/manage-kids`**
- [ ] Lists all children
- [ ] "Add Child" button works
- [ ] Can set child name/age/PIN
- [ ] Can edit existing child
- [ ] Can delete child (with confirmation)
- [ ] Vault view displays correctly

**`/student`**
- [ ] Family code input displayed (first time)
- [ ] Family code remembered (localStorage)
- [ ] Kids list filtered by family_code
- [ ] PIN entry works
- [ ] Wrong PIN shows error
- [ ] Successful login redirects to student dashboard
- [ ] "Use Different Code" clears saved code

**`/student/dashboard`**
- [ ] Shows student name
- [ ] Lists courses
- [ ] Shows progress bars
- [ ] Recent lessons displayed
- [ ] Logout button works

**`/dashboard` (Parent)**
- [ ] Shows all children
- [ ] Displays today's lessons
- [ ] Shows weekly progress
- [ ] Links to manage kids/portfolio/etc work
- [ ] Cache updates (no hard refresh needed)

**`/planner` (PR #2)**
- [ ] Week-at-a-glance grid displays
- [ ] Color-coded by child
- [ ] Click to mark complete
- [ ] Week navigation works
- [ ] Show/hide weekends toggle
- [ ] Weekly completion stats accurate
- [ ] Print-friendly layout

**`/reports` (PR #1)**
- [ ] Daily activity chart renders
- [ ] Subject progress bars display
- [ ] Grade distribution accurate
- [ ] Date filtering works
- [ ] Per-student filtering works
- [ ] Print-friendly layout
- [ ] Export to PDF works

**`/portfolio`**
- [ ] Displays all portfolio items
- [ ] Filter by child works
- [ ] Filter by subject works
- [ ] Upload new item works
- [ ] Image preview/lightbox works
- [ ] Video playback works
- [ ] Delete item works (with confirmation)

**`/map`**
- [ ] Map loads (Leaflet/MapBox)
- [ ] Family markers display
- [ ] Marker click shows info
- [ ] Privacy respected (no exact addresses)
- [ ] Mobile responsive

**`/events`**
- [ ] Event list displays
- [ ] Can create new event
- [ ] Can filter by date
- [ ] Can RSVP/join event
- [ ] Event details display correctly

**`/attendance`**
- [ ] Monthly calendar displays
- [ ] Can tap to log attendance
- [ ] Dates highlight on log
- [ ] Shows attendance totals

**`/transcript`**
- [ ] Transcript displays
- [ ] Grouped by grade/year
- [ ] Shows credits/hours
- [ ] Print-friendly

**`/legal-guides`**
- [ ] Legal guides display
- [ ] State-specific info works
- [ ] Links functional
- [ ] PDF downloads work

---

## 📱 Cross-Cutting Concerns

### Responsive Design
- [ ] Test on iPhone (375px width)
- [ ] Test on iPad (768px width)
- [ ] Test on desktop (1920px width)
- [ ] Touch targets ≥44x44px on mobile
- [ ] No horizontal scroll on mobile
- [ ] Readable font sizes on all devices

### Performance
- [ ] Homepage loads <2s
- [ ] Dashboard loads <3s
- [ ] No layout shift (CLS <0.1)
- [ ] Images optimized/lazy-loaded
- [ ] No console errors
- [ ] Smooth animations (60fps)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast ≥4.5:1 (WCAG AA)
- [ ] Alt text on images
- [ ] Form labels present
- [ ] Error messages announced

### Security/Privacy
- [ ] Family code isolates children correctly
- [ ] Can't see other families' kids (without code)
- [ ] PIN authentication works
- [ ] Sessions persist correctly
- [ ] Logout clears sensitive data
- [ ] No API keys exposed in frontend

### Error Handling
- [ ] Network errors show user-friendly message
- [ ] Form validation clear and helpful
- [ ] 404 page displays
- [ ] 500 errors caught gracefully
- [ ] Loading states prevent double-clicks

---

## 🤖 Automated Testing

### E2E Tests (Playwright/Cypress)

**Critical Paths:**
- [ ] Parent signup → create profile → add child → view dashboard
- [ ] Student login → enter family code → PIN → view courses
- [ ] Create portfolio item → upload → verify appears
- [ ] Create event → verify appears in list

### Unit Tests (Jest/Vitest)

**Components:**
- [ ] Button variants render correctly
- [ ] Input validation works
- [ ] Card component styles apply
- [ ] Modal open/close works

**Utils/Helpers:**
- [ ] Date formatting
- [ ] Progress calculation
- [ ] Family code generation
- [ ] PIN validation

---

## 📊 Success Metrics

After testing, measure:

1. **Bug Count:** How many issues found?
2. **Severity:** Critical / High / Medium / Low
3. **User Flow Completion Rate:** % of flows that work end-to-end
4. **Performance:** Page load times
5. **Accessibility Score:** Lighthouse/axe score

**Target:**
- 0 critical bugs before launch
- All critical flows 100% functional
- Lighthouse score ≥90
- Accessibility score ≥90

---

## 🛠️ Tools

- **Manual Testing:** This checklist
- **UX Scorecard:** `village-v2/ux-scorecard.html`
- **Automated E2E:** Playwright (to be set up)
- **Accessibility:** Lighthouse, axe DevTools
- **Performance:** Chrome DevTools, Lighthouse

---

## 📝 Notes

- Test with different browsers: Chrome, Safari, Firefox
- Test with slow network (DevTools throttling)
- Test with screen reader (VoiceOver, NVDA)
- Test logout/login flows repeatedly
- Test edge cases (empty states, max limits, special characters)

---

**Status Legend:**
- ✅ Pass
- ❌ Fail (document bug)
- ⏸️ Blocked
- ➖ N/A
