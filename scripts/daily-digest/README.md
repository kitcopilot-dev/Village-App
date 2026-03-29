# Village Daily Digest 📬

Automatically generates and sends a daily homeschool briefing email by pulling live data from the Village PocketBase.

## Features

- 🎯 **Live Data**: Pulls real children, courses, and assignments from PocketBase
- 📊 **Smart Scheduling**: Only shows lessons for today based on `active_days` settings
- 📋 **Pending Assignments**: Highlights upcoming work with due dates
- 📈 **Progress Tracking**: Shows yearly completion percentage per child
- ✨ **Beautiful Email**: Mobile-friendly HTML with gradient header and progress bars
- 💬 **Daily Motivation**: Rotating educational quotes

## Usage

### Preview Mode (Dry Run)
```bash
cd village-v2
npx tsx scripts/daily-digest/index.ts --dry-run
```
This saves the email HTML to `/tmp/village-digest-preview.html` without sending.

### Send Email
```bash
cd village-v2
npx tsx scripts/daily-digest/index.ts
```

### With Custom User
```bash
npx tsx scripts/daily-digest/index.ts --user-email=jtown.80@gmail.com
```

## Scheduling (Cron)

Add to crontab for automatic daily emails at 7:00 AM:

```bash
# Edit crontab
crontab -e

# Add this line (7:00 AM Central time)
0 7 * * * cd /home/exedev/.openclaw/workspace/village-v2 && ./scripts/daily-digest/run.sh >> /var/log/village-digest.log 2>&1
```

## Configuration

### Recipients
Edit `RECIPIENTS` array in `index.ts`:
```typescript
const RECIPIENTS = ['jtown.80@gmail.com', 'lillyflo5@gmail.com'];
```

### Gmail OAuth
The script uses Gmail API OAuth. Credentials can be set via environment:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

Or they default to the existing Village Gmail account.

## Email Preview

The generated email includes:

1. **Header** - Purple gradient with date
2. **Summary Card** - Student count + today's lesson count
3. **Per-Child Cards**:
   - Name, age, grade
   - Today's lessons (course + lesson number)
   - Pending assignments (if any)
   - Year progress bar
4. **Footer** - Motivational quote + Kitt signature

## Course Active Days

The digest respects the `active_days` field on courses:
- Default: Weekdays only (Mon-Fri)
- Format: `"1,2,3,4,5"` (Sunday=0, Saturday=6)
- Or names: `"Mon,Tue,Wed,Thu,Fri"`

## Dependencies

- `tsx` - TypeScript executor
- `pocketbase` - PocketBase SDK (already in village-v2)
