#!/usr/bin/env bash
set -euo pipefail

# Runs ST-01 through ST-18 against Alfresco public REST API (ST-01..ST-13)
# and the custom USOAP webscripts (ST-14..ST-18).
# Required env vars:
#   BASE_URL, USERNAME, PASSWORD, PARENT_ID

CLEANUP=0
for arg in "$@"; do
  case "$arg" in
    --cleanup)
      CLEANUP=1
      ;;
    -h|--help)
      echo "Usage: $0 [--cleanup]"
      echo "  --cleanup   Delete test nodes created by this script at the end of the run"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--cleanup]"
      exit 1
      ;;
  esac
done

required_vars=(BASE_URL USERNAME PASSWORD PARENT_ID)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required environment variable: $var"
    echo "Example: export BASE_URL=http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1"
    exit 1
  fi
done

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not installed."
  exit 1
fi

WORKDIR="${WORKDIR:-/tmp/vso-smoke-tests}"
mkdir -p "$WORKDIR"

# ST-14+ hit the custom webscripts under /alfresco/s/api/usoap/..., which live
# on a different base path than the ACS public REST API used by ST-01..ST-13.
WS_BASE_URL="${BASE_URL%%/api/-default-*}/s"

PASS=0
FAIL=0

FINDING_ID=""
CHECKLIST_ITEM_ID=""
F1=""
F2=""
CA_ID=""
R1=""
R2=""

last_response_file=""
created_nodes=()

register_created_node() {
  local node_id="$1"
  if [[ -n "$node_id" ]]; then
    created_nodes+=("$node_id")
  fi
}

