# Session Continuity Protocol（SCP）— 设计提案

> 状态：D0 语义已按用户确认冻结；D1 Schema 设计进行中  
> 适用范围：跨会话、跨 Agent 客户端、跨模型的项目工作连续性  
> 本文定义协议语义与分阶段交付边界。D0 决策已确认；D1 的具体字段/schema 仍需独立审查，尚不启用强制门禁、不要求现有项目迁移。

## 1. 问题定义

当前的 `SESSION-HANDOFF.md` 能提供人工交接入口，但单独依赖它无法可靠解决：

- 新会话不知道哪些记录仍然有效，哪些已被新提交、PR、任务状态或用户决定取代。
- 不同 Agent 对“已完成”“已保存”“已提交”“已验证”“已获用户确认”的理解可能不同。
- Agent 可能只继承摘要，遗漏原始目标、已接受变更、约束或尚未裁定的冲突。
- 多 Agent 在不同分支、worktree 或同一文件上并行工作时，缺少共享的所有权与冲突协议。
- 交接内容可能把推断写成事实，或把未运行的测试写成通过。
- 客户端私有记忆和聊天历史不具备统一、可审计、可移植的项目权威性。

SCP 的目标不是再造任务系统或记忆系统，而是定义一套**恢复、校验、记录、交接和并发协作的共同协议**，让不同客户端可以按相同语义读取和更新项目已有的权威状态。

## 2. 核心设计原则

1. **权威来源不迁移**：目标/变更、需求、任务、路线图、ADR、验证证据和 Git 状态继续由现有领域文件与版本控制系统负责。SCP 只保存引用、快照元数据和交接断点。
2. **摘要不是事实源**：handoff、客户端记忆、会话摘要均为导航或缓存；与权威记录冲突时，必须回到权威来源核验。
3. **先恢复，后行动**：未完成 Bootstrap 与 Freshness 检查前，不执行高影响写操作、合并、发布或破坏性迁移。
4. **事实、推断、待确认分离**：每项状态声明必须能标识来源和确认状态；Agent 推断不能自动变成 accepted 项目事实。
5. **证据绑定对象版本**：测试、审查和 CI 证据必须绑定具体 commit 或工作树快照；代码变化后不得沿用旧验证结论。
6. **断点描述真实状态**：未提交、未验证、未决策、被阻塞必须明确呈现，不能以“基本完成”掩盖。
7. **并发默认隔离**：优先使用独立分支/worktree；共享文件写入必须有明确所有权或协调结果。
8. **渐进采用**：先以文档协议和只读检查起步，再引入 schema、validator 和客户端适配；不一次性增加复杂后台服务。
9. **最小持久化**：只记录影响恢复正确性的增量；不复制聊天全文、完整 diff、任务清单或领域文件正文。

## 3. 协议对象与术语

### 3.1 Project Continuity Context

一个项目在某一时刻可恢复的上下文，由以下信息组成。它是恢复视图，不是需要整体复制或持续双写的独立记录：

- 项目身份：仓库、协议版本、工作区位置。
- 意图锚点：原始目标及当前适用的 accepted changes。
- 工作锚点：任务/里程碑 ID；若轻量任务无任务卡，记录简短工作主题。
- 代码锚点：branch、HEAD SHA、worktree 状态、未提交变更摘要。
- 证据锚点：最近一次验证所绑定的 commit/tree、命令、结果和环境。
- 协作锚点：活动 Agent、工作范围、租约或人工协调状态。
- 断点：已完成、正在做、未完成、阻塞、待用户决定、下一步。
- 来源状态：每项信息的来源、版本和 freshness 判定。

### 3.2 Continuity Packet

一次会话恢复或交接所需的最小数据包。它可以由权威文件与 Git/CI 现场状态动态组装，不要求每次都生成并提交新文件。

Packet 必须在语义上区分：

- **权威来源引用**：由 `intent`、`work`、`evidence_refs` 等字段指向既有权威记录；可选能力关闭或记录不存在时，不得虚构路径。
- **生成时观察状态**：由 `code`、`checkpoint` 等字段记录生产者实际观察到的状态，并通过 `provenance.source_revisions` 绑定来源版本、观察时间和 freshness。
- **last-known 状态**：Packet 被后续会话消费时，生成时的观察值自然降为 last-known；接收方必须现场 Bootstrap 并比较，不能将 Packet 值冒充当前事实，也不复制一份重复的 last-known 数据。
- **Agent 推断**：单独放在 `inferences[]`，包含推断摘要、依据引用和置信度；不得写入观察状态或权威记录字段。
- **待确认事项**：放在 `checkpoint.decisions[]`，每项独立记录 ID、状态、裁定主体和来源；单项确认不构成泛化授权。

Packet 中的领域状态原则上只保存引用和恢复所需的最小摘要；除非权威来源本身就是该断点文件，否则不得复制完整需求、任务卡、意图变更或验证记录。

### 3.3 Checkpoint 与 Handoff

- **Checkpoint**：记录当前工作在特定代码/状态版本上的可恢复断点。
- **Handoff**：把工作责任从一个 Agent/会话转交给另一个 Agent/会话，必须说明交接范围、未完成事项和操作边界。
- **Evidence**：证明某个对象在某个版本上经过某种验证的可追溯记录。
- **Lease**：对文件、目录、任务或资源的有时限写入协调声明；租约不是权限系统，也不等于 Git 锁。

## 4. 七个协议域

### 4.1 Bootstrap — 启动与恢复

**目标**：任何兼容客户端都能从仓库恢复正确的项目背景和当前工作，而不依赖旧聊天。

恢复顺序：

1. 识别仓库根目录、项目身份和协议版本。
2. 读取 `AGENTS.md` 规则入口；若存在 `SESSION-HANDOFF.md`，将其作为导航/交接材料读取，不将其视为所有项目都必须创建的文件。若不存在，按 `AGENTS.md` 指向的 `.memory/MEMORY.md §0` 或项目既有断点入口恢复。
3. 从可用断点/交接材料定位领域权威来源：意图基线/变更、相关需求、任务/里程碑、ADR、验证证据；可选能力关闭或文件不存在时按项目配置处理，不强制补建。
4. 现场核对 Git：当前分支、HEAD、upstream、worktree dirty 状态、未跟踪文件、相关 PR/CI。
5. 对照上次 checkpoint，标注差异和过期信息。
6. 汇总当前目标、任务、约束、未决事项和唯一下一步；必要时向用户提出一个最关键的澄清问题。

**输出**：恢复摘要 + 已核验来源清单 + freshness 差异 + 可执行下一步。

**禁止**：仅凭 handoff 摘要推断 PR 已合并、测试已通过、用户已批准或本地工作树干净。

### 4.2 Context Freshness — 上下文新鲜度

**目标**：识别陈旧、失效、互相矛盾或无法重新验证的上下文。

每项状态至少记录或推导：

- 来源标识（文件路径/记录 ID/URL）。
- 来源版本（Git commit SHA、文件哈希、PR head SHA 或 CI run SHA）。
- 最近观察时间（用于审计，不单独作为有效性证明）。
- 期望状态与本次观察状态。
- freshness：`current`、`stale`、`conflict`、`unknown`。

规则：

- Git/PR/CI 的动态状态必须现场查询；handoff 中的旧状态只是 last-known。
- 引用的文件、任务 ID、需求 ID、commit 和 CI run 必须存在且匹配。
- 来源版本发生变化时，重新读取受影响内容；不能仅因时间较近就认定新鲜。
- 无法访问远端时标记 `unknown`，不得降级为成功或沿用旧状态。
- 冲突不能由 Agent 静默选择“看起来更新”的一方；按领域权威来源和明确的用户决策规则处理。

### 4.3 Intent Continuity — 意图连续性

**目标**：跨会话保留用户原始目标、已确认变化、临时插单和未解决冲突之间的关系。

规则：

- 原始目标仍由 intent baseline 维护；后续变化追加到 change ledger。
- 仅明确用户决定可成为 accepted；Agent 建议保持 proposed/pending。
- 每次恢复任务时，核对当前工作与 baseline、适用 accepted changes、需求验收和约束。
- 临时插单必须保留原任务恢复点；不能隐式替换长期目标或优先级。
- 发现实际工作偏离时，标记 drift 并暂停受影响决策；不把“已写代码”当作用户批准。
- 轻量任务可不建卡，但仍不得违背明确目标和操作授权。

**输出**：当前有效意图引用、相关变化、待确认项、偏离风险。

### 4.4 Checkpoint — 执行断点

**目标**：准确表达工作处于哪个持久化和验证阶段，保证中断后可以安全续做。

Checkpoint 不采用单一“完成度”字段，而应分别描述以下维度。以下状态只描述执行断点，不覆盖任务索引、需求索引、验证索引或里程碑中的领域状态：

| 维度 | 状态示例 | 含义 |
|---|---|---|
| 工作内容 | not_started / in_progress / blocked / locally_complete | 工作本身进度；`locally_complete` 仅表示当前执行者认为本轮实现已完成，不等同任务 `done`、需求 `verified` 或里程碑完成 |
| 工作区可观察状态 | unknown / observed_clean / observed_dirty | 由 `code.worktree_state` 唯一承载，基于当前工具可见的文件系统与 Git 状态；不得推断编辑器内未落盘缓冲区状态 |
| 验证 | not_run / running / passed / failed / stale / unknown | 本次工作区/提交上的验证状态；`passed` 必须关联 Evidence，旧证据对新版本为 `stale`（保留旧 Evidence 引用以说明失效依据），无法读取证据为 `unknown` |
| 审查 | not_reviewed / reviewed / changes_requested / stale / unknown | 审查结论必须绑定被审查 revision、审查范围和审查者；revision 变化后重新判断是否 stale |
| 决策 | 以 `decisions[]` 表达多个独立事项 | 不用一个全局枚举代表多个决策；每项必须关联具体决策 ID、裁定主体和来源，不能作为泛化的用户授权标记 |

D1 Schema 将多个独立裁定项统一表示为 `decisions[]`；每项包含 decision ID、状态、裁定主体与来源，单项确认不构成对 Packet 或其他操作的泛化授权。

Checkpoint 最小字段：

- checkpoint ID、时间、协议版本。
- 当前 branch、HEAD SHA、worktree 状态。
- 未提交变更的文件列表与摘要；必要时记录 diff/tree hash，但不默认复制完整 diff。
- 当前工作主题与 G/R/T/M 引用（适用时）。
- 已完成、未完成、阻塞、待决策。
- 验证命令、结果、绑定 revision 和 Evidence 引用；没有运行必须写 `not_run`。`running` 还需记录执行者、运行标识和开始时间，无法确认状态时写 `unknown`。
- 待裁定事项列表及其权威来源引用；多个决策不能压缩成单一 decision 状态。
- 下一步和禁止操作。

规则：

- 文件系统中可观察到的改动不等于已提交；提交不等于验证；验证通过不等于用户验收。
- 通用 Agent 通常无法观察 IDE/编辑器内尚未写入文件系统的缓冲区；除非客户端提供可验证的编辑器状态接口，否则该部分必须标为不可观察/unknown，不得声称已保存或未保存。
- 若工作树 dirty，必须明确交接可观察到的未提交变更路径、归属与处理方式；D1 Schema 要求 `observed_dirty` 至少列出一个 `uncommitted_paths`。若无法观察 HEAD，则 worktree 状态必须为 `unknown`。
- 不自动 stash、commit、reset 或清理未跟踪文件。
- 新 commit 或相关文件变更会使旧验证/审查证据重新评估 freshness，相关 subject 已变化时标为 stale，除非证据明确覆盖新版本。

### 4.5 Concurrency Control — 并发控制

**目标**：避免多个 Agent/会话同时修改相同状态源或互相覆盖工作。

优先策略：

1. 发生真实并行写入时，每个 Agent 优先使用独立 branch/worktree；没有并行写入时不要求引入协调文件或 lease。
2. 任务或文件范围明确分配 owner；同一权威文件默认单写者。该约束沿用项目已有 `multi_agent` 能力规则，不因 SCP 自动启用该能力。
3. 首版不定义或要求 Lease；只有后续出现可复现且无法通过分支/worktree 隔离解决的共享写冲突时，才单独评估协调存储。
4. 写入前比较 base SHA 与当前 SHA；发生变化必须重新读取、重放或人工解决，不允许盲目覆盖。
5. 过期 lease 只表示协调声明失效，不代表可以删除其他 Agent 的工作；先检查工作树、分支和未提交改动。
6. 同一任务的状态变更与证据更新必须串行化，避免 done 状态先于验证结果写入。

**安全边界**：

- Git 分支/worktree 隔离是默认执行手段；lease 是协调层，不提供安全隔离或分布式事务。
- 首版只记录 owner、write-scope 和 branch/worktree 隔离声明；不引入 Lease 服务、外部锁或仓库内锁协议。后续若评估协调存储，必须另行设计原子性、过期恢复和故障边界。
- 无法确认资源 owner 或发现重叠写入时，暂停冲突范围，不暂停无关任务。

### 4.6 Handoff — 交接

**目标**：交接的是可验证的工作状态和责任边界，不是聊天摘要。

标准交接必须包含：

- from / to（Agent、客户端或责任人；未知可标 unknown）。
- 工作主题、目标/需求/任务引用。
- 完成项及其证据。
- 正在进行的事项和准确断点。
- 未提交文件、分支、HEAD SHA、worktree 状态。
- 未运行/失败/过期的验证。
- 未解决问题、待用户决定、Agent 推断。
- 当前 PR/CI 状态及其绑定 SHA。
- 下一步（单一首选动作）与明确禁止操作。
- 交接时间和生成者。

接收方必须执行 Bootstrap/Freshness 核验，不能直接信任交接方写下的动态状态。

### 4.7 Evidence Provenance — 证据来源与可信度

**目标**：让每个“通过”“完成”“已审查”都能回答：谁验证、验证了什么、在哪个版本、用什么方式、结果如何？

证据至少包含：

- evidence ID 或稳定引用。
- subject：被验证的需求、任务、文件或发布对象。
- type：test / lint / build / CI / manual_review / user_acceptance / static_analysis。
- source：命令、CI run URL、审查记录或用户确认来源。
- subject revision：优先使用 commit SHA；未提交工作区必须描述 HEAD SHA、dirty 状态及被纳入验证的文件/差异范围。若使用文件摘要清单，需明确纳入的 tracked/untracked 路径和摘要算法；单独一个 Git tree SHA 不包含未跟踪文件，不能被误称为完整工作区快照。
- environment：OS、runtime、关键版本（适用时）。
- result：pass / fail / inconclusive / not_run。
- observed_at、actor、scope/limitations。

