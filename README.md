# compliance-CMIS

compliance-CMIS is an Alfresco Content Services (ACS) customization for compliance and oversight workflows.
It defines a custom VSO content model, Share form configuration, and Web Script endpoints for:

- inspection plan and report generation
- canonical checklist/finding/follow-up imports
- follow-up report upsert and finding closure validation
- open-finding and prior-finding queries

## Who this repository is for

- Developers extending model, Web Scripts, or Share forms.
- Analysts/operators validating imports and workflow behavior through API calls.
- QA engineers executing smoke tests after model or endpoint changes.

## Repository map

- `configs/model/`: model (`vsoModel.xml`) and bootstrap context.
- `configs/share/`: Share form and UI configuration, plus Share-side English/Spanish message bundles (`configs/share/messages/`, registered via `configs/share/vso-share-context.xml`) for UI it owns directly, like the "Manage Aspects" dialog — separate from the repository dictionary bundle below.
- `configs/messages/`: English/Spanish label bundles for model fields and associations (`vsoModel`, `vsoModel_es`), consumed by the repository's own dictionary (types, aspects, properties, associations — Share forms included, since they inherit from the model).
- `configs/entity-profile.json`: deployment-level entity branding (name, logo, document-control codes) substituted into report templates — defaults to IDAC's current values.
- `webscripts/`: API endpoints and shared helpers.
- `example/`: ready-to-run sample request payloads.
- `templates/`: FODT templates (inspection plan/report, and checklist/finding/follow-up document rendering) and smart folder templates.
- `docs/`: model validation and test documentation.
- `scripts/run-model-smoke-tests.sh`: REST-based smoke test runner.
- `scripts/verify-resolve-paths.sh`: verify `resolveVsoPaths()` consistency across Web Scripts.
- `docker-compose.yml`: local ACS stack for development and testing.

## Prerequisites

- Docker and Docker Compose.
- At least 6 GB of RAM available for containers.
- `curl` for API testing.
- `python3` for the smoke-test script.

## Quick start (local)

1. Start the stack:

```bash
docker compose up -d
```

2. Wait until services are healthy:

```bash
docker compose ps
```

3. Validate repository readiness:

```bash
curl -f http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1/probes/-ready-
```

4. Open applications:

- Share: `http://localhost:8080/share`
- Repository API root: `http://localhost:8080/alfresco`

Default local credentials used by examples: `admin:admin`.

## Quick start (first-time developer)

Use this checklist the first time you run the project.

1. Clone and enter the repository.

```bash
git clone <your-repo-url>
cd compliance_cmis
```

2. Start services and confirm all are healthy.

```bash
docker compose up -d
docker compose ps
```

3. Check repository readiness.

```bash
curl -f http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1/probes/-ready-
```

4. Run one endpoint smoke call with a sample payload.

```bash
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/generate-inspection-plan.sample.json \
  "http://localhost:8080/alfresco/s/api/inspection/generate"
```

5. Run model smoke tests (optional but recommended before changes).

```bash
export BASE_URL="http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1"
export USERNAME="admin"
export PASSWORD="admin"
export PARENT_ID="REPLACE_WITH_PARENT_NODE_ID"
./scripts/run-model-smoke-tests.sh
```

If you change `configs/model/vsoModel.xml`, restart the repository container before validating behavior.

## Security configuration

### Secrets management

All sensitive credentials (database passwords, keystore secrets, Solr shared secrets) are configured via environment variables in `.env` with development-only defaults. For any non-local deployment:

1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Change all values marked with "CHANGE THESE for any non-local deployment"
3. For Docker Compose, these are referenced as `${VAR:-default}` in `docker-compose.yml`
4. Never commit `.env` or `docker/secrets/*.txt` — both are excluded via `.gitignore`

### CSRF protection

