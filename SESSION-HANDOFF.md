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

## D3 第三轮故障语义审查修订（2026-11-12）

### 本轮交付

- 在 `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §14.12.1 将 `write_result` 增加 `unknown`，并明确区分 `failed`（已确认未成功）、`unknown`（无法确认是否已落盘）和 `not_attempted`（未执行写入）。
- 新增 C21：写入请求超时/连接中断且确认丢失时，先回读原目标并校验预期内容；禁止将无确认等同失败后盲目重试，也禁止将请求已发送等同 written。
- 新增 §14.14，记录第三轮故障语义审查和修订结论。

### 审查边界

- 本轮修复的是客户端操作结果契约，不是 Packet Schema 字段；未修改 D1 Schema、COMPATIBILITY.md 或 JSON example。
- 未实现 Writer、Validator、Fixture Runner、故障注入或真实 CLI E2E；文档审查不代表跨客户端互操作已验证。
- D1 Schema 0.1.0、D2、D3 均未标记冻结，仍需各自独立审查和用户决策。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### 提交

- D3 故障语义修订：`0969e07a5f19377982ccda765dc0c2d4a3957528`。
- 更新本 Handoff 后会产生新的 PR #11 Head；必须重新核验该 Head 对应 CI，不得沿用前一提交的检查结果。

### 下一步（唯一首选）

对 D3 做冻结候选审查：逐项核对 §14.1–§14.14、C01–C21、D0 决策和 D1 Schema 边界，整理明确的通过项、未解决项和实现验证缺口；只提交冻结建议，不自动冻结。dirty/untracked 摘要稳定编码和多 remote/fork repository identity/upstream 映射仍需在 D1/D2 适当阶段单独解决。

## D1–D3 跨阶段冻结依赖审查（2026-11-12）

### 本轮交付

- 在 `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §15 新增 D1/D2/D3 冻结依赖矩阵、现有 Schema 表达能力盘点、两个机器契约缺口、冻结顺序建议和禁止推论。
- 确认 D1 Schema 0.1.0 当前 `project.repository` / `project.project_id` 无法充分定义 canonical repository、fork/upstream 与多 remote 映射。
- 确认 D1 `code.worktree_state` / `uncommitted_paths` 不包含 dirty/untracked 内容摘要、摘要覆盖范围或可验证清单，因此不能支持 D2 对相关工作区内容作严格 current 判定。
- 明确 D3 的 `write_result` 是客户端操作结果，不应加入 Packet Schema；D3 继续消费 D2 Bootstrap/Freshness，而不另建状态账本。

### 当前判断

- D1 Schema 0.1.0：**暂不具备冻结条件**。先裁定 Worktree Content Fingerprint 与 Repository Identity/Upstream Mapping，再决定是否调整尚未冻结的 0.1.0 Schema。
- D2：主体设计已完成，但字段映射和 B0/B4 依赖尚需与最终 D1 契约对齐。
- D3：概念和 C01–C21 场景审查已完成，但整体冻结依赖 D1/D2 的身份与摘要契约。
- 本轮仅增加设计审查；未修改 Schema、示例或 COMPATIBILITY.md，未实现 Validator/Writer/Fixture/CI Gate。
- D0 继续保持用户已确认冻结；D1、D2、D3 均未冻结。

### 待用户裁定的设计方向（尚未批准）

1. Worktree fingerprint：建议逐路径摘要为基础，可选 manifest digest；必须定义路径规范化、文件/符号链接处理、模式元数据、算法标识、覆盖范围和非原子读取时的复核规则。
2. Repository identity：建议分离平台/host 命名空间下的稳定 repository identity、本地 checkout identity 与显式 upstream mapping；禁止根据 origin 名称或 remote 顺序猜测 canonical repository。

### 提交

- 跨阶段依赖矩阵与冻结条件：`402ff9a0a96f1367635ba1164f05f35e02292c7b`。
- 本 Handoff 更新后会产生新的 PR #11 Head；必须重新核验该 Head 的 CI。

### 下一步（唯一首选）

继续分别细化两个缺口的最小数据模型和反例：先给出 Worktree Fingerprint 的字段/规范化算法候选，再给出 Repository Identity/Upstream Mapping 的字段与解析规则；比较最小可行方案和兼容性影响，之后提交用户裁定。未获批准前不修改 D1 Schema 0.1.0。

## Worktree Fingerprint 候选模型设计（2026-11-12）

### 本轮交付

在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md §15.6–§15.14 增加 Worktree Fingerprint 的候选方案、跨平台语义、采集算法、Freshness 边界、场景契约和反例审查：

- 采用逐路径 SHA-256 原始字节摘要，不使用 Git object ID 代替跨客户端摘要。
- 明确区分 HEAD、Git index stages 与工作区当前文件；staged 与 unstaged 不压成一个状态。
- 删除以 present/absent 表达，不以空文件摘要表示；rename 拆成旧路径/新路径。
- symlink 摘要链接目标原始字节，不跟随目标；特殊文件和 submodule 内部状态首版保守降级。
- 路径采用 project-root 相对路径、UTF-8、POSIX 分隔符、精确保留 Unicode 码点；不能无损表达、存在路径碰撞或越界时标 unknown/unsupported。
- 默认范围限定 Git status 可见的非 ignored 路径；敏感文件不摘要，相关覆盖范围降为 partial。
- 明确逐路径观察与扫描窗口，不承诺多文件原子快照；重新读取 HEAD/index/status，发现扫描竞态则重试或降级。
- 不引入首版 manifest_digest；它既不能证明原子性，也不能提供来源签名/真实性。
- 新增 WF01–WF12 场景，覆盖 staged/unstaged、delete、untracked、rename、symlink、扫描竞态、secret exclusion、submodule、特殊路径和平台碰撞。
- 明确当前 Schema 0.1.0 的 code.additionalProperties=false 会拒绝 worktree_fingerprint；按 COMPATIBILITY.md 当前 0.x 规则，若采纳核心字段需评估新 minor schema（候选 0.2.0），不能原地修改 0.1.0，也不应将核心语义塞进可忽略 extensions。

### 本轮反例审查结论

逐路径 fingerprint 是当前 D2/D3 需求的最小可行候选方向，但不等于文件备份或全工作区原子快照。若 coverage 不完整、条目无法读取或路径语义有歧义，只能进行局部判断，不能宣称整体 dirty worktree current。

### 未完成事项与范围边界

- 尚未完成 Repository Identity / Upstream Mapping 候选模型；需与 fingerprint 一起进行整体 D1 schema 版本审查。
- 尚未获用户批准该数据模型；不修改 Schema 0.1.0、COMPATIBILITY.md 或 JSON example。
- 未创建正式 0.2.0 Schema；未实现 Validator、Writer、Fixture Runner、CLI/E2E 或 CI Gate。
- D1、D2、D3 均未冻结；D0 继续维持已确认冻结。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### 提交

- Worktree Fingerprint 主体提案：a33594689b9651b943d99003cb1150697e5c13f3。
- Schema 兼容性与反例审查：40277331e3efd5d49137b4d8a436059e97b07400。
- 更新本 Handoff 后需重新核对 PR #11 最新 Head 和对应 CI。

### 下一步（唯一首选）

设计 Repository Identity / Upstream Mapping 最小模型：区分平台命名空间下的稳定 repository identity、当前 checkout identity、canonical repository 与多个 remote/upstream 映射；定义 URL 规范化只作为辅助、平台 ID 缺失时的项目显式配置、fork/镜像歧义和离线降级。随后与 §15.6–§15.14 合并审查 D1 0.2.0 候选契约，不先改 Schema 文件。

## Repository Identity / Upstream Mapping 候选设计（2026-11-12）

### 本轮交付

在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md §16.1–§16.13 增加身份模型、解析顺序、Git URL 凭据保护、D2 规范化状态、场景契约及 Git 语义校准：

- 分离逻辑 Project Identity、当前 Checkout Repository Identity、Canonical Repository Identity、Remote Target 和本地 Checkout Location。
- 候选身份键采用 service-instance namespace + 稳定 provider-native repository ID；无平台 ID 时采用项目显式配置；normalized locator 仅作弱身份线索。
- 分别记录 checkout 与 canonical，fork/mirror 关系必须由平台可验证信息或项目显式配置建立；禁止根据 origin/upstream 名称、owner/path 相似度猜测。
- remote_mappings 按 remote 配置实体表达 fetch_target 与 push_targets；区分本地 remote alias、项目 canonical relation 和 Git branch tracking。
- Git 官方语义校准：同一 remote 的 pushurl 与 fetch url 可使用不同传输地址，但应指向同一仓库；若需要从 upstream fetch、向 fork push，应使用不同 remote。普通 remote 多个 url 时 fetch 使用第一个；push 使用所有 pushurl，若没有 pushurl 则使用所有 url。多个 push targets 身份不一致时 fail closed。
- 新增 branch_tracking 观察维度，区分 branch.<name>.remote/merge 与 branch.<name>.pushRemote/remote.pushDefault；实际操作前重新读取配置。
- URL 只作为 locator；脱敏 userinfo/token/query/fragment，不将原始凭据写入 Packet。
- 新增 RI01–RI22 场景，包括 fork、多个 remote、fetch/push URL、pushurl 列表、SSH/HTTPS、URL 改名、public/self-hosted namespace、detached HEAD、多 worktree、branch tracking/push override。
- D2 规范化输出新增 repository_identity 与 branch_tracking 状态轴，不将 identity 与 source freshness 混在一起。

### Worktree Fingerprint 的同步修正

- 修正 §15.8/§15.9：Fingerprint entries.path 与 code.uncommitted_paths 统一相对于 Git worktree root，而非 project.root 子目录；project.root 只描述仓库内逻辑项目位置。
- 修正只读采集：显式使用 Git porcelain v2、NUL-delimited paths、--untracked-files=all、--ignore-submodules=none 与 --no-optional-locks，避免 status 的可选 index stat-cache 写回破坏只读边界。
- §15.15 已调整到 §16 前，恢复章节顺序。

### 官方参考

- Git status：porcelain v2、NUL 路径、mode/stage/submodule 状态及可选 index 刷新行为。
- Git fetch：remote url/pushurl、多 URL fetch/push 行为、branch upstream 配置。
- Git remote：get-url 的 --push / --all、URL rewrite 及 fetch/push URL 约束。
- 参考链接已写入设计文档 §16.12。

### 当前结论与边界

- Worktree Fingerprint 与 Repository Identity 已形成成套的 D1 候选模型，但尚未进入 Schema 文件。
- 按现有 COMPATIBILITY.md，新增核心字段不能原地写入严格拒绝未知字段的 Schema 0.1.0；建议在两套模型获批准后统一评估新的 0.2.0，而非先后拆成多个不兼容小版本。
- 尚未完成多 Git provider/API、Windows/macOS/Linux 文件系统、真实多 remote/pushurl 和两个独立 Agent 客户端的实现验证。
- 未修改 Schema 0.1.0、COMPATIBILITY.md 或 JSON example；未生成 0.2.0 Schema；未实现 Validator/Writer/Fixture/CI Gate。
- D1、D2、D3 仍未冻结；D0 继续保持已确认冻结。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### 本轮提交

- Repository Identity 候选模型：527c0ca0271238ab6d81d94006fa6410927a30aa。
- Git Remote / branch tracking 语义校准：cfd89109663fa96a7f0192894c25bd031bd53d1d。
- Fetch/push identity 关系修正：9aa1d89a2bf6c7d231b4728d424ca46446d26ed8。
- D2 identity 输出及 Fingerprint 路径基准：c6a82182efb8a1848860adc3f53db855be5913b0。
- 章节顺序修复：7b2970c93eac7da64bf82b9aa47e411244633174。
- 更新本 Handoff 后，必须重新核对 PR #11 最新 Head 与 CI。

### 下一步（唯一首选）

将 §15 Worktree Fingerprint 与 §16 Repository Identity 合并进行一次整体 D1 0.2.0 候选契约审查：检查必填/可选条件、semantic validator 边界、跨客户端规范化输出与版本兼容策略；形成“可进入 Schema 草案 / 仍需用户裁定 / 留待实现验证”的分层清单。完成后向用户提交明确的模型确认请求；未获批准前不创建 0.2.0 Schema。

## D1 Schema 0.2.0 联合候选契约审查（2026-11-12）

### 本轮交付

在 SESSION-CONTINUITY-PROTOCOL-DESIGN.md §17 增加 D1 0.2.0 联合候选契约审查，合并 §15 Worktree Fingerprint 与 §16 Repository Identity / Upstream Mapping：

