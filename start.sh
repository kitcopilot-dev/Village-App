#!/bin/bash

# Village Homeschool v2 - Quick Start Script

echo "🏡 Starting Village Homeschool v2..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .next exists (built)
if [ ! -d ".next" ]; then
    echo "🔨 Building for first time..."
    npm run build
    echo ""
fi

echo "✅ Ready!"
echo ""
echo "🚀 Starting development server..."
echo "📍 Open http://localhost:3000 in your browser"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
