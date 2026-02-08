# 🏡 Village v2 - Quick Reference Card

## 🚀 Start Development

```bash
cd /home/exedev/.openclaw/workspace/village-v2
./start.sh
```

**→ Opens at http://localhost:3000**

---

## 📁 Project Structure

```
village-v2/
├── app/               Pages & routing
├── components/        Reusable UI
├── lib/               Utilities & types
└── *.md               Documentation
```

---

## 📄 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Full architecture docs |
| `DEPLOYMENT.md` | Deploy instructions |
| `MIGRATION_SUMMARY.md` | What was built |
| `PROJECT_OVERVIEW.md` | Visual overview |
| `SUMMARY_FOR_JUSTIN.md` | TL;DR for Justin |
| `QUICK_REFERENCE.md` | This card |

---

## 🛠️ Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm start        # Run production server
npm run lint     # Run ESLint
```

---

## 📱 Pages (Routes)

| URL | Page | Public? |
|-----|------|---------|
| `/` | Login/Register | ✅ |
| `/profile` | User Profile | 🔒 |
| `/manage-kids` | Kid Management | 🔒 |
| `/dashboard` | Academic Dashboard | 🔒 |
| `/events` | Community Events | 🔒 |
| `/legal-guides` | State Regulations | ✅ |

---

## 🎨 Design Tokens

```css
--primary:    #4B6344  (Sage Green)
--secondary:  #D97757  (Terracotta)
--accent:     #E6AF2E  (Mustard)
--bg:         #FDFCF8  (Creamy White)
--radius-lg:  2rem
--font-display: Syne
--font-body:    Plus Jakarta Sans
--font-serif:   Fraunces
```

---

## 🧩 Components

Located in `components/ui/`:

- `Button` - 4 variants
- `Card` - Hoverable cards
- `Modal` - Animated dialogs
- `Input/Textarea/Select` - Form controls
- `ProgressBar` - Gradient bars

---

## 🔧 Key Files

| File | What It Does |
|------|--------------|
| `app/globals.css` | Design system config |
| `lib/pocketbase.ts` | PB client singleton |
| `lib/types.ts` | TypeScript interfaces |
| `components/Header.tsx` | Navigation bar |

---

## 🗄️ PocketBase URL

**Hardcoded:** `https://bear-nan.exe.xyz/`

To change: Edit `lib/pocketbase.ts`

---

## 📊 Build Info

- **Framework:** Next.js 16.1.6
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Files:** 15 TypeScript files
- **Components:** 11 total
- **Pages:** 6 routes
- **Docs:** 6 markdown files

---

## 🎯 Quick Test

1. Run `./start.sh`
2. Open http://localhost:3000
3. Register a new account
4. Explore the app!

---

## 🚀 Quick Deploy (Vercel)

```bash
npm install -g vercel
vercel
```

Follow prompts → Done!

---

## 🎨 Customization

**Colors:** `app/globals.css` → `:root` variables  
**Components:** `components/ui/` → Edit any file  
**Pages:** `app/*/page.tsx` → Edit page logic  
**PB URL:** `lib/pocketbase.ts` → Change `PB_URL`

---

## 📞 Need Help?

1. Check `README.md` (comprehensive)
2. Check `DEPLOYMENT.md` (deploy guide)
3. Check code comments
4. All TypeScript-typed (autocomplete!)

---

## ✅ Status

- ✅ **Build:** Successful
- ✅ **Types:** Zero errors
- ✅ **Pages:** 6/6 working
- ✅ **Design:** 100% preserved
- ✅ **Docs:** Complete

**Ready for production!** 🎉

---

Built by Kitt • Feb 7, 2026 • OpenClaw Agent
