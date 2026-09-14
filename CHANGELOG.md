# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and releases are dated — see CONTRIBUTING.md, "Versioning and releases".

## [Unreleased]

### Changed

- **Versioning and tagging standardised across the platform.** Releases are tagged `YYYY-MM-DD` (CalVer) after the date of the newest `## [YYYY-MM-DD]` CHANGELOG section, with `YYYY-MM-DD.2` for a second release on the same day. The release jobs now run `scripts/release-tag.sh`, which fails when that section is missing, when `CHANGELOG.md` is unchanged since the previous release, or when the tag already exists; `scripts/release-tag.test.sh` is its self-test. See CONTRIBUTING.md, "Versioning and releases".
- **README endpoint manifest now CI-checked and completed.** Added the three Web Scripts missing from the Mini API reference (`/api/providers/provider-history-report`, `/api/usoap/ce-evidence-report`, `/api/usoap/direct-tag`), normalised the table paths to the descriptor `<url>` form (`/api/...`, base URL now `/alfresco/s`), corrected the `import-canonical` row to its actual contract, and added `scripts/verify-endpoints.mjs` (run by `validate:examples`) so the table cannot drift from `webscripts/*/*.desc.xml` again. Also fixed the smoke-test docs: `run-model-smoke-tests.sh` runs ST-01…ST-19 (its header said ST-18), and `docs/model-smoke-tests-rest-curl.md` claimed the script ran ST-01…ST-09.

## [2026-09-06] — ProtocolQuestion Renamed to ChecklistQuestion (atrocore-docker)

