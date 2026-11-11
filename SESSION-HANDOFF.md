# 会话交接：Agent 项目开发规范 3.0

更新时间：2026-11-11

## 项目目标与边界

- 仓库：`broadteam/agent-develop-project-standards`。
- 目标：建立跨 Agent、跨项目可复用的轻量工程治理底座；规则、项目事实、用户意图与验证结果各有明确权威来源。
- 核心原则：规则清晰、上下文精简、任务连续、边界可靠、验证真实。
- 不把真实 SaaS 项目作为当前规范改进的验收前提；先使用可重复 fixture 与 CI，真实试铺作为补充证据。
- 不合并 PR、不修改 `main`，除非用户另行明确授权。
- 不 bump 版本、不打 tag，直到整条设计经过整体审查。

## 当前仓库状态（必须现场核对）

- 稳定模板版本：`3.0.0`。
- `main` 审查基线：`02f8dde262455f15029a54694e129b05b70013a4`；本轮未修改 `main`。
- 安全迁移修复 PR #3 独立于目标连续性工作；不要自动合并或关闭。
- 目标连续性为依赖式 Draft PR 链：#4 → #5 → #6 → #7 → #8 → #9；每个 PR 的 base 指向前一阶段分支，不能越级合并。
- PR #4：目标基线与追加式变更账本。
- PR #5：目标到需求/验证证据追踪模型。
- PR #6：Node/Python 双端追踪完整性校验。
- PR #7：每轮对话意图分类、冲突裁定与恢复点协议。
- PR #8：多阶段状态转换模拟测试。
- PR #9（本轮）：任务开工/收口意图对齐审查与双端状态校验。
- 所有 PR 均应保持 Draft，直到整体审查完成；CI 结论必须按具体 head SHA 现场查询。

## 已建立的连续性模型

- `.spec/intent/BASELINE.md`：原始问题、目标、约束、Non-goals 和成功判据。
- `.spec/intent/CHANGES.md`：用户意图变化追加记录；Agent 推断保持 pending。
- `.spec/requirements/INDEX.md`：Rnnn 可验收需求。
- `.spec/verification/INDEX.md`：Vnnn 证据及被验证 commit。
- 任务卡、里程碑通过 G/R/C/V ID 形成追踪关系。
- `.memory/MEMORY.md` §0 保存执行断点与 G/R/T 恢复锚点，不复制完整历史。

## 第六阶段：意图对齐审查（当前工作）

- 标记 `意图对齐：required` 的跟踪任务，在 `in_progress` 前填写任务卡「开工意图对齐」：目标/需求锚点、accepted C、预期贡献、保留约束。
- 进入 `review` / `done` 前填写「收口意图对齐」：计划与实际差异、偏离理由、commit SHA、V 证据、目标/需求影响和后续动作。
- 收口分类：`aligned`、`justified_adjustment`、`user_confirmed_change`、`unresolved_drift`。
- `user_confirmed_change` 必须有 accepted C；`unresolved_drift` 不得标为 `done`。
- 里程碑关闭前对照目标成功判据和需求验证证据；任务 done 数量不代表目标完成。
- 意图对齐由独立 Node/Python 模块校验，接入既有追踪入口；旧任务卡/里程碑没有 opt-in 字段时保持兼容。
- 任务引用的 V 证据必须覆盖关联需求，并与收口 Commit SHA 一致；没有 V 时写可复现命令/步骤及结果。
- 已完成里程碑必须有独立对齐回顾；关联需求需 verified 或有 accepted defer/withdrawal 决策，任务须 done/dropped，且不能有未解决漂移。
- 机器校验状态和引用，不声称证明代码语义；语义判断必须检查实际 diff、验收判据与测试。

## PR #9 最终验证

