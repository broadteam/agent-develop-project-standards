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
- 本次接手前远端基线：`7ca0a691b34ec975a42ea57fa2b5fc901b4024a2`。
- 相关 PR：#2（Draft；不要合并）。

## 已完成

- 2.0 七大方向的设计基线在 `SPEC-v2.0.md`；能力画像、治理检查、任务上下文解析器与模板夹具测试已在该分支实现。
- 多客户端入口维持单一正文：`template/AGENTS.md` 是正文，`CLAUDE.md` 和 `GEMINI.md` 仅导入它；不生成废弃的 `.cursorrules`。
- 客户端适配测试覆盖模板契约及初始化后的 fixture，不等同于真实 CLI 端到端验证。
- 本次已根据官方文档修正适配矩阵：Codex 的同目录 `AGENTS.override.md` 替代 `AGENTS.md`；Claude 导入上限为四跳；Cursor 支持根目录和子目录 `AGENTS.md`，更具体的目录优先。

## 本机验证结果

- 通过：`test-policy`、`test-task-context-resolver`、`test-client-adapters`、`test-v2-spec`。
- 受环境阻断：`test-init`、`test-parity`、`test-capability-resolver` 都需要 Python；此 Windows 工作环境的 `python`/`python3` 解析为 Microsoft Store 占位程序，未安装可执行 Python。因此没有将这些测试记为通过。
- GitHub Actions 已设置 Python 3.11；推送后应以 CI 复核完整 Node/Python parity。

## 下一步（按优先级）

1. 为客户端规则冲突裁决补充可执行的 fixture：全局、项目和局部规则如何组合，以及 `AGENTS.override.md` 不可与普通同目录规则同时被误述为叠加。
2. 用临时 fixture 演练 `MIGRATION-v2.0.md`，涵盖空项目、既有文件、多栈、自定义 Hook、Windows 与 POSIX 路径；不接入真实业务项目。
3. 继续逐项审查七大方向，先补机器可验证缺口，再更新 `SPEC-v2.0.md` 的状态表。不要只因文档存在就把方向标记完成。
4. 在具备 Python 3.10+ 的环境运行完整测试集，并在 PR 的 CI 状态绿后记录证据。真实 Codex/Claude/Gemini/Cursor CLI 集成验证仍未完成，不能宣称支持已端到端验证。

## 恢复工作的方法

新会话先读取本文件、`SPEC-v2.0.md`、当前 `git status --short --branch` 和相关测试；不要把旧聊天摘要当作仓库事实。遇到客户端行为变更时，先核对该客户端的官方文档，再修改兼容性说明和契约测试。
