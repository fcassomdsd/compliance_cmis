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
- `configs/share/`: Share form and UI configuration.
- `configs/messages/`: labels for model fields and associations.
- `webscripts/`: API endpoints and shared helpers.
- `example/`: ready-to-run sample request payloads.
- `templates/`: FODT templates and smart folder templates.
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

| Endpoint | Purpose | Required fields (minimum) | Common optional fields | Example payload file |
|---|---|---|---|---|
| `POST /inspection/generate` | Generate inspection plan document from template | Contract depends on inspection plan payload; use sample as baseline | `inspectionsPath`, `destinationPath`, `templatePath` | `example/generate-inspection-plan.sample.json` |
| `POST /inspection/report/generate` | Generate inspection report and support derived findings path | Contract depends on report payload; use sample as baseline | report generation options embedded in payload | `example/generate-inspection-report.sample.json`, `example/generate-inspection-report-mdpp001-vig.sample.json` |
| `POST /inspection/import-canonical` | Import canonical follow-up data by file names or ids | Either `followUpFiles` or `followUpIds`, or array of follow-up file names | `sourceBasePath`, `sourceSpecialtyFolderName`, `specialtyFolderName` | `example/process-followups-by-files.sample.json` |
| `POST /follow-up/import` | Upsert one follow-up report and optionally close finding | `followUpReport.findingId`, `followUpReport.followUpDate`, `followUpReport.followUpType` | `capId`, `followUpId`, `percentComplete`, `effectivenessConfirmed`, context ids | `example/FollowUp MDPP-VIG-2025-02 CAP-10.json` |
| `POST /findings/open/query` | Query open findings by location and specialty context | one of `locationId/locationCode/icaoCode` and one of `specialtyId/specialtyCode/domain` | `skipCount`, `maxItems` | `example/get-open-findings.sample.json` |
| `POST /checklist/prior-findings/open` | Get checklist items with open prior findings | `inspectionId` or `inspectionCode`, plus `specialtyId` or `specialtyCode` or `domain` | `refreshBeforeQuery`, `refreshDryRun`, `priorOnly` | `example/get-prior-finding-flags.sample.json` |
| `POST /checklist/prior-findings/refresh-flags` | Recompute and persist prior-finding flags | `inspectionId` or `inspectionCode`, plus `specialtyId` or `specialtyCode` or `domain` | `dryRun`, `priorOnly` | `example/refresh-prior-finding-flags.sample.json` |

Notes:

- For `POST /follow-up/import`, finding closure is allowed only with `followUpType="Closure Verification"` and `effectivenessConfirmed=true`.
- For `POST /inspection/import-canonical`, evidence files linked to processed follow-ups are moved into finding-scoped evidence folders.
- For `POST /inspection/report/generate`, checklist summary specialty now resolves from item, checklist, domain, and inspection context (in that order) before falling back to item-code prefix (for example `VIG-0048` -> `VIG`).

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
  --data @example/generate-inspection-report-mdpp001-vig.sample.json \
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
  --data @"example/FollowUp MDPP-VIG-2025-02 CAP-10.json" \
  "http://localhost:8080/alfresco/s/api/follow-up/import"
```

## Smart folders (Share)

Templates:

- `templates/vigilancia-datos-smart-folders.json`
- `templates/vigilancia-datos-smart-folders-bucketed.json`

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
