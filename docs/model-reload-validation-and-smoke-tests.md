# Alfresco Model Reload Validation and Smoke Tests

## Scope
This checklist validates the VSO model updates for revised follow-up and finding resolution lifecycle:
- Updated vso:findingStatusList constraint with new status: Verifying Effective Closure
- New properties in vso:finding:
   - vso:resolutionDeadline (deadline for finding resolution, distinct from CAP submission deadline)
   - vso:hasFollowUp child-association (primary relation for follow-up reports)
- New properties and associations in vso:followUpReport:
   - vso:followUpType (mandatory, constrained: Progress Review, CAP Verification, Closure Verification, Ad-hoc Inquiry)
   - vso:followUpId generated as S-XXXXT####-EEE###-## when omitted
   - vso:relatedCorrectiveAction (optional peer association to vso:correctiveAction)
   - Moved from child-under-CA to child-under-Finding via vso:hasFollowUp
- New property in vso:evidenceItem:
   - vso:evidenceRole (constrained: Compliance Evidence, Finding Support, Progress Evidence, Closure Evidence)
- Removed vso:verifiedBy child-association from vso:correctiveAction (no longer used)
- New property in vso:finding: vso:findingReviewedBy (d:text, reviewer's username) alongside the existing vso:findingReviewStatus/vso:findingReviewDate — set by the "Confirm Review" action in compliance_web
- Closure gate enforcement: only Closure Verification type with effectivenessConfirmed=true can close a finding
- Nomenclatura ID formats on the vso:inspectionContext aspect and the *Id properties:
   - vso:activityTypeId / vso:activityTypeCode / vso:activityTypeName (new triad; code is the single activity-type letter A=Auditoría, I=Inspección, M=Monitoreo, D=Revisión documental, S=Análisis de suceso)
   - vso:inspectionId now carries the independently-sequenced activity code AV-XXXX-T-#### (for example AV-MDSD-A-0002); it is no longer derived from the parent site-visit code
   - vso:checklistId LV-XXXXT####-EEE, vso:findingId H-XXXXT####-EEE-###, vso:capId P-XXXXT####-EEE###-##
   - vso:inspectionType description corrected: it is a display/legacy activity-category label, not a lifecycle phase
- English/Spanish localization: all 157 inline `<title>` overrides removed from `vsoModel.xml` (types, aspects, properties, associations) — every label now resolves from the message bundle (`configs/messages/vsoModel` / `vsoModel_es`) instead, using Alfresco's `<model QName>.<category>.<item QName>.title` key format (see step 9 below). This is the first model change where a bundle miss is a silent regression (a blank label, or the raw QName, in Share) rather than a dictionary load failure, so verify actual label rendering after restart, not just that the model loads — see step 12 below.

It also covers the PDF rendering added to `import-canonical-models.post.js`: checklist/finding/follow-up node content is a rendered PDF rather than JSON, replaced in place on the same node (not a sibling document). This is a rendering feature layered on top of the existing model/webscript behavior above and does not itself change `vsoModel.xml`.

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
    - vso:relatedCorrectiveAction on vso:followUpReport (peer association, target many=false, source many=true — many follow-ups may reference the same CAP over its lifecycle, e.g. Progress Review then CAP Verification then Closure Verification; a single follow-up still references at most one CAP)
11. Verify the vso:inspectionContext aspect registers the new activity-type triad:
    - vso:activityTypeId, vso:activityTypeCode, vso:activityTypeName (all d:text, no LIST constraint — the ActivityType catalog is owned by the AtroCore backend and resolved dynamically)
    - vso:activityTypeId and vso:activityTypeCode are indexed untokenised (queryable for smart folders), mirroring vso:specialtyId/vso:specialtyCode
12. Verify message-bundle labels actually render, in both locales — a clean model load does not confirm this (see Scope note above). **Do not use `GET /alfresco/service/api/classes/{id}`** for this — it reads the model's raw XML `<title>` directly and never consults the message bundle, so it always returns blank now regardless of bundle correctness (confirmed by disassembling the actual webscript's call chain):
    - Open a real node's edit-metadata form in Share (e.g. a `vso:inspection` or `vso:finding`) and confirm property *and* association field labels are populated with real text, not the raw `vso:` QName.
    - Repeat with a Spanish `Accept-Language` header / Share locale switch and confirm the labels change to the Spanish bundle's values.
    - For aspect labels specifically in Share's **"Manage Aspects" dialog** (a different, Share-side bundle — see README), confirm the labeled aspect appears correctly in that picker, not just in the edit-metadata form.

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
| ST-09 | ID | Sequential followUpId generation | Create 3 follow-ups on same finding without followUpId and verify suffixes -01, -02, -03 | IDs are generated as S-XXXXT####-EEE###-## without collisions (for example S-MDSDA0002-COM001-01) |
| ST-10 | Assoc | relatedCorrectiveAction optional | Create vso:followUpReport without linking to vso:correctiveAction | Create succeeds (optional association) |
| ST-11 | Assoc | relatedCorrectiveAction peer link | Create vso:followUpReport and link to vso:correctiveAction via vso:relatedCorrectiveAction | Peer association created |
| ST-12 | Closure Gate | Closure Verification only can close | Try creating follow-up with effectivenessConfirmed=true and followUpType=Progress Review | Save fails with validation error |
| ST-13 | Closure Gate | Valid closure | Create Closure Verification follow-up with effectivenessConfirmed=true and followUpType=Closure Verification | Save succeeds, finding can be closed |
| ST-14 | CAP Optional | Create follow-up without CAP | Submit follow-up report with no capId value | Follow-up created independently of CAP |
| ST-15 | CAP Optional | Link follow-up to CAP later | Create follow-up without CAP, then add vso:relatedCorrectiveAction link | Update succeeds, CAP association added post-creation |

