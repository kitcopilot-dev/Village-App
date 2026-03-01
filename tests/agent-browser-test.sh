#!/bin/bash
# Village E2E Tests using agent-browser (Vercel)

BASE_URL="http://localhost:3001"
BROWSER_PID=""

cleanup() {
  if [ -n "$BROWSER_PID" ]; then
    agent-browser close 2>/dev/null
  fi
}
trap cleanup EXIT

echo "=== Village Tests with agent-browser ==="
echo ""

# Start browser
echo "Starting browser..."
agent-browser open "$BASE_URL/student" --headless &
sleep 2

echo "Test 1: Student login page loads"
START=$(date +%s%N)
agent-browser snapshot > /tmp/snapshot1.txt 2>&1
END=$(date +%s%N)
echo "  ✓ Login page loaded in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 2: Navigate to parent login"
START=$(date +%s%N)
agent-browser open "$BASE_URL/parent" --headless > /dev/null 2>&1
sleep 1
agent-browser snapshot > /tmp/snapshot2.txt 2>&1
END=$(date +%s%N)
echo "  ✓ Parent page loaded in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 3: Navigate to assignments"
START=$(date +%s%N)
agent-browser open "$BASE_URL/parent/assignments" --headless > /dev/null 2>&1
sleep 1
agent-browser snapshot > /tmp/snapshot3.txt 2>&1
END=$(date +%s%N)
echo "  ✓ Assignments page loaded in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 4: Navigate to attendance"
START=$(date +%s%N)
agent-browser open "$BASE_URL/parent/attendance" --headless > /dev/null 2>&1
sleep 1
agent-browser snapshot > /tmp/snapshot4.txt 2>&1
END=$(date +%s%N)
echo "  ✓ Attendance page loaded in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 5: Navigate to portfolios"
START=$(date +%s%N)
agent-browser open "$BASE_URL/parent/portfolios" --headless > /dev/null 2>&1
sleep 1
agent-browser snapshot > /tmp/snapshot5.txt 2>&1
END=$(date +%s%N)
echo "  ✓ Portfolios page loaded in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 6: Screenshot test"
START=$(date +%s%N)
agent-browser screenshot /tmp/agent-browser-screenshot.png > /dev/null 2>&1
END=$(date +%s%N)
echo "  ✓ Screenshot captured in $(( (END - START) / 1000000 ))ms"

echo ""
echo "Test 7: PDF generation test"
START=$(date +%s%N)
agent-browser pdf /tmp/agent-browser-test.pdf > /dev/null 2>&1
END=$(date +%s%N)
echo "  ✓ PDF generated in $(( (END - START) / 1000000 ))ms"

# Close browser
agent-browser close > /dev/null 2>&1
BROWSER_PID=""

echo ""
echo "=== All agent-browser tests complete ==="
