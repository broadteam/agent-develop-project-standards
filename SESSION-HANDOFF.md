# 会话交接：Agent 项目开发规范 2.0

更新时间：2026-11-08

## 项目目标与边界

- 仓库：`broadteam/agent-develop-project-standards`。
- 目标：建立跨 Agent、跨项目可复用的工程治理模板；规则、项目事实和验证结果各有唯一权威来源。
- 不把真实 SaaS 项目当作 2.0 的验收试点；先通过可重复的临时 fixture 验证。
- 不合并 PR、不修改 `main`，除非用户另行明确授权。
- 不以文档表述替代可执行验证；未运行或未覆盖的结论必须如实标记。

## 当前 Git 状态

- 工作分支：`feat/standards-v2.0-seven-pillars`，跟踪 `origin/feat/standards-v2.0-seven-pillars`。
- 最新完整代码验证 HEAD：`02d4337d9e7b12416b0c2069b94aba6e85dd731a`；Push [42493895276](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493895276) 与 PR [42493900304](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493900304) 的 Ubuntu / Windows jobs 均成功，恢复演练测试两平台均通过。最近文档 HEAD `35fbfac7d23c3a5fb0bd199fe560ff088c8f7791` 的 Push [42493962678](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493962678) 与 PR [42493967270](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493967270) 也全部通过。当前 HEAD 始终以 PR #2 的实时指针为准。
- 相关 PR：#2（Draft；不要合并）。

## 已完成

- 2.0 七大方向的设计基线在 `SPEC-v2.0.md`；能力画像、治理检查、任务上下文解析器与模板夹具测试已在该分支实现。
- 多客户端入口维持单一正文：`template/AGENTS.md` 是正文，`CLAUDE.md` 和 `GEMINI.md` 仅导入它；不生成废弃的 `.cursorrules`。
- 客户端适配测试覆盖模板契约及初始化后的 fixture，不等同于真实 CLI 端到端验证。
- 当前适配矩阵记录：Codex 的同目录 `AGENTS.override.md` 替代 `AGENTS.md`；Claude Code 导入最多四跳；Cursor 支持根目录和子目录 `AGENTS.md`，更具体的目录优先。自动化测试验证模板契约，不启动真实 CLI。
- `tests/test-migration-v2.cjs` 已通过临时 fixture 演练了 2.0 迁移的安全路径；CI 已扩展至 Ubuntu 和 Windows。

## 本机验证结果

- 本机通过：`test-migration-v2`、`test-policy`、`test-task-context-resolver`、`test-client-adapters`、`test-v2-spec`。
- 本机未安装可用 Python，因此没有将 `test-init`、`test-parity`、`test-capability-resolver` 记为本机通过。
- CI 已在 Ubuntu 与 Windows 的 Python 3.11 环境完整通过；本轮开始前最新 HEAD `f5e90e6a74f5f45744a750b24486864e674372a0` 的 push 与 pull_request runs [42461258625](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42461258625)、[42461262647](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42461262647) 均成功。

## 本轮记忆与上下文管理改进

- `template/.memory/MEMORY.md`：断点仅在跟踪任务收口或跨会话暂停时更新；轻量任务不强制写记忆；任务流水保留在任务卡 `log.md`；历史收口记录指向实际存在的 `.memory/log/`。
- `tests/test-v2-spec.cjs`：增加记忆生命周期、路径存在性和不重复记录任务流水的契约断言。
- `SPEC-v2.0.md`：补充第三方向验收口径和实现证据；不把记忆体系标记为完成，跨客户端实际恢复效果仍未验证。
- `CHANGELOG.md`：新增 2.0.0-rc.9 记录。
- 纠正本文件中历史验证记录过旧的问题；分支最新 HEAD 和 CI 状态仍以 GitHub 实时查询为准。

## 本轮任务与路线图归档完整性改进

- 发现原治理检查器只验证活跃任务/里程碑目录，归档目录被排除扫描后，归档索引、目录指针、任务数量及详情文件没有完整性校验。
- Node 与 Python 治理检查器现在双向核对活跃索引和归档索引；验证归档目录安全路径、任务波次数量、每张归档卡的 `card.md` / `log.md`，以及归档里程碑的 `milestone.md`。
- `tests/test-parity.cjs` 新增有效归档、任务数量不一致、缺失任务日志、缺失里程碑目录等 fixture，并继续比较 Node/Python 输出和退出码。
- `SPEC-v2.0.md` 补充第四、第六方向证据；`CHANGELOG.md` 新增 rc.10。
- 最新完整双平台 CI 对应 HEAD `62dcc9debae3beab514843e79256e7f163f17658`：push [42465012620](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42465012620) 与 pull_request [42465016365](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42465016365) 均成功，Ubuntu / Windows jobs 全绿；新增路径穿越与孤立归档目录用例。当前 HEAD 仍以 PR #2 实时指针为准。

## 本轮工程治理与初始化机制补强

