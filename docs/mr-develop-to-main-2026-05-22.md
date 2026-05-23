## Summary

Merge `develop` into `main` for the May 22, 2026 release.

- Source branch: `release/2026-05-22-develop-to-main`
- Target branch: `main`
- Base comparison: `origin/main..origin/develop`
- Included commits: 39

## Scope of Changes

1. Governance and compliance readiness
- Added and aligned project governance files (`LICENSE`, `NOTICE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`).

2. Model and API consistency
- Updated canonical model import and related webscripts to follow schema-aligned contracts.
- Unified identifier and mapping behavior across inspection, checklist, finding, and follow-up entities.
- Standardized key field naming in model and payload mappings.

3. Functional enhancements
- Added follow-up import/processing flows and shared helper support.
- Added finding query and prior-finding flag endpoints and examples.

4. Operational/tooling improvements
- Upgraded Traefik to v3.6.
- Added model reload validation and smoke-test support docs/scripts.

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for release notes.

## Validation Performed

1. Branch synced from latest `develop` before cut.
2. Delta reviewed against `main` (39 commits).
3. Release notes prepared in `CHANGELOG.md`.

## Risk Assessment

### Medium
- Data model/mapping standardization may impact existing integrations that rely on older field names.
- Schema alignment changes may reject payloads that previously passed with looser validation.

### Low
- Governance/documentation additions are non-runtime.
- Traefik update risk is low with existing compose setup, but should still be smoke-tested.

## Post-Merge Checklist

1. Run model reload and smoke tests from `docs/model-reload-validation-and-smoke-tests.md`.
2. Execute key webscript flows:
- canonical checklist/finding import
- follow-up import/process endpoints
- finding-query and prior-finding-flags
3. Confirm compose stack starts cleanly and reverse proxy routes behave as expected.

## Rollback Plan

1. Revert merge commit from `main` if blocking regressions are detected.
2. Restore previous container/image tags if infrastructure behavior regresses after Traefik changes.
3. Re-run smoke tests to confirm rollback health.
