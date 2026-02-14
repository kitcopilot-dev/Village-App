# Error Monitoring Quick Start

## What This Does

**Automatic error detection + AI-powered fixes**

When an error happens in Village:
1. 🔍 Sentry captures it (stack trace, user context, breadcrumbs)
2. 🤖 AI agent analyzes the error
3. 💡 Agent researches the fix (Stack Overflow, docs, similar issues)
4. ✍️ Agent writes the code fix
5. 📝 Agent creates a GitHub PR for review
6. 💬 You get a Telegram notification

**All automatic. You just review and merge the PR.**

---

## Setup (Choose One Path)

### Path A: Let Kitt Set It Up (Easiest)

1. Create Sentry account: https://sentry.io/signup/
2. Create project: `village-app` (platform: Next.js)
3. Copy your **DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
4. Tell Kitt:
   ```
   Set up Sentry error monitoring. My DSN is: https://...
   ```

Kitt will:
- Run the setup script
- Configure all files
- Test the integration
- Set up the cron job
- Guide you through deployment

---

### Path B: Manual Setup (Control Freak Mode)

**Step 1: Sentry Account**
```bash
# 1. Go to https://sentry.io/signup/
# 2. Create organization: "village-homeschool"
# 3. Create project: "village-app" (Next.js)
# 4. Copy DSN
```

**Step 2: Run Setup Script**
```bash
cd ~/.openclaw/workspace/village-v2

# Replace with your actual DSN
export NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"

# Run setup
bash ../skills/error-fixer/setup-sentry.sh --dsn "$NEXT_PUBLIC_SENTRY_DSN"
```

**Step 3: Get API Token**
```bash
# 1. Go to: https://sentry.io/settings/account/api/auth-tokens/
# 2. Create token with: org:read, project:read, event:read
# 3. Copy token (starts with sntrys_)
```

**Step 4: Configure Environment**
```bash
# Add to your shell profile or OpenClaw config
export SENTRY_API_TOKEN="sntrys_xxx"
export SENTRY_ORG="village-homeschool"
export SENTRY_PROJECT="village-app"
```

**Step 5: Deploy**
```bash
git add .
git commit -m "feat: add Sentry error monitoring + auto-fix"
git push
# Deploy to production (Vercel/wherever)
```

**Step 6: Test**
- Visit deployed app
- Click the test error button (added by setup script)
- Check Sentry dashboard - error should appear
- Ask Kitt: "Check for new Village errors"

---

## What Gets Installed

**Frontend (Client):**
- Error boundaries (catch React crashes)
- Network error tracking (failed API calls)
- Performance monitoring (slow pages)
- Session replay (see what user saw)

**Backend (Server):**
- API route errors
- Server-side rendering errors
- Edge runtime errors

**Privacy:**
- ✅ All text masked in replays
- ✅ No PII sent to Sentry
- ✅ Family codes anonymized
- ✅ 90-day data retention

---

## File Changes

The setup script creates:

```
village-v2/
├── sentry.client.config.ts    # Frontend error capture
├── sentry.server.config.ts    # Backend error capture  
├── sentry.edge.config.ts      # Edge runtime errors
├── next.config.js             # Updated with Sentry plugin
├── .env.local                 # Your DSN (gitignored)
├── components/
│   └── ErrorBoundary.tsx      # React error boundary
└── app/
    └── error.tsx              # Next.js error page (updated)
```

**Also adds to `.gitignore`:**
```
.env*.local
.sentryclirc
sentry.properties
```

---

## Cost Breakdown

**Sentry Free Tier:**
- 5,000 errors/month
- Full API access
- 90-day retention
- Session replays

**Village Usage Estimate:**
- Small app: ~100-500 errors/month
- **Well within free tier**
- No credit card needed for free tier

**When to upgrade:**
- Only if you exceed 5,000 errors/month
- Or need >90 day retention
- Paid plans start at $26/month (1K errors/mo per developer)

---

## What Happens Next

**After setup:**

1. **Errors start flowing in** (you'll see them in Sentry dashboard)
2. **AI agent checks every 30 min** (via cron job)
3. **High/critical errors → auto-fix PR** (within 30 min)
4. **You review PR** (check the fix makes sense)
5. **Merge → error fixed** (deploy to production)

**First week:**
- Expect 10-20 errors (mostly edge cases you didn't know about)
- AI will fix 50-70% automatically
- You'll review and merge the PRs
- Remaining errors: add to backlog or fix manually

**Ongoing:**
- New errors appear → AI tries to fix → you review
- Agent learns patterns (similar errors = similar fixes)
- Error rate drops over time as fixes accumulate

---

## Safety Net

**The agent will NOT:**
- ❌ Auto-merge PRs (always requires your approval)
- ❌ Fix security/auth errors (too risky)
- ❌ Touch errors affecting >100 users (requires human review)
- ❌ Make changes without creating a PR

**The agent WILL:**
- ✅ Analyze all errors
- ✅ Research fixes thoroughly
- ✅ Create well-documented PRs
- ✅ Alert you via Telegram for critical issues
- ✅ Log all actions for audit trail

---

## Ready to Start?

**Option 1:** Let Kitt set it up
```
Kitt, set up Sentry error monitoring for Village. 
My DSN is: [paste your DSN]
```

**Option 2:** Do it yourself
```bash
cd ~/.openclaw/workspace/village-v2
bash ../skills/error-fixer/setup-sentry.sh
```

**Questions?** Ask Kitt! 🐾
