# 会话交接：Agent 项目开发规范 3.0

更新时间：2026-11-11（能力开关交叉审查与规则冲突审查进展）

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
- PR #9：任务开工/收口意图对齐审查与双端状态校验。
- PR #10（本轮）：3.0 一致性审查修复，base 为 PR #9 分支 `feat/intent-alignment-review`。
- 所有 PR 均应保持 Draft，直到整体审查完成；CI 结论必须按具体 head SHA 现场查询。

## 已建立的连续性模型

- `.spec/intent/BASELINE.md`：原始问题、目标、约束、Non-goals 和成功判据。
- `.spec/intent/CHANGES.md`：用户意图变化追加记录；Agent 推断保持 pending。
- `.spec/requirements/INDEX.md`：始终启用的 Rnnn 可验收需求。
- `.spec/verification/INDEX.md`：始终启用的 Vnnn 证据及被验证 commit。
- 仅在启用 `task_tracking` 时，`.spec/tasks/index.md` 与任务卡维护任务状态；仅在启用 `roadmap` 时，`.spec/roadmap/INDEX.md` 与里程碑详情维护阶段状态；仅在启用 `adr` 时，`.spec/adr/` 维护架构决策。
- 对应能力启用时，任务卡/里程碑通过 G/R/C/V ID 形成追踪关系；关闭能力时保留历史文件，但不要求新建对应记录或执行该能力专属门禁。
- `.memory/MEMORY.md` §0 保存执行断点与 G/R/T 恢复锚点；T 锚点仅在启用 `task_tracking` 时使用，不复制完整历史。

## 第六阶段：意图对齐审查（已完成的阶段成果）

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

### 已完成的统一性修复

- **分域权威来源**：意图、需求、验证分别以 `.spec/intent/`、`.spec/requirements/INDEX.md`、`.spec/verification/INDEX.md` 为始终启用的权威来源；任务、里程碑、架构决策分别仅在启用 `task_tracking`、`roadmap`、`adr` 时以各自的索引/目录为权威。`.memory/MEMORY.md` 只保留稳定事实摘要与跨会话断点，不是任何可选领域的替代状态源。
- **恢复边界**：修正宪法对多文件写入原子性和一键回退的过度承诺；初始化器只对可捕获异常提供 best-effort rollback，不承诺进程强杀/断电下的原子事务。
- **意图对齐 opt-in**：新建任务/里程碑带创建日期，日期格式合法但缺少模式会失败；没有日期和模式的旧记录继续兼容。
- **证据完整性**：done 任务需要 pass V 证据；里程碑 V 证据绑定其声明的交付 Commit SHA 集合，支持多 Commit。
- **上下文成本**：task-context resolver 不再无条件读取完整 project-profile；画像字段按需加载。AGENTS 源模板当前为 12,056B / 12,288B，留有 232B；初始化预算测试要求安装后仍至少保留 1,024B 项目自有规则空间，并已通过。
- **文档一致性**：README、CLIENTS、SPEC-v2.0、PROJECT-ADAPTATION 与 AGENTS/Constitution/MEMORY 对分域事实源的描述已同步；PROJECT-ADAPTATION 不再把 project-profile 作为每轮固定上下文。

### 能力开关审查：已确认的规则模型

**不可关闭的 core 契约**：安全与授权边界、原始意图基线/变更账本、需求索引、验证证据索引、统一规则入口与事实来源诚信。requirements、verification 和 intent continuity 没有独立的关闭开关；它们不应因关闭任务卡或里程碑而消失。

**可选 toggle**：`task_tracking`、`roadmap`、`adr`、`module_boundaries`、`multi_agent`、`stack_rules`。其中 roadmap 依赖 task_tracking；`memory_mode`、`quality_gates`、`release_governance` 是 profile 档位，不是 off/on toggle。意图对齐不是独立全局开关，而是跟随已启用的任务/里程碑记录执行。

