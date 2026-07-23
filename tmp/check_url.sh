#!/bin/bash
echo "=== Checking all chunks in harbingerfrontend ==="
CHUNK="/app/.next/static/chunks/app/(public)/page-b2ad121151bf1533.js"

# Try different grep approaches
docker exec harbingfrontend sh -c "cat $CHUNK" 2>&1 | head -c 600 > /tmp/chunk_output.txt
echo "--- First 600 chars ---"
cat /tmp/chunk_output.txt
echo ""
echo "--- Searching for 'backend-api' (the problem) ---"
docker exec harbingfrontend sh -c "grep -c 'backend-api' $CHUNK || echo 'NOT FOUND'" 2>&1
echo "--- Searching for '8082/api' (the fix) ---"
docker exec harbingfrontend sh -c "grep -c '8082/api' $CHUNK || echo 'NOT FOUND'" 2>&1
echo "--- Looking for any URL-like strings (using sed to extract paths with http://) ---"
docker exec harbingfrontend sh -c "sed -n '/http:/p' $CHUNK | head -3" 2>&1
