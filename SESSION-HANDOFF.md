# 会话交接：Agent 项目开发规范 3.0

更新时间：2026-11-12（3.0 一致性、上下文成本与升级兼容性第一轮收口）

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
- **上下文成本与扩展空间**：AGENTS 源模板从 12,229B 精简至 10,885B；按默认能力渲染后为 9,613B，`multi_agent=on` 最坏渲染为 10,135B。12,288B 预算下，最坏组合仍留 2,153B；`test-init` 已增加 `multi_agent=on` 实际安装余量不少于 1,024B 的回归。
- **文档一致性**：README、CLIENTS、SPEC-v2.0、PROJECT-ADAPTATION 与 AGENTS/Constitution/MEMORY 对分域事实源的描述已同步；PROJECT-ADAPTATION 不再把 project-profile 作为每轮固定上下文。
- **路由闭环**：ROUTER 新增 core 需求索引与验证证据索引入口；`test-capability-resolver` 固定这两个入口，避免任务/验收文档引用 R/V ID 却没有统一导航。
- **规则记录落点**：关闭 ADR 时，决策/例外统一写入 `.spec/01-architecture.md` 或 PR 审查记录，不依赖可能不存在的 task record；关闭 task_tracking/roadmap/adr 时，对应事实源路径不再被写成无条件权威来源。
- **Node/Python Resolver 一致性**：两端对 `auto/deferred` 能力依赖和 `requires_stack` 使用相同语义；`stack_rules=on` 要求 `profile.status=confirmed` 且至少存在一个格式合法的非 `generic` 技术栈 ID。畸形非数组、空字符串或非法大小写的 `stack.detected` 不得满足要求。
- **Node/Python Profile Validator 一致性**：增加最终 errors/warnings 级对照测试；修正 strict quality gate 在整个 `[verification]` 区块缺失时的诊断差异。Python 对照脚本禁用字节码缓存，避免生成 `.pyc` 污染模板漂移扫描。
- **自动化承诺边界**：PROJECT-ADAPTATION 明确 registry `validation` 是人工/Agent 验收指导，不会仅因写入 JSON 就自动执行；结构化依赖、画像规则和实际 checker 才构成机器门禁。模块依赖需要项目架构测试；multi_agent 是行为协议而非分布式锁。
- **变更日志结构**：CHANGELOG 的多个重复 `## Unreleased` 已合并为一个区块，文档测试固定该结构。

### 能力开关审查：已确认的规则模型

**不可关闭的 core 契约**：安全与授权边界、原始意图基线/变更账本、需求索引、验证证据索引、统一规则入口与事实来源诚信。requirements、verification 和 intent continuity 没有独立的关闭开关；它们不应因关闭任务卡或里程碑而消失。

**可选 toggle**：`task_tracking`、`roadmap`、`adr`、`module_boundaries`、`multi_agent`、`stack_rules`。其中 roadmap 依赖 task_tracking；`memory_mode`、`quality_gates`、`release_governance` 是 profile 档位，不是 off/on toggle。意图对齐不是独立全局开关，而是跟随已启用的任务/里程碑记录执行。

### 能力开关交叉审查发现与修复

1. **AGENTS 的复合能力块裁剪**：原 `cap:task_tracking,roadmap` 把两个独立能力绑在一起；现在分别渲染任务与里程碑指引，避免 task_tracking=on、roadmap=off 时一起删除。
2. **ADR / stack_rules / module_boundaries 关闭后仍被引用**：AGENTS、ROUTER、Constitution、Architecture 的可选指引改为按能力渲染；ADR 关闭时，用户裁定仍然有效，记录放在 `.spec/01-architecture.md` 或 PR 审查记录，不依赖 task_tracking；模块边界关闭时不再要求执行该能力专项门禁。
3. **关闭能力后历史记录仍被强制校验**：Node/Python traceability 与 intent-alignment checker 接收 task_tracking/roadmap 状态；对应能力关闭时保留历史文件，但跳过相应索引、详情和对齐门禁。核心需求与验证证据仍继续校验。
4. **roadmap 与 task_tracking 触发条件不一致**：milestone_planning 也触发 task_tracking auto；roadmap=on/auto 不得绕过 task_tracking=off 的依赖约束。
5. **task_tracking 关闭导致原始意图丢失**：跨会话、高不确定性或高影响工作仍需读取 BASELINE 和 CHANGES，不再把意图恢复错误地绑定到任务卡能力。
6. **task_tracking 关闭仍强制任务卡**：已有根目录 TODO/PLAN 文件不再被误排除白名单；关闭任务跟踪时不自动导入任务卡、不禁止项目原有唯一计划入口。对应根目录计划文件禁用规则也按能力裁剪。
7. **task_tracking 关闭仍要求活跃需求必须有任务卡**：活跃需求的“必须有任务或 pass 证据”门禁仅在 task_tracking 启用时执行；需求标记 verified 时仍必须有有效 pass V 证据。
8. **多 Agent 能力缺少可操作约定**：multi_agent 启用时提供最小协议：工作区/分支与写入范围声明、共享状态单写者、写入前刷新 Commit/文件、显式交接验证状态。它是 Agent 行为约定，不是分布式锁或机器可证明的并发安全保证。
9. **能力依赖重复硬编码**：roadmap、stack_rules、release_governance 的依赖转由 capabilities 注册表声明，Node/Python profile validator 使用同一 resolver 语义。
10. **能力关闭组合回归**：测试覆盖 all-off、task_tracking on + roadmap/ADR/stack_rules/module_boundaries off + multi_agent on、关闭后保留历史任务/里程碑、关闭后保留根目录计划文件，以及 Node/Python 追踪输出一致。

### 第三优先级：上下文读取成本审查（已完成第一轮量化与修复）

**计算口径**：UTF-8 字节是可复核的上下文体积代理，不等同于模型 Token 数；表内按默认安装渲染的 AGENTS（9,613B）加 MEMORY §0（679B）计算。多 Agent 启用时 AGENTS 为 10,135B，所有场景在此基础上增加 522B。

| 任务类别 | 必须读取集（UTF-8 B） | 条件/可选读取 |
|---|---:|---|
| 轻量维护（单文件、本地、低风险） | 15,184B | project-profile 661B（仅核实画像/能力时） |
| 普通跟踪任务 | 34,719B | verification INDEX 2,028B、task log 459B、project-profile 661B |
| 跨会话持续开发（示例：task_tracking 关闭） | 30,783B | verification INDEX 2,028B、project-profile 661B；不读任务索引/任务卡 |
| 高风险架构/数据变更（带任务与里程碑） | 49,881B | project-profile 661B、task log 459B、REGISTRY 1,463B；项目自定义 stack 文档另计 |

