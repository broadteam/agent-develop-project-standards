## Unreleased

### Added
- Define a per-turn intent review protocol that distinguishes continuation, clarification, bounded interruption, explicit intent change and unresolved conflict; preserve the original task resume point across interruptions.
- Extend the cross-session breakpoint template with G/R/T anchors and pending decision references, without adding another current-goal registry.

### Tests
- Extend intent continuity contract tests for interruption preservation, pending proposals, conflict handling and resume-point recovery.

## Unreleased

### Added
- Add Node/Python traceability integrity checks to the governance gate: stable-ID references, active goal/requirement coverage, and verified-requirement evidence requirements.
- Add parity-oriented regression coverage for dangling references, invalid evidence commits, partial evidence, and active requirements without work items.

## Unreleased

### Added
- Define the second-stage traceability chain: project goals (G) map to accepted requirements (R), milestones (M) and tasks (T), while verification records (V) bind acceptance evidence to an exact commit.
- Separate task completion, requirement verification, milestone completion and goal completion; none can be inferred from another.
- Add lightweight requirements and verification registries, with explicit rules against creating a requirement for every small task.

### Tests
- Add a traceability contract regression test and include it in the Ubuntu/Windows CI matrix.

## Unreleased

### Added
- 为长期项目补上目标连续性基础：原始目标基线与后续意图变更分离记录；跟踪任务上下文强制读取两者，任务卡/里程碑通过稳定 ID 追踪目标。明确对话增量分类、计划偏离回顾与局部修复不得替代整体目标验收。
- 增加目标连续性模板契约测试与任务上下文回归覆盖；不改变 3.0.0 已发布版本号。

## 3.0.0 - 2026-11-10

**破坏性变更**：治理工具从 `scripts/` 移到 `.standards/`。所有命令路径都变了，见 `MIGRATION-v3.0.md`。

### Changed
- `scripts/` → `.standards/`. `scripts/` belongs to the project. Putting governance tooling there meant a project that already had `scripts/check-governance.cjs` silently kept its own file while believing it had the checker, and it made `scripts/build.sh` and `scripts/generate-board.cjs` indistinguishable in a listing. A dot-directory matches `.spec/` and `.memory/`, cannot collide, and stays out of the visible tree.
- `init --update` migrates automatically: installs to `.standards/`, removes the old copies **only when the recorded hash still matches**, deletes `scripts/` if it becomes empty, and leaves anything the project wrote untouched.

### Fixed
- A `gov.toml` the project had customized is skipped by `--update`, so its `[required].files` kept pointing at the removed `scripts/` paths and the first post-migration check failed with "缺少必需文件". The migration now rewrites those eight paths (and only those) in place, and ensures `.standards` is in `allowed_dirs`.
- A hook this installer created and nobody edited was protected from `--update`, so a release that moves the checker path would leave it pointing at a file that no longer exists — failing closed on every commit. Unmodified installer-owned hooks now refresh; project-owned ones are still protected.
- The template's `.githooks/pre-commit` still referenced the old paths: the bulk rewrite skipped extensionless files. Found by running the migration against a real project.

### Tests
- `tests/test-init.cjs` covers the migration: our old copy is removed, the project's own `scripts/build.sh` survives, the new location is populated, and the report says what moved.

## 2.7.1 - 2026-11-10

### Fixed
- `ROUTER.md` was not rendered: turning `task_tracking` off left its two rows pointing at `.spec/tasks/index.md` and `.spec/roadmap/INDEX.md`, directories that were never installed. The entry file said the capability was off while the routing table still sent the agent there. Same marker mechanism, applied to both files.

## 2.7.0 - 2026-11-10

### Added
- Capability-aware entry file. When a project turns a capability off in `project-profile.toml`, `AGENTS.md` used to keep instructing the agent to use it — telling it to create `.spec/tasks/<ID>/card.md` in a project where that directory was never installed. The template now marks capability-dependent blocks, and rendering drops them, adds a banner naming what is off, and leaves an explicit slot in §2.5 for the project to write where its backlog actually lives. A wrong instruction is worse than a missing one: the agent follows it and builds a parallel system.

### Docs
- `DEPLOY.md` explains the rendering, and states the honest limitation: capabilities must be decided before install, because `init` will not rewrite an existing `AGENTS.md`.

### Tests
- `tests/test-init.cjs` covers the disabled case: banner present, three-layer table gone, slot present, no markers left, and no `.spec/tasks` directory created.

