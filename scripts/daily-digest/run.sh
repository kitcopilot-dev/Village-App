#!/usr/bin/env bash
# Village Daily Digest Runner
# 
# Usage:
#   ./run.sh              # Send email
#   ./run.sh --dry-run    # Preview without sending
#
# Cron example (7:00 AM daily):
#   0 7 * * * cd /home/exedev/.openclaw/workspace/village-v2 && ./scripts/daily-digest/run.sh >> /var/log/village-digest.log 2>&1

set -e
cd "$(dirname "$0")/../.."

# Check for tsx
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Install Node.js first."
    exit 1
fi

# Run the digest script
npx tsx scripts/daily-digest/index.ts "$@"