- `init.cjs` 校验未知参数和多目标参数；`--replace-hook` 必须与 `--force` 同时使用。
- 初始化前通过 `lstat` 预检所有受管目标路径；嵌套符号链接、`.gitignore` 符号链接、非目录父路径会在任何模板写入前失败关闭。
- 已存在的 BOARD 生成区块先以只读模式校验；初始化阶段执行仓库随附的可信生成器并传入 `--root`，不执行项目自有的 `scripts/generate-board.cjs`。
- 写入使用同目录临时文件；覆盖文件保留备份，跟踪本次创建的目录；捕获运行时错误时按逆序恢复文件、权限并清理新建内容。
- 回滚边界明确：覆盖可捕获的运行时异常，不保证进程被强制终止、断电或文件系统损坏时的原子性。迁移仍须先备份、dry-run 并审查差异。
- `tests/test-init.cjs` 覆盖全树 dry-run 零写入、非法参数、目录/文件符号链接、BOARD 预检、项目自有生成器不执行、普通覆盖回滚，以及自有 Hook 替换失败后内容/权限恢复。
- `README.md`、`MIGRATION-v2.0.md`、`SPEC-v2.0.md` 同步了安全边界与验收证据；`CHANGELOG.md` 新增 2.0.0-rc.11。
- 最新代码提交：`ead3050647ae93dab80e7b1adcd6818b8d75cf06`。
- 最新双平台 CI：Push [42474979601](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42474979601) 与 PR [42474984115](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42474984115) 均成功，Ubuntu / Windows jobs 全绿。
- 第五方向仍为 in_progress：回滚不覆盖断电/强杀；迁移文档要求先备份。不要据此宣称具备完整文件系统事务保证。

## 本轮模板版本漂移与旧项目基线改进

- 新增 `template/policy/standards-version.json`（2.0.0-rc.12），初始化生成 `.agent-standards.json`；逐文件记录模板源哈希、安装后哈希、安装权限、来源版本，并记录 `.gitignore` 托管区块、派生文件和能力裁剪路径。
- 新增只读 `tools/check-template-drift.cjs`：区分上游更新、本地修改、双向冲突、文件缺失、新增模板文件和旧项目基线未知；不执行覆盖、合并或初始化。
- 新增显式 `tools/adopt-template-baseline.cjs`：先 dry-run，再由维护者传入 `--confirm-reviewed`，只更新安装元数据；已审查接受的项目定制在未来发生上游改动时仍会触发冲突。
- 测试覆盖 clean / partial / legacy baseline、local-only / upstream-only / two-sided conflict、新模板文件、只读保证、显式基线采纳、managed .gitignore 区块外/内修改、POSIX 文件权限漂移，以及项目/模板父目录符号链接拒绝。
- 漂移与基线采纳工具逐级 `lstat` 路径组件，避免父目录符号链接绕过最终文件检查；托管区块读取也使用同一安全路径函数。
- 最新已验证双平台 CI 对应 HEAD `c29a15560b30dd54c12ef799ad9a012d2e84feff`：Push [42485787979](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42485787979) 与 PR [42485793239](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42485793239) 均通过，Ubuntu / Windows jobs 全绿；包含父目录符号链接保护和托管区块读取路径修复。
- 第七方向仍为 in_progress：跨版本真实迁移/回滚演练、支持矩阵与版本兼容策略仍需正式发布前验收。

## 本轮模板升级预览与人工审批闭环

- 用户确认按此前建议顺序继续：先做只读升级预览和逐文件候选动作，再建立人工审批校验；本轮未实现自动覆盖或自动合并。
- 新增 `tools/plan-template-upgrade.cjs`：将漂移分类生成稳定 `plan_id`、源/目标版本、逐文件状态、哈希证据、候选动作、全局阻断项和人工审批契约。只读，不写入/删除/替换/合并项目文件。
- 预览分类覆盖上游更新、本地定制、双向冲突、上游移除、本地缺失、新增通用模板、项目已安装的技术栈预设、旧项目未知基线和未登记同名文件。
- 技术栈预设仅在项目安装清单中有登记时参与漂移/升级计划；未选择的 PHP/Java/Python 等预设不应被误报成每个项目都要安装的新增文件。临时 Java 项目 fixture 验证已安装的 Java 预设上游更新会成为替换候选。
- 安装清单只保存哈希、不保存基线正文。发现冲突只代表项目与上游都相对基线改变；必须从升级前 Git 历史、完整备份或对应旧模板 checkout 恢复共同基线，再人工三方合并。审批记录必须保存 `baseline_ref` 与 `merge_result_ref`；找不到共同基线时不得声称已完成三方合并。
- 新增 `tools/validate-template-upgrade-review.cjs`：只读校验人工审查 JSON 是否绑定同一个完整计划指纹、每个待审路径是否有且仅有一个合法决策、reviewer/reviewed_at/reason 是否齐全，以及 manual_merge 是否有基线/合并结果来源。审批校验通过不是签名、授权凭证，也不表示变更已应用。
- `plan_id` 现在对整个计划内容做指纹，包括版本、阻断项、每项建议动作、人工确认要求、理由和哈希证据；修改计划内容后旧审查记录会失效。审批决策采用固定白名单，不信任计划文件自行扩展决策枚举。
- 新增 `tests/test-template-upgrade-plan.cjs` 与 `tests/test-template-upgrade-review.cjs`，并纳入 `.github/workflows/standards-ci.yml`。覆盖零写入、稳定 plan id、通用模板与已安装技术栈预设、local/upstream/conflict/removal/missing/add/collision 分类、legacy baseline blocker、审批缺失/重复/错误、计划篡改与冲突基线来源。
- README 与迁移指南已加入 plan 生成、审查 JSON、校验命令和人工恢复流程；SPEC 第七方向加入审批证据与边界；CHANGELOG 记录 2.0.0-rc.13。
- 最新已验证代码 HEAD `4e45b10c2a26ee9f76ca0e4cde6d842c95dc6398` 的 Push [42492535487](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42492535487) 与 PR [42492540414](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42492540414) 均通过；日志明确显示 `test-template-drift`、`test-template-upgrade-plan`、`test-template-upgrade-review` 在 Ubuntu / Windows 均通过。
- 当前仍无升级应用器和自动回滚器。下一阶段先用临时 fixture 演练“人工执行一小批已批准变更 → 治理/测试失败 → 从备份恢复 → 重新验证”的操作手册与测试证据；在这条流程可重复前，不开发自动应用器，也不对真实 SaaS 项目试点。
- PR #2 继续保持 Draft / Open；没有合并，没有修改 `main`。
## 本轮人工升级失败恢复演练

