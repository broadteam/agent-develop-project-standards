# {{PROJECT_NAME}} — 跨会话记忆

> **唯一记忆。** 换 agent 不改这里，也不新建第二份。完整历史在 `.memory/archive/`。

## §0 断点（每次收口覆盖，6 行内）

- **{{TODAY}} 状态**：{{CURRENT_STATE}}
- 正在做：{{IN_PROGRESS}}
- 卡住的：{{BLOCKED}}
- 下一步：{{NEXT}}

## §1 这是什么

{{PROJECT_PITCH}}

## §2 关键事实（不看代码也必须知道的）

| 项 | 事实 |
|---|---|
|  |  |

## §3 已定决策（详见 `.spec/adr/`）

- 

## §4 待验证（不要当结论用）

1. 

## §5 指针

| 要做什么 | 去哪 |
|---|---|
| 开工前必读 | `AGENTS.md` → `.spec/00-constitution.md` |
| 改架构 | `.spec/01-architecture.md` + `.spec/REGISTRY.md` |
| 提交前检查 | `node scripts/check-governance.cjs` |
| 查踩过的坑 | `.memory/PITFALLS.md` |
| 查历史细节 | `.memory/archive/` |
