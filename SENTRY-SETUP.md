# Sentry Setup for Village

## Quick Setup (5 Minutes)

### Step 1: Create Sentry Account
1. Go to https://sentry.io/signup/
2. Sign up with GitHub (easiest)
3. Create organization: `village-homeschool` (or your choice)
4. Create project: `village-app`
5. Platform: **Next.js**

### Step 2: Get Your DSN
After creating the project:
1. Copy the **DSN** shown (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
2. Save it - you'll need it in Step 3

### Step 3: Run Auto-Setup Script
From the Village repo root:

```bash
cd ~/.openclaw/workspace/village-v2

# Set your DSN (replace with actual value from Step 2)
export NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"

# Run setup script
bash ../skills/error-fixer/setup-sentry.sh
```

This script will:
- ✅ Install @sentry/nextjs
- ✅ Create config files (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts)
- ✅ Add error boundary component
- ✅ Update next.config.js
- ✅ Set environment variables
- ✅ Test the integration

### Step 4: Get Sentry API Token
For the error-fixer agent:

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Name: "Village Error Fixer"
4. Permissions needed:
   - ✅ `org:read`
   - ✅ `project:read`
   - ✅ `event:read`
   - ✅ `event:write` (optional, for updating issues)
5. Copy token (starts with `sntrys_`)

### Step 5: Configure Error Fixer Agent

Add to your OpenClaw environment:

```bash
# Add to ~/.openclaw/config.json or export as env vars
export SENTRY_API_TOKEN="sntrys_xxx"
export SENTRY_ORG="village-homeschool"
export SENTRY_PROJECT="village-app"

# Optional: Set thresholds
export ERROR_FIXER_MAX_AFFECTED_USERS=100
export ERROR_FIXER_DRY_RUN=false
```

### Step 6: Deploy & Test

1. **Deploy to production:**
   ```bash
   git add .
   git commit -m "feat: add Sentry error monitoring"
   git push
   # Deploy via Vercel/your hosting
   ```

2. **Test error capture:**
   - Visit your deployed app
   - Trigger a test error (the setup script adds a test button)
   - Check Sentry dashboard - error should appear within seconds

3. **Test auto-fix agent:**
   ```bash
   # In OpenClaw, ask:
   "Check for new Village errors and create fixes if possible"
   ```

---

## What You Get

**Automatic Error Detection:**
- Frontend errors (React, network, etc.)
- Backend errors (API routes, server-side)
- Performance monitoring (slow pages)
- Session replay (see what users saw)

**AI-Powered Auto-Fix:**
- Error analyzed automatically
- Root cause identified
- Fix generated and tested
- PR created for review
- Telegram notification sent

**Privacy-First:**
- All text masked in session replays
- No PII sent to Sentry
- Family codes anonymized
- Student names excluded

---

## Cost

**Sentry Free Tier:**
- 5,000 errors/month
- 1 user
- 90 days retention
- Full API access

**Estimate for Village:**
- Small app: ~100-500 errors/month
- Well within free tier
- Can upgrade later if needed

---

## Troubleshooting

**"DSN not found":**
- Make sure you set NEXT_PUBLIC_SENTRY_DSN in .env.local
- Restart Next.js dev server

**"Source maps not uploading":**
- Check SENTRY_AUTH_TOKEN is set
- Run: `npx sentry-cli sourcemaps upload --org=village-homeschool --project=village-app .next`

**"Errors not appearing":**
- Check environment is set to "production"
- Make sure `enabled: true` in config
- Look for console errors

**"Agent not creating PRs":**
- Verify SENTRY_API_TOKEN has correct permissions
- Check gh CLI is authenticated: `gh auth status`
- Run in dry-run mode first: `ERROR_FIXER_DRY_RUN=true`

---

## Next Steps

After setup:
1. ✅ Deploy to production
2. ✅ Let it collect errors for 24h
3. ✅ Review first auto-fix PR
4. ✅ Adjust severity thresholds if needed
5. ✅ Set up weekly error digest cron job

Ready? Run the setup script! 🚀