- 新增 `tests/test-template-upgrade-recovery.cjs`，仅创建系统临时目录中的一次性项目与规范 checkout，不访问真实 SaaS 项目。
- 演练步骤：初始化临时项目并确认治理通过 → 制作项目外完整备份 → 对目标规范版本生成升级计划 → 对逐项待审决策生成 review JSON 并通过 `validate-template-upgrade-review.cjs` → 手工应用获批小批次（模板规则文件 + `policy/standards-version.json` 项目版本元数据） → 注入未登记根目录使治理检查失败 → 停止升级并恢复整个工作树 → 对比恢复前后文件、目录、符号链接和权限快照 → 重新运行治理检查、漂移检查和升级计划。
- 恢复验收：恢复后对旧规范仓库的 drift 报告必须 `ok=true`；对目标新版本的升级计划 ID 必须与升级前完全一致，目标文件重新显示 `update_available`；失败注入目录必须不存在。
- 该演练验证的是人工备份/恢复流程，不是自动升级应用器或自动回滚器；生产项目仍应优先用升级前 Git commit/独立 worktree，并在项目外保存第二份备份。恢复不完整或没有重新验证时必须标记 `unverified`。
- 重要限制：失败恢复闭环已通过，但成功升级后的 manifest 基线推进工具尚不存在。人工替换模板文件后，`.agent-standards.json` 仍保留旧版本与旧哈希，再跑 drift 会报告冲突；不能声明为正式升级完成，也不要手工改 manifest 或复用 `adopt-template-baseline`。下一项应单独设计 `record-reviewed-template-upgrade` 一类登记流程，校验 plan/review、目标文件实际哈希和合并结果后，仅推进获批条目的基线。
- CI 曾按测试日志发现两个真实假设问题：升级计划不只包含业务规则文件，也会包含项目内版本元数据更新；此外，审查决策应覆盖计划中所有待审项，而实际演练只应用已明确选定的小批次。当前 fixture 已修正为完整审核所有待审项，并手工应用两项替换候选。
- 最新测试代码 HEAD `02d4337d9e7b12416b0c2069b94aba6e85dd731a` 的 Push [42493895276](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493895276) 与 PR [42493900304](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493900304) 全部成功。CI 日志确认 Ubuntu / Windows 的 `test-template-upgrade-recovery: all cases passed`，并且 plan/review/drift/migration 测试通过。
- 最新文档 HEAD `35fbfac7d23c3a5fb0bd199fe560ff088c8f7791` 的 Push [42493962678](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493962678) 与 PR [42493967270](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42493967270) 也全部成功；README、迁移指南、SPEC 与 CHANGELOG 已同步恢复演练内容及“审批校验不应用变更”的边界。
- PR #2 保持 Draft / Open；未合并、未修改 `main`、未进行真实项目试点。

## 下一步（按既定优先级）

1. 完成对本轮迁移恢复演练文档与测试边界的最终检查；不开发自动应用器。
2. 复核版本元数据是否应该作为项目内普通受管文件继续升级，还是改为仅在 `.agent-standards.json` 中记录；当前行为已测试并显式纳入审批，不要悄悄排除。
3. 优先设计并测试成功升级后的 manifest 基线推进工具（仅对已审批且实际文件哈希匹配的路径推进），明确失败时如何回滚登记。
4. 补充一份最小人工迁移记录样例，示范如何归档 plan JSON、review JSON、备份引用、失败日志和恢复验证结果。
5. 然后再回到七大方向中未完成项，不开展真实 SaaS 项目试点。
## 恢复工作的方法

新会话先读取本文件、`SPEC-v2.0.md`、当前 `git status --short --branch` 和相关测试；不要把旧聊天摘要当作仓库事实。遇到客户端行为变更时，先核对该客户端的官方文档，再修改兼容性说明和契约测试。
