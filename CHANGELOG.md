## 2.0.0-rc.12 - 2026-11-08

### Added
- Record a machine-readable template release in `policy/standards-version.json`.
- Generate `.agent-standards.json` with per-file source/installed hashes, source version, preserved paths, derived paths and capability-pruned paths.
- Add a read-only `tools/check-template-drift.cjs` report for upstream-only updates, local-only customizations, two-sided conflicts, missing files, new upstream files and legacy unknown baselines.
- Add an explicit `tools/adopt-template-baseline.cjs` flow. It requires `--confirm-reviewed`, changes metadata only, and marks accepted customizations so future upstream edits to those files become conflicts.
- Add temporary-project tests for clean installs, local/upstream/both-side changes, new upstream files, read-only behavior, legacy unknown baselines and explicit baseline adoption.

### Safety
- 漂移检查和旧基线采纳逐级检查路径组件，拒绝目标文件或父目录中的符号链接；`.gitignore` 托管区块外的用户内容不被误报，区块内编辑、文件权限漂移和父目录符号链接均有回归用例。
- `--force` remains a file-copy override, not a version upgrade mechanism.
- Legacy projects without a marker are never assumed to match the current template.
- Baseline inspection and adoption do not write or merge project rules; only the explicit adoption command updates `.agent-standards.json`.

## 2.0.0-rc.11 - 2026-11-08

### Fixed
- Reject symlinks in managed target paths before writing, including `.gitignore` and nested template destinations.
- Stop executing project-owned `scripts/generate-board.cjs`; invoke the bundled generator with an explicit target root instead.
- Validate an existing BOARD managed region before any template mutation.
- Validate initializer flags and require `--replace-hook` to be combined with `--force`.

### Added
- Add a lightweight write journal with same-directory temporary files, backups for overwritten files, and best-effort rollback on caught runtime failures.
- Add tests for whole-tree dry-run immutability, symlink escape rejection, board preflight, untrusted generator non-execution, and rollback after deterministic failure injection.

### Boundaries
- Rollback covers caught runtime errors, not process termination, power loss, or filesystem corruption. Migration still requires a backup and dry-run review.

## 2.0.0-rc.10 - 2026-11-08

### Added
- Validate task-wave and roadmap-milestone archive catalogs against their active indexes.
- Check archive directory pointers, task counts, and required archived detail files; reject unindexed or missing archive entries, path traversal outside the owning archive root, and orphan archive directories.

### Tests
- Extend Node/Python parity fixtures with valid task and milestone archives, mismatched task counts, missing task logs, missing milestone details, unsafe archive paths, and orphan archive directories.
- Keep archive validation diagnostics and exit behavior identical across Node and Python.

## 2.0.0-rc.9 - 2026-11-08

### Changed
- Clarify the memory lifecycle: update the compact checkpoint at tracked-task close or cross-session handoff, while lightweight tasks do not require memory writes.
- Keep execution history in the task log and point historical closeout notes to the existing `.memory/log/` directory.

### Tests
- Extend the 2.0 specification contract test to verify memory update triggers, non-duplication of task logs, and that memory pointers resolve to existing template paths.

## 2.0.0-rc.8 - 2026-11-08

### Added
- Add a migration-fixture regression suite for empty and pre-existing multi-stack projects, including dry-run safety, custom rule and Hook preservation, generated-profile review state, and post-migration governance validation.
- Run the complete regression suite on Ubuntu and Windows in CI.
- Add an offline CI check for broken repository-local Markdown links.

### Changed
- Define the boundary for client global/project/local rule conflicts: repository facts stay authoritative, while actual client-specific loading behavior is not inferred by this template; Codex directory overrides require explicit review because they replace ordinary rules.

## 2.0.0-rc.7 - 2026-11-08

### Fixed
- Correct the client compatibility matrix after an official-documentation review: Cursor supports nested `AGENTS.md`; Claude Code imports allow at most four hops; Codex documents `AGENTS.override.md` as a same-directory replacement rather than an additional layer.

### Added
- Add regression assertions for the documented Codex override, Claude import-depth and Cursor nested-rule semantics.

## 2.0.0-rc.6 - 2026-11-08

### Changed
- Expand the client compatibility matrix with documented discovery/import semantics and direct official references.
- Clarify the evidence boundary: automated tests cover template contracts and initializer fixtures, not real CLI end-to-end behavior.

### Added
- Strengthen adapter tests to detect duplicated client rule prose and unexpected Cursor-specific rule trees.
- Verify the initializer copies the canonical AGENTS.md body unchanged.

## 2.0.0-rc.5 - 2026-11-08

### Added
- Specify verified Codex, Claude Code, Gemini CLI and Cursor rule-entry behavior and known scope limitations.
- Add client-adapter contract tests for canonical rule pointers, native import syntax and deprecated Cursor entry exclusion.
- Run client-adapter tests in GitHub Actions.

### Notes
- This release-note entry was superseded by rc.7 after a documentation review found that Cursor now supports nested `AGENTS.md` files.
- Client-specific scoped rules remain optional and must not become a second copy of canonical project rules.

# Changelog

## 2.0.0-rc.4 - 2026-11-08

### Added
- Add a read-only Task Context Resolver that evaluates `auto` capability triggers against an explicit task descriptor.
- Output fixed context, task-required references, optional history, capability decisions, configured verification commands and follow-up warnings.
- Keep the resolver optional for lightweight tasks; it does not create task cards, mutate profiles, run commands or grant permissions.
- Add fixture tests for local changes, high-impact database work, explicit capability overrides, unknown risk and safe task identifiers.

## 2.0.0-rc.3 - 2026-11-08

### Added
- Add a registry-driven Capability Resolver for initialization-time capability states and optional artifact pruning.
- Preserve `auto` as `deferred`; only explicit `off` prunes optional template artifacts, while `on` remains enabled.
- Add fixture tests for dependency conflicts, lean-profile pruning, preservation of core rules, and Node/Python governance-gate parity when optional capabilities are disabled.

### Notes
- Existing project-owned files are never deleted when a capability is switched off. Task-context resolution for `auto` remains a session-level responsibility.


## 2.0.0-rc.2 - 2026-11-07

### Added
- Add project-profile.toml as a review-first project profile and capability selection file.
- Define the cross-cutting mother-template adaptation model: core/capability/stack/project/advisory rules, lean/balanced/rigorous recommendations, and task-driven context loading.
- Extend initialization and regression contracts to cover generated project profiles.

### Notes
- Profile generation only records detectable candidates; maintainers must confirm project scale, risk, architecture and enabled capabilities.


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
