# Quick Start: Learning Styles Feature

## 🚀 Get It Running (5 Minutes)

### Step 1: Database Migration (REQUIRED)

1. **Start PocketBase if not running:**
   ```bash
   cd ~/Village-App
   # Start PocketBase (or use your existing start script)
   ```

2. **Open PocketBase Admin:**
   - Go to: http://localhost:8090/_/
   - Login with your admin credentials

3. **Add the field:**
   - Click "Collections" → "children"
   - Click "New field" button
   - Select "Select (single)"
   - Fill in:
     - **Name:** `learning_style`
     - **Options:** (add these 4 options)
       - `visual`
       - `auditory`
       - `kinesthetic`
       - `reading-writing`
     - **Required:** ❌ (unchecked)
   - Click "Create"

✅ **Done!** The field is now added.

### Step 2: Test the Feature

1. **Start the dev server:**
   ```bash
   cd ~/Village-App
   npm run dev
   ```

2. **Login to Village**
   - Go to http://localhost:3000
   - Login with your account

3. **Set a learning style:**
   - Go to "Manage Kids"
   - Click "Edit" on a child (or "Add Child")
   - Scroll to "🎨 Learning Style" section
   - Pick one (try "Visual" first)
   - Click "Save Profile"

4. **Generate an AI assignment:**
   - Go to "Assignments"
   - Click "+ New Assignment"
   - Select the child (you'll see 👁️ emoji for visual learner)
   - Enter subject: "Math"
   - Click "✨ AI Generate"
   - Watch it create a personalized assignment!
   - Review the content
   - Click "Create Assignment"

### Step 3: Try All Learning Styles

Create test assignments for each style to see the differences:

1. **Visual learner + "Science"** → Should include videos, diagrams
2. **Auditory learner + "History"** → Should include podcasts, discussions
3. **Kinesthetic learner + "Math"** → Should include hands-on manipulatives
4. **Reading/Writing learner + "Language Arts"** → Should include books, essays

## ✨ What You Should See

**In Manage Kids:**
- New "🎨 Learning Style" section with 4 options
- Each option has emoji + description

**In Assignments:**
- Child dropdown shows learning style emoji (👁️🎧🤸📝)
- When child selected, shows badge with their learning style
- "✨ AI Generate" button appears
- Click it → AI creates tailored assignment
- Content matches the learning style!

## 🎯 Expected Results

**Visual Learner Assignment Example:**
```
Title: "Exploring Fractions Through Visual Diagrams"

Description:
In this assignment, you'll learn about fractions by creating and analyzing visual representations...

Activities:
1. Draw pie charts showing different fractions
2. Watch Khan Academy video on fraction basics
3. Color-code a fraction number line

Resources:
- Khan Academy: Introduction to Fractions (video)
- Interactive fraction visualization tool
```

**Kinesthetic Learner Assignment Example:**
```
Title: "Hands-On Fraction Exploration"

Description:
Get ready to build and manipulate fractions using real objects...

Activities:
1. Use LEGO blocks to build fraction models
2. Cut paper strips to show equivalent fractions
3. Use measuring cups to measure fractional amounts

Resources:
- Printable fraction manipulatives
- Hands-on fraction activities guide
```

## 🐛 Troubleshooting

**"AI Generate" does nothing:**
- Check browser console (F12) for errors
- Verify `VILLAGE_SPARK_OPENROUTER_KEY` is in `.env.local`
- Make sure you entered a subject

**Learning style doesn't show emoji:**
- Refresh the page
- Check if the field saved (edit child again to verify)

**PocketBase error when saving:**
- Double-check you added the `learning_style` field
- Field name must be exactly: `learning_style`
- Options must be exactly: `visual`, `auditory`, `kinesthetic`, `reading-writing`

## 📊 What's Next?

After testing Phase 1, these features are planned:

- **Phase 2:**
  - Curriculum preferences (Singapore Math, Saxon, etc.)
  - Charlotte Mason living books engine
  - Unit study generator
  - Special needs accommodations (ADHD, dyslexia, gifted)

Want these built? Let the agent know!

## 💡 Pro Tips

1. **Test with real kids:** Ask your children which learning style resonates
2. **Mix it up:** Try generating multiple assignments and compare
3. **Edit AI content:** The AI is a starting point - customize freely!
4. **Learning styles can change:** Edit profiles anytime to update

---

**Ready? Start with Step 1 above! 🚀**