可信度规则：

- CI 证据必须绑定实际 workflow run 的 head SHA；仅有绿色徽标或旧 run 不够。
- 本地测试必须记录执行命令、退出码和代码版本；没有 commit 时需说明工作树状态。
- 人工审查必须说明审查对象和范围，不能泛写“已检查”；reviewer 必须可识别，结果与 observed_at 必须明确，提交变化后按 revision 判断 stale。
- 用户确认必须能追溯到明确用户表达；Agent 自己总结不能代替。
- 证据只对其 subject、revision 和 scope 有效；代码变化后需要重新判断是否仍有效。
- 证据缺失时明确标记 unknown/not_run，不允许补造。

## 5. 最小 Continuity Packet 草案

以下 YAML 仅保留为历史语义示意，不是机器契约。D0 已确定 JSON Schema 为唯一机器权威源；D1 的正式候选契约位于 `schemas/scp/0.1/continuity-packet.schema.json`，字段与兼容规则在 D1 审查通过前仍可调整。

```yaml
protocol: scp/0.1
project:
  repository: owner/repository
  root: .
session:
  id: optional-stable-id
  actor: agent-or-client
  started_at: 2026-11-12T00:00:00Z
intent:
  baseline_ref: .spec/intent/BASELINE.md
  accepted_change_refs: []
  pending_refs: []
work:
  topic: "简短工作主题"
  task_ref: null
  milestone_ref: null
code:
  branch: feature/example
  head_sha: "<full-commit-sha>"
  worktree_state: observed_dirty
  uncommitted_paths: []
checkpoint:
  work_state: in_progress
  verification_state: not_run
  review_state: not_reviewed
  decisions: []
evidence_refs: []
coordination:
  owner: agent-a
  write_scope: [schemas/scp/0.1/]
  isolation: branch_worktree
handoff:
  completed: []
  in_progress: []
  blocked: []
  next_action: "单一下一步"
  forbidden_actions: []
provenance:
  generated_by: client-adapter
  generated_at: 2026-11-12T00:00:00Z
  source_revisions: []
```

重要约束：

- Packet 是可重建的恢复视图，不是任务、需求或意图的新权威数据库。
- 不要求每次普通对话都生成文件；跨会话暂停、Agent 交接、长任务 checkpoint、阶段收口时才考虑持久化。轻量任务继续遵循项目现有轻量流程，不因 SCP 自动升级为跟踪任务。
- `task_ref`、`milestone_ref` 等引用按项目能力和实际场景选填；SCP 0.1 不定义 `lease_ref`，能力关闭或场景不适用时不得为了填满字段而创建治理记录。
- 任何动态字段都必须能标记 last-known 与 observed；不能把旧快照中的 branch/PR/CI 状态冒充实时状态。
- YAML 示例中的时间、分支和 SHA 仅作字段示意，实际实现必须从运行环境/权威来源读取，不能使用占位值伪造运行状态。

## 6. 会话生命周期

```text
START
  -> Bootstrap
  -> Freshness Check
  -> Intent Alignment
  -> Scope / Ownership Check
  -> Execute
  -> Checkpoint (as needed)
  -> Evidence Capture (when acceptance / review / closeout requires it)
  -> Handoff or Closeout
  -> END
```

异常路径：

- 上下文缺失：标 unknown，读取权威来源或询问用户，不猜测。
- 来源冲突：暂停冲突范围，记录冲突两侧证据。
- 工作树 dirty：保护现有改动，先识别归属，不 reset/stash。
- 租约/所有权冲突：停止重叠写入，保留不冲突工作。
- 验证失败：记录失败证据和下一步，不得标记验证通过。
- 用户决策待确认：保持 pending，不由 Agent 代替用户决定。

## 7. 初版范围与明确 Non-goals

### 初版建议纳入

- 协议术语、生命周期、权威来源和状态语义。
- Continuity Packet 的最小 schema。
- Bootstrap/Freshness 的只读恢复流程。
- Checkpoint/Handoff 的字段契约。
- Evidence 与 commit/CI SHA 绑定规则。
- Node/Python schema validator 的一致性测试（如最终决定采用双实现）。
- 至少两个独立客户端按同一 Packet 完成恢复的可重复 fixture；真实客户端端到端支持需单独标注客户端版本和证据。fixture 验证协议互操作，不等于证明真实客户端加载规则或工具权限行为一致。

### 初版不做

- 不创建第二套任务、需求、目标或路线图系统。
- 不把完整聊天历史同步到仓库。
- 不要求每轮对话更新记忆或生成 checkpoint。
- 不实现中心化 Agent 编排平台、远程锁服务或分布式事务。
- 不自动 stash/commit/merge/reset，不自动替用户确认意图。
- 不把客户端私有记忆当作项目事实源。
- 不把所有 Agent 的内部推理、token 或私有上下文写入仓库。
- 不把 PR/CI 状态硬编码进长期静态文件。

## 8. 分阶段落地建议

| 阶段 | 交付 | 验收重点 |
|---|---|---|
| D0 语义冻结 | 协议术语、权威来源、状态模型、失败策略 | 无第二事实源；七域边界无重叠 |
| D1 Packet Schema | 版本化 schema、示例、兼容策略 | 必填字段可校验；未知字段与升级策略明确 |
| D2 Read-only Bootstrap | 恢复器/诊断报告，只读读取 Git 与项目权威文件 | 不写项目文件；过期和冲突可定位 |
| D3 Checkpoint/Handoff | 生成/校验断点与交接 packet | dirty tree、未验证、待确认均不会丢失 |
| D4 Evidence/Freshness | 证据绑定 commit、CI run 与失效规则 | 旧 SHA 证据不能覆盖新代码 |
| D5 Concurrency | 支持 branch/worktree 隔离与 owner/write-scope 声明；只有真实冲突证据出现后才重新评估协调存储 | 冲突写入可检测；首版不引入 Lease 服务或外部锁 |
| D6 Client Adapters | 至少两个客户端消费相同 packet | 规则正文不分叉；恢复结果一致 |

每个阶段独立评审和验收；只有 D0 语义冻结后才开始 schema/代码实现。阶段之间不要求版本号同步推进。

## 9. 已裁定的设计决策

本节保留 D0 裁定主题的导航；正式决策及其边界以 §11.3 为准。用户已同意按推荐方案推进：

1. Packet 仅在跨会话暂停、真实交接、重要 checkpoint 或阶段收口时持久化。
2. JSON Schema 是唯一机器权威契约；Markdown 只能由工具生成，不得人工双写。
3. 先做至少两个独立客户端的 fixture 契约测试，再逐客户端增加真实 CLI E2E 证据。
4. 首版只要求 branch/worktree 隔离与 owner/write-scope 声明，不引入 Lease 服务或外部锁。

## 10. 当前状态

- 本文是独立 SCP 设计与 D1 规格工作，不改变 PR #10 的 3.0 审查结论。
- PR #10 保持 Open + Draft；本提案应在独立分支/独立 PR 评审，不能混入 PR #10。
- D0 语义已获用户确认并冻结；D1 schema 仍处于候选审查状态，不启用强制门禁、不要求现有项目迁移。


## 11. D0 内部一致性审查（2026-11-12）

本节记录 D0 的内部审查依据；D0 的产品决策已由用户明确确认。字段名与机器 schema 由 D1 单独定义和审查。

### 11.1 与现有规范的职责映射

SCP 必须作为现有会话协议的跨客户端互操作层，而不是替换它。当前模板已经定义了按任务分级的开工/收口流程、六行内 MEMORY 断点、意图/需求/验证分域事实源、可选任务/路线图/ADR 能力，以及客户端私有记忆单向镜像。D0 应沿用这些约束：

| 现有权威来源/机制 | 当前职责 | SCP 允许做什么 | SCP 不得做什么 |
|---|---|---|---|
| `AGENTS.md` | 唯一规则入口、任务分级、权限、按需读取、收口路由 | 定义跨客户端一致的恢复顺序与最低互操作语义 | 复制规则正文或强制所有任务走完整流程 |
| `.memory/MEMORY.md §0` | 最小跨会话断点与稳定事实摘要 | 作为默认恢复入口；handoff/packet 可引用其断点 | 另建长期会话总账，或要求每轮对话写 packet |
| `.spec/intent/BASELINE.md + CHANGES.md` | 原始目标与被接受/待确认的意图变化 | 引用有效 G/C，检测 drift | 在 packet 中维护第二份目标或变更账本 |
| `.spec/requirements/INDEX.md` | 需求 ID 与状态 | 引用相关 R，恢复验收上下文 | 复制需求正文或自行改变需求状态 |
| `.spec/verification/INDEX.md` | 验证证据事实及其 commit 绑定 | 引用 V，并核验其 revision/freshness | 另建与 V 并行的验证事实账本 |
| `.spec/tasks/index.md`（仅 task_tracking 启用） | 任务状态唯一源 | 引用 T 与任务卡断点 | 在 packet 中覆盖任务状态或强制启用 task_tracking |
| `.spec/roadmap/INDEX.md`（仅 roadmap 启用） | 里程碑状态唯一源 | 引用 M | 复制或替代里程碑状态 |
| `.spec/adr/`（仅 adr 启用） | 架构决策记录 | 引用相关 ADR | 把临时会话判断提升为已采纳架构决策 |
| `CLIENTS.md` | 客户端入口与已验证程度 | 定义 packet 的客户端中立语义，并记录 adapter 能力声明 | 将 fixture 通过等同真实客户端 E2E 通过 |
| Git / CI | 代码版本、工作区和自动化运行事实 | 现场读取并绑定 SHA/run | 把旧 handoff 中的动态状态当作当前事实 |

**冲突原则**：先按领域定位权威来源，再比较来源版本与现场状态；Packet 只能报告冲突，不能裁决领域事实。用户当次指令仍决定本次授权边界，SCP 不扩大操作权限。

### 11.2 D0 语义修订建议

内部审查发现，初稿有几处需要在进入 schema 前收紧：

1. **轻量任务不能被协议升级**：Bootstrap 是恢复策略，不意味着每次会话都生成 Packet、Checkpoint 或任务卡。默认持久化仍只用于跨会话暂停、真实交接、长任务断点和阶段收口。
2. **Checkpoint 状态不能冒充领域状态**：`locally_complete` 不是 task done；Checkpoint 的 verification 只能引用 Evidence，不能取代 V 索引；decision 状态必须绑定具体决策，不能被理解为通用授权。
3. **可选能力必须可缺省**：T/M/ADR 等引用按项目能力启用和实际场景选填。关闭能力时不创建替代目录，也不把 `not_configured` 误报为错误。SCP 0.1 不定义 Lease 字段。
4. **未提交工作区证据需要精确定义**：Git tree SHA 不覆盖 untracked 文件；未提交验证至少要记录 HEAD、dirty 状态、纳入范围及必要的文件摘要，避免伪称已绑定完整快照。
5. **并发控制按需启用**：沿用现有 `multi_agent` 规则；单 Agent/无并发任务不引入 lease。Branch/worktree 隔离优先，lease 不是 MVP 前置条件。
6. **客户端互操作分级**：fixture 只证明数据契约可交换；真实 CLI 加载、工具权限和行为差异必须单独验证，不能由 fixture 代替。

### 11.3 D0 产品决策（用户已确认，2026-11-12）

用户明确同意按推荐方案推进，D0 的四项产品决策冻结如下：

1. **Packet 持久化**：只在跨会话暂停、真实 Agent 交接、重要 checkpoint、阶段收口等确有恢复价值的节点持久化。普通对话和轻量任务不强制生成 Packet；Packet 只保存权威来源引用、最小恢复摘要和断点，不复制领域事实账本。
2. **表示格式**：JSON Schema 是唯一机器权威契约；Markdown 仅作为可选的人类可读视图，必须由工具从机器数据生成，禁止人工维护两份等价事实。旧 YAML 片段只作语义草图，不具有契约效力。
3. **客户端互操作验收**：先以至少两个独立客户端 fixture 验证相同 Packet 的读写/恢复契约；随后逐个客户端补真实 CLI E2E，并按客户端版本和实际证据声明支持程度。Fixture 通过不得宣称真实客户端 E2E 已通过。
4. **并发协调**：首版只要求真实并行写入时使用 branch/worktree 隔离并声明 owner/写入范围；不引入 Lease 服务或外部锁。只有后续出现可复现且无法通过隔离解决的共享写冲突，才重新评估协调存储。

**D0 状态：Frozen。** 以上决定仅冻结协议语义和范围，不代表 D1 字段/schema 已冻结，也不授权自动 stash/commit/reset/merge、扩大写入权限或替用户作业务决策。

### 11.4 第二轮边界检查

进一步审查发现以下语义必须在 D0 进入冻结前明确：

1. **编辑器缓冲区不可观测**：跨客户端通用协议不能假定能读取 IDE 尚未写入文件系统的内容。Checkpoint 只能声明工具实际观察到的文件系统/Git 状态；不可观察的编辑器缓冲区必须是 unknown，不能使用 saved / unsaved 做未经证实的承诺。
2. **多个待决策事项不能压成一个枚举**：一个会话可能同时有多项独立待用户裁定事项。应使用带 ID 和来源的待决策列表；用户确认必须关联具体事项，不能将一个 confirmed 状态误读为对整个 Packet 或后续操作的授权。
3. **审查证据也有版本有效性**：代码审查必须绑定被审查 revision、范围和审查者；提交变化后需重新判断审查是否 stale，不能只对测试证据执行 freshness。
4. **断点入口必须适配项目现状**：SESSION-HANDOFF.md 是可选交接入口，不应成为所有项目的必需文件。没有该文件时，应沿用 AGENTS.md 指向的 MEMORY §0 或项目既有断点入口。
5. **Evidence 记录按验收需求触发**：普通局部测试不应被强制转成 V 记录；只在需求验收、重要审查、里程碑/阶段收口或发布决策需要时登记，延续现有 verification 规则。
6. **示例格式不得提前替代格式决策**：当前 YAML 只是语义示例。D0 决定协议语义，D1 才确定机器格式、schema 版本和兼容规则；不得在文档中一边称格式未定，一边让示例看起来像已冻结契约。