- 最新 head：`4d8c59a64cafd70d0e99a85a4e51f32cf9ae84a0`。
- GitHub Actions run：`42885360355`，针对该 head 的 8 个 Ubuntu/Windows × Node 22/24 × Python 3.11/3.13 job 全部通过。
- 意图对齐逻辑采用独立 Node/Python 模块：`intent-alignment-check.cjs` 与 `intent_alignment_check.py`，由既有追踪校验入口调用。
- 任务开工校验 G/R 锚点、accepted C、预期贡献和约束；收口校验偏离结论、Commit SHA、V 证据覆盖和影响说明。V 必须覆盖任务关联需求，并与收口 SHA 一致。
- 已完成里程碑要求独立回顾、需求 verified 或有 accepted defer/withdrawal、包含任务 done/dropped，且不存在未解决漂移。
- 老任务卡/老里程碑未显式 opt-in 时不追溯性阻断；新模板默认 required。纯支撑工作可 not_applicable，但要说明豁免理由且不能有直接 G/R 关联。
- 自动检查只能证明结构、引用和记录一致，不能替代 Agent 阅读实际 diff、目标成功判据和测试结果的语义审查。
- 较早的 `e141b3f` CI 语法检查失败已由后续结构调整修复；不得把旧失败当作当前 head 结果。

## 第七阶段：3.0 一致性审查（进行中）

- 发现 `.memory/MEMORY.md` 被部分文件过度描述为“唯一项目状态源”；修正为分域权威来源，MEMORY 只保留跨会话断点与稳定事实摘要。
- 宪法“批量写入原子且一键回退”与初始化器实际只能对可捕获异常尽力回滚的边界不一致；改为明确恢复边界，不夸大事务保证。
- 新任务/里程碑仅靠 `意图对齐` 字段 opt-in，删除字段即可绕过；新模板增加创建日期，校验器据此识别新记录，同时保留没有日期/模式的旧记录兼容。
- 完成任务引用 V 证据时要求结果为 pass；里程碑引用的 V 证据必须与里程碑交付 Commit SHA 一致。
- task-context resolver 将 project-profile 从 unconditional read 移到 optional read，避免每个任务都加载画像。
- `AGENTS.md` 的初始安装体积仅给项目自有规则留下 486B，低于 `test-init` 要求的 1024B；已移除与 `ROUTER.md` 重复的文档地图和与 README/DEPLOY 重复的 Hook 操作说明，精简后约 5.7KB，显著降低每轮 L0 上下文成本。
- 复查发现 README 设计边界与 CLIENTS.md 仍把 `.memory/` 说成全局权威；已同步修正 README、CLIENTS、SPEC-v2.0 与 PROJECT-ADAPTATION：各领域仓库文件为权威来源，客户端私有记忆只镜像 MEMORY §0 断点。
- PROJECT-ADAPTATION 的固定上下文清单也已与 resolver 一致：project-profile 由工具读取计算，Agent 只在需要时加载相关字段。
- 第一次 CI 明确暴露上述 AGENTS 预算失败（Ubuntu 四个矩阵任务）；按测试定义压缩 L0 入口后，最新 head `079cb271cfa1863ce4e4c6c4a9dd20ef88abfbfc` 的 CI run `42954213177` 在 Ubuntu/Windows × Node 22/24 × Python 3.11/3.13 的 8 个 job 全部通过。
- 本阶段代码与文档已写入 Draft PR #10，尚未合并；继续保持 PR #4–#10 的整体审查边界。

## 工程边界

- 不急于新增卸载器；治理资产退役属于归档、备份和人工审查流程。
- 不为意图连续性增加平行任务系统；复用现有任务卡、路线图、记忆与 ADR。
- 不要求每轮对话都记账；只记录影响长期目标、范围、验收、约束、优先级或关键决策的增量。
- 轻量任务不强制建卡；只对跟踪/高风险任务启用完整意图对齐审查。
- 未确认的用户意图变化、Agent 推断或未解决漂移不能被升级成项目事实。

## 恢复工作

1. 现场检查 `main`、PR #3–#9、所有依赖分支和 head SHA。
2. 读取本文件、PR #9 最新 diff、相关 checker/test 与 CI 运行。
3. 不信任旧会话摘要覆盖 GitHub 实际状态；发现冲突时以 Git 文件和可复现测试为准。
4. 下一步优先审查 PR #4–#9 的整体一致性、入口预算、规则重复和版本依赖，再决定是否合并或升级版本。
