# Domain rules — Nomenclatura, severity and follow-up vocabulary

`nomenclatura.spec.json` is the **single source of truth** for the platform's
cross-repo domain rules:

| Rule | Consumers |
|---|---|
| Document identifiers (SiteVisit `V-`, Activity `AV-`, Checklist `LV-`, Finding `H-`, CAP `P-`, Follow-up `S-`) | `compliance_web`, `compliance_import`, `compliance_checklist`, `compliance_cmis` |
| Severity → deadline baseline (`A`/`B`/`C` → 7/30/90 days) | `compliance_checklist`, `compliance_import`, (`compliance_web` queries AtroCore live) |
| Follow-up type vocabulary + `Progress Verification` legacy alias | `compliance_checklist`, `compliance_import`, `compliance_cmis` |
| Closure gate (`Closure Verification` + `effectivenessConfirmed=true`) | `compliance_import`, `compliance_cmis` |

`compliance_cmis` owns the Alfresco domain model, so the canonical copy of the
spec lives here. The other repositories **vendor a byte-identical copy** at
`domain-rules/nomenclatura.spec.json` — the six repositories are independent
git repositories with no shared package registry, so vendoring is the
supported way to single-source the rules.

## Keeping the copies in sync

From a checkout that contains the sibling repositories (the standard workspace
layout), run:

```bash
node scripts/domain-rules.mjs verify   # default: spec self-check + CMIS helper + copy drift
node scripts/domain-rules.mjs sync     # propagate the canonical file to every consumer
```

`verify` also runs in CI (the `validate:examples` job). CI checks out a single
repository, so the sibling-copy step prints a `SKIP` there; the per-repo
conformance tests (see below) still run in each repository's own pipeline.

## How each repository is pinned to the spec

- `compliance_web` — `server/domain/idFormats.cjs` and `src/utils/documentCodes.js`
  build their patterns from `spec.fragments`; `tests/server/domainRulesConformance.test.js`
  runs the shared vectors against both.
- `compliance_import` — `domain_rules.py` loads the spec and derives the id
  patterns, `SEVERITY_DAYS` and the follow-up vocabulary; the JSON schemas stay
  static and are pinned by `tests/test_domain_rules_conformance.py`.
- `compliance_checklist` — `src/utils/domainRules.js` loads the spec for the
  severity picker, the follow-up vocabulary and the session schema;
  `src/__tests__/domainRulesConformance.test.js` pins `app.config.json` and the
  Electron main-process mapping to it.
- `compliance_cmis` — the Rhino webscripts cannot read this file at runtime, so
  `scripts/domain-rules.js` executes `webscripts/common/vso-follow-up.lib.js`
  and asserts its builders and closure gate against the shared vectors.

## Changing a rule

1. Edit the canonical `nomenclatura.spec.json` and bump `version`.
2. Add or update `conformanceVectors` so the change is expressed as checked
   behaviour, not prose.
3. Run `node scripts/domain-rules.mjs verify`, then `sync`.
4. Commit the spec change in every repository (one MR each) together with any
   implementation change the vectors require.