以上边界修订构成 D0 语义冻结的审查依据；具体 schema 仍由 D1 单独审查。

## 12. D1 Schema 设计启动（2026-11-12）

D0 已冻结，D1 开始定义可跨语言消费的机器契约。当前策略：

- 唯一机器权威源：JSON Schema Draft 2020-12；不维护手写 YAML/Markdown 平行契约。
- Schema 文件：`schemas/scp/0.1/continuity-packet.schema.json`，当前 schema 标识为 `0.1.0`。
- 示例文件：`schemas/scp/0.1/examples/handoff-minimal.json`，示例必须通过对应 schema 验证。
- Packet 的持久化由工作节点/交接场景触发，不代表每个 session 必须创建文件。
- schema 采用显式版本标识；已发布版本不可原地改变既有字段语义。兼容性策略见 `schemas/scp/0.1/COMPATIBILITY.md`，当前仍是 D1 草案。
- Core object 拒绝未知字段；扩展数据必须放入 namespaced `extensions`，不得覆盖核心语义。
- `code.worktree_state` 是工作区可观察状态的唯一字段，不在 checkpoint 中重复保存；声称验证/审查通过必须附带 `evidence_refs`。
- 首轮只定义 Packet 数据契约，不实现 validator、不接入门禁、不生成自动写入器。
- D1 同时明确最小正/负例契约；JSON Schema 无法单独保证 `decisions[].decision_id` 的属性级唯一性，因此该约束留给后续独立审查的 semantic validator。Schema/fixture 规范不等于本 PR 实现 validator 或 CI gate。
- 首轮互操作验收先建立两个独立客户端 fixture 的共同输入/预期恢复结果；真实 CLI E2E 是后续按客户端单独声明的证据。
- 首版并发字段只表达 owner、工作范围和隔离信息；不定义 Lease 服务或锁语义。

D1 完成标准：schema 与示例结构稳定；必填/可选字段有明确语义；版本兼容与扩展策略明确；负例边界可测试；不产生第二套领域状态源。通过独立审查后，才进入 D2 只读 Bootstrap；validator/fixture 实现应作为后续可单独审查的交付，不与 schema 设计混为一体。

## 13. D2 只读 Bootstrap 与 Context Freshness 设计提案（2026-11-12）

> 状态：设计草案，待独立审查；D1 Schema 0.1.0 尚未获用户批准冻结。
>
> 本节先定义恢复算法、freshness 语义和安全边界。它不修改 D1 Schema，不要求实现 Validator、Packet Writer、CI Gate 或客户端适配器。下文的字段/引用映射仅为概念映射，最终必须与获批准的 Schema 版本逐项核对。

### 13.1 D2 的目标与非目标

D2 要回答的不是“如何把 Packet 读进来”，而是：一个新会话如何以只读方式恢复项目工作上下文，判断哪些旧信息仍可用、哪些已过期、哪些相互矛盾，以及在证据不足时如何安全降级。

目标：

- 从项目规则入口和现有权威来源恢复最小可执行上下文。
- 对 Packet/handoff 中的引用逐项检查存在性、版本和适用范围。
- 对 Git、PR、CI 等动态状态现场核验，不把旧快照当成当前事实。
- 对每个来源给出可解释的 freshness 结果和证据。
- 在 schema 不兼容、来源不可访问、状态冲突或权限不足时，采取明确的只读降级策略。
- 输出可审计的恢复摘要，供 Agent 与用户决定下一步。

非目标：

- 不重建或复制任务、需求、意图、ADR、验证记录等领域状态。
- 不自动修复引用、不自动更新 Packet、不写 MEMORY、不创建任务或决策记录。
- 不执行 stash、commit、checkout、reset、merge、rebase、push、PR 修改或 CI dispatch。
- 不把 Bootstrap 结果视为用户对后续写操作的授权。
- 不要求所有普通会话都持久化 Bootstrap 报告。

### 13.2 Read-only 的精确定义

D2 的只读模式是对项目状态的严格无写入读取，不只是“尽量不改文件”。

允许：

- 读取规则、断点、领域索引、被引用记录和相关文件。
- 读取 Git 状态、commit/tree/blob 元数据及 diff（仅用于理解，不应用）。
- 查询远端分支、PR、CI run 和只读 API。
- 计算本地文件哈希、比较 revision、生成内存中的恢复摘要。
- 向用户报告缺失、过期、冲突、未知和需要授权的事项。

禁止：

- 修改工作区文件、索引、配置、权限或 Git 元数据。
- 创建、覆盖或删除 Packet、handoff、MEMORY、任务卡、证据记录或临时项目文件。
- 执行会改变仓库状态的 Git 命令或远端写 API。
- 自动安装依赖、运行会产生项目文件/缓存/数据库迁移的命令，或触发具有副作用的构建/测试脚本。
- 因发现不一致而擅自“修正”权威来源。

D2 Bootstrap 不主动生成项目文件、测试报告、锁文件或构建产物。工具运行时自动维护的标准依赖缓存和系统临时数据，只有在项目 AGENTS/宪法明确允许时才属于例外；不得借此写入项目目录或改变用户环境。若某个检查工具会触发项目文件生成、自动格式化、数据库迁移或其他项目状态副作用，该检查不属于 D2 Bootstrap 的只读操作；应跳过并标记未验证，或在取得明确授权后另行执行。

### 13.3 Bootstrap 的恢复顺序

Bootstrap 采用有序、按需读取的流程；前序步骤无法确认时，不得假装后续结论完整。

| 阶段 | 读取与检查 | 产出 |
|---|---|---|
| B0 项目识别 | 仓库根目录、remote/repository identity、当前工作目录；若存在 Packet/协议元数据则读取协议标识 | project identity；不匹配时停止套用该 Packet；没有 Packet 或协议元数据不阻断旧项目恢复 |
| B1 规则入口 | 读取 AGENTS.md 及其明确要求的宪法/规则入口；识别适用能力开关和权限边界 | 当前适用规则集与读取范围 |
| B2 断点定位 | 优先读取项目指定的 MEMORY §0 或既有恢复入口；若存在 SESSION-HANDOFF.md/Packet，则作为导航和 last-known 线索 | 恢复锚点，不把摘要提升为权威事实 |
| B3 意图与范围 | 按当前工作读取 intent baseline、适用 accepted changes、相关 requirements；可选任务/roadmap/ADR 仅在能力启用且引用存在时读取 | 当前目标、约束、验收锚点、待确认项 |
| B4 代码现场 | 只读检查 branch、HEAD、upstream、tracked/untracked/dirty 状态及相关提交关系 | 现场代码状态；不可观察内容标 unknown |
| B5 证据现场 | 对本次任务相关的 verification/review evidence、PR/CI 引用做存在性和 revision 核验 | 证据有效性与 freshness 结果 |
| B6 冲突与新鲜度 | 比较 Packet last-known、权威来源当前版本和现场观察结果 | per-source freshness、冲突清单、限制 |
| B7 恢复摘要 | 汇总目标、当前断点、已确认事实、Agent 推断、待用户决定和单一建议下一步 | 可供用户审阅的只读恢复报告 |

读取应遵循最小必要原则：先根据断点定位相关 G/R/T/M/V/ADR，再读取对应记录；不得因为协议存在就全量加载所有历史变更、任务卡或证据正文。

### 13.4 来源权威性与冲突处理

Bootstrap 不使用“最新文件优先”这种简单规则。不同事实由不同来源负责，先识别事实类型，再识别权威来源：

| 信息类别 | 权威来源 | Packet/handoff 的地位 |
|---|---|---|
| 原始目标、已接受意图变化 | intent baseline + accepted change ledger | 导航引用与 last-known 摘要 |
| 需求与验收状态 | requirements index / requirement record | 引用，不得覆盖 |
| 任务状态 | 启用 task_tracking 时的 task index/card | 引用；未启用时不得推造任务状态 |
| 里程碑状态 | 启用 roadmap 时的 roadmap index/record | 引用；未启用时不得推造里程碑 |
| 架构决策 | 启用 ADR 时的 ADR；否则按项目既定决策落点 | 引用或待确认说明 |
| 验证/审查证据 | verification index 与对应 Evidence 记录；PR review/CI 原始记录按其领域适用 | 证据引用和上次观察结果 |
| 当前代码状态 | 当前工作区与 Git 对象/状态 | 生成时快照，不代表消费时事实 |
| PR/CI 当前状态 | 现场查询到的远端 PR/CI 资源 | last-known，仅供定位 |
| 用户授权/本次操作范围 | 当前会话中用户明确表达及项目权限规则 | 不得从历史 Packet 推导新授权 |

冲突处理规则：

1. **权威来源与 Packet 不一致**：权威来源优先；Packet 标记 stale，并记录差异。不得静默改写权威来源。
2. **同一领域存在多个权威候选且无法确定优先级**：标记 conflict，停止依赖该事实的高影响操作，向用户报告冲突来源。
3. **用户当前指令与历史意图记录不一致**：当前指令可构成待记录的意图变化，但在需要持久化或影响长期目标时，按现有 Intent Continuity 规则确认并记录；Bootstrap 不自行写入。
4. **Git 现场与远端状态不一致**：分别报告本地与远端事实；不将远端分支或 PR 状态覆盖成本地工作区状态。
5. **证据与被验证 revision 不一致**：证据保留为历史证据，但对当前 revision 标 stale；不得将旧通过结果沿用到新代码。
6. **Packet 与 Packet 冲突**：Packet 本身不是权威来源。回到其引用的权威来源；若仍无法确定，标 conflict，不按时间戳自动选一个 Packet。

### 13.5 Context Freshness 分类

Freshness 是逐个来源/声明计算的属性，不是给整个项目贴一个全局“新鲜/过期”标签。协议兼容性是独立检查轴：未知或不兼容的 Schema 版本应标记 unsupported/incompatible，而不是伪装成 freshness=unknown；两项结果必须分别报告。

| 状态 | 定义 | 允许的使用方式 |
|---|---|---|
| current | 已成功读取对应权威来源或现场资源，身份/版本/范围匹配，且没有发现相关变更 | 可用于本次恢复摘要；仍受操作授权约束 |
| stale | 来源存在，但 revision、内容、状态或适用范围已变化，旧声明不能直接代表当前事实 | 仅作为历史线索；需重新读取/验证 |
| conflict | 两个或多个适用来源对同一事实给出不可同时成立的结论，且权威规则不能消解 | 不得选边；暂停依赖该事实的高影响操作 |
| unknown | 来源无法访问、引用不可解析、版本不可观察或证据不足 | 不得按成功/当前处理；明确列出未验证原因 |

状态判定补充：

- current 需要可验证的身份和版本匹配；仅时间戳较新不构成 current。
- 来源内容变化不一定影响所有声明。应按声明依赖的范围判断；无关文件变化不应让整个 Packet 全部 stale。
- stale 不代表原记录错误或应删除，只表示它不再证明当前状态。
- conflict 不等同 unknown：前者有互相矛盾的可观察证据，后者缺少足够证据。
- unknown 不能被降级成 current、passed、clean 或“无变更”。
- Schema 不支持的协议版本/核心字段语义不得解释成 unknown 后继续使用；应进入不兼容降级路径（见 §13.7）。

### 13.6 Revision 与 Freshness 判定规则

判定应基于来源类型，不应强求所有来源使用同一种哈希：

- Git commit：比较完整 commit SHA，并在需要时检查祖先关系；分支名只是可变引用，不能代替 SHA。
- Git tracked file：先区分 HEAD 中的 blob 与工作区实际文件。工作区 clean 时可比较 HEAD blob SHA；相关 tracked path 在工作区被修改时，该来源至少标 stale，不能因为 HEAD blob 未变就宣称工作区内容 current。若 Packet 声称覆盖 dirty 文件，必须有可核验的文件内容摘要和路径范围；否则标 unknown/stale，不把 Git tree SHA 当作完整工作区快照。
- Untracked/dirty worktree：不能只依赖 Git tree SHA。若 Packet 没有覆盖相关未提交路径及其摘要，只能确认 HEAD，不能宣称 dirty worktree 与生成时一致。对被引用的 untracked path，若没有可核验的路径身份和内容摘要，不得判 current。
- PR：重新读取 PR 当前 head/base、状态和必要的 review 状态；PR 编号不代表 head 未变。
- CI：核验 workflow run 的 head SHA、run 身份、结论和完成状态；排队/运行中不是通过，旧 run 不能覆盖新 head。
- Evidence：核验 evidence ID 是否可解析、subject/revision/scope 是否覆盖当前工作；无法读取 Evidence 正文或权威记录时标 unknown。
- 文档/领域记录：优先使用 Git blob/commit revision；若来源位于外部系统，则使用该系统提供的稳定 revision/etag/update token。只有时间戳而无可靠版本标识时，不得宣称严格 current。
- 用户决策：回到可追溯的明确用户表达或项目决策记录；Agent 摘要不是决策证据。

Freshness 计算应记录“比较对象”和“比较范围”，例如：Packet 在 commit A 观察到 requirements/R001；当前工作树在 commit B 中该文件 blob 未变化，因此该引用可判 current。若只能证明 commit A 与 B 的关系，却未检查相关路径，不足以证明所有来源 current。

### 13.7 失败路径与安全降级

Bootstrap 必须定义可继续、受限继续和停止三种结果，不用一个布尔值掩盖风险：

| 场景 | 恢复结果 | 行为边界 |
|---|---|---|
| Packet 缺失 | 从规则入口和既有断点恢复 | 可继续只读恢复；不要求创建 Packet |
| Packet JSON 无法解析 | 忽略其机器数据，保留文件作为待修复线索 | 不猜字段含义；回到权威来源恢复 |
| Schema 版本未知/不兼容 | 标记 unsupported/incompatible | 不消费未知核心语义；仅可读取明确安全的项目规则和权威来源 |
| 可选引用目标不存在 | 对该引用标 unknown 或 stale（依具体原因） | 不自动创建缺失任务/需求/ADR |
| 远端 API 不可用 | 远端动态状态标 unknown | 可在明确标注限制后继续本地只读工作；禁止宣称 PR/CI 当前状态 |
| Git HEAD 不可读取 | code revision/worktree freshness 为 unknown | 不执行依赖当前 revision 的写操作 |
| 工作区 dirty 且归属不明 | 报告 dirty paths 和 owner unknown | 不覆盖、不清理、不 stash；冲突路径暂停写入 |
| 证据缺失或 revision 不匹配 | evidence unknown/stale | 不宣称验证通过；可重新设计验证计划，但执行需遵循权限规则 |
| 权威来源相互矛盾 | conflict | 暂停依赖冲突事实的高影响动作，向用户提出最小澄清 |
| 只读权限不足 | 对受影响来源标 unknown | 不尝试绕过权限或切换凭据 |