## 2.6.1 - 2026-11-10

### Fixed
- The stale-transaction-file warning fired on every ordinary install. The tree-wide scan ran before `commitTransaction()`, so it saw the backups this run had just created and told the user to delete files that were about to disappear on their own — a warning that is always wrong trains people to ignore the one that matters. In-flight backups are now excluded.

## 2.6.0 - 2026-11-10

### Added
- Topic-split pitfall library. Lessons only accumulate, so a single `PITFALLS.md` eventually exceeds any budget — and the previous advice ("split by topic") had no mechanism behind it. `.memory/PITFALLS-<topic>.md` is now a supported shape: the index keeps a topic table, and both governance checkers verify that every registered file exists, every existing file is registered, and each topic file stays within `pitfalls_bytes`. Splitting no longer means deleting conclusions.
- `tests/test-pitfalls-split.cjs` covers the unregistered file, the dangling reference, the per-file budget, and byte-identical output from both checkers.

### Docs
- `template/.memory/PITFALLS.md` documents the split procedure and ships the topic table with a placeholder row.

## 2.5.1 - 2026-11-10

### Fixed
- `init` refuses to install into a project whose own `AGENTS.md` exceeds the template budget, and writes nothing. Previously it skipped the file silently and installed the rest, so the very first governance run failed on the project's own entry file while `.spec/` sat there unread — two rule systems, neither authoritative. The refusal names the three real options: split the entry file into `.spec/`, keep the entry unmanaged and raise `agents_bytes`, or do not install at all.

## 2.5.0 - 2026-11-10

### Added
- `.spec/02-conventions.md` §4 提交：固定类型清单（新增 / 修复 / 重构 / 性能 / 测试 / 文档 / 杂务），首行 ≤50 字，一次提交只做一类事，修复类提交正文必须写清现象 / 根因 / 验证方式。此前只给了一句「`<动词>：<做了什么>`」和四个例子，类型可以随便造。
- `.spec/02-conventions.md` §5：**修 bug 必须留下一条会失败的测试**。顺序固定为「先写用例并看到它失败 → 再改代码 → 再跑全量」，因为跳过第一步只能证明「改完没报错」，不能证明「修的是用户报的那个问题」。用例要能反查（名字说现象、注释写触发条件、提交信息引用），一次修复要同时记进测试文件、`PITFALLS.md` 和提交信息，三处缺一都有明确后果。
- `.spec/03-delivery.md` §4：版本号只在**发布时**改，不是每次提交都改；版本号必须与 git tag 一致；升级时指向已发布的 tag 而不是开发分支；CHANGELOG 只写使用者关心的内容，已知限制必须写。

### Tests
- `tests/test-policy.cjs` 断言 `standards-version.json` 与 CHANGELOG 最新小节一致。版本号和 CHANGELOG 标题是同一事实写了两遍，改一个忘另一个是最常见的脱节方式。

### Fixed
- 补打缺失的 `v2.4.0` tag。此前版本文件已写到 2.4.0 却没有对应 tag，直接违反本版本新写下的「版本号必须与 git tag 一致」——2.1.0 到 2.3.0 同样是只有版本号没有 tag 的「假发布」。

## 2.4.0 - 2026-11-10

### Added
- `.standards/sync-memory.cjs` mirrors the authoritative §0 breakpoint from `.memory/MEMORY.md` into client-private memory files declared in `gov.toml [memory].mirrors`. No rule in `AGENTS.md` can make another agent read your directory — it has its own conventions — but it will read the file it owns. So the state is copied to where it looks, in a marked block that the script maintains; everything outside the block is untouched. One-way, idempotent, and `--check` fails when the copy is stale. `mirrors` defaults to empty: the path is never guessed.
- Both governance checkers report a stale mirror with identical output, so parity still holds.

### Fixed
- `--update` replaced `gov.toml` with the template copy, whose `allowed_dirs` / `allowed_files` are empty placeholders filled only on a first install. Upgrading therefore wiped the project's root whitelist. Those two arrays are now carried over from the existing file.

### Docs
- `CLIENTS.md` §3 documents the mirror mechanism, the rules (one-way, marked block, detectable, never guessed), why bidirectional sync is not offered, and the one-time procedure for moving facts out of a private memory that already accumulated real content.
- `DEPLOY.md` adds configuring `mirrors` to the post-install checklist.

