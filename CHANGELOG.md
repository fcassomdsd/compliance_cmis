# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning principles.

## [2026-08-15] — Evidence Tag Inheritance & Multi-CE/Area Querying

### Added
- **`vso:areaMapping` property** on `regulatoryTraceability` aspect (multi-valued, mirrors `vso:ceMapping`) — holds every USOAP area an artifact is relevant to, not just the primary one in `vso:usoapAreaCode`.
- **Evidence items now inherit USOAP tags**: `upsertEvidence()` tags checklist-item evidence directly from the item's `reference.usoapPqReference`; `upsertFollowUpEvidence()` copies the already-tagged finding's USOAP properties onto its evidence (`inheritUsoapTags`). Previously evidence nodes were never tagged, so they were invisible to CE/PQ-scoped smart-folder navigation and the CE evidence report even when the finding/checklist item they supported was correctly tagged.

### Changed
- **`ce-evidence-report` and smart-folder templates now query `ceMapping`/`areaMapping`** (multi-valued) instead of `usoapCriticalElement`/`usoapAreaCode` (single-valued "primary" fields) — an artifact relevant to more than one CE or area (e.g. one Annex paragraph cited by both a CE-7 and a CE-8 PQ) now correctly surfaces under every CE/area it belongs to, not just the first one resolved by the citation chain.

## [2026-08-14] — PQ Citation-Chain Tagging

