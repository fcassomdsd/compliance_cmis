# Smart Folders Pilot - Operational Map

## Objective

Define a clear and reusable deployment map for smart-folder templates in the Vigilancia site, aligned with provider specialty applicability.

## Source of truth: the generator, not hand-edited JSON

All four templates below (`base-comun` + the 3 provider profiles) are **generated**, not hand-maintained — see `tools/generate-smart-folder-templates.js` and its input catalog `tools/smart-folder-catalog.json`. The catalog is the single source of truth for provider IDs, specialty codes, and locations; the tables in this document (Specialty catalog, Provider assignment map) should match it exactly — update the catalog first, then regenerate (`node tools/generate-smart-folder-templates.js`), then update this doc to match, not the other way around.

Two consequences of generating rather than hand-editing:
- **Governance rule 3 (below) is now enforced by construction**: a node is either a leaf with a `search` block, or a classifier with `nodes` — never both — so the "classifier nodes must not run searches" rule can't drift out of sync by hand.
- **These templates deliberately don't do cross-cutting counting/trend browsing** (status, risk, severity, acceptance-status, year-over-year breakdowns). That analysis now lives in `compliance_web`'s oversight posture dashboard (`GET /api/reports/oversight-posture`), which answers those questions with live counts and arbitrary date ranges — something a pre-baked folder tree structurally can't do well. These templates are scoped to what Smart Folders are actually good at: browsing to a specific, known document by object type, provider, and specialty (and, for `base-comun`, location).

## Templates and roles

1. `templates/pilot/vigilancia-pilot-template-base-comun.json`
   - Shared navigation for all users, organized by location (`Por localidad`) for Inspecciones and Hallazgos, plus `Seguimientos → Por tipo`.
   - No provider profile filtering.

2. `templates/pilot/vigilancia-pilot-template-profile-sna.json`
   - Provider profile: IDAC (SNA set).
   - Provider ID: `a01k5q8tb0reenryr2y0m9ysxhd`.
   - Allowed specialties: VIG, COM, RNA, ATS, SAR, FIS, AIM, ECNS, EMET, P/OPS.
   - Single-provider profile — no `Por proveedor` branch (it would just duplicate `General`).

3. `templates/pilot/vigilancia-pilot-template-profile-met.json`
   - Provider profile: INDOMET (MET only).
   - Provider ID: `a01k5qj6xvce87vz90yxa59exh2`.
   - Allowed specialty: MET-AD.
   - Single-provider profile — no `Por proveedor` branch, same reasoning as SNA.

4. `templates/pilot/vigilancia-pilot-template-profile-aga.json`
   - Provider profile: AGA-only providers.
   - Provider IDs:
     - `a01k5qj6xv8efy8m51y28jm3w5t`
     - `a01k5qj6xvfee7vk1dh5y0s3qba`
     - `a01k5qj6xvjefy8e06qej7rsbce`
     - `a01k5qj6xvne95vzxjt37f6k1br`
   - Allowed specialties: PAV, FAU, PTFM, SSEI, AYVIS.
   - Multi-provider profile — each functional section has both `General` (all four providers combined) and `Por proveedor` (one specific provider), each with a `Por especialidad` breakdown; `Seguimientos` additionally has a flat `Por tipo`.

## Specialty catalog by area

| Code | Name | Area |
| --- | --- | --- |
| VIG | Sistemas de Vigilancia | SNA |
| COM | Comunicaciones de Radio | SNA |
| RNA | Radioayudas a la Navegacion | SNA |
| PAV | Gestion de Pavimento y Caracteristicas Fisicas | AGA |
| FAU | Control de Fauna Silvestre | AGA |
| PTFM | Gestion de Plataformas | AGA |
| SSEI | Servicios de Salvamento y Extincion de Incendios | AGA |
| ATS | Control de Transito Aereo | SNA |
| MET-AD | Meteorologia Aeronautica | MET |
| SAR | Busqueda y Salvamento | SNA |
| FIS | Servicio de Informacion Aeronautica | SNA |
| AIM | Gestion de informacion aeronautica | SNA |
| ECNS | Energia CNS | SNA |
| EMET | Equipos Meteorologicos | SNA |
| AYVIS | Ayudas Visuales | AGA |
| P/OPS | PANS/OPS | SNA |

## Folder-to-template mapping matrix

Use one physical anchor folder per template under:

`Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos`

| Anchor folder (physical) | Template file | Purpose |
| --- | --- | --- |
| `00-Base-Comun` | `vigilancia-pilot-template-base-comun.json` | Shared operational dashboards and transversal navigation |
| `10-Perfil-IDAC-SNA` | `vigilancia-pilot-template-profile-sna.json` | IDAC views with SNA-only specialties |
| `20-Perfil-INDOMET-MET` | `vigilancia-pilot-template-profile-met.json` | INDOMET views with MET-AD-only specialty |
| `30-Perfil-AGA-RESTO` | `vigilancia-pilot-template-profile-aga.json` | AGA-only views for remaining providers |

## Provider assignment map