**受限继续**仅适用于不依赖未知/冲突事实的低风险只读分析；任何写入、发布、合并、迁移、删除或权限变更均需要重新检查相应事实并满足用户授权。Bootstrap 本身不授予此类操作权限。

### 13.8 Bootstrap 输出契约（概念层）

D2 输出不是新的持久化账本。默认只在当前会话中形成恢复摘要；只有 D0 已定义的持久化节点才考虑将断点写入 Packet。

恢复摘要至少区分：

- **Verified facts**：现场读取并带来源/版本的事实。
- **Last-known facts**：来自 Packet/handoff，但尚未现场验证的旧观察。
- **Inferences**：Agent 基于证据作出的推断，明确标记置信度与依据。
- **Unknowns**：无法访问或缺少证据的项目。
- **Conflicts**：不能由权威来源规则解决的冲突。
- **User decisions needed**：需要用户裁定的具体事项，不得伪装成已授权。
- **Next safe action**：在当前证据和权限边界内最安全、最小的一步。
- **Forbidden/unauthorized actions**：当前没有授权或明确禁止的动作。

每项 Verified fact 至少能追溯到 source reference、observed revision/identity、observed_at 和本次检查结果。摘要不得复制大段领域记录；只保留足以让用户理解结论的最小内容。

### 13.9 D2 验收标准（设计阶段）

D2 设计通过审查前，至少需要以下可审查产物；此处仅定义验收，不代表现在实现：

1. Bootstrap 状态流程图或等价状态转移说明，覆盖正常、缺失、不可访问、冲突和不兼容路径。
2. 一份来源权威性矩阵，覆盖 intent、requirements、tasks、roadmap、ADR、verification、Git、PR、CI 和用户授权。
3. 每种来源的 revision/freshness 判定方法与无法判定时的 unknown 规则。
4. 至少 10 个正/负场景案例，覆盖 Packet 缺失、过期、远端不可用、dirty worktree、未跟踪文件、PR head 变化、CI queued、Evidence revision mismatch、未知 Schema 版本和权威来源冲突。
5. 对只读边界进行逐项审查，确保恢复过程不会隐式写文件、改变 Git 状态、触发远端写 API 或运行有副作用的命令。
6. 与 D1 Schema 的字段映射表；在 D1 冻结前，该映射只能标为 provisional，不得据此修改 0.1.0 Schema。

D2 不以“能读出 Packet”作为验收。关键验收是：在来源过期、不可访问或互相矛盾时，客户端能否拒绝错误恢复，并给出一致、可解释的降级结果。

### 13.10 D2 与后续阶段的边界

- D1 Schema 0.1.0：当前仍待用户批准冻结；D2 不得把它描述为已冻结。
- D2：本节只完成设计草案；待审查通过后，才可提出只读 Bootstrap/Freshness 的独立实现范围。
- Validator / Fixture Runner：仍是单独交付提案；不能因 D2 定义了测试场景就提前实现或接入门禁。
- D3 之后：具体阶段编号与顺序须在 D2 设计审查后复核；不得默认把概念设计直接转成实现承诺。
- PR #10、main、项目版本和 tags 均不属于 D2 工作范围。



### 13.11 第二轮内部审查：状态轴与工作区边界

第二轮审查聚焦 D2 的可判定性，补充以下约束：

1. **无 Packet 不等于无协议恢复能力**：B0 仅在 Packet/协议元数据存在时检查其协议标识；没有 Packet 的旧项目仍从 AGENTS.md 与项目既有断点入口恢复，不因尚未采用 SCP 而失败。
2. **协议兼容性与 freshness 分轴**：Schema 不兼容属于 unsupported/incompatible，不是 freshness=unknown。客户端不得把未知核心字段“忽略后继续”，也不得把协议不兼容伪装成普通过期。
3. **HEAD 与工作区内容分开判定**：HEAD 中 tracked blob 未变，不代表工作区文件未变。相关 tracked path dirty 时必须标 stale；若 Packet 声称覆盖 dirty 内容，则必须有可核验的文件路径范围与内容摘要，否则只能确认 HEAD，不能确认工作区快照。
4. **Untracked 路径的证据边界**：路径存在不等于内容与 Packet 生成时一致；没有可核验内容摘要时，不得将其 freshness 判为 current。
5. **恢复兼容旧项目**：项目没有 SCP Packet、协议元数据或可选治理能力时，Bootstrap 继续沿用既有入口和能力开关，不创建替代记录，不把缺省误判为损坏。

当前仍保留为后续实现前置设计细节的项目：
- Packet 对 dirty/untracked 文件摘要的具体编码，必须与最终获批准的 D1 Schema 对齐；在 D1 未冻结前不新增字段或修改 0.1.0。
- 外部系统若无稳定 revision/etag，只能给出 unknown；不得用时间戳单独推导 current。
- 多 remote/fork 场景需以仓库平台的稳定 repository identity 或显式 upstream 映射区分 canonical repository 与工作 fork；仅凭 remote 名称不能认定项目身份。

**第二轮审查结论：** 上述修订后，D2 的状态轴、旧项目兼容性和工作区 freshness 边界更加明确；未发现需要改变 D0 语义或 D1 Schema 的问题。dirty/untracked 摘要编码与多 remote identity 保留为 D2 实施前需与客户端能力一起验证的边界，不在本轮擅自扩展机器契约。


### 13.12 D2 场景契约矩阵（跨客户端一致性基准）

本矩阵定义的是设计验收用例，不是已实现的 Fixture，也不授权在本 PR 中实现测试运行器。每个客户端对同一输入、同一权威来源快照和同一权限配置，应得到相同的规范化状态与允许/禁止行为。客户端可以使用不同 UI 文案，但不能改变下列语义。

#### 13.12.1 场景矩阵

| ID | 输入与现场观察 | 预期判定 | 允许的行为 | 禁止的行为 |
|---|---|---|---|---|
| S01 Packet 缺失 | 仓库身份可确认；无 SCP Packet；AGENTS.md 与 MEMORY §0 可读 | Packet=absent；不是错误；既有来源按需恢复 | 按项目规则入口进行只读 Bootstrap；报告没有 Packet | 因缺少 Packet 停止全部恢复；自动创建 Packet 或 MEMORY |
| S02 最小有效 Packet | Packet 可解析、Schema 受支持；引用的权威来源身份/revision 与现场一致；相关工作区 clean | 协议=compatible；相关来源=current | 使用已核验来源生成恢复摘要 | 将未检查的其他来源一并标 current；把 Bootstrap 当作写操作授权 |
| S03 权威记录更新 | Packet 引用 requirements/R-17 的旧 revision；当前权威记录已更新，且变更与当前任务相关 | 该引用=stale；当前需求状态以权威记录为准 | 重新读取当前需求并报告差异 | 沿用 Packet 中旧验收标准；静默修改 Packet 或需求记录 |
| S04 无关文件变化 | 仓库 commit 已变化，但本次恢复涉及的权威文件 blob、目标和证据范围均可证明未变化 | 仅被影响的 revision 声明 stale；未受影响声明可保持 current | 按声明依赖范围分别判定 | 仅因 HEAD SHA 变化就把所有来源无差别标 stale；未检查范围却声称全部 current |
| S05 远端 API 不可用 | 本地仓库和规则可读；PR/CI 服务不可访问 | 本地来源按证据判定；PR/CI=unknown | 在明确限制下继续不依赖远端状态的只读分析 | 声称 PR 仍 open、CI 通过或远端分支未变；因 API 失败改用旧快照冒充实时状态 |
| S06 tracked 文件 dirty | Packet 记录 HEAD=A；现场 HEAD=A，但被引用的 tracked 文件在工作区有未提交修改 | HEAD revision 可确认；工作区声明默认 stale；只有 Packet 对该路径/内容范围提供可核验摘要且现场摘要完全匹配时，才可判该范围 current | 报告 dirty path；只读检查差异和可验证摘要 | 仅凭 HEAD blob 相同就宣称工作区文件 current；覆盖或清理该修改 |
| S07 untracked 文件 | Packet 声称包含某 untracked 文件，但没有可核验的内容摘要/路径范围；现场存在同名路径 | 该文件内容 freshness=unknown；路径存在不能证明内容相同 | 报告路径存在与摘要缺失；继续不依赖该文件的只读分析 | 把文件名相同当作内容一致；将 Git tree SHA 作为完整 worktree 快照 |
| S08 dirty owner 不明 | 工作区有未提交路径，无法识别归属或是否属于其他 Agent | worktree=observed_dirty；owner=unknown；重叠写范围受阻 | 只读检查并列出路径；在不触及冲突路径时分析其他内容 | stash、reset、checkout、删除文件或在冲突路径写入 |
| S09 PR head 变化 | Packet 记录 PR #N head=A；现场 PR head=B | 旧 PR 快照=stale；当前 PR head=B | 重新读取 PR 目标分支、状态和必要 review 信息 | 将 A 上的 review/CI 结果移植到 B；按 PR 编号不变推断内容不变 |
| S10 CI queued | CI run 绑定当前 head，但状态为 queued 或 in_progress | verification=running/not_completed；不是 passed | 报告尚未完成；可等待用户要求或既定流程 | 将 queued/in_progress 解释为成功；生成 passed Evidence |
| S11 CI 成功但 SHA 不匹配 | CI run conclusion=success，但 run head=A；当前待验收 head=B | 对 B 的验证证据=stale/not_applicable；A 的历史证据仍保留 | 报告证据仅适用于 A；提出对 B 重新验证的建议 | 因 workflow 绿色或 PR 编号相同就判 B 通过 |
| S12 Evidence revision mismatch | Evidence ID 可解析，但 subject revision/scope 不覆盖当前需求或代码 revision | Evidence 对当前 subject=stale 或 not_applicable | 保留历史 Evidence 引用；明确不覆盖当前验收 | 删除旧证据；把历史 pass 复用为当前 pass |
| S13 未知 Schema 版本 | Packet 的 schema_version 不在客户端明确支持范围，或核心语义不兼容 | protocol=unsupported/incompatible；与 freshness 分轴 | 拒绝消费未知核心语义；从项目规则和权威来源走安全恢复路径 | 忽略未知核心字段后继续；把不兼容伪装成普通 unknown 或自动迁移 Packet |
| S14 权威来源冲突 | 两个适用的权威记录对同一需求状态给出互斥结果，且现有规则无法确定优先级 | 该声明=conflict | 暂停依赖该状态的高影响动作；列出双方来源并请求最小澄清 | 按更新时间、文件名或 Agent 偏好擅自选边；静默修复其中一份 |
| S15 可选能力关闭 | task_tracking/roadmap/adr 未启用；Packet 没有相关引用 | 对应能力=not_configured / not_applicable，不是缺失错误 | 忽略不适用域，按已启用来源恢复 | 创建替代 task/roadmap/ADR 目录；推造任务或里程碑状态 |
| S16 检查工具有副作用 | 某个测试/诊断命令会生成项目文件、项目目录内缓存/报告/锁文件、修改数据库或触发迁移 | 该命令不属于只读 Bootstrap；相关验证=not_run/unknown | 跳过该命令并说明限制；标准依赖缓存/系统临时数据仅在项目规则明确允许时例外 | 以“只是检查”为由运行会改变项目状态或用户环境的命令 |
| S17 历史意图与当前指令不同 | Packet/intent ledger 记录旧目标；当前用户明确提出不同目标，但是否长期替代尚未确认 | 当前指令是本轮最新输入；长期意图变更状态按现有 Intent Continuity 规则判 pending/needs confirmation | 先按当前指令做允许范围内的分析；说明是否需要持久化确认 | 把旧 Packet 当作否决当前指令；或擅自把一次性指令写成长期 accepted change |
| S18 只读权限不足 | 某个权威来源因权限不足无法读取，其他来源可读 | 受影响来源=unknown；整体恢复受限 | 在清晰标注限制后继续独立的低风险只读分析 | 绕过权限、切换未授权凭据，或把不可读解释为不存在/无变更 |

#### 13.12.2 规范化结果与客户端一致性

跨客户端比较时，至少比较以下规范化字段，而不是比较自然语言摘要：

- protocol_compatibility：compatible / unsupported / incompatible / unknown。
- source_freshness[]：每个 source reference 的 current / stale / conflict / unknown，并包含判定范围和理由；not_applicable / not_configured 属于能力适用性状态，应单独表达，不混入 freshness。
- applicability[]：task_tracking、roadmap、ADR 等可选能力及相关来源的 applicable / not_applicable / not_configured 状态。
- observed_state：可观察的 repository identity、HEAD、branch、worktree 状态；不可观察字段必须为 unknown。
- evidence_applicability[]：evidence 对 subject/revision/scope 的 applicable / stale / not_applicable / unknown 结论。
- recovery_mode：normal / restricted / blocked。
- permitted_actions[] 与 prohibited_actions[]：按本协议与项目权限规则归一化。
- user_decisions_needed[]：具体待确认事项及其来源，不合并为一个全局确认状态。

一致性判定规则：

1. 同一 fixture 输入、同一权威来源快照和同一权限配置，两个独立客户端必须给出相同的规范化状态；允许 UI/措辞不同。
2. 任一客户端不得把 unknown、stale、conflict、queued、in_progress 或 unsupported 提升为 current/passed/authorized。
3. 客户端可以给出更保守的限制，但不得扩大允许行为或放宽禁止行为。
4. 不能观察到的字段必须一致地保留 unknown；不得用客户端本地缓存或隐式记忆补成事实。
5. Fixture 契约测试只能证明规范化输入/输出一致；真实 CLI 对文件读取、权限和副作用的行为仍需单独 E2E 验证。

#### 13.12.3 恢复模式决策表

