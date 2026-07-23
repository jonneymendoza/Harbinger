#!/bin/bash
CID=$(docker ps -qf "name=harbingfrontend" | head -1)
echo "=== Verifying rebuilt chunks contains Navbar/UpgradePrompt ==="

# Check for our new files in the image source (they won't be, but let's check .next output)
echo "--- Searching built chunks in container ---"
docker exec $CID sh -c 'find /app/.next/static/chunks/ -name "*.js" | wc -l'

# Try to get a list of all JS files and search for new content
docker exec $CID sh -c 'grep -rl "Upgrade\|navbar\|logOut\|useAuth" /app/.next/static/ 2>/dev/null'
echo "--- Done ---"