- 候选核心字段增量：project.repository_identity、code.worktree_fingerprint、code.branch_tracking，均 optional。
- 明确 project.repository 仅为描述性 locator；project.project_id（若使用）为逻辑项目的 stable namespaced URI，不是 provider repository ID。
- 定义 fingerprint 的格式、覆盖范围、时间窗口、path base、index stages、mode、digest、coverage/observation 及语义校验边界。
- 定义 repository identity 的 namespace/id/basis、checkout/canonical、remote mappings、fetch/push 目标一致性、branch tracking 与凭据清除规则。
- 定义 D2/D3 对三项新字段的现场核验和使用边界。
- 根据现有 COMPATIBILITY.md，新增 optional core fields 也不能原地进入 strict 0.1.0；如果获批准，应统一评估 0.2.0，0.1.0 保持不可变。
- 明确 Schema 0.2.0 可表达什么、semantic validator 必须验证什么，以及真实跨平台/跨客户端 E2E 仍需验证什么。

### 联合审查结论

**设计结构上可组合，暂时可进入 Schema 0.2.0 草案准备，但尚不适合直接创建并冻结。**

当前仍需用户明确确认四项语义边界：
1. Dirty worktree 使用 index + worktree 双层摘要，不仅摘要当前文件系统内容。
2. 首版不递归 fingerprint submodule 内部工作区；遇到 dirty submodule 时 coverage=partial/unknown。
3. 仅有 normalized locator 的 Repository Identity 是 provisional，不能用于跨 fork/迁移或依赖稳定身份的写操作。
4. Canonical repository 必须来自项目显式配置或可验证平台关系，不按 origin/upstream remote 名称推断。

### 范围与冻结状态

- D0 语义继续维持已确认冻结。
- D1 Schema 0.1.0 尚未冻结；没有修改 schema、COMPATIBILITY.md 或 JSON example，也没有创建 0.2.0 文件。
- D2、D3 均尚未冻结；文档审查不代表机器验证、Writer E2E 或跨客户端兼容性通过。
- 未实现 Validator、Writer、Fixture Runner、CLI/E2E 或 CI Gate。
- 未修改 PR #10、main、项目版本或 tags；未合并或关闭任何 PR。

### 本轮提交

- Repository Identity 候选：527c0ca0271238ab6d81d94006fa6410927a30aa。
- Remote / branch tracking 语义校准：cfd89109663fa96a7f0192894c25bd031bd53d1d。
- Fetch/push 映射修正：9aa1d89a2bf6c7d231b4728d424ca46446d26ed8。
- D2 identity/path scope 修订：c6a82182efb8a1848860adc3f53db855be5913b0。
- 章节顺序修复：7b2970c93eac7da64bf82b9aa47e411244633174。
- D1 0.2.0 联合契约审查：9e6d1acef0e7f1b49e1e527056fd5e76cc1ce504。
- 本 Handoff 更新后，需现场核对最新 PR #11 Head 和该 SHA 的 CI。

### 下一步（唯一首选）

先向用户提交上述四项语义边界的确认；若获批准，再把已经审查的候选模型映射为正式 Schema 0.2.0、更新最小正/负例与兼容性文档，并对 JSON Schema + semantic validator 的测试契约进行独立审查。未获批准前不修改 Schema 文件。

## Schema 0.2.0 草案与 Fixture 契约（2026-11-12）

### 用户决策

用户已明确批准此前提出的四项语义方向：
1. Dirty worktree 采用 Git index + worktree 双层摘要。
2. 首版不递归 fingerprint submodule 内部工作区；dirty/unobservable submodule 将 coverage 降为 partial/unknown。
3. locator-only repository identity 只能是 provisional，不能证明 fork/迁移关系或授权依赖稳定身份的写操作。
4. canonical repository 必须有项目显式配置或可验证平台关系，不按 origin/upstream 名称推断。

该批准授权创建 Schema 0.2.0 Draft，不代表用户批准冻结，不代表实现或 CI 门禁授权。

### 新增文件

- `schemas/scp/0.2/continuity-packet.schema.json`：Draft 2020-12，schema_version const 0.2.0。
- `schemas/scp/0.2/COMPATIBILITY.md`：0.2.0 兼容策略、观察边界与 semantic validation 契约。
- `schemas/scp/0.2/examples/checkpoint-minimal.json`：最小 checkpoint。
- `schemas/scp/0.2/examples/handoff-with-identity-and-fingerprint.json`：fork/canonical、remote mapping、branch tracking、complete index/worktree fingerprint 示例。
- `schemas/scp/0.2/examples/handoff-partial-fingerprint.json`：部分可观察路径与 unreadable 条目示例。
- `schemas/scp/0.2/fixtures/README.md`：正反例目录索引与预期。
- `fixtures/invalid/schema/`：8 个 Schema 级负例（dirty 无路径、complete + changed capture、locator-only 携带 ID、越界路径、complete unreadable/gitlink、错误版本、未知字段）。
- `fixtures/invalid/semantic/`：6 个 semantic 级负例（duplicate remote name、path set mismatch、duplicate entry path、canonical relation mismatch、credentialed locator、duplicate index stage）。

### Schema 设计要点

- 新增核心字段均 optional，不强制旧项目启用 identity/fingerprint。
- project.project_id 在 0.2.0 中定义为 stable namespaced URI，标识逻辑项目；不是 provider repository ID。
- repository identity 使用 namespace + id + basis；locator-only 禁止带稳定 id。
- remote mapping 把 fetch_state/target 与 push_state/targets 分开，remote alias 不作为身份。
- branch_tracking 把 upstream 与 push remote 分开表示。
- Fingerprint 固定 scp-worktree-fingerprint/1、Git status path scope、SHA-256、UTF-8 路径；index stage 与 worktree 对象分开。
- complete fingerprint 由 Schema 局部条件限制为稳定观察，并排除 unreadable/unsupported/gitlink 条目；路径集合相等、stage 唯一、摘要来源真实性等仍由 semantic validator 负责。
- unreadable worktree entry 允许保留可观察的 kind/mode，但不允许提供伪造 digest；该条目不能属于 complete coverage。
- Fingerprint path 以 Git worktree root 为基准。project.root 不改变该基准。

### 本轮检查与限制

- Schema、正例、负例 JSON 文件均通过 JSON 解析；Schema 正则表达式可被 JavaScript RegExp 编译。
- 本轮自编写的有限结构/条件检查中，三个正例无错误；八个 Schema 级反例按预期被拒绝；六个 semantic 级反例通过结构层检查。
- 上述不是正式 JSON Schema Draft 2020-12 验证器结果；尚未执行 meta-schema/instance 标准验证或 date-time format assertion。
- Semantic validator、fixture runner、CLI/E2E、Writer 和 CI Gate 均未实现。
- 示例中的 identity ID 与 digest 为 synthetic placeholders，不是来自真实 Git provider 或 worktree 的证明。
- 设计文档 §17.8–§17.10 已记录实体化内容、审查状态和后续顺序。

### 本轮相关提交

- Schema 0.2.0 初稿：4e7e27849fd2b1af14a38850e1cb61035b736a6b。
- 示例与兼容性文档：60f3ae6ed163c7fc68d0370fc1c7f4b59ba23a19（该组后续各文件按顺序追加提交）。
- Fingerprint complete 条件与 unreadable 修正：85dddebdcc6a1437c4f68f0e65cb570d09f128aa。
- 正例 synthetic source refs：81159bfd1272cfdc4e951c0de55a6ca6c7035b9b。
- Schema 级负例修正：0556c81bfc12c21fb2667050d41814ecd1622b54。
- 兼容性/fixture 文案校准：dc9e78bfcbf76d00cd462ab4ad865f27260f096f。
- 设计审查记录：ecde77fc00ee6e1ba979b0139dd7fb41100c0c48。
- 本 Handoff 更新后，重新核对 PR #11 最新 Head 与其 CI。

### 下一步（唯一首选）

进行正式 Draft 2020-12 JSON Schema meta-schema 与实例验证（包括 format assertion），并继续对照 §17.2/§17.3 做逐字段语义审查；先修正 schema/examples/fixtures/compatibility 的一致性，再把 D1 0.2.0 作为未冻结 Draft 提交给用户审查。不得实现 Validator/Writer/CI Gate，除非用户另行授权。

### Schema 0.2.0 第二轮一致性审查补充（2026-11-12）

后续修订与复核：
- 修正 worktree entry 的 unreadable 条件：允许保留已知 kind/mode，但不得有 digest；complete coverage 明确排除 unreadable、unsupported 和 gitlink。
- complete coverage 的 Schema 条件同时要求 observation=per_path_stable、工作区仅为 regular_file/symlink/absent，并拒绝 index gitlink mode。
- Git path pattern 增加尾部斜线、控制字符等拒绝条件；entries 示例按 UTF-8 路径顺序排序。
- 明确 fetch_state/push_state=resolved 只描述 Git 配置目标解析是否无歧义，身份可信等级仍由 identity_target.basis 决定。
- branch_tracking push resolution_basis 收紧为 Git remote 选择来源，不包含 project_config；refspec 和授权不在此字段范围内。
- project.project_id 增加 URI scheme pattern；URI 完整性仍需 semantic/configuration validation。
- 新增 partial fingerprint 正例；新增 complete-with-unreadable、complete-with-gitlink、wrong-schema-version、unknown-core-field 四类 Schema 负例。
- Fixture 目录当前为 3 个正例、8 个 Schema-invalid 负例、6 个 semantic-invalid 负例。

第二轮本地结构/条件子集检查：
- 3 个正例均无错误。
- 8 个 Schema-invalid 负例均触发预期局部约束。
- 6 个 semantic-invalid 负例均通过 Schema 结构检查，供后续 Semantic Validator 单独拒绝。
- Schema 所含 pattern 均能被 JavaScript RegExp 编译；已测试路径模式拒绝绝对路径、盘符、dot/dot-dot、重复/尾随分隔符、反斜杠与 ASCII 控制字符。
- 这不是正式 Draft 2020-12 meta-schema/instance validator 的结果；尚未执行正式 format assertion。不可报告为标准 Schema 验证通过。

本轮后续提交：
- Schema complete fingerprint/unreadable 修正：85dddebdcc6a1437c4f68f0e65cb570d09f128aa。
- 兼容性语义说明：74f2252bd4e93068c0c9b5ed5b4cfd9791ce57d6、ab8662d61ab3a616daf4757ba55c1077d3bc0de2。
- 完整 Fingerprint 示例排序：e7fddf0e8c8b957b4b323cd4918c49618416d2bc。
- 新增 strict version/unknown field 负例：c4583a685c6fc18e444aafcbf1ae8c8378c7dbd4、9a1e68df63dd868e3d5a31d40c2d974429b8d52d。
- Fixture README、设计章节和 Handoff 修订：001393c48e9d26b9ab0cb3ceb38f8d17b676d658、f97e66bded88812645cde499e8500d3e668583a3、a69648cddf33cb46e591580bbac942dbc58b41f3。
- Identity 与 branch push 语义收紧：731c1be76ab65f37f0aea5f95860b40b1b7be3d4。
- 第二轮设计一致性审查：23d2d2ac4ec54e58437d2aa178de362205db1faf。

当前仍未完成：正式 Draft 2020-12 meta-schema/instance 验证、date-time format assertion 验证、semantic validator、真实 Git fixture runner、跨平台 CLI E2E 和两个独立客户端互操作测试。

## Schema 0.2.0 第三轮校准与正式 Draft 2020-12 验证（2026-11-12）

### 本轮语义修订

- `branch_state=attached` 时允许 `upstream.state=unknown`，表达当前分支可识别但 branch tracking 配置因权限/读取失败而不可观察；不能伪装成 not_configured。
- Fingerprint complete coverage 允许记录 mode 160000 的 gitlink commit pointer，不递归摘要 submodule 内部文件。
- clean gitlink 要参与 complete coverage，必须由现场 Git status / submodule 检查证明：submodule 已初始化、当前 checkout 指针匹配、内部 worktree clean。
- dirty、缺失、未初始化或无法观察的 submodule 必须降为 partial/unknown。gitlink commit OID 是指针，不是文件内容 digest。
- 新增正例 `examples/handoff-clean-gitlink-fingerprint.json`，同时展示 clean gitlink pointer 与 attached branch 的 unknown upstream/push。
- 原 `invalid/schema/complete-with-gitlink-entry.json` 改为缺失 `gitlink_commit` 的真正结构负例；它不再错误声称所有 gitlink 都不能属于 complete coverage。
- 新增 `invalid/semantic/complete-with-dirty-submodule.json`；JSON 结构合法，但 fixture 的现场 Git 状态将 submodule 标为 dirty，因此 semantic 层必须拒绝完整覆盖声明。

### 当前 Fixture 数量

- 正例：4（minimal checkpoint、complete normal fingerprint、partial/unreadable fingerprint、clean gitlink + unknown branch config）。
- Schema-invalid：8。
- Semantic-invalid：7。

