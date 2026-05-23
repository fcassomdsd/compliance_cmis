# Alfresco REST Curl Examples for Model Smoke Tests (ST-01 to ST-09)

This guide provides curl-based examples to execute the smoke tests defined in:
- docs/model-reload-validation-and-smoke-tests.md

## Assumptions
1. Alfresco Repo is reachable at http://localhost:8080.
2. Authentication uses Basic auth for a test admin user.
3. Custom model is already bootstrapped.
4. A test folder exists where you can create nodes.

## Environment Variables
Run these once in your shell:

```bash
export BASE_URL="http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1"
export USERNAME="admin"
export PASSWORD="admin"

# Replace with an existing writable folder node id (for example: a test folder under Company Home)
export PARENT_ID="REPLACE_WITH_PARENT_NODE_ID"
```

## Run All Tests Automatically
You can execute ST-01 through ST-09 with one command:

```bash
./scripts/run-model-smoke-tests.sh
```

To run the suite and automatically delete created test artifacts at the end:

```bash
./scripts/run-model-smoke-tests.sh --cleanup
```

The script prints a pass/fail line per test and exits with:
- 0 when all tests pass
- 2 when one or more tests fail

The script requires the same environment variables listed above.

Optional helper for readable JSON:

```bash
alias pp='python -m json.tool'
```

## Helper: Create a vso:finding Node

```bash
curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "finding-st-setup.json",
    "nodeType": "vso:finding",
    "properties": {
      "vso:findingId": "F-ST-SETUP-001",
      "vso:findingLevel": "Observation",
      "vso:description": "Setup finding for smoke tests"
    }
  }' \
  "$BASE_URL/nodes/$PARENT_ID/children" | pp
```

Capture the returned id into FINDING_ID for later tests.

## ST-01 Allowed findingStatus values
For each allowed value, patch the same node and expect success.

```bash
for status in "Open" "CAP Submitted" "CAP Accepted" "In Progess" "Pending Closure Review" "Closed" "Overdue"; do
  echo "Testing allowed status: $status"
  curl -sS -u "$USERNAME:$PASSWORD" \
    -H "Content-Type: application/json" \
    -X PUT \
    -d "{\"properties\":{\"vso:findingStatus\":\"$status\"}}" \
    "$BASE_URL/nodes/$FINDING_ID" | pp
done
```

## ST-02 Rejected findingStatus value
Set an invalid value and expect a 4xx constraint error.

```bash
curl -i -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{"properties":{"vso:findingStatus":"Draft"}}' \
  "$BASE_URL/nodes/$FINDING_ID"
```

## ST-03 Default value Open on create
Create a finding without vso:findingStatus and verify the returned property is Open.

```bash
curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "finding-st-default.json",
    "nodeType": "vso:finding",
    "properties": {
      "vso:findingId": "F-ST-DEFAULT-001",
      "vso:findingLevel": "Observation",
      "vso:description": "Default status test"
    }
  }' \
  "$BASE_URL/nodes/$PARENT_ID/children" | pp
```

## ST-04 vso:finding date fields persist
Set all new date properties and read back.

```bash
curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{
    "properties": {
      "vso:submissionDeadline": "2026-04-15",
      "vso:findingClosureDate": "2026-05-01",
      "vso:dateIssued": "2026-03-31",
      "vso:lastStatusChange": "2026-03-31"
    }
  }' \
  "$BASE_URL/nodes/$FINDING_ID" | pp

curl -sS -u "$USERNAME:$PASSWORD" \
  "$BASE_URL/nodes/$FINDING_ID?include=properties" | pp
```

## ST-05 relatedPriorFinding many-to-many association
Create one checklist item and two findings, then link the checklist item to both findings using vso:relatedPriorFinding.

```bash
# Create checklist item
CHECKLIST_ITEM_ID=$(curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "checklist-item-st-05.json",
    "nodeType": "vso:checklistItem",
    "properties": {
      "vso:itemId": "CI-ST-05-001"
    }
  }' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

echo "$CHECKLIST_ITEM_ID"
```

