#!/bin/bash
# Village Homeschool - Smoke Tests
# Quick sanity checks that pages load correctly

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "🧪 Village Homeschool Smoke Tests"
echo "================================="
echo "Base URL: $BASE_URL"
echo ""

# Test function
test_page() {
  local name="$1"
  local url="$2"
  local expected="$3"
  
  response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [[ "$status" == "200" ]] && echo "$body" | grep -q "$expected"; then
    echo "✅ $name"
    ((PASSED++))
  else
    echo "❌ $name (status: $status)"
    ((FAILED++))
  fi
}

# Public Pages
echo "📄 Public Pages"
test_page "Homepage loads" "$BASE_URL/" "Village"
test_page "Legal Guides loads" "$BASE_URL/legal-guides" "Legal"

# Check if pages contain expected content
echo ""
echo "🔍 Content Checks"
test_page "Homepage has login form" "$BASE_URL/" "email"
test_page "Legal Guides has states" "$BASE_URL/legal-guides" "Texas"

# API Health
echo ""
echo "🔌 API Checks"
pb_health=$(curl -s "https://bear-nan.exe.xyz/api/health" 2>/dev/null)
if echo "$pb_health" | grep -q "healthy"; then
  echo "✅ PocketBase API healthy"
  ((PASSED++))
else
  echo "❌ PocketBase API unreachable"
  ((FAILED++))
fi

# Summary
echo ""
echo "================================="
echo "Results: $PASSED passed, $FAILED failed"

if [[ $FAILED -eq 0 ]]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed"
  exit 1
fi