| 条件 | recovery_mode | 说明 |
|---|---|---|
| 项目身份可确认；所需规则/权威来源可读取；无影响当前工作的 stale/conflict/unknown | normal | 可形成完整的只读恢复摘要 |
| 存在 unknown/stale，但当前分析可明确隔离且不依赖这些声明 | restricted | 必须列出限制；仅允许不依赖受影响事实的低风险只读分析 |
| 项目身份无法确认/与 Packet 不匹配、协议不兼容导致 Packet 核心语义不可解释、关键权威来源冲突，或 dirty 写入范围无法安全隔离且下一步需要触及该范围 | blocked（限受影响范围） | 停止依赖该事实/范围的动作；请求最小澄清或授权；不妨碍不依赖该范围的安全只读恢复 |

补充约束：

- blocked 可以是局部范围阻断，不应无理由阻断整个仓库；不受影响的独立只读分析仍可继续。
- restricted 不是“默认允许写入”。任何写入/发布/合并/迁移/删除仍需重新核验对应来源并满足项目授权规则。
- normal 只表示恢复上下文达到本协议的可用条件，不代表测试通过、任务完成或获得额外权限。
- 多项来源状态并存时，按本次具体操作依赖的来源集合计算恢复模式；不得用一个全局状态掩盖局部冲突。

#### 13.12.4 D2 场景验收方式（仍属设计要求）

D2 设计评审通过后，后续独立实现提案应将上述场景转成机器可读 fixtures，并为每个 fixture 明确：
- 输入 Packet、权威来源快照、Git/PR/CI 观察结果和权限配置；
- 预期规范化状态与恢复模式；
- 必须允许和必须禁止的行为；
- 客户端无法观察到输入时的 unknown 预期；
- 场景所验证的协议规则与对应设计章节。

本轮不创建 fixture 文件、不实现 runner、不接入 CI。场景矩阵是下一阶段实现提案的验收依据，不是已经执行的测试结果。


### 13.13 Bootstrap 状态转移与判定顺序（规范化伪流程）

本节把 B0–B7 和 §13.12 的场景契约合并为可供实现提案引用的状态转移说明。它是设计级算法，不规定具体语言、CLI、数据结构或实现框架。

1. **Identify project**：读取当前仓库身份和根目录。若无法确认身份，标记 identity=unknown；若与 Packet 声明身份不匹配，不消费该 Packet。仍可按当前项目规则入口进行独立恢复。
2. **Load mandatory rules**：读取 AGENTS.md 和项目规定的最小恢复入口；按任务分级和能力开关决定是否继续读取 Constitution、intent、requirements、verification、tasks、roadmap、ADR。读取失败的来源单独标 unknown。
3. **Locate continuity hints**：读取可用的 MEMORY §0、handoff 和 Packet。Packet 缺失时继续；handoff/Packet 只用于定位权威来源和恢复 last-known 状态。
4. **Check protocol compatibility**：解析 Packet 格式与 schema_version。无法解析则拒绝消费其机器字段；未知/不兼容版本标 unsupported/incompatible。此状态不能通过忽略字段、自动迁移或猜测默认值来消除。
5. **Resolve authority**：对本次工作实际依赖的每个声明，读取其领域权威来源。先按领域规则确定权威来源，再比较内容；不得先按时间戳或文件新旧选边。
6. **Observe live state**：按只读能力读取 Git/worktree、必要的 PR/CI 和 Evidence 现场信息。远端不可用、权限不足或无法观察的字段保留 unknown；不以缓存替代实时事实。
7. **Evaluate each claim**：逐项比较来源身份、revision、范围和证据适用性，输出 current/stale/conflict/unknown/not_applicable。协议兼容性单独输出，不并入 freshness。
8. **Calculate recovery mode for requested scope**：以本次拟进行的具体分析/操作所依赖的来源集合为范围，计算 normal/restricted/blocked。未知或冲突只阻断依赖它的范围；不得把局部问题扩大成全仓库阻断。
9. **Apply permission gate**：恢复模式不等于操作授权。对任何后续写入或外部可见动作，仍须重新核验项目权限规则和当前用户授权；历史 Packet/决策摘要不能授予新权限。
10. **Present recovery result**：分别输出 verified facts、last-known facts、inferences、unknowns、conflicts、user decisions needed、next safe action 和 forbidden/unauthorized actions。默认只在当前会话中呈现，不自动持久化。

#### 状态判定顺序的约束

- **身份检查先于 Packet 消费**：项目身份不匹配时，不能先读取 Packet 中的 task/intent/evidence 引用再决定是否可信。
- **兼容性检查先于字段解释**：未知 Schema 核心语义不得进入普通字段 freshness 判定。
- **权威来源识别先于新旧比较**：同一事实的多个来源若有明确权威优先级，按该优先级；若没有，标 conflict。
- **范围匹配先于 revision 结论**：revision 一致但 evidence scope 不覆盖当前 subject，仍不能判 applicable/current。
- **现场观察先于动态状态结论**：PR、CI、branch、worktree 等可变状态必须现场查询；现场无法查询则 unknown。
- **授权检查独立于恢复状态**：即使所有来源 current 且 recovery_mode=normal，也不代表用户授权了写入、发布或不可逆动作。

#### 失败分支的终止条件

- Packet 不存在/损坏：停止消费 Packet；继续从项目权威入口恢复。
- Packet 不兼容：停止消费 Packet 的未知核心语义；允许独立读取当前项目规则和权威来源。
- 关键权威来源 conflict：停止依赖该声明的动作；保留冲突证据并请求澄清。
- 来源 unknown：只允许与该来源无依赖关系的低风险只读分析；不得推断“没有变化”。
- 只读检查本身需要副作用：停止该项检查并标记 not_run/unknown；不得为完成 Bootstrap 而绕过只读边界。
- 项目身份无法确认：不得消费 Packet 或执行依赖项目身份的操作；仅可报告无法确认及所需信息。


## 14. D3 Checkpoint 设计提案（概念阶段）

> 状态：D3 概念设计草案；依赖 D2 的恢复语义，但不代表 D2 已冻结。  
> 本节只定义 Checkpoint 的职责、生命周期、触发条件和安全边界；不修改 D1 Schema，不定义 Validator、Writer、CLI 或 CI Gate。

### 14.1 目标与非目标

D3 要回答：在什么时点、由谁、基于哪些已观察事实，生成一个足以恢复工作的断点；接收方如何判断该断点仍可用；多个断点如何并存、替代和追溯。

目标：
- 让中断后的接收方能定位工作主题、当前责任、代码锚点、未完成事项、验证状态和下一步。
- 断点内容可重建、可审计，并明确区分事实、last-known、推断和待确认事项。
- 避免把每轮对话变成记录维护工作；持久化只发生在 D0 已确认的重要节点。
- 断点写入失败、来源不可读或工作区状态不明时，不制造“已保存”的假象。

非目标：
- 不建立第二套任务、需求、意图、里程碑或验证账本。
- 不把 Checkpoint 当作完整聊天记录、代码备份、diff 存储或自动恢复快照。
- 不自动 commit、stash、reset、clean、merge、checkout，不替用户决定未决事项。
- 不承诺跨机器恢复编辑器缓冲区、进程内存、临时凭据或未持久化数据。
- 不在本阶段实现 Packet Writer、Checkpoint CLI、后台服务或自动 CI 门禁。

### 14.2 Checkpoint 的职责边界

Checkpoint 是某一时点的**恢复索引与断点声明**，不是状态的权威来源。

| 内容 | Checkpoint 应保存什么 | 权威事实仍由谁负责 |
|---|---|---|
| 工作目标 | 简短主题及 intent/requirement/task 引用 | intent、requirements、task 等既有来源 |
| 代码状态 | branch、HEAD、可观察 worktree 状态、必要的未提交路径摘要 | Git 与现场工作区 |
| 工作进度 | 已完成/进行中/阻塞的最小摘要 | 启用时的 task/roadmap；否则仅作本次断点描述 |
| 验证/审查 | Evidence 引用、绑定 revision、last-known 结果 | verification index、Evidence、CI/PR 原始记录 |
| 决策 | 待确认事项及权威决策引用 | 用户明确表达及项目决策记录 |
| 下一步 | 一个首选恢复动作和禁止事项 | 当前用户指令与项目权限规则 |

Checkpoint 不得复制领域记录正文来填充字段；引用目标缺失时应报告 unknown/stale，不得自动创建替代记录。

### 14.3 持久化触发条件

严格遵循 D0：仅在重要断点、跨会话暂停、责任交接或阶段收口时考虑持久化。建议按以下事件触发评估，而非按对话轮数或固定时间自动写入：

1. **跨会话暂停**：用户明确结束当前阶段、准备稍后继续，且存在非显然的恢复上下文。
2. **责任交接**：工作从一个 Agent/客户端/责任人转交给另一个执行者。
3. **阶段收口**：一个可识别阶段完成，需要记录结果、证据和下一阶段入口。
4. **高成本工作中断**：长时间分析/实现将被中断，且未提交状态、验证状态或待决策事项难以从权威来源直接恢复。
5. **重要阻塞**：出现需要用户裁定或外部条件解除的阻塞，保存最小断点可避免重复调查。

不触发：
- 普通问答、短小的一次性任务、没有跨会话价值的临时推理。
- 仅因代码有变更就自动写 Packet；Git 本身已记录提交历史。
- 仅因时间间隔达到阈值就周期性写入。
- 无新增恢复信息、无责任变化、无重要状态变化的重复快照。

若用户明确要求不持久化，或项目权限/能力配置不允许写入，则只在当前会话提供断点摘要，不写文件。

### 14.4 生成前置检查与写入安全

Checkpoint 生成不是“把当前上下文序列化”。生成者必须先完成适用范围内的只读核验：

1. 确认项目身份、当前分支和 HEAD；无法确认时不得伪造代码锚点。
2. 观察 worktree，包括 tracked dirty 与 untracked paths；不可观察部分明确 unknown。
3. 对本次工作依赖的 intent/requirement/task/evidence 引用进行最小核验；不要求全仓库扫描。
4. 区分已提交、未提交、已验证、未验证、已审查、待审查、已确认、待确认。
5. 检查是否已有更新的 Checkpoint，避免基于旧状态覆盖新断点。
6. 生成内容只包含恢复所需摘要、引用、revision、时间和明确的下一步。

写入边界：
- 写入目标必须由项目规则或用户明确指定；不得擅自创建新的状态目录或替换既有断点入口。
- 写入前检查目标文件当前版本；若自读取后发生变化，停止覆盖并重新读取/协调。
- 写入应采用可验证的完整文件替换或项目既定原子写入方式；不得留下半截 JSON 并声称成功。
- 写入成功以工具返回的持久化结果为准；失败时报告未保存，并保留可复制的会话内摘要。
- 不因生成 Packet 自动提交 Git；是否 commit 仍遵循项目规则和用户授权。
- 写入动作不得夹带清理、格式化、迁移或其他无关副作用。

### 14.5 生命周期与状态语义

反例审查后，不建议为 Checkpoint 引入独立的持久化生命周期枚举。created / superseded / invalid / archived 看似直观，但 D1 Schema 0.1.0 没有这些字段；若由不同客户端各自维护，又会形成第二套状态源。

采用更小的规则：

- **已持久化**：由文件/存储工具的成功结果证明，不写入 Packet 自证。
- **可解析/可消费**：由当前消费者按支持的 Schema 与项目身份检查得出；失败即停止消费机器字段。
- **当前恢复入口**：由项目既有规则入口或明确配置的 Packet 引用指定，不通过扫描文件后按时间戳猜测。
- **已被替代**：只有既有权威导航入口明确指向新的恢复入口，旧 Packet 才不再作为默认入口；旧文件仍可作为历史线索。
- **归档**：仅按项目既有归档规则或明确归档位置识别，不在 Packet 内增加状态字段。

无论是否仍是默认入口，Packet 中的生成时观察都只是 last-known；接收方仍须执行 D2 Bootstrap/Freshness。时间流逝本身不使 Packet 结构 invalid，来源是否过期由 freshness 单独判定。历史 Packet 的 Evidence 适用性仍按 subject/revision/scope 判断。

### 14.6 多 Checkpoint、重复写入与并发

- 同一工作流可以存在多个历史 Checkpoint；默认恢复入口必须来自项目既有规则入口、明确配置或被其引用的 handoff/Packet，不允许客户端扫描目录后按文件名、修改时间或生成时间自行挑选。
- 若项目没有配置 Packet 入口，则沿用 AGENTS.md、MEMORY §0 或 SESSION-HANDOFF.md 等既有恢复入口；不因 SCP 而新建索引文件。
- 同一断点重复生成时，应优先识别是否有实质状态变化；无变化则避免产生无意义的新记录。
- 两个 Agent 同时准备写同一断点时，遵循 D0 的 branch/worktree 隔离与 owner/write-scope 声明；无协调依据时不得互相覆盖。
- 基于旧 HEAD 或旧权威来源生成的 Checkpoint，在写入前发现基线变化，应重新 Bootstrap 并重建，不允许静默 rebase 断点内容。
- 历史 Checkpoint 不得被自动删除；清理策略属于独立的数据保留/治理决策。

### 14.7 接收方恢复与信任模型

接收方必须把 Checkpoint 当作不可信的 last-known 输入，并按 D2 顺序执行：
1. 先确认项目身份，再决定是否消费该 Packet。
2. 检查协议兼容性；不兼容时拒绝解释未知核心语义。
3. 按任务范围解析权威来源，不将 Checkpoint 摘要提升为事实。
4. 现场观察 Git/worktree/PR/CI 等动态状态。
5. 逐项计算 freshness 与 Evidence applicability。
6. 计算本次操作范围的 recovery_mode，并独立执行权限检查。

恢复时必须区分：
- Checkpoint 中记录的生成时观察；
- 本次重新核验的 verified facts；
- 尚未重新核验的 last-known facts；
- Agent inferences；
- unknown/conflict；
- 需要用户决定的事项。

Checkpoint 不授予写权限、不证明任务完成、不证明测试通过，也不构成用户对未来操作的持续授权。

### 14.8 失败与降级

| 失败情况 | 预期处理 |
|---|---|
| Checkpoint 写入失败 | 明确报告未持久化；可输出会话内摘要，不声称已保存 |
| 目标文件被并发修改 | 停止覆盖，重新读取并协调 owner/write-scope |
| 生成时 HEAD 不可观察 | code revision/worktree 保留 unknown；若 Schema 不允许该组合，不能绕过 Schema 约束伪造值 |
| dirty/untracked 内容无法可靠摘要 | 记录可观察路径和限制；相关工作区内容 freshness 不得判 current |
| 权威来源不可访问 | 对应声明标 unknown；不复制旧摘要冒充权威状态 |
| 没有持久化权限或用户拒绝 | 不写入；保留当前会话的恢复说明 |
| Packet 损坏或版本不兼容 | 停止消费其机器语义；从项目既有规则入口恢复 |
| 两个 Checkpoint 对同一断点互相冲突 | 回到权威来源与现场状态；无法消解则 conflict，不按时间戳选边 |

