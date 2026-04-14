# Alfresco Model Reload Validation and Smoke Tests

## Scope
This checklist validates the updates made to the VSO model:
- New constraint: vso:findingStatusList
- vso:findingStatus constrained with default Open
- New properties in vso:finding:
   - vso:submissionDeadline
   - vso:findingClosureDate
   - vso:dateIssued
   - vso:lastStatusChange
- New association in vso:checklistItem: vso:relatedPriorFinding (many-to-many to vso:finding)
- Updated vso:verifiedBy cardinality (source mandatory=false, target many=true)
- New vso:followUpDate (d:datetime) in vso:followUpReport
- vso:correctiveAction now versionable (cm:versionable mandatory aspect)

## Preconditions
1. Backup repository and database/content store if this is not a disposable environment.
2. Ensure the updated model file is deployed:
   - configs/model/vsoModel.xml
3. Ensure bootstrap context points to this model and is included at startup:
   - configs/model/vso-bootstrap-context.xml
4. Use a clean test tenant/site for repeatable results.

## Startup Validation Checklist
1. Restart Alfresco repository service.
2. Verify there are no model dictionary parse errors in startup logs.
3. Confirm model registration in logs for namespace/prefix vso.
4. Confirm no QName collisions were reported for similarly named closure fields:
   - vso:findingClosureDate
   - vso:followUpClosureDate
5. Open Node Browser/Repository Admin and inspect type definitions:
   - vso:finding
   - vso:checklistItem
   - vso:correctiveAction
   - vso:followUpReport
6. Verify vso:findingStatus has:
   - default value Open
   - list constraint vso:findingStatusList
7. Verify vso:correctiveAction includes mandatory aspect cm:versionable.
8. Verify association metadata:
   - vso:relatedPriorFinding: source many=true, target many=true
   - vso:verifiedBy: source mandatory=false, target many=true

## Functional Smoke Test Matrix

| ID | Area | Test | Steps | Expected Result |
|---|---|---|---|---|
| ST-01 | Constraint | Allowed finding status values | Create/update a vso:finding with each allowed status: Open, CAP Submitted, CAP Accepted, In Progess, Pending Closure Review, Closed, Overdue | Save succeeds for each allowed value |
| ST-02 | Constraint | Rejected finding status value | Try setting vso:findingStatus to a value not in list (for example: Draft) | Save fails with constraint violation |
| ST-03 | Default | Default status on create | Create a new vso:finding without setting vso:findingStatus | Property auto-populates to Open |
| ST-04 | New props | vso:finding date fields present | Set/read vso:submissionDeadline, vso:findingClosureDate, vso:dateIssued, vso:lastStatusChange | All fields persist and are queryable |
| ST-05 | Assoc | relatedPriorFinding many-to-many | Link one checklist item to multiple findings, and multiple checklist items to one finding | Links persist both directions without cardinality errors |
| ST-06 | Assoc | verifiedBy optional | Create vso:correctiveAction without any follow-up report | Create succeeds (no mandatory association error) |
| ST-07 | Assoc | verifiedBy target many | Link one vso:correctiveAction to multiple vso:followUpReport nodes | Multiple links succeed |
| ST-08 | New prop | followUpDate datetime | Set vso:followUpDate with date+time and read back | Datetime preserved correctly (no truncation to date only) |
| ST-09 | Versioning | correctiveAction versionable | Create and update vso:correctiveAction content/metadata at least twice | Version history exists and increments |
| ST-10 | Regression | Existing flows | Run existing inspection checklist -> finding -> corrective action flow | No regressions in creation or retrieval |

## Suggested API-Level Checks (optional)
1. Use CMIS/REST to create and read each modified type.
2. Add assertions for:
   - default value behavior (ST-03)
   - constraint failure behavior (ST-02)
   - associations cardinality behavior (ST-05, ST-07)
   - version history retrieval for corrective actions (ST-09)

## Troubleshooting Guide
1. Model not loading after restart:
   - Check XML well-formedness and dictionary errors in logs.
   - Check duplicate QName definitions in same scope.
2. Default not applied for vso:findingStatus:
   - Confirm property is omitted on create (not sent as empty string).
3. Constraint not enforced:
   - Confirm property type is d:text and constraint is attached to vso:findingStatus.
4. Version not created for vso:correctiveAction:
   - Confirm cm:versionable is present as mandatory aspect and versioning behavior in repository config is enabled.
5. Datetime appears as date only for vso:followUpDate:
   - Confirm client sends ISO datetime (with timezone) and that UI/API mapping does not coerce to date.

## Exit Criteria
1. All smoke tests ST-01 through ST-10 pass.
2. No repository startup errors related to model bootstrap.
3. Existing business flows run without behavioral regressions.
