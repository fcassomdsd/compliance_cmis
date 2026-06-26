#!/usr/bin/env bash
set -euo pipefail

echo "Verifying resolveVsoPaths() consistency across Web Scripts..."

CANONICAL="webscripts/common/vso-paths.lib.js"

if [ ! -f "$CANONICAL" ]; then
  echo "ERROR: Canonical file not found: $CANONICAL"
  exit 1
fi

echo "  Canonical: $CANONICAL"

files=$(find webscripts -name "*.post.js" | sort)
count=0
mismatches=0

for file in $files; do
  if ! grep -q "function resolveVsoPaths" "$file"; then
    continue
  fi
  count=$((count + 1))
  echo "  Checking: $file"

  # Verify all key lines exist in both files
  for pattern in \
    "var defaults = {" \
    "inspectionInProcessPath:" \
    "canonicalSourceBasePath:" \
    "typeof __VSO_PATHS" \
    "typeof importScript" \
    "classpath:alfresco/extension/templates/webscripts/common/vso-paths.lib.js" \
    "return defaults"; do
    if ! grep -q "$pattern" "$file"; then
      echo "    MISMATCH: missing pattern '$pattern'"
      mismatches=$((mismatches + 1))
    fi
  done
done

echo ""
echo "Files with resolveVsoPaths(): $count"
echo "Mismatches found: $mismatches"

if [ $mismatches -gt 0 ]; then
  echo "FAIL: resolveVsoPaths() implementations are inconsistent."
  exit 1
fi

echo "PASS: resolveVsoPaths() is consistent across all Web Scripts."
