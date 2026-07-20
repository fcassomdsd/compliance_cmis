# USOAP Evidence Smart Folder Structure

## Objective

Provide an auditor-friendly navigation model for USOAP evidence using existing repository capabilities, without adding new aspects.

## Implemented template

The structure was implemented in:

- templates/vigilancia-smart-folders-pilot.json

Main tree:

1. Evidencia USOAP
2. Elemento critico
3. CE-1 ... CE-8
4. For each CE:
   - General
   - Por area

For each General and each Area node:

1. Todo con contexto USOAP
2. Pendiente de rol de evidencia
3. Pendiente de tipo de sustento
4. Por rol de evidencia
5. Por tipo de sustento
6. Control de calidad

Control de calidad includes:

1. Evidencia sin adjunto
2. Evidencia sin referencia normativa puntual
3. Evidencia sin clasificacion minima

## Role grouping

Por rol de evidencia uses vso:evidenceRole values:

1. Compliance Evidence
2. Finding Support
3. Progress Evidence
4. Closure Evidence

## Support type grouping

Por tipo de sustento uses vso:evidenceType values:

1. Regulatory Requirement
2. State Certification/Approval
3. Oversight Activity Evidence

These values are not constrained in the model, so they must be used consistently by operational convention.

## Why this helps for USOAP

1. One source document can support multiple CE and multiple areas by creating separate evidence entries per assertion.
2. Auditor navigation is direct by CE and area, and then by proof role or proof nature.
3. Pending-quality folders quickly show evidence missing role or support classification metadata.
4. Quality-control folders quickly surface weak evidence records before the audit session.

## Quality-control criteria

1. Evidencia sin adjunto:
   - Filters `TYPE:"vso:evidenceItem"` records without `cm:content.size`.
2. Evidencia sin referencia normativa puntual:
   - Filters `TYPE:"vso:evidenceItem"` records missing both `vso:icaoReference` and `vso:nationalRegulation`.
3. Evidencia sin clasificacion minima:
   - Filters `TYPE:"vso:evidenceItem"` records missing `vso:evidenceRole` or `vso:evidenceType`.

## Data-entry convention

For each evidence assertion, register:

1. CE in vso:usoapCriticalElement
2. Area in vso:usoapAreaCode
3. Role in vso:evidenceRole
4. Support nature in vso:evidenceType
5. Reference to specific paragraph/article in title or content summary

## Notes

1. Classifier nodes were kept without search queries; only leaf nodes execute queries.
2. Existing path scope remains fixed to the Vigilancia repository path used by the pilot templates.

## Auto-population webscript

A webscript at `POST /api/usoap/auto-populate-pq` reads existing `vso:icaoReference` values on findings, evidence items, and checklist items, matches them against the ICAO Annex → CE/PQ lookup table (`configs/usoap-pq-mapping.json`), and auto-populates `vso:ceMapping`, `vso:usoapPqReference`, `vso:usoapCriticalElement`, and `vso:usoapAreaCode`.

### Usage

```bash
# Auto-populate all findings across all inspections:
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "http://localhost:8080/alfresco/s/api/usoap/auto-populate-pq"

# Auto-populate findings for a specific inspection:
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{"inspectionCode": "MDPP-001"}' \
  "http://localhost:8080/alfresco/s/api/usoap/auto-populate-pq"

# Dry run (no changes, only preview):
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}' \
  "http://localhost:8080/alfresco/s/api/usoap/auto-populate-pq"
```

### Mapping file

The lookup table at `configs/usoap-pq-mapping.json` maps ICAO Annex references to Critical Elements and areas. To update the mapping:
1. Upload the updated JSON file to the repository
2. Re-run the webscript

## CE Evidence Report webscript

A webscript at `POST /api/usoap/ce-evidence-report` queries all artifacts (findings, evidence items, checklist items) tagged with a specific Critical Element, groups them by Protocol Question and area, and produces a structured report suitable for audit preparation or FODT template rendering.

### Usage

```bash
# Report for CE-7, all years:
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{"ce": "CE-7"}' \
  "http://localhost:8080/alfresco/s/api/usoap/ce-evidence-report"

# Report for CE-5, current year only:
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{"ce": "CE-5", "year": "2026"}' \
  "http://localhost:8080/alfresco/s/api/usoap/ce-evidence-report"
```

### Response structure

```json
{
  "success": true,
  "ce": "CE-7",
  "year": "2026",
  "timestamp": "2026-07-19T...",
  "summary": {
    "total": 156,
    "byType": { "finding": 43, "evidence": 89, "checklistItem": 24 },
    "byPq": { "PQ 7.035": 18, "PQ 7.101": 12, "Sin PQ": 7 },
    "byArea": { "CNS": 52, "ATS": 48, "AGA": 34, "Sin area": 22 },
    "gaps": [{"type":"finding","id":"MDPP001-VIG-01","gap":"Missing ICAO reference"}]
  },
  "byPq": {
    "PQ 7.035": [ { "type": "finding", "findingId": "...", ... } ]
  },
  "artifacts": [ ... ]
}
```

The `gaps` array flags artifacts missing ICAO references or evidence basis classification — useful for audit preparation quality control.
