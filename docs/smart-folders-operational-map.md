# Smart Folders Pilot - Operational Map

## Objective

Define a clear and reusable deployment map for smart-folder templates in the Vigilancia site, aligned with provider specialty applicability.

## Templates and roles

1. `templates/pilot/vigilancia-pilot-template-base-comun.json`
   - Shared navigation for all users.
   - Includes common views for inspections, findings, and follow-ups.
   - No provider profile filtering.

2. `templates/pilot/vigilancia-pilot-template-profile-sna.json`
   - Provider profile: IDAC (SNA set).
   - Provider ID: `a01k5q8tb0reenryr2y0m9ysxhd`.
   - Allowed specialties: VIG, COM, RNA, ATS, SAR, FIS, AIM, ECNS, EMET, P/OPS.
   - Includes `Por proveedor` under each main section for structural homogeneity.

3. `templates/pilot/vigilancia-pilot-template-profile-met.json`
   - Provider profile: INDOMET (MET only).
   - Provider ID: `a01k5qj6xvce87vz90yxa59exh2`.
   - Allowed specialty: MET-AD.
   - Includes `Por proveedor` under each main section for structural homogeneity.

4. `templates/pilot/vigilancia-pilot-template-profile-aga.json`
   - Provider profile: AGA-only providers.
   - Provider IDs:
     - `a01k5qj6xv8efy8m51y28jm3w5t`
     - `a01k5qj6xvfee7vk1dh5y0s3qba`
     - `a01k5qj6xvjefy8e06qej7rsbce`
     - `a01k5qj6xvne95vzxjt37f6k1br`
   - Allowed specialties: PAV, FAU, PTFM, SSEI, AYVIS.
   - Each functional section uses `General` and `Por proveedor`.
   - `General` includes `Este año`, `Año pasado` and `Por especialidad`; in `Hallazgos` it also includes `Por estado` and `Por riesgo`, and in `Seguimientos` it also includes `Por tipo`.
   - Each `Por especialidad` node contains only leaf specialty nodes.

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

1. Changes that affect all users go first into `base-comun`.
2. Profile-specific changes must be applied only to the corresponding profile template.
3. If a provider changes profile, update only the provider assignment map and the affected template filters.
4. After any template change, run JSON validation and classifier-search validation before deployment.
