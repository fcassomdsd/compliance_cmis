# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and releases are dated — see CONTRIBUTING.md, "Versioning and releases".

## [Unreleased]

### Changed

- **`docker compose` no longer falls back to a weak default for any of the four Alfresco secrets — P3.1 (production secrets).** `DB_PASSWORD`, `SOLR_SECRET`, `METADATA_KEYSTORE_PASSWORD` and `METADATA_KEYSTORE_METADATA_PASSWORD` used `${VAR:-<value>}`, and the fallback values were exactly the ones committed in `.env.example`. An operator who never ran `cp .env.example .env` therefore got a fully working stack with a database password of `alfresco` and a Solr shared secret of `secret`, with nothing anywhere indicating that the "configure your secrets" step had been skipped — the failure mode of forgetting was a silently insecure deployment rather than an error. All six references now use `${VAR:?<message>}`, so compose stops with the variable named and instructions to fix it. `.env.example` states plainly that its four values are public, and warns that the two keystore passwords cannot be rotated on an instance that already holds data without making that data undecryptable. **The demo is unchanged**: it already copies `.env.example` to `.env` (as does `demo-verify-ci.sh` for the sibling repos), and `docker compose --env-file .env.example config` resolves to byte-identical values to before.

### Added

- **`POST /api/providers/provider-history-report` accepts an optional comma-separated `specialtyCode` filter.** `compliance_web` serves this report to a specialty-scoped session (a user who may only act on their own specialties), and the filter is pushed into every artifact query — findings, corrective actions, follow-up reports, checklist items and evidence all carry `vso:specialtyCode` through the shared `vso:serviceContext` aspect — rather than applied to the artifact list afterwards. That matters because the report's `summary` and `byInspection` counts are computed from the artifacts: filtering the list in the caller would leave counts describing records the caller may not see. Same idiom the CE-evidence report already uses. Omitting the parameter returns the whole report, unchanged.

- **A uniform, generic, parameterized running header on all five report templates.** `Informe Final.fodt` (which previously had one parameterized header on the `Standard` master page and a hardcoded Spanish `FORMULARIO`/`INFORME FINAL`/`Código`/`Versión`/`3.0` header on `No_20_number`), `formato plan de inspeccion.fodt`, and the three templates that had no header at all (`Checklist Reporte.fodt`, `Finding Reporte.fodt`, `FollowUp Reporte.fodt`) now share one placeholder-driven header — logo, authority name, form/section heading, title, subtitle, code, version, date — so every report renders identically and none is branded for the reference deployment. The smaller three gained the page-layout/master-page/`RptHeader` plumbing they previously lacked. The per-report title and subtitle come from the locale label dictionaries (`INFORME_FINAL_LABELS`, `PLAN_LABELS`, `REPORT_LABELS`), which grew a `docSubtitle` (and, for the three smaller reports, `formHeading`/`docTitle`/`codeLabel`/`versionLabel`) key. New `npm run verify:templates` (`scripts/verify-report-headers.mjs`, wired into both CI configs) fails if any header's placeholder set drifts or an authority-specific literal reappears.

- **Generic, parameterized body signature blocks in the plan and final report.** `formato plan de inspeccion.fodt` hardcoded a signatory name (`Ernesto de la Cruz`), an IDAC job title (`Enc. Departamento de Control de Vigilancia SNA/AGA`) and two fixed dates; `Informe Final.fodt` hardcoded a signatory name (`Agustín José De Los Santos`) and used an IDAC-worded division-head label. They are now `${planApprovedBy}` / `${planApprovedByPosition}` / `${signatureDate}` and `${reportApprovedBy}` / `${reportApprovedByPosition}`. Both endpoints accept `approvedBy` and `approvedByPosition` (and the plan also `signatureDate`) so an approver can be named per inspection; absent that, values fall back to a new locale-keyed `signatures` block in `configs/entity-profile.json` (blank by default), and a blank `signatureDate` falls back to the generation date. `compliance_flow`'s plan flow supplies `approvedBy` from the planner who defined the site visit. `verify-report-headers.mjs` now also fails if the old literals reappear anywhere in a template.

### Changed