### Tests
- `tests/test-memory-mirror.cjs`: no-op without a declared target, block creation, client content preserved, idempotency, stale detection in both checkers with byte-identical output, recovery after sync, and a declared target that does not exist being skipped.

## 2.3.0 - 2026-11-10

### Added
- A rule for client-private memory. The template already declared "client private memory must not be authoritative" in three places, but never said what to do with it — so an agent that keeps its own project memory directory (`.workbuddy-ai/`, and each client has its own) would write project state there and go silent on a client switch, while `.memory/MEMORY.md` §0 stayed at 模板默认的「待填」. `AGENTS.md` §0.5 now states the operational rule: read §0 on start, write project-level facts back on close, private memory is a cache and never the only copy. `MEMORY.md`'s header says the same where the agent actually looks.
- `CLIENTS.md` gains a private-memory column and a section on aligning it with `.memory/`: when to read, when to write back, which wins on conflict, and which private directories should be ignored versus committed.

### Changed
- `.gitignore.append` no longer presents `.workbuddy-ai/` as an unexplained hardcoded entry. It states the criterion — ignore pure tool data, commit shared config like `.cursor/rules/` and `.claude/commands/` — and invites the project to add its own client's directory under the same test.
- `CLIENTS.md` §2 retitled: most clients need no *entry-file* adapter, which is not the same as needing no adaptation at all.

## 2.2.1 - 2026-11-10

### Fixed
- `init.cjs` died when its stdout was closed early (`node init.cjs . | head -3`): the EPIPE was uncaught, so the process exited mid-transaction without reaching either rollback or commit. The real trial project ended up with 25 orphaned `.*.agent-standards-backup-<pid>-<n>` files and a half-installed tree. stdout/stderr EPIPE is now ignored — writing files matters, printing the report does not.
- Stale transaction files are now searched across the whole tree, not just the root. The root-only check missed orphans under `.spec/`, `scripts/` and `policy/`, where the governance gate never looks for stray files.
- `--update` now refreshes stack preset files too; previously the preset loop skipped them unconditionally, so `.spec/stacks/<stack>.md` could never be upgraded.

### Docs
- `template/.memory/PITFALLS.md` P16: piping an installer's output into `head` kills it mid-transaction, and leftovers must be searched tree-wide.

## 2.2.0 - 2026-11-10

### Added
- `init.cjs --update`: refreshes only files whose current content is byte-identical to what a previous run installed. Files the project edited are left untouched and reported. This is the upgrade path that was missing — `--force` overwrites everything including the project's own `AGENTS.md`, and a plain re-run updates nothing.
- `init.cjs` warns when a same-named file exists that it has never managed. Silently skipping such a file means the project runs its own `.standards/generate-board.cjs` while believing governance installed one.
- `CLIENTS.md`: the adapter matrix (Codex, Claude Code, Gemini CLI, Cursor, OpenCode, WorkBuddy/CodeBuddy, and CatPaw/ZCode marked unverified), how to add an adapter in three steps, and an explicit note that no real client CLI has ever been exercised.
- `DEPLOY.md` gains an upgrade section: how to read `.agent-standards.json`, one-sentence upgrade, why not `--force`, what happens to a conflicted file.

### Fixed
- A re-run advanced `installed_with_version` to the template version even though every existing file was skipped, so the manifest claimed an upgrade that never happened. The marker now advances only when every managed file actually carries the current version; otherwise it stays put and warns.
- Imported plan cards and the index row they register were recorded as managed files, so a later `--update` would have reverted them to the template's example card. They are now derived, like `BOARD.md`.

### Tests
- `tests/test-init.cjs` covers: a stale managed file blocks the version advance; `--update` refreshes pristine files but preserves an edited one and then advances the version; a project-owned same-named script is preserved and reported; `--update` does not revert an imported card.

## 2.1.0 - 2026-11-10

### Added
- `init.cjs` imports root-level plan files (`TODO.md`, `PLAN.md`, `NOTES.md`, …) into `.spec/tasks/T1/imported/` and replaces the example card with an import card, then removes the root file inside the transaction. Previously the very first governance run after installing into an existing project failed on the user's own notes and told them to migrate it by hand — which is the point where most people either give up or revert the install. The content is copied byte-for-byte; nothing is rewritten. Opt out with `--no-import-plans`, in which case the file stays and the gate reports it as a violation, as before.
- Plan-file detection reads `gov.toml [forbid].file_patterns` instead of restating the name list, so the forbidden names still have exactly one home. Only markdown is imported; `.bak` / `.orig` / `.DS_Store` remain junk to delete.
- `DEPLOY.md`: one-sentence deployment for an AI, the impact matrix (what changes, what is never touched), why root plan files must move, how it coexists with an existing pre-commit hook and `.gitignore`, how to roll back, and who decides what in human-vs-AI governance.