```bash
# Create two findings to link as related prior findings
F1=$(curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d '{"name":"finding-st-05-1.json","nodeType":"vso:finding","properties":{"vso:findingId":"F-ST-05-1","vso:findingLevel":"Observation"}}' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

F2=$(curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d '{"name":"finding-st-05-2.json","nodeType":"vso:finding","properties":{"vso:findingId":"F-ST-05-2","vso:findingLevel":"Observation"}}' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

echo "$F1"
echo "$F2"
```

```bash
# Create association links (target-side endpoint)
curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d "{\"targetId\":\"$F1\",\"assocType\":\"vso:relatedPriorFinding\"}" \
  "$BASE_URL/nodes/$CHECKLIST_ITEM_ID/targets" | pp

curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d "{\"targetId\":\"$F2\",\"assocType\":\"vso:relatedPriorFinding\"}" \
  "$BASE_URL/nodes/$CHECKLIST_ITEM_ID/targets" | pp

# Verify both links exist
curl -sS -u "$USERNAME:$PASSWORD" \
  "$BASE_URL/nodes/$CHECKLIST_ITEM_ID/targets?where=(assocType='vso:relatedPriorFinding')" | pp
```

## ST-06 verifiedBy optional
Create a corrective action with no follow-up report and expect success.

```bash
curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "corrective-action-st-06.json",
    "nodeType": "vso:correctiveAction",
    "properties": {
      "vso:capId": "CAP-ST-06-001",
      "vso:proposedAction": "Optional verifiedBy test"
    }
  }' \
  "$BASE_URL/nodes/$PARENT_ID/children" | pp
```

## ST-07 verifiedBy target many=true
Link one corrective action to multiple follow-up reports via vso:verifiedBy.

```bash
# Create corrective action
CA_ID=$(curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d '{"name":"corrective-action-st-07.json","nodeType":"vso:correctiveAction","properties":{"vso:capId":"CAP-ST-07-001"}}' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

# Create two follow-up reports
R1=$(curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d '{"name":"follow-up-st-07-1.json","nodeType":"vso:followUpReport"}' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

R2=$(curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d '{"name":"follow-up-st-07-2.json","nodeType":"vso:followUpReport"}' \
  "$BASE_URL/nodes/$PARENT_ID/children" | python -c 'import sys,json; print(json.load(sys.stdin)["entry"]["id"])')

echo "$CA_ID"
echo "$R1"
echo "$R2"
```

```bash
curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d "{\"targetId\":\"$R1\",\"assocType\":\"vso:verifiedBy\"}" \
  "$BASE_URL/nodes/$CA_ID/targets" | pp

curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" \
  -d "{\"targetId\":\"$R2\",\"assocType\":\"vso:verifiedBy\"}" \
  "$BASE_URL/nodes/$CA_ID/targets" | pp

curl -sS -u "$USERNAME:$PASSWORD" \
  "$BASE_URL/nodes/$CA_ID/targets?where=(assocType='vso:verifiedBy')" | pp
```

## ST-08 followUpDate datetime preservation
Set datetime with timezone and verify readback keeps datetime semantics.

```bash
curl -sS -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{"properties":{"vso:followUpDate":"2026-03-31T14:30:00.000-05:00"}}' \
  "$BASE_URL/nodes/$R1" | pp

curl -sS -u "$USERNAME:$PASSWORD" \
  "$BASE_URL/nodes/$R1?include=properties" | pp
```

## ST-09 correctiveAction version history
Update corrective action metadata multiple times and verify versions.

```bash
curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" -X PUT \
  -d '{"properties":{"vso:proposedAction":"Revision 1"}}' \
  "$BASE_URL/nodes/$CA_ID" | pp

curl -sS -u "$USERNAME:$PASSWORD" -H "Content-Type: application/json" -X PUT \
  -d '{"properties":{"vso:proposedAction":"Revision 2"}}' \
  "$BASE_URL/nodes/$CA_ID" | pp

curl -sS -u "$USERNAME:$PASSWORD" \
  "$BASE_URL/nodes/$CA_ID/versions" | pp
```

## Notes
1. If your deployment disables direct association endpoints, run equivalent checks through CMIS browser binding or your integration service layer.
2. If constraint/default behavior differs when sending null or empty values, test those payloads explicitly; defaults generally apply when the property is omitted.
3. Keep all IDs and names unique per test run to avoid cross-test contamination.