### 正式 Draft 2020-12 验证

已在本地使用 Python `jsonschema 4.26.0` 的标准 `Draft202012Validator`，并启用 `FormatChecker()`：

- Schema 对 2020-12 meta-schema 的 `check_schema`：通过。
- 4 个正例：全部通过实例验证。
- 8 个 Schema-invalid 负例：全部被拒绝。
- 7 个 Semantic-invalid 负例：全部保持 Schema-valid，符合设计预期，需未来 Semantic Validator / 现场 Bootstrap 处理。
- format assertion：合法 RFC 3339 date-time 通过；`2026-13-40T30:70:70Z` 被拒绝。

这属于真正的 JSON Schema Draft 2020-12 meta-schema/instance 验证，不再只是 JSON 解析或有限结构脚本。但它仍不验证现场 Git digest、remote identity、path-set equality、重复 remote/path/stage、URL 凭据清洗、submodule clean 等语义真实性。

### 重要限制与冻结状态

- Schema 0.2.0 仍是 Draft；正式 JSON Schema 验证通过不代表 D1 整体冻结。
- Semantic Validator、fixture runner、真实 Git CLI E2E、跨平台文件系统测试、两个独立 Agent 客户端互操作测试尚未实现。
- clean gitlink 的示例值为 synthetic commit pointer；Schema-valid 不代表真实 submodule clean。
- D0 保持已确认冻结；D1、D2、D3 均未冻结。
- PR #10、main、项目整体版本和 tags 未修改；未合并、关闭或转 Ready-for-review。

### 下一步（唯一首选）

基于当前正式通过的 Schema 0.2.0，进行一轮 semantic-contract 完整性审查：把 §17.2/§17.3 与 7 个 semantic fixtures 逐项映射，查缺少的上下文字段、冲突处理与 fail-closed 条件；同步确认 Schema、COMPATIBILITY、Fixture README、Design 和 Handoff 的描述一致。完成后把 D1 0.2.0 作为待用户审查 Draft，不实现 Validator/Writer/CI Gate，除非另行授权。

## Semantic-contract 完整性审查收尾（2026-11-12）

### 当前文件与数量

- Schema：`schemas/scp/0.2/continuity-packet.schema.json`，仍为 Draft 0.2.0。
- Compatibility：`schemas/scp/0.2/COMPATIBILITY.md` 已补充 semantic validation 规则、submodule/remote/branch/path/provenance 边界。
- Positive fixtures：4 个。
  - `examples/checkpoint-minimal.json`
  - `examples/handoff-with-identity-and-fingerprint.json`
  - `examples/handoff-partial-fingerprint.json`
  - `examples/handoff-clean-gitlink-fingerprint.json`
- JSON Schema-invalid fixtures：8 个。
- Semantic-invalid fixtures：19 个。
- `fixtures/SEMANTIC-CONTEXT.md` 已增加 19 个语义向量所需的 companion Git/config/provider context；没有 companion context 时必须标 not_run/unknown，不算 pass。

### 本轮发现和修正

1. clean gitlink 示例原先 index OID 与 checked-out submodule HEAD OID 不一致；已统一为同一 synthetic OID。
2. dirty-submodule semantic fixture 保持相同的 index/checkout pointer，但 companion context 将 submodule worktree 标 dirty，隔离验证“pointer 相同不等于内部 clean”。
3. `branch-state-code-branch-mismatch.json` 曾误放在 invalid/schema；现已移动至 invalid/semantic，Schema-invalid 数量保持 8。
4. 增加 `credentialed-project-repository.json`，确保顶层 project.repository 和 identity_target.locator 同样受凭据清洗规则约束。
5. 增加 `gitlink-pointer-mismatch.json`，验证 index gitlink pointer 与 checked-out submodule HEAD 不匹配时不得宣称 complete。
6. 增加 `identity-source-reference-unresolvable.json`，验证权威身份来源 not-found 时不能使用旧缓存或 URL 相似性补成 resolved。
7. 增加 `branch-push-remote-unknown.json`，覆盖默认 push remote alias 不存在的 fail-closed 路径。
8. 更新 Compatibility、Fixture README、Semantic Context、Design §17.15 与本 Handoff。

### Semantic Validator 最低判定范围

Design §17.15 已整理 13 组规则：协议兼容、Repository Identity、Remote resolution、Branch Tracking、Path identity、Fingerprint set、Git index stage、Worktree state、Submodule、Capture consistency、Sensitive data、Evidence/provenance、Recovery output。

本轮判断：现有 Schema 字段足以表达所需观察；剩余问题应由 Semantic Validator / Bootstrap 在现场判断，不建议再增加第二套状态字段或扩展 Packet 成为任务/授权数据库。

### 验证状态（必须区分）

- 标准 Draft 2020-12 meta-schema/instance 验证结果记录在 Design §17.13：当时 4 个正例、8 个 Schema-invalid、7 个 semantic-invalid fixtures 均按预期；FormatChecker 也验证了 date-time assertion。
- 当前新增到 19 个的 Semantic-invalid set 中，后续 12 个没有在本轮重新运行标准 Draft 2020-12 Validator。局部结构检查不是标准验证器；不能声称当前全部 19 个已通过标准 Schema-valid 检查。
- JSON 内容/引用/Schema 形状已作针对性审阅，但 `SEMANTIC-CONTEXT.md` 是未来 fixture runner 的输入契约，不是已经创建的真实 Git/provider fixture environment。
- Semantic Validator、Fixture Runner、真实 Git CLI E2E、跨平台文件系统测试、双客户端互操作及 CI Gate 均未实现。
- D1、D2、D3 继续未冻结；D0 维持已确认冻结。

### 本轮相关提交

- Semantic Context 初稿：b7fefacfd389f3a0e4607ca229f61dd971049f29。
- Gitlink pointer 对齐：2ee131009ec286bbc4b7bfb5be2dfb9d2593be48、ba496cfbe7c1636d9617e75e136edabe15a0491f。
- 新增四个 semantic vectors：c86acfc1c9a3fb0b66a77bd5be0e0d7daa3b7b4e、5666b0e1b8fa55747f0f8cc3ee27fd15d26a0fe4、6418fc6cfe6136275de15ebd4d4e40fbf7d68cd7、9a7be06999d29a88fd7cd88c6f4d7a47fc533ee7。
- 修正 misplaced fixture：b1f56519171b89d1fcf7a9f6067eb2d0c05726b0、99cc8cd6630540c147d6c43cb99fa6b9ede57592。
- Compatibility 语义规则：85420be58eaa4e92929f04f89030f987862a1ca0、0b1f7bc9b9ce4ea27d5d6cd2bfb1521a77eec749。
- Fixture README / Context：428fb2d5a7edef52c0f8c875da25c6736512dc7a、6e851e97dce9b0f830f32f52e37926484b064b2a、dfa170350a0cec5e19b4ab4bc08e3e510a00736b。
- Design §17.15 semantic audit：0df054da9c8e8a1a0c3070e7999d57cac7b3edad、173a1f46222f42141cbb39f55abfc5efbeb65d2d。

### 下一步（唯一首选）

在当前 Schema blob SHA 固定后，对全部 4 个 positive、8 个 Schema-invalid、19 个 semantic-invalid instances 重新运行标准 Draft 2020-12 Validator（包括 FormatChecker），将验证报告绑定到准确的 Schema SHA 和 Fixture SHA。只有 19 个语义向量确认 Schema-valid 后，才继续将 semantic-context 逐项审查为可执行 Fixture Runner 契约。不得实现 Validator/Writer/CI Gate，除非用户另行授权。

## 0.2.0 全量 Fixture Draft 2020-12 验证完成（2026-11-12）

### 标准验证结果

已在 Python `jsonschema 4.26.0` 中对固定 Schema blob 执行标准验证：

- Schema：`schemas/scp/0.2/continuity-packet.schema.json`
- Schema blob SHA：`0ab451634283385b5ffa7f028fa7f4a0e6b41cc8`
- `Draft202012Validator.check_schema`：PASS。
- 标准实例验证使用 `FormatChecker()`。
- Positive：4/4 PASS。
- JSON Schema-invalid：8/8 REJECTED。
- Semantic-invalid：19/19 Schema-valid，按设计交由 Semantic Validator / companion context 判断。
- Format probe：合法 RFC 3339 接受；`2026-13-40T30:70:70Z` 拒绝。

固定的文件级 SHA 和验证解释写入 `schemas/scp/0.2/fixtures/VALIDATION-REPORT.md`。README 和 COMPATIBILITY.md 已增加报告引用。

### 验证期间的 Fixture 修正

`branch-state-code-branch-mismatch.json` 原先通过 Packet 内部状态（detached + 非空 branch）自相矛盾来制造语义失败；但 Schema 的根级条件已能拒绝这种实例，因此它不是 semantic-only fixture。

现已把 Packet 改为声明 attached branch，配套 `SEMANTIC-CONTEXT.md` 则提供 live Git 返回 detached HEAD 的 companion observation。这样 JSON Schema 保持通过，语义层必须将 last-known branch observation 标 stale/conflict。

### CI 与标准验证的区别

- PR 当前 16 个 Standards CI checks 全部 success。
- 已检查 `.github/workflows/standards-ci.yml`：只运行语法与回归测试，不运行 SCP JSON Schema validation。
- 本节的 Draft 2020-12 验证是独立 Python Validator 运行；不是由现有 CI 产生。
- Semantic Validator、Fixture Runner、Git/provider fixture environment、跨平台 CLI E2E、双客户端互操作和 CI Gate 均未实现。

### 本轮范围及冻结状态

- Schema 0.2.0 没有修改，blob SHA 仍是 `0ab451634283385b5ffa7f028fa7f4a0e6b41cc8`。
- 当前全量 Fixture inventory：4 positive / 8 JSON Schema-invalid / 19 semantic-invalid。
- D1 Schema 0.2.0 继续保持 Draft；标准验证通过不是 D1 整体冻结。
- D2、D3 状态不变；D0 仍为唯一已确认冻结阶段。
- PR #10、main、项目版本和 tags 未修改；没有合并、关闭或转 Ready-for-review。

### 下一步（唯一首选）

审查 `schemas/scp/0.2/fixtures/SEMANTIC-CONTEXT.md` 是否已足以转化为未来 Fixture Runner 的确定性测试输入契约。逐个定义 fixture setup、只读 observation、预期 normalized result、失败/权限不足降级；仍先做设计审查，不实现 Semantic Validator、Fixture Runner 或 CI Gate，除非另获授权。

## Semantic Fixture Execution Contract 草案（2026-11-12）

新增 `schemas/scp/0.2/fixtures/SEMANTIC-EXECUTION-CONTRACT.md`，作为 `SEMANTIC-CONTEXT.md` 的执行边界补充：

- 统一 Prepare / Observe / Evaluate / Assert-Cleanup 四阶段。
- 定义 packet_only、local_git、local_git_submodule、provider_stub、filesystem_profile、fault_injection 六类测试环境。
- 临时 Git repository、local bare remote 和 provider stub 由未来 Harness 在 disposable root 中建立；被测 Bootstrap observation 保持只读。
- 禁止真实网络/用户凭据/真实远端 push；固定 clock、raw bytes、commit、provider response。
- 通过事件 hook 而不是 sleep 测试扫描竞态；companion context 缺失为 not_run/unknown。
- 给 19 个 semantic vectors 标注 profile 与预期 semantic assertion。
- 提供 normalized output 的示意形状与双客户端一致性要求，但未定义新的机器契约或实现 API。

当前 5 个待设计问题：
1. Companion context 是否需要机器可读格式。
2. 本地 Git fixture bundle 如何跨平台固定与分发。
3. 第一轮互操作需要覆盖哪些 OS/filesystem profiles。
4. 不耦合语言的 fault-injection hook 如何设计。
5. Reason codes 是否为测试层专用，还是未来协议字段。

范围边界：本次只增加设计文档，不实现 Semantic Validator、Fixture Runner、CLI adapter、Writer 或 CI Gate；D1/D2/D3 仍未冻结。

## Gitlink complete-coverage 结构约束与再次全量验证（2026-11-12）

### Schema 收紧

新增完整覆盖约束，防止 index gitlink 存在但 worktree submodule 路径缺失时被误报为 complete：

- index_entries 含 mode 160000，则 worktree 必须 present + gitlink + mode 160000，并提供 gitlink_commit。
- worktree kind=gitlink，则 index_entries 也必须有 mode 160000。
- index OID 与 checkout HEAD OID 是否一致、submodule 是否初始化且 clean，仍由现场 semantic 层验证。
- 新增 Schema-invalid fixture：`fixtures/invalid/schema/complete-with-missing-gitlink-worktree.json`。

