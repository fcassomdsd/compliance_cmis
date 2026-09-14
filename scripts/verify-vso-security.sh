#!/usr/bin/env bash
set -euo pipefail

# The mutation-group allowlist lives in webscripts/common/vso-security.lib.js and
# is duplicated as an inline fallback in each mutation Web Script (importScript
# is not available in every execution context). A drift between the copies
# silently changes who may run the mutation endpoints, so check them here.

CANONICAL="webscripts/common/vso-security.lib.js"

if [ ! -f "$CANONICAL" ]; then
  echo "ERROR: canonical file not found: $CANONICAL"
  exit 1
fi

canonical_groups=$(grep -o 'mutationGroups: *\[[^]]*\]' "$CANONICAL" | head -1)

if [ -z "$canonical_groups" ]; then
  echo "ERROR: no mutationGroups list found in $CANONICAL"
  exit 1
fi

echo "Canonical: $canonical_groups"

FILES="
webscripts/inspection-plan/generate-inspection-plan.post.js
webscripts/inspection-report/generate-inspection-report.post.js
webscripts/canonical-model-import/import-canonical-models.post.js
webscripts/follow-up-import/import-follow-up-report.post.js
webscripts/usoap/apply-direct-usoap-tag.post.js
"

mismatches=0
checked=0

for file in $FILES; do
  if [ ! -f "$file" ]; then
    echo "  MISSING: $file"
    mismatches=$((mismatches + 1))
    continue
  fi

  checked=$((checked + 1))

  if ! grep -q "function resolveVsoSecurity" "$file"; then
    echo "  MISMATCH: $file has no resolveVsoSecurity()"
    mismatches=$((mismatches + 1))
  fi

  if ! grep -q "resolveVsoSecurity()" "$file"; then
    echo "  MISMATCH: $file does not call resolveVsoSecurity()"
    mismatches=$((mismatches + 1))
  fi

  if ! grep -q "classpath:alfresco/extension/templates/webscripts/common/vso-security.lib.js" "$file"; then
    echo "  MISMATCH: $file lacks the classpath candidate"
    mismatches=$((mismatches + 1))
  fi

  local_groups=$(grep -o 'mutationGroups: *\[[^]]*\]' "$file" | head -1)

  if [ "$local_groups" != "$canonical_groups" ]; then
    echo "  MISMATCH: $file has '$local_groups', canonical is '$canonical_groups'"
    mismatches=$((mismatches + 1))
  fi
done

if [ "$mismatches" -ne 0 ]; then
  echo "FAIL: $mismatches vso-security mismatch(es) across $checked Web Script(s)"
  exit 1
fi

echo "OK: vso-security allowlist consistent across $checked mutation Web Script(s)"
