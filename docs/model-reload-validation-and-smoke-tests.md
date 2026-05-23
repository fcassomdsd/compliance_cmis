# Alfresco Model Reload Validation and Smoke Tests

## Scope
This checklist validates the VSO model updates for revised follow-up and finding resolution lifecycle:
- Updated vso:findingStatusList constraint with new status: Verifying Effective Closure
- New properties in vso:finding:
   - vso:resolutionDeadline (deadline for finding resolution, distinct from CAP submission deadline)
   - vso:hasFollowUp child-association (primary relation for follow-up reports)
- New properties and associations in vso:followUpReport:
   - vso:followUpType (mandatory, constrained: Progress Review, CAP Verification, Closure Verification, Ad-hoc Inquiry)
   - vso:followUpId generated as FU-XXXXNNNYYY-MM-VV when omitted
   - vso:relatedCorrectiveAction (optional peer association to vso:correctiveAction)
   - Moved from child-under-CA to child-under-Finding via vso:hasFollowUp
- New property in vso:evidenceItem:
   - vso:evidenceRole (constrained: Compliance Evidence, Finding Support, Progress Evidence, Closure Evidence)
- Removed vso:verifiedBy child-association from vso:correctiveAction (no longer used)
- Closure gate enforcement: only Closure Verification type with effectivenessConfirmed=true can close a finding

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
4. Verify no QName collisions for similarly named closure fields:
   - vso:findingClosureDate
   - vso:followUpClosureDate
5. Open Node Browser/Repository Admin and inspect type definitions:
   - vso:finding
   - vso:followUpReport
   - vso:correctiveAction
   - vso:evidenceItem
6. Verify vso:findingStatus constraint includes:
   - Open, CAP Submitted, CAP Accepted, In Progress, Pending Closure Review, Verifying Effective Closure, Closed, Overdue
7. Verify vso:followUpType constraint includes:
   - Progress Review, CAP Verification, Closure Verification, Ad-hoc Inquiry
8. Verify vso:evidenceRole constraint includes:
   - Compliance Evidence, Finding Support, Progress Evidence, Closure Evidence
9. Verify vso:followUpType property is mandatory on vso:followUpReport.
10. Verify associations:
    - vso:hasFollowUp on vso:finding (child-association, target many=true)
    - vso:relatedCorrectiveAction on vso:followUpReport (peer association, target many=false)

## Functional Smoke Test Matrix

| ID | Area | Test | Steps | Expected Result |
|---|---|---|---|---|
| ST-01 | Constraint | Allowed finding status values | Create/update a vso:finding with each allowed status: Open, CAP Submitted, CAP Accepted, In Progress, Pending Closure Review, Verifying Effective Closure, Closed, Overdue | Save succeeds for each allowed value |
| ST-02 | Constraint | Rejected finding status value | Try setting vso:findingStatus to a value not in list (for example: Draft) | Save fails with constraint violation |
| ST-03 | Constraint | Allowed followUpType values | Create vso:followUpReport with each allowed type: Progress Review, CAP Verification, Closure Verification, Ad-hoc Inquiry | Save succeeds for each allowed value |
| ST-04 | Constraint | FollowUpType mandatory | Try creating vso:followUpReport without followUpType | Save fails with mandatory property error |
| ST-05 | Constraint | Allowed evidenceRole values | Set vso:evidenceRole on vso:evidenceItem with each role: Compliance Evidence, Finding Support, Progress Evidence, Closure Evidence | Save succeeds for each allowed value |
| ST-06 | Property | Resolution deadline present | Set/read vso:resolutionDeadline on vso:finding | Property persists and is queryable |
| ST-07 | Assoc | hasFollowUp child association | Create vso:followUpReport as child of vso:finding via vso:hasFollowUp | Node created, parent-child relation established |
| ST-08 | Assoc | Multiple follow-ups per finding | Link multiple vso:followUpReport nodes to one vso:finding via vso:hasFollowUp | Multiple child relations persist |
| ST-09 | ID | Sequential followUpId generation | Create 3 follow-ups on same finding without followUpId and verify suffixes -01, -02, -03 | IDs are generated as FU-XXXXNNNYYY-MM-VV without collisions |
| ST-10 | Assoc | relatedCorrectiveAction optional | Create vso:followUpReport without linking to vso:correctiveAction | Create succeeds (optional association) |
| ST-11 | Assoc | relatedCorrectiveAction peer link | Create vso:followUpReport and link to vso:correctiveAction via vso:relatedCorrectiveAction | Peer association created |
| ST-12 | Closure Gate | Closure Verification only can close | Try creating follow-up with effectivenessConfirmed=true and followUpType=Progress Review | Save fails with validation error |
| ST-13 | Closure Gate | Valid closure | Create Closure Verification follow-up with effectivenessConfirmed=true and followUpType=Closure Verification | Save succeeds, finding can be closed |
| ST-14 | CAP Optional | Create follow-up without CAP | Submit follow-up report with no capId value | Follow-up created independently of CAP |
| ST-15 | CAP Optional | Link follow-up to CAP later | Create follow-up without CAP, then add vso:relatedCorrectiveAction link | Update succeeds, CAP association added post-creation |

## Suggested API-Level Checks (optional)
1. Use CMIS/REST to create and read each modified type.
2. Add assertions for:
   - closure gate enforcement (ST-12, ST-13)
   - followUpType constraint validation (ST-03, ST-04)
   - evidenceRole constraint validation (ST-05)
   - hasFollowUp association cardinality (ST-07, ST-08)
   - relatedCorrectiveAction optional peer link (ST-10, ST-11)
   - CAP optionality in import flow (ST-14, ST-15)

## Troubleshooting Guide
1. Model not loading after restart:
   - Check XML well-formedness and dictionary errors in logs.
   - Check duplicate QName definitions in same scope.
2. FollowUp creation fails:
   - Verify followUpType property is supplied (mandatory).
   - Verify followUpType value matches constraint exactly.
3. Constraint not enforced:
   - Confirm property type is d:text and constraint is attached.
4. Version not created for vso:correctiveAction:
   - Confirm cm:versionable is present as mandatory aspect and versioning behavior in repository config is enabled.
5. Sequential followUpId generation not incrementing:
   - Verify hasFollowUp association is correctly queried to compute the next VV suffix.
   - Confirm existing follow-ups have vso:followUpId values using the FU-XXXXNNNYYY-MM-VV pattern.
6. CAP optional but still rejected:
   - Verify normalizeRequest() handles capId as trimToNull (not normalizeField).
   - Verify ensureCorrectiveActionNode() returns early if capId is null.
7. FollowUp parenting error (child not under finding):
   - Verify ensureFollowUpNode() uses findingNode.createNode() not correctiveActionNode.createNode().
   - Verify child-association uses vso:hasFollowUp not vso:verifiedBy.
8. Closure gate constraint not enforced:
   - Verify validation logic checks followUpType == "Closure Verification" before allowing effectivenessConfirmed=true for closure.
   - Confirm error handling returns HTTP 400 if type mismatch.

## Exit Criteria
1. All smoke tests ST-01 through ST-15 pass.
2. No repository startup errors related to model bootstrap.
3. Follow-up import succeeds with optional CAP, mandatory followUpType, and auto-generated FU-XXXXNNNYYY-MM-VV IDs.
4. Closure gate prevents non-Closure-Verification types from closing findings.
5. Follow-ups are children of findings, not corrective actions.
6. Evidence role constraint is enforced on evidence items.