### 14.9 D3 概念验收标准

D3 设计进入冻结审查前，至少应满足：
1. 明确 Checkpoint 与任务/意图/需求/验证权威来源的边界。
2. 持久化触发条件与 D0 一致，不引入每轮写入或定时快照。
3. 生成前置核验、写入目标、并发冲突和失败反馈有明确规则。
4. 生命周期状态不会与 D2 freshness、D1 verification/work state 混为一谈。
5. 接收方恢复严格复用 D2 Bootstrap，不建立第二套恢复算法。
6. 覆盖写入失败、并发修改、dirty/untracked、权限不足、损坏/不兼容等负向场景。
7. 不需要新增 Schema 字段即可解释的内容，不应提前进入 D1 Schema。
8. 设计评审结论明确区分“语义审查通过”与“实现/互操作测试通过”。

### 14.10 与后续阶段的边界

- D3 当前仅为概念设计；D2 未获用户冻结前，不将其标为依赖已冻结协议的正式设计。
- D1 Schema 0.1.0 仍是独立待确认事项；本节不授权修改 Schema。
- Packet Writer、Validator、Fixture Runner、CLI/E2E、CI Gate 均不在本节范围。
- D3 后续若需要扩展 Schema，必须先给出字段必要性、兼容策略和迁移影响，再由用户审查；不得为实现方便先加字段。
- 本节不改变 PR #10、main、项目版本、tags 或 PR 合并状态。


### 14.11 D3 第一轮反例审查与收敛

对 §14.1–§14.10 做独立反例审查，重点检查是否引入 D1 Schema 之外的隐式状态源，以及多个 Packet 的选择是否可跨客户端一致判定。

发现并收敛两处风险：

1. **Checkpoint 生命周期枚举可能制造第二套状态源**：created / superseded / invalid / archived 若要求写入或由客户端各自维护，会与 D1 Schema、项目导航入口形成重复状态。现改为不持久化生命周期枚举；持久化成功由工具结果证明，可消费性由 Schema/身份检查判定，当前入口由项目既有规则入口或明确引用决定，归档沿用项目既有规则。
2. **多个 Packet 的“最新”选择不具备稳定语义**：文件时间戳、目录扫描顺序和客户端缓存都不能作为默认入口权威。现明确禁止客户端自行按时间/文件名挑选；优先沿用 AGENTS.md、MEMORY §0、SESSION-HANDOFF.md 或项目明确配置的入口。没有配置时不新建索引文件。

其余边界复核：
- 持久化触发条件未扩张为每轮/定时写入，与 D0 一致。
- Checkpoint 仍是恢复索引，不替代领域权威来源；接收方复用 D2 Bootstrap/Freshness。
- 写入失败、并发修改和权限不足均要求明确失败，不允许声称已保存。
- 不自动 commit/stash/reset/clean/merge，也不把 Packet 当作未来操作授权。
- 当前 D1 Schema 的 packet_kind、packet_id、checkpoint、provenance 等字段可承载现有概念；本轮没有发现必须通过新增 Schema 字段才能表达的阻断需求。dirty/untracked 内容摘要的编码和 repository identity 仍属于 D1/D2 的独立待解决边界，不能在 D3 中绕过。

**审查结论：** 收敛上述两处风险后，D3 概念设计在当前抽象层面未发现新的阻断问题；但尚未完成跨客户端 Fixture 或真实 Writer 行为验证。该结论不是 D3 冻结，也不代表 D1/D2 已冻结或实现。


### 14.12 D3 场景契约矩阵（Checkpoint 生成与消费）

本节把 §14.1–§14.11 转成可供后续跨客户端 Fixture 使用的行为契约。当前仍是设计文档中的场景定义，不是机器 Fixture、Writer 实现或测试执行结果。

#### 14.12.1 规范化判定结果

Checkpoint 操作的客户端结果至少应能归一化为以下独立维度；不得用一个笼统的 `success` 或 `status` 覆盖不同含义：

| 维度 | 建议值 | 含义 |
|---|---|---|
| `persistence_need` | `not_needed` / `needed` / `optional` | 本次断点是否具有跨会话恢复价值；不表示已获写入授权 |
| `write_authorization` | `permitted` / `not_permitted` / `unknown` / `not_required` | 当前项目规则、用户指令和能力配置是否允许写入 |
| `target_resolution` | `resolved` / `missing` / `ambiguous` / `not_configured` | 是否能从权威入口唯一确定写入目标 |
| `preflight_state` | `ready` / `stale` / `conflict` / `unknown` / `not_run` | 项目身份、基线、引用和工作区前置核验结果 |
| `write_result` | `written` / `not_written` / `failed` / `conflict` / `unknown` / `not_attempted` | 持久化动作的实际结果；`failed` 表示已确认未成功，`unknown` 表示无法确认是否已落盘，`conflict` 表示写入时检测到目标版本竞态 |
| `packet_usability` | `usable_as_last_known` / `unusable` / `unknown` | 结构和身份检查后是否可作为恢复线索；不代表 freshness current |
| `recovery_freshness` | 复用 D2 的逐来源 `current/stale/conflict/unknown` | 接收方现场核验后的来源状态，不由写入者自我声明 |

这些是客户端对操作结果的规范化表达，不是新增 Packet 字段或第二套持久化状态账本。客户端可以提供更详细的诊断，但不得把 `persistence_need=needed` 说成已获授权、把 `write_authorization=permitted` 说成已写入、把 `written` 说成 `current`，或把 `usable_as_last_known` 说成已恢复完成。

#### 14.12.2 场景矩阵

| ID | 输入/前置条件 | 规范化预期 | 允许行为 | 禁止行为 |
|---|---|---|---|---|
| C01 | 普通问答或短任务，无跨会话恢复价值 | `not_needed`；`not_attempted` | 直接结束当前任务 | 为满足流程而创建 Packet |
| C02 | 重要阶段收口，目标入口唯一，权限允许，基线可核验 | need `needed`；authorization `permitted`；preflight `ready`；写入后才可为 `written` | 生成最小 Packet 并验证完整持久化 | 在写入前宣称已保存 |
| C03 | 用户明确拒绝持久化 | need 可为 `needed`；authorization `not_permitted`；write `not_attempted` | 提供会话内可复制摘要 | 以“系统默认”或自动化为由写入 |
| C04 | 项目未配置 Packet 入口，但存在既有 handoff/AGENTS/MEMORY 入口 | Packet 目标为 `not_configured`；不执行 Packet 写入 | 沿用既有恢复入口；仅当项目明确规定 Markdown 是由工具从 Packet 生成的派生视图时，才更新该视图，否则仅输出会话内摘要 | 把 Markdown 手工维护成第二机器契约，或擅自创建新目录/索引文件 |
| C05 | 多个候选目标，项目规则未指定唯一目标 | target `ambiguous`；不写入 | 请求用户/项目规则明确目标，或仅输出摘要 | 按文件名、时间戳、目录顺序选一个 |
| C06 | 项目身份与当前仓库不匹配 | preflight `conflict`；write `not_attempted` | 停止 Packet 写入，从当前项目规则重新识别 | 将旧项目 Packet 改写为当前项目断点 |
| C07 | Packet 生成后、写入前 HEAD 或相关权威来源发生变化 | preflight `stale`；重新 Bootstrap | 重建断点，再执行新一轮前置检查 | 静默沿用旧基线或自动 rebase 内容 |
| C08 | 目标文件在读取后被其他 Agent 修改 | write `conflict`；不得覆盖 | 停止写入，重新读取并协调 owner/write-scope | last-write-wins 或强制覆盖 |
| C09 | 两个 Agent 在隔离 worktree 中写入不同目标 | 各自按 owner/write-scope 独立核验 | 在明确隔离且目标唯一时分别写入 | 将一个 Agent 的状态覆盖到另一个 Agent 的工作区 |
| C10 | 两个 Agent 声明共享目标，但无协调/owner 依据 | preflight `conflict` 或 `unknown`；不写入 | 停止共享目标写入并请求协调 | 假定先到先得或隐式租约 |
| C11 | tracked 文件 dirty，内容摘要不可验证 | 记录观察到的 dirty 路径与限制；相关 freshness 不得判 current | 仅保存 Schema 可表达且准确的 last-known 信息 | 用 HEAD blob 或 Git tree SHA 代表工作区内容 |
| C12 | 存在 untracked 文件，路径/内容摘要不可可靠确认 | 相关工作区声明为 `unknown` 或 `stale` | 明确指出未纳入可核验断点范围 | 宣称工作区 clean 或可完整恢复 |
| C13 | HEAD 或必要权威来源不可读取 | preflight `unknown`；依赖该来源的写入不执行，或严格按 Schema 可表达范围降级 | 保留 unknown 并输出限制 | 编造 revision、时间或权威状态 |
| C14 | Packet 写入工具报错或无法确认完整落盘 | write `failed` 或 `unknown`，不得是 `written` | 报告未确认持久化，提供会话内摘要 | 根据“请求已发送”推断写入成功 |
| C15 | 写入过程中发生中断，文件可能部分写入 | write `failed/unknown`；接收方将文件视为不可用，除非完整解析与校验成功 | 重新读取、完整性检查；必要时由授权方重试 | 把截断 JSON 当作有效 Packet，或自动删除/覆盖未知文件 |
| C16 | 已存在内容完全相同且基线未变化的 Packet | `not_needed` 或 no-op；不得产生无意义版本 | 报告已有断点仍可作为 last-known 线索 | 为制造新时间戳而重复写入 |
| C17 | Packet 可解析，但其中 revision/evidence 已过期 | `usable_as_last_known`；D2 freshness/evidence applicability 为 stale | 用作导航线索并现场刷新来源 | 将结构有效等同于当前事实有效 |
| C18 | Packet Schema 未知/不兼容，或项目身份无法建立 | `unusable`；从既有入口恢复 | 停止解释未知机器字段 | 忽略未知核心字段后继续自动写入/执行 |
| C19 | 项目规则要求特定原子写入能力，但当前工具不支持 | write `not_attempted` 或 `failed` | 报告能力缺失，提供会话内摘要 | 降级为可能留下半文件的非原子写入并宣称成功 |
| C20 | 写入成功后，接收方在另一个会话/客户端消费 Packet | packet `usable_as_last_known`；必须重新 Bootstrap | 核验身份、兼容性、权威来源、现场状态与权限 | 继承生成者的权限、freshness 或“已完成”判断 |
| C21 | 写入请求超时/连接中断，调用方未收到确认，但目标可能已完整落盘 | write `unknown`；不得直接重试或宣称失败/成功 | 先按原目标和预期内容回读并校验；确认完整匹配后才报告 written，确认不存在/不完整后再按授权重试 | 将无确认等同失败并盲目重试，造成重复/覆盖；或将请求已发送等同 written |

#### 14.12.3 跨客户端一致性要求

对于相同的输入 Packet、项目权威入口快照、Git/worktree 观察结果、权限配置和目标文件版本，两个独立客户端应对上述场景产生相同的规范化结果。

- 两个客户端必须一致识别是否需要持久化、目标是否唯一、是否允许尝试写入，以及写入是否得到可验证的成功结果。
- 对于无法观察的工具能力或状态，双方都必须保留 `unknown/not_run`；不得由一方通过猜测提升为 ready/written/current。
- 对于目标文件版本变化、共享写入范围冲突等并发情形，双方都不得静默覆盖；客户端可以更保守，但不能扩大写入权限。
- 不同存储后端可以采用不同的原子写入机制，但必须满足相同的可观察契约：完整内容可读取、结构可解析、写入结果可确认；无法满足时必须明确失败。
- Fixture 应分别验证“生成决策”“写入结果”和“接收方恢复”，不能把三个阶段合并成一个端到端 success 标志。

#### 14.12.4 场景契约的证明边界

- 该矩阵定义预期行为，不证明任一现有客户端已经遵守。
- 后续 Fixture Contract Test 只能证明给定输入/输出契约的一致性；不能证明真实文件系统、Git worktree、远端 PR/CI 或权限系统的全部行为。
- 真实 Writer E2E 需在两个独立客户端分别验证目标解析、并发修改检测、失败/中断后的文件完整性、成功回读和接收端重新 Bootstrap。
- 不得因 Fixture 通过而跳过真实 E2E，也不得把单一客户端测试结果称为跨客户端互操作通过。
- 本节不授权实现 Writer、Validator、Fixture Runner、CLI、后台服务或 CI Gate；这些属于后续独立决策。


### 14.13 D3 第二轮一致性审查与语义修订

对 §14.1–§14.12 做第二轮审查，检查规范化状态是否存在语义重叠、Markdown/JSON 契约边界是否一致，以及场景是否隐式要求修改 D1 Schema。

发现并修订两处问题：

1. **持久化必要性与写入授权原先被合并**：原 `persistence_decision` 同时表达“值得保存”和“是否允许写入”。用户拒绝时，断点可能确有恢复价值，但仍不得写入。现拆分为 `persistence_need` 与 `write_authorization` 两个独立维度；写入结果只表达实际持久化结果。
2. **未配置 Packet 入口时的 Markdown 处理可能越过 D0 格式约束**：现明确不因存在 SESSION-HANDOFF/AGENTS/MEMORY 就把它们自动当成 Packet 写入目标。JSON Schema 仍是唯一机器契约；Markdown 只能在项目明确规定为工具生成的派生视图时更新，否则沿用既有入口或只输出会话内摘要。

其他一致性结论：
- `target_resolution` 表达目标能否唯一定位；`preflight_state` 表达项目身份/基线/来源/工作区核验；二者不是同一状态轴。
- `write_result=conflict` 专指写入竞态/目标版本变化；写入前发现基线过期应表达为 preflight stale 并重新 Bootstrap。
- `packet_usability` 只回答结构/身份是否可消费；`recovery_freshness` 复用 D2 逐来源判定，不能由前者推导。
- C01–C20 覆盖了 D3 当前定义的主要生成、写入、失败和消费路径；未发现必须增加 D1 Schema 字段才能表达的场景。
- 仍有两项既有边界未解决：dirty/untracked 内容摘要的稳定编码，以及多 remote/fork 的 repository identity/upstream 映射。它们是 D1/D2 的独立设计问题，不在 D3 中擅自补字段。