### 能力开关交叉审查发现与修复

1. **AGENTS 的复合能力块裁剪**：原 `cap:task_tracking,roadmap` 把两个独立能力绑在一起；现在分别渲染任务与里程碑指引，避免 task_tracking=on、roadmap=off 时一起删除。
2. **ADR / stack_rules / module_boundaries 关闭后仍被引用**：AGENTS、ROUTER、Constitution、Architecture 的可选指引改为按能力渲染；ADR 关闭时，用户裁定仍然有效，记录可放任务/PR 审查记录；模块边界关闭时不再要求执行该能力专项门禁。
3. **关闭能力后历史记录仍被强制校验**：Node/Python traceability 与 intent-alignment checker 接收 task_tracking/roadmap 状态；对应能力关闭时保留历史文件，但跳过相应索引、详情和对齐门禁。核心需求与验证证据仍继续校验。
4. **roadmap 与 task_tracking 触发条件不一致**：milestone_planning 也触发 task_tracking auto；roadmap=on/auto 不得绕过 task_tracking=off 的依赖约束。
5. **task_tracking 关闭导致原始意图丢失**：跨会话、高不确定性或高影响工作仍需读取 BASELINE 和 CHANGES，不再把意图恢复错误地绑定到任务卡能力。
6. **task_tracking 关闭仍强制任务卡**：已有根目录 TODO/PLAN 文件不再被误排除白名单；关闭任务跟踪时不自动导入任务卡、不禁止项目原有唯一计划入口。对应根目录计划文件禁用规则也按能力裁剪。
7. **task_tracking 关闭仍要求活跃需求必须有任务卡**：活跃需求的“必须有任务或 pass 证据”门禁仅在 task_tracking 启用时执行；需求标记 verified 时仍必须有有效 pass V 证据。
8. **多 Agent 能力缺少可操作约定**：multi_agent 启用时提供最小协议：工作区/分支与写入范围声明、共享状态单写者、写入前刷新 Commit/文件、显式交接验证状态。它是 Agent 行为约定，不是分布式锁或机器可证明的并发安全保证。
9. **能力依赖重复硬编码**：roadmap、stack_rules、release_governance 的依赖转由 capabilities 注册表声明，Node/Python profile validator 使用同一 resolver 语义。
10. **能力关闭组合回归**：测试覆盖 all-off、task_tracking on + roadmap/ADR/stack_rules/module_boundaries off + multi_agent on、关闭后保留历史任务/里程碑、关闭后保留根目录计划文件，以及 Node/Python 追踪输出一致。

### PR #10 最新功能验证基线

- 分支：`feat/governance-consistency-audit`。
- 最新已验证功能提交：`0de4d92b686afb7b704aa96ab4c2668fee54fd75`。
- Base：PR #9 的 `feat/intent-alignment-review`，Base SHA `c98c99a9f39693f893300e990cd6770064438e42`。
- 功能提交时 PR #10 为 Open + Draft，27 个提交、32 个变更文件；未合并。
- Push Actions run `43051975761`：8/8 Ubuntu/Windows × Node 22/24 × Python 3.11/3.13 全部通过。
- Pull Request Actions run `43051986512`：同一矩阵 8/8 全部通过。
- 两个 CI 结果严格绑定 `0de4d92...`。本次 Handoff 文档更新发生在该功能提交之后，属于文档变更；新会话仍须现场核对它产生的实际 HEAD 与 CI，不能把上述结果自动转移到后续提交。
- `main` 仍为 `02f8dde262455f15029a54694e129b05b70013a4`；本轮未修改 main。PR #3–#10 的状态与依赖关系均需新会话现场复核。

### 尚未完成