## PDF Rendering Smoke Test Matrix

Covers checklist, finding, and follow-up node content being a rendered PDF instead of JSON (see `README.md` -> "Checklist/finding/follow-up documents are rendered PDFs, not JSON"). Requires `checklistPdfTemplatePath`, `findingPdfTemplatePath`, and `followUpPdfTemplatePath` to be deployed at the configured Alfresco paths, and the `transform-core-aio` service reachable from the repository container.

| ID | Area | Test | Steps | Expected Result |
|---|---|---|---|---|
| ST-16 | PDF Rendering | Checklist content is PDF | Import a canonical checklist | The checklist node's own content is a valid PDF with labeled fields; its name ends in `.pdf`, not `.json` |
| ST-17 | PDF Rendering | Finding content is PDF | Import a canonical finding | The finding node's own content is a valid PDF; its name ends in `.pdf` |
| ST-18 | PDF Rendering | Follow-up content is PDF | Process a canonical follow-up file | The follow-up node's own content is a valid PDF; its name ends in `.pdf` |
| ST-19 | PDF Rendering | Nested items/evidence render | Import a checklist with items that have multiple `evidenceItems` and at least one item with zero evidence items | PDF lists every item, each with its own evidence table; the zero-evidence item shows an empty table (header row only), no error |
| ST-20 | PDF Rendering | Finding without corrective action | Import a finding with no `correctiveAction` attached yet | PDF renders with the Corrective Action section fields blank, no error |
| ST-21 | PDF Rendering | Degrades gracefully on missing template | Temporarily rename/remove one of the three `.fodt` templates, then run the corresponding import | Node properties are still created/updated correctly; a warning is logged; node content/name are left untouched (empty content and `.json` name for a brand-new node) |
| ST-22 | PDF Rendering | Free-text special characters | Import a checklist/finding with `&`, `<`, `>` in a comment or description field | PDF renders the literal characters correctly (no broken layout, no missing content) |
| ST-23 | PDF Rendering | Re-import updates in place, no duplicates | Import the same checklist/finding/follow-up a second time after ST-16/17/18 succeeded | The same nodes are found by their `.pdf` name and updated (`summary.updated` increments); no duplicate `.json`-named nodes are created |
| ST-24 | PDF Rendering | Self-healing after a prior failure | Force ST-21's failure case (node stays `.json`-named with no content), then re-import successfully | The `.json`-named node is found via the fallback lookup, updated in place, and renamed to `.pdf` |
| ST-25 | PDF Rendering | `get-open-findings` still works | Query `POST /findings/open/query` for a finding created under this scheme | Every field populates correctly from `vso:*` properties alone (no dependency on parsing finding content) |
| ST-26 | Finding Review | vso:findingReviewedBy accepted | Set vso:findingReviewStatus=Confirmed, vso:findingReviewDate, and vso:findingReviewedBy (a username) on a vso:finding via a node property update | Save succeeds; all three properties persist and read back correctly |
| ST-27 | Assoc | Multiple follow-ups may reference the same CAP | Create two vso:followUpReport children on the same vso:finding, link both to the same vso:correctiveAction via vso:relatedCorrectiveAction | Both associations succeed (no "association source multiplicity" integrity violation) |

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
   - Verify hasFollowUp association is correctly queried to compute the next 2-digit suffix.
   - Confirm existing follow-ups have vso:followUpId values using the S-XXXXT####-EEE###-## pattern.
   - Note the ID scheme is a clean replacement, not a migration: follow-ups or findings still carrying the retired FU-/CHK-/CA- formats are rejected with HTTP 400 by design.