**审查结论：** 修订后，D3 的规范化结果轴与场景契约在当前设计抽象层面保持可区分；没有发现需要修改 D0 或 D1 Schema 的新阻断项。该结论仍属于文档审查，不是机器 Fixture、Writer E2E 或跨客户端互操作测试结果。D3 尚未冻结。

### 14.14 D3 第三轮故障语义审查

对 §14.12 的规范化结果和 C01–C21 做故障语义复核，重点检查写入调用的失败确认与结果不确定是否被混淆。

发现并修订一处契约缺口：

- 原 `write_result` 枚举没有 `unknown`，但 C14/C15 已要求在工具报错、连接中断或可能部分落盘且无法确认结果时表达 `unknown`。这会使场景预期无法由规范化结果直接表示。现将 `unknown` 纳入 `write_result`，并区分：`failed` 是已确认未成功；`unknown` 是无法确认是否已持久化；`not_attempted` 是没有执行写入。
- 新增 C21：写入请求超时或确认丢失时，必须先回读原目标并核验预期内容，不能把无确认等同失败后盲目重试，也不能把请求已发送等同写入成功。
- C14/C15 的 `failed/unknown` 现在均可由规范化枚举表达；接收方仍须按 D2 Bootstrap 检查结构、身份和 freshness。

其余复核：
- `persistence_need`、`write_authorization`、`target_resolution`、`preflight_state`、`write_result`、`packet_usability`、`recovery_freshness` 仍是不同阶段/状态轴，不应合并。
- 写入结果不确定时，不能通过生成新时间戳或更换 Packet ID 绕过回读核验；也不能自动删除、覆盖或清理目标。
- 本轮仍未发现必须修改 D1 Schema 的新需求；新增的是客户端操作结果语义和场景，不是 Packet 持久化字段。
- 本轮属于文档一致性审查，不是 Writer 实现、故障注入、机器 Fixture 或跨客户端 E2E。

**审查结论：** 修订后，写入已确认失败与写入结果未知可以被独立表达；C01–C21 覆盖当前设计定义的主要生成、竞态、异常和消费路径。D3 仍未冻结。

## 15. D1–D3 冻结依赖矩阵与跨阶段契约审查

本节用于判断各阶段能否独立冻结，以及哪些语义必须先形成共同契约。它不自动冻结任何阶段，也不授权修改已冻结的 D0 决策。

### 15.1 阶段依赖矩阵

| 上游/下游 | D1 Schema 0.1.0 | D2 Bootstrap / Freshness | D3 Checkpoint |
|---|---|---|---|
| 项目身份 | 当前仅有 `project.repository`（必填字符串）、`project.project_id`（可选）；未定义 canonical/upstream/fork 语义 | B0 要求区分仓库身份、工作目录及 upstream；多 remote/fork 仍未解决 | 写入前必须确认 Packet 属于当前项目，不能仅凭 remote 名称 |
| Git 基线 | `code.head_sha`、`branch` 可表达 HEAD 和分支；没有 upstream/ref identity | 必须区分 HEAD、tracked worktree 与 untracked 内容 | preflight 必须核验写入基线，不能把 HEAD 等同完整工作区快照 |
| Dirty / untracked 内容 | `worktree_state` 与 `uncommitted_paths` 只表达状态和路径，不表达内容摘要或摘要覆盖范围 | S06/S07 要求只有路径身份和内容摘要可验证时，相关范围才可能判 current | C11/C12 要求不得把未覆盖内容声称为可恢复快照 |
| Freshness | `provenance.source_revisions[]` 能记录来源 revision、freshness、观察时间 | 定义逐来源 freshness、范围依赖和现场重新核验 | packet usability 与 recovery freshness 分离，接收方重新 Bootstrap |
| 写入/并发 | coordination 可表达 owner、write_scope、isolation；不提供锁或原子写入保证 | 只读 Bootstrap 不授予写权限 | D3 规范化写入结果属于客户端操作结果，不是 Packet 字段 |
| Evidence | 只有引用数组；解析和 revision/scope/actor/result 核验留给 semantic validator | 消费时重新核验 evidence applicability | 写入者不得把旧 evidence 或旧验证状态升级为当前通过 |

### 15.2 当前可表达与不可表达的边界

**现有 Schema 已足够表达（在语义验证配合下）：**

- Packet 类型、版本、生成者、项目基本标识、会话和工作主题。
- HEAD SHA、分支、观察到的 clean/dirty/unknown，以及未提交路径列表。
- 工作进度、验证/审查状态、待决策项、阻塞原因和下一步。
- owner、write_scope、隔离模式，以及权威来源 revision/freshness 的最小引用。
- handoff 的完成项、进行中、阻塞项、下一步和禁止动作。

**现有 Schema 尚不足以完整表达：**

1. **Dirty/untracked 内容的可验证摘要。** 当前只有路径列表，没有摘要算法、摘要值、条目类型/模式、覆盖范围或摘要观察时间。D2 不能仅凭路径存在将内容判为 current；D3 也不能把这种 Packet 描述为包含完整可恢复工作区。
2. **稳定 repository identity 与 upstream 映射。** 当前 `project.repository` 是自由字符串，`project.project_id` 没有定义稳定身份的命名空间/来源；没有字段或明确编码约定区分当前 fork、canonical repository 和多个 remote。remote 名称本身不是稳定身份。
3. **部分可观察状态。** 当前 `code.worktree_state` 是整个工作区的单一状态，不能表达“HEAD 可确认，但某些 tracked/untracked 路径内容未纳入摘要”的细粒度覆盖。D2 可保守降级为 stale/unknown，但不能凭该字段证明局部快照完整。

### 15.3 D1 冻结前必须裁定的两个契约

#### A. Worktree content fingerprint

建议先定义最小、可扩展的可验证条目模型，再决定是否纳入 0.1.0：

- 摘要作用域必须明确到相对项目根目录的路径；不能只提供一个未说明覆盖范围的总 hash。
- 每个条目至少区分 tracked/untracked、文件类型（普通文件/符号链接；其他类型明确拒绝或标 unknown）、内容摘要算法和摘要值。
- 普通文件摘要基于原始字节；符号链接摘要基于链接目标的原始表示。若可执行位/文件模式影响项目语义，应纳入条目元数据，不能默默忽略。
- 路径必须采用跨平台稳定表示：相对项目根目录、统一分隔符、拒绝绝对路径和 `..` 越界；路径编码及大小写冲突策略必须明确。
- 摘要应使用明确命名的算法标识（例如 SHA-256），不能依赖客户端默认算法。
- 摘要清单必须声明覆盖范围和观察时间；未列入清单的 dirty/untracked 路径仍是未覆盖，不得推断为 clean。
- 多文件逐项读取不是原子文件系统快照。若读取期间文件可能变化，客户端必须复核前后元数据/摘要；无法证明观察一致性时标 unknown，而不是声称获得原子快照。

**待裁定的范围选择：**

- 最小方案：只允许逐路径摘要；不定义全工作区树摘要。
- 扩展方案：在逐路径摘要之上定义确定性 manifest digest，作为清单完整性校验；它仍不能证明读取期间存在原子快照。

本提案倾向先定义逐路径摘要，并把 manifest digest 作为可选校验，不把“完整 worktree snapshot”作为首版承诺。

#### B. Repository identity 与 upstream mapping

建议区分三个概念，禁止用一个 remote URL 混为一谈：

- **repository identity**：远端托管平台提供的稳定仓库身份；若平台没有稳定 ID，则使用项目显式配置的 canonical identity。
- **checkout identity**：当前本地 checkout/worktree 所属仓库及其路径。路径只用于定位，不是跨机器稳定身份。
- **upstream mapping**：当前 checkout 的一个或多个 remote/ref 与 canonical repository identity 的显式映射；fork 与 upstream 必须分别标识。

判定规则：

- remote 名称（origin/upstream）是本地可变别名，不是身份。
- URL 规范化只能作为辅助标识；URL 变更、迁移、镜像或多个协议 URL 可能指向同一仓库，也可能产生歧义。
- 平台稳定 ID 必须同时带平台/host 命名空间，不能裸用数字 ID。
- 多 remote 指向不同仓库时，不得自动选 origin；需要显式 canonical/upstream 映射，否则 identity resolution 为 ambiguous/unknown。
- 离线或自托管环境无法读取平台 ID 时，使用项目明确配置的稳定 identity；不能由 Agent 根据目录名或 remote 顺序猜测。

本提案倾向在 Schema 中为稳定身份与 upstream 映射提供明确结构，而不是把 JSON 对象塞进现有自由字符串字段或依赖私有 extension。

### 15.4 D1/D2/D3 冻结顺序建议

| 阶段 | 冻结前置条件 | 当前判断 |
|---|---|---|
| D1 Schema 0.1.0 | 裁定 worktree fingerprint 表示；裁定 repository identity/upstream 表示；完成 Schema/示例/兼容性和语义边界一致性复核 | **暂不具备冻结条件**：两项机器契约仍缺失 |
| D2 | D1 字段映射明确；B0 identity resolution 和 B4 worktree observation 有可执行且保守的判定规则；18 个场景不依赖 Schema 无法表达的事实 | 设计主体已完成；需解决上述依赖后再作冻结候选复核 |
| D3 | D2 Bootstrap/Freshness 契约稳定；C01–C21 与最终 Schema 字段边界一致；写入结果不确定、并发冲突和失败回读边界明确 | 概念与场景审查已完成；依赖 D1/D2 的两项身份/摘要问题仍阻止整体冻结 |

依赖关系是有向的：D3 消费 D2 的恢复与 freshness 判定；D2 消费 D1 的 Packet 结构；D1 不应反向依赖 D2/D3 的实现细节。D3 的 `write_result` 是操作执行结果，不应为了复用它而写进 Packet Schema。

### 15.5 冻结前禁止的错误推论

- Schema 校验通过，不等于 repository identity 正确、worktree 内容完整或 freshness current。
- HEAD SHA 可确认，不等于 tracked working copy 或 untracked files 已被指纹覆盖。
- Packet 中存在 `uncommitted_paths`，不等于这些路径内容可恢复。
- `project.repository` 字符串相同，不足以证明 fork、镜像和 canonical repository 是同一身份。
- D3 文档审查通过，不等于 Writer 能原子写入或两个客户端已实现一致行为。
- Fixture 契约测试通过，不替代真实文件系统故障注入和两个独立客户端的 Writer E2E。

**本节结论：** D1 0.1.0 当前不能宣称完整支撑 D2/D3 对 dirty/untracked 内容和多 remote/fork 身份的严格判定。先完成两个机器契约的语义裁定，再决定是否调整尚未冻结的 Schema 0.1.0；在此之前 D1、D2、D3 均不冻结。本节是依赖审查与设计建议，不是用户对字段方案的批准。

### 15.6 Worktree Fingerprint 的目标与非目标

本设计只解决“Packet 声称观察到的未提交路径内容，接收方能否逐项核验”的问题，不把 Checkpoint 扩张为代码备份或可重建文件系统镜像。

目标：
- 对 Git 可观察到的未提交路径，保存可跨客户端复算的内容摘要。
- 明确区分 HEAD、Git index（staging area）和工作区文件系统三个状态层。
- 在 tracked 文件 staged + unstaged、删除、未跟踪文件、符号链接等常见状态下，能够准确比较。
- 未覆盖、不可读取、文件变化中、平台无法解释的条目必须明确降级，不得提升为 current。
- 不保存文件正文，不自动修改 index/worktree，不触发 stash/commit/clean。

非目标：
- 不提供文件恢复、diff 备份、Git index 恢复或进程/编辑器缓冲区恢复。
- 不声称多文件读取是原子快照。
- 首版不递归指纹化 submodule 内部工作树，不跟随符号链接读取目标，不摘要 ignored 文件。
- 不为“看起来完整”而读取或摘要项目规则标记为敏感的凭据/密钥文件。

### 15.7 建议的数据模型（候选，不是 Schema）

建议在 Packet 的 code 下增加一个可选的 worktree_fingerprint 对象。以下仅展示语义，不作为 0.1.0 字段契约：

~~~json
{
  "worktree_fingerprint": {
    "format": "scp-worktree-fingerprint/1",
    "scope": "git-status-paths",
    "digest_algorithm": "sha-256",
    "path_encoding": "utf-8",
    "started_at": "2026-11-12T00:00:00Z",
    "completed_at": "2026-11-12T00:00:01Z",
    "coverage": "complete",
    "observation": "per_path_stable",
    "entries": [
      {
        "path": "src/module/file.ts",
        "index_entries": [
          {
            "stage": 0,
            "mode": "100644",
            "digest": "sha-256:<64-lowercase-hex>"
          }
        ],
        "worktree": {
          "state": "present",
          "kind": "regular_file",
          "mode": "100644",
          "digest": "sha-256:<64-lowercase-hex>"
        }
      }
    ]
  }
}
~~~

字段语义：
- format：指纹条目编码/语义版本；它与顶层 schema_version 分开。任何会改变路径解释、摘要字节输入或条目状态语义的变化都必须升级 fingerprint format。
- scope：首版固定为 Git status 可见的 staged、unstaged、deleted、untracked（non-ignored）路径；不是整个工作区文件清单。
- digest_algorithm：首版固定 SHA-256，使用小写十六进制并带算法前缀；禁止依赖 Git 仓库自身的 SHA-1/SHA-256 object format 或客户端默认算法。
- path_encoding：首版固定 UTF-8；不能无损表示的路径必须作为 unsupported/unknown 处理，不能替换字符后参与比较。
- started_at/completed_at：描述整个扫描观察窗口，不暗示所有文件在同一瞬间读取。
- coverage：complete 表示扫描范围内每个目标路径都已表达且可摘要；partial 表示存在被排除/不支持/不可读取条目；unknown 表示无法可靠枚举或识别范围。
- observation：per_path_stable / changed_during_capture / unknown。它只描述逐条目采集是否通过一致性检查，不表示全工作区原子快照。
- entries：按规范化路径的 UTF-8 字节序排序；每个路径只出现一次。重命名不作为单一特殊条目，按源路径删除和目标路径新增分别表达。

