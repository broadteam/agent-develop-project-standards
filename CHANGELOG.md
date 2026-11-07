# Changelog

## 2.0.0-rc.1 - 2026-11-07

### Added
- Define the seven-pillar 2.0 architecture, scope boundaries and objective release gates in `SPEC-v2.0.md`.
- Add a 1.2.x-to-2.0 migration guide requiring dry-run, customization review and fixture-based validation.

### Notes
- This is a design-baseline release candidate, not the final 2.0.0 template release. The seven pillars remain subject to implementation and automated verification.


## 1.2.0 - 2026-11-07

### Changed
- Replace the mandatory five-step session ritual with a lightweight baseline and task-based context loading.
- Make task cards optional for localized, low-risk work with clear acceptance criteria; retain tracked workflows for cross-module, multi-session, uncertain or high-impact changes.
- Load constitution, pitfalls, ADRs, roadmap and Git history only when relevant to the task or risk.
- Clarify that context budgets are maintenance signals, not reasons to omit necessary correctness or safety information.

### Added
- Add regression coverage for the low-friction session protocol.
- Add migration guidance for existing projects adopting the 1.2.0 workflow.

## 1.1.0 - 2026-11-07

### Fixed
- Fail closed when pre-commit cannot locate a governance runtime or checker.
- Protect existing project pre-commit hooks from `--force` unless `--replace-hook` is explicitly supplied.
- Separate project-specific checks into `.githooks/pre-commit.local` so shared hook updates do not overwrite them.
- Merge `.gitignore` rules through an idempotent managed block instead of treating `.tmp/` as a proxy for all entries.
- Populate the generated root allowlist when a new `gov.toml` is installed.
- Regenerate the derived task board after template placeholders are filled.
- Align Node and Python governance checks for symlinks and deterministic diagnostics.

### Added
- PHP and multi-stack detection with selective language preset installation.
- Task and milestone archive indexes; task wave archives retain complete `card.md` and `log.md` directories.
- Task status validation, duplicate-ID detection, required task logs and generated-board freshness checks.
- `generate-board.cjs` to derive `BOARD.md` from the authoritative task index.
- Agent operation permission levels and explicit project architecture dependency-boundary guidance.
- Self-tests and GitHub Actions CI for initialization, checker parity and regression scenarios.

### Changed
- Cursor projects use native `AGENTS.md`; the deprecated `.cursorrules` template is removed.
- Universal conventions no longer impose TypeScript-specific language rules on other stacks.
- Project memory is the authoritative source for project facts; client-private memory is not prohibited but cannot override repository facts.
- Project-external standard tool caches are distinguished from Agent-created project artifacts.
