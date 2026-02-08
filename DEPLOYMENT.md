# 🚀 Village v2 Deployment Guide

## Quick Start

### Development Server

```bash
cd /home/exedev/.openclaw/workspace/village-v2
npm run dev
```

Open **http://localhost:3000** in your browser.

### Production Build

```bash
npm run build
npm start
```

Production server runs on **http://localhost:3000**

## Environment Variables

No environment variables needed! The PocketBase URL is hardcoded:
- **PocketBase:** https://bear-nan.exe.xyz/

To change it, edit `/lib/pocketbase.ts`:

```typescript
const PB_URL = 'https://your-pocketbase-url.com';
```

## Deployment Options

### 1. Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel auto-detects Next.js projects.

### 2. Docker

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t village-v2 .
docker run -p 3000:3000 village-v2
```

### 3. Self-Hosted (PM2)

```bash
npm install -g pm2
npm run build
pm2 start npm --name "village-v2" -- start
pm2 save
```

## PocketBase Collections Setup

Make sure these collections exist in your PocketBase instance:

### users
- Standard PocketBase auth collection

### profiles
- `user` (relation to users)
- `family_name` (text)
- `description` (text, optional)
- `location` (text, optional)
- `children_ages` (text, optional)

### children
- `user` (relation to users)
- `name` (text)
- `age` (number)
- `grade` (text, optional)
- `focus` (text, optional)

### courses
- `child` (relation to children)
- `name` (text)
- `total_lessons` (number)
- `current_lesson` (number)

### events
- `user` (relation to users)
- `title` (text)
- `description` (text)
- `date` (date)
- `time` (text)
- `location` (text)
- `age_suitability` (text, optional)
- `max_capacity` (number, optional)

### assignments
- `user` (relation to users)
- `child` (relation to children, optional)
- `title` (text)
- `description` (text, optional)
- `subject` (text, optional)
- `due_date` (date)
- `status` (text, optional)
- `score` (number, optional)

### legal_guides
- `state` (text)
- `regulation_level` (select: Low, Moderate, High)
- `requirements` (text)
- `notification_requirements` (text, optional)
- `testing_requirements` (text, optional)
- `record_keeping` (text, optional)
- `withdrawal_process` (text, optional)
- `resources` (text, optional)

## Post-Deployment Checklist

- [ ] Test user registration
- [ ] Test login/logout
- [ ] Create a test child profile
- [ ] Add a test course
- [ ] Create a test event
- [ ] View legal guides (public access)
- [ ] Test mobile responsiveness

## Troubleshooting

### Build fails with CSS warning
This is a Tailwind 4 warning about @import order. It's non-breaking and can be ignored.

### "PocketBase is not defined" error
Make sure `pocketbase` npm package is installed:
```bash
npm install pocketbase
```

### Pages show "not logged in" immediately
Clear localStorage and try again:
```javascript
localStorage.clear()
```

### Events/Kids not loading
Check browser console for PocketBase errors. Verify:
1. PocketBase is running at https://bear-nan.exe.xyz/
2. Collections exist with correct schema
3. Auth is working (check Network tab)

## Performance Notes

- First page load: ~500ms (with Turbopack)
- Subsequent navigation: Instant (client-side)
- Build time: ~8-10 seconds
- Bundle size: Optimized by Next.js 16

## Support

Built by Kitt for the Village Community 🏡
Questions? Check the main README.md for architecture details.
