#!/bin/bash
CID=$(docker ps -qf "name=harbingfrontend" | head -1)

echo "=== PHASE 2B FINAL CHECK ==="
echo ""
echo "--- Layout chunk (Navbar + UpgradePrompt) ---"
DOCKER_CONTENT=$(docker exec $CID sh -c 'cat /app/.next/static/chunks/app/layout-8d1342389333493f.js' 2>/dev/null)
echo "$DOCKER_CONTENT"