### Changed
- Imported plan files are excluded from the `gov.toml [dirs]` whitelist, since they are about to leave the root.

### Tests
- `tests/test-init.cjs` covers multi-file import, byte-identical preservation, index registration, a green gate right after install, and that `--no-import-plans` leaves the files alone and fails the gate.

## 2.0.0 - 2026-11-10

首个稳定版。按 `SPEC-v2.0.md` 的七大方向重构，验收标准与逐项证据见其 §3、§5。

### 状态

- 七大方向：**6 个 `done`，1 个 `partial`**（第七方向：自动升级应用器/自动回滚器未实现，按 SPEC §4 明确不做）。
- 发布门槛 8 项全部满足；14 个测试在 Ubuntu/Windows × Node 22/24 × Python 3.11/3.13 的 8 个任务上全绿。
- 已在一个真实项目（Vite + TypeScript，自带 git hooks）和一个 Python 项目上完成试铺。

### 发布前最后一轮修正（2.0.0-rc.15 → 2.0.0）

- 换行符不再影响语义：Python 检查器固定 UTF-8 + LF 输出；文档预算与 BOARD 哈希按 LF 归一化。此前 CI 的 Windows 任务绿而真实 Windows 开发机必挂，因为 CI 检出的是 LF。
- 运行时下限从 Node 18 / Python 3.10 抬到 Node 22 / Python 3.11，并由 CI 矩阵同时覆盖下限与最新。
- 真实项目试铺暴露并修复 4 个夹具测试漏掉的缺陷：模板内的 `__pycache__` 被复制进项目；兼容扫描把模板自建目录算作"既有目录"；初始化后 `AGENTS.md` 占预算 99%；中断安装残留的事务文件被写进白名单。
- 新增闸门：README 目录树可解析、模板占位符必须被 init 认识、空项目真实首次安装必须通过治理检查、初始化后 `AGENTS.md` 至少留 1KB 余量、CRLF 检出与 LF 检出结果一致。

### 已知限制（不要读成"全部验证过"）

- 从未启动过真实客户端 CLI（Codex / Claude Code / Gemini / Cursor），兼容性只到入口与导入契约层面。
- 第七方向为 `partial`：升级的计划、审批、登记、漂移、恢复演练可重复，但"人工应用 → 校验 → 推进基线"仍需维护者手工执行。
- 初始化的原子性只覆盖可捕获的运行时异常；进程被强杀或断电不在保证内。
- 只试铺过 Node 前端与 Python 两个栈，其余 5 个预设只有夹具测试。
- 锚点链接（`#标题`）未纳入文档校验。

## 2.0.0-rc.16 - 2026-11-10

Real-project trial on an existing Vite/TypeScript project surfaced three defects that every fixture test had missed.

### Fixed
- `init.cjs` copied untracked build artifacts from `template/` into the target project. Running the Python checker creates `template/.standards/__pycache__`, which is gitignored, so CI never saw it — but every initialized project received a `.pyc`. Template walking now filters `__pycache__`, `*.pyc`, editor temp files and `.DS_Store`.
- The compatibility scan counted directories the template itself had just created (`.spec`, `.memory`, `.tmp`, `scripts`, `policy`), so a repeat `init` warned that there were "14 pre-existing root directories to review". A warning that fires on the template's own output teaches users to ignore warnings. Only genuinely pre-existing directories are reported now, and the count is stable across runs.
- A freshly initialized `AGENTS.md` consumed **99% of its own budget** (12201/12288B, 87 bytes left), while the README instructs the user to add project-specific wording to it — the first edit would have been blocked by the governance gate. `AGENTS.md` §4 also duplicated the `gov.toml [dirs]` whitelist, so every `--force` rerun appended more file names and grew the entry file further.
- An interrupted `--force` run can leave its own transaction files (`.<name>.agent-standards-backup-<pid>-<n>`) in the project root, and the next run's compatibility scan whitelisted them — permanently legitimizing junk in `gov.toml [dirs]`. Internal transaction files are now excluded from the scan, so leftovers surface as unregistered root files instead of being blessed. `init` also names them explicitly and says not to whitelist them, because the governance message's default advice ("add it to `gov.toml [dirs]`") is exactly the wrong move here.

  Root cause: `writeTransactional` renames the target to a backup and only then registers the entry in the transaction, so a process killed inside that window leaves an orphan. That is inside the documented transaction boundary ("process termination is not covered"), and rollback itself is verified clean under the deterministic failure injection. The real defect was the next run treating the orphan as project structure; that is fixed.

