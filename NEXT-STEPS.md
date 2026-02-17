# ✅ Sentry Setup Complete - Next Steps

## What Just Happened

I've set up complete error monitoring for Village:

**Installed:**
- ✅ @sentry/nextjs (194 packages)
- ✅ Error boundaries (catch React crashes)
- ✅ Server error tracking (API routes)
- ✅ Edge runtime monitoring
- ✅ Session replay (with privacy masking)

**Created:**
- ✅ `sentry.client.config.ts` - Frontend error capture
- ✅ `sentry.server.config.ts` - Backend error capture
- ✅ `sentry.edge.config.ts` - Edge runtime errors
- ✅ `next.config.js` - Sentry webpack plugin
- ✅ `components/ErrorBoundary.tsx` - React error boundary
- ✅ `app/error.tsx` - Next.js error page
- ✅ `app/api/test-error/route.ts` - Test route
- ✅ `.env.local` - Your DSN (gitignored)

**Committed:**
- ✅ All changes committed to git
- ✅ Ready to push and deploy

---

## 🚀 What You Need to Do Now

### Step 1: Get SENTRY_AUTH_TOKEN (Optional but Recommended)

This enables source map uploads (better error stack traces):

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Name: "Village Source Maps"
4. Permissions:
   - ✅ `project:releases`
   - ✅ `project:write`
5. Copy the token
6. Add to `.env.local`:
   ```bash
   SENTRY_AUTH_TOKEN=sntrys_xxx
   ```

**Skip this for now if you want to test first**

---

### Step 2: Test Locally (Optional)

```bash
cd village-v2
npm run dev
```

Visit: http://localhost:3000/api/test-error

You should see:
- Error page appears
- Check Sentry dashboard - error should show up within seconds

---

### Step 3: Deploy to Production

```bash
cd village-v2
git push origin feature/faith-preference-system
```

Then deploy via Vercel (or your hosting):
- Vercel will detect the changes
- Make sure to add `NEXT_PUBLIC_SENTRY_DSN` to Vercel environment variables (already in .env.local)
- Deploy!

---

### Step 4: Get Sentry API Token (for Auto-Fix Agent)

This is separate from the auth token above. This lets the AI agent read errors:

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Name: "Village Error Fixer Agent"
4. Permissions:
   - ✅ `org:read`
   - ✅ `project:read`
   - ✅ `event:read`
   - ✅ `event:write` (optional)
5. Copy the token (starts with `sntrys_`)

---

### Step 5: Configure Error Fixer Agent

Add these to your environment (or OpenClaw config):

```bash
export SENTRY_API_TOKEN="sntrys_xxx"  # From Step 4
export SENTRY_ORG="village-homeschool"
export SENTRY_PROJECT="village-app"

# Optional settings
export ERROR_FIXER_MAX_AFFECTED_USERS=100
export ERROR_FIXER_DRY_RUN=false
```

---

### Step 6: Test the Auto-Fix Agent

Once deployed and errors start coming in:

```
Kitt, check for new Village errors and create fixes if possible.
```

The agent will:
1. Fetch recent errors from Sentry
2. Analyze each error
3. Generate a code fix
4. Create a GitHub PR
5. Send you a Telegram notification

You review the PR and merge if it looks good.

---

## 📊 What to Expect

**First 24 hours:**
- Expect 5-20 errors (edge cases you didn't know about)
- Most will be caught by error boundaries
- You'll see stack traces in Sentry dashboard

**First week:**
- ~50-100 errors total
- AI will auto-fix 50-70%
- You'll review and merge PRs
- Error rate will drop as fixes accumulate

**Ongoing:**
- New errors → AI tries to fix → you review
- Critical errors → Telegram alert immediately
- Weekly digest of all errors

---

## 🎯 Quick Reference

**Test error capture:**
```
curl https://your-village-app.vercel.app/api/test-error
```

**Check Sentry dashboard:**
https://sentry.io/organizations/village-homeschool/projects/village-app/

**Ask AI to check errors:**
```
Check for new Village errors
```

**Manual error check:**
```
Check Sentry for errors in the last 30 minutes
```

---

## 🛟 Troubleshooting

**"Errors not showing up in Sentry":**
- Check `NODE_ENV=production` in your deployment
- Verify `NEXT_PUBLIC_SENTRY_DSN` is set
- Look for console errors in browser DevTools

**"Source maps not uploading":**
- Add `SENTRY_AUTH_TOKEN` to `.env.local`
- Make sure token has `project:releases` permission
- Check build logs for Sentry plugin output

**"AI agent not creating PRs":**
- Verify `SENTRY_API_TOKEN` is set
- Check token has `event:read` permission
- Run in dry-run mode first: `ERROR_FIXER_DRY_RUN=true`

---

## 📚 Documentation

- **Technical Setup:** `SENTRY-SETUP.md`
- **Plain English Guide:** `ERROR-MONITORING-QUICKSTART.md`
- **Error Monitoring Design:** `../memory/builds/2026-02-14-error-monitoring-setup.md`
- **Agent Design:** `../memory/builds/2026-02-14-error-fixer-agent.md`
- **Agent Skill:** `../skills/error-fixer/SKILL.md`

---

**Ready to deploy?** Push to GitHub and deploy to production! 🚀

Any questions, just ask Kitt! 🐾