- 固定 L0：AGENTS 9,613B + MEMORY §0 679B = 10,292B；启用 multi_agent 时为 10,814B。`ROUTER.md`、画像全文、任务日志、ADR、历史档案都不是无条件必读。
- 普通跟踪任务新增必读 `.spec/requirements/INDEX.md`，以解析任务卡关联的 Rnnn；`.spec/verification/INDEX.md` 在普通跟踪任务中为条件读取，在 high/critical、高影响、生产、release/incident 工作中为必读。
- 即使 `task_tracking=off`，跨会话/高不确定/高影响工作仍读取 BASELINE、CHANGES 和 requirements INDEX；高风险工作继续读取 verification INDEX。连续性核心不依赖任务卡能力。
- CHANGES 账本当前 10,550B，表中为全文读取的保守上限；Resolver 输出已明确要求按相关 G/R/C 锚点定位对应 Cnnn 记录及后续状态，不通读全部历史。
- Task Context Resolver 运行时内部读取 project-profile（661B）与能力注册表（5,435B）用于决策；这是工具侧读取，不应误计为模型上下文。项目定制 stack 文档与 PITFALLS 等按主题读取，不计入固定集合。
- 本轮修复了原 Resolver 未提示跟踪任务读取 R/V 状态索引的问题，并增加轻量、普通跟踪、跨会话 task_tracking-off、高风险架构/数据四类断言。

### 第四优先级：升级兼容性审查（第一轮完成）

- **空项目与旧项目迁移**：`tests/test-migration-v2.cjs` 覆盖空项目 dry-run/首次安装、旧 1.2.x 项目迁移、多技术栈、既有 AGENTS/Hook/脚本定制保留和重复运行幂等；真实项目外部备份与实际项目测试仍是部署方责任。
- **已有项目安全更新**：`init.cjs --update` 只刷新与上次安装哈希一致的文件，项目修改过的文件保留并报告；3.0 的 `scripts/`→`.standards/` 迁移只删除可证明由模板管理且哈希未变的旧文件。
- **能力开关往返**：`tests/test-init.cjs` 增加已有安装从 task/roadmap/ADR/stack/multi-agent 全关→开启→关闭→重新开启的流程，核对模板文件、AGENTS/ROUTER、`gov.toml [required].files`、Node/Python 门禁，以及用户自有任务卡编辑是否完整保留。回归发现并修复 ADR README 未进入 required 清单、stack_rules 关闭后旧栈预设仍被重新加入 required 清单两个缺陷。
- **模板升级方案边界**：`plan-template-upgrade.cjs` 只读生成逐文件计划；Review validator 绑定 plan ID 与审批字段；record 工具只登记人工已执行且验证过的结果；defer 需要重新计划，存在延期路径时不推进整体版本。不存在自动应用器，也不应把 `init --update` 误当作完整模板升级器。
- **人工恢复演练**：`test-template-upgrade-recovery.cjs` 在临时项目验证外部完整备份、模拟人工审批批次、确定性治理失败、完整恢复、文件树与权限复核、治理/漂移复验。它是 fixture 演练，不代表用户真实业务数据备份已演练。
- **旧项目基线采纳**：`adopt-template-baseline.cjs` 的 dry-run 输出 `plan_id` 绑定完整 template/presets 源快照、目标候选文件内容与权限、现有 `.agent-standards.json` 哈希/权限及采纳结果。确认必须回传 `--expect-plan-id`，并在写入前重新计算快照；项目、manifest 或模板源在审查后变化都会拒绝写入。新增 `test-adopt-template-baseline.cjs` 覆盖 dry-run 无写入、缺失/错误 ID、项目漂移、模板漂移、manifest 漂移及只写 manifest；旧 `test-template-drift.cjs` 已更新为新确认契约。
- **确认机制限制**：这是乐观快照复核，不是跨进程文件锁；执行确认期间应暂停其他项目/模板写入。它不替代外部完整备份，也不提供自动回滚或自动升级应用。
### PR #10 最新功能验证基线

- 分支：`feat/governance-consistency-audit`。
- 最新已验证功能/测试提交：`bc979d59a84e11fc05e86b6574dc58a8c822da44`。
- Base：PR #9 的 `feat/intent-alignment-review`，Base SHA `c98c99a9f39693f893300e990cd6770064438e42`。
- 该提交时 PR #10 为 Open + Draft，69 个提交、38 个变更文件；未合并。
- Push Actions run `43072944062`：8/8 Ubuntu/Windows × Node 22/24 × Python 3.11/3.13 全部通过。
- Pull Request Actions run `43072957574`：同一矩阵 8/8 全部通过。
- 结果严格绑定 `bc979d5...`；本次 Handoff 更新是后续独立文档提交，需要单独核验新 Head CI。
- `main` 仍为 `02f8dde262455f15029a54694e129b05b70013a4`；本轮未修改 main。PR #3–#9 现场仍为 Open + Draft，依赖链 #4→#5→#6→#7→#8→#9 未改变；具体 Base/Head 以实时查询为准。


### 尚未完成与范围边界

- 第一优先级（能力开关交叉审查）：已完成代表性组合、初始化器裁剪、Node/Python 专属门禁和文档语义回归；明确 `auto` 是任务级加载策略，不代表轻量任务强制建卡。测试覆盖关键组合，不声称穷尽所有理论排列。
- 第二优先级（规则冲突与权威来源）：已完成分域事实源、规则关闭后记录落点、自动化承诺边界、Node/Python resolver/profile validator 一致性、CHANGELOG 单一 Unreleased 结构及 R/V Router 导航闭环。不要为追求行数删除合理的“摘要 + 详细规范”分层。
- 第三优先级（上下文成本）：第一轮四类任务读取量化与读取集修复已完成；AGENTS 模板当前 10,906B，默认渲染 9,634B，`multi_agent=on` 最坏渲染 10,156B；最坏组合在 12,288B 预算下仍留 2,132B，其中保留 1,024B 项目自定义规则后还有 1,108B。CHANGES 按 G/R/C 锚点读取，不通读全部历史。
- 第四优先级（升级兼容性）：本轮第一轮完整覆盖已完成，见上节。实际业务项目全量试铺是补充证据，不作为本规范阶段的默认验收前提。
- **有意保留的产品边界**：不增加自动模板升级应用器/自动回滚器；升级通过备份、只读计划、人工审查、独立分支/worktree 手工应用、验证和 metadata 登记。`adopt-template-baseline` 的 plan ID 是乐观快照验证，不是并发文件锁。
- Session Continuity Protocol 仍是后续独立设计方向；当前 3.0 一致性/兼容性审查不实现新子系统。七个方向仍为 Bootstrap、Context Freshness、Intent Continuity、Checkpoint、Concurrency Control、Handoff、Evidence Provenance。


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