### Changed
- `template/AGENTS.md` trimmed from 11814B to 10792B by removing duplicated and machine-enforced content: the file map collapsed to one row per directory, the forbidden-filename list replaced by a pointer to `gov.toml [forbid]`, two reading rules that `§0.5` already states, and the whitelist dump replaced by a pointer. Initialized size is now 10814B (88%), leaving 1474B for project rules, and repeat runs are idempotent.
- `template/.memory/PITFALLS.md` P15: a template that fills its own budget locks its users out.

### Tests
- `tests/test-init.cjs` asserts an initialized `AGENTS.md` leaves at least 1024B of budget headroom, that a `__pycache__` probe planted under `template/` never reaches the installed project, and that a stale transaction file is neither whitelisted nor able to pass the governance gate.

## 2.0.0-rc.15 - 2026-11-10

### Fixed
- Python governance checker pins UTF-8 and LF on stdout/stderr. Windows text-mode stdout translated `\n` into `\r\n`, so Node and Python output diverged byte-for-byte and `tests/test-parity.cjs` could never pass on a real Windows checkout. Parity is now genuine, not CI-only.
- Document byte budgets are measured on LF-normalized bytes instead of on-disk size. With `core.autocrlf=true` the same `AGENTS.md` measured 12029B (CRLF) instead of 11814B (LF), turning 96% of budget into 98% and making the gate platform-dependent.
- `BOARD.md` source and generated hashes are LF-normalized in both checkers, and `generate-board.cjs` hashes and writes LF. A board generated on Windows and verified on Linux was reported stale.
- `tests/test-parity.cjs` wrote `'{}\\n'`, i.e. a four-character literal that is not valid JSON, as the installation manifest fixture. It only passed because the manifest is existence-checked.

### Added
- `tests/test-parity.cjs` now asserts a CRLF checkout reports the same budget bytes as an LF one, and that a CRLF `BOARD.md` still validates.
- `tests/test-doc-links.cjs` verifies the README directory tree resolves against the repository. The tree had drifted: five root documents, seven test files and four template scripts were missing.
- `tests/test-init.cjs` enforces a placeholder contract: every `{{KEY}}` in `template/` must be a key `init.cjs` knows, because `fill()` degrades unknown keys into a visible `（待填：KEY）` marker instead of failing.
- `tests/test-migration-v2.cjs` performs a real first install on an empty project and requires the governance gate to pass immediately. Previously only `--dry-run` covered the empty-project case.
- `tests/test-template-upgrade-record.cjs` covers the `keep_or_archive` decision: when upstream removes a file the project also modified, the plan must not offer a delete candidate, the file must survive review and recording, and the follow-up drift report must return `ok` with status `accepted_removed`.
- `template/.memory/PITFALLS.md` P13 (line endings make budgets and hashes platform-dependent) and P14 (CI green is not local green: CI checks out LF while Windows developers check out CRLF).

### Changed
- Raise the declared runtime floor to Node 22 / Python 3.11 and state it in `policy/standards-version.json` (`minimum_node_major`, `minimum_python`). The previous floor (Node 18 / Python 3.10) was past end-of-life and was never exercised by CI, so "supported" was an untested promise.
- CI now runs a matrix of the declared floor and the current release: Node 22/24 × Python 3.11/3.13 × Ubuntu/Windows, eight jobs total.
- `template/gov.toml` documents the LF-normalized measurement basis for `[budget]`.
- README directory tree regenerated from the actual repository contents.

## 2.0.0-rc.14 - 2026-11-08

### Added
- Add `tools/record-reviewed-template-upgrade.cjs` to advance the installed baseline after a maintainer has manually applied and validated the approved upgrade changes.
- Require plan/review binding, matching source version, unchanged baseline hashes, current template source hashes and result SHA-256 values before baseline advancement.
- Advance only verified managed-file/managed-block entries, preserve accepted local customizations, record accepted upstream removals and update the overall installed version only after every plan item is resolved.
- Support explicit `defer` decisions for multi-batch upgrades: deferred files must still match the plan snapshot's existence, SHA-256 and mode; their per-file baseline is preserved and the overall installed version stays at the source release until a follow-up plan resolves every path.
- Write the manifest through a same-directory temporary file and atomic rename; a failed validation or write leaves the existing manifest unchanged.

