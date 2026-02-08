# Village Homeschool v2 🏡

A modern, handcrafted Next.js application for homeschool families to coordinate, share resources, and grow together.

## 🎨 Tech Stack

- **Framework:** Next.js 16.1.6 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Backend:** PocketBase (https://bear-nan.exe.xyz/)
- **Fonts:** Syne (display), Plus Jakarta Sans (body), Fraunces (serif)

## 🌿 Design System: Sage & Terracotta

The app maintains the organic, handcrafted aesthetic from the original with:

- **Primary (Sage Green):** #4B6344
- **Secondary (Terracotta):** #D97757
- **Accent (Mustard Yellow):** #E6AF2E
- **Creamy Background:** #FDFCF8
- **Smooth animations & hover effects**
- **Rounded corners (2rem radius for cards)**
- **Custom shadows and gradients**

## 📦 What Was Built

### Pages & Features

1. **Login/Register (/)** 
   - Dual-panel auth forms
   - PocketBase integration
   - Auto-login after registration
   - Public legal guides access

2. **Profile (/profile)**
   - View/edit family profile
   - Location tracking with geolocation
   - Quick navigation to all sections

3. **Manage Kids (/manage-kids)**
   - Add/edit child profiles
   - Course tracking with progress bars
   - Learning vault with tabs:
     - Overview (courses & resources)
     - Weekly schedule
     - Portfolio
   - Beautiful kid cards with age-based color accents

4. **Dashboard (/dashboard)**
   - Academic stats cards
   - Subject progress breakdown
   - Recent work timeline
   - Assignment tracking

5. **Events (/events)**
   - Community event listings
   - Create/view gatherings
   - Search & filter by age group
   - Beautiful card grid with hover effects

6. **Legal Guides (/legal-guides)**
   - State-by-state homeschool regulations
   - Regulation level badges (Low/Moderate/High)
   - Search & filter functionality
   - Detailed state requirements
   - Public access (no login required)

### Reusable Components

Located in `components/ui/`:

- **Button** - Multiple variants (primary, secondary, outline, ghost)
- **Card** - Hoverable cards with optional accent bars
- **Modal** - Animated modal with backdrop
- **Input, Textarea, Select** - Styled form controls
- **ProgressBar** - Animated progress bars with gradients
- **Header** - Sticky navigation with logout

### Library

- **lib/pocketbase.ts** - PocketBase client singleton
- **lib/types.ts** - TypeScript interfaces for all collections

## 🚀 Getting Started

### Prerequisites

- Node.js 22+ installed
- PocketBase instance running at https://bear-nan.exe.xyz/

### Installation

```bash
cd /home/exedev/.openclaw/workspace/village-v2
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
village-v2/
├── app/
│   ├── page.tsx              # Login/Register
│   ├── profile/page.tsx      # User profile
│   ├── manage-kids/page.tsx  # Kid management
│   ├── dashboard/page.tsx    # Academic dashboard
│   ├── events/page.tsx       # Community events
│   ├── legal-guides/page.tsx # Legal guides
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles + Tailwind
├── components/
│   ├── Header.tsx            # Navigation header
│   └── ui/                   # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       ├── Input.tsx
│       └── ProgressBar.tsx
├── lib/
│   ├── pocketbase.ts         # PocketBase client
│   └── types.ts              # TypeScript types
└── package.json
```

## 🗄️ PocketBase Collections

The app expects these collections in PocketBase:

- **users** - User authentication
- **profiles** - Family profiles (user, family_name, description, location, children_ages)
- **children** - Child profiles (user, name, age, grade, focus)
- **courses** - Course tracking (child, name, total_lessons, current_lesson)
- **events** - Community events (user, title, description, date, time, location, age_suitability, max_capacity)
- **assignments** - Academic work (user, child, title, description, subject, due_date, status, score)
- **legal_guides** - State regulations (state, regulation_level, requirements, etc.)

## 🎯 Key Features

### Authentication
- Client-side PocketBase auth with localStorage persistence
- Auto-restore sessions on page load
- Protected routes with redirect to login

### Responsive Design
- Mobile-first approach
- Grid layouts that adapt to screen size
- Touch-friendly buttons and interactions

### Animations
- Fade-in animations on page load
- Staggered list animations
- Smooth hover transitions
- Modal slide-in effects

### UX Enhancements
- Geolocation for profile location
- Real-time search/filter
- Loading states
- Success/error messages
- Accessible form labels

## 🔧 Customization

### Colors
Edit `app/globals.css` to change the color palette:

```css
:root {
  --primary: #4B6344;
  --secondary: #D97757;
  --accent: #E6AF2E;
  /* ... */
}
```

### Fonts
Update the Google Fonts import in `app/globals.css` and the `--font-*` variables.

### Components
All UI components accept className prop for easy customization with Tailwind utilities.

## 📝 Migration Notes

This is a complete rewrite of the original Village Homeschool app (`village-homeschool/`) with:

- ✅ Modern React patterns (hooks, functional components)
- ✅ TypeScript for type safety
- ✅ Tailwind 4 for styling (no inline styles)
- ✅ Component-based architecture
- ✅ Improved code organization
- ✅ Better error handling
- ✅ Responsive design improvements
- ✅ Maintained the original aesthetic

## 🐛 Known Issues / TODO

- [ ] Add transcript view/print functionality
- [ ] Implement assignment creation form
- [ ] Add event edit/delete functionality
- [ ] Add child delete functionality
- [ ] Implement supply list for events
- [ ] Add profile picture upload
- [ ] Geocoding for state detection from coordinates
- [ ] Real-time updates with PocketBase subscriptions

## 📄 License

Built with ❤️ by the Village Community & Kitt

© 2026 Village Homeschool