The Alfresco CSRF filter is enabled (`csrf.filter.enabled=true`) to protect repository Web Scripts. It requires a valid referer matching `/share/.*` for non-GET requests. For API clients that cannot provide a Share referer:
- Use the Alfresco Public REST API (`/alfresco/api/-default-/public/...`) which handles CSRF internally
- Or configure additional CSRF origin/referer patterns in `docker-compose.yml`

## Path configuration (single source of truth)

Alfresco folder paths used by Web Scripts are centralized in:

- `webscripts/common/vso-paths.lib.js`

Update this file when destination/source folders change. Important keys include:

- `inspectionInProcessPath`
- `canonicalSourceBasePath`
- `findingBasePath`
- `inspectionPlanTemplateDataPath`
- `inspectionPlanTemplatePath`
- `inspectionReportTemplateDataPath`
- `inspectionReportTemplatePath`
- `checklistPdfTemplatePath`
- `findingPdfTemplatePath`
- `followUpPdfTemplatePath`

## English/Spanish localization

The VSO model and report templates support English and Spanish.

**Model / Share form labels**: `configs/model/vsoModel.xml` carries no inline `<title>` overrides — every type/aspect/property/association label resolves from an Alfresco message bundle instead, so Share forms and the classes API pick up the active locale automatically. The bundle is two files, both mounted read-only into the Alfresco container in `docker-compose.yml`:

- `configs/messages/vsoModel` → `.../extension/vsoModel.properties` (English, the default bundle)
- `configs/messages/vsoModel_es` → `.../extension/vsoModel_es.properties` (Spanish; Alfresco resolves the `_es` suffix automatically from the base bundle name registered in `configs/model/vso-bootstrap-context.xml` — no separate registration needed)

Adding or renaming a `vso:` type/aspect/property/association means adding a matching key to **both** files — the model reload only picks up a title if the bundle has one; there's no fallback to a literal in the XML anymore. The key format is `<model QName>.<category>.<item QName>.title` with every `:` replaced by `_` — for this model that's always `vso_vsoModel.` + one of `type.`/`aspect.`/`property.`/`association.` + `vso_<name>.title` (e.g. `vso_vsoModel.property.vso_specialtyName.title`). This is Alfresco's own dictionary title-resolution algorithm (`M2Label.getLabel()`), not a convention specific to this repo — get any part of it wrong (missing the model prefix, or abbreviating `property`/`association` to `prop`/`assoc`) and the lookup silently misses, falling back to the raw QName with no error logged anywhere. Requires a repository restart (`docker compose restart alfresco`) to take effect, like any other model change. Verify a fix by checking the actual Share edit-metadata form for a real node — the legacy `/alfresco/service/api/classes/{id}` webscript reads the model's raw XML title directly and never consults this bundle at all, so it can't confirm this either way.

Out of scope, by design: USOAP smart-folder navigation (`templates/usoap-evidence-smart-folder.json`) uses physical folder/rule names, not viewer-locale-resolved labels, so it isn't part of this mechanism; and field-level `<description>` text (tooltips) isn't localized yet.

**Share's own "Manage Aspects" dialog uses a completely different, second bundle.** It reads aspect labels from `share-config-custom.xml`'s `<aspects><visible>` config, which only carries a label if you attach one via Share's own `aspect.<prefix>_<name>=<label>` convention (no model prefix, no `.title` suffix — compare `alfresco/messages/slingshot.properties`'s built-in `aspect.cm_versionable=Versionable`) — the repository bundle above has no effect here. VSO aspect labels for this dialog live in `configs/share/messages/vsoModel-share.properties` / `vsoModel-share_es.properties`, registered by `configs/share/vso-share-context.xml`, which overrides Share's own `webscripts.resources` bean (same bean id as the one in Share's `alfresco/slingshot-application-context.xml`). A same-id Spring bean override **replaces** the whole bean, it does not merge collection properties — our context file reproduces Share's original five bundle names explicitly before appending ours; dropping any of them silently breaks Share's own built-in message resolution (confirmed the hard way while building this). Requires a `docker compose restart share` (not `alfresco`) to take effect.

