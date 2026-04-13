# PostHog Setup Guide for Village

## Quick Start

PostHog is now installed and integrated! Follow these steps to complete the setup:

### 1. Complete PostHog Initial Setup

Visit: **https://posthog.exe.xyz**

1. Create your admin account
2. Create a new project called "Village"
3. Copy the Project API Key (starts with `phc_`)

### 2. Update API Key in Village

Edit `lib/posthog.ts` and replace:
```typescript
posthog.init('phc_development_key', {
```

With your actual key:
```typescript
posthog.init('phc_YOUR_ACTUAL_KEY_HERE', {
```

### 3. Deploy Changes

```bash
# If testing locally
npm run dev

# For production deployment
npm run build
npm start

# Or on PM2 (production)
pm2 restart village
```

### 4. Verify Tracking

1. Open Village app
2. Log in as a student
3. Create an assignment
4. Check PostHog dashboard → Events

You should see:
- `student_login`
- `dashboard_view`
- `assignment_create`

## Events Being Tracked

### Student Events
- **student_login** - When students access their dashboard
- **student_logout** - When students log out
- **dashboard_view** - Dashboard access (with user type)

### Lesson Events
- **lesson_start** - When a lesson begins
- **lesson_complete** - When a lesson is finished

### Assignment Events
- **assignment_create** - New assignment created
- **assignment_complete** - Student marks assignment done
- **assignment_grade** - Parent grades an assignment

### Management Events
- **child_add** - New child added to family
- **child_edit** - Child information updated

### AI Events
- **ai_spark_generate** - AI generates a suggestion
- **ai_spark_accept** - User accepts AI suggestion

## PostHog VM Management

### Access
- **URL:** https://posthog.exe.xyz
- **SSH:** `ssh posthog.exe.xyz`

### Useful Commands

```bash
# Check service status
ssh posthog.exe.xyz 'cd ~/posthog && docker compose ps'

# View logs
ssh posthog.exe.xyz 'cd ~/posthog && docker compose logs -f'

# Restart services
ssh posthog.exe.xyz 'cd ~/posthog && docker compose restart'

# Stop services
ssh posthog.exe.xyz 'cd ~/posthog && docker compose down'

# Start services
ssh posthog.exe.xyz 'cd ~/posthog && docker compose up -d'
```

## Analytics Best Practices

1. **Create Dashboards** in PostHog for:
   - Daily active students
   - Assignment completion rates
   - Feature usage patterns

2. **Set Up Insights** to track:
   - Student engagement trends
   - Peak usage times
   - Most active features

3. **Configure Alerts** for:
   - Unusual activity patterns
   - Error rates
   - User drop-offs

## Troubleshooting

### Events not showing up?
1. Check browser console for "PostHog initialized"
2. Verify API key is correct
3. Check PostHog VM is running: `ssh posthog.exe.xyz 'cd ~/posthog && docker compose ps'`
4. Review PostHog logs for errors

### PostHog UI not loading?
1. Check services: `ssh posthog.exe.xyz 'cd ~/posthog && docker compose ps'`
2. Restart if needed: `ssh posthog.exe.xyz 'cd ~/posthog && docker compose restart'`
3. Verify port 8000 is accessible

## Environment Variables (Optional Production Setup)

For better security, use environment variables:

`.env.local`:
```env
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://posthog.exe.xyz
```

Then update `lib/posthog.ts`:
```typescript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  // ...
})
```

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog JS SDK](https://posthog.com/docs/libraries/js)
- [Build Log](../memory/builds/2026-02-28-posthog-village-setup.md)
