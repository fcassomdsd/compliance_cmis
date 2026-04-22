# Follow-up and Finding Resolution Model Redesign - Implementation Summary

## Overview
Redesigned the VSO model to decouple follow-ups from corrective actions and center the finding resolution lifecycle on independent follow-up activities, evidence collection, and progressive verification.

## Model Changes (configs/model/vsoModel.xml)

### New Constraints
1. **vso:followUpTypeList** - Mandatory follow-up classification
   - Progress Review
   - CAP Verification
   - Closure Verification
   - Ad-hoc Inquiry

2. **vso:evidenceRoleList** - Evidence purpose discrimination
   - Compliance Evidence (for checklist compliance support)
   - Finding Support (for non-compliance findings)
   - Progress Evidence (for CAP progress tracking)
   - Closure Evidence (for closure verification)

### Updated Constraints
1. **vso:findingStatusList** - Added "Verifying Effective Closure"
   - Open
   - CAP Submitted
   - CAP Accepted
   - In Progress
   - Pending Closure Review
   - **Verifying Effective Closure** (new)
   - Closed
   - Overdue

### New Properties
1. **vso:resolutionDeadline** (d:date) on vso:finding
   - Distinct from submissionDeadline
   - Controls deadline-based escalation to reconciliation

2. **vso:followUpType** (d:text, mandatory, constrained) on vso:followUpReport
   - Identifies purpose of follow-up activity
   - Enforces closure gate: only Closure Verification can set findingClosed=true

3. **vso:followUpSequence** (d:int) on vso:followUpReport
   - Server-assigned, auto-incremented per finding
   - Enables tracking sequence of inquiries and responses
   - Generated at import time via generateFollowUpSequence()

4. **vso:evidenceRole** (d:text, constrained) on vso:evidenceItem
   - Node-level property indicating evidence purpose
   - Enables discovery of evidence by role/context

### New Associations
1. **vso:hasFollowUp** (child-association) on vso:finding
   - Primary relation between finding and follow-up reports
   - Replaces follow-up-as-child-under-CA pattern
   - Target cardinality: many (multiple follow-ups per finding)

2. **vso:relatedCorrectiveAction** (peer association) on vso:followUpReport
   - Optional link to corrective action (0..1)
   - Enables follow-ups independent of CAP
   - Allows CAP association to be added/changed post-creation

### Removed/Deprecated
1. **vso:verifiedBy** (child-association) on vso:correctiveAction
   - No longer used for new follow-up flows
   - Kept for backward compatibility if legacy data exists

## Webscript Changes (webscripts/follow-up-import/import-follow-up-report.post.js)

### Key Functions Added/Modified

1. **generateFollowUpSequence(findingNode)** (new)
   - Queries existing hasFollowUp children
   - Returns next sequence number (1, 2, 3, ...)
   - Prevents collisions in concurrent uploads

2. **ensureCorrectiveActionNode()** (modified)
   - Now returns {node: null, created: false} if capId is null
   - Makes CAP optional (trimToNull instead of normalizeField)
   - Can be called with null capId without error

3. **ensureFollowUpNode()** (major rewrite)
   - Changed parent from correctiveActionNode to findingNode
   - Uses vso:hasFollowUp child-association instead of vso:verifiedBy
   - Accepts correctiveActionNode as optional parameter
   - Auto-generates vso:followUpSequence
   - Sets vso:followUpType (mandatory, from payload)
   - Creates optional vso:relatedCorrectiveAction peer link if CA exists

4. **updateFindingStatusFromFollowUp()** (modified)
   - Added closure gate validation
   - Rejects findingClosed=true unless followUpType == "Closure Verification"
   - Returns HTTP 400 error on violation

### Payload Contract Changes

**followUpReport** object now requires:
- followUpType (mandatory, must be one of: "Progress Review", "CAP Verification", "Closure Verification", "Ad-hoc Inquiry")
- capId (optional, can be null/omitted)

**followUpReport** object automatically receives:
- followUpSequence (server-generated)

### Validation Rules
1. followUpType is mandatory
2. Only "Closure Verification" type can set findingClosed=true
3. capId is optional; omit to create independent follow-ups
4. evidenceRole on evidence items is optional but recommended

## Share Config Changes (configs/share/share-config-custom.xml)

### Updated Forms

1. **vso:finding** form
   - Added vso:resolutionDeadline field (Dates & Status section)
   - Added vso:hasFollowUp association (Related Records section)

2. **vso:followUpReport** form
   - Added vso:followUpSequence field (Follow-up Info section)
   - Added vso:followUpType field (Follow-up Info section)
   - Added vso:relatedCorrectiveAction association (Related Records section)
   - Removed vso:verifiedBy reference

3. **vso:correctiveAction** form
   - Removed vso:verifiedBy association (no longer used in new flows)
   - Added vso:relatedEvidence association for direct evidence linking

4. **vso:evidenceItem** form
   - Added vso:evidenceRole field (Evidence Info section)

## Message Labels (configs/messages/vsoModel)

Added labels for new properties and associations:
- prop.vso_resolutionDeadline.title=Resolution Deadline
- prop.vso_followUpSequence.title=Follow-up Sequence
- prop.vso_followUpType.title=Follow-up Type
- prop.vso_evidenceRole.title=Evidence Role
- assoc.vso_hasFollowUp.title=Follow-up Reports
- assoc.vso_relatedCorrectiveAction.title=Related Corrective Action

## Documentation Updates (docs/model-reload-validation-and-smoke-tests.md)

1. Updated scope to reflect new design
2. Updated startup validation checklist (15 items)
3. Completely revised functional smoke test matrix (ST-01 through ST-15)
4. Updated troubleshooting guide with new issues
5. Updated exit criteria to include closure gate and sequence validation

## Workflow Support

The redesign enables the following operational workflows:

### Pre-CAP Independent Evidence Collection
1. Inspector requests evidence from operator
2. Operator submits evidence via follow-up
3. Inspector creates follow-up without CAP (Ad-hoc Inquiry type)
4. Evidence linked and analyzed

### CAP-Driven Verification
1. CAP submitted and associated with finding
2. Inspector programs sequence of inquiries
3. Each follow-up is CAP Verification type
4. Follow-ups linked to CAP via vso:relatedCorrectiveAction
5. Progress tracked via follow-up sequence

### Effectiveness Verification
1. Progress reviews confirm mitigation direction
2. When ready, inspector initiates Closure Verification
3. Operator submits closure evidence
4. Inspector verifies effectiveness
5. If effective, Closure Verification follow-up sets finding to Closed
6. If ineffective, workflow returns to proof state (new inquiry or extended deadline)

### Deadline Management
- CAP submission deadline: vso:submissionDeadline
- Resolution deadline: vso:resolutionDeadline
- During Verifying Effective Closure status, deadline does not trigger escalation
- Outcome of verification determines whether deadline is met

## Migration Notes

No migration necessary - this is a new deployment with no legacy data.

## Testing Checklist

- [ ] Model loads without errors on Alfresco restart
- [ ] vso:followUpType constraint enforced
- [ ] vso:evidenceRole constraint enforced
- [ ] followUpSequence auto-increments correctly
- [ ] Follow-ups created without CAP
- [ ] Follow-ups linked to CAP post-creation
- [ ] Closure gate rejects non-Closure-Verification with findingClosed=true
- [ ] Follow-ups are children of findings, not corrective actions
- [ ] resolutionDeadline persists on finding
- [ ] All new associations display in Share forms
- [ ] Import webscript handles optional CAP gracefully
