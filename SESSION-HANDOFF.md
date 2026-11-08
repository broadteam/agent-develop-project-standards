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

## 下一步（按优先级）

1. 审查第四方向“任务、看板与路线图管理”：验证索引、卡片、归档、里程碑依赖及 BOARD 派生关系是否形成一致闭环，重点找真实可复现的边界缺口。
2. 继续审查第一、第五、第六、第七方向的发布门槛，优先补机器可验证缺口，不为形式增加工具。
3. 真实 Codex/Claude/Gemini/Cursor CLI 集成验证仍未完成；若增加，必须记录客户端版本与可重复 fixture。

## 恢复工作的方法

新会话先读取本文件、`SPEC-v2.0.md`、当前 `git status --short --branch` 和相关测试；不要把旧聊天摘要当作仓库事实。遇到客户端行为变更时，先核对该客户端的官方文档，再修改兼容性说明和契约测试。
