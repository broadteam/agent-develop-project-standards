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
- 本次已根据官方文档修正适配矩阵：Codex 的同目录 `AGENTS.override.md` 替代 `AGENTS.md`；Claude 导入上限为四跳；Cursor 支持根目录和子目录 `AGENTS.md`，更具体的目录优先。
- `tests/test-migration-v2.cjs` 已通过临时 fixture 演练了 2.0 迁移的安全路径；CI 已扩展至 Ubuntu 和 Windows。

## 本机验证结果

- 本机通过：`test-migration-v2`、`test-policy`、`test-task-context-resolver`、`test-client-adapters`、`test-v2-spec`。
- 本机未安装可用 Python，因此没有将 `test-init`、`test-parity`、`test-capability-resolver` 记为本机通过。
- CI 已在 Ubuntu 与 Windows 的 Python 3.11 环境完整通过；最近核验 run [42456349544](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42456349544) 与 [42456344833](https://github.com/broadteam/agent-develop-project-standards/actions/runs/42456344833) 均成功。

## 下一步（按优先级）

1. 复核迁移 fixture 的重复初始化幂等性，以及 `test-doc-links` 对 Markdown 链接语法的覆盖边界。\n2. 继续逐项审查七大方向，先补机器可验证缺口，再更新 `SPEC-v2.0.md` 的状态表。不要只因文档存在就把方向标记完成。
3. 真实 Codex/Claude/Gemini/Cursor CLI 集成验证仍未完成，不能宣称支持已端到端验证；若要增加，必须记录每个客户端的版本与可重复 fixture。

## 恢复工作的方法

新会话先读取本文件、`SPEC-v2.0.md`、当前 `git status --short --branch` 和相关测试；不要把旧聊天摘要当作仓库事实。遇到客户端行为变更时，先核对该客户端的官方文档，再修改兼容性说明和契约测试。