- 第一优先级：能力开关交叉审查的代表性组合、初始化器裁剪、Node/Python 可选门禁行为和文档语义已完成一轮修复并通过 CI。已明确 `auto` 是任务级规则加载策略，不代表轻量任务强制建卡；静态检查仍校验实际存在的可选索引/记录。当前 fixture 覆盖关键组合，但不声称穷尽所有可能配置组合。
- 第二优先级（进行中）：规则重复与冲突审查已发现并修正两处遗漏：
  1. `template/.memory/MEMORY.md` 原先无条件将任务目录列为权威源；现已明确任务/里程碑/ADR 的权威路径仅在对应能力启用时成立，§0 的 T 锚点和 log 指引也按 task_tracking 条件化。
  2. `PROJECT-ADAPTATION-v2.0.md` 要求关闭 `module_boundaries` 后仍保留基础架构事实，但 `template/.spec/01-architecture.md` 曾把基础依赖方向原则一并裁剪；现将核心单向依赖原则保留，模块依赖矩阵和专项门禁仍受开关控制。AGENTS 的权威来源摘要也已补入独立的 roadmap 条件。
- README 的意图对齐章节前后分别承担使用概览和检查器/验收细节，当前属于摘要与详细说明的分层，不应为去重而删除必要的下游实现说明；后续继续检查其他真正的重复定义和优先级冲突。
- 第三阶段：四类任务上下文成本审查（轻量维护、普通跟踪、跨会话持续开发、高风险架构/数据变更），量化必须/可选读取集与预算。
- 第四阶段：升级兼容性审查，覆盖空项目初始化、已有项目升级、旧记录兼容、能力开关变更和人工存档恢复。
- Session Continuity Protocol 仍是后续正式设计方向；本阶段不开始新增协议子系统。保留七个方向：Bootstrap、Context Freshness、Intent Continuity、Checkpoint、Concurrency Control、Handoff、Evidence Provenance。
## ChatGPT / Agent 跨会话恢复协议

- 不依赖旧会话全文或模型隐式记忆恢复项目；本文件是本仓库当前工作交接入口，不取代各领域权威状态文件。
- 新会话开始时，先读取本文件，再现场核对 `main`、PR #3–#10 的状态、依赖分支 head、PR #10 diff 和对应 CI；不得把交接记录中的旧 SHA/状态当作实时事实。
- 然后按当前工作读取相关领域文件和测试，不要无差别加载整个仓库；优先复用已有 fixture、校验器和 CI。
- 每次工作收口时更新本文件：记录完成项、未完成项、决策、最新分支/Commit/PR/CI、风险和唯一明确的下一步。不要复制任务索引或完整对话。
- 若当前会话上下文接近上限，先完成可验证的最小提交，再更新本文件并给用户一段可复制的新会话启动指令；不能确认的事项标为未知，不得猜测。

## 工程边界

- 不急于新增卸载器；治理资产退役属于归档、备份和人工审查流程。
- 不为意图连续性增加平行任务系统；复用现有任务卡、路线图、记忆与 ADR。
- 不要求每轮对话都记账；只记录影响长期目标、范围、验收、约束、优先级或关键决策的增量。
- 轻量任务不强制建卡；只对跟踪/高风险任务启用完整意图对齐审查。
- 未确认的用户意图变化、Agent 推断或未解决漂移不能被升级成项目事实。

## 恢复工作

1. 现场检查 `main`、PR #3–#10、所有依赖分支和 head SHA；确认 PR #10 的 Handoff-only 更新提交及其 CI。
2. 读取本文件、PR #10 当前 diff、能力注册表、AGENTS/Constitution/SPEC/README/ROUTER/MEMORY 与相关 checker/test。
3. 继续第二优先级：规则重复、冲突优先级、单一权威来源与实际工具行为交叉审查；发现问题按文件与可复现依据记录。
4. 随后进入上下文成本审查，再进入升级兼容性审查。不得把代表性 fixture 描述为所有开关组合均已穷尽。
5. 不信任旧会话摘要覆盖 GitHub 实际状态；发现冲突时以 Git 文件和可复现测试为准，不合并 PR、不改 main、不 bump 版本。