- **`configs/entity-profile.json` is now generic and text-only; the logo is a drop-in file.** The header identity config no longer ships IDAC's department name or a ~1 MB inline base64 logo. It now carries a locale-keyed `entityName` (`{ "es": ..., "en": ... }`) with generic defaults, an `entityLogoPath` pointing at `configs/entity-logo.png` (the same generic logo the web app and checklist app use — mounted alongside the JSON in `docker-compose.yml`), and blank `docControlCodes` / `docControlVersion` / `docControlDate` (they were the authority's printed-form identifiers and revision values; blank by default so an adopting authority repurposes or ignores them). `loadEntityProfile(locale)` in `vso-paths.lib.js` (and its inline fallbacks) resolves the locale, reads and base64-encodes the logo file, and detects its `draw:mime-type` from the file itself, so a PNG or JPEG both work; an inline `entityLogoBase64` is still honored for backward compatibility. `import-canonical-models.post.js`, which renders the three smaller reports and previously passed no header data at all, now loads the same profile (with its own copy, since `importScript` is unavailable there). `scripts/bootstrap-site-content.sh` gained `--force` to re-upload templates that changed, since it otherwise skips templates already filed in Alfresco.

### Fixed

- **`findCorrectiveActionByCapId` now tries a deterministic node lookup before the search index, closing the CAP half of the same race the finding lookups fixed.** A CAP is created as a child of its finding (`ensureCorrectiveActionNode`: `findingNode.createNode(capId + ".json", "vso:correctiveAction", …)`), but the canonical import looked it up with an AFTS/Lucene query only — so a CAP created seconds earlier was not indexed yet and the import answered `cap-not-found`, exactly as findings did before. The lookup now takes the finding node and checks `<capId>.json` / `<capId>` on it first, falling back to the search when the finding is unknown or the child is absent. The finding path lookup and this one now share the same "path first, search as fallback" shape.
- **Regenerating an inspection plan or report now checks in a new version of the existing PDF instead of failing.** A second `POST /api/inspection/generate` (or the report endpoint) wrote the rendered `.fodt` into the "Template data" folder again, where the "fodt to odt" Share rule transformed it to `.odt` — the second run's `.odt` collided with the first run's leftover (`Duplicate child name not allowed: … .odt`), and the rule's own PDF update rewrote content without creating a version, so the response kept reporting the stale PDF. Both webscripts now render into a transient `.render.fodt` inside the inspection folder (which carries no rule), transform that to PDF, and `checkout()`/`checkin()` any existing same-named PDF — the first generation creates it, every later one is a new version (`1.0 → 1.1 → …`), which matters because a plan or report is routinely adjusted and regenerated. Template data is no longer written to at all, so the rule never fires; a transform temp node (`.<name>.render.bin`) leaked by a failed run is cleared before each render.

- **`POST /api/follow-up/import` now clears `vso:closureRejectionReason` when it declares a new closure.** The model documents the property as "cleared when a new closure is declared", and the canonical import did clear it, but the standalone path did not — so a declaration made after a rejection kept a reason that belonged to the superseded attempt and read as an explanation for the new one. Both declaration sites are now in lockstep.

### Documentation

- **README's "API endpoints at a glance" list was missing three of the ten Web Scripts** (`provider-history-report`, `ce-evidence-report`, `direct-tag`) and used paths without the `/api` prefix. Both fixed, and `scripts/verify-endpoints.mjs` now checks that list as well as the "Mini API reference" table, so the two cannot drift apart again.

## [2026-09-18]

### Fixed

- **Finding lookups no longer depend on the search index, closing the "import a checklist, immediately import its follow-up, get `finding-not-found`" race.** `findFindingNodesById` (`import-canonical-models.post.js`) and `findFindingNode` (`import-follow-up-report.post.js`) both went straight to an AFTS/Lucene search, which lags writes by its commit interval — a finding created seconds earlier could silently fail to resolve, exactly what the demo quickstart's retry loop was working around. Both now try a deterministic node-path lookup first — findings are filed at `Hallazgos/<year>/<findingId>.{pdf,json}` (`upsertFinding`/`replaceContentWithPdf`) — enumerating the (typically few) year folders and checking both extensions, since the node is renamed from `.json` to `.pdf` synchronously the moment its PDF renders, which is normally within the same request that creates it. Falls back to the search only if the deterministic lookup finds nothing (e.g. a finding filed somewhere unexpected), so no existing behavior is lost. **Verified live**: imported the demo follow-up payload against a real finding **with Solr stopped entirely** — it still succeeded, proving the deterministic path resolves it independent of the search index.
- **`vso:evidenceReviewStatus`'s description no longer claims an enforcement gate that doesn't exist.** It previously said "a follow-up cannot affect `vso:findingStatus` until this is Adequate" — untrue; nothing in the model or webscripts enforces it, so a public reference implementation was actively misdescribing its own behavior. Reworded to state plainly that it's informational only, and that enforcing it vs. retiring the property is an open product decision (recorded in `TECHNICAL_DEBT_ANALYSIS.md`, deferred pending validation of how evidence review actually happens). No behavior changed — description text only.