### 当前验证结果

- Schema blob SHA：`a2f2097a17c08bf0a2ae733ab43a8f1919b48813`。
- 标准 Draft 2020-12 meta-schema：PASS。
- Python `jsonschema 4.26.0` + `FormatChecker()`。
- Positive：4/4 PASS。
- JSON Schema-invalid：9/9 REJECTED。
- Semantic-invalid：19/19 Schema-valid。
- 合法 RFC 3339 date-time 接受，`2026-13-40T30:70:70Z` 拒绝。
- 文件级 blob IDs 与验证说明已更新至 `schemas/scp/0.2/fixtures/VALIDATION-REPORT.md`。

### 文档同步

- `README.md` Fixture inventory 更新为 4 / 9 / 19，并链接 Validation Report 与 Semantic Execution Contract。
- `COMPATIBILITY.md` 明确完整 Fingerprint 中 index/worktree 的 gitlink 存在条件。
- Design §17.18 记录这轮 schema 收紧和第二次全量验证。
- `SEMANTIC-EXECUTION-CONTRACT.md` 已新增，定义未来 Runner 的隔离准备、只读观察、语义规范化、断言清理和双客户端对照边界；仍未实现 Runner。

### 冻结与授权边界

- D0 仍保持已确认冻结。
- D1 0.2.0 继续是 Draft；Schema 验证通过不代表 D1 整体冻结。
- D2、D3 不变，均未冻结。
- 未实现 Semantic Validator、Fixture Runner、Writer 或 CI Gate。
- PR #10、main、项目版本和 tags 未修改；未合并、关闭或转 Ready-for-review。

### 下一步（唯一首选）

继续审查 `SEMANTIC-EXECUTION-CONTRACT.md` 的跨平台确定性和 19 个 fixture 的 companion context 完整性，优先补充 re-enumeration race / filesystem alias 等未覆盖故障场景的测试设计；仍先形成设计与契约，不启动 Runner 或 CI 门禁实现，除非另获授权。

## Semantic Execution Contract 跨平台缺口复核（2026-11-12）

在现有 19 个 semantic vectors 与 execution contract 基础上，新增四个候选测试方向（尚未加入当前 fixture 数量，也未创建 JSON fixture）：

1. `fingerprint-reenumeration-race`：初次 status 枚举后至最终重读前发生 untracked/index 变化；必须阻止 complete/current。
2. `fingerprint-file-object-replaced-during-read`：文件流式 digest 期间路径对象/inode 被替换或内容变化；entry unknown/changed-during-capture。
3. `fingerprint-path-alias-collision`：大小写不敏感或 Unicode normalization 文件系统上两个不同 path byte strings 实际别名；不得折叠，coverage 降级。
4. `identity-source-permission-denied`：区分 provider 403、429、timeout 与 authoritative 404；权限/限流/超时不能变成“资源不存在”。

这些向量不需要新增 Packet 字段；通过 local_git / fault_injection / filesystem_profile / provider_stub companion context 表达。是否进入下一轮 Fixture Inventory，需先审查各 context 的可重复性与跨平台执行能力。

当前状态仍为 4 positive / 9 JSON Schema-invalid / 19 semantic-invalid。Schema SHA 为 `a2f2097a17c08bf0a2ae733ab43a8f1919b48813`；验证报告在 `schemas/scp/0.2/fixtures/VALIDATION-REPORT.md`。

下一步唯一首选：设计这四类候选 context 的 deterministic setup/observation/result contract，并与 D2 的 freshness/recovery outputs 对齐；先不增加 fixture、不实现 Runner/Validator/CI Gate，直到跨客户端一致性边界明确。

## 四类候选故障场景的 D2 状态映射和纳入决策（2026-11-12）

