# Village Homeschool App - Test Checklist

## Priority 1: Critical User Paths (Must Pass)

### Authentication
- [ ] Student login with family code
- [ ] Student login with PIN
- [ ] Parent login with email/password
- [ ] Logout functionality
- [ ] Session persistence

### Core Features
- [ ] Student can view daily assignments
- [ ] Parent can view all children's assignments
- [ ] Parent can view answer keys
- [ ] Faith preference affects content (LDS/Christian/None)
- [ ] PDF assignment generation
- [ ] PDF download works

### Profiles
- [ ] Parent can edit their profile
- [ ] Parent can update faith preference
- [ ] Parent can add/edit children profiles
- [ ] Parent can manage family members

## Priority 2: Important Features

### Dashboard
- [ ] Parent dashboard loads with summary
- [ ] Student dashboard shows today's tasks
- [ ] Quick stats display correctly

### Attendance
- [ ] Parent can log attendance
- [ ] Monthly calendar view works
- [ ] Attendance history displays

### Portfolios
- [ ] Parent can upload work samples
- [ ] Images display correctly
- [ ] Work samples organized by subject

### Calendar/Events
- [ ] Events display on calendar
- [ ] Parent can create events
- [ ] Event details show correctly

## Priority 3: Nice to Have

### User Experience
- [ ] Navigation works on mobile
- [ ] Responsive design on all pages
- [ ] Loading states display properly
- [ ] Error messages are helpful
- [ ] Dark mode toggle works

### Performance
- [ ] Page load under 3 seconds
- [ ] Images load progressively
- [ ] No memory leaks on navigation

## Test Accounts

### Test Families
```
Family: Test Family Alpha
- Parent: parent1@test.com / password123
- Children: student1 (PIN: 1234), student2 (PIN: 5678)

Family: Test Family Beta  
- Parent: parent2@test.com / password123
- Children: student3 (PIN: 9999)
```

### Test Credentials
```
Base URL: http://localhost:3001
Admin: (if applicable)
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific priority
npm test -- --grep "critical"

# Run with UI
npm run test:ui

# Debug mode
npm run test:debug

# Generate report
npm run test:report
```

## CI Integration

Tests should run on:
- [ ] Every PR to main
- [ ] Before deployment
- [ ] Nightly regression run

## Known Issues / TODO

- [ ] TODO: Test PDF generation with QR codes
- [ ] TODO: Test email delivery
- [ ] TODO: Test Sentry error capture
- [ ] TODO: Test offline functionality