### Added
- **`vso:usoapTagSource` property** on `usoapEvidenceContext` aspect (`Chain-derived` | `Direct`) — distinguishes PQ/CE/area tags resolved via the Annex-to-checklist-item citation chain from manually/directly assigned ones (e.g. whole-document, whole-checklist, whole-inspection tagging).
- **Canonical import webscript now writes chain-derived PQ tags**: `import-canonical-models.post.js` sets `vso:usoapPqReference`, `vso:usoapCriticalElement`, `vso:usoapAreaCode`, `vso:ceMapping`, and `vso:usoapTagSource="Chain-derived"` on checklist items (from `itemPayload.reference.usoapPqReference`, resolved upstream by `compliance_flow`'s Node-RED `ProtocolQuestion → Normativa → AcapiteOACI → UsoapProtocolQuestion` chain) and mirrors the same tags onto findings via their `vso:checklistItemCode` link.

### Removed
- **`POST /api/usoap/auto-populate-pq` webscript** (`webscripts/usoap/auto-populate-pq-mapping.post.*`) and `configs/usoap-pq-mapping.json` — retired in favor of precise, chain-derived PQ tagging. The removed mechanism only bulk-assigned every PQ in an Annex's ICAO area via regex matching on free-text `vso:icaoReference`, which could not relate a checklist item to a specific PQ. No production data depended on it.

## [2026-08-10] — Rich Corrective Action Plan (CAP) Content Model

### Added
- **5 new child types under `vso:correctiveAction`**: `vso:rootCauseAnalysis`, `vso:riskAssessment`, `vso:correctiveActionItem`, `vso:residualRisk`, `vso:effectivenessVerification` — model version bumped to 1.7.
- **New constraints**: `vso:rcaMethodList` (5 Whys, Fishbone, BowTie, TapRooT, Barrier Analysis, Other), `vso:priorityList` (High/Medium/Low), `vso:actionItemStatusList` (Open, In Progress, Closed).
- **Extended `vso:evidenceRoleList`** with "RCA Evidence" and "Risk Assessment Evidence" roles, reusing the existing `vso:evidenceItem` type and `vso:evidenceReferences` association for RCA/Risk Assessment evidence uploads.
- **i18n labels** added for all new types, properties and associations in `configs/messages/vsoModel`.
- **Smoke tests ST-10 through ST-13** added to `scripts/run-model-smoke-tests.sh` covering creation and linkage of all 5 new child types, including RCA method constraint validation and multi-item corrective action lists.

## [2026-08-02] — Inspection Report Enhancement & Interviewee Support

### Added
- **`vso:interviewee` property** on `vso:inspectionChecklist` type (d:text) — captures interviewee names per specialty checklist.
- **`vso:regulationItem` property** on `vso:regulatoryTraceability` aspect (d:text) — separates the specific regulation article from the regulation title. `vso:nationalRegulation` now holds only the title.
- **Inspection report pivoted summary table**: `buildChecklistSummaryTable()` now produces one row per specialty with `compliant`, `nonCompliant`, `notApplicable` counts (was multiple rows per compliance status).
- **Interviewees and regulation titles in report data**: `lookupInspectionData()` collects deduplicated `interviewees[]` and `regulationTitles[]` from checklist nodes.
- **Description and Conclusion fields**: Inspection report webscript now accepts `description`, `conclusion`, `objective`, `scope`, and `inspectionType` from the input JSON. Passed to template as `${description}`, `${conclusion}`, etc.

### Changed
- **Canonical import webscript**: `import-canonical-models.post.js` now writes `vso:interviewee` on checklist nodes and `vso:regulationItem` on checklist item and finding nodes.
- **Checklist items and findings**: `regulationItem` set from `itemPayload.reference.regulationItem` during upsert.

### Fixed
- Fixed `providerId` and `providerName` commented out in `lookupInspectionData()` return object — uncommented, restoring Alfresco-sourced values.
- Fixed `checklistSummaryTable: checklistTable.rows` referencing nonexistent variable — restored to `buildChecklistSummaryTable(checklistSummary)`.
- Fixed `reportData.inspectors = services` overwriting inspectors with undefined `services` — corrected to `reportData.services = Array.isArray(inputData.services) ? inputData.services : []`.

## [2026-08-01] — USOAP Traceability, Finding Severity & Residual Risk

### Added
- **USOAP reverse traceability**: `vso:usoapPqReference` and `vso:usoapEvidenceBasis` properties on `usoapEvidenceContext` aspect
- Expanded `vso:usoapAreaList` with 8 ICAO area codes (17 total)
- Made `vso:ceMapping` multi-valued for multi-CE support
- ICAO Annex → CE/PQ lookup table (23 references, 107 PQs, 11 areas)
- `POST /api/usoap/auto-populate-pq` webscript with dry-run mode
- `POST /api/usoap/ce-evidence-report` webscript with gap analysis
- USOAP evidence smart folder template (8 CEs × 19+ queries each)
- USOAP quality control dashboard (cross-CE global view)
- **Finding severity level**: `vso:findingSeverity` property (A/B/C) with constraint and default
- `severityConfig` in checklist API for timespan lookup
- **Residual risk-based closure**: `vso:targetResidualRisk`, `vso:achievedResidualRisk`, `vso:currentResidualRisk`
- `Pending Closure Approval` status between Verifying Effective Closure and Closed
- `Por severidad` and `Por riesgo residual` leaf queries in all smart folder templates

### Changed
- `vso:usoapEvidenceContext` made mandatory on checklistItem, finding, and evidenceItem types
- Closure webscript sets `Pending Closure Approval` instead of `Closed` on closure trigger
- `achievedResidualRisk` auto-populated from follow-up's `currentResidualRisk` at closure

### Fixed
- Fixed `resolveItemCode()` not checking `checklistItemCode` — findings now correctly match checklist items on import

## [2026-06-21] — Security Hardening & Code Quality

### Security
- Moved all hardcoded secrets (keystore passwords, DB password, Solr secret) from `docker-compose.yml` to `.env` variables with dev-only defaults.
- Created `.env.example` as a template for new deployments.
- Added `.env` and `docker/secrets/*.txt` to `.gitignore` to prevent credential leaks.
- Enabled Alfresco CSRF filter (`csrf.filter.enabled=true`) for repository Web Script protection.

### Added
- `package.json` with ESLint dev dependency and `lint`/`lint:fix` npm scripts.
- `scripts/verify-resolve-paths.sh` — automated check that `resolveVsoPaths()` stays consistent across Web Scripts.
- `<content-type>application/json</content-type>` restriction on all POST Web Script descriptor files.

### Changed
- `docker-compose.yml`: `postgres` image tag now uses `${POSTGRES_TAG:-16.5}` variable.
- `docker-compose.yml`: added version-pinning warning comment for Alfresco Community Edition.
- `.env`: resolved unexpanded template variables (`<%=serverName%>`, `BIND_IP_*`), corrected `POSTGRES_TAG` to `16.5`, removed unused `MARIADB_TAG`.
- 198 ESLint warnings auto-fixed (quote style, indentation) across all Web Scripts.
- Documented `fail()` error response patterns in canonical import and follow-up import scripts.

### Removed
- Stale commented-out `content-app` and `control-center` services from `docker-compose.yml`.
- Obsolete `reference/app JSON schemas.json` (dev documentation snapshot, no longer needed).
- Empty `webscripts/test-assocs/` directory.
- `.env` untracked from git (`git rm --cached`).

## [2026-05-22] - Develop to Main Release

This release merges `develop` into `main` with 39 commits.

### Added
- Governance and project hygiene artifacts: `LICENSE` (Apache-2.0), `NOTICE`, `CODE_OF_CONDUCT.md`, and `CONTRIBUTING.md`.
- New webscript modules for follow-up processing, finding queries, and checklist prior-finding flags.
- Shared follow-up helper library in `webscripts/common/vso-follow-up.lib.js`.
- Model smoke-test and validation documentation in `docs/` and `scripts/run-model-smoke-tests.sh`.

### Changed
- Canonical model import and related webscripts were aligned with schema-based payloads and validations.
- Data model identifiers were unified across entities (inspection/checklist/finding/follow-up paths).
- Domain property naming was standardized in key model mappings (including requirement and date fields).
- Example payloads and reference schemas were updated to match the current API contract.
- Reverse proxy stack was upgraded to Traefik v3.6.

### Fixed
- CAP lookup behavior and association handling in follow-up and evidence-related processing.
- Validation and import consistency issues across canonical checklist/finding flows.

### Notes
- This release is focused on model and API consistency, import robustness, and release/governance readiness.
- Recommended post-merge verification: execute smoke tests and model reload checks documented in `docs/model-reload-validation-and-smoke-tests.md`.