新增设计：
- `schemas/scp/0.2/fixtures/SEMANTIC-EXECUTION-CONTRACT.md` §11–§14：四类场景的确定性 setup、event sequence、companion fields、expected normalized output 和跨客户端断言。
- `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §17.20：对照 D2 §13.12，规定 freshness、现场 observation、identity/path 状态及 operation-scoped recovery mode。

### 四类场景的规范化结果

1. **Fingerprint re-enumeration race**
   - Packet 旧 fingerprint：确认 path/index 已变化时标 stale。
   - 本次扫描：初次与最终 HEAD/index/status 不一致，现场 observation=unknown / changed_during_capture，不能拼接成 complete snapshot。
   - 不依赖 dirty path 的只读工作=restricted；依赖该路径集合的操作=blocked（受影响范围）。

2. **File object replaced during digest read**
   - handle identity 与当前 path identity 不一致，或同一对象的并发变更无法可靠检测：受影响 entry=unknown，coverage=partial/unknown。
   - 只有之后一轮稳定观察证明摘要不匹配，旧 Packet claim 才能标 stale。
   - 无关只读工作=restricted；依赖精确路径状态的操作=blocked。
   - 文件 identity token 不等于内容不变性证明；inode/file ID 不能被包装为跨平台原子快照。

3. **Case / Unicode path alias collision**
   - 两个不同 UTF-8 path 在明确 profile 下映射同一 filesystem identity：path claim=conflict/ambiguous。
   - 若 profile 证明两个对象不同，保留精确路径；无法判断则 unknown。
   - 禁止 case-fold、Unicode normalize 或替换字符后静默合并。
   - 相关路径操作=blocked；无关只读工作=restricted。
   - 确定性契约层使用 virtual path-identity adapter；真实文件系统能力另做 native E2E。

4. **Provider authorization vs not-found**
   - 403/429/timeout/ambiguous 404：source freshness=unknown，identity=unknown/unresolved。
   - 只有认证主体、精确资源/revision 与 Provider 契约共同确认的 authoritative 404 才能将对应 source 标 stale；identity 仍 unresolved，除非其他权威来源独立证明。
   - 本地独立只读工作=restricted；依赖 canonical/checkout/push identity 的操作=blocked。

### 下一版 Fixture 纳入建议

| 候选 | 结论 |
|---|---|
| Re-enumeration race | 纳入下一版确定性 semantic fixture；native Git CLI 另做跨平台 E2E |
| Provider response matrix | 纳入下一版确定性 semantic fixture；真实 Provider adapter 另做契约 E2E |
| File object replacement | 拆为 virtual observer-contract fixture + 原生 OS/filesystem E2E |
| Path alias collision | 拆为 profile-driven virtual contract fixture + 原生 filesystem E2E |

当前 Fixture Inventory 不变：4 positive / 9 Schema-invalid / 19 semantic-invalid。候选项不计入现有数量，也未创建新的 JSON fixture。

### 反例审查结论

- 不把“观察期间不稳定”误判成“来源不存在”。
- 不把 403/429/timeout 或可见性不明的 404 升级为 authoritative not-found。
- 不把 path alias 的已证实冲突降格成普通 stale；也不把无法观察的 alias 强行判 conflict。
- 不把 inode/file ID 一致当成内容不变；能力不足必须 unknown。
- recovery_mode 按动作依赖范围计算：局部 blocked 不应停止独立安全只读分析；restricted 不是默认写权限。
- 上述均可使用现有 D1 Packet 字段和 D2 状态轴，不增加 Schema 0.2.0 字段。

### 冻结与实施边界

- Schema blob SHA 仍为 `a2f2097a17c08bf0a2ae733ab43a8f1919b48813`；本轮未修改 Schema。
- D0 已确认冻结；D1、D2、D3 仍未冻结。
- 未实现 Semantic Validator、Fixture Runner、Writer 或 CI Gate。
- PR #10、main、版本和 tags 未修改；PR #11 保持 Open + Draft。

### 下一步（唯一首选）

把下一版两类确定性 fixture（re-enumeration race、Provider response matrix）各自的测试向量拆成独立的 case ID、companion context 和预期 normalized result；同时为 file-object/path-alias 两类定义 native profile conformance matrix。完成设计复核后，再决定是否正式扩充 Fixture Inventory。

## 下一版 Semantic Fixture Case ID 与原生平台能力矩阵（2026-11-12）

新增 `SEMANTIC-EXECUTION-CONTRACT.md` §15 与 Design §17.21，细化未来候选向量 ID：

### 建议纳入下一版的确定性 semantic cases（7 个）

Re-enumeration race：
- `fingerprint-reenumeration-race-untracked-added`
- `fingerprint-reenumeration-race-index-changed`
- `fingerprint-reenumeration-race-head-changed`

Provider response：
- `identity-source-forbidden`
- `identity-source-rate-limited`
- `identity-source-timeout`
- `identity-source-ambiguous-not-found`

当前已有的 `identity-source-reference-unresolvable` 继续代表 authenticated authoritative-not-found，不重复新增。

### 虚拟 observer/path-identity contract cases（7 个）

File object：
- `fingerprint-file-object-replaced-contract`
- `fingerprint-file-mutated-in-place-contract`
- `fingerprint-file-identity-unavailable-contract`

Path identity：
- `fingerprint-path-case-alias-contract`
- `fingerprint-path-unicode-alias-contract`
- `fingerprint-path-distinct-control-contract`
- `fingerprint-path-equivalence-unavailable-contract`

这 7 个虚拟 cases 通过 companion adapter 明确提供对象 identity 与路径等价关系，测试协议规范化结果；真正的文件系统能力另做 native E2E。

### Native filesystem profile matrix

执行契约增加以下实测能力维度：
- case equivalence；
- Unicode equivalence；
- stable object identity；
- in-place mutation visibility；
- symlink support；
- executable-bit visibility。

每一项能力按 actual mounted test root 探测，不按 OS 名称推断。明确不支持可标 not_applicable；预期支持但不能观察或结果不确定必须 unknown；不能把 not_applicable/unknown 当 pass。

### 数量和范围

下一版候选扩展为 14 个 contract cases（7 个确定性 semantic + 3 个文件对象 virtual + 4 个路径 identity virtual）；native E2E 独立统计，不算 Packet fixtures。

当前 inventory 仍为 4 positive / 9 Schema-invalid / 19 semantic-invalid，未创建新 Packet fixture；Schema SHA 保持 `a2f2097a17c08bf0a2ae733ab43a8f1919b48813`。未新增 Schema 字段。

本轮仍只做设计契约；没有实现 Validator、Fixture Runner、CLI adapter 或 CI Gate。D0 保持已确认冻结，D1/D2/D3 未冻结。

### 下一步（唯一首选）

进行候选 adapter contract 反例审查：重点看 event barrier 是否足以避免 race 测试时间依赖、文件对象 token 是否被误用成内容锁、路径等价 profile 是否存在不同客户端无法统一解释的自由度、Provider 404 权威性是否有可验证来源。完成后再决定是否批准把 14 个 case 纳入下一版 Fixture Inventory。

## Candidate Adapter Contract 反例审查已完成（2026-11-12）

新增 `SEMANTIC-EXECUTION-CONTRACT.md` §16 与 Design §17.22，审查四种候选测试机制自身的假设：

1. **Event barrier**：必须有初始/最终 observation snapshot IDs 和有序 event log；不允许 sleep/polling timing tests。Evaluator contract 与真实 CLI observer E2E 分开。
2. **File identity**：open-handle identity、current path identity、content stability 分开观察。handle=A/path=A，替换后 handle=A/path=B，应把当前 path claim 标 unknown。稳定 inode/file ID 不证明内容不变；原地修改无法可靠观察时也必须 unknown。
3. **Path equivalence**：必须给精确 UTF-8 bytes/codepoints、case/Unicode capability、pairwise same_object/distinct_objects/cannot_determine 关系与 profile revision；OS 名称不构成能力证明，不允许隐式 case-fold/Unicode normalize。
4. **Provider 404**：authoritative_not_found 需要 provider/API contract revision、exact resource/revision/scope、认证 principal、认证成功以及 endpoint 不会对该 principal 隐藏资源的契约证据；任何前提缺失都为 ambiguous_not_found/unknown。Fixture 不得保存凭据/token/header。

### 最终候选处置

- Re-enumeration race：确定性 Semantic Fixture，使用 snapshot IDs + event log；真实 CLI 重读时机另做 E2E。
- Provider response matrix：确定性 Semantic Fixture，使用 local stub + principal/resource/revision/contract metadata；真实 Provider adapter 另做 E2E。
- File object replacement：virtual observer contract fixture + 原生文件系统 E2E。
- Case/Unicode alias：profile-driven virtual path contract fixture + 原生文件系统 E2E。

原生 profile 的 unsupported 可标 not_applicable；预期能力无法观察为 unknown；两者都不是 pass。候选契约不要求新增 Packet 字段。

当前候选仍为 14 个 contract cases，不计入当前 4 positive / 9 Schema-invalid / 19 semantic-invalid；没有新建 Packet fixture。Schema blob SHA 仍为 `a2f2097a17c08bf0a2ae733ab43a8f1919b48813`。

### 下一步（唯一首选）

对 companion-context machine representation、adapter API 和 reason-code 边界做一次取舍审查：优先设计最小、可版本化且不成为第二套项目状态数据库的 Fixture Context Contract；明确哪些字段是 harness input、哪些是 live observation、哪些是 normalized output。通过该设计审查前，不扩充 Packet fixtures、不实现 Runner/Validator/CI Gate。

## 独立 Semantic Fixture Context Contract 设计提案（2026-11-12）

新增 `schemas/scp/0.2/fixtures/CONTEXT-CONTRACT-DESIGN.md`，提议将未来 companion context 设计为独立机器契约，而不扩展 SCP Packet：

- Contract 名称：`scp-fixture-context`。
- 建议版本：`0.1.0`，独立于 Packet schema_version 0.2.0。
- 初始建议路径：`schemas/scp-fixtures/0.1/fixture-context.schema.json`；该 Schema 已在后续批准后创建，当前状态和 SHA 见文末最新 Context 0.1.0 状态章节。
- JSON Schema Draft 2020-12 是接受后唯一机器契约；Markdown 仅为人类审查说明。
- Context 固定 Packet/Schema blob SHA、profiles/capabilities、deterministic clock、allow-listed setup driver ID、stimulus/events、companion observations 和 expected normalized D2 outputs。
- 不允许任意 shell/script、不允许真实凭据、不允许用户真实仓库；所有 setup mutation 仅在 disposable fixture root。
- Context 是测试输入；actual run manifest 独立记录 client/adapter version、observation/event log、normalized result、assertions/cleanup，不回写 Context。
- `scp.fixture.*` reason codes 暂仅属 fixture conformance vocabulary，不进入 Packet Schema/runtime API。

设计判断：该模型只描述测试刺激和预期，不保存项目 tasks/requirements/ADR/Evidence，不构成第二套项目状态源。真实项目状态仍由现有权威文件负责。

**历史待决策清单（已被后续用户批准取代）：**五项决策已获批准，Context Schema 0.1.0 Draft 与三个 design-only Context instances 已创建；没有创建 Runner 或 machine execution result。

## Fixture Context Contract 开放边界的推荐方案（2026-11-12）

对 `CONTEXT-CONTRACT-DESIGN.md` 的 5 项待决策形成推荐：
1. 接受独立 `scp-fixture-context/0.1.0`，与 Packet 0.2.0 分开版本化。
2. 接受 typed declarative observations + allow-listed driver IDs；禁止任意 shell/script。
3. 接受 immutable Context 与每次独立 run manifest 分离，actual result 不回写 Context。
4. `scp.fixture.*` reason codes 仅作为 Fixture Conformance vocabulary，不进入 Packet/runtime API。
5. Capability profiles 使用 immutable reference + blob SHA；第一版不开放 per-fixture 自由 override。

补充 pinning：
- Setup driver 必须同时 pin `driver_id`、`driver_contract_version`、`driver_bundle_sha256`，不能仅依赖可变 ID 或版本文字。
- Capability profile 必须 pin `profile_id`、`profile_version`、`profile_blob_sha`。
- Context 自身 SHA 由 run manifest 外部绑定，避免自引用。

未来 Context Contract 冻结/生产采用条件见 `CONTEXT-CONTRACT-DESIGN.md` §14。上述“不创建 Schema/机器实例”是批准前的历史状态，已由后续 §17.25 和本 Handoff 的 Context 0.1.0 最新章节取代。`SEMANTIC-CONTEXT.md` 仍是人类 review catalog；机器 Context 只描述测试输入和预期，不形成第二套项目状态库。

## Fixture Context Schema 0.1.0 Draft 已创建并完成标准 Schema 验证（2026-11-12）

### 当前机器契约

用户已批准五项 Context Contract 设计决策，现已建立独立版本空间：
- `scp-fixture-context/0.1.0`
- Schema：`schemas/scp-fixtures/0.1/fixture-context.schema.json`
- Compatibility：`schemas/scp-fixtures/0.1/COMPATIBILITY.md`
- README / Validation report 同目录。

Context Schema 独立于 Packet 0.2.0，不添加 Packet fields。

### 最新收紧

- path-equivalence observation 必须引用 `profile_revision`。
- Provider authoritative 404 的 event 和 companion observation 必须同时带 `not_found_authority_evidence` artifact ref，固定路径和 Git blob SHA；布尔值不能单独声明“权威”。
- success / forbidden / rate_limited / timeout / ambiguous_not_found 均不得宣称 `not_found_authority=true`。
- 新增 synthetic Provider fixture contract：`schemas/scp-fixtures/providers/0.1/github-rest-not-found-contract.json`，Git blob SHA `6573628ce89d1e9f0e43ad2ecc341dc99b29e887`。该文件仅描述本地 stub，不是对真实 GitHub API 的语义承诺。
- Compatibility 文档补充 event sequence、Profile/Driver registry、provider event/observation cross-reference、claim/scope 唯一性及 action disjointness 约束。

### 当前 Schema 和样例

- Context Schema SHA：`9348e22ac0ee450ce6689cec4fb87f0aa985104c`。
- Context 正例：3 个。
- Context 结构负例：5 个。
- Capability Profiles：3 个。
- Driver descriptors：3 个，均标记 `contract_only`。
- Provider authority contract：1 个。
- 3 个 Context 样例引用对应的 SCP Packet fixture、Packet Schema、Capability Profile 和 Driver descriptor SHA；Provider authoritative 404 样例额外引用 provider authority contract SHA。

### 标准验证

使用 Python `jsonschema 4.26.0`：
- `Draft202012Validator.check_schema`：PASS。
- `FormatChecker()` 已启用。
- 3 个代表性正例均有效。
- 5 个结构负例均按预期被拒绝。
- 非法 date-time 被拒绝；namespaced extension 接受，unqualified extension 拒绝。

注意：该验证只覆盖 Context Schema 的结构和格式层；不代表 Registry/Driver/Provider Stub/Runner 已实现。Driver descriptor SHA pin 的是描述文件字节，当前这些文件都不是可执行 Driver Bundle。Context Schema 0.1.0 仍是 Draft。

### 未完成与冻结边界

- 尚无 Capability Profile Registry、可执行 Driver Bundle、Harness Registry、Fixture Runner、Semantic Validator、Run Manifest Schema/Writer、客户端 adapter 或 CI Gate。
- 还未达到两套独立 Harness Adapter 对同一 Context 产生一致 normalized input observation 的 §14 冻结门槛。
- D0 保持已确认冻结；D1、D2、D3 未冻结。
- PR #10、main、项目整体版本和 tags 未修改；没有合并、关闭 PR #11 或转 Ready-for-review。

### 下一步（唯一首选）

审查 Context Schema 与 Compatibility 之间的 cross-field 语义遗漏，并确定 Run Manifest 的最小字段/生命周期（仍然先设计，不创建 Runner/Writer）。随后再决定 0.1.0 是否可以冻结为 Context Contract 的正式机器契约；在双 Harness Adapter 互操作标准未完成前，不用于生产 Gate。

## Context 0.1.0 引用完整性复核（2026-11-12）

三个 Context 样例的 `target.repository_revision` 已统一为：

`1670320ea980368ed74cd4edd11cba4297467bde`

已读取该 revision 的 Git tree，确认它包含三份样例引用的 Packet fixture、Packet Schema、三个 Capability Profile、三个 Driver descriptor 和 Provider authority evidence artifact。逐项校验：
- 三份 Packet Git blob SHA 均与 Context `target.packet.blob_sha` 相符。
- Packet Schema Git blob SHA 与 Context `target.packet_schema.blob_sha` 相符。
- Profile Git blob SHA 与 `profile_blob_sha` 相符。
- 三个 Driver descriptor 在该 revision 中存在；其 exact UTF-8 bytes SHA-256 与 `driver_bundle_sha256` 相符。
- Provider contract Git blob SHA 与 `not_found_authority_evidence.blob_sha` 相符。

重要区分：
- Git blob SHA 用于定位仓库中的精确文件对象。
- Driver `driver_bundle_sha256` 是 exact descriptor bytes 的 SHA-256。
- 这三个 Driver 仍为 `contract_only`；即使哈希匹配，也不能执行。

当前 Context Schema SHA：`9348e22ac0ee450ce6689cec4fb87f0aa985104c`。当前 3 个正例和 5 个负例均经 Python `jsonschema 4.26.0` 标准 Draft 2020-12 Validator + `FormatChecker()` 验证，实际 Git blob SHA 与重新计算的 canonical JSON Blob SHA 相符。细节见 `schemas/scp-fixtures/0.1/VALIDATION-REPORT.md`。

本次引用复核未改变 Context Schema 或 Packet Schema，也未增加 Context/Packet Fixture 数量。

## Run Manifest 最小模型与生命周期设计（2026-11-12）

新增 `schemas/scp-fixtures/0.1/RUN-MANIFEST-DESIGN.md`，补足 Context 输入与未来 Runner 输出之间的生命周期设计。

### 最小模型

- 一个 Manifest = 一个 Client + Adapter + Harness attempt。
- 相同 Context 可对应多个 Manifest；不同客户端、重试必须分别生成新 Manifest。
- Context/Packet/Packet Schema/Profile/Driver/Provider contract 的 Blob SHA 与 SHA-256 输入 pin 外置记录；Manifest 自身 digest 也由外部计算，避免自引用。
- Manifest 保存 client/harness/adapter 版本、实际 measured capabilities、event/snapshot refs、actual normalized output、assertions、cleanup result。
- 不复制 expected result（它在 Context 内），不回写 Context，不充当项目任务或 Evidence 状态源。

### 结果状态轴

- `conformance_outcome`：conformant / non_conformant / inconclusive / not_run。
- `harness_outcome`：healthy / failed / interrupted / not_started。
- setup、stimulus、observation、evaluation、cleanup 各自记录状态。
- 语义断言通过但 cleanup 失败：conformance 可保持 conformant，但 Harness failed；整体运行不接受并 quarantine disposable root。
- capability/permission/observation 不足为 inconclusive；Context/driver/setup 无法执行为 not_run。
- retry 新建 Manifest；不覆盖旧结果。中断不能伪装成 completed。

### 安全和边界

不存真实凭据、token、cookie、authorization header、未脱敏 secret diff、原始工作区文件内容或非 fixture 路径数据。优先存脱敏 artifact ref/hash。Manifest 是单次测试证据，不是项目 Evidence、权限或状态源。

当前只有设计文档；没有 Run Manifest Schema、Writer、Store、Runner、Adapter 或 CI Gate。下一步先审查双 outcome 语义、cleanup/quarantine、interrupted/retry 与最小字段，再决定是否值得独立 Schema。

## Run Manifest 状态分类反例审查补充（2026-11-12）

对 `RUN-MANIFEST-DESIGN.md` 新增 §11，修正几类容易混淆的执行结果：

- Context 有意注入 Provider 403/429/timeout/ambiguous-404，且预期客户端返回 unknown：匹配时应为 conformant。
- Harness 本身未提供 Context 必须的观察输入：inconclusive/not_run，不是 client pass。
- Client 返回完整但与预期矛盾的 normalized result：non_conformant。
- Client 崩溃/超时/格式错误导致无完整结果：inconclusive，Harness failed/interrupted。
- 清理失败与语义断言分离：可保留 conformant + harness failed，但整体 run 不接受，资源隔离/quarantine。
- retry 创建新 run_id；interrupted manifest 终态不可重开。
- Context/Registry/Blob/Driver preflight 不通过时在 Client invocation 前拒绝。
- 多客户端比较报告为独立派生记录，不改写单个 Manifest，不得将 inconclusive 升级为 conformant。

本轮不新增 Packet/Context 字段，也未创建 Run Manifest Schema/Writer/Store/Runner。

## Run Manifest 第二轮故障与信任边界审查（2026-11-12）

Run Manifest 设计 §12 和 Design §17.28 已补齐以下规则：

### Retry identity
- 每个 attempt 有全局唯一 `run_id`。
- `retry_group_id` 关联同一逻辑测试重试链；`attempt_number` 在 group 内单调递增。
- 可选 `retry_of` 引用前一个 immutable manifest URI/digest。
- Duplicate run_id 是 storage conflict，不可覆盖；interrupted manifest terminal，重试新建 attempt。

### Interruption trust
- required assertions 未全部执行时，不得将已通过的子集提升为 full conformance。
- 若 client normalized result + required assertions 已持久化，但 cleanup/finalize 中断，保留 semantic outcome，Harness 标 interrupted/failed；overall run 不接受。
- 外部 CI event ledger 证明 attempt started 不等于 conformance evidence。
- 重试重新构建/验证 disposable fixture state，不复用半截 mutation。

### Cleanup ownership
- 只有 canonical path 位于 Harness-owned temporary parent、ownership marker 匹配 run_id、且没有 symlink/reparse escape 时允许删除。
- 所有权无法证明则不删，cleanup unknown/failed，资源 quarantine 并外部 review。
- cleanup failed 不改变 client result；资源禁止被 retry 复用。

### Artifact 与项目 Evidence 隔离
- Manifest diagnostics 使用 Harness artifact namespace，不进入项目 Evidence/evidence_refs/task/ADR/用户仓库。
- 默认只保存 normalized state、event/snapshot IDs、OID/digest、脱敏诊断。
- raw artifact 必须来自 disposable root，先脱敏再持久化；不存 token/cookie/authorization/private key/credential URL。
- Manifest 不是项目 Evidence、任务状态或授权来源。

### D2 recovery / permission
- actual `normal/restricted/blocked` 与 permitted/prohibited actions 是按 operation scope 记录的 client output，不是 Harness 命令或授权。
- restricted 不是写权限；局部 blocked 不自动阻断无关 local read-only analysis。
- Harness 不调用 client production write APIs。

### Cross-client comparison
只比较相同 Context/Packet/Schema/Driver/Profile/provider pins 与等价 capability/permission profiles；环境不同则标 mismatch 或只比较共同 claim，不平均/静默归一化。

本轮未新增 Packet/Context fields。Run Manifest 仍是设计文档，没有 Schema、Writer、Store、Runner、artifact service 或 CI gate。D1/D2/D3 继续未冻结，D0 保持已冻结。

## Run Manifest 最小机器字段与 Context 跨记录审查（2026-11-12）

### 本轮完成

新增并审查：
- `schemas/scp-fixtures/0.1/RUN-MANIFEST-DESIGN.md` §§13–16：最小字段候选、输入 pin 映射、actual normalized result、稳定断言键、状态派生规则、retry/lifecycle 约束、RM-P01–P04 正向有效记录与 RM-N01–N10 负向语义向量。
- `schemas/scp-fixtures/0.1/COMPATIBILITY.md` §10：Context 0.1.0 到 Run Manifest 的跨记录校验规则。
- `schemas/scp-fixtures/0.1/README.md`：同步 Run Manifest Schema Gate 当前状态。
- `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §17.29：记录跨阶段结论、范围与决策。