1. 新会话先现场核对 `main`、PR #3–#10、所有依赖分支 head；尤其确认本次 Handoff-only 提交对应的 Push/PR CI，不将前一个功能提交的绿灯自动移植到新 Head。
2. 当前四个审查优先级已完成第一轮：能力开关、规则冲突/权威来源、上下文成本、升级兼容性。不要重复执行这些已通过的 fixture；按需读取对应测试与本文件中的具体证据。
3. 下一项工作是对 PR #10 相对 base `c98c99a9f39693f893300e990cd6770064438e42` 的累积 Diff 做最终整体审查：检查跨 PR 依赖、文件所有权、迁移说明、未覆盖边界和真实可用性；遇到新发现再补最小回归。不要为了清零 TODO 而引入未设计的自动升级器/回滚器。
4. PR #10 继续保持 Open + Draft，直到整体审查完成并由用户决定是否标记 Ready；不合并、不改 main、不 bump 版本、不打 tag。
5. Session Continuity Protocol 是后续独立设计阶段，不属于本轮 3.0 审查；启动时再讨论七个方向的协议边界，不在本阶段偷偷扩展范围。


## PR #10 最终累积审查记录（2026-11-12）

- 已现场核对 PR #4–#9 的依赖链：全部 Open + Draft，Base/Head SHA 连续匹配；对应 Head 的 Push/PR 检查记录均为成功。PR #10 仍以 PR #9 的 Head `c98c99a9f39693f893300e990cd6770064438e42` 为 Base，未改变依赖关系。
- 累积 Diff 为 71 commits / 38 files，变更集中在规范模板、初始化器、校验器、文档与回归测试；没有混入业务项目代码。审查重点覆盖能力裁剪、Node/Python 校验器、意图/需求/证据闭环、旧项目基线采纳快照及初始化器的文件保护路径。
- 发现并修复一处真实边界缺陷：无 V 证据的 done 任务原先用子串匹配“通过/成功”，会把“通过率 20%”误判为明确通过。Node 改用 Unicode 字母/数字边界，Python 使用 Unicode `\\w` 边界，并增加跨语言回归用例。
- 修复提交：`a532e0640d4fbeacfa9f6c6dcbc18ef42fc24986`（Node）、`426dcae25650c69c00775f8aef86210063a74557`（Python）、`2af9ad58b364904958793a05e56941a5d581d5f2`（回归测试）。
- 最终累积审查未发现其他已确认的阻断问题。旧项目基线采纳仍是乐观快照复核而非文件锁；初始化器回滚仍不承诺进程强杀/断电事务；这些边界已在规范中明确，不扩大为本轮新增子系统。
- `main` 仍为 `02f8dde262455f15029a54694e129b05b70013a4`，未修改；PR #10 保持 Open + Draft，不合并、不改版本、不打 tag。
- 本记录写入前，修复测试的最新 Head `2af9ad58b364904958793a05e56941a5d581d5f2` Push/PR CI 尚在排队；本次 Handoff 提交会再次触发 CI。必须以本次 Handoff 提交后的最新 PR Head 和 8/8 矩阵结果作为最终验证，不得沿用旧 Head 绿灯。

### 下一步

1. 现场读取 PR #10 最新 Head，确认本 Handoff 提交后的 Push 与 PR CI 均 8/8 成功。
2. 若 CI 通过，结束本轮 3.0 一致性/兼容性审查并向用户提交最终审查摘要；PR 仍保持 Draft，等待用户决定是否标记 Ready。
3. Session Continuity Protocol 七方向进入下一独立设计阶段，不混入本轮 PR #10。


## 最新状态补充（2026-11-12，覆盖此前 PR #10 CI 待验证记录）

### 3.0 阶段正式结项

- PR #10 最新 Head：`88c342536b7d421aafd0b313e07c6f2b1849eab0`。
- Push run `43079739753` 与 Pull Request run `43079746681` 均完成成功；每个 workflow 8/8，合计 16/16 检查通过。
- 当前 PR #10：Open + Draft；Base `feat/intent-alignment-review`，Head `feat/governance-consistency-audit`。不合并、不修改 main、不 bump 版本、不打 tag。
- 现场核对 PR #3–#10：全部 Open + Draft，堆叠依赖链连续；main SHA 仍为 `02f8dde262455f15029a54694e129b05b70013a4`。
- 3.0 一致性与兼容性审查正式结项。之前记录中“CI 尚待验证”的描述仅保留历史背景，以本节最终结果为准。

### Session Continuity Protocol 设计阶段启动

- 新建独立分支：`design/session-continuity-protocol`，起点为 PR #10 已验证 Head `88c342536b7d421aafd0b313e07c6f2b1849eab0`；不修改 PR #10 分支。
- 新增提案：`SESSION-CONTINUITY-PROTOCOL-DESIGN.md`，提交 `837b3d16db969dcbfb049219672a60ca71b537cf`。
- 提案覆盖七个协议域：Bootstrap、Context Freshness、Intent Continuity、Checkpoint、Concurrency Control、Handoff、Evidence Provenance；定义权威来源、Continuity Packet、状态维度、生命周期、失败路径、Non-goals 和分阶段落地路线。
- 设计坚持不新增第二套任务/需求/意图事实源；handoff 与 packet 仅保存引用、快照元数据和恢复断点。客户端私有记忆与聊天历史不作为权威来源。
- 当前仅为 Proposal；尚未冻结 schema、实施 validator、增加强制门禁或要求现有项目迁移。
- 需要用户审查的四项决策：Packet 持久化频率、初版 lease 强度、JSON/YAML/Markdown 表示策略、客户端互操作验收深度。
- 下一步：完成文档内部一致性检查与链接/术语检查，提交独立 Draft PR；随后先冻结 D0 协议语义，不直接跳入代码实现。


### PR #11 创建记录

- 独立 Draft PR #11：`https://github.com/broadteam/agent-develop-project-standards/pull/11`。
- Head 分支：`design/session-continuity-protocol`；Base：`feat/governance-consistency-audit`，Base SHA 为 PR #10 已通过 16/16 CI 的 `88c342536b7d421aafd0b313e07c6f2b1849eab0`。
- PR #11 当前只包含协议设计提案与本交接文档，不改 PR #10 或 main。
- 本记录提交前，PR #11 对应的 Push CI 正在运行；最终结论必须绑定 PR #11 最新 Head，不能用 PR #10 的 CI 结果代替。


## SCP D0 内部审查补充（2026-11-12）

