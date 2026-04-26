# 🎨 Learning Styles UI Flow Guide

## Visual Walkthrough of the Feature

### 1️⃣ Setting Learning Style (Manage Kids)

**Location:** Manage Kids → Add/Edit Child

**What you'll see:**

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Child                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Full Name:  [Sarah Johnson                            ]   │
│                                                             │
│  Age: [10]          Grade: [5th Grade         ▼]           │
│                                                             │
│  Current Focus: [Advanced Math                         ]   │
│                                                             │
│  PIN: [1234    ]                                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🎨 Learning Style                                   │  │
│  │  How does this child learn best? This helps us      │  │
│  │  personalize their assignments.                     │  │
│  │                                                      │  │
│  │  ┌────────────┐ ┌────────────┐                      │  │
│  │  │     👁️      │ │     🎧      │                      │  │
│  │  │   Visual   │ │  Auditory   │  ← Selected = Bold  │  │
│  │  │  Pictures, │ │ Listening,  │     border          │  │
│  │  │  diagrams  │ │ discussions │                      │  │
│  │  └────────────┘ └────────────┘                      │  │
│  │                                                      │  │
│  │  ┌────────────┐ ┌────────────┐                      │  │
│  │  │     🤸      │ │     📝      │                      │  │
│  │  │Kinesthetic │ │Reading/Writ│                      │  │
│  │  │ Hands-on,  │ │  Books,    │                      │  │
│  │  │  movement  │ │   notes    │                      │  │
│  │  └────────────┘ └────────────┘                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│                            [Cancel]  [Save Profile]         │
└─────────────────────────────────────────────────────────────┘
```

**Interactive:**
- Click any of the 4 cards to select
- Selected card gets primary color border + background tint
- Changes save to database when you click "Save Profile"

---

### 2️⃣ Creating Assignment (Assignments Page)

**Location:** Assignments → + New Assignment

**Step 1: Select Child**

```
┌─────────────────────────────────────────────────────────────┐
│  New Assignment                                             │
│  Set a task or quiz for a child.                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Child:                        Subject:                     │
│  [Sarah Johnson 👁️      ▼]    [Math              ]         │
│   ↑                                                         │
│   └── Emoji shows learning style!                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Learning Style Badge Appears**

```
┌─────────────────────────────────────────────────────────────┐
│  New Assignment                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Child: [Sarah Johnson 👁️   ▼]  Subject: [Math        ]    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  👁️  Visual Learner                                  │  │
│  │     AI will tailor content to this learning style    │  │
│  │                                      [✨ AI Generate] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Title: [                                              ]    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Click "✨ AI Generate"**

```
┌─────────────────────────────────────────────────────────────┐
│  New Assignment                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Child: [Sarah Johnson 👁️   ▼]  Subject: [Math        ]    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  👁️  Visual Learner                                  │  │
│  │     AI will tailor content to this learning style    │  │
│  │                                  [✨ Generating...]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                           ↑                 │
│                                           └── Loading state │
│  Title: [                                              ]    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Step 4: AI Fills the Form**

```
┌─────────────────────────────────────────────────────────────┐
│  New Assignment                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Child: [Sarah Johnson 👁️   ▼]  Subject: [Math        ]    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  👁️  Visual Learner                                  │  │
│  │     AI will tailor content to this learning style    │  │
│  │                                      [✨ AI Generate] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Title: [Exploring Fractions Through Visual Diagrams  ]    │
│         ↑                                                   │
│         └── Auto-filled by AI!                             │
│                                                             │
│  Due Date: [2026-02-28]     Initial Score: [          ]    │
│                                                             │
│  Description / Instructions:                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ In this assignment, you'll learn about fractions by │  │
│  │ creating and analyzing visual representations...    │  │
│  │                                                      │  │
│  │ Activities:                                          │  │
│  │ 1. Draw pie charts showing different fractions      │  │
│  │ 2. Watch Khan Academy video on fraction basics      │  │
│  │ 3. Color-code a fraction number line                │  │
│  │                                                      │  │
│  │ Estimated Time: 45 minutes                           │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↑                                                   │
│         └── Customized for VISUAL learner!                │
│                                                             │
│                               [Cancel]  [Create Assignment] │
└─────────────────────────────────────────────────────────────┘

📢 Toast Notification: ✨ AI assignment generated! Review and save.
```

**Step 5: Parent Reviews and Saves**

- Parent can edit any field
- Click "Create Assignment" to save
- Assignment appears in the list

