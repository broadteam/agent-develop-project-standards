# Router — 你要做的事在哪

> 每行必须短。新增入口才加行；一个主题只准有一个权威文件。

| 你要做的事 | 权威在哪 | 入口 |
|---|---|---|
| 开工前搞清楚什么不能做 | 红线清单 | `.spec/00-constitution.md` |
| 判断项目类型、风险、能力开关和验证命令 | 项目画像（只读相关字段） | `project-profile.toml` |
| 改架构 / 加模块 | 进程或分层模型、接口契约 | `.spec/01-architecture.md` |
| 查某个 ID / 名称 / 字段叫什么 | 标识符唯一登记处 | `.spec/REGISTRY.md` |
| 恢复项目最初目标、检查后续需求变化 | 原始目标基线与变更账本 | `.spec/intent/BASELINE.md`、`CHANGES.md` |
| 决定跨语言命名、提交信息、文案怎么写 | 通用约定 | `.spec/02-conventions.md` |
| 查当前语言/框架的具体约束 | 技术栈规范 | `.spec/stacks/<stack>.md` |
| 打包、发版、产物放哪 | 构建命令、发布检查单 | `.spec/03-delivery.md` |
<!--cap:task_tracking-->
| 知道现在该做什么（几天内） | 任务卡索引（唯一状态源） | `.spec/tasks/index.md` |
<!--/cap-->
<!--cap:roadmap-->
| 知道这个阶段要做什么（几周） | 里程碑索引 | `.spec/roadmap/INDEX.md` |
<!--/cap-->
| 想写 TODO / 计划 / 待办清单 | 先看计划该放哪 | `AGENTS.md` §2.5 |
| 担心读太多费 token | 分级读取规则 | `AGENTS.md` §2.6 |
| 判断当前任务需要加载哪些规范 | 任务上下文解析器（复杂/高影响任务可选） | `node .standards/task-context-resolver.cjs` |
| 推翻一个既有设计 | ADR 模板与已有决策 | `.spec/adr/README.md` |
| 查踩过的坑 | 判据与实证 | `.memory/PITFALLS.md` |
| 交接 / 换 agent | 断点与关键事实 | `.memory/MEMORY.md` |
