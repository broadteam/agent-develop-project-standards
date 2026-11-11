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
