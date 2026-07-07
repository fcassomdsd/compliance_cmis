# Contributing Guide

Thank you for considering contributing to compliance-CMIS.
We welcome contributions of all sizes, from documentation improvements to model and endpoint enhancements.

Please read CODE_OF_CONDUCT.md before contributing.

## 1. Branch workflow

This repository follows a main/develop model:

- `main`: stable and production-ready.
- `develop`: active development branch. Open Merge Requests against this branch unless maintainers specify otherwise.
- `feature/*`: new features, for example `feature/add-follow-up-validation`.
- `fix/*`: bug fixes, for example `fix/follow-up-id-format`.
- `hotfix/*`: urgent production fixes, for example `hotfix/repository-startup-fix`.

Example feature workflow:

```bash
# 1) Start from develop
git checkout develop
git pull

# 2) Create your branch
git checkout -b feature/awesome-improvement

# 3) Commit with Conventional Commits
# work...
git commit -m "feat: add awesome improvement"

# 4) Push
git push origin feature/awesome-improvement
```

Then open a Merge Request targeting `develop`.

## 2. Code style and tooling

Consistency is key.

- Follow existing project style and naming patterns.
- Keep model, webscripts, and docs aligned when changing behavior.
- Use ESLint configuration present in the repository where applicable.

### ESLint

Run before committing changes to Web Scripts:

```bash
npm run lint
```

Auto-fix common warnings:

```bash
npm run lint:fix
```

### resolveVsoPaths() consistency

Web Scripts that need Alfresco folder paths include a local `resolveVsoPaths()` function with an `importScript()` fallback to the shared library in `webscripts/common/vso-paths.lib.js`. This is by design — each Web Script is self-contained and degrades gracefully.

When you change folder paths or routing, update ALL copies of `resolveVsoPaths()` (3 files). Then run the verification script:

```bash
bash scripts/verify-resolve-paths.sh
```

This checks that key path patterns are consistent across every Web Script that has a `resolveVsoPaths()` definition.

### Conventional Commits

Use Conventional Commits for clear change history.

| Type | When to use | Example |
|---|---|---|
| `feat:` | New feature | `feat: add follow-up closure validation` |
| `fix:` | Bug fix | `fix: correct follow-up id normalization` |
| `chore:` | Tooling/maintenance | `chore: update smoke test docs` |
| `docs:` | Documentation only | `docs: clarify quick start` |
| `test:` | Test additions/updates | `test: add smoke check for follow-up import` |
| `refactor:` | Internal code change without behavior change | `refactor: simplify follow-up helper usage` |

Meaningful messages:

- Good: `fix: correct follow-up sequence generation for existing findings`
- Bad: `update stuff`

## 3. Testing expectations

Before opening a Merge Request, validate your change locally.

Suggested checks:

1. Start the local stack if your change is runtime-related.

```bash
docker compose up -d
```

2. Run smoke tests when model/API behavior is affected.

```bash
export BASE_URL="http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1"
export USERNAME="admin"
export PASSWORD="admin"
export PARENT_ID="REPLACE_WITH_PARENT_NODE_ID"

./scripts/run-model-smoke-tests.sh
```

3. If you changed model definitions, restart repository services and re-validate.

```bash
docker compose restart alfresco
```

If you add Node-based tooling/tests in your branch, run those too and include results.

## 4. Merge Request checklist

Please include in your Merge Request description:

- Summary: what changed and why.
- Type: `feat`, `fix`, `refactor`, `docs`, `test`, or `chore`.
- Testing: exact commands run and their outcomes.

Checklist:

- [ ] My code follows existing project style and conventions.
- [ ] I have self-reviewed my changes.
- [ ] I updated docs where needed.
- [ ] I validated behavior locally (and ran smoke tests when applicable).
- [ ] My commits follow Conventional Commits.

## 5. Documentation and compatibility

- Update README/examples when request/response contracts change.
- Keep backward compatibility in mind for identifiers and payload aliases.
- Avoid unrelated refactors in the same Merge Request.

## 6. Licensing and notices

By contributing, you agree your contributions are provided under this repository's Apache-2.0 license.
Do not add third-party code or assets without preserving required license notices.