### 核心收敛

1. Run Manifest 保持独立测试产物，不扩展 Packet 或 Context，不成为项目 Evidence/任务/权限状态源。
2. 候选字段包含 attempt/retry identity、wall-clock timestamps、Context/Schema/Packet/Schema/Repository/Registry/Driver/Profile/provider 的精确输入 pins、Harness/client/adapter/normalizer 版本、declared-vs-measured environment、独立 lifecycle axes、actual normalized result、assertions、双 outcome、cleanup/quarantine 和 Harness artifact refs。
3. Context expected 与 Manifest actual 逐字段映射；claim/recovery 数组分别按 `claim_ref`/`operation_scope` 匹配，不看数组顺序。
4. 原泛化 `assertion_id` 改为结构化键 `(subject_kind, subject_ref, field)`，避免数组下标、字符串拼接和客户端自定义计数器造成互操作差异。
5. 每个 expected normative leaf 必须有且只有一个 assertion outcome；expected unknown 是明确测试期望，客户端准确返回 unknown 可以 pass；Harness 未提供 required observation 则 inconclusive/not_run。
6. 清理失败/未知始终阻止整体接受并 quarantine；不会覆盖语义结果。重试永远新建 run_id 和 immutable manifest，不重开、不覆盖旧记录。

### Schema 决策

**本轮不创建 Run Manifest Schema。** 设计字段和语义向量已足以进入 Schema proposal，但当前 gate 未满足：
- 所有 Driver descriptor 仍为 `contract_only`，无可执行 Harness Registry/Bundle。
- 没有两个独立 Harness/Adapter 输出同一 normalized contract 的互操作证据。
- 没有可执行 credential-redaction、artifact namespace、cleanup ownership 负例。
- 没有 Manifest finalizer / immutable artifact store / retry semantic checker。

此时创建 Schema 会把未验证的 normalized output 和 Registry/cleanup 假设过早固化。该结论是暂缓创建机器契约，不是冻结或否定 Run Manifest。详见 RUN-MANIFEST-DESIGN.md §16。

### 提交与验证

本 Handoff 提交之前的设计文档提交：
- `01ff8c1080bc2abbf7680296a84880783ec3571e`（Run Manifest field mapping / examples）
- `279bbe98a019f784ff39a2aaa480579b40ec3d5f`（Context–Manifest cross-record rules）
- `e6f286ae05ccda9eddc7ff8f3903383a3ed78688`（Design §17.29）
- `1c1f055952e8ff1e385c5a4caf6ea3d78744f51e`（Fixture README status）

PR #11 在上述文档变更前的 Head `c64411ebe0d6b8b0af06b6451f9bd5bb725e117c` 的 16 项检查全部 success。新文档提交将触发新 Head 检查；必须以本 Handoff 提交后的实际 Head 和对应 check-runs 为准，不能沿用旧 Head 绿灯。

### 约束保持

- D0 继续保持用户已确认冻结；D1/D2/D3 与 Fixture Context 0.1.0 均未冻结。
- 不创建 Run Manifest Schema、Writer、Store、Finalizer、Runner、Harness Registry、Adapter、Semantic Validator 或 CI Gate。
- PR #11 继续 Open + Draft；PR #10 继续 Open + Draft。
- 不合并、不修改 main、不 bump 项目版本、不打 Tag。
- main 现场 SHA：`02f8dde262455f15029a54694e129b05b70013a4`；PR #10 Head `88c342536b7d421aafd0b313e07c6f2b1849eab0`，Base `c98c99a9f39693f893300e990cd6770064438e42`。

### 下一步（唯一首选）

先对 normalized actual-result contract 与 assertion completeness 做独立审查，形成跨客户端一致的规范化输入/输出样例和对照矩阵；随后再由用户决定是否授权建立两个最小 Harness Adapter 互操作原型。只有双实现结果与 redaction/cleanup 负例稳定后，才重开 Run Manifest Schema Gate。

## Normalized Actual Result Contract 审查（2026-11-13）

### 本轮实际完成

新增：
- `schemas/scp-fixtures/0.1/RUN-MANIFEST-DESIGN.md` §17：候选 Normalized Actual Result Contract `scp-fixture-normalized-result/0.1.0`、projection 规则、field catalogue、missing/unknown/null/unsupported 语义、精确 key/string 比较、assertion completeness 算法、三个 Context 的结果投影示例、跨客户端比较矩阵及 NR-P01–P03 / NR-N01–N08 审查向量。
- `schemas/scp-fixtures/0.1/COMPATIBILITY.md` §11：Normalized Result 与 Context 0.1.0 的交叉映射、比较和兼容规则。
- `schemas/scp-fixtures/0.1/README.md`：同步规范化结果契约状态。
- `SESSION-CONTINUITY-PROTOCOL-DESIGN.md` §17.30：记录本轮收敛和门槛。
- 本 Handoff 更新本节。

### 核心规则

1. Normalized Result 是 test-scoped projection，不是客户端内部状态的完整 dump。Context expected 仅提供 projection keys/field names；实际值必须来自客户端观察，禁止复制 expected values。
2. Claim 按精确 `claim_ref`，Recovery 按精确 `operation_scope` 匹配；数组顺序无语义，重复 key 非法。
3. missing field 与 explicit `unknown` 分离：缺失= inconclusive/not_run；显式 unknown 是确切状态值，可与 expected unknown 匹配；null invalid；未知 enum/core field unsupported/invalid，不可降级成 unknown。
4. Reason codes、permitted/prohibited actions、user decisions 是 set-valued properties；重复值拒绝、顺序忽略，空数组与字段缺失不同。
5. 断言 key 使用 `(subject_kind, subject_ref, field)`；expected 每一个规范字段恰对应一个 assertion。集合字段整体为一个断言。
6. 当前三个 Context 的 expected projection 分别推导出 12 / 15 / 13 个 assertion tuples；这是结构计数，不是执行测试结果。
7. Cross-client parity：`equal` / `divergent` / `incomplete` / `incomparable`；无效规范化输出另标 `invalid_result`。必须精确比较 immutable inputs、deterministic event inputs 和 relevant measured capability/permission；Context 0.1.0 没有 per-field capability dependency map，有实质能力差异时整体 incomparable。
8. Parity equal 不代表符合 expected；每个 Manifest 仍须独立评估。unknown 不是 wildcard。

### 本轮设计判断

Normalized Actual Result 候选已达到独立实现评审的具体程度。**Run Manifest Schema Gate 仍不满足**：没有两个独立 Harness/Adapter、可执行 Driver/Registry、redaction/cleanup 负例、finalizer 和 immutable store。

因此仍未创建任何 Normalized Result JSON Schema、Run Manifest JSON Schema、Adapter、Harness Registry、Runner、Writer、Semantic Validator 或 CI Gate。设计文档不等于跨客户端互操作已验证。

### 最新文档内容 SHA（Git Blob SHA）

- RUN-MANIFEST-DESIGN.md：`f91eef7ab05c1a9070377fc587730cbf28a5222d`
- COMPATIBILITY.md：`e812e58392e1611efb894520a9298bff8c83e201`
- SESSION-CONTINUITY-PROTOCOL-DESIGN.md：`7a8a9d9855c0e42f69b082ac0f052d20fab0bea5`（该 SHA 对应 §17.30 更新后的文件内容；后续 §17.31 已更新）
- Fixture README：`866abe06e37958a61bf175b9f7c322e1fd39e7da`

这些是文件 Blob SHA；最终 PR Head / CI 以本 Handoff 提交后现场查询为准。

### 范围与冻结状态

- D0 已确认冻结。
- D1、D2、D3、Fixture Context 0.1.0 均未冻结。
- Run Manifest 与 Normalized Result 都是设计候选，未形成机器契约。
- PR #11 保持 Open + Draft；PR #10 保持 Open + Draft。
- 不合并、不修改 main、不升级项目整体版本、不打 Tag。

### 下一步（唯一首选）

对 §17 的 Normalized Result Contract 做一次独立 adversarial review，特别检查：Context expected projection 是否会导致 adapter 偷看 oracle、空数组/缺失/unknown 的 assertion 边界、extra output 的处置、跨平台字符串排序稳定性、双实现独立性是否足以排除共同模式错误。审查通过后形成两个独立 Adapter 的最小接口与 fixture 运行蓝图，**先由用户确认是否授权原型实现**；未获授权前不写可执行 Harness / Adapter。

## Normalized Result 独立反例审查与双 Adapter 蓝图（2026-11-13）

### 本轮修正与设计增量

1. Run Manifest Design §18 增加 Oracle isolation 独立审查：
   - Harness Control Plane 持有完整 Context/expected。
   - Client Sandbox 只接收 Packet/Schema、现场收集并核对的 observations、measured capabilities/permissions、deterministic clock 和 values-stripped projection descriptor。
   - Oracle Evaluator 只在客户端返回后使用 expected values；Context/expected/Manifest/assertion answer key 不可挂载进 Client Under Test 的 worktree/tool scope。
   - Harness 预检仅验证测试输入准备情况，不能把 Harness 自己的 Packet Schema 验证结果冒充 Client 的 `packet_schema_validation`。
   - Context companion observations 必须现场采集并 reconcile，不能复制成 actual observation refs。
2. 增加 NR-N09–NR-N16，覆盖 oracle 泄露、Harness 预检与 client 输出混淆、伪造实际观察、unknown core field 静默丢弃、locale/Unicode 排序、共享 Normalizer 冒充独立实现、empty set 与 missing 混淆。
3. Run Manifest Design §19 建立双 Adapter 最小实施蓝图：Client Evaluation Request、values-stripped Projection Descriptor、invocation/response boundary、Harness-input parity、Normalizer parity、Client-output parity + per-client conformance、最小验收矩阵。
4. Context Compatibility §12、Fixture README、SCP Design §17.31 同步上述约束。

### 独立实现验收的三个维度

- **Harness-input parity**：两个 Harness 独立从相同 Context 产生完全相同的输入包和实际观察摘要。
- **Normalizer parity**：两个独立 Normalizer 对相同 synthetic raw-response vectors 得到相同结果，且都遵守 missing/unknown/null/empty/duplicate/Unicode 规则。
- **Client-output parity + conformance**：两个不同 Agent 客户端处理等价输入后对照；parity 与每个 client 对 hidden expected oracle 的 conformance 分开报告。

两实现可以共享规范文档和 immutable fixture，但不能共享正在被验证的 Normalizer 实现。仅换名称、版本或命令包装不算独立实现。

