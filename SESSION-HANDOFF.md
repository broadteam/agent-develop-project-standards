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
- Schema 条件约束：`packet_kind=handoff` 时必须提供 handoff；验证状态 passed/failed 或审查状态 reviewed/changes_requested 时必须提供至少一条 evidence_refs。
- 决策以 `decisions[]` 表达多个独立事项，每项有 decision_id、status、decision_maker 和 source_ref；单项确认不构成泛化授权。
- SCP 0.1 不含 lease_ref 或 lease service；协调信息只表达 owner、write_scope 和 isolation。
- Core 对象拒绝未知字段；扩展数据只能放在 namespaced `extensions` 中，不得重定义核心语义。
- **验证限制**：本轮只完成 JSON 语法和结构映射检查；尚未运行正式 JSON Schema validator，也未创建 validator/fixture runner。不能把示例标记为已通过正式 schema 验证。

### 当前状态与下一步

- D0：Frozen（用户已确认）。
- D1：Schema + compatibility policy draft，待语义审查；不接入强制门禁，不实现自动 Packet 写入器。
- PR #11 继续 Open + Draft，PR #10 继续 Open + Draft；不合并、不修改 main、不 bump 版本、不打 tag。
- 下一步：针对 D1 的字段必需性、状态组合、扩展机制和兼容策略做一次独立审查；修订后再决定是否冻结 schema。之后才考虑独立的 validator/fixture 实现提案。