**Report templates and entity branding**: `webscripts/inspection-report/generate-inspection-report.post.js` and `webscripts/inspection-plan/generate-inspection-plan.post.js` accept a `locale` field (`"en"`/`"es"`, default `"es"`) in their request payload. It selects a `labels` dictionary (`INFORME_FINAL_LABELS` / `PLAN_LABELS`, defined in each webscript) substituted into the `.fodt` template via `${labels.*}` placeholders, covering section headings, table captions, and mixed label+value text.

Entity identity — the department name, logo, and document-control code/version shown in `Informe Final.fodt` and `formato plan de inspeccion.fodt` — is deployment-level config, independent of the request's `locale`, read from a new `configs/entity-profile.json` (also mounted via `docker-compose.yml`). It defaults to IDAC's current values, so an unmodified deployment's output is unchanged. A second CAA deploying this platform overrides this one file rather than editing the templates.

Both report webscripts escape `labels`/`reportData` with `xmlEscapeDeep()` (see "resolveVsoPaths() consistency" in `CONTRIBUTING.md` — the same shared/local-copy pattern now applies to this helper too) before substitution, since the underlying renderer does plain string substitution with no escaping of its own.

## Checklist/finding/follow-up documents are rendered PDFs, not JSON

`POST /api/inspection/import-canonical` writes checklist, finding, and follow-up report nodes with their content as a rendered, human-readable PDF — not JSON. The node's `vso:*` properties remain the canonical, queryable/searchable representation of the data (unchanged by this); the document body exists purely for people browsing Share who need something readable, not for programmatic parsing. Nothing in this codebase parses the content of these node types after they're stored (verified when this was built) — every other webscript (report generation, USOAP, prior-finding queries) reads from properties only.

On successful generation the node's name is updated from `<id>.json` to `<id>.pdf`. Re-importing/updating an already-PDF'd document is found by its `.pdf` name; a document whose previous PDF generation failed (still named `.json`) is found by that fallback and self-heals to `.pdf` on the next successful run — see `ensureCanonicalDocumentNode()` in `import-canonical-models.post.js`. If generation fails (missing template, transform service unavailable), the node's properties are still written/updated normally, but its content and name are left untouched — no JSON fallback.

