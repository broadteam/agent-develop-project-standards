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
- 上次交接基线：`16bac051499371f7157505789f0116fa9bb536f3`；当前 HEAD 请以 GitHub 分支实时指针为准，避免交接文件因后续提交而过期。
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

## 下一步（按优先级）

1. 继续审查第五方向的迁移回滚与边界案例，重点验证不同初始化版本/已有用户定制冲突时的恢复说明；只补可以复现的风险。
2. 审查第一、第六、第七方向的发布门槛，优先补机器可验证缺口，避免扩大初始化器职责。
3. 真实 Codex/Claude/Gemini/Cursor CLI 集成验证仍未完成；若增加，必须记录客户端版本与可重复 fixture。

## 恢复工作的方法

新会话先读取本文件、`SPEC-v2.0.md`、当前 `git status --short --branch` 和相关测试；不要把旧聊天摘要当作仓库事实。遇到客户端行为变更时，先核对该客户端的官方文档，再修改兼容性说明和契约测试。
