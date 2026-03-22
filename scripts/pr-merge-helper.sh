#!/bin/bash
# PR Merge Helper for Village App
# Run: ./scripts/pr-merge-helper.sh

set -e

echo "🏘️ Village App - PR Merge Helper"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: gh CLI not installed${NC}"
    exit 1
fi

# Get open PRs
echo "📋 Fetching open PRs..."
echo ""

# Tier 1 PRs (safe to merge, no DB changes)
TIER1_PRS=(22 28 27 20 25 19)

# Show current status
echo -e "${GREEN}=== TIER 1: Safe to Merge (No DB Changes) ===${NC}"
echo ""
for pr in "${TIER1_PRS[@]}"; do
    title=$(gh pr view $pr --json title --jq '.title' 2>/dev/null || echo "Not found")
    state=$(gh pr view $pr --json state --jq '.state' 2>/dev/null || echo "unknown")
    if [ "$state" = "OPEN" ]; then
        echo -e "  ${YELLOW}PR #$pr${NC}: $title"
    elif [ "$state" = "MERGED" ]; then
        echo -e "  ${GREEN}PR #$pr${NC}: $title (already merged ✓)"
    fi
done

echo ""
echo -e "${YELLOW}=== Quick Actions ===${NC}"
echo ""
echo "1) Merge all Tier 1 PRs (safe, no DB changes)"
echo "2) Merge specific PR"
echo "3) View PR details"
echo "4) List all open PRs"
echo "5) Exit"
echo ""
read -p "Choose action [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "Merging Tier 1 PRs..."
        for pr in "${TIER1_PRS[@]}"; do
            state=$(gh pr view $pr --json state --jq '.state' 2>/dev/null || echo "unknown")
            if [ "$state" = "OPEN" ]; then
                echo -e "Merging PR #$pr..."
                gh pr merge $pr --merge --delete-branch || echo "  (skipped - may have conflicts)"
            fi
        done
        echo -e "${GREEN}Done!${NC}"
        ;;
    2)
        read -p "Enter PR number: " pr_num
        gh pr merge $pr_num --merge --delete-branch
        ;;
    3)
        read -p "Enter PR number: " pr_num
        gh pr view $pr_num
        ;;
    4)
        gh pr list --state open
        ;;
    5)
        echo "Bye! 🐾"
        exit 0
        ;;
    *)
        echo "Invalid choice"
        ;;
esac