Generation renders the corresponding `.fodt` template (`checklistPdfTemplatePath` / `findingPdfTemplatePath` / `followUpPdfTemplatePath`) via an inlined MiniFreemarker renderer (`importScript()` is not available in this webscript's execution context, so it can't load `TemplateGeneration` from `vso-paths.lib.js` — see the comment above `renderPdfTemplateContent()`) and converts it to PDF via Alfresco's local Transform Service (`ScriptNode.transformDocument("application/pdf")`, routed to the `transform-core-aio` container). The rendered PDF then replaces the target node's own content in place — via `targetNode.properties.content.write(transformedNode.properties.content)`, not a property reassignment (`cm:content` can't be set directly through `NodeService#setProperties`) and not a new sibling node.

`vso:checklistItem` (the per-item child documents within a checklist) are unaffected and remain JSON — nothing reads them either, but the checklist-level PDF already shows every item and its evidence in one consolidated document, so converting them individually wasn't worth the churn.

## Data governance conventions

Use these field conventions across payloads and stored metadata:

- `*Id`: canonical internal identifier (required for writes).
- `*Code`: stable human/search/integration key.
- `*Name`: display snapshot (optional).

Guidelines:

- Accept input aliases (`id` or `code`) and normalize to canonical fields.
- Reject inconsistent payloads where both `Id` and `Code` are provided but disagree.
- Persist `Name` only when needed for display/audit/export.

## API endpoints at a glance

All endpoints below are repository Web Scripts mounted under `http://localhost:8080/alfresco/s/api`.

- `POST /inspection/generate`: generate inspection plan documents.
- `POST /inspection/report/generate`: generate inspection report documents.
- `POST /inspection/import-canonical`: import canonical data and process follow-ups by file names or ids.
- `POST /follow-up/import`: import/upsert one follow-up report payload directly.
- `POST /findings/open/query`: query open findings by location and specialty context.
- `POST /checklist/prior-findings/open`: query checklist items with open prior findings.
- `POST /checklist/prior-findings/refresh-flags`: recompute persisted prior-finding flags.

Sample payload files are in `example/`.

## Mini API reference

Base URL used below: `http://localhost:8080/alfresco/s/api`

All mutation endpoints (`/inspection/generate`, `/inspection/report/generate`, `/inspection/import-canonical`, `/follow-up/import`, `/api/usoap/direct-tag`) are restricted to Alfresco administrators by default. To allow additional groups, inject a `__VSO_SECURITY` global (the same mechanism as `__VSO_PATHS`) shaped like `{ "mutationGroups": ["GROUP_VSO_EDITORS"] }`.

| Endpoint | Purpose | Required fields (minimum) | Common optional fields | Example payload file |
|---|---|---|---|---|
| `POST /inspection/generate` | Generate inspection plan document from template | Contract depends on inspection plan payload; use sample as baseline | `locale` (`en`/`es`, default `es`). Repository paths are server-resolved — `inspectionsPath`/`destinationPath`/`templatePath` in the payload are ignored. | `example/generate-inspection-plan.sample.json` |
| `POST /inspection/report/generate` | Generate inspection report and support derived findings path | Contract depends on report payload; use sample as baseline | report generation options embedded in payload, `locale` (`en`/`es`, default `es`) | `example/generate-inspection-report.sample.json`, `example/generate-inspection-report-mdppa0001-sur.sample.json` |
| `POST /inspection/import-canonical` | Import canonical follow-up data by file names or ids | Either `followUpFiles` or `followUpIds`, or array of follow-up file names | `sourceSpecialtyFolderName`, `specialtyFolderName` (validated folder-name hints). The canonical base path is server-resolved — `sourceBasePath` in the payload is ignored. | `example/process-followups-by-files.sample.json` |
| `POST /follow-up/import` | Upsert one follow-up report and optionally close finding | `followUpReport.findingId`, `followUpReport.followUpDate`, `followUpReport.followUpType` | `capId`, `followUpId`, `percentComplete`, `effectivenessConfirmed`, context ids | `example/FollowUp H-MDPPA0001-AVIS-001 01.json` |
| `POST /findings/open/query` | Query open findings by location and specialty context | one of `locationId/locationCode/icaoCode` and one of `specialtyId/specialtyCode/domain` | `skipCount`, `maxItems` | `example/get-open-findings.sample.json` |
| `POST /checklist/prior-findings/open` | Get checklist items with open prior findings | `inspectionId` or `inspectionCode`, plus `specialtyId` or `specialtyCode` or `domain` | `refreshBeforeQuery`, `refreshDryRun`, `priorOnly` | `example/get-prior-finding-flags.sample.json` |
| `POST /checklist/prior-findings/refresh-flags` | Recompute and persist prior-finding flags | `inspectionId` or `inspectionCode`, plus `specialtyId` or `specialtyCode` or `domain` | `dryRun`, `priorOnly` | `example/refresh-prior-finding-flags.sample.json` |

Notes:

- For `POST /follow-up/import`, finding closure is allowed only with `followUpType="Closure Verification"` and `effectivenessConfirmed=true`.
- For `POST /inspection/import-canonical`, evidence files linked to processed follow-ups are moved into finding-scoped evidence folders.
- For `POST /inspection/import-canonical`, checklist/finding/follow-up document content is a rendered PDF, not JSON (see "Checklist/finding/follow-up documents are rendered PDFs, not JSON" above).
- For `POST /inspection/report/generate`, checklist summary specialty now resolves from item, checklist, domain, and inspection context (in that order) before falling back to item-code prefix (for example `SUR-0048` -> `SUR`).
- For both `POST /inspection/generate` and `POST /inspection/report/generate`, omitting `locale` renders Spanish (matching this deployment's current behavior unchanged) — see "English/Spanish localization" above.

## Quick test commands

```bash
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/generate-inspection-plan.sample.json \
  "http://localhost:8080/alfresco/s/api/inspection/generate"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/generate-inspection-report.sample.json \
  "http://localhost:8080/alfresco/s/api/inspection/report/generate"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/generate-inspection-report-mdppa0001-sur.sample.json \
  "http://localhost:8080/alfresco/s/api/inspection/report/generate"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/get-open-findings.sample.json \
  "http://localhost:8080/alfresco/s/api/findings/open/query"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/get-prior-finding-flags.sample.json \
  "http://localhost:8080/alfresco/s/api/checklist/prior-findings/open"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/refresh-prior-finding-flags.sample.json \
  "http://localhost:8080/alfresco/s/api/checklist/prior-findings/refresh-flags"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @example/process-followups-by-files.sample.json \
  "http://localhost:8080/alfresco/s/api/inspection/import-canonical"

curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  --data @"example/FollowUp H-MDPPA0001-AVIS-001 01.json" \
  "http://localhost:8080/alfresco/s/api/follow-up/import"
```

## Smart folders (Share)

Templates (generated — see `tools/generate-smart-folder-templates.js`, do not hand-edit):

- `templates/pilot/vigilancia-pilot-template-base-comun.json`
- `templates/pilot/vigilancia-pilot-template-profile-idac.json`
- `templates/pilot/vigilancia-pilot-template-profile-indomet.json`
- `templates/pilot/vigilancia-pilot-template-profile-aeropuertos.json`

Operational map:

- `docs/smart-folders-operational-map.md`
- `docs/usoap-evidence-structure.md`

Apply template:

1. Ensure `smart.folders.enabled=true` in repository runtime config.
2. Upload template to `Repository/Data Dictionary/Smart Folder Templates`.
3. Set node type to `smf:smartFolderTemplate`.
4. Open `Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos`.
5. Add aspect `smf:systemConfigSmartFolder`.
6. Set selected template file in properties.

## Validation and smoke tests

- Model and behavioral validation guide: `docs/model-reload-validation-and-smoke-tests.md`
- REST curl examples: `docs/model-smoke-tests-rest-curl.md`
- Automated smoke script: `scripts/run-model-smoke-tests.sh`

Run script:

```bash
export BASE_URL="http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1"
export USERNAME="admin"
export PASSWORD="admin"
export PARENT_ID="REPLACE_WITH_PARENT_NODE_ID"

./scripts/run-model-smoke-tests.sh
# or
./scripts/run-model-smoke-tests.sh --cleanup
```

## Troubleshooting (common)

- Model changes not visible: restart repository container to reload model dictionary.
- Import script helper not picked up: ensure Web Script resources are reloaded or restart repository.
- Content store write errors in Docker bind mounts: verify mounted `data/alf_data/contentstore*` permissions match container runtime user/group.

## Licensing

This repository is licensed under Apache License 2.0.

- License text: `LICENSE`
- Required notice file: `NOTICE`
- Third-party/runtime dependency license manifest: `THIRD_PARTY_LICENSES.md`

Scope clarification:

- The Apache-2.0 license applies to original code and documentation in this repository.
- Third-party software used by this project (including container images pulled by `docker-compose.yml`) remains under each upstream project's own license terms.
- When redistributing this project, include this repository's `LICENSE` and `NOTICE`, and preserve required third-party notices.

## Contributing

Please review these documents before opening a Merge Request:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

1. Keep model (`configs/model`) and Web Script behavior (`webscripts`) aligned.
2. Update sample payloads in `example/` when contracts change.
3. Run smoke tests before merging changes.
4. Document behavior changes in `docs/`.