### 当前决策

Normalized Result 和双 Adapter 蓝图已达到可供原型实施评审的设计具体度；但没有实际 Adapter/Harness 代码，也没有互操作证据。**本轮仍不创建任何可执行原型或机器 Schema**，原因是这会引入执行代码、依赖、临时资源和隔离行为，需要在设计完成后单独授权。

Run Manifest Schema Gate 仍关闭。不得把设计向量说成实际测试通过。

### 最新本轮新增提交

- `fffc688b3978a21c4d3bd9bef54627ca2b51ce55`：Normalized Result 契约与示例。
- `e84b149517431cbaae580e092090708b2410004a`：Context Compatibility §11。
- `838f373d874323bd8f0e7702fd35c9ef39559ab7`：规范化示例数组/记录顺序修正。
- `05542bf1e9ab3ef3ae51f4de7e4fd8cf7af9feca`：Oracle isolation 独立审查与 NR-N09–N16。
- `663375749d500893701be5841789de3d569392b1`：双 Adapter 实施蓝图。
- `b730c3b1c02a256dd963645fd40a961ca20122a5`：Context Compatibility §12。
- `7065847d2d9f9e5a5abc42a372f050c4c03640ab`：SCP Design §17.31。
- `aaed4c252113def4f7fd94b7a3af00eb0f43dfa9`：Fixture README。
- 本 Handoff 将再单独提交并触发 CI。

### 当前最新文件 Blob SHA（更新到本节前）

- `RUN-MANIFEST-DESIGN.md`: `cf7b3b6f4b269e16932ec17d4bca745ce6307b5e`
- `COMPATIBILITY.md`: `3b081a29cd57210326f2fb28c1e79db3e6c7c176`
- `SESSION-CONTINUITY-PROTOCOL-DESIGN.md`: `f0d1811b9dfd9affc3d7723a8b6d38df954b47ac`
- `schemas/scp-fixtures/0.1/README.md`: `bf1692fa24182fdcfd1121ccd23489de41a6011d`

### 下一步（唯一首选）

当前设计任务已完成。下一阶段应先让用户决定是否授权创建两个最小独立 Harness/Adapter 原型。若获授权，范围只限于：
- 使用现有三个 Context 和 NR/RM vectors；
- 在 Harness 临时目录搭建隔离、synthetic-only 的 fixture；
- 实现值剥离的 projection DTO 与独立 Oracle Evaluator；
- 在两种独立实现中分别完成 input/normalizer parity；
- 不接真实生产仓库、真实 Provider、真实凭据或项目写接口；
- 不创建 Run Manifest Schema、Writer/Store/CI Gate，除非后续另行审查和批准。

若未获授权，保持设计状态，不自动转入可执行实现。

### 一致性回看修正（2026-11-13）

复核发现 §13.1 的旧表格将 `actual_result` 限定为完整结果，与 §17–§18 新增的部分可信投影规则不一致。已修正为：可信 normalized projection 可以是 partial；只有无法构造可信 envelope 时才省略 `actual_result`；JSON null 仍非法。

修正提交：`fd749cc13bc782231d476fd4e7c907f82ff85cc4`。
修正后 RUN-MANIFEST-DESIGN.md Blob SHA：`4b245b47958a0f7d1be761c7a23106046a94ff2a`。

## 双 Adapter 原型阶段执行记录（2026-11-13）

### 用户授权范围

用户明确授权开始最小双实现原型，范围限于：
- 三个现有 SCP Fixture Context 0.1.0；
- synthetic-only observation 与 synthetic client-response vectors；
- 独立 Node.js / Python 标准库实现；
- 隔离临时目录运行和清理测试输出。

未授权、也未执行真实 Agent 调用、真实仓库写入、真实 Provider 请求、生产凭据使用、Runner/Registry/Writer/Store 或 CI Gate 实现。

### 已提交文件

PR #11 新增路径前缀：`prototypes/scp-fixtures/0.1/`，当前原型共 19 个文件：
- Node.js adapter / strict parser / Normalizer / Oracle / test；
- Python adapter / strict parser / Normalizer / Oracle / unittest；
- 3 个原有 Context 的精确副本；
- 3 个 synthetic observation packages；
- 3 个 synthetic client-output vectors；
- run-parity.sh、README、fixtures README、VALIDATION-REPORT。

关键提交：
- 原型代码与 fixtures：`34eff9387ea7347bb71ad1b923148bc924cc7e77`
- 验证报告来源限制：`319bbe08324999f9cbb45b441031702f64bf7f61`
- README 同步：`3c188eb3b044ff10d103c54d9f8f007d37a4949b`
- SCP 设计 §17.32：`f632e53538c6d393c5a02b9de383344c0259d38f`

### 实现边界

- Node 与 Python 各自独立实现；不 import/call/shell out 到对方。
- 两套实现只使用各自标准库，不新增第三方依赖。
- Client Evaluation Request 只带 Packet/Schema/Profile/Driver/Repository pins、synthetic observation package 和 values-stripped projection descriptor。
- Context expected values、assertion outcomes、Oracle object 不进入 Client Evaluation Request。
- Observation package 必须和 Context 的事件序列、companion observations、profile pin、capability set 逐项匹配。
- Normalizer 对 claim_ref / operation_scope 做精确键匹配；区分缺失、explicit unknown、null、空集合和重复成员。
- Oracle 独立按每个 expected leaf 生成 assertion outcome；synthetic value mismatch 会归入 non_conformant，而不是把 Manifest/测试记录判为不可解析。

### 本地工作副本验证（必须保留来源限制）

本地开发工作副本的运行环境：
- Linux x86_64
- Node.js v22.16.0
- Python 3.13.5
- 第三方依赖：无

运行结果：
- 3 个 Context，expected assertion projection 合计 40（12 + 15 + 13）；
- Node 与 Python 两套测试通过；
- 3 个请求 + 3 个 Normalized Result + 3 个 Oracle report，9 / 9 逐字节一致；
- 覆盖 strict JSON / UTF-8 / surrogate、duplicate keys、missing vs unknown、null、empty set、duplicate member/claim key、unsupported field、event/observation/profile mismatch、Unicode exact identifier、mismatch 与 not_run。

**重要：** 以上运行针对本地开发工作副本，不是当前 PR Head 上 exact Git Blob 文件的直接执行报告。文件镜像提交到 PR 后没有在当前容器中重新 checkout 并执行。VALIDATION-REPORT 已明确这个差异。现有 GitHub Actions workflow 没有运行这个 prototype suite；不能把当前 PR CI 当成原型测试通过证明。下次在正常 checkout 环境应运行：

`sh prototypes/scp-fixtures/0.1/run-parity.sh`

### 未完成和限制

- 未调用任何 Agent 客户端；client-output 文件是人工维护的 synthetic responses。
- 未运行真实 Git/FS/submodule/Provider observers。
- 现有 Driver 仍为 contract_only；尚无可执行 Harness Registry/Driver。
- 没有 OS-level client sandbox；只检查请求 DTO 不含 Oracle 成员，不代表能阻止拥有 unrestricted host access 的 Agent 读取可访问文件。
- 没有通用 secret redaction、cleanup ownership/quarantine、retry store、immutable Manifest store/finalizer。
- 没有 Normalized Result / Run Manifest Schema、Writer、Store、Runner 或 CI Gate。

### 下一步唯一首选

先在 checkout PR 分支的环境中重跑 exact committed prototypes，并审查 Node/Python 两套代码和实际 byte parity。之后再设计 synthetic Driver/Observation Adapter 的可执行边界及 Agent Sandbox 的 oracle isolation 验收；先证明 Agent 不可读 expected / Manifest / Oracle artifact，再考虑接入任一 Agent。Run Manifest Schema Gate 继续关闭。

### 当前约束

- D0 保持用户已确认冻结；D1/D2/D3、Context Contract 0.1.0、Run Manifest、Normalized Result 均未冻结。
- PR #11 继续 Open + Draft；PR #10 保持 Open + Draft。
- 不合并、不修改 main、不 bump 项目整体版本、不打 Tag。

## 第二轮原型代码审查与待执行门（2026-11-13）

### 新发现并已修复

1. **Empty actual row**：只有 `claim_ref` 或 `operation_scope`、没有实际字段的响应行应被省略；预期断言因此 inconclusive。Node/Python Normalizer 已同步实现。
2. **Duplicate expected keys**：Projection Builder 现在拒绝重复 expected `claim_ref` / `operation_scope`，避免同一 Assertion Tuple 被生成多次。
3. **user_decisions_needed 语义**：这是非空、精确 Unicode/自然语言字符串集合，可包含空格和中文；不应使用 action-ID regex。只有 permitted_actions / prohibited_actions 使用 action identifier grammar；reason_codes 使用专用 namespace。Node/Python 已修正并增加英文/中文排序回归向量。

相应测试已分别加入 Node/Python 测试文件。

### 验证状态必须区分

- 早期本地开发工作副本 baseline：三份 Context、40 个 expected assertion，Node/Python 测试通过，9/9 个生成产物逐字节一致。
- 上述 baseline 早于当前最新一批提交；空结果行、expected duplicate key 和 user decision 字符串相关回归用例不在该次运行内。
- 本环境尝试 checkout GitHub PR 分支时，网络无法解析 `github.com`，因此**不能声称当前最新提交代码已实际运行**。
- 现有 GitHub Actions 检查不执行 prototype `run-parity.sh`。CI 成功不替代原型专项测试。

VALIDATION-REPORT 已追加上述限制和重跑命令。当前剩余的第一个明确完成门是：在能 checkout 精确 PR Head 的环境执行 `sh prototypes/scp-fixtures/0.1/run-parity.sh`，修复差异并更新报告。完成该门后，Node/Python synthetic prototype milestone 可关闭。

### 阶段收口和时间预期

不要把“真实 Agent 互操作”与当前双实现原型收口混成一个无限期任务：
- **当前原型里程碑**：以 exact committed checkout 运行两套测试、9 个产物 parity、回归向量通过和报告与实际一致为完成条件。
- **下一里程碑**：OS-level Agent Sandbox / Oracle Isolation；先证明被测 Agent 不能读取 expected/Manifest/Oracle，再做真实客户端调用。
- **后续里程碑**：真实两个 Agent 客户端互操作和真实 Observation Driver。

这几个里程碑没有可诚实承诺的日历完成日期；完成依据是明确的验收结果，不以持续增加设计文档代替验收。当前工作集中在关闭第一项，不扩大范围。

### 冻结与分支边界

- D0 已确认冻结；D1/D2/D3、Context 0.1.0、Run Manifest、Normalized Result 均未冻结。
- PR #11 继续 Open + Draft；PR #10 不变；main 不变。
- 不合并、不升级整体版本、不打 Tag，不新增 CI gate。

## 第三轮原型收口审查（2026-11-13）

### 又完成的修正

- `user_decisions_needed` 改为非空精确 Unicode/自然语言字符串集合；动作 ID 语法只用于 permitted/prohibited actions，reason code 独立遵守 `scp.fixture.*`。
- Node 与 Python 都新增英文/中文决策字符串的 UTF-8 排序回归测试。
- Node capability observation 增加明确对象/数组/重复能力检查，并增加 malformed value negative tests。
- `run-parity.sh` 支持 `NODE` / `PYTHON` 覆盖，自动探测 `python3` 或 `python`，降低 Windows Git Bash 环境差异。
- 双语言 Normalizer 已统一 empty-row omission 和 expected duplicate projection-key rejection。

### 验证来源和当前欠账

当前 exact PR Head 的代码文件与测试文件已在仓库核验，19 个原型文件仍完整存在。早期 baseline 本地工作副本测试结果为 40 assertions / 9 of 9 parity，但不覆盖后续修正。新回归用例已提交，尚未执行。

尝试 checkout 远端分支失败，原因是当前执行环境无法解析 `github.com`；这不是代码失败，也不是测试通过。VALIDATION-REPORT 已明确写出此环境阻塞。现有 CI 不执行原型脚本。

### 当前原型第一阶段的完成标准

只剩一个首要门槛：在能读取当前 PR 分支的环境，针对 exact committed HEAD 运行 `sh prototypes/scp-fixtures/0.1/run-parity.sh`，确保 Node/Python 套件和 9 个产物 parity 全部通过，然后将执行环境、HEAD SHA、具体输出和报告一致性记录下来。若有差异，修复后重复到通过。

**第一阶段不包含真实 Agent 调用。** 这阶段一旦 exact checkout 测试通过即可关闭；真实 Agent Sandbox / Oracle Isolation 是第二阶段，双 Agent 互操作是第三阶段，不再把它们绑定成一个无法收口的“大任务”。