- PR #11 Head `ce9b2806bae45086a3ba4f003dd8f134b8e61db9` 的 16/16 checks 已全部完成成功；Push 与 Pull Request 两组矩阵均通过，覆盖 Ubuntu/Windows、Node 22/24、Python 3.11/3.13。
- 现场复核 PR #11 仍为 Open + Draft，Base `feat/governance-consistency-audit`，Base SHA `88c342536b7d421aafd0b313e07c6f2b1849eab0`。未修改 PR #10 或 main。
- 对照现有 `template/AGENTS.md`、`.spec/00-constitution.md`、`.spec/intent/`、`.spec/tasks/`、`.spec/verification/`、`.memory/MEMORY.md`、`CLIENTS.md` 与 `SPEC-v2.0.md` 完成第一轮 D0 内部审查。
- 发现的主要风险是 SCP 初稿可能被误读为新建第二套状态账本、强制所有会话持久化、把 checkpoint 状态当作领域状态，以及把 Git tree SHA 误当成完整 dirty worktree 快照。
- 已在 `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` 新增 D0 内部一致性审查与现有规范职责映射，并收紧语义：轻量任务不升级；Packet 只保存引用/最小断点；T/M/ADR/lease 按能力和场景选填；checkpoint 不替代领域状态；未提交证据需说明 HEAD、dirty 状态和纳入范围；并发按需启用，branch/worktree 优先；fixture 不等于真实 CLI E2E。
- 文档修订提交：`25600b094cb75d7badd91976b5c059742365d10b`。该提交之后的 CI 必须重新核验，旧 Head 的 16/16 不可移植到新 Head。
- D0 尚未冻结。仍待用户裁定 Packet 持久化策略、表示格式、客户端验收深度和 lease 初版范围；未获明确确认前不进入 D1 Schema 冻结或 validator 实现。

### 当前唯一下一步

读取 PR #11 最新 Head，确认本次文档修订后的 Push/PR CI；然后将上述四项产品决策交由用户裁定。保持 PR #11 Open + Draft、PR #10 Open + Draft；不合并、不改 main、不 bump 版本、不打 tag。


## SCP D0 第二轮边界审查（2026-11-12）

- 已复核 PR #11 最新 Head `4ea88f0784af647e6b836f1afc8a46a5e76285ee`：Push + PR 共 16/16 checks 全部成功。该结论仅绑定该 SHA。
- PR #11 仍 Open + Draft，Base `feat/governance-consistency-audit`，Base SHA `88c342536b7d421aafd0b313e07c6f2b1849eab0`。
- 在首轮 D0 修订基础上继续发现并修正：通用 Agent 无法可靠观察 IDE 未落盘缓冲区；多个待用户决策不能压成单一枚举；审查结论也必须绑定 revision；SESSION-HANDOFF.md 应是可选入口；普通局部测试不应强制创建 V 记录；YAML 示例不得与尚未决定的机器格式冲突。
- 对应设计修订提交：
  - `c18c2d157d6e945afac156c1faf15362a72d6e4e`：澄清工作区可观察状态、决策列表、审查 freshness、可选 handoff 入口和按需 Evidence。
  - `a2770ef992dafd1e823aa39eefb9cebc46ee427d`：统一 Schema 格式决策表述。
- 上述两次提交之后的 CI 需要针对最新 Head 重新核验；不得沿用 `4ea88f0` 的绿灯作为后续 SHA 的验证。
- D0 仍是 proposal / review_pending。四项产品决策尚未得到用户明确裁定，不开始 D1 Schema 冻结或 validator 实现。

### 当前下一步

现场核验 PR #11 最新 Head 的 CI；然后请用户裁定四项产品决策。未获明确决定前，不冻结协议、不增加门禁、不改 PR #10 或 main。


## SCP D0 冻结与 D1 Schema 草案（2026-11-12）

### 用户决策

用户明确同意按此前四项推荐方案继续推进，D0 产品决策已冻结：

1. Packet 只在跨会话暂停、真实交接、重要 checkpoint、阶段收口等有恢复价值的节点持久化；轻量任务不强制生成。
2. JSON Schema 是唯一机器权威契约；Markdown 只能由工具生成，不允许人工双写。
3. 先以至少两个独立客户端 fixture 验证数据/恢复契约，再逐客户端增加真实 CLI E2E 支持证据。
4. 首版并发只要求 branch/worktree 隔离与 owner/write-scope 声明；不引入 Lease 服务、外部锁或仓库内锁协议。只有真实且无法通过隔离解决的共享写冲突出现后，才重新评估。

### D1 已创建的候选文件

