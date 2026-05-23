# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning principles.

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