每个 entry 把 index 与 worktree 分开：
- index_entries 表示 Git index 中该路径的条目。普通条目通常只有 stage 0；冲突条目可能有 stage 1/2/3。每一 stage 的摘要按其 blob 原始内容计算，不直接复用 Git object ID。
- worktree.state 为 present、absent 或 unreadable。删除路径应为 absent，不伪造空文件摘要。
- worktree.kind 为 regular_file、symlink、gitlink 或 unsupported。
- mode 使用 Git tree/index mode 语义（例如 regular 100644/100755、symlink 120000、gitlink 160000），不记录 owner/group、mtime 等不属于 Git 内容身份的元数据。
- regular file 的摘要输入为文件原始字节；不做文本解码、换行转换、BOM 去除或 JSON/XML 规范化。
- symlink 的摘要输入为链接目标原始字节；不跟随链接，不摘要目标文件。无法无损取得链接目标字节时标 unknown。
- gitlink 不对 submodule 内部工作树递归；如果 submodule 本身 dirty，当前 fingerprint coverage 不能标 complete，相关范围 freshness 为 unknown/stale。

不建议首版加入全局 manifest_digest。逐条目摘要足以对具体路径进行比较；manifest digest 只有在定义严格的规范序列化、排序和升级策略后才有意义，而且不能证明文件读取是原子的，也不能提供签名或来源真实性。若未来需要清单完整性校验，应另行定义确定性编码，不使用普通 JSON.stringify 结果。

### 15.8 路径与文件系统规范

路径规范必须优先保证“不把不同路径误认成同一路径”，而不是尽可能兼容所有特殊路径：

1. 路径相对于当前 Packet 的项目根目录，使用 / 分隔符；不写绝对路径、盘符、UNC 前缀或 URL 编码路径。
2. 拒绝 NUL、空路径、空组件、. 和 .. 组件；任何路径不得逃出 project root。
3. JSON 字符串按 UTF-8 编码；保留原始 Unicode 码点序列，不执行 NFC/NFD 归一化、不大小写折叠、不 percent-decode。跨平台消费者必须按精确路径匹配。
4. POSIX 文件名含反斜杠、非法 UTF-8 字节或目标平台无法无歧义映射的路径，标记 unsupported；不将反斜杠悄悄改成斜杠。
5. 若目标平台文件系统大小写不敏感或存在 Unicode 归一化别名，消费者必须检测路径碰撞；发生碰撞时相关条目 unknown/conflict，不允许任选一个。
6. 不因目录存在就生成目录摘要；Git status 的每个文件条目分别表示。目录重命名由其包含的路径集合变化体现。
7. Git ignored 文件不属于首版固定 scope。若项目显式要求对某 ignored 文件进行连续性核验，应通过明确路径声明的后续扩展处理，不能暗中扩大默认扫描范围。

**敏感数据保护：** 哈希不是脱敏保证。低熵密钥、token、证书内容可能通过猜测验证摘要。项目规则标记为 secret/private 的文件不得自动计算或写入内容摘要；若其属于本次工作所需路径，则 coverage 必须为 partial，该路径相关 freshness 为 unknown，直到有安全的专门机制。不得把文件内容、密钥值或可恢复的编码写入 Packet。

### 15.9 摘要计算与采集算法

对每个支持的普通文件：
- 打开文件时避免跟随符号链接（平台支持时使用 no-follow）；读取文件原始字节并流式计算 SHA-256，不要求将整个文件载入内存。
- 同时记录文件类型、Git 语义 mode、文件对象身份及必要元数据。
- 读取完成后对同一文件句柄执行 fstat，并重新 lstat 路径，确认文件对象未被替换、类型/大小未发生变化；平台或工具无法可靠验证时该 entry 为 unknown。
- mode 只纳入 Git 可表达的文件类型及 executable bit；不把 mtime、owner、group、ACL 或普通读写权限位当作跨平台内容身份。若可执行位无法可靠观察，mode=unknown，不能将涉及可执行语义的条目判为完整 current。
- symlink 使用 lstat/readlink，不跟随目标；链接类型与目标字节分别表达。
- index 中的 stage blob 通过 Git index/object 读取后，对 blob 原始内容重新计算 SHA-256；Git 自身 object ID 只用于定位，不进入跨仓库摘要值。
- stage 1/2/3 冲突条目必须分别列出；若客户端无法读取所有 stage，则 entry unknown，不能将冲突压平为单个 stage 0。

建议的只读采集顺序：
1. 识别 project root、Git worktree root 和 HEAD；确认路径范围在 project root 内。
2. 读取 HEAD SHA、Git index 状态与 git status --porcelain=v2 -z --untracked-files=all 等价的机器接口；以 NUL 分隔解析路径，不解析面向人类显示的 quoting 输出。
3. 构建 staged/unstaged/deleted/untracked 路径集合；rename 以 source/destination 两条路径纳入。
4. 读取对应 index stage entries 和工作区对象，按路径生成摘要条目；ignored、secret-policy-excluded、特殊文件和 submodule 内部状态按前述规则处理。
5. 再次读取 HEAD、index 与 Git status；如果扫描期间任一发生变化，整个 fingerprint 的 observation 不得是 per_path_stable，必须重试一次或降级 unknown/partial。
6. 成功后按规范路径顺序输出 entries，并核对其路径集合与 code.uncommitted_paths 一致；不一致说明采集范围不完整，不能声明 coverage=complete。

此算法不保证多路径的全局原子性：A 文件可能先于 B 文件读取，读取 A 后它也可能在读取 B 之前再次变化。即使前后 Git status 相同，也不能证明所有文件在同一时刻处于该组合状态。因此协议只能承诺“逐路径观察到的字节摘要 + 扫描窗口 + 变化检测”，不能称作 atomic worktree snapshot。消费者只对具体条目重新摘要并比较；需要全局一致快照的操作必须另用文件系统快照/隔离 worktree 等独立能力，不能由本 Packet 推导。

### 15.10 Freshness 判定与权限边界

- coverage=complete 且 observation=per_path_stable 是声明完整 dirty-path fingerprint 的最低条件；它仍不是原子快照证明。
- coverage=partial 或 unknown 时，只能对可独立定位且摘要有效的条目做局部比较；整体 dirty worktree 不得判 current。
- 对单个 entry，必须比较路径、HEAD 基线、index stage/mode/digest、worktree state/kind/mode/digest。只比较 worktree 文件内容而忽略 index stage，会漏掉 staged/unstaged 边界变化。
- 当前路径已消失、变成不同 kind、mode 不同、摘要不匹配或出现冲突 stage，均标 stale/conflict；无法读取或路径映射有歧义为 unknown。
- 未出现在 fingerprint 的 dirty/untracked 路径不得推断 current。即使现存 entry 全匹配，只要扫描 coverage 不完整，本次工作区范围也只能判 partial。
- fingerprint 只证明被观察路径的内容/索引摘要匹配，不证明未列出的 ignored 文件、编辑器缓冲区、运行进程、外部依赖、数据库或环境变量相同。
- Packet 中的 fingerprint 不能授予写权限，不能作为自动 restore/stash/checkout 的输入命令；它仅用于恢复判断和差异提示。

### 15.11 Worktree Fingerprint 场景契约

| ID | 场景 | 规范化预期 | 禁止推论/行为 |
|---|---|---|---|
| WF01 | tracked 文件仅有 unstaged 修改 | index digest 与 HEAD 对应内容相同；worktree digest 记录修改后字节 | 将 index digest 当成当前文件内容 |
| WF02 | tracked 文件已 staged，worktree 与 index 一致 | index/worktree 两层均记录；二者摘要一致 | 只记录 HEAD，漏掉 staged 内容 |
| WF03 | 文件 staged 后再次编辑 | index digest 与 worktree digest 可不同 | 把两者压成一个“文件摘要” |
| WF04 | staged delete 或 unstaged delete | index/worktree 的 present/absent 状态分别表达 | 用空文件摘要表示删除 |
| WF05 | untracked 普通文件 | 无 index entry；worktree present + raw-byte digest | 因 HEAD 无该路径而忽略 untracked 内容 |
| WF06 | rename | source 与 destination 分别作为路径条目；状态可从 HEAD/index/worktree 对照 | 依赖 Git 对 rename 的启发式检测结果作为身份 |
| WF07 | symlink | 摘要原始链接目标，不跟随链接 | 摘要链接指向的文件内容 |
| WF08 | 文件在扫描期间被替换/修改 | 对应 entry unknown；扫描窗口不声明稳定，按规则重试或降级 | 将读取前后不一致的内容判 current |
| WF09 | 读取期间 HEAD/index/status 改变 | fingerprint 不得标 per_path_stable/complete | 把不同基线下的路径集合拼成一个完整快照 |
| WF10 | secret-policy-excluded 文件出现在 dirty paths | coverage partial；不存该文件摘要，受影响声明 unknown | 以哈希形式保存低熵秘密并称为已脱敏 |
| WF11 | submodule 内部 dirty 或特殊文件无法表示 | coverage partial/unknown；保留路径和原因范围，不递归执行修改 | 把 gitlink commit 当成 submodule 完整工作树摘要 |
| WF12 | 文件名无法 UTF-8 无损表达或目标平台路径碰撞 | entry unsupported/unknown，相关路径 freshness 不可 current | 替换字符、大小写折叠或 Unicode 归一化后静默匹配 |

### 15.12 方案取舍与建议结论

本轮推荐方案：
- 采用逐路径指纹；同时分别保存 index 与 worktree 内容状态，避免 staged/unstaged 误判。
- 固定 SHA-256 原始字节摘要；首版不做文本规范化、不用 Git object ID 代替文件摘要。
- 路径采用 UTF-8 + POSIX / 相对路径，精确保留码点；特殊/歧义路径降级 unknown。
- scope 限定为 Git status 可见的非 ignored 路径；敏感路径不摘要，导致 coverage partial。
- 不引入全工作区 manifest digest，不承诺原子快照；先通过逐路径核验满足恢复用途。
- fingerprint 为可选字段；clean worktree 不需要为了凑齐字段生成空指纹。无法完整采集时允许部分记录，但不得声称整体 current。

需要在用户批准数据模型方向后，才将其映射为 D1 Schema 字段并确定 0.x schema version 的变更策略。该方案尚未验证不同 Git 版本、操作系统、文件系统和客户端库的真实表现；进入实现前仍需独立 Fixture 与 CLI E2E 方案审查。

### 15.13 与现有 Schema 0.1.0 的兼容性结论

这不是对现有 0.1.0 的可选字段补丁：

- 当前 code 子对象使用 additionalProperties=false，0.1.0 不认识 worktree_fingerprint，严格消费者必须拒绝该字段。
- COMPATIBILITY.md 已明确：0.x 阶段新增核心字段（即使 optional）也必须进入新的 minor schema version。因此若该提案获批准，应评估新的 0.2.0，而不是原地修改 0.1.0。
- 不建议把它塞进 extensions。Fingerprint 影响 D2 freshness 与 D3 恢复可信度，是核心语义；若放在消费者可忽略的 extension 中，不同客户端就可能对同一 dirty path 得出不同结论。
- worktree_fingerprint 应保持 optional：clean worktree 不需要生成空清单；老版本 Packet 仍可按 0.1.0 规则消费，但没有 fingerprint 的 dirty path 只能确认路径/HEAD，不得声称该路径内容 current。
- 新字段需要与 code.uncommitted_paths 建立 semantic validation：当 fingerprint 声称覆盖完整 Git-status scope 时，entry path 集合必须与本次观察到的未提交路径集合相同；漏项、多项、重复或路径编码无法无损映射均不得标 coverage=complete。
- 对 index_entries 的 stage 0/1/2/3、mode 和 digest 还需要 semantic validation；JSON Schema 只能校验形状，不能证明 digest 确实来自对应 Git index blob。
- D2 S06/S07 可据此细化：S06 只有在相关 tracked path 的 HEAD/index/worktree 三层均可核验且目标范围匹配时，才允许将该路径内容声明为 current；S07 只有在 untracked 路径存在且其 worktree 摘要精确匹配时，才允许该路径声明 current。整体 coverage partial 仍不能被提升为整体 worktree current。
- D3 C11/C12 继续复用 D2 的逐声明判定；Checkpoint Writer 不能把 fingerprint 的存在等同于完整/可信。

### 15.14 Worktree Fingerprint 反例审查与暂定结论

对 §15.6–§15.13 进行独立反例检查，结论如下：

1. **staged 与 unstaged 不可合并**：只摘要当前文件内容会遗漏 Git index 中已 stage、但随后又编辑过的版本。候选模型因此同时保存 index stages 和 worktree 当前状态。
2. **HEAD 不能替代 index**：HEAD SHA 只标识提交；staged 状态必须从 index stage blob 读取并独立摘要。
3. **删除不是空内容**：必须分别表达 index/worktree 的 present/absent；空文件摘要只代表真实零字节文件。
4. **rename 识别不能作为路径身份基础**：Git rename 是基于相似度的检测结果；协议将其拆成旧路径和新路径的独立状态条目。
5. **symlink 必须不跟随**：否则目标内容变化会被误当成链接本身变化，且可能越出 project root 或形成循环。
6. **路径字符串不能静默规范化**：NFC/NFD、大小写折叠和替换字符都可能把不同文件映射为同一键；无法无损/无歧义映射时降级 unknown。
7. **hash 不等于脱敏**：敏感文件可能是低熵秘密，必须允许按项目规则排除并将 coverage 降为 partial。
8. **逐路径稳定不等于全局原子**：扫描期间多文件状态可能先后变化；候选模型只证明单条目观察及扫描窗口，不承诺跨文件原子一致。
9. **manifest digest 不解决原子性/真实性**：首版不引入全局 manifest hash；若未来增加，必须另定义规范序列化，且不能把它包装成签名或可信来源证明。
10. **平台能力不可假定**：文件模式、symlink、特殊文件和路径字节在不同平台可能不可完全观察；不支持时按条目或整体 scope 降级，不得通过猜测填值。

**暂定结论：** 逐路径 fingerprint 是满足 D2/D3 当前需求的最小可行候选方向；但它仍需与 Repository Identity/Upstream Mapping 合并做一次整体 D1 0.2.0 候选审查。当前没有用户对字段模型的批准，因此不修改 Schema 0.1.0，不生成正式 0.2.0 文件，也不冻结 D1/D2/D3。
