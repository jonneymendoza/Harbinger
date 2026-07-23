#!/bin/bash
CID=$(docker ps -qf "name=harbingfrontend" | head -1)
echo "=== All JS chunks ==="
docker exec $CID sh -c 'find /app/.next/static/chunks/ -name "*.js" 2>/dev/null | sed "s|.*/|    |"'

echo ""
echo "=== Search for Navbar import ==="
for chunk in $(docker exec $CID sh -c 'ls /app/.next/static/chunks/' 2>/dev/null); do
  result=$(docker exec $CID sh -c "grep -l '$chunk' /app/.next/static/chunks/*.js 2>/dev/null | head -1")
done

echo "=== Check layout chunk for Navbar ==="
docker exec $CID sh -c 'cat /app/.next/static/chunks/app/layout-8d1342389333493f.js' > /tmp/nav_check.txt 2>&1
python3 -c "
import sys
with open('/tmp/nav_check.txt') as f:
    c=f.read()
if 'Navbar' in c: print('✅ Navbar import found in layout chunk')
elif 'navbar' in c.lower(): print('⚠️  navbar (lowercase) in chunk')
else: print('❌ No navbar reference found')
if 'UpgradePrompt' in c or 'upgrade-prompt' in c.lower() or '$L3' in c or '$L4' in c:
  print('✅ UpgradePrompt likely rendered via layout component tree')
else:
  print('❓ UpgradePrompt not directly visible (may be async)')
"