---

### 3️⃣ Assignment List (Shows Learning Style)

**Location:** Assignments (main page)

```
┌─────────────────────────────────────────────────────────────┐
│  📚 Assignments                                             │
│  Track work items, quizzes, and projects.                  │
│                                                             │
│  [📊 Dashboard]  [+ New Assignment]                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Exploring Fractions Through Visual Diagrams        │  │
│  │  [✓ Graded]                                          │  │
│  │                                                      │  │
│  │  🧒 Sarah Johnson  📚 Math  📅 Feb 28, 2026         │  │
│  │     ↑                                                │  │
│  │     └── Child name (learning style in tooltip)      │  │
│  │                                                      │  │
│  │  In this assignment, you'll learn about fractions...│  │
│  │                                              95%  🗑️ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Hands-On Fraction Exploration                       │  │
│  │  [🕒 Pending]                                         │  │
│  │                                                      │  │
│  │  🧒 Tommy Johnson  📚 Math  📅 Mar 1, 2026          │  │
│  │     ↑                                                │  │
│  │     └── Different child, different style            │  │
│  │                                                      │  │
│  │  Get ready to build fractions using LEGO blocks...  │  │
│  │                                       [_____%]  🗑️  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System Elements Used

### Colors (from Village theme):
- **Primary:** Blue accent (borders, badges, selected states)
- **Background Alt:** Light gray (card backgrounds)
- **Border:** Light border color
- **Text Muted:** Gray text for descriptions

### Components:
- `Button` - Primary, secondary, ghost variants
- `Card` - Rounded 2rem borders
- `Modal` - Centered, responsive
- `Input` / `Textarea` - Labeled form fields
- `Select` - Dropdown with options
- `Toast` - Success/error notifications

### Typography:
- **Font Display:** For headings (extrabold)
- **Font Body:** For regular text
- **Emoji:** 2xl size for icons

### Spacing:
- `mb-4`, `mb-8` - Consistent vertical rhythm
- `gap-3`, `gap-4` - Grid spacing
- `p-4`, `p-6` - Card padding

---

## 📱 Responsive Behavior

### Desktop (≥768px):
```
Learning Style Selection:
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│   Visual   │ │  Auditory  │ │ Kinesthetic│ │ Reading/W  │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### Mobile (<768px):
```
Learning Style Selection:
┌────────────┐ ┌────────────┐
│   Visual   │ │  Auditory  │
└────────────┘ └────────────┘
┌────────────┐ ┌────────────┐
│Kinesthetic │ │ Reading/W  │
└────────────┘ └────────────┘
```

All elements stack vertically on mobile for easy thumb access.

---

## 🎯 Key UI States

### 1. Default State
- No learning style selected → default to "Visual"
- All 4 cards have light border

### 2. Selected State
- Primary color border (2px)
- Primary color background (10% opacity)
- Bold text

### 3. Loading State
- Button text changes to "✨ Generating..."
- Button disabled
- Loading happens (5-10 seconds)

### 4. Success State
- Green toast notification: "✨ AI assignment generated!"
- Form fills with content
- User can edit before saving

### 5. Error State
- Red toast notification: "Failed to generate..."
- Form remains editable
- User can try again or fill manually

---

## 💬 User Feedback

### Toast Notifications:
- ✅ **Success:** "Assignment created!" (green)
- ✅ **Success:** "✨ AI assignment generated!" (green)
- ❌ **Error:** "Failed to save assignment." (red)
- ❌ **Error:** "Please select a child first" (red)

### Visual Feedback:
- 👁️🎧🤸📝 Emojis show learning style at a glance
- Bold borders show selected cards
- Loading states prevent double-clicks
- Disabled buttons during async operations

---

## 🧪 Testing Scenarios

### Scenario 1: Visual Learner
1. Set Sarah to "Visual" (👁️)
2. Create Math assignment
3. Generate AI content
4. Should see: diagrams, videos, charts, visual activities

### Scenario 2: Kinesthetic Learner
1. Set Tommy to "Kinesthetic" (🤸)
2. Create Science assignment
3. Generate AI content
4. Should see: experiments, hands-on, building, movement

### Scenario 3: Multiple Children
1. Add 3 children with different learning styles
2. Create assignments for each
3. Verify each gets style-appropriate content

### Scenario 4: Editing Styles
1. Change child's learning style
2. Generate new assignment
3. Should use NEW style, not old one

---

**This UI matches Village's existing design language while adding powerful personalization!** 🎨