### Changed

- **Alfresco's `mem_limit` raised `1900m` → `2560m`.** `FOOTPRINT_AUDIT.md` (platform root, 2026-09-15) measured it idling at 1.759 GiB of a 1.855 GiB cap — already 95-97% utilized before any real load — which risks GC-thrashing or an OOM kill under actual demo activity (imports, PDF generation). Applies on the next `docker compose up -d`; does not force-restart a running container.

### Fixed

- **`fileGeneratedDocumentPdf` no longer fails on a Java `String` in Rhino.** It did `sourceNode.name.replace(/\.fodt$/, ".pdf")`, and `ScriptNode.name` is a **Java** String, so Rhino cannot choose between Java's `replace(char, char)` and `replace(CharSequence, CharSequence)` for a regex argument: *"The choice of Java method java.lang.String.replace matching JavaScript argument types (function,string) is ambiguous"*. `String(sourceNode.name)` makes it a JavaScript string — how the rest of the file already handles node properties. **Only reachable when the "fodt to odt" Share rule is absent**, i.e. on exactly the fresh instances the filing was written for: with the rule present it files the PDF first and this code is never reached, which is why the development instance never hit it and the CI guard failed all ten retry attempts with `HTTP 500`. Verified by disabling the rule locally (database flag, repository restarted), deleting both filed PDFs and regenerating them — plan and report each filed their artifact — then restoring the rule.

- **Plan and report generation now files its own PDF, so a checkout reproduces the artifact without a Share folder rule.** The step that turned the rendered `.fodt` into `Inspecciones/<inspectionCode>/<document>.pdf` and deleted the source was an Alfresco folder rule ("fodt to odt" on the template-data folder) — repository *content*, not code: nothing in this repository installed it, ACS 25.2 exposes no rules API to install one (`/nodes/{id}/rules` and the legacy `/alfresco/service/api/rules` both answer `404`), and a clean clone therefore rendered the `.fodt` and left it there, producing no plan or report PDF at all. Both webscripts now do it themselves when no PDF is present (`fileGeneratedDocumentPdf`): transform, file one PDF per inspection (rewriting rather than copying on each run), remove the source and the transform's temporary node. The rule's other work was already in code — the plan webscript specialises the folder as `vso:inspection` and populates its inspection context — so nothing was lost by no longer needing the rule. A deployment that still has the rule keeps working: it wins the race as the `.fodt` is written, the PDF is already there, and the webscript's own filing is not reached. **Verified with the rule disabled** (its `disabled` flag flipped in the database, repository restarted, then restored): with no rule, plan and report each filed their PDF, left the template-data folder empty and removed the `.fodt` source; with the rule restored both endpoints still answer `success` with the filed PDF's path, version and download URL.

### Fixed

