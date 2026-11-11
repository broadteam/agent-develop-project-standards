# Session Continuity Protocol（SCP）— 设计提案

> 状态：Proposal / 待审查  
> 适用范围：跨会话、跨 Agent 客户端、跨模型的项目工作连续性  
> 本文是协议设计提案，不是已批准的运行规范；在用户审查前，不启用强制门禁，不改变现有项目事实源，不要求项目立即迁移。

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

一个项目在某一时刻可恢复的上下文，由以下信息组成：

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

Packet 必须区分：

- `authoritative_ref`：权威记录的路径与 ID。
- `observed_state`：本次现场读取到的状态。
- `last_known_state`：上次断点保存的状态。
- `inference`：Agent 推断，不能作为已确认事实。
- `pending_confirmation`：必须由用户或指定责任人决定的事项。

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
2. 读取 `AGENTS.md` 规则入口与 `SESSION-HANDOFF.md` 导航入口。
3. 读取 handoff 指向的领域权威来源：意图基线/变更、相关需求、任务/里程碑、ADR、验证证据。
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

Checkpoint 不采用单一“完成度”字段，而应分别描述以下维度：

| 维度 | 状态示例 | 含义 |
|---|---|---|
| 工作内容 | not_started / in_progress / blocked / locally_complete | 工作本身进度 |
| 持久化 | unsaved / saved / committed | 文件是否保存、是否进入 Git commit |
| 验证 | not_run / running / passed / failed / stale | 验证结果及其新鲜度 |
| 审查 | not_reviewed / reviewed / changes_requested | 是否完成代码/语义审查 |
| 决策 | not_required / pending_user / confirmed / rejected | 是否需要用户确认及结果 |

Checkpoint 最小字段：

- checkpoint ID、时间、协议版本。
- 当前 branch、HEAD SHA、worktree 状态。
- 未提交变更的文件列表与摘要；必要时记录 diff/tree hash，但不默认复制完整 diff。
- 当前工作主题与 G/R/T/M 引用（适用时）。
- 已完成、未完成、阻塞、待决策。
- 验证命令、结果、绑定 SHA；没有运行必须写 `not_run`。
- 下一步和禁止操作。

规则：

- 保存文件不等于提交；提交不等于验证；验证通过不等于用户验收。
- 若工作树 dirty，必须明确交接未提交变更的保存位置与处理方式。
- 不自动 stash、commit、reset 或清理未跟踪文件。
- 新 commit 或相关文件变更会使旧验证证据变为 stale，除非证据明确覆盖新版本。

### 4.5 Concurrency Control — 并发控制

**目标**：避免多个 Agent/会话同时修改相同状态源或互相覆盖工作。

优先策略：

1. 每个并行 Agent 使用独立 branch/worktree。
2. 任务或文件范围明确分配 owner；同一权威文件默认单写者。
3. 需要共享写入时，声明 lease：资源范围、owner、base SHA、创建时间、到期时间、续租/释放状态。
4. 写入前比较 base SHA 与当前 SHA；发生变化必须重新读取、重放或人工解决，不允许盲目覆盖。
5. 过期 lease 只表示协调声明失效，不代表可以删除其他 Agent 的工作；先检查工作树、分支和未提交改动。
6. 同一任务的状态变更与证据更新必须串行化，避免 done 状态先于验证结果写入。

**安全边界**：

- Git 分支/worktree 隔离是默认执行手段；lease 是协调层，不提供安全隔离或分布式事务。
- 初版可采用仓库内轻量声明或人工协调；在没有可靠原子写入/锁服务前，不宣称具备强一致分布式锁。
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
- subject revision：commit SHA 或明确的工作树快照。
- environment：OS、runtime、关键版本（适用时）。
- result：pass / fail / inconclusive / not_run。
- observed_at、actor、scope/limitations。

可信度规则：

- CI 证据必须绑定实际 workflow run 的 head SHA；仅有绿色徽标或旧 run 不够。
- 本地测试必须记录执行命令、退出码和代码版本；没有 commit 时需说明工作树状态。
- 人工审查必须说明审查对象和范围，不能泛写“已检查”。
- 用户确认必须能追溯到明确用户表达；Agent 自己总结不能代替。
- 证据只对其 subject、revision 和 scope 有效；代码变化后需要重新判断是否仍有效。
- 证据缺失时明确标记 unknown/not_run，不允许补造。

## 5. 最小 Continuity Packet 草案

以下是语义示例，不是最终 schema；字段名和必填规则需经审查后再冻结。

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
  worktree: dirty
  uncommitted_paths: []
checkpoint:
  work_state: in_progress
  persistence_state: saved
  verification_state: not_run
  review_state: not_reviewed
  decision_state: pending_user
evidence_refs: []
coordination:
  owner: agent-a
  lease_ref: null
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

- Packet 是可重建的工作快照，不是任务、需求或意图的新权威数据库。
- 不要求每次普通对话都生成文件；跨会话暂停、Agent 交接、长任务 checkpoint、阶段收口时才需要持久化。
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
  -> Evidence Capture
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
- 至少两个独立客户端按同一 Packet 完成恢复的可重复 fixture；真实客户端端到端支持需单独标注版本和证据。

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
| D5 Concurrency | 先支持 branch/worktree 与轻量 lease 契约 | 冲突写入可检测；不虚称强锁 |
| D6 Client Adapters | 至少两个客户端消费相同 packet | 规则正文不分叉；恢复结果一致 |

每个阶段独立评审和验收；只有 D0 语义冻结后才开始 schema/代码实现。阶段之间不要求版本号同步推进。

## 9. 需要用户裁定的设计问题

以下问题在获得明确决定前保持 proposal，不自行写入项目宪法或强制门禁：

1. **Packet 的持久化策略**：默认只在交接/长任务断点时生成文件，还是所有跟踪任务都生成机器可读 packet？提案倾向前者，以控制维护成本。
2. **Lease 的初版强度**：先采用 branch/worktree 隔离 + 人工/仓库内声明，还是直接引入外部锁服务？提案倾向前者，不宣称强一致锁。
3. **Schema 格式**：JSON 作为机器权威格式、Markdown 作为人类 handoff，还是单一 YAML？提案倾向 JSON schema + 可选 Markdown 渲染，但需要评估双表示同步成本。
4. **客户端互操作验收**：先做两个客户端的文件/fixture 契约测试，还是必须启动真实 CLI 做端到端恢复？提案倾向先 fixture，再逐个客户端增加实测支持声明。

## 10. 当前状态

- 本文仅为设计提案，不改变 PR #10 的 3.0 审查结论。
- PR #10 保持 Open + Draft；本提案应在独立分支/独立 PR 评审，不能混入 PR #10。
- 未经用户审查，不冻结 schema、不启用门禁、不要求现有项目迁移。