### Tests
- Add `tests/test-template-upgrade-record.cjs` for replacement, new-file addition, local customization acceptance, manual merge, upstream removal, dry-run immutability, tampered-result rejection, post-record drift clearance, stale-plan replay rejection and partial/deferred follow-up completion.
- Add `UPGRADE-RECORD-TEMPLATE.md` as a reusable audit record for plan/review references, external backups, per-path decisions, deferred batches, baseline recording and recovery evidence.
- Add syntax and regression checks to the Ubuntu/Windows CI matrix.

### Integrity hardening (same installed template release)

- Upgrade plans now use `plan_schema: 2` and bind a deterministic `source_inventory_sha256` over the complete `template/` and `presets/stacks/` source trees, including file paths, content hashes and source permissions. Any post-plan source addition, removal or change invalidates the old plan.
- Human review records now use `review_schema: 2`; ordinary files require both `result_sha256` and `result_mode`. The recorder rejects a result whose bytes or permissions differ from the reviewed evidence.
- Treat `.gitignore` as a rendered managed block rather than comparing the rendered block hash to the raw `.gitignore.append` source hash. Validate the source placeholder and fixed prefix/suffix, hash the actual managed block, and preserve project-owned rules outside the block.
- Store the verified `source_inventory_sha256` in `last_upgrade` audit metadata.
- Add regression coverage for stale source inventory, mismatched result modes, rendered `.gitignore` block upgrades, and preservation of external user rules.
- Force UTF-8 mode for Python subprocess output in Windows CI to avoid locale-dependent `UnicodeEncodeError` failures.

### Boundaries
- The recorder updates manifest metadata only; it does not apply templates, perform automatic rollback, or replace project-specific tests/build validation.
- Human-applied changes must still be backed up and validated before the explicit `--confirm-reviewed` step.

## 2.0.0-rc.13 - 2026-11-08

### Added
- Add `tools/validate-template-upgrade-review.cjs`, a read-only validator that checks review decisions against the plan ID and per-file approval contract; manual merges must include common-base and merge-result references.
- Add `tests/test-template-upgrade-review.cjs` for stale plan IDs, missing/duplicate/incorrect decisions, missing merge provenance, blocked baselines and read-only validation.
- Bind the plan fingerprint to each action's recommendation, human-review requirement, decision type, reason and hash evidence; reject altered approval requirements as stale plans.
- Add `tools/plan-template-upgrade.cjs`, a read-only planner that converts template drift findings into explicit per-file candidate actions.
- Include a deterministic `plan_id`, source/target version labels, baseline and hash evidence, blockers, and a human approval contract.
- Classify upstream-only changes, local-only edits, two-sided conflicts, upstream removals, missing local files, new common template files, already-installed stack presets, legacy unknowns and untracked collisions; do not report unselected language presets as project-wide additions.
- Require review metadata for every proposed change; no file is written, replaced, removed or merged by the planner.

### Tests
- Add `tests/test-template-upgrade-recovery.cjs` to rehearse a small approved batch containing a template file and installed version metadata, deterministic governance failure, full external backup restore, exact tree comparison and post-restore governance/drift/plan-ID verification on disposable fixtures only.
- Add `tests/test-template-upgrade-plan.cjs` for stable plan identity, read-only behavior, per-file action classification, stack preset discovery, incomplete-baseline blockers and JSON CLI output.
- Run the upgrade-plan tests and syntax check in the Ubuntu/Windows CI matrix.

### Boundaries
- The manifest stores hashes, not baseline file contents. Conflicts therefore require recovering the common base from the pre-upgrade Git tree, a backup or the matching old template checkout; record `baseline_ref` and `merge_result_ref` before claiming a three-way merge.
- This release adds preview, review validation and a disposable-fixture recovery rehearsal only. An upgrade applier, automated rollback tool and successful-upgrade baseline advancement tool do not exist; the manifest remains at the old baseline after manual file replacement, so an applied upgrade cannot yet be finalized by the supported tooling.

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
- Stop executing project-owned `.standards/generate-board.cjs`; invoke the bundled generator with an explicit target root instead.
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