cleanup_created_nodes() {
  if [[ "$CLEANUP" -ne 1 ]]; then
    return
  fi

  if [[ ${#created_nodes[@]} -eq 0 ]]; then
    echo "Cleanup mode enabled: no created nodes to delete."
    return
  fi

  echo "Cleanup mode enabled: deleting created test nodes..."
  local deleted=0
  local skipped=0
  local failed=0

  for (( idx=${#created_nodes[@]}-1; idx>=0; idx-- )); do
    local node_id="${created_nodes[$idx]}"
    local status
    status=$(curl -sS -u "$USERNAME:$PASSWORD" \
      -X DELETE \
      -o /dev/null \
      -w "%{http_code}" \
      "$BASE_URL/nodes/$node_id" || echo "000")

    if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
      deleted=$((deleted + 1))
    elif [[ "$status" == "404" ]]; then
      skipped=$((skipped + 1))
    else
      failed=$((failed + 1))
      echo "[WARN] Cleanup failed for node $node_id (HTTP $status)"
    fi
  done

  echo "Cleanup summary: deleted=$deleted skipped=$skipped failed=$failed"
}

trap cleanup_created_nodes EXIT

json_get() {
  local file="$1"
  local path="$2"
  python3 - "$file" "$path" <<'PY'
import json
import sys

file_path = sys.argv[1]
path = sys.argv[2].split('.')

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

cur = data
for p in path:
    cur = cur[p]

if isinstance(cur, bool):
    print('true' if cur else 'false')
else:
    print(cur)
PY
}

api_request() {
  local method="$1"
  local url="$2"
  local body_file="${3:-}"

  local out_file="$WORKDIR/resp-$(date +%s%N).json"
  local status

  if [[ -n "$body_file" ]]; then
    status=$(curl -sS -u "$USERNAME:$PASSWORD" \
      -H "Content-Type: application/json" \
      -X "$method" \
      --data-binary "@$body_file" \
      -o "$out_file" \
      -w "%{http_code}" \
      "$url")
  else
    status=$(curl -sS -u "$USERNAME:$PASSWORD" \
      -X "$method" \
      -o "$out_file" \
      -w "%{http_code}" \
      "$url")
  fi

  last_response_file="$out_file"
  echo "$status"
}

assert_status_2xx() {
  local status="$1"
  [[ "$status" =~ ^2[0-9][0-9]$ ]]
}

report_pass() {
  local id="$1"
  local msg="$2"
  PASS=$((PASS + 1))
  echo "[PASS] $id - $msg"
}

report_fail() {
  local id="$1"
  local msg="$2"
  FAIL=$((FAIL + 1))
  echo "[FAIL] $id - $msg"
  echo "       Last response file: $last_response_file"
}

create_node() {
  local name="$1"
  local node_type="$2"
  local properties_json="$3"

  local payload="$WORKDIR/payload-create-${name}.json"
  cat > "$payload" <<EOF
{
  "name": "$name",
  "nodeType": "$node_type",
  "properties": $properties_json
}
EOF

  local status
  status=$(api_request "POST" "$BASE_URL/nodes/$PARENT_ID/children" "$payload")
  if ! assert_status_2xx "$status"; then
    echo ""
    return 1
  fi

  local node_id
  node_id=$(json_get "$last_response_file" "entry.id")
  register_created_node "$node_id"
  echo "$node_id"
}

add_assoc_target() {
  local source_id="$1"
  local target_id="$2"
  local assoc_type="$3"

  local payload="$WORKDIR/payload-assoc-${source_id}-${target_id}.json"
  cat > "$payload" <<EOF
{
  "targetId": "$target_id",
  "assocType": "$assoc_type"
}
EOF

  api_request "POST" "$BASE_URL/nodes/$source_id/targets" "$payload" >/dev/null
}

echo "Running model smoke tests ST-01 to ST-13"

# Setup entities used by multiple tests
FINDING_ID=$(create_node "finding-st-setup-$(date +%s).json" "vso:finding" '{"vso:findingId":"F-ST-SETUP-001","vso:findingLevel":"Observation","vso:description":"Setup finding for smoke tests"}') || {
  report_fail "SETUP" "Could not create base vso:finding node"
  echo "Finished: PASS=$PASS FAIL=$FAIL"
  exit 1
}

# ST-01 Allowed findingStatus values
st01_ok=true
for status_val in "Open" "CAP Submitted" "CAP Accepted" "In Progess" "Pending Closure Review" "Closed" "Overdue"; do
  payload="$WORKDIR/payload-st01-${status_val// /_}.json"
  cat > "$payload" <<EOF
{
  "properties": {
    "vso:findingStatus": "$status_val"
  }
}
EOF

  status=$(api_request "PUT" "$BASE_URL/nodes/$FINDING_ID" "$payload")
  if ! assert_status_2xx "$status"; then
    st01_ok=false
    break
  fi
done

if [[ "$st01_ok" == "true" ]]; then
  report_pass "ST-01" "Allowed finding status values accepted"
else
  report_fail "ST-01" "One or more allowed finding status values were rejected"
fi

# ST-02 Invalid findingStatus value rejected
payload="$WORKDIR/payload-st02.json"
cat > "$payload" <<EOF
{
  "properties": {
    "vso:findingStatus": "Draft"
  }
}
EOF
status=$(api_request "PUT" "$BASE_URL/nodes/$FINDING_ID" "$payload")
if [[ "$status" =~ ^4[0-9][0-9]$ ]]; then
  report_pass "ST-02" "Invalid finding status was rejected"
else
  report_fail "ST-02" "Invalid finding status was not rejected"
fi

# ST-03 Default findingStatus = Open when omitted
DEFAULT_FINDING_ID=$(create_node "finding-st-default-$(date +%s).json" "vso:finding" '{"vso:findingId":"F-ST-DEFAULT-001","vso:findingLevel":"Observation","vso:description":"Default status test"}') || true
if [[ -n "${DEFAULT_FINDING_ID:-}" ]]; then
  status_val=$(json_get "$last_response_file" "entry.properties.vso:findingStatus" 2>/dev/null || echo "")
  if [[ "$status_val" == "Open" ]]; then
    report_pass "ST-03" "Default finding status is Open"
  else
    report_fail "ST-03" "Default finding status is not Open"
  fi
else
  report_fail "ST-03" "Could not create finding for default value check"
fi

# ST-04 New finding date fields persist
payload="$WORKDIR/payload-st04.json"
cat > "$payload" <<EOF
{
  "properties": {
    "vso:submissionDeadline": "2026-04-15",
    "vso:findingClosureDate": "2026-05-01",
    "vso:dateIssued": "2026-03-31",
    "vso:lastStatusChange": "2026-03-31"
  }
}
EOF
status=$(api_request "PUT" "$BASE_URL/nodes/$FINDING_ID" "$payload")
if assert_status_2xx "$status"; then
  status=$(api_request "GET" "$BASE_URL/nodes/$FINDING_ID?include=properties")
  if assert_status_2xx "$status"; then
    d1=$(json_get "$last_response_file" "entry.properties.vso:submissionDeadline" 2>/dev/null || true)
    d2=$(json_get "$last_response_file" "entry.properties.vso:findingClosureDate" 2>/dev/null || true)
    d3=$(json_get "$last_response_file" "entry.properties.vso:dateIssued" 2>/dev/null || true)
    d4=$(json_get "$last_response_file" "entry.properties.vso:lastStatusChange" 2>/dev/null || true)
    if [[ -n "$d1" && -n "$d2" && -n "$d3" && -n "$d4" ]]; then
      report_pass "ST-04" "New finding date fields persisted"
    else
      report_fail "ST-04" "One or more new finding date fields did not persist"
    fi
  else
    report_fail "ST-04" "Could not re-read finding properties"
  fi
else
  report_fail "ST-04" "Failed to update finding date fields"
fi

# ST-05 relatedPriorFinding many-to-many association
CHECKLIST_ITEM_ID=$(create_node "checklist-item-st05-$(date +%s).json" "vso:checklistItem" '{"vso:itemId":"CI-ST-05-001"}') || true
F1=$(create_node "finding-st05-1-$(date +%s).json" "vso:finding" '{"vso:findingId":"F-ST-05-1","vso:findingLevel":"Observation"}') || true
F2=$(create_node "finding-st05-2-$(date +%s).json" "vso:finding" '{"vso:findingId":"F-ST-05-2","vso:findingLevel":"Observation"}') || true
if [[ -n "$CHECKLIST_ITEM_ID" && -n "$F1" && -n "$F2" ]]; then
  s1=$(add_assoc_target "$CHECKLIST_ITEM_ID" "$F1" "vso:relatedPriorFinding"; echo $?)
  s2=$(add_assoc_target "$CHECKLIST_ITEM_ID" "$F2" "vso:relatedPriorFinding"; echo $?)
  status=$(api_request "GET" "$BASE_URL/nodes/$CHECKLIST_ITEM_ID/targets?where=(assocType='vso:relatedPriorFinding')")
  if [[ "$s1" -eq 0 && "$s2" -eq 0 && $(assert_status_2xx "$status"; echo $?) -eq 0 ]]; then
    report_pass "ST-05" "relatedPriorFinding links created and retrievable"
  else
    report_fail "ST-05" "Could not create or verify relatedPriorFinding links"
  fi
else
  report_fail "ST-05" "Could not create test nodes for relatedPriorFinding"
fi

# ST-06 verifiedBy optional
CA_OPTIONAL_ID=$(create_node "corrective-action-st06-$(date +%s).json" "vso:correctiveAction" '{"vso:capId":"CAP-ST-06-001","vso:proposedAction":"Optional verifiedBy test"}') || true
if [[ -n "$CA_OPTIONAL_ID" ]]; then
  report_pass "ST-06" "correctiveAction created without verifiedBy"
else
  report_fail "ST-06" "correctiveAction creation failed without verifiedBy"
fi

# ST-07 verifiedBy target many=true
CA_ID=$(create_node "corrective-action-st07-$(date +%s).json" "vso:correctiveAction" '{"vso:capId":"CAP-ST-07-001"}') || true
R1=$(create_node "follow-up-st07-1-$(date +%s).json" "vso:followUpReport" '{}') || true
R2=$(create_node "follow-up-st07-2-$(date +%s).json" "vso:followUpReport" '{}') || true
if [[ -n "$CA_ID" && -n "$R1" && -n "$R2" ]]; then
  s1=$(add_assoc_target "$CA_ID" "$R1" "vso:verifiedBy"; echo $?)
  s2=$(add_assoc_target "$CA_ID" "$R2" "vso:verifiedBy"; echo $?)
  status=$(api_request "GET" "$BASE_URL/nodes/$CA_ID/targets?where=(assocType='vso:verifiedBy')")
  if [[ "$s1" -eq 0 && "$s2" -eq 0 && $(assert_status_2xx "$status"; echo $?) -eq 0 ]]; then
    report_pass "ST-07" "Multiple verifiedBy links accepted"
  else
    report_fail "ST-07" "verifiedBy many target behavior failed"
  fi
else
  report_fail "ST-07" "Could not create correctiveAction/followUpReport test nodes"
fi

# ST-08 followUpDate datetime preservation
if [[ -n "$R1" ]]; then
  payload="$WORKDIR/payload-st08.json"
  cat > "$payload" <<EOF
{
  "properties": {
    "vso:followUpDate": "2026-03-31T14:30:00.000-05:00"
  }
}
EOF
  status=$(api_request "PUT" "$BASE_URL/nodes/$R1" "$payload")
  if assert_status_2xx "$status"; then
    status=$(api_request "GET" "$BASE_URL/nodes/$R1?include=properties")
    dt=$(json_get "$last_response_file" "entry.properties.vso:followUpDate" 2>/dev/null || true)
    if [[ "$dt" == *"T"* ]]; then
      report_pass "ST-08" "followUpDate stores datetime value"
    else
      report_fail "ST-08" "followUpDate does not appear to be datetime"
    fi
  else
    report_fail "ST-08" "Could not set followUpDate"
  fi
else
  report_fail "ST-08" "Missing follow-up report node for datetime test"
fi

# ST-09 correctiveAction version history
if [[ -n "$CA_ID" ]]; then
  payload1="$WORKDIR/payload-st09-1.json"
  payload2="$WORKDIR/payload-st09-2.json"
  cat > "$payload1" <<EOF
{
  "properties": {
    "vso:proposedAction": "Revision 1"
  }
}
EOF
  cat > "$payload2" <<EOF
{
  "properties": {
    "vso:proposedAction": "Revision 2"
  }
}
EOF

  s1=$(api_request "PUT" "$BASE_URL/nodes/$CA_ID" "$payload1")
  s2=$(api_request "PUT" "$BASE_URL/nodes/$CA_ID" "$payload2")
  s3=$(api_request "GET" "$BASE_URL/nodes/$CA_ID/versions")

  if assert_status_2xx "$s1" && assert_status_2xx "$s2" && assert_status_2xx "$s3"; then
    report_pass "ST-09" "Version endpoint available after updates"
  else
    report_fail "ST-09" "Version history check failed"
  fi
else
  report_fail "ST-09" "Missing correctiveAction node for version test"
fi

# ST-10 rootCauseAnalysis: allowed rcaMethod values + child association
if [[ -n "$CA_ID" ]]; then
  RCA_ID=$(create_node "rca-st10-$(date +%s).json" "vso:rootCauseAnalysis" '{"vso:rcaMethod":"Fishbone","vso:rootCause":"Inadequate training","vso:rcaMainCategory":"Human Factors"}') || true
  if [[ -n "$RCA_ID" ]]; then
    s1=$(add_assoc_target "$CA_ID" "$RCA_ID" "vso:hasRootCauseAnalysis"; echo $?)
    if [[ "$s1" -eq 0 ]]; then
      report_pass "ST-10" "rootCauseAnalysis created and linked via vso:hasRootCauseAnalysis"
    else
      report_fail "ST-10" "Could not link rootCauseAnalysis to correctiveAction"
    fi
  else
    report_fail "ST-10" "Could not create vso:rootCauseAnalysis node"
  fi
else
  report_fail "ST-10" "Missing correctiveAction node for rootCauseAnalysis test"
fi

# ST-10b Invalid rcaMethod value rejected
payload="$WORKDIR/payload-st10b.json"
cat > "$payload" <<EOF
{
  "name": "rca-st10b-$(date +%s).json",
  "nodeType": "vso:rootCauseAnalysis",
  "properties": {
    "vso:rcaMethod": "Not A Real Method"
  }
}
EOF
status=$(api_request "POST" "$BASE_URL/nodes/$PARENT_ID/children" "$payload")
if [[ "$status" =~ ^4[0-9][0-9]$ ]]; then
  report_pass "ST-10b" "Invalid rcaMethod value was rejected"
else
  report_fail "ST-10b" "Invalid rcaMethod value was not rejected"
  register_created_node "$(json_get "$last_response_file" "entry.id" 2>/dev/null || true)"
fi

# ST-11 riskAssessment: creation + child association
if [[ -n "$CA_ID" ]]; then
  RA_ID=$(create_node "risk-assessment-st11-$(date +%s).json" "vso:riskAssessment" '{"vso:identifiedHazard":"Runway incursion","vso:potentialConsequence":"Collision","vso:raProbability":"Occasional","vso:raSeverity":"Hazardous","vso:calculatedRiskLevel":"High","vso:tolerabilityLevel":"Unacceptable"}') || true
  if [[ -n "$RA_ID" ]]; then
    s1=$(add_assoc_target "$CA_ID" "$RA_ID" "vso:hasRiskAssessment"; echo $?)
    if [[ "$s1" -eq 0 ]]; then
      report_pass "ST-11" "riskAssessment created and linked via vso:hasRiskAssessment"
    else
      report_fail "ST-11" "Could not link riskAssessment to correctiveAction"
    fi
  else
    report_fail "ST-11" "Could not create vso:riskAssessment node"
  fi
else
  report_fail "ST-11" "Missing correctiveAction node for riskAssessment test"
fi

# ST-12 correctiveActionItem: default itemStatus=Open, sequencing, many=true association
if [[ -n "$CA_ID" ]]; then
  ITEM1_ID=$(create_node "action-item-st12-1-$(date +%s).json" "vso:correctiveActionItem" '{"vso:sequenceNumber":1,"vso:actionDescription":"Retrain staff","vso:actionPriority":"High","vso:actionResponsiblePerson":"J. Doe","vso:actionDeadline":"2026-06-30"}') || true
  ITEM2_ID=$(create_node "action-item-st12-2-$(date +%s).json" "vso:correctiveActionItem" '{"vso:sequenceNumber":2,"vso:actionDescription":"Update procedure manual","vso:actionPriority":"Medium","vso:actionResponsiblePerson":"A. Smith","vso:actionDeadline":"2026-07-31"}') || true
  if [[ -n "$ITEM1_ID" && -n "$ITEM2_ID" ]]; then
    status=$(api_request "GET" "$BASE_URL/nodes/$ITEM1_ID?include=properties")
    item_status=$(json_get "$last_response_file" "entry.properties.vso:actionItemStatus" 2>/dev/null || echo "")
    s1=$(add_assoc_target "$CA_ID" "$ITEM1_ID" "vso:hasActionItem"; echo $?)
    s2=$(add_assoc_target "$CA_ID" "$ITEM2_ID" "vso:hasActionItem"; echo $?)
    if [[ "$item_status" == "Open" && "$s1" -eq 0 && "$s2" -eq 0 ]]; then
      report_pass "ST-12" "correctiveActionItem defaults to Open and supports many-to-one linking"
    else
      report_fail "ST-12" "correctiveActionItem default status or linking failed"
    fi
  else
    report_fail "ST-12" "Could not create vso:correctiveActionItem nodes"
  fi
else
  report_fail "ST-12" "Missing correctiveAction node for correctiveActionItem test"
fi

# ST-13 residualRisk + effectivenessVerification: creation + child associations
if [[ -n "$CA_ID" ]]; then
  RR_ID=$(create_node "residual-risk-st13-$(date +%s).json" "vso:residualRisk" '{"vso:residualProbability":"Rare","vso:residualSeverity":"Minor","vso:residualRiskLevel":"Low","vso:residualJustification":"Controls implemented"}') || true
  EV_ID=$(create_node "effectiveness-verification-st13-$(date +%s).json" "vso:effectivenessVerification" '{"vso:verificationMethod":"Follow-up audit","vso:verificationIndicators":"Zero recurrence in 6 months","vso:projectedVerificationDate":"2026-12-31"}') || true
  if [[ -n "$RR_ID" && -n "$EV_ID" ]]; then
    s1=$(add_assoc_target "$CA_ID" "$RR_ID" "vso:hasResidualRisk"; echo $?)
    s2=$(add_assoc_target "$CA_ID" "$EV_ID" "vso:hasEffectivenessVerification"; echo $?)
    if [[ "$s1" -eq 0 && "$s2" -eq 0 ]]; then
      report_pass "ST-13" "residualRisk and effectivenessVerification created and linked"
    else
      report_fail "ST-13" "Could not link residualRisk/effectivenessVerification to correctiveAction"
    fi
  else
    report_fail "ST-13" "Could not create residualRisk/effectivenessVerification nodes"
  fi
else
  report_fail "ST-13" "Missing correctiveAction node for residualRisk/effectivenessVerification test"
fi

# ST-14 Direct-tagging webscript: applies a tag to an already-allowed leaf
# type (the checklist item created for ST-05) and checks it persists with
# tagSource=Direct.
if [[ -n "$CHECKLIST_ITEM_ID" ]]; then
  payload="$WORKDIR/payload-direct-tag-st14.json"
  cat > "$payload" <<EOF
{
  "nodeId": "$CHECKLIST_ITEM_ID",
  "criticalElement": "CE-7",
  "areaCode": "AGA",
  "pqReferences": ["PQ 8.315"],
  "evidenceBasis": "Oversight Record"
}
EOF
  status=$(api_request "POST" "$WS_BASE_URL/api/usoap/direct-tag" "$payload")
  if assert_status_2xx "$status" && grep -q '"usoapTagSource": *"Direct"' "$last_response_file" 2>/dev/null; then
    report_pass "ST-14" "Direct tag applied to vso:checklistItem node persists usoapTagSource=Direct"
  else
    report_fail "ST-14" "Direct tag did not apply or did not persist tagSource=Direct"
  fi
else
  report_fail "ST-14" "Missing checklist item node for direct-tag test"
fi

# ST-15 Direct-tagging webscript: rejects a node type outside the allow-list
# (the smoke-test PARENT_ID folder itself, which is not cm:content-derived).
payload="$WORKDIR/payload-direct-tag-st15.json"
cat > "$payload" <<EOF
{"nodeId": "$PARENT_ID", "criticalElement": "CE-7"}
EOF
status=$(api_request "POST" "$WS_BASE_URL/api/usoap/direct-tag" "$payload")
if [[ "$status" == "500" || "$status" == "400" ]] && grep -q "not supported for node type" "$last_response_file" 2>/dev/null; then
  report_pass "ST-15" "Direct tag rejected for disallowed node type"
else
  report_fail "ST-15" "Direct tag was not rejected for a disallowed node type"
fi

# ST-16 Direct-tagging webscript: rejects a malformed PQ code.
if [[ -n "$CHECKLIST_ITEM_ID" ]]; then
  payload="$WORKDIR/payload-direct-tag-st16.json"
  cat > "$payload" <<EOF
{"nodeId": "$CHECKLIST_ITEM_ID", "pqReferences": ["8.999"]}
EOF
  status=$(api_request "POST" "$WS_BASE_URL/api/usoap/direct-tag" "$payload")
  if [[ "$status" == "500" || "$status" == "400" ]] && grep -q "Invalid value in pqReferences" "$last_response_file" 2>/dev/null; then
    report_pass "ST-16" "Direct tag rejected for malformed PQ code"
  else
    report_fail "ST-16" "Malformed PQ code was not rejected"
  fi
else
  report_fail "ST-16" "Missing checklist item node for malformed-PQ-code test"
fi

# ST-17 CE evidence report: populationQueries resolves a Type-2 (sampled
# population) PQ and returns a matching sampledPopulations entry.
payload="$WORKDIR/payload-ce-evidence-report-st17.json"
cat > "$payload" <<'EOF'
{"ce":"CE-1","populationQueries":[{"pqCode":"PQ TEST","artifactCategory":"Checklist"}]}
EOF
status=$(api_request "POST" "$WS_BASE_URL/api/usoap/ce-evidence-report" "$payload")
if assert_status_2xx "$status" && grep -q '"artifactCategory": *"Checklist"' "$last_response_file" 2>/dev/null; then
  report_pass "ST-17" "ce-evidence-report resolved a Checklist populationQuery into sampledPopulations"
else
  report_fail "ST-17" "ce-evidence-report did not return sampledPopulations for a Checklist populationQuery"
fi

# ST-18 CE evidence report: a populationQuery with zero matching candidates
# adds a "population"-type gap entry.
payload="$WORKDIR/payload-ce-evidence-report-st18.json"
cat > "$payload" <<'EOF'
{"ce":"CE-1","populationQueries":[{"pqCode":"PQ TEST","artifactCategory":"Checklist","specialtyCode":"ZZZ-NONEXISTENT-SPECIALTY"}]}
EOF
status=$(api_request "POST" "$WS_BASE_URL/api/usoap/ce-evidence-report" "$payload")
if assert_status_2xx "$status" && grep -q '"type": *"population"' "$last_response_file" 2>/dev/null; then
  report_pass "ST-18" "Zero-candidate population produced a population-type gap entry"
else
  report_fail "ST-18" "Zero-candidate population did not produce the expected gap entry"
fi

# ST-19 CE evidence report: a cm:content-fallback populationQuery (no dedicated
# Alfresco type) is scoped to the Vigilancia site's document library rather
# than the whole repository -- regression guard for the bug where these
# categories matched Data Dictionary content models, smart-folder template
# JSON, other sites' sample content, etc. Asserts the response reports the
# specific folder(s) it scoped the search to.
payload="$WORKDIR/payload-ce-evidence-report-st19.json"
cat > "$payload" <<'EOF'
{"ce":"CE-8","populationQueries":[{"pqCode":"PQ TEST","artifactCategory":"Manual"}]}
EOF
status=$(api_request "POST" "$WS_BASE_URL/api/usoap/ce-evidence-report" "$payload")
if assert_status_2xx "$status" && grep -q '"scopedFolders"' "$last_response_file" 2>/dev/null; then
  report_pass "ST-19" "Manual populationQuery scoped to the Vigilancia site's document library folders"
else
  report_fail "ST-19" "Manual populationQuery did not report scopedFolders (site/folder scoping regressed)"
fi

echo ""
echo "Finished: PASS=$PASS FAIL=$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 2
fi