6. CAP optional but still rejected:
   - Verify normalizeRequest() handles capId as trimToNull (not normalizeField).
   - Verify ensureCorrectiveActionNode() returns early if capId is null.
7. FollowUp parenting error (child not under finding):
   - Verify ensureFollowUpNode() uses findingNode.createNode() not correctiveActionNode.createNode().
   - Verify child-association uses vso:hasFollowUp not vso:verifiedBy.
8. Closure gate constraint not enforced:
   - Verify validation logic checks followUpType == "Closure Verification" before allowing effectivenessConfirmed=true for closure.
   - Confirm error handling returns HTTP 400 if type mismatch.
9. Property/type/aspect/association label shows the raw `vso:` QName in Share instead of a title:
   - Confirm the key exists in `configs/messages/vsoModel` (English) in the exact required format: `vso_vsoModel.<category>.vso_<name>.title`, where `<category>` is the unabbreviated word — `type`, `aspect`, `property`, or `association` (not `prop`/`assoc`), and the model's own QName (`vso_vsoModel`) is a required leading segment, not optional. This is Alfresco's own `M2Label.getLabel()` algorithm, confirmed by disassembling the actual class — get any part of it wrong and the lookup misses silently, with nothing logged anywhere.
   - Do **not** use the legacy `/alfresco/service/api/classes/{id}` webscript to check this — it reads the model's raw XML `<title>` directly and never consults the message bundle, so a blank result there means nothing either way. Check the real Share edit-metadata page (or property/association fields on an actual node's form) instead.
   - For a blank Spanish label specifically, check `configs/messages/vsoModel_es` for the same key — the two files are not kept in sync automatically.
   - Confirm both `docker-compose.yml` volume mounts point at the right container path (`vsoModel.properties` / `vsoModel_es.properties`) and that the repository was restarted after editing either file.
   - If the label is missing specifically from Share's **"Manage Aspects" dialog** (not the edit-metadata form), that's a different, Share-side bundle entirely — see "English/Spanish localization" in `README.md` for `configs/share/messages/vsoModel-share*.properties`.

## Exit Criteria
1. All smoke tests ST-01 through ST-25 pass.
2. No repository startup errors related to model bootstrap.
3. Follow-up import succeeds with optional CAP, mandatory followUpType, and auto-generated S-XXXXT####-EEE###-## IDs.
4. Closure gate prevents non-Closure-Verification types from closing findings.
5. Follow-ups are children of findings, not corrective actions.
6. Evidence role constraint is enforced on evidence items.
7. Checklist, finding, and follow-up node content is a rendered PDF (not JSON), correctly renders nested items/evidence and optional corrective-action data, is found and updated in place (not duplicated) on re-import regardless of whether it's still `.json`-named or already `.pdf`-named, and a rendering failure (e.g. missing template) never blocks the underlying property writes.
