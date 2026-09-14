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
      │ many-to-many (NormativaChecklistQuestion)
      ▼
ChecklistQuestion (local checklist-question catalog; renamed from ProtocolQuestion in 2026-09 to disambiguate from UsoapProtocolQuestion)
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

### Derived tagging (automatic inheritance, no citation chain involved)

`vso:usoapTagSource = "Derived"` marks a tag the system computed automatically from a *related* node's own classification, as opposed to `"Chain-derived"` (resolved via the Annex-to-checklist-item citation chain above) or `"Direct"` (a human explicitly picked values via `POST /api/usoap/direct-tag`). Two cases, both implemented in `compliance_web` (not this repo) at node-creation time, since that's the layer with access to both Alfresco and the AtroCore catalogs these derivations need:

- **A CAP inherits its finding's tags verbatim.** A corrective action addresses the exact same compliance issue as its finding, so `vso:usoapCriticalElement`/`vso:usoapAreaCode`/`vso:usoapPqReference`/`vso:ceMapping`/`vso:areaMapping` are copied unchanged onto the CAP node when it's created (`server/domain/usoapTagPayload.cjs`, applied in `server/caps/router.cjs`'s `performCapCreate`).
- **A follow-up report derives its CE-8 PQ from its finding's area.** A follow-up isn't evidence for the finding's *original* PQ — it's evidence for whichever CE-8 ("resolution of safety concerns") PQ applies to that finding's area, e.g. an AGA-specialty finding's follow-ups resolve to PQ 8.048, an ATS-specialty finding's to PQ 7.199. This is looked up against the `UsoapEvidenceExpectation` catalog's `CAPExecution` rows (`atrocore-docker`) by the finding's `specialtyCode`, in `server/findings/usoapFollowUpTag.cjs`, applied in `server/findings/router.cjs`'s follow-up-creation route. If no catalog row matches the finding's specialty, the follow-up is simply created untagged rather than guessing.

Neither path goes through `POST /api/usoap/direct-tag` (that endpoint always writes `"Direct"`) or through the citation-chain import path (that always writes `"Chain-derived"`) — `"Derived"` is written directly via a plain Alfresco node-properties/aspect payload at creation time.

### Direct/manual tagging

For PQs that ask examiners to look at one specific, identifiable whole-artifact document — an aerodrome/SMS manual, a license or personnel file, an oversight plan, an aerodrome dossier — rather than one checklist item, apply the `vso:usoapEvidenceContext` aspect directly to that node via `POST /api/usoap/direct-tag`. The aspect is generic and already attachable to any content node; this endpoint is what actually wires up the previously-manual-only "Direct" tag source with validation and a node-type allow-list.

```bash
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{
        "nodeId": "12345678-90ab-cdef-1234-567890abcdef",
        "criticalElement": "CE-6",
        "areaCode": "AGA",
        "ceMapping": ["CE-6"],
        "areaMapping": ["AGA"],
        "pqReferences": ["PQ 8.111", "PQ 8.115"],
        "evidenceBasis": "Oversight Record"
      }' \
  "http://localhost:8080/alfresco/s/api/usoap/direct-tag"
```

`nodeId` accepts either a bare node UUID or a full `workspace://SpacesStore/<uuid>` nodeRef. At least one of `criticalElement`, `areaCode`, `ceMapping`, `areaMapping`, or `pqReferences` is required; each value (including `evidenceBasis`, if given) is validated against the same `vso:ceList`/`vso:usoapAreaList`/`vso:usoapEvidenceBasisList` constraint lists and PQ-code pattern (`PQ \d{1,2}\.\d{3}`) the model itself enforces — invalid values return `400` rather than being silently accepted (or, previously, rejected only at save time with an opaque Alfresco integrity-violation error).

The endpoint only accepts a fixed node-type allow-list, checked via `node.isSubType(...)` against `vso:inspectionChecklist`, `vso:inspection`, `vso:correctiveAction`, `vso:followUpReport`, `cm:content` (plain documents — manuals, licenses, training/personnel records, aerodrome dossiers), plus the chain-derived leaf types (`vso:checklistItem`, `vso:evidenceItem`, `vso:finding`) for idempotent re-tagging/correction. Any other node type is rejected with `400`. Note that `cm:content` is Alfresco's base content type, so this allow-list entry is intentionally broad — it permits any content subtype, including out-of-box system content types (e.g. `cm:dictionaryModel`), relying on normal Alfresco ACLs/permissions rather than this webscript to restrict who can write where; in practice only documents intentionally surfaced by the `compliance_web` UI's tagging feature get tagged this way. `vso:usoapTagSource` is always set to `"Direct"` by this endpoint — it can never be used to write `"Chain-derived"` tags, which remain exclusively the canonical-import path's responsibility. `vso:correctiveAction` and `vso:followUpReport` stay in the allow-list even though they're now tagged automatically at creation time (see "Derived tagging" above) — this remains the manual override/correction path for the rare case a CAP's finding had no tags to inherit, or a follow-up's finding's specialty has no matching `UsoapEvidenceExpectation` row to derive from.

The tagging logic itself (`applyDirectUsoapTags`, plus the validation helpers `isValidCe`/`isValidArea`/`isValidPqCode`/`isDirectTagAllowedType`) lives in `webscripts/common/vso-usoap-tags.lib.js`, alongside `applyChainDerivedUsoapTags`/`inheritUsoapTags` — the same shared library the canonical-import webscript uses, so both tagging paths stay in lockstep as required by the citation-chain consistency rule above.

Direct-tagged whole-artifacts surface automatically in the existing `Evidence`/`QC` smart folders once tagged — those folders already query on `ceMapping`/generic USOAP-aspect presence, so no new smart-folder template is needed (see `docs/smart-folders-operational-map.md`).

### Type-2 (sampled population) resolution

Some PQ guidance doesn't point at one identifiable document at all — it asks the examiner to sample across a *population* of artifacts ("muestra de listas de verificación," "muestra de informes de inspección/auditoría," "seguimiento de la ejecución de los planes de medidas correctivas"). Tagging every document in that population individually doesn't scale and isn't what the guidance means, so these PQs are resolved by live query instead, against a catalog of expectations:

- `atrocore-docker`'s `UsoapEvidenceExpectation` entity records, per PQ, which artifact category ICAO guidance expects sampled (`Checklist`, `InspectionReport`, `AuditReport`, `CAPExecution`, `TrainingRecord`, `PersonnelFile`, `Manual`, `License`, `OversightPlan`, `AerodromeDossier`), plus CE/area/specialty scope and an optional date-range hint. It is queryable via the generic Node-RED passthrough (`/queryEntity?entity=UsoapEvidenceExpectation`) — no dedicated flow was needed.
- `compliance_cmis` stays stateless with respect to AtroCore: `POST /api/usoap/ce-evidence-report` accepts an optional `populationQueries` array (see below) that the caller — `compliance_web`, which owns the catalog — builds from those expectation rows, and this webscript only resolves the Alfresco-side candidate documents for each one.

`resolvePopulationCandidates()` maps `artifactCategory` to an Alfresco `TYPE:` predicate (`Checklist` → `vso:inspectionChecklist`; `InspectionReport`/`AuditReport` → `vso:inspection`; `CAPExecution` → `vso:correctiveAction` OR `vso:followUpReport`; everything else → plain `cm:content`, since manuals/licenses/training/personnel records/oversight plans/aerodrome dossiers have no dedicated content type today), optionally narrowed by a `cm:modified` date range derived from `monthsBack`, and returns up to 50 candidate nodes plus a total count. A `candidateCount` of `0` adds a `"population"`-type entry to the report's `gaps` array.

**Every query is scoped to `Sites/vigilancia-de-la-so/documentLibrary`** (`ANCESTOR:` on the site's document library root node, resolved via `companyhome.childByNamePath(...)` — the same idiom `webscripts/common/vso-paths.lib.js` uses, not a hand-built Lucene `PATH:` expression, since that would require ISO9075-encoding every accented/space-containing folder name). Without this, `cm:content`-fallback categories previously matched anything of that base type anywhere in the repository — Data Dictionary content models (`vsoModel.xml`), Smart Folder Template JSON, the `swsdp` sample site's discussion posts and data lists, stray import-debug JSON files — none of which is oversight evidence.

For the six categories with no dedicated Alfresco type (`TrainingRecord`, `PersonnelFile`, `Manual`, `License`, `OversightPlan`, `AerodromeDossier`), the query is narrowed further to the specific folder(s) that actually hold that category's evidence in the live instance (`POPULATION_CATEGORY_FOLDERS`, e.g. `Manual` → `Documentos/Manuales externos`, `OversightPlan` → `Vigilancia/Planificacion anual`, `TrainingRecord` → `Capacitacion y competencia/Registros de capacitacion` + `.../Programas y planes de capacitacion`). `License` has no dedicated folder in this instance yet and is scoped to the closest existing parent (`Documentos`) as a documented gap — a `candidateCount` of `0` there reflects that no such folder/document exists yet, not a broken query. The response's `scopedFolders` field on each `sampledPopulations` entry reports which folder(s) were actually used, for transparency.

`Vigilancia/Datos de campo` is deliberately never used as a population-query scope for any category: it holds canonical field-collection data that already exists in final, typed form elsewhere (`vso:checklistItem`, `vso:evidenceItem`, `vso:finding` — all queried directly by type in `loadArtifactsByCe`) and its raw contents are not USOAP-tagged, so including it would reintroduce untagged, already-represented noise into a sampled-population result.

`specialtyCode`, when supplied, is only applied as a Lucene filter (`@vso\:specialtyCode`, now correctly split into an OR-clause for comma-separated values, e.g. a PQ applicable to `"AIM,ATS,COM"`) for the four categories backed by real `vso:` types, which always carry `vso:serviceContext`/`vso:specialtyCode` from creation. It is *not* applied for the `cm:content`-fallback categories: those are plain, often-untagged documents (manuals, training records) that never carry `vso:specialtyCode` unless someone has explicitly added the aspect, so filtering on it there silently zeroed out real candidates rather than narrowing them — folder scoping is the relevance signal for those categories instead.

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

# Report for CE-7 including Type-2 (sampled-population) resolution:
curl -u admin:admin -X POST \
  -H "Content-Type: application/json" \
  -d '{
        "ce": "CE-7",
        "year": "2026",
        "populationQueries": [
          {"pqCode": "PQ 8.403", "artifactCategory": "OversightPlan", "specialtyCode": "AGA", "monthsBack": 24}
        ]
      }' \
  "http://localhost:8080/alfresco/s/api/usoap/ce-evidence-report"
```

### Year filtering

`year` narrows every artifact type by the date that type actually carries. Findings use `vso:dateIssued` and evidence items use `vso:collectionDate`; those are pushed into the query as AFTS date-range clauses.

Checklist items have **no date property of their own** — a checklist item is dated by the inspection it belongs to. The webscript walks from the item up to its nearest `vso:inspection` ancestor (item → checklist document → specialty folder → inspection folder) and uses that inspection's `vso:startDate`, falling back to `vso:endDate`. Because that value lives on an ancestor rather than on the item, this filter is applied in the webscript after the query, and an item whose inspection records no window is omitted from a year-filtered report (it is still returned when `year` is omitted).

Do not add an item-level date property to the content model to make this filter pushable: the inspection window is the single source of truth for everything filed under it.

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
    "gaps": [
      {"type":"finding","id":"H-MDPPA0001-SUR-001","gap":"Missing ICAO reference"},
      {"type":"population","pqCode":"PQ 8.403","gap":"No candidate documents found in expected population"}
    ]
  },
  "byPq": {
    "PQ 7.035": [ { "type": "finding", "findingId": "...", ... } ]
  },
  "artifacts": [ ... ],
  "sampledPopulations": [
    {
      "pqCode": "PQ 8.403",
      "artifactCategory": "OversightPlan",
      "candidateCount": 3,
      "candidates": [ { "nodeRef": "workspace://SpacesStore/...", "name": "...", "path": "...", "modifiedAt": "..." } ],
      "scopedFolders": ["Vigilancia/Planificacion anual"]
    }
  ]
}
```

The `gaps` array flags artifacts missing ICAO references or evidence basis classification, or Type-2 PQs whose expected population resolved zero candidates — useful for audit preparation quality control. `sampledPopulations` is only present in the response when the request included `populationQueries` — omitting it preserves the exact response shape this endpoint had before Type-2 support existed.