### Changed
- **`ProtocolQuestion` (AtroCore checklist-question catalog entity) renamed to `ChecklistQuestion`** to disambiguate it from the unrelated `UsoapProtocolQuestion` (ICAO Protocol Question) entity, which the shared "ProtocolQuestion" name fragment had already caused confusion around (e.g. generically-named fields in `compliance_web`'s `usoapDirectTagStore.js` that actually query `UsoapProtocolQuestion`). Implemented in `atrocore-docker` as a same-shape DB rename (tables/columns/indexes, no data migration/loss) plus git-tracked metadata for the new entity, replacing the entity's previous gap of never being version-controlled. The citation chain referenced elsewhere in this repo's docs is now `UsoapProtocolQuestion → AcapiteOACI → Normativa → ChecklistQuestion`, with the join relation renamed `NormativaProtocolQuestion → NormativaChecklistQuestion`. `compliance_flow`'s "getChecklistQuestion" Node-RED flow and `compliance_web`'s question-catalog store (`protocolQuestionStore.js → checklistQuestionStore.js`) were updated in lockstep. `compliance_cmis` itself has no direct model/code dependency on the old name — only `docs/usoap-evidence-structure.md`'s citation-chain diagram referenced it, updated accordingly.

## [2026-09-06] — English/Spanish Localization & Message-Bundle Title Fixes

### Added
- **English/Spanish localization for report generation**: `generate-inspection-report.post.js` and `generate-inspection-plan.post.js` now accept a `locale` parameter (default `es`), selecting from new `INFORME_FINAL_LABELS`/`PLAN_LABELS` dictionaries. `templates/*.fodt` gained ~60 `${labels.*}` placeholders replacing hardcoded Spanish text.
- **`entity-profile.json`**: new config for entity branding defaults (name, logo) used in generated report/plan headers, in the same effort as locale support so both concerns land together for the template's header section.
- **Model title bundles**: all 157 inline `<title>` overrides removed from `configs/model/vsoModel.xml` in favor of `configs/messages/vsoModel` (English) and the new `configs/messages/vsoModel_es` (Spanish), resolved via Alfresco's model message-bundle mechanism.

### Fixed
- **Share showed raw QNames (e.g. `vso:specialtyName`) instead of property/type/aspect labels**: the message-bundle keys used abbreviated category words (`prop.`, `assoc.`) and were missing the required model-scope prefix. Confirmed via `javap` disassembly of the running container's own `alfresco-data-model-25.2.0.64.jar` that Alfresco's `M2Label.getLabel()` builds keys as `<model-prefix>.<category>.<qname>.title` with the *unabbreviated* category word (`property`, `association`, not `prop`/`assoc`). Every key in `configs/messages/vsoModel`/`vsoModel_es` rewritten to `vso_vsoModel.<type|aspect|property|association>.vso_<name>.title`; 8 associations that had never had a bundle entry at all (an authoring gap from the original localization pass) were added in both locales.
- **Share's "Manage Aspects" dialog also showed raw QNames**: this dialog uses a wholly separate label mechanism from the model dictionary — Share's own `aspect.<prefix>_<name>=<label>` flat bundle. Added `configs/share/messages/vsoModel-share.properties` and `vsoModel-share_es.properties` (labels for the 7 VSO aspects in `share-config-custom.xml`'s `<aspects><visible>`), registered via a new `configs/share/vso-share-context.xml` Spring bean override of `webscripts.resources`. Note for future editors: this override must reproduce Share's original 5 bundle entries verbatim alongside the new one — an initial attempt using `<list merge="true">` without a `parent=` relationship replaced (rather than merged into) the list and silently broke Share's own built-in message resolution.
- **Stale verification guidance**: `README.md` and `docs/model-reload-validation-and-smoke-tests.md` recommended checking `/alfresco/service/api/classes/{id}` to confirm bundle resolution; that legacy webscript reads the model's raw XML `<title>` directly and never consults the message bundle, so it cannot validate this either way. Both docs corrected to recommend checking an actual Share-rendered page instead.

## [2026-09-02] — Nomenclatura ID Formats & Three Bug Fixes

### Changed
- **BREAKING — adopted the platform-wide Nomenclatura document-ID formats**: `V-XXXX-YYYY-##` (Visita), `AV-XXXX-T-####` (Actividad de vigilancia), `LV-XXXXT####-EEE` (Lista de verificación, was `CHK-XXXXNNN-YYY`), `H-XXXXT####-EEE-###` (Hallazgo, 3-digit sequence, was `XXXXNNN-YYY-SS`), `P-XXXXT####-EEE###-##` (Plan de acciones correctivas, was `CA-XXXXNNNYYY-SS-VV`), `S-XXXXT####-EEE###-##` (Seguimiento, was `FU-XXXXNNNYYY-MM-VV`). Activity codes are now sequenced independently of their parent Visita's code (previously the same value).
- **BREAKING — specialty catalog replaced** with a flat 16-code list (APR, AVIS, FAU, PAV, SSEI, AIM, ATS, COM, ECNS, EMET, FIS, MET, NAV, SAR, SUR, DPR), dropping the AGA/SNA/MET domain-grouping concept. Smart-folder profiles re-keyed by provider (`idac`/`indomet`/`aeropuertos`) instead of domain.
- **Added `activityTypeId`/`activityTypeCode`/`activityTypeName` property triad** to `vso:inspection`, mirroring the existing specialty triad.

### Fixed
- **Checklist canonical-import lookup**: `loadCanonicalDocuments()` compared the raw `inspectionCode` string for equality instead of normalizing the optional `AV-` prefix the same way `resolveInspectionKey()` already does, so every checklist upload failed with "Checklist canonical model not found" whenever the caller and the stored checklist disagreed on whether to include the prefix (they legitimately do, by design, across `compliance_flow` and `compliance_import`).
- **Missing `vso:findingReviewedBy` model property**: present in `server/findings/router.cjs` since the finding-review feature shipped (2026-08-30) but never added to the content model — every "Confirm Review" attempt failed with a 400 "Unknown property" the first time anyone exercised it end-to-end.
- **`vso:relatedCorrectiveAction` association multiplicity**: `<source><many>` was `false`, which Alfresco enforces as "at most one follow-up may ever reference a given CAP" — but the real workflow needs multiple follow-ups (Progress Review, CAP Verification, Closure Verification) to reference the same CAP over its lifecycle. Flipped to `true`. Pre-existing since 2026-04-22, unrelated to the ID-format work.

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
