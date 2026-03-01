#!/bin/bash
# Fast PDF Generation using agent-browser
# Usage: ./agent-browser-pdf.sh <input-html> <output-pdf>

INPUT=$1
OUTPUT=$2

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: $0 <input-html> <output-pdf>"
  echo "Example: $0 13yo.html 13yo.pdf"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "Error: File not found: $INPUT"
  exit 1
fi

# Convert relative path to absolute
INPUT_ABS=$(realpath "$INPUT")
FILE_URL="file://$INPUT_ABS"

echo "Generating PDF from: $INPUT"
echo "Output: $OUTPUT"

# Open page and generate PDF
agent-browser open "$FILE_URL" --headless
sleep 1
agent-browser pdf "$OUTPUT"

# Close browser
agent-browser close

if [ -f "$OUTPUT" ]; then
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  echo "✓ PDF generated successfully ($SIZE)"
else
  echo "✗ PDF generation failed"
  exit 1
fi