| Provider | Profile template | Scope |
| --- | --- | --- |
| IDAC | `vigilancia-pilot-template-profile-sna.json` | SNA set |
| INDOMET | `vigilancia-pilot-template-profile-met.json` | MET-AD only |
| AERODOM | `vigilancia-pilot-template-profile-aga.json` | AGA only |
| AMS-CRC | `vigilancia-pilot-template-profile-aga.json` | AGA only |
| G-Punta Cana | `vigilancia-pilot-template-profile-aga.json` | AGA only |
| AIC | `vigilancia-pilot-template-profile-aga.json` | AGA only |

## Live-instance verification (2026-08-29)

Checked the running instance directly (searched for nodes carrying the `smf:systemConfigSmartFolder` aspect, then resolved each anchor's `smf:system-template-location` to a file) rather than assuming this document's mapping matrix reflects reality. Findings:

- **The `00-Base-Comun`/`10-Perfil-IDAC-SNA`/`20-Perfil-INDOMET-MET`/`30-Perfil-AGA-RESTO` anchors described above do not exist in the running instance.** Only **two** Smart Folder anchors are actually configured, both under `Sites/vigilancia-de-la-so/documentLibrary/Datos/USOAP/` (not `.../Vigilancia/Datos/` as this document's deployment procedure describes):
  - `Evidence` → `templates/usoap-evidence-smart-folder.json`
  - `QC` → `templates/usoap-quality-control-smart-folder.json`
- The four `templates/pilot/*.json` provider-profile templates described above are real, generated, checked-in files, but **are not deployed to any live anchor** — this section of the document describes an intended/planned deployment, not the current one. Treat the "Templates and roles" / "Folder-to-template mapping matrix" sections above as a deployment plan to execute, not a description of what's live today.
- This resolves the "Known duplication" question below.

## USOAP Smart Folders (the ones actually live)

Two templates, deployed under `Sites/vigilancia-de-la-so/documentLibrary/Datos/USOAP/`, implementing the CE×area USOAP navigation described in `docs/usoap-evidence-structure.md`:

- **`Evidence` anchor → `templates/usoap-evidence-smart-folder.json`.** Per-CE (CE-1...CE-8) and per-area evidence browsing, plus a "Control de calidad" branch per CE/area (evidence without an attachment, without a specific regulatory reference, or without minimum classification).
- **`QC` anchor → `templates/usoap-quality-control-smart-folder.json`.** A global (not per-CE) cross-cutting quality-control tree, scoped to anything under the Vigilancia site with a `vso:ceMapping` value set: items missing PQ assignment, missing evidence basis, findings missing an ICAO/SARPs reference, and findings missing a national-regulation reference. Complements the `Evidence` anchor's per-CE QC branches with one global view.

## Deployment procedure (Share)

1. Upload all four JSON files into `Repository/Data Dictionary/Smart Folder Templates`.
2. For each uploaded JSON, set type `smf:smartFolderTemplate`.
3. Create the four physical anchor folders under `Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos`.
4. For each anchor folder, add aspect `smf:systemConfigSmartFolder`.
5. On each anchor folder, set the corresponding template file according to the matrix above.
6. Open each anchor folder and validate that only leaf nodes return results (classifier nodes must not run searches).

## Governance rules

1. Specialty applicability is enforced by profile template definition.
2. Do not add non-applicable specialties to profile templates.
3. Keep parent classifier nodes without `search`; only leaves can contain `search`.
4. Keep the fixed PATH scope currently used by pilot templates unless a controlled migration to dynamic scope is approved.

## Change management

1. Changes to providers, specialties, or locations go into `tools/smart-folder-catalog.json` first, then run `node tools/generate-smart-folder-templates.js` to regenerate the four templates — do not hand-edit `templates/pilot/*.json` directly. Update this document's tables (Specialty catalog, Provider assignment map) to match the catalog in the same change.
2. If a provider changes profile, update the catalog's `profiles` entries and the provider assignment map together.
3. After any catalog/template change: the generator's own self-checks (no `search` on classifier nodes, no query referencing a provider/specialty/location id not in the catalog) run automatically and abort the write on failure; also re-run `npm run lint` and spot-check in Share before deployment.

## Retired templates

- `templates/vigilancia-datos-smart-folders.json` and `templates/vigilancia-datos-smart-folders-bucketed.json` have been removed. Neither was part of this operational map's anchor-folder model, and both were fully superseded in function by the four templates above (the bucketed file's location/provider/specialty browsing is now covered by `base-comun` + the profile templates; its status/risk/acceptance breakdowns are covered by `compliance_web`'s oversight posture dashboard).
- `templates/vigilancia-smart-folders-pilot.json` has been removed (2026-08-29). It duplicated `templates/usoap-evidence-smart-folder.json`'s CE×area USOAP evidence navigation; live-instance verification (see above) confirmed `usoap-evidence-smart-folder.json` is the one actually wired to the `Evidence` anchor, so the pilot copy was the unused duplicate.

## Known duplication needing reconciliation

Resolved 2026-08-29 — see "Live-instance verification" above. `templates/usoap-evidence-smart-folder.json` is the deployed one; the duplicate (`templates/vigilancia-smart-folders-pilot.json`) has been retired.
