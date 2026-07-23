#!/bin/bash
CID=$(docker ps -qf "name=harbingfrontend" | head -1)
echo "=== Checking layout chunk ==="
docker exec $CID sh -c 'grep -o "Navbar[^"]*" /app/.next/static/chunks/app/layout-8d1342389333493f.js 2>/dev/null | head -3'
echo "---"
docker exec $CID sh -c 'grep -o "UpgradePrompt[^"]*" /app/.next/static/chunks/app/layout-8d1342389333493f.js 2>/dev/null | head -3'

echo ""
echo "=== Checking page chunk ==="
docker exec $CID sh -c 'grep -o "handleBookmark\|triggerUpgrade\|Guest\|logOut" /app/.next/static/chunks/app/\(public\)/page-c677b33018b5ead7.js 2>/dev/null | head -5'
echo "--- Done ---"
