#!/bin/bash
# PR Consolidation Script
# Reduces Village PR backlog by closing duplicates and merging safe PRs

set -e

REPO="kitcopilot-dev/Village-App"

echo "🧹 Village PR Consolidation Script"
echo "=================================="
echo ""

# Check for gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it first."
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged into GitHub. Run: gh auth login"
    exit 1
fi

echo "📊 Current PR count:"
gh pr list --repo $REPO --state open --limit 100 | wc -l

echo ""
echo "Choose an action:"
echo "1) Close duplicate PRs (recommended first)"
echo "2) Merge safe PRs (no DB changes)"
echo "3) Show consolidation status"
echo "4) Full auto (close duplicates + merge safe)"
echo "5) Dry run (show what would happen)"
echo "q) Quit"
echo ""
read -p "Enter choice [1-5, q]: " choice

case $choice in
    1)
        echo ""
        echo "🔴 Closing duplicate PRs..."
        echo ""
        
        # Study Timer duplicate
        echo "Closing #8 (superseded by #16)..."
        gh pr close 8 --repo $REPO -c "Superseded by #16 (more complete implementation with goals and analytics)" || echo "Already closed or doesn't exist"
        
        # Weekly Reports duplicates
        echo "Closing #10 (superseded by #19)..."
        gh pr close 10 --repo $REPO -c "Superseded by #19 (more complete implementation)" || echo "Already closed or doesn't exist"
        
        echo "Closing #11 (superseded by #19)..."
        gh pr close 11 --repo $REPO -c "Superseded by #19 (more complete implementation)" || echo "Already closed or doesn't exist"
        
        # Morning Dashboard duplicate
        echo "Closing #18 (superseded by #20)..."
        gh pr close 18 --repo $REPO -c "Superseded by #20 (better UX and features)" || echo "Already closed or doesn't exist"
        
        # Curriculum Library duplicate
        echo "Closing #13 (superseded by #23)..."
        gh pr close 13 --repo $REPO -c "Superseded by #23 (more comprehensive feature set)" || echo "Already closed or doesn't exist"
        
        echo ""
        echo "✅ Duplicates closed! New PR count:"
        gh pr list --repo $REPO --state open --limit 100 | wc -l
        ;;
        
    2)
        echo ""
        echo "🟢 Merging safe PRs (no DB changes)..."
        echo ""
        
        echo "Merging #22 (Mobile Navigation - CRITICAL)..."
        gh pr merge 22 --repo $REPO --squash --delete-branch || echo "Failed or already merged"
        
        echo "Merging #29 (PR Review Guide)..."
        gh pr merge 29 --repo $REPO --squash --delete-branch || echo "Failed or already merged"
        
        echo "Merging #28 (Weekly Schedule)..."
        gh pr merge 28 --repo $REPO --squash --delete-branch || echo "Failed or already merged"
        
        echo "Merging #27 (Settings Page)..."
        gh pr merge 27 --repo $REPO --squash --delete-branch || echo "Failed or already merged"
        
        echo ""
        echo "✅ Safe PRs merged! New PR count:"
        gh pr list --repo $REPO --state open --limit 100 | wc -l
        ;;
        
    3)
        echo ""
        echo "📊 Consolidation Status"
        echo "======================"
        echo ""
        echo "Duplicates (should be closed):"
        for pr in 8 10 11 18 13; do
            status=$(gh pr view $pr --repo $REPO --json state -q '.state' 2>/dev/null || echo "NOT_FOUND")
            echo "  #$pr: $status"
        done
        
        echo ""
        echo "Safe to merge:"
        for pr in 22 29 28 27; do
            status=$(gh pr view $pr --repo $REPO --json state -q '.state' 2>/dev/null || echo "NOT_FOUND")
            echo "  #$pr: $status"
        done
        
        echo ""
        echo "Current open PRs:"
        gh pr list --repo $REPO --state open --limit 50
        ;;
        
    4)
        echo ""
        echo "🚀 Running full consolidation..."
        echo ""
        
        # Close duplicates first
        echo "Step 1: Closing duplicates..."
        for pr in 8 10 11 18 13; do
            gh pr close $pr --repo $REPO -c "Consolidation: Superseded by better implementation" 2>/dev/null || true
        done
        
        # Then merge safe PRs
        echo ""
        echo "Step 2: Merging safe PRs..."
        for pr in 22 29 28 27; do
            gh pr merge $pr --repo $REPO --squash --delete-branch 2>/dev/null || true
        done
        
        echo ""
        echo "✅ Consolidation complete! Final PR count:"
        gh pr list --repo $REPO --state open --limit 100 | wc -l
        ;;
        
    5)
        echo ""
        echo "🔍 DRY RUN - Would execute:"
        echo ""
        echo "Close duplicates:"
        echo "  gh pr close 8  (Study Timer v1 → keep #16)"
        echo "  gh pr close 10 (Weekly Reports v1 → keep #19)"
        echo "  gh pr close 11 (Weekly Reports v2 → keep #19)"
        echo "  gh pr close 18 (Morning Briefing → keep #20)"
        echo "  gh pr close 13 (Resource Library → keep #23)"
        echo ""
        echo "Merge safe PRs:"
        echo "  gh pr merge 22 (Mobile Navigation)"
        echo "  gh pr merge 29 (PR Review Guide)"
        echo "  gh pr merge 28 (Weekly Schedule)"
        echo "  gh pr merge 27 (Settings Page)"
        echo ""
        echo "Expected result: 30 PRs → ~21 PRs"
        ;;
        
    q|Q)
        echo "Exiting."
        exit 0
        ;;
        
    *)
        echo "Invalid choice."
        exit 1
        ;;
esac

echo ""
echo "📖 Full consolidation plan: docs/PR-CONSOLIDATION-PLAN.md"