- **`vso:findingClosureDate` is now written only when a finding is actually closed, and cleared when it is not.** The property means "the date on which the finding was formally closed by the oversight authority", but three writers disagreed with that. The standalone `/api/follow-up/import` stamped it from `followUpClosureDate || followUpDate` the moment a `Closure Verification` follow-up moved the finding to `Pending Closure Approval` — dating the closure before any reviewer approved it, with nothing to clear it afterwards, so the date survived a rejection and left an `In Progress` finding that read as closed everywhere the property is surfaced (the finding API, the provider-history report, the checklist's prior-findings view). The canonical import copied `findingPayload.findingClosureDate` unconditionally, so re-importing a finding from a field payload could carry or reinstate it on a finding that was not closed; and a declaration after an earlier approval kept the superseded date, because that path cleared only `vso:closureRejectionReason`. Now `/api/follow-up/import` mirrors the canonical import and clears the date at declaration, the canonical import clears it too, and the finding-payload copy is gated on the status this import leaves behind — copied only for a `Closed` finding, cleared otherwise. `vso:findingClosureDate`'s model description now states the invariant. Dictionary-only model change (no property, aspect or type changed): restart the repository to reload it. Companion fix in `compliance_web`, whose reject branch cleared no date either. **`vso:closureRequestedBy` gets the same treatment**: the standalone path never wrote it (the field was dropped by its request normalizer) and never cleared it, so a re-declaration kept the *previous* declarer's name — attributing a closure to someone who did not declare it, which is exactly what the review's separation-of-duties check reads. It now records the declaring operator (`enteredBy`/`declaredBy`, carried through the normalizer) or clears the field, and the review refuses an unattributed declaration (`409 CLOSURE_DECLARER_UNKNOWN`) rather than trusting a stale name. New `scripts/verify-closure-date.mjs` (in `validate:examples`) pins the closure-date rule: every write in `webscripts/` must be an explicit clear, the one payload copy must sit inside the `=== "Closed"` guard, and at least one clear must exist — it fails on each of the three violations it was written for.

### Fixed

- **The plan and report responses are valid JSON again.** Both templates interpolated their values into a JSON string literal without escaping, so `generate-inspection-report` answered with unescaped quotes inside `"input"` and `"report"` — the whole response failed to parse (`Expected ',' or '}' after property value …`) for any client that did the obvious thing. Every interpolated value now goes through FreeMarker's `?json_string`, which also protects the file name and path fields (a provider name containing a quote would have broken them too). Found while adding the reporting walkthrough to the demo quickstart, whose assertion parses these responses. Verified live: `POST /api/inspection/report/generate` now works end to end through `compliance_flow`'s `/inspectionReport` with a parseable body, `generatedFile.input` arriving as the string it is meant to be.

### Fixed

- **A fresh checkout can start Alfresco: `scripts/bootstrap-alf-data.sh`.** The repository container runs as uid/gid 33000 and writes its content store into `./data/alf_data`, a bind mount — and `data*/` is gitignored, so a fresh checkout has no such directory. Docker creates a missing bind-mount source as `root:root 0755`, the container cannot create `contentstore.deleted` inside it, and Alfresco's `FileContentStore` constructor throws (`ContentIOException: 08160000 Failed to create store root: ./alf_data/contentstore.deleted` → `Context [/alfresco] startup failed due to previous errors`). The webapp never deploys, the container reports `unhealthy`, and `docker compose up` fails with *"dependency failed to start: container … is unhealthy"*, which reads like a model or database fault and is neither. A working instance only worked because the directory had been chmodded by hand once. The new script is the tracked version of that step — idempotent, `chown 33000:33000` when run as root and world-writable otherwise — and the README's troubleshooting line now points at it instead of describing the symptom. **Found by the new whole-stack demo guard**, which is the first thing in this repository to boot Alfresco from an empty checkout.

### Added

- **`scripts/bootstrap-site-content.sh` — the site, folder tree and document templates a fresh Alfresco needs.** Every path the webscripts resolve is under one Share site (`webscripts/common/vso-paths.lib.js`): `Vigilancia/{Inspecciones,Datos de campo,Hallazgos,Template data}` for canonical documents, field-collection source, findings and generation staging, and `Documentos/Formatos/` for the five `.fodt` templates. A provisioned instance has all of it because somebody created it by hand in Share; nothing tracked did, so a clean clone came up, installed, seeded and logged in — and then failed its first canonical import with *"Destination base folder not found: Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones"*. The templates themselves were already tracked in `templates/`; only the installation was missing. The script creates the site (private, no `preset` — ACS rejects it), the folder tree and the templates, creates only what is missing, and can be re-run. **Verified both paths** against the live instance: creating a scratch site from nothing (site + documentLibrary + four folders + `Documentos/Formatos` + all five uploads) and re-running against the existing site (every step reported "already present"); the scratch site was then deleted. This is the Alfresco half of what tracking `metadata/` did for AtroCore.


- **`scripts/seed-demo-identities.sh` — the demo identities, so the office half of the platform can be exercised without hand-creating users.** Idempotent, additive, with `--remove`. It creates the `U-VSO-IN_ClosureReviewer` and `U-VSO-IN_Inspector` groups, the users `closure.reviewer` and `demo.inspector1` (the latter matching the demo inspector's `external_user_i_d`), their memberships and their repository access on `vigilancia-de-la-so`. Verified: both log in through `compliance_web` with the expected roles (`closure_reviewer`, `inspector`). Two findings are recorded in the script header and the runbook: an application role does not grant an Alfresco permission, so a writing role's account also needs repository access; and no scripted *group*-level grant works in this deployment (v1 site-members → 404 for a group id, v1 node-permissions → 404, legacy memberships → 500 for `groupId`, and it ignores the parameter entirely when the body is JSON rather than form-encoded) — hence per-user membership, with the group grant still manual in Share.
### Changed


- **README and the identity seed now point at the whole-platform demo quickstart, which lives in `atrocore-docker`.** §7 of `atrocore-docker/docs/COMPLIANCE_INTEGRATION_RUNBOOK.md` — executable as `atrocore-docker/scripts/demo-quickstart.sh`, which runs this repository's `scripts/seed-demo-identities.sh` — is the single documented clean-clone-to-demonstrable sequence, so the README links to it instead of restating it, and the identity seed's header names the runbook by its full path.
- **The finding closure workflow now records who declared a closure and why a review rejected it.** Two properties on `vso:finding`: `vso:closureRequestedBy`, written by the canonical import from the follow-up's `enteredBy`/`declaredBy` when a valid `Closure Verification` follow-up moves the finding to `Pending Closure Approval`, and `vso:closureRejectionReason`, which `compliance_web` sets when a reviewer rejects and clears when a closure is approved. They exist so the review step can enforce separation of duties (the reviewer must not be the declarer) and so a returned finding carries the reason it was returned.
- **Versioning and tagging standardised across the platform.** Releases are tagged `YYYY-MM-DD` (CalVer) after the date of the newest `## [YYYY-MM-DD]` CHANGELOG section, with `YYYY-MM-DD.2` for a second release on the same day. The release jobs now run `scripts/release-tag.sh`, which fails when that section is missing, when `CHANGELOG.md` is unchanged since the previous release, or when the tag already exists; `scripts/release-tag.test.sh` is its self-test. See CONTRIBUTING.md, "Versioning and releases".
- **README endpoint manifest now CI-checked and completed.** Added the three Web Scripts missing from the Mini API reference (`/api/providers/provider-history-report`, `/api/usoap/ce-evidence-report`, `/api/usoap/direct-tag`), normalised the table paths to the descriptor `<url>` form (`/api/...`, base URL now `/alfresco/s`), corrected the `import-canonical` row to its actual contract, and added `scripts/verify-endpoints.mjs` (run by `validate:examples`) so the table cannot drift from `webscripts/*/*.desc.xml` again. Also fixed the smoke-test docs: `run-model-smoke-tests.sh` runs ST-01…ST-19 (its header said ST-18), and `docs/model-smoke-tests-rest-curl.md` claimed the script ran ST-01…ST-09.

### Fixed

- **`example/import-canonical-*.sample.json` documented a payload the endpoint rejects.** The two files listed as `POST /api/inspection/import-canonical`'s example payloads were **canonical document payloads** (`{ "checklist": { … } }` / `{ "finding": { … } }` — the shape `compliance_import` writes into Alfresco and this endpoint reads back), not request bodies. The endpoint reads its context from the request **root** (`validateImportRequest` → `requestBody.inspectionCode`), so posting either sample answered **`400 Missing required field: inspectionCode`** even though the sample carried `checklist.inspectionCode`. Renamed to `example/canonical-checklist-document.sample.json` / `canonical-finding-document.sample.json` (nothing referenced the old names but the README row), added `example/import-canonical-request.sample.json` as the real, flat request sample, and documented the distinction in the README notes. `scripts/validate-examples.cjs` now fails when an `import-canonical-request*` file is wrapped in `checklist`/`finding` or lacks a root `inspectionCode` — the rule reproduces the old failure exactly. Also dropped the legacy `regulationBreached` from the finding document: `compliance_checklist` copies it into `requirementBreached` and deletes it before upload, and only `vso:requirementBreached` exists in the model, so no canonical document should carry it; the validator rejects it now. Verified end-to-end against the running repository: the corrected request returns `success: true` (6 documents created, 1 source document) — the previous shape never got past validation.
- **`generate-inspection-plan.post.js` silently dropped the entire "Entity(ies) to be Inspected"/"Team Members" section**: `templates/formato plan de inspeccion.fodt` iterates `[#list providers as provider]` (plural), but every caller (`compliance_flow`'s `/inspectionPlan` route) only ever sends a single `provider` object — this endpoint is scoped to one provider per site-visit inspection. The hand-rolled template engine's `resolvePath()` silently returns `""` for the missing `providers` key, and `Array.isArray("")` is `false`, so the loop rendered as empty with no error anywhere in the pipeline (Node-RED, the webscript, or the PDF transform). Reproduced live end-to-end against a real `/inspectionPlan` call (site visit `V-MDPP-2025-01`, `locale=en`) and confirmed in the generated PDF. Fixed by aliasing `inputData.providers = inputData.provider ? [inputData.provider] : []` before rendering — no template or Node-RED changes needed. Locale-independent; unrelated to the 2026-09-06 localization work despite initially being reported against `locale=en`.

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