当前没有可诚实承诺的日历完成日期；执行阻塞是本环境的 GitHub DNS/checkout 能力，而不是还需要再写一轮设计说明。


## 最新执行记录（2026-11-13）：双实现原型收口与 Sandbox 阶段切换

### PR #11 当前状态

- PR #11：Open + Draft，base feat/governance-consistency-audit。
- 当前 PR Head：17e14191ab184e974247df2a81444a73fe566793；其中 fixture identity 修正提交为 f37bc16a4976a389494e33139cba93b0e8f2a1d0，Node test 声明修正提交为 17e14191ab184e974247df2a81444a73fe566793。
- main 保持 02f8dde262455f15029a54694e129b05b70013a4；PR #10 保持 Open + Draft、未合并。
- PR #11 不合并；不修改 main、PR #10、项目版本或 Tag，不新增 CI Workflow / Gate。

### 双实现原型验证

在隔离临时目录中，执行了从 GitHub API 取回并按 Git Blob SHA 身份核验的 PR 源码副本：
- Node.js 测试通过，三个 Context、40 个 expected assertion leaves；
- Python 测试 2/2 通过；
- Context Blob SHA 3/3 核验；
- Request、Normalized Result、Oracle Report 共 9/9 个生成文件逐字节一致。

执行前逐项验证 GitHub API 返回的源码和 Fixture Blob SHA。由于运行环境无法解析 github.com，没有把这次执行描述为完整 Git checkout。具体身份和执行输出见 prototypes/scp-fixtures/0.1/VALIDATION-REPORT.md。

另发现并修复 observation package 未绑定 Context fixture identity 的问题：Node/Python 现在都要求 observation fixture_id 精确等于 Context fixture_id，错配负例在两套测试中均被拒绝。修正提交为 f37bc16a4976a389494e33139cba93b0e8f2a1d0。

### CI 证据（单独记录）

Head db0d26f5e82997b664ebb15871dc3d9e80ab4c53 的既有 Standards CI 两次运行：
- 43408727534：8/8 矩阵任务 success；
- 43408720794：8/8 矩阵任务 success。

该 workflow 不执行 prototypes/scp-fixtures/0.1/run-parity.sh，CI 结果不替代原型专项测试。最新 Head 17e14191 的两次运行 43411433407 与 43411426571 均已完成 8/8 success。

### 阶段状态与下一工作

- Stage 1：三个固定 synthetic Context 的 Node/Python Adapter、Normalizer、Oracle 原型与列明的验证矩阵已通过，按当前范围收口。
- Stage 2：进行 OS-enforced Client Sandbox / Oracle Isolation 设计和 backend adversarial validation。首先只测试恶意 synthetic child process 和 synthetic client shim，不接真实 Agent、不使用真实凭据、不访问外部 Provider、不触碰用户仓库。
- Stage 3：真实双 Agent 客户端互操作，只有在 Stage 2 的 OS 隔离证据充分且单独明确授权后再启动。

Stage 2 设计位于 schemas/scp-fixtures/0.1/RUN-MANIFEST-DESIGN.md §21。当前更新只补设计与测试边界，不实现 Agent Runner、Sandbox Runtime、Registry、Writer、Store、Schema 或 CI Gate。

D0 保持用户已确认冻结；D1/D2/D3、Context、Normalized Result、Run Manifest 均未冻结。所有相关工作继续保持 Draft。


### 最终源码身份核验补充

最新 PR Head 17e14191 的四个 Node/Python adapter/test 文件 Git Blob SHA 与执行环境中的本地文件字节完全一致。Node 测试文件曾在 f37 更新时留下重复 let 声明；在 17e14191 中改为复用变量，并在这一最终文件版本上重新运行了完整 parity 脚本。结果仍为 Node PASS、Python 2/2 PASS、40 个 expected assertion、9/9 产物逐字节一致。详细 Blob SHA 和验证来源见 VALIDATION-REPORT。

本次源文件执行仍是 GitHub API retrieval + Git Blob identity verification，不宣称 Git clone 成功。最新 Head 的两次既有 CI matrix 均已 8/8 success，但不执行 prototype 专用脚本。


## 2026-11-13 remote-state correction (supersedes earlier current-head references)

- Current PR #11 branch Head after the final source/report updates: 8088a792cd10a3d60018148007f96313a566feef.
- The prototype code/test blobs were last changed in 17e14191ab184e974247df2a81444a73fe566793. Commit 8088a79 is a documentation-only update after that code commit; it does not change prototype sources or CI workflow.
- For the current branch Head 8088a79, existing Standards CI runs 43411720331 and 43411713662 each completed 8/8 matrix jobs successfully.
- The prototype-specific run-parity.sh was run against local bytes matching the four final remote adapter/test Git Blob SHAs from commit 17e14191. The final result remains Node PASS, Python 2/2 PASS, 40 expected assertion leaves and 9/9 byte-identical generated artifacts.
- PR #11 remains Open + Draft, unmerged. main remains 02f8dde262455f15029a54694e129b05b70013a4; PR #10 remains Open + Draft and unmerged.
- Stage 1 synthetic prototype is complete within its declared fixture/test scope. Stage 2 is currently design-only at RUN-MANIFEST-DESIGN.md §21. No sandbox runtime, Runner, real Agent invocation, schema, Registry, Writer, Store or CI gate has been implemented.


## 2026-11-13 Stage 2 Linux Sandbox probe execution

### New prototype artifacts

- \`prototypes/scp-sandbox/0.1/linux/probe.py.gz\`: deterministic gzip of the 20,304-byte standard-library Python probe source. The decompressed Git Blob SHA is \`88e08595b3f74fc7c5c59fb13c9473f94dbb5503\`; compressed blob SHA is \`ae64fb2f651018e53705990c2f715ea25fa465b9\`.
- \`prototypes/scp-sandbox/0.1/linux/run.sh\`: expands to a temporary source file, executes it with Python 3 and removes it on exit.
- \`prototypes/scp-sandbox/0.1/README.md\` and \`VALIDATION-REPORT.md\`: prerequisites, execution command, repeat-run results and non-claims.

### Execution results

Three complete Linux x86_64 runs passed. The core probes demonstrated user+mount+network+PID namespaces, read-only rootfs, dedicated writable scratch, UID/GID 65534, dropped capability sets, no_new_privs, host path/symlink denial, hidden proc/sys, host loopback network isolation, host environment non-inheritance, PID descendant teardown, hostile synthetic shim denials, 4096-byte output cap, exact synthetic-marker redaction before persistence, normal cleanup and injected quarantine/non-reuse.

The exact scope and limitations are in the validation report. This is not production sandbox certification. No real Agent, Provider, credential, user repository or production write path was used.

### Stage 2 status

- Gate A: passed for the tested Linux x86_64 runtime and listed probes.
- Gate B: passed for the synthetic hostile shim and listed output/cleanup probes.
- Cross-platform support, syscall filtering, resource-accounting enforcement, general secret redaction and real filesystem cleanup failure are not yet proven.
- Gate C (real Agent invocation) remains closed; do not start it without further security review and explicit authorization.
- No CI workflow/gate, Schema, Runner, Registry, Writer, Store or production Agent integration was added.
- PR #11 remains Open + Draft; main and PR #10 remain unchanged; D0 is still the only user-confirmed frozen decision.


### Supplementary Linux security primitive checks

- A separate classic seccomp-BPF smoke test passed: the kernel accepted a filter and denied `getppid` with `EPERM`. This filter is not integrated into the current Sandbox probe.
- cgroup v2 controllers are visible, but the cgroup mount is not writable and does not allow delegated child cgroups. The prototype's resource bounds are `prlimit`-based only.
- Landlock ABI probing timed out within the bounded check; availability remains unknown.

These are explicitly separated from the Gate A/B core pass and are documented in the prototype README and validation report. No seccomp enforcement, cgroup accounting or Landlock enforcement is claimed for the current sandbox.


## 2026-11-14 seccomp launch-chain hardening

- Added seccomp-exec.c: x86_64 architecture check, x32 ABI rejection, no_new_privs, and a classic BPF denylist for high-risk mount/namespace/ptrace/process-memory/kernel/BPF/perf/keyring/userfaultfd/io_uring operations. Unlisted syscalls default to ALLOW; this is not a complete production allowlist.
- Added seccomp-child-test.c: checks blocked calls, allowed getpid/fixture read/scratch write, read-only-root write denial, and filter inheritance after fork+exec.
- Added run-seccomp-integration.sh: compiles both sources and executes the filter inside user/mount/network/PID namespaces, read-only chroot, dedicated writable scratch and UID/GID 65534.
- Updated the Linux run.sh entry point to run the original namespace/chroot probe and then the seccomp launch-chain integration.
- Local execution passed with GCC -Wall -Wextra -Werror. cgroup delegation remains unavailable, Landlock status remains unknown, and Gate C remains closed.


## 2026-11-14 modern syscall and chroot cwd validation follow-up

The current PR Head adds regression cases for:
- modern mount APIs: open_tree, move_mount, fsopen, fsconfig, fsmount, fspick, mount_setattr;
- process handles: pidfd_getfd, pidfd_send_signal, process_madvise, kcmp;
- chroot cwd escape: outer runner changes cwd to the host temporary directory and plants a world-readable synthetic canary there before chroot; the client must not read the canary by relative path.

The full seccomp integration run passes for both the initial client and fork+exec child. The parent and child deny the syscall probes, deny relative host cwd canary access, read the readonly fixture, receive EROFS for rootfs writes, and write only to the dedicated scratch mount.

Exact current file SHAs at commit 864d48f:
- seccomp-exec.c: 6ab19f64773794f36eb402853c76ff591b4c4f28
- seccomp-child-test.c: eccaa7a590b7683001148a50d0fce7767327340d
- run-seccomp-integration.sh: f683504f88d38e515dee58be62716d513aa03a94

The filter remains an x86_64 denylist with default ALLOW. No production syscall allowlist, cross-platform equivalence, cgroup delegation or Landlock enforcement is claimed. Gate C remains closed.


### 2026-11-14 definitive Landlock/cgroup result

- Landlock: a direct C call to landlock_create_ruleset returned ENOSYS within a bounded 3-second probe. Unavailable in the tested kernel/runtime; no Landlock policy can be installed here.
- cgroup v2: controllers are visible, but /sys/fs/cgroup is mounted read-only, cgroup.subtree_control is empty and child cgroup creation fails. No delegation is available.
- Resource limits therefore remain per-process prlimit only; do not describe them as cgroup aggregate CPU/memory/PID enforcement.


## 2026-11-14 bounded tmpfs scratch follow-up

- Replaced the host writable scratch bind mount in run-seccomp-integration.sh with a tmpfs mounted inside the private mount namespace.
- tmpfs is capped at 32 MiB with nosuid,nodev,noexec.
- The synthetic client verifies tmpfs filesystem type, all three mount flags, capacity ceiling and scratch writes.
- The check runs in both the initial client and its fork+exec child.
- Exact executed blobs: seccomp-child-test.c 21667e37e1c2d75ce9448194df06c504cdb33a5b; run-seccomp-integration.sh 83f0dd5c1c1019fc2f638e7f7057d5621027d95e.
- This bounds scratch file storage and removes the host writable bind mount from the client. It does not replace cgroup CPU/memory/PID controls; those remain unavailable in this runtime.


### 2026-11-14 inherited FD and scratch inode controls

- Seccomp wrapper closes FD 3+ with close_range or an RLIMIT_NOFILE-bounded fallback before exec.
- Runner opens a host-only canary as FD 9; both the initial client and fork+exec child must observe EBADF.
- Scratch uses private tmpfs: size=32m, nr_inodes=4096, nosuid,nodev,noexec.
- Client verifies TMPFS_MAGIC, NOEXEC/NOSUID/NODEV, byte and inode ceilings, allowed scratch writes and readonly-root write denial.
- Executed source Blob SHAs: seccomp-exec.c b36b72376cec0b8fc1b2b9b32519b6f077798b1a; seccomp-child-test.c 2871732dd3e946b9bdaac71d2a3dfd7f421b1029; run-seccomp-integration.sh 0b762b0daf763d3a3ef7f5a358060c17b8efa5c6.
- These controls reduce inherited host-handle and scratch exhaustion exposure, but do not provide aggregate cgroup CPU/memory/PID accounting or production Agent certification.


### 2026-11-14 runtime identity and capability readback

The seccomp child test now verifies in both parent and fork+exec child: UID/GID 65534, zero supplementary groups, no_new_privs=1, seccomp mode FILTER, empty effective/permitted/inheritable caps via capget, and empty capability bounding set across CAP_LAST_CAP. Exact test Blob SHA: c77f27b9062a8522f35a54c099dfb341a247a34c. Full integration passed with all prior modern mount/pidfd/clone/cwd/FD/tmpfs checks.
