#!/usr/bin/env bash
set -euo pipefail

# describeError() is duplicated in every Web Script with a top-level catch,
# because importScript is not available in every execution context -- the same
# constraint that makes verify-vso-security.sh necessary. A drift between the
# copies means one endpoint silently goes back to reporting `undefined` for
# any repository failure, and that is exactly the state this function was
# added to end: a CI run answered `{"success": false, "error": null}` and
# neither the response nor alfresco.log said anything more.
#
# Checks two things, because either alone is insufficient:
#   1. every copy of the block is byte-identical
#   2. no top-level catch has gone back to using `error.message` directly

FILES="
webscripts/canonical-model-import/import-canonical-models.post.js
webscripts/checklist-prior-finding-flags/get-prior-finding-flags.post.js
webscripts/checklist-prior-finding-flags/refresh-prior-finding-flags.post.js
webscripts/finding-query/get-open-findings.post.js
webscripts/follow-up-import/import-follow-up-report.post.js
webscripts/inspection-plan/generate-inspection-plan.post.js
webscripts/inspection-report/generate-inspection-report.post.js
"

BEGIN="// --- BEGIN vso-describe-error"
END="// --- END vso-describe-error ---"

extract() { # extract <file> — the describer block, or nothing
  awk -v b="$BEGIN" -v e="$END" '
    index($0, b) == 1 { inblock = 1 }
    inblock { print }
    index($0, e) == 1 { inblock = 0 }
  ' "$1"
}

canonical=""
canonical_file=""
failed=0

for f in $FILES; do
  if [ ! -f "$f" ]; then
    echo "FAIL missing file: $f"
    failed=1
    continue
  fi

  block="$(extract "$f")"
  if [ -z "$block" ]; then
    echo "FAIL no describeError block in $f"
    failed=1
    continue
  fi

  if [ -z "$canonical" ]; then
    canonical="$block"
    canonical_file="$f"
    echo "ok   $f (canonical, $(printf '%s\n' "$block" | wc -l | tr -d ' ') lines)"
    continue
  fi

  if [ "$block" = "$canonical" ]; then
    echo "ok   $f"
  else
    echo "FAIL $f differs from $canonical_file:"
    diff <(printf '%s\n' "$canonical") <(printf '%s\n' "$block") | sed 's/^/       /' || true
    failed=1
  fi
done

# The top-level catch is the last few lines of each of these files. Strip
# comments before looking, so the describer's own explanatory comment -- which
# necessarily mentions `error.message` -- does not match itself.
for f in $FILES; do
  [ -f "$f" ] || continue
  if tail -12 "$f" | grep -v '^[[:space:]]*//' | grep -q '\.message'; then
    echo "FAIL $f: its top-level catch still uses .message directly"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "describeError has drifted. Copy the block from $canonical_file verbatim."
  exit 1
fi

echo
echo "describeError is identical across $(echo $FILES | wc -w | tr -d ' ') Web Scripts, and no top-level catch bypasses it."