- `schemas/scp/0.1/continuity-packet.schema.json`：JSON Schema Draft 2020-12，schema_version `0.1.0`。
- `schemas/scp/0.1/examples/handoff-minimal.json`：最小 handoff packet 示例。
- `schemas/scp/0.1/COMPATIBILITY.md`：版本不可变、未知字段、namespaced extensions、只读回退和状态权威边界的兼容策略草案。
- `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §9/§11.3/§12：已记录 D0 决策和 D1 启动状态。

### 本轮 D1 边界审查

- JSON 文件均可解析；示例的顶层必填字段、顶层属性及各主要嵌套对象属性与 schema 定义一致。
- 修正了工作区状态的重复表达：`code.worktree_state` 是唯一权威字段，不在 checkpoint 中重复。
- 增加顶层 `inferences[]`，明确区分 Agent 推断与观察状态/权威记录；Packet 生成时的观察值在后续消费时只是 last-known，接收方必须现场 Bootstrap。`coordination` 对象为可选，仅在真实并发/所有权边界需要时提供。
- 增补 Schema 状态不变量：running 验证必须有 actor/run_id；blocked 必须有 blocked_reason；observed_dirty 必须列出未提交路径；observed_clean 不允许列出未提交路径；HEAD 不可观察时 worktree_state 必须为 unknown；并发 coordination 若声明隔离则必须给出 owner 与 write_scope。
- `code.observed_at` 与每条 `provenance.source_revisions[].observed_at` 均为必填 RFC 3339 时间；`source_revisions` 至少一条。
- Schema 严格拒绝核心对象未知字段，因此任何核心字段新增（即使 optional）也必须升级 schema_version；仅 producer-specific 扩展放入 namespaced `extensions`。
- Schema 条件约束：`packet_kind=handoff` 时必须提供 handoff；验证状态 passed/failed/stale 或审查状态 reviewed/changes_requested/stale 时必须提供至少一条 evidence_refs。
- 决策以 `decisions[]` 表达多个独立事项，每项有 decision_id、status、decision_maker 和 source_ref；单项确认不构成泛化授权。
- SCP 0.1 不含 lease_ref 或 lease service；协调信息只表达 owner、write_scope 和 isolation。
- Core 对象拒绝未知字段；扩展数据只能放在 namespaced `extensions` 中，不得重定义核心语义。
- **验证限制**：本轮只完成 JSON 语法和结构映射检查；尚未运行正式 JSON Schema validator，也未创建 validator/fixture runner。不能把示例标记为已通过正式 schema 验证。

### 当前状态与下一步

- D0：Frozen（用户已确认）。
- D1：Schema + compatibility policy draft，待语义审查；不接入强制门禁，不实现自动 Packet 写入器。
- PR #11 继续 Open + Draft，PR #10 继续 Open + Draft；不合并、不修改 main、不 bump 版本、不打 tag。
- 下一步：针对 D1 的字段必需性、状态组合、扩展机制和兼容策略做一次独立审查；修订后再决定是否冻结 schema。之后才考虑独立的 validator/fixture 实现提案。


## D1 第二轮语义审查（2026-11-12）

- 决策时间不变量：`pending` 不得携带 `decided_at`；`confirmed`、`rejected`、`deferred` 必须提供裁定时间。
- 正在运行的验证必须记录 `actor`、`run_id`、`started_at`；非 running 状态不得保留活动 `verification_run`。
- 过期的验证/审查状态（`stale`）仍须保留历史 `evidence_refs`，避免状态只剩一个无法追溯的 stale 标签。
- Validator 必须启用 JSON Schema Draft 2020-12 的 date-time format assertion，不能只把 format 当注释。
- Evidence 仍由既有权威记录保存；review Evidence 至少绑定 revision、scope、reviewer、result、observed_at；verification Evidence 至少绑定 revision、command/procedure、result、executor、observed_at。Packet 只引用，不复制证据内容。
- 兼容性策略明确：由于 Core 严格拒绝未知字段，新增任何 Core 字段（即使 optional）也需要新 schema_version；生产者特定附加数据使用 namespaced extensions。
- 验证限制不变：尚未运行正式 JSON Schema Validator，也未实现自动校验器或门禁。上述修订仍属 D1 语义审查，不代表 Schema 已冻结。


- 增加 D1 最小正/负例契约，区分 JSON Schema 可验证的结构约束与后续 semantic validator 责任；明确 JSON Schema `uniqueItems` 不能保证 `decisions[].decision_id` 属性级唯一，后续 validator 必须补充该语义检查。
- 兼容策略列出未知核心字段、未知 schema_version、handoff 缺失、证据缺失、running/blocked/dirty/clean/HEAD/coordination/decision 时间边界、RFC 3339 格式断言等最小 fixture 预期。当前只定义测试契约，不实现 validator、fixture runner 或 CI gate。

## SCP D2 只读 Bootstrap / Context Freshness 设计推进（2026-11-12）

### 本轮执行边界

- 用户指示按建议继续推进；没有明确批准冻结 D1 Schema 0.1.0。因此 D1 继续保持候选/待批准状态，不得写成 Frozen。
- 本轮先推进不依赖 D1 冻结的 D2 概念设计：只读 Bootstrap、Context Freshness、来源权威性、revision 比较、冲突处理和失败降级。
- 未修改 Schema、Compatibility、JSON example；未实现 Validator、Fixture Runner、Packet Writer 或 CI Gate。
- 不改变 PR #10、main、项目版本或 tags；不合并、不关闭 PR。

### D2 文档变更

- 在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md 新增 §13「D2 只读 Bootstrap 与 Context Freshness 设计提案」。
- 定义 B0–B7 恢复顺序：项目识别、规则入口、断点定位、意图与范围、代码现场、证据现场、冲突/新鲜度、恢复摘要。
- 明确只读操作边界：不写文件、不改变 Git 状态、不调用远端写 API、不执行可能生成缓存/报告/迁移的副作用命令。
- 建立来源权威性矩阵，区分 intent、requirements、tasks、roadmap、ADR、verification、Git、PR/CI 与用户授权的职责。
- 定义逐来源 freshness：current / stale / conflict / unknown；时间戳较新不等于 current，unknown 不得降级为成功或无变更。
- 定义 commit、tracked blob、dirty/untracked worktree、PR head、CI run、Evidence 和用户决策的 revision 核验方式。
- 定义 Packet 缺失、解析失败、未知 Schema 版本、远端不可用、dirty worktree、证据失效、权威来源冲突和只读权限不足等降级路径。
- 明确 Bootstrap 输出只是当前会话恢复视图，不构成新事实账本，也不授予后续写操作权限。
- 给出 D2 设计验收标准；至少覆盖 10 类正/负场景，但当前仅定义验收，不代表已实现测试。

### 当前状态与验证限制

- D0：Frozen（用户已明确确认）。
- D1 Schema 0.1.0：语义审查已完成，仍待用户明确批准冻结；尚未运行正式 JSON Schema Validator。
- D2：只读 Bootstrap / Freshness 设计草案已写入，尚待独立一致性审查；不代表实现或生产可用。
- PR #11 之前 Head 为 8f75c26ca176808d6a09e730c97501bd05f8f2d6；该 SHA 的 16 项 CI 在本轮复核时为 13 queued、3 in_progress、0 completed，不能声称通过。
- 本轮新增设计提交：39e935e13c21ab3ed808c30eb017b39781e93029。该提交后的 CI 必须按最新 Head 重新核验；不能沿用 8f75c26 的状态。
- 更新本 Handoff 会再产生一个 PR #11 commit；最终 Head 与 CI 需在本次交接提交后重新现场核验。
- PR #11 继续 Open + Draft；PR #10 继续 Open + Draft；main 保持未修改。

### 下一步（唯一首选）

对 D2 §13 做独立边界审查，重点检查：Bootstrap 顺序是否会过度读取、权威来源矩阵是否与现有规范一致、current/stale/conflict/unknown 是否可判定、只读模式是否存在隐式副作用、受限继续与停止条件是否足够精确。修订后再向用户提交 D2 设计审查结论；D1 是否冻结仍由用户明确决定。

### D2 第一轮内部边界审查（2026-11-12）

已将 D2 §13 与仓库现行规则入口和权威来源进行交叉核对：

- AGENTS.md 的每会话最小动作是读取 AGENTS.md 与 MEMORY §0；其余宪法、intent、requirements、verification、任务/路线图/ADR 按任务级别和能力开关读取。D2 的 B1–B3 采用同样的按需读取原则，没有把所有领域文件变成每轮固定读取项。
- AGENTS.md / Constitution 明确 intent、requirements、verification 为始终启用的权威源；task_tracking、roadmap、adr 是可选能力。D2 来源矩阵与该职责边界一致，不会要求关闭能力后创建替代目录。
- MEMORY §0 是跨会话断点，不是任务/需求/意图/验证总账。D2 将 MEMORY、handoff、Packet 定位为恢复导航和 last-known 线索，没有建立第二套事实源。
- Constitution 的权限表允许只读查询自主执行，但高风险、外部可见、不可逆操作仍需用户明确授权。D2 明确 Bootstrap 不授予后续写权限，符合现有权限模型。
- Verification 索引要求 V 绑定 Commit SHA，并规定旧提交 CI 绿灯不能移植到新提交；D2 将 CI run/head SHA 与 Evidence revision 纳入 freshness 检查，保持一致。
- 发现并修正一处边界表述：D2 的 read-only 不能误伤 AGENTS 允许的标准依赖缓存/系统临时数据。现已明确这类自动缓存仅在项目规则允许时例外；项目文件、Git 状态、数据库和远端资源仍不得由 Bootstrap 主动写入。

**审查结论：** D2 第一轮未发现与现有权威来源模型或权限模型直接冲突的阻断问题。仍需在下一轮重点审查：外部来源缺少稳定 revision 时必须落到 unknown；dirty/untracked worktree 不能被 Git tree SHA 误判为完整快照；“受限继续”必须严格限制为不依赖未知/冲突事实的低风险只读分析。

### 最新 PR 状态（本轮最终设计提交前）

- PR #11：Open + Draft，Base feat/governance-consistency-audit，Head design/session-continuity-protocol。
- D2 设计修订 Head：af770416d6352a0ab0c3e952a4229f72b5d71963。
- 该 SHA 对应两个 Check Suite，共 16 个 check；现场查询时两个 suite 均 queued，尚无完成结论。不能声称通过。
- PR #10：仍 Open + Draft，未修改。
- main：02f8dde262455f15029a54694e129b05b70013a4，未修改。
- 本轮没有合并 PR、关闭 PR、修改版本或创建 tag。

### 下一步（唯一首选）

继续第二轮 D2 语义审查，重点检查失败降级是否过度宽松、来源 revision 是否可实际判定、只读恢复的边界是否有遗漏；之后再决定是否进入 D2 设计冻结审查。D1 Schema 0.1.0 是否冻结仍需用户明确批准，不得因 D2 推进而默认冻结。

### D2 第二轮语义审查补充（2026-11-12）

- B0 项目识别已澄清：没有 Packet 或协议元数据的旧项目仍可从 AGENTS.md / MEMORY §0 恢复，不因未采用 SCP 而失败。
- 将 Schema/协议兼容性与 freshness 分为独立检查轴；未知/不兼容版本标 unsupported/incompatible，不能伪装成 freshness=unknown 后忽略核心语义。
- 明确 HEAD tracked blob 与工作区实际文件必须分别判断；相关 tracked path dirty 时不能因 HEAD blob 未变而宣称 current。
- 对 untracked path 增加边界：没有可核验的路径身份和内容摘要时，不得判 current；Git tree SHA 不能代表完整 dirty/untracked worktree。
- 保留两个实现前置问题：dirty/untracked 内容摘要的编码必须与最终 D1 Schema 对齐；多 remote/fork 需稳定 repository identity 或显式 upstream 映射。D1 未冻结前不增加字段、不修改 Schema 0.1.0。
- 第二轮审查未发现需要改变 D0 语义或 D1 Schema 的问题；当前 D2 仍是设计草案，不是冻结规范或实现承诺。

### PR #11 当前状态（第二轮 D2 设计提交）

- D2 第二轮设计提交：7f02b631c19fe518a9709031603c656a8e42d2ee。
- PR #11：Open + Draft，Base feat/governance-consistency-audit；现场查询时该 Head 对应 1 个 Check Suite / 8 个 check，全部 queued，尚无完成结论。
- PR #10：Open + Draft，未修改。
- main：02f8dde262455f15029a54694e129b05b70013a4，未修改。
- 更新本 Handoff 会产生新的 PR #11 Head；新会话必须现场读取 PR head 与对应 CI，不沿用本节旧 SHA 的 CI 状态。

## SCP D2 场景契约矩阵推进（2026-11-12）

### 本轮工作

用户确认按建议继续。本轮将 D2 从原则设计推进为跨客户端可验证的场景契约，仍严格限定为设计工作。

已在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md 新增：

- §13.12「D2 场景契约矩阵」：定义 18 个场景，覆盖 Packet 缺失/有效、权威记录更新、无关文件变化、远端 API 不可用、tracked dirty、untracked 内容摘要缺失、dirty owner 不明、PR head 变化、CI queued、CI SHA 不匹配、Evidence revision mismatch、未知 Schema、权威来源冲突、可选能力关闭、检查命令副作用、当前指令与历史意图不同、只读权限不足等。
- §13.12.2：定义跨客户端规范化输出字段，要求比较协议兼容性、逐来源 freshness、观察状态、Evidence 适用性、恢复模式、允许/禁止行为和待用户决定，而不是比较自然语言摘要。
- §13.12.3：定义 normal / restricted / blocked 恢复模式；局部冲突只阻断依赖该事实/范围的动作，不扩大为全仓库阻断；normal 不代表验证通过或获得写权限。
- §13.12.4：规定后续 Fixture 的输入、预期状态、允许/禁止行为和 unknown 预期；明确当前没有创建 Fixture、Runner 或 CI Gate。
- §13.13：定义 B0–B7 的规范化状态转移与判定顺序，包括身份检查先于 Packet 消费、兼容性先于字段解释、权威识别先于新旧比较、范围匹配先于 Evidence 适用性结论、现场观察先于动态状态结论、授权检查独立于恢复状态。

### 本轮设计审查结论

已对 18 个场景和状态转移说明做内部一致性检查：

- 未把 Packet 缺失当作错误；保留旧项目从既有入口恢复的路径。
- 协议兼容性与 freshness 分轴，未知核心语义不允许“忽略后继续”。
- HEAD、tracked 工作区文件、untracked 文件分别判断，不把 Git tree/commit SHA 误当成完整 dirty worktree 快照。
- CI 状态 queued/in_progress 不等于 passed；CI 成功但 head SHA 不匹配时不覆盖当前版本。
- Evidence 必须同时满足 subject、revision、scope 适用性，旧证据保留但不能冒充当前通过。
- 权威来源冲突不按时间戳或 Agent 偏好选边；unknown 不解释成不存在或无变化。
- normal/restricted/blocked 是恢复范围状态，不是用户授权等级；所有后续写入仍需独立权限检查。
- 只读命令若会产生项目状态副作用则跳过，不能为完成 Bootstrap 而破坏只读边界。
- 跨客户端比较采用规范化结果；Fixture 通过不能替代真实 CLI E2E。

当前未发现需要改变 D0 决策或修改 D1 Schema 的阻断问题。该结论属于文档内部审查，不是正式 Validator/Fixture 执行结果，也不代表 D2 已冻结。

### 本轮未做事项

- 未修改 D1 Schema、COMPATIBILITY.md 或 JSON example。
- 未批准/标记 D1 Schema 0.1.0 冻结。
- 未实现 Validator、Semantic Validator、Fixture Runner、Packet Writer 或 CI Gate。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### PR #11 当前提交链

- 场景契约矩阵提交：ac6b88f34b1bd2ab38028a7ae852846ace7024c3。
- 状态转移语义提交：0a94f7bf0589508429a587687dbcf0f84888db66。
- 更新本 Handoff 会再产生一个新 Head；新会话必须重新读取 PR #11 head 和对应 CI，不得沿用以上 SHA 的检查状态。
- PR #11 保持 Open + Draft；PR #10 保持 Open + Draft；main 未修改。

### 下一步（唯一首选）

在本设计范围内做最后一轮 D2 审查：检查 18 个场景是否存在状态判定歧义、恢复模式是否可由依赖范围稳定计算、规范化输出是否足以让两个独立客户端互操作。通过后向用户提交 D2 设计冻结审查请求；D1 Schema 0.1.0 仍需用户单独明确批准冻结。

## D2 场景契约矩阵与状态转移完成（2026-11-12）

### 本轮交付

- SESSION-CONTINUITY-PROTOCOL-DESIGN.md §13.11：记录第二轮状态轴与工作区边界审查。
- §13.12：新增 18 个 Bootstrap/Freshness 场景契约，覆盖正常恢复、来源变化、远端不可用、dirty/untracked worktree、PR/CI 变化、Evidence 失效、Schema 不兼容、权威来源冲突、可选能力关闭、副作用命令、意图变化和权限不足。
- §13.12.2：定义跨客户端规范化结果字段，避免以自然语言摘要作为互操作比较标准。
- §13.12.3：定义 normal / restricted / blocked 恢复模式，按当前操作依赖的来源范围计算；局部阻断不自动扩大为全仓库阻断。
- §13.12.4：明确后续独立实现提案需要把场景转为机器可读 Fixture；本轮未创建 Fixture、Runner 或 CI Gate。
- §13.13：新增规范化状态转移顺序，明确项目身份、规则入口、Packet 定位、协议兼容性、权威来源、现场观察、逐声明 freshness、恢复模式、权限门和恢复摘要的先后关系。

### 内部审查结论

- 18 个场景与 §13.1–§13.10 的权威来源、freshness、失败降级和只读边界保持一致。
- 明确 unknown/stale/conflict/unsupported/queued/in_progress 均不能提升为 current/passed/authorized。
- 明确 Packet、handoff、MEMORY 是恢复导航/last-known 信息，不成为新的领域事实账本。
- 明确 normal 只表示恢复上下文可用，不表示任务完成、验证通过或获得写权限。
- 明确 Fixture 契约测试与真实 CLI E2E 的证明范围不同。
- 调整了 §13.11–§13.13 的章节顺序，保证审查记录、场景矩阵和状态转移的编号连续。

未发现需要修改 D0 已确认语义或 D1 Schema 的阻断问题。该结论是设计文档内部审查，不是正式 Schema Validator、Fixture Runner 或真实客户端 E2E 的执行结果；D2 仍未冻结。

### 本轮边界

- 未修改 D1 Schema、COMPATIBILITY.md 或 JSON example。
- D1 Schema 0.1.0 仍待用户单独明确批准冻结。
- 未实现 Validator、Semantic Validator、Fixture Runner、Packet Writer 或 CI Gate。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭 PR。

### 本轮提交与 CI

- D2 状态转移提交：0a94f7bf0589508429a587687dbcf0f84888db66。
- D2 章节顺序修订提交：1a80e0cee5b805d58e504615e492765c608f3944。
- 在本 Handoff 更新前，PR #11 Head 为 1a80e0cee5b805d58e504615e492765c608f3944；该 SHA 对应 2 个 Check Suite、16 项 check，现场查询时全部 queued，0 completed。不能声称 CI 通过。
- 更新本 Handoff 会产生新 Head；必须重新核验新 SHA 的 CI。
- PR #11 保持 Open + Draft；PR #10 保持 Open + Draft；main SHA 仍为 02f8dde262455f15029a54694e129b05b70013a4。

### 下一步（唯一首选）

完成 D2 最后一轮设计审查，集中检查场景判定是否存在边界歧义、recovery_mode 是否可按操作依赖范围稳定计算、规范化输出是否足以支撑两个独立客户端。若审查通过，再向用户提交 D2 设计冻结请求。D1 Schema 0.1.0 的冻结仍是独立用户决策。

### D2 最后一轮场景语义复核（2026-11-12）

对 §13.11–§13.13 再次检查后，收紧了四处边界：

1. **能力适用性与 freshness 分离**：current/stale/conflict/unknown 表示来源新鲜度；not_applicable/not_configured 表示可选能力是否适用，不再混成同一个状态维度。
2. **Dirty tracked file 的判定**：HEAD blob 不代表工作区文件；工作区声明默认 stale，只有 Packet 对具体路径/内容范围提供可核验摘要且现场摘要匹配时，才可判该范围 current。
3. **只读副作用例外**：项目目录内缓存、报告、锁文件、数据库修改和迁移仍禁止；标准依赖缓存/系统临时数据仅在项目规则明确允许时例外，与 §13.2 保持一致。
4. **Blocked 的范围**：项目身份不明/与 Packet 不匹配、协议不兼容、权威来源冲突或 dirty 写入冲突，只阻断依赖该范围的动作；不妨碍不依赖该范围的安全只读恢复。

复核结论：D2 的规范化输出、18 个场景和状态转移顺序保持一致；未发现需要改动 D0 或 D1 Schema 的阻断问题。D2 仍是设计草案，尚未冻结；本轮没有运行机器 Fixture 或 Validator。

- 最后一轮语义修订提交：9b37343e0eca3e80c9794398d6c67bd8c45fb7d2。
- 本次 Handoff 更新前 PR #11 Head 为 9b37343e0eca3e80c9794398d6c67bd8c45fb7d2；更新 Handoff 会产生新 Head，需重新核验 CI。


## D3 Checkpoint 概念设计推进（2026-11-12）

### 本轮交付

在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md 新增 §14.1–§14.10「D3 Checkpoint 设计提案（概念阶段）」：

- 明确 Checkpoint 是恢复索引与断点声明，不是任务、需求、意图、验证或代码状态的第二权威来源。
- 细化持久化触发条件，遵循 D0：重要断点、跨会话暂停、责任交接、阶段收口；不按对话轮数或固定时间自动写入。
- 定义生成前只读核验、写入目标约束、并发版本检查、完整写入确认和失败反馈。
- 区分 Checkpoint 生命周期（created / superseded / invalid / archived）与 D2 freshness、D1 verification/work state，避免混用状态轴。
- 明确多 Checkpoint 默认入口、重复写入抑制、并发冲突和历史保留边界。
- 接收方恢复严格复用 D2 Bootstrap/Freshness，不信任 Packet 的 last-known 快照，不从 Checkpoint 推导权限。
- 覆盖写入失败、并发修改、HEAD 不可观察、dirty/untracked 摘要不足、权限不足、Packet 损坏/不兼容等降级路径。

### 本轮边界与审查状态

- D3 目前是概念设计草案，尚未完成独立的反例/一致性审查，也未请求冻结。
- D2 仍未获用户明确批准冻结；本轮没有将 D2 标记为 frozen。
- D1 Schema 0.1.0 仍独立待用户明确批准冻结；未修改 Schema、COMPATIBILITY.md 或 JSON example。
- 未实现 Packet Writer、Validator、Fixture Runner、CLI/E2E 或 CI Gate。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### 提交记录

- D3 概念设计提交：e7df0a7f5488f65c0df68bbf8e09bae9c56a1886。
- 该提交之后更新本 Handoff 会产生新的 PR #11 Head；必须重新读取 PR head 并核验对应 CI，不得沿用旧 SHA 的检查状态。

### 下一步（唯一首选）

对 D3 §14.1–§14.10 做独立反例审查，重点检查生命周期状态是否有必要、Checkpoint 写入是否超出 D0 授权、多个断点的默认入口是否可判定，以及 D1 Schema 当前字段是否足以承载设计而不引入隐式冲突。审查后再决定是否向用户提交 D3 设计冻结请求；D2 和 D1 冻结仍是独立用户决策。


### D3 第一轮反例审查补充（2026-11-12）

对 §14.1–§14.10 进行独立反例审查后，收敛两处设计风险：

- 不再建议持久化 created / superseded / invalid / archived 生命周期枚举，避免在 D1 Schema 之外形成第二套 Packet 状态源。改为由存储成功结果、Schema/身份检查、项目既有恢复入口和归档规则分别判定。
- 多 Packet 并存时禁止客户端按文件名、目录顺序或时间戳自行挑选“最新”断点。默认恢复入口必须来自 AGENTS.md、MEMORY §0、SESSION-HANDOFF.md 或项目明确配置；没有配置时不新建索引文件。

其余复核确认 D3 的持久化触发仍遵循 D0，Checkpoint 不替代领域权威来源，接收方复用 D2 Bootstrap，写入失败/并发修改/权限不足均不能伪装成功。本轮未修改 D1 Schema，也未实现 Writer/Validator/Fixture/CI。

- D3 收敛修订提交：fab15b6797422d309ebdc2243e548a70bdc5d86d。
- D3 当前仍为概念草案，尚未冻结；该审查不是跨客户端或真实 Writer 验证。


## D3 Checkpoint 场景契约矩阵（2026-11-12）

### 本轮交付

在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md 新增 §14.12.1–§14.12.4：

- 定义生成/消费过程的规范化结果维度：persistence_decision、target_resolution、preflight_state、write_result、packet_usability、recovery_freshness。它们是客户端操作结果，不是新增 Packet 字段或第二套持久化账本。
- 新增 20 个 Checkpoint 场景 C01–C20，覆盖不需要保存、正常阶段收口、用户拒绝、旧入口兼容、目标歧义、项目身份不匹配、写前基线变化、并发修改、隔离/共享 Agent 写入、dirty/untracked、来源不可读、写入失败/中断、重复写入抑制、过期 Packet、Schema 不兼容、原子写能力不足和跨客户端消费。
- 明确生成决策、写入结果、接收方恢复是三个独立阶段，不能合并为单一 success。
- 明确 Fixture 契约测试与真实 Writer E2E 的证明边界；本轮没有创建机器 Fixture、Runner 或执行测试。

### 设计约束复核

- 继续遵循 D0：不按对话轮数或时间自动保存；用户拒绝/权限不足时不写入。
- 不创建新的默认 Packet 目录/索引；目标必须来自既有入口或明确配置。
- 不按时间戳/文件名选择最新 Packet；不使用 last-write-wins。
- 写入成功必须可确认并可回读；失败/中断不得宣称 written。
- Packet 结构可用不等于 freshness current；接收端必须复用 D2 Bootstrap。
- 未修改 D1 Schema、COMPATIBILITY.md 或 JSON example；未实现 Writer、Validator、Fixture Runner、CLI/E2E 或 CI Gate。
- D1 Schema 0.1.0、D2、D3 均未标记冻结；各自需要独立评审/用户决策。

### 提交记录

- D3 场景契约矩阵提交：eea732ba0a0893aeb43736e63b1dd2b5d9ad053f。
- 本 Handoff 更新会产生新的 PR #11 Head；必须重新读取最新 PR Head 并核验该 SHA 对应 CI，不得沿用旧提交检查状态。

### 下一步（唯一首选）

对 D3 §14.1–§14.12 做第二轮独立一致性审查，重点检查规范化结果维度是否存在重叠/不可判定，20 个场景是否遗漏重要写入竞态，以及 Schema 0.1.0 是否被任何场景隐式要求扩展。若通过，再整理 D3 冻结候选结论；是否冻结仍由用户明确决定。


### D3 第二轮一致性审查修订（2026-11-12）

在 §14.13 记录第二轮审查结论，并修订 §14.12.1/C02–C04：

- 将“是否值得持久化”与“是否获准写入”拆成独立结果维度 `persistence_need` 和 `write_authorization`。用户拒绝时，need 仍可为 needed，但 authorization 必须 not_permitted，write_result 必须 not_attempted。
- 明确 Markdown 交接文件不是自动的 Packet 写入目标；JSON Schema 仍是唯一机器契约。只有项目明确规定 Markdown 是工具生成的派生视图时，才可更新该视图。
- 进一步区分 target_resolution、preflight_state、write_result、packet_usability 与 D2 recovery_freshness，避免把目标歧义、基线过期、写入竞态、结构可消费和来源新鲜度混为一谈。
- 第二轮审查未发现 D3 场景必须新增 D1 Schema 字段；dirty/untracked 摘要编码及多 remote/fork repository identity 仍属于 D1/D2 独立待解决边界。

- 第二轮修订提交：f8210cdaa38c4f62752f2b8f69f67590c34fc607。
- D3 仍未冻结；未创建机器 Fixture、Writer、Validator 或 E2E。

