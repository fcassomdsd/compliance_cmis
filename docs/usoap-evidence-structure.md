# USOAP Evidence Smart Folder Structure

## Objective

Provide an auditor-friendly navigation model for USOAP evidence using existing repository capabilities, without adding new aspects.

## Implemented template

The structure is implemented in:

- templates/usoap-evidence-smart-folder.json (deployed to the `Evidence` anchor under `Sites/vigilancia-de-la-so/documentLibrary/Datos/USOAP/` — confirmed live 2026-08-29, see `docs/smart-folders-operational-map.md`). A duplicate, `templates/vigilancia-smart-folders-pilot.json`, has been retired.

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

For manually/directly tagged nodes (not produced by the chain-derived import path), register:

1. CE in vso:usoapCriticalElement, and every applicable CE in vso:ceMapping (include the primary one too)
2. Area in vso:usoapAreaCode, and every applicable area in vso:areaMapping (include the primary one too)
3. Role in vso:evidenceRole
4. Support nature in vso:evidenceType
5. Reference to specific paragraph/article in title or content summary

Smart-folder navigation and the CE evidence report query `ceMapping`/`areaMapping`, not the single-valued fields — an entry missing from the mapping lists won't surface under its other applicable CE/area trees even if the primary field is set.

## Notes

1. Classifier nodes were kept without search queries; only leaf nodes execute queries.
2. Existing path scope remains fixed to the Vigilancia repository path used by the pilot templates.

## PQ tagging: citation-chain resolution (primary mechanism)

CE/area/PQ tags are resolved through a citation chain maintained in `atrocore-docker`, not by regex-matching free text:

```
UsoapProtocolQuestion (ICAO PQ, e.g. "PQ 7.035", CE, area)
      │ cites (many-to-many)
      ▼
AcapiteOACI (Annex paragraph)  ──belongsTo──▶ DocumentoOACI (ICAO Annex/document)
      │ hasMany
      ▼
Normativa (national regulation article)  ──belongsTo──▶ Reglamento (national regulation)
      │ many-to-many (NormativaProtocolQuestion)
      ▼
ProtocolQuestion (local checklist-question catalog)
```

`compliance_flow`'s Node-RED "getChecklistQuestion" flow resolves this chain for each checklist question and returns the matched PQ(s) — code, critical element, and area — as `reference.normativa.usoapPqReference` in the `/checklist` response. `compliance_checklist` carries that array through in the canonical checklist-item/finding export, and `compliance_cmis`'s `import-canonical-models.post.js` writes it onto the resulting `vso:checklistItem` node (and mirrors it onto any finding created against that item via `vso:checklistItemCode`) as `vso:usoapPqReference`, `vso:usoapCriticalElement`, `vso:usoapAreaCode`, `vso:ceMapping`, `vso:areaMapping`, with `vso:usoapTagSource = "Chain-derived"`.

This gives an exact checklist-item-to-PQ relationship (via the specific Annex paragraph and national regulation article actually cited), rather than a bulk area-level assignment.

### Evidence tag inheritance

`vso:evidenceItem` nodes do not go through the citation chain themselves — they inherit tags from the artifact they support, so an evidence file never needs its own PQ resolution:

- Evidence attached to a checklist item (`upsertEvidence`) is tagged directly from that item's `reference.usoapPqReference` (same call as the checklist item itself), via `applyChainDerivedUsoapTags`.
- Evidence attached to a follow-up report (`upsertFollowUpEvidence`) is tagged by copying the already-saved finding's `vso:usoapPqReference`/`vso:usoapCriticalElement`/`vso:usoapAreaCode`/`vso:ceMapping`/`vso:areaMapping`/`vso:usoapTagSource` properties directly (`inheritUsoapTags`), since the finding is always saved first.

Findings don't get their own evidence nodes — they reuse the checklist item's evidence via the `vso:relatedEvidence` association — so as long as the checklist item is tagged, its evidence is too. One known edge case: if a finding's `usoapPqReference` is explicitly overridden to differ from its checklist item's (rare — findings normally inherit the item's reference data), the shared evidence nodes still carry the *item's* tags, not the finding's override, mirroring the existing behavior for `icaoReference`/`nationalRegulation`/`regulationItem`.

### Multi-CE / multi-area membership

A single artifact can legitimately be relevant to more than one Critical Element or area — e.g. one Annex paragraph can be cited by both a CE-7 and a CE-8 Protocol Question. `vso:usoapCriticalElement` and `vso:usoapAreaCode` are single-valued "primary" fields (set from the first resolved PQ) and are not sufficient on their own to find all artifacts relevant to a given CE/area. The multi-valued `vso:ceMapping` and `vso:areaMapping` properties hold the *full* set and are what smart-folder navigation (`templates/usoap-evidence-smart-folder.json`, `templates/usoap-quality-control-smart-folder.json`) and `POST /api/usoap/ce-evidence-report` actually query against — an artifact tagged with both CE-7 and CE-8 will correctly surface under both CE trees/reports, not just the first one resolved.

### Direct/manual tagging

For PQs that apply to an entire document, checklist, or inspection rather than one specific checklist item, apply the `vso:usoapEvidenceContext` aspect directly to that node (it is a generic aspect, already attachable to any content node, and is addable — not mandatory — on `vso:inspection` and `vso:inspectionChecklist`). Set `vso:usoapTagSource = "Direct"` on manually-applied tags so reports can distinguish them from chain-derived ones.

### Retired: regex/bulk-area auto-population

The previous `POST /api/usoap/auto-populate-pq` webscript and its `configs/usoap-pq-mapping.json` lookup table (which matched free-text `vso:icaoReference` against ICAO Annex names and bulk-assigned every PQ in that Annex's area) have been removed. That mechanism could only relate a node to "some PQ in area X," never to a specific PQ — precisely the limitation the citation-chain mechanism above replaces. No production data depended on it.

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
    "gaps": [{"type":"finding","id":"H-MDPPA0001-SUR-001","gap":"Missing ICAO reference"}]
  },
  "byPq": {
    "PQ 7.035": [ { "type": "finding", "findingId": "...", ... } ]
  },
  "artifacts": [ ... ]
}
```

The `gaps` array flags artifacts missing ICAO references or evidence basis classification — useful for audit preparation quality control.
