# 通用项目规范模板

一套可复用、跨项目、跨 Agent 的 AI 协作与工程治理规范。目标是让不同项目共享稳定的治理底座，同时保留项目自身的技术栈与业务约束。

> **只想把它铺到某个项目？** 直接看 [`DEPLOY.md`](DEPLOY.md)：一句话命令、会动什么不会动什么、根目录 `TODO.md` 怎么处理、怎么回滚。

## 核心原则

1. **唯一规则入口**：`AGENTS.md` 是项目规则主入口；`CLAUDE.md`、`GEMINI.md` 仅做客户端适配指针。Cursor 原生支持 `AGENTS.md`，不再生成已弃用的 `.cursorrules`。
2. **分域唯一事实源**：每类事实只在一个权威位置维护；`.memory/` 只保存跨会话断点与稳定事实摘要，任务、意图、需求、验证和架构决策分别以各自索引/记录为准。客户端私有记忆只能作缓存。
3. **机器可测**：能由脚本、测试或 CI 验证的约束，不只写成自然语言。
4. **目录纪律**：根目录白名单、临时产物固定位置、构建产物固定位置。
5. **安全失败**：治理检查无法运行时必须失败关闭，不得静默跳过。

6. **按需治理**：每次会话只读取规则入口与记忆断点；任务卡、宪法细则、踩坑记录和历史按风险与任务类型加载。
7. **轻量任务不强制建卡**：局部、低风险、验收明确的工作直接处理；跨模块、跨会话或高不确定性工作才进入任务跟踪流程。
8. **目标连续性**：原始目标与后续意图变化分开记录；局部修复、临时插单和近期对话不得静默覆盖项目目标。

---

## 环境要求

- Node.js 22+（初始化、Node 治理检查、看板生成与测试）。
- Python 3.11+（需要使用 Python 版治理检查时）。
- Git（启用提交钩子时）。

机器可读的版本下限在 `template/policy/standards-version.json`；CI 矩阵同时覆盖下限与最新（Node 22 / 24，Python 3.11 / 3.13）。低于下限的运行时不做承诺——这里只声明在维护期内、且被 CI 实际跑过的版本。

## 快速开始

```bash
node init.cjs /path/to/your-project --dry-run
node init.cjs /path/to/your-project
cd /path/to/your-project
git config core.hooksPath .githooks
node .standards/generate-board.cjs
node .standards/check-governance.cjs
```

初始化脚本默认采用兼容模式：保留已有文件，并把现有根目录纳入初始白名单，但会明确提示人工审查。严格模式不会自动放行未知的既有根目录：

```bash
node init.cjs /path/to/your-project --strict-scan
```

### Agent 客户端适配

模板只维护一份 `AGENTS.md` 规则正文，其他入口通过原生导入机制接入：

| 客户端 | 入口 | 注意事项 |
|---|---|---|
| Codex | `AGENTS.md` | 支持从仓库根目录到当前目录的层级规则。 |
| Claude Code | `CLAUDE.md` → `@AGENTS.md` | 支持 Markdown 导入与层级记忆文件。 |
| Gemini CLI | `GEMINI.md` → `@./AGENTS.md` | 支持 `@file` 导入和层级上下文文件。 |
| Cursor | 根目录及子目录 `AGENTS.md` | 父目录与更具体目录的规则会组合；需要按 glob、手动或智能触发的规则时再评估 `.cursor/rules/*.mdc`。不生成已弃用的 `.cursorrules`。 |

客户端兼容性不是“规则文件存在就算通过”。仓库通过 `tests/test-client-adapters.cjs` 检查指针目标、导入语法和弃用入口；客户端原生加载能力以官方文档为准。客户端配置不得复制或分叉项目规则正文。

官方文档：[Codex AGENTS.md](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) · [Claude Code memory](https://docs.anthropic.com/en/docs/claude-code/memory) · [Gemini CLI GEMINI.md](https://geminicli.com/docs/cli/gemini-md/) · [Cursor Rules](https://docs.cursor.com/context/rules-for-ai)

### 项目能力画像

初始化与治理检查会读取 `project-profile.toml` 与 `policy/capabilities.json`，通过 Capability Resolver 计算能力状态：`on` 为启用、`off` 为关闭并裁剪注册表声明的可选模板产物及对应可选门禁、`auto` 保持 `deferred`，由任务上下文决定当前任务是否加载相关规则。`auto` 不是要求每个任务都建卡的强制开关；仓库级检查器仍会校验保留的可选索引/目录和已有记录，避免已登记数据失去完整性，但不会因此要求轻量任务创建任务卡或里程碑。关闭能力不会删除项目中已经存在的文件；core 门禁始终执行。原始意图基线/变更账本、需求索引和验证证据索引属于 core，不提供关闭开关；`task_tracking`、`roadmap`、`adr`、`module_boundaries`、`multi_agent`、`stack_rules` 是可选能力。意图对齐不是独立全局开关，而是随启用的任务/里程碑记录执行。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

### 任务上下文解析（按需）

对跨模块、跨会话、高风险或不确定任务，可以使用任务上下文解析器生成本次工作的规范读取清单。轻量局部任务不要求运行。

先在项目的 `.tmp/task-context.json` 写入本次任务事实，例如：

```json
{
  "kind": "database_change",
  "risk": "high",
  "impact": "data",
  "cross_session": true,
  "uncertainty": "medium",
  "stacks": ["java"],
  "task_id": "T12",
  "milestone_id": "M1"
}
```

运行：

```bash
node .standards/task-context-resolver.cjs --input .tmp/task-context.json
# 需要机器读取时
node .standards/task-context-resolver.cjs --input .tmp/task-context.json --format json
```

解析器根据任务描述和项目能力画像，列出固定基线、必读规范、按需规范、能力判定和已配置验证命令。它只提供上下文建议，不创建任务卡、不修改项目画像、不执行命令，也不授予任何操作权限。输入是任务事实声明，Agent 不得为了得到更少的读取清单而低估风险或影响范围。

### 项目目标连续性

项目在开始实施前，应建立 `.spec/intent/BASELINE.md`：记录用户原始问题、目标、约束、Non-goals 与可验证成功判据。基线确认后不直接改写；后续补充、纠正、新增、范围/优先级变化和撤回等事项追加到 `CHANGES.md`。仅在启用 `task_tracking` / `roadmap` 时，对应任务卡和里程碑通过 `Gnnn` / `Cnnn` 引用目标与变更，不复制整段需求或聊天记录。

只有影响目标、范围、验收、约束、优先级或关键决策的对话内容才进入变更账本；普通澄清和一次性排障不记录。跨会话恢复与需求/计划变更时必须回顾基线及相关变更；启用任务跟踪或路线图时，相关任务/里程碑收口也要核对这些记录。详见模板文件与 `AGENTS.md`。

为防止同一会话内的目标漂移，变更账本还定义了每轮对话的意图分类：继续、澄清、临时插单、明确变更或冲突待裁定。临时插单保留原任务恢复点；Agent 推断保持 pending；冲突只暂停有冲突的决策，不擅自重排整个计划。跨会话断点在 `.memory/MEMORY.md` §0 保留当前 G/R 指针、暂停原因与下一步；仅在启用 `task_tracking` 时再记录 T 任务锚点。

目标连续性进一步通过需求与验证证据形成闭环：`.spec/requirements/INDEX.md` 用 `Rnnn` 登记可验收要求；启用 `task_tracking` / `roadmap` 时，任务卡和里程碑可引用需求。`.spec/verification/INDEX.md` 用 `Vnnn` 记录测试、人工检查或 CI 证据，并绑定被验证的 commit SHA。任务 `done`、需求 `verified`、里程碑完成和目标完成是不同状态，不得互相替代。轻量维护任务不必创建需求。

### 意图对齐审查

启用 `task_tracking` 时，跟踪任务卡使用 `意图对齐：required` 执行开工/收口审查：开工时记录 G/R、当前 accepted C、预期贡献与必须保留的约束；收口时对照实际 diff、完整 Commit SHA、V 证据和目标/需求影响，结论为 `aligned`、`justified_adjustment`、`user_confirmed_change` 或 `unresolved_drift`。未解决漂移不能将任务标记为 `done`。纯支撑任务可使用 `not_applicable`，但必须说明原因且不能有直接 G/R 关联。

启用 `roadmap` 时，里程碑也有独立的关闭审查：状态改为「已完成」前，必须逐项对照目标成功判据、需求状态与验证证据；未解决漂移、未完成需求或未完成的包含任务会阻止关闭。旧任务卡/旧里程碑未显式启用审查时不被追溯性阻断。机器检查只验证结构、状态和证据指针，不替代 Agent 对实际代码的语义审查。

### 初始化参数

| 参数 | 行为 |
|---|---|
| `--dry-run` | 预览变更，不写文件 |
| `--force` | 覆盖已存在的模板文件；已有 `pre-commit` 仍受保护 |
| `--replace-hook` | 与 `--force` 同时使用时，允许替换已有 `pre-commit` |
| `--strict-scan` | 不把未知的既有根目录自动加入白名单 |

初始化前会检查所有将写入的目标路径：若目标文件、父目录或 `.gitignore` 路径包含项目内符号链接，会在写入前失败关闭，避免沿链接写到项目目录之外。已存在的 BOARD 生成区块也会先做只读结构检查。

初始化过程采用轻量回滚日志：单文件先写同目录临时文件再替换；后续步骤失败时，会尝试恢复本次覆盖的文件并删除本次新建的文件/目录。该机制覆盖可捕获的运行时错误，不等同于断电、强制终止或文件系统损坏下的事务保证；迁移仍应先备份并审查 dry-run。

若目标项目已存在自己的 `.standards/generate-board.cjs`，初始化器不会执行它。初始化时使用仓库随附的生成器并显式指定目标项目目录，项目自有脚本仅保留供维护者自行运行。

`init.cjs` 不会自动覆盖项目已有的提交钩子。若确实需要替换，必须显式执行：

```bash
node init.cjs /path/to/project --force --replace-hook
```

---

## 目录结构

```text
project-standards/
├── README.md                        # 用法与设计说明
├── DEPLOY.md                        # 铺到项目的步骤、影响面与回滚
├── CLIENTS.md                       # 各 Agent 客户端入口与验证程度
├── SPEC-v2.0.md                     # 2.0 设计基线 + 七大方向状态表
├── PROJECT-ADAPTATION-v2.0.md       # 母模板 → 项目规范 的适配机制
├── SESSION-HANDOFF.md               # 跨会话交接：当前状态与下一步
├── UPGRADE-RECORD-TEMPLATE.md       # 人工升级审计记录模板
├── CHANGELOG.md
├── MIGRATION-v1.1.md
├── MIGRATION-v1.2.md
├── MIGRATION-v2.0.md                # 2.0 迁移说明
├── MIGRATION-v3.0.md                # 3.0 迁移说明（scripts/ → .standards/）
├── init.cjs                         # 初始化器：探测技术栈 → 铺模板 → 生成画像与安装清单
├── .gitignore
├── .github/workflows/standards-ci.yml
├── presets/
│   └── stacks/                      # 按检测到的技术栈选择性铺设
│       ├── php.md
│       ├── java.md
│       ├── node.md
│       ├── python.md
│       ├── go.md
│       ├── rust.md
│       └── dotnet.md
├── tools/                           # 只读检测与人工审批，不自动改项目文件
│   ├── check-template-drift.cjs
│   ├── adopt-template-baseline.cjs
│   ├── plan-template-upgrade.cjs
│   ├── validate-template-upgrade-review.cjs
│   ├── record-reviewed-template-upgrade.cjs
│   └── template-source-inventory.cjs
├── tests/                           # 全部纳入 CI（Ubuntu + Windows）
│   ├── test-init.cjs
│   ├── test-parity.cjs
│   ├── test-capability-resolver.cjs
│   ├── test-task-context-resolver.cjs
│   ├── test-intent-continuity.cjs
│   ├── test-intent-continuity-simulation.cjs
│   ├── test-intent-alignment-review.cjs
│   ├── test-traceability-contract.cjs
│   ├── test-traceability-governance.cjs
│   ├── test-policy.cjs
│   ├── test-v2-spec.cjs
│   ├── test-client-adapters.cjs
│   ├── test-migration-v2.cjs
│   ├── test-doc-links.cjs
│   ├── test-template-drift.cjs
│   ├── test-template-upgrade-plan.cjs
│   ├── test-template-upgrade-review.cjs
│   ├── test-template-upgrade-recovery.cjs
│   └── test-template-upgrade-record.cjs
└── template/                        # 被复制进项目的规范本体
    ├── AGENTS.md                    # 唯一入口
    ├── ROUTER.md                    # 按「要做什么」查权威文件
    ├── CLAUDE.md                    # 一行指针，只导入 AGENTS.md
    ├── GEMINI.md
    ├── gov.toml                     # 预算 / 白名单 / 禁用命名 / 布局
    ├── project-profile.toml         # 项目画像，初始 needs_review
    ├── policy/
    │   ├── standards-version.json   # 母模板版本事实源
    │   └── capabilities.json        # 能力注册表
    ├── .gitattributes               # shell 脚本锁 LF
    ├── .gitignore.append            # 追加进项目 .gitignore，含托管区块
    ├── .githooks/
    │   ├── pre-commit
    │   └── pre-commit.local.example
    ├── .standards/
    │   ├── check-governance.cjs     # 治理检查（Node）
    │   ├── check_governance.py      # 治理检查（Python，输出与 Node 逐字节一致）
    │   ├── traceability-check.cjs   # 目标/需求/任务/验证追踪校验（Node）
    │   ├── traceability_check.py    # 追踪校验（Python）
    │   ├── intent-alignment-check.cjs # 任务/里程碑意图对齐审查（Node）
    │   ├── intent_alignment_check.py # 对齐审查（Python）
    │   ├── profile-validator.cjs
    │   ├── profile_validator.py
    │   ├── capability-resolver.cjs
    │   ├── task-context-resolver.cjs # 按任务事实解析该读哪些规范
    │   └── generate-board.cjs       # BOARD.md 生成器
    ├── .spec/
    │   ├── intent/
    │   │   ├── BASELINE.md         # 原始目标基线（确认后不静默改写）
    │   │   └── CHANGES.md          # 后续意图变化（追加记录）
    │   ├── 00-constitution.md
    │   ├── 01-architecture.md
    │   ├── 02-conventions.md
    │   ├── 03-delivery.md
    │   ├── REGISTRY.md
    │   ├── stacks/README.md         # + 当前项目技术栈文件
    │   ├── adr/README.md
    │   ├── roadmap/
    │   │   ├── INDEX.md
    │   │   └── archive/INDEX.md
    │   └── tasks/
    │       ├── index.md
    │       ├── BOARD.md
    │       ├── archive/INDEX.md
    │       └── T1/card.md + log.md
    ├── .memory/
    │   ├── MEMORY.md
    │   ├── PITFALLS.md
    │   └── log/
    └── .tmp/
```

## 技术栈探测

初始化脚本会探测常见技术栈，并生成默认源码目录、构建目录、忽略项与命令提示。探测结果只是初始建议，必须由项目维护者确认。

| 探测依据 | 识别结果 | 默认源码目录 | 默认产物目录 |
|---|---|---|---|
| `composer.json` / `artisan` / `think` / `hyperf` | PHP | `app` 或 `src` | `build` |
| `pom.xml` / `build.gradle(.kts)` | Java / Kotlin | `src/main/java` | `target` |
| `pyproject.toml` / `requirements.txt` | Python | `src` / `app` | `dist` |
| `go.mod` | Go | `cmd` / `internal` | `bin` |
| `Cargo.toml` | Rust | `src` | `target` |
| `*.csproj` / `*.sln` | .NET | `src` | `bin` |
| `package.json` + Electron | Electron | `src` | `out` |
| `package.json` + Vite / Next / Nuxt | Node Web | `src` / `app` | `dist` |
| `package.json` | Node | `src` / `lib` | `dist` |
| 未识别 | Generic | `src` / `app` | `build` |

检测到多技术栈时，脚本会提示人工确认；仅在启用 `stack_rules` 时，才将检测到的语言规范分别复制到 `.spec/stacks/`。`gov.toml [project]` 仍只记录一个主技术栈与默认构建配置，必须由维护者确认多栈项目的实际命令。

## 母模板与项目画像（2.0）

2.0 是完整能力母模板，不要求每个项目启用全部治理能力。初始化器会生成 project-profile.toml：技术栈只作为待确认的探测候选，项目类型、规模、风险、架构和能力开关由维护者确认。画像初始状态为 needs_review。

规则分为 core、capability、stack、project、advisory；core 不可关闭，其余能力按项目需要启用。项目画像只记录选择，不复制规则正文；Agent 仍通过 AGENTS.md 和 ROUTER.md 按任务加载规范。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

## 能力注册表与画像校验

能力元数据集中维护在 `template/policy/capabilities.json`，项目初始化后位于 `policy/capabilities.json`。项目画像只选择能力，不重复定义能力语义。Node/Python 双校验器会检查画像字段、枚举、schema 版本和能力依赖；`needs_review` 仅告警，不阻断初始化。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

## 任务与归档规则

以下约束仅对对应能力启用的项目生效；关闭能力不会删除既有文件，但不再要求新建或维护模板记录。

- 启用 `task_tracking` 时，`.spec/tasks/index.md` 是活跃任务状态唯一来源；每张活跃卡有 `card.md` 和 `log.md`，`BOARD.md` 是由索引生成的派生视图，并由治理检查验证新鲜度。
- 启用 `task_tracking` 时，一个波次完成后将任务目录移动到 `.spec/tasks/archive/W<n>/` 并更新归档索引；归档目录不参与活跃任务扫描。
- 启用 `roadmap` 时，里程碑活跃索引与详情目录保持一致，归档内容放入 `archive/`；该能力依赖 `task_tracking`。
- 关闭 `task_tracking` 或 `roadmap` 时，保留项目已有的计划/历史文件，不对其执行对应的模板索引、目录和归档门禁。

## 治理检查器

提供 Node 与 Python 两个零第三方依赖实现：

```bash
node .standards/check-governance.cjs
python3 .standards/check_governance.py
```

两者必须对相同仓库输出相同的违规项与退出码。当前 `gov.toml` 使用受限 TOML 子集：单行 section、字符串、整数、单行字符串数组；不要使用多行数组或复杂 TOML 特性。后续如需完整 TOML 语法，应引入明确依赖并同步两端实现。

检查覆盖：

- 根目录白名单与禁用命名；
- 关键文档字节预算；
- 必需文件；
- 启用 `task_tracking` / `roadmap` 时，分别检查活跃任务/里程碑索引与目录双向一致；
- 启用 `task_tracking` 时，检查任务状态、ID 唯一性、任务卡 `log.md` 与 BOARD 派生视图新鲜度；
- 对关闭的可选能力保留历史文件，但跳过其专属索引、详情和归档门禁。

## Git Hook 与项目专属验证

`pre-commit` 先执行通用治理检查，再自动执行可选的 `.githooks/pre-commit.local`。把 `.githooks/pre-commit.local.example` 复制为 `.githooks/pre-commit.local`，按项目实际情况填写 lint、类型检查与测试命令。这样升级通用 Hook 时不会覆盖项目专属检查。找不到 Node/Python 或检查器文件时会失败关闭；未配置的检查不得宣称通过。

## 规范设计边界

- `.memory/` 只维护跨会话断点与稳定事实摘要；意图、需求、验证分别以各自仓库权威文件为准；仅在启用 `task_tracking` / `roadmap` / `adr` 时，任务、里程碑、架构决策才分别以对应索引/目录为准。关闭能力不要求维护对应路径。客户端私有记忆只能作缓存，不要求关闭其个人级记忆。
- 工具自动维护的标准缓存（例如 Maven、Gradle、npm、Python 缓存）不等同于 Agent 在项目外创建项目文件。
- 启用 `task_tracking` 时，任务卡授权的是任务范围内的代码修改；关闭时以用户当次指令为修改范围。二者都不自动授权生产部署、Git Push、破坏性删除、数据库生产迁移或用户环境变更。
- 模块依赖边界必须尽可能由架构测试、静态分析或构建规则执行；仅写在 Markdown 中不算机器保证。

## 一个原则

> 规则防的是已发生过的具体错误，不是想象中的风险。
> 能由工具验证的约束就交给工具；规则本身也必须接受自动化测试。

## 已安装版本与模板漂移审查

新版本初始化会生成：

- `policy/standards-version.json`：母模板当前版本与运行时要求。
- `.agent-standards.json`：安装元数据，记录逐文件的模板源哈希、安装后文件哈希、文件来源版本、`.gitignore` 托管区块哈希，以及被保留的项目文件。

**不要把 `--force` 当作版本升级命令。** 从新的规范仓库 checkout 执行只读差异检查：

```bash
node tools/check-template-drift.cjs --root /path/to/your-project
# 机器可读
node tools/check-template-drift.cjs --root /path/to/your-project --json
```

报告区分上游更新、项目本地修改、双向冲突、缺失文件、新增模板文件和未建立基线的旧项目。文件读取会逐级检查路径组件，项目目标或模板源的父目录包含符号链接时按不安全路径报告，不跟随链接读取外部内容。它不写文件、不自动合并、不执行初始化。退出码：`0` 无待处理差异；`1` 存在差异或基线不完整；`2` 缺少基线或输入/元数据无效。

旧项目没有 `.agent-standards.json` 时，工具会明确报告历史基线未知，不猜测哪些文件是原始规范、哪些是项目定制。先备份并人工比较；确认当前保留内容后，才可预览并显式采纳：

```bash
node tools/adopt-template-baseline.cjs --root /path/to/your-project --dry-run
node tools/adopt-template-baseline.cjs --root /path/to/your-project --confirm-reviewed
```

基线采纳只更新 `.agent-standards.json`，不修改规则文件。它表示维护者已审查并接受当前项目内容；已接受的定制会被保留，未来上游修改同一文件时会报告为冲突，要求人工合并。不要在未审查差异时执行 `--confirm-reviewed`。

### 版本升级预览（只读）

已有安装基线后，使用独立的升级计划器查看从项目当前版本到所选规范 checkout 的逐文件升级建议：

```bash
node tools/plan-template-upgrade.cjs --root /path/to/your-project
# 将机器可读计划保存到项目临时目录；有待审差异时退出码 1 是预期结果
node tools/plan-template-upgrade.cjs --root /path/to/your-project --json > /path/to/your-project/.tmp/upgrade-plan.json
```

需要比较另一个规范仓库目录时，增加 `--standards-root /path/to/project-standards`。预览使用 `plan_schema: 2`，包含稳定的 `plan_id`、来源/目标版本、逐文件建议动作、哈希证据、阻断项，以及 `source_inventory_sha256`（目标规范仓库中整个 `template/` 与 `presets/stacks/` 的确定性快照）。它覆盖通用模板文件，以及项目安装清单中实际登记的技术栈预设；未选择的语言预设不会被当成每个项目都必须安装的文件。

计划将变化分为：可审查的上游替换候选、项目本地修改保留、双向冲突（三方人工合并）、上游移除审查、本地缺失恢复候选、上游新增文件候选、旧项目基线审查和未登记同名文件归属审查。任何删除、覆盖或合并都不会自动执行。

`plan-template-upgrade.cjs` 目前只生成预览，不读取审批文件、不应用计划，也不回滚项目内容。维护者必须为每个待审条目记录 `reviewer`、`reviewed_at`、`path`、`decision` 和 `reason`；阻断项先修复并重新生成计划。**当前版本没有自动升级应用器，不能把计划报告当作升级已经完成。**

退出码：`0` 没有待处理的人工差异；`1` 有差异、基线不完整或存在阻断；`2` 参数、路径或元数据无效。人工决策记录完成后，可先用只读校验器检查审批是否齐全：

```bash
node tools/validate-template-upgrade-review.cjs \
  --plan .tmp/upgrade-plan.json \
  --review .tmp/upgrade-review.json \
  --json
```

当前工具只接受 `plan_schema: 2` 与 `review_schema: 2`；旧 schema 1 的 plan/review 不兼容，必须重新生成，不要手工改 JSON 字段。审查记录使用 `review_schema: 2`，必须绑定相同 `plan_id`；每条决策包含 `reviewer`、`reviewed_at`、`path`、`decision`、`reason` 和实际结果 `result_sha256`。普通文件还必须记录最终权限 `result_mode`（0..0o777）；`approve_removal` 与 `defer` 不需要结果哈希/权限。三方合并另外必须提供 `baseline_ref` 与 `merge_result_ref`。`.gitignore` 是特殊的渲染托管区块：`result_sha256` 只计算标记包围的实际区块，不计算整个 `.gitignore`；不记录 `result_mode`，区块外的项目自有忽略规则必须原样保留。校验器会拒绝计划 ID 不匹配、重复路径、缺少决策、错误决策和未解除的阻断项。校验通过只代表人工审查记录完整，不代表变更已经应用，也不是签名或授权凭证。

### 升级失败恢复演练

本仓库提供 `tests/test-template-upgrade-recovery.cjs`，只在系统临时目录创建项目 fixture。它演练一批获批变更（规则文件与项目内版本元数据）、治理检查失败、从项目外完整备份恢复，以及恢复后重新验证治理状态和升级计划 ID。不会触碰真实业务项目。

```bash
node tests/test-template-upgrade-recovery.cjs
```

实际项目升级仍应使用独立 Git 分支/工作树并在项目目录外保存完整备份。失败后立即停止后续变更，恢复到升级前 commit 和工作树状态，再运行治理检查、项目测试/构建、漂移检查和升级计划；恢复结果必须与备份核对，不能只凭脚本返回码宣称恢复成功。

成功应用获批文件并通过项目治理/测试后，使用独立的基线登记器推进 manifest：

```bash
node tools/record-reviewed-template-upgrade.cjs \
  --root /path/to/your-project \
  --standards-root /path/to/project-standards \
  --plan /path/to/your-project/.tmp/upgrade-plan.json \
  --review /path/to/your-project/.tmp/upgrade-review.json \
  --dry-run

# 确认备份、人工变更和结果哈希均无误后，才显式写入
node tools/record-reviewed-template-upgrade.cjs \
  --root /path/to/your-project \
  --standards-root /path/to/project-standards \
  --plan /path/to/your-project/.tmp/upgrade-plan.json \
  --review /path/to/your-project/.tmp/upgrade-review.json \
  --confirm-reviewed
```

登记器不应用模板内容，只更新 `.agent-standards.json`。它会重新校验 plan_id、审批记录、来源版本、共同基线哈希、完整 `source_inventory_sha256`、当前模板源哈希、普通文件的结果 SHA-256/权限，以及 `.gitignore` 托管区块的渲染骨架与结果 SHA-256；仅推进已批准且已验证的路径。完整源快照发现计划生成后新增/删除/修改的任意模板文件或技术栈预设时，会拒绝登记并要求重做计划。成功登记时把该快照摘要写入 `last_upgrade.source_inventory_sha256`。失败时不会写入 manifest。

一次升级可以分批完成。对暂不处理的待审路径，审查记录可以明确填写 `decision: "defer"`，并说明延期原因。登记器会确认该文件/区块仍与计划生成时的内容和权限完全一致，然后保留它原来的逐文件基线；延期路径不会被复制、删除或推进。只要存在延期路径，整体 `installed_with_version` 就保持来源版本。之后重新生成升级计划，只处理剩余路径；全部路径完成后才推进整体版本。若延期期间文件内容或权限发生变化，旧计划会失效，必须重新生成计划和审查记录。

上游删除必须确认文件/托管区块确实已删除，或明确选择保留并登记实际结果哈希。登记完成后，重新运行漂移检查、治理检查、项目测试和构建。

单次迁移的版本、plan/review 引用、备份、逐路径结果、延期项、基线登记和失败恢复证据，可按 [UPGRADE-RECORD-TEMPLATE.md](UPGRADE-RECORD-TEMPLATE.md) 归档。备份本身保存在项目目录之外；记录中只保存备份位置和校验引用。

人工审查记录采用 `review_schema: 2`。普通文件决策必须同时带 `result_sha256`（64 位小写 SHA-256）和 `result_mode`；`.gitignore` 只对渲染托管区块提供 `result_sha256`，不提供权限，因为文件本身由项目和模板共同管理。`approve_removal`、`defer` 不需要结果哈希/权限。三方合并还必须提供 `baseline_ref`、`merge_result_ref` 和合并后文件的 `result_sha256`。完成登记后，重新运行漂移检查、治理检查、项目测试和构建；登记成功不代表业务测试自动通过。

当前仍没有自动升级应用器或自动回滚器。规则文件必须由维护者在独立分支/工作树中按审批手工执行；基线登记器只负责验证实际结果并更新元数据。不要手改 manifest，也不要用 `adopt-template-baseline.cjs` 代替升级登记；后者只用于旧项目首次建立历史基线。


最小审查记录示例（路径和决策必须逐项来自实际计划，不能照抄示例值）：

```json
{
  "review_schema": 2,
  "plan_id": "<从 upgrade-plan.json 复制>",
  "decisions": [
    {
      "reviewer": "maintainer",
      "reviewed_at": "2026-11-08T16:00:00Z",
      "path": ".spec/02-conventions.md",
      "decision": "manual_merge",
      "reason": "已比较项目定制与上游变化，完成手工合并。",
      "result_sha256": "<合并后文件的64位小写SHA-256>",
      "result_mode": 420,
      "baseline_ref": "git:<升级前提交>",
      "merge_result_ref": "git:<审查后的合并提交>"
    }
  ]
}
```

`defer` 决策不需要 `result_sha256`，但必须有 reviewer、reviewed_at 和 reason；它只用于明确延期，不能作为忽略差异的通用选项。登记器会校验延期路径仍保持原快照，否则拒绝登记。

升级前仍应在独立分支/备份副本中操作，并在变更后运行治理检查、项目测试和构建。

## 版本与迁移

当前稳定模板版本见 `CHANGELOG.md`。1.1.x 升级到 1.2.0 请阅读 `MIGRATION-v1.2.md`；1.2.x 项目升级到 2.0 前，先阅读 `MIGRATION-v2.0.md`，并以 `SPEC-v2.0.md` 的七大方向与发布门槛为准。2.0 尚未达到正式发布条件前，不要将候选分支当作稳定模板铺设到业务项目。不要对已经定制的项目直接执行 `--force`。

### 2.0 建设范围

2.0 严格围绕七个方向推进：规范体系与目录架构、Agent 多客户端兼容、记忆与上下文管理、任务/看板/路线图、工程治理与初始化、自动化验证与质量门禁、长期演进与版本管理。完整设计与验收条件见 [`SPEC-v2.0.md`](SPEC-v2.0.md)。不以真实 SaaS 项目试点作为验收前提，只使用仓库自身测试和临时模拟 fixture。

## 规范仓库自身的回归测试

在本仓库根目录运行：

```bash
node tests/test-init.cjs
node tests/test-capability-resolver.cjs
node tests/test-task-context-resolver.cjs
node tests/test-intent-continuity.cjs
node tests/test-intent-continuity-simulation.cjs
node tests/test-intent-alignment-review.cjs
node tests/test-traceability-contract.cjs
node tests/test-traceability-governance.cjs
node tests/test-parity.cjs
node tests/test-policy.cjs
node tests/test-v2-spec.cjs
node tests/test-client-adapters.cjs
node tests/test-migration-v2.cjs
node tests/test-template-drift.cjs
node tests/test-template-upgrade-plan.cjs
node tests/test-template-upgrade-review.cjs
node tests/test-template-upgrade-recovery.cjs
node tests/test-template-upgrade-record.cjs
node tests/test-doc-links.cjs
```

`test-init` 验证 PHP 项目探测、`.gitignore` 幂等合并以及已有 Hook 保护；`test-parity` 使用同一测试夹具验证 Node/Python 检查器的退出码和输出一致，并覆盖符号链接、非法状态、缺失日志、重复 ID、任务波次归档与 BOARD 过期检测；`test-migration-v2` 在临时项目中演练空项目 preview 和已有多栈项目的安全迁移；`test-template-drift` 验证安装基线与只读漂移检测；`test-template-upgrade-plan` 验证升级建议、人工确认契约和预览零写入；`test-template-upgrade-review` 验证审批记录与 plan ID 绑定、完整性、冲突基线来源和拒绝不完整决策；`test-template-upgrade-recovery` 验证失败后的完整备份恢复；`test-template-upgrade-record` 验证成功基线登记、结果哈希/权限校验、完整模板源快照防过期、渲染 `.gitignore` 托管区块及区块外用户规则保留、分批 defer 与最终版本推进；`test-doc-links` 验证所有仓库内 Markdown 相对链接。GitHub Actions 在 Ubuntu 与 Windows 的 Push 和 Pull Request 中执行这些检查。


### 自动追踪完整性检查

原始目标、需求与验证证据的核心追踪由 `.standards/traceability-check.cjs` 与 `.standards/traceability_check.py` 校验，并集成到 Node/Python 治理入口。核心检查验证目标、变更、需求与 V 证据的引用完整性，以及 `verified` 需求是否指向覆盖自身的有效 `pass` 证据（完整 Commit SHA 和具体证据位置）。仅在启用 `task_tracking` / `roadmap` 时，才额外检查任务/里程碑引用、状态承接和对应意图对齐门禁；关闭时保留历史记录但跳过这些可选门禁。模板中的示例占位行会被忽略。轻量维护工作可通过 `supporting:` 说明支撑关系，不需要机械创建需求。


### 长期意图连续性模拟测试

`tests/test-intent-continuity-simulation.cjs` 使用临时项目状态快照模拟同一会话内的临时插单、Agent pending 建议、用户明确纠正、冲突待裁定、跨会话恢复、任务完成但需求未验证，以及最终证据通过等阶段；每个阶段同时运行 Node/Python 追踪校验并比较结果。它验证状态文件与追踪关系的转换约定，不模拟或保证真实 LLM 的行为，真实 Agent 行为仍需通过实际项目试点观察。


### 项目意图对齐审查

启用 `task_tracking` 时，跟踪任务在进入 `in_progress` 前填写任务卡的「开工意图对齐」，进入 `review` / `done` 前填写「收口意图对齐」。收口要基于实际 diff、提交 SHA、测试与需求验收证据，区分 `aligned`、`justified_adjustment`、`user_confirmed_change` 和 `unresolved_drift`。未解决漂移不得标记任务 `done`。启用 `roadmap` 时，里程碑关闭前还需逐项对照目标成功判据、需求验收证据、包含任务状态与未解决漂移。关闭对应能力时保留历史记录但跳过专属门禁。机器校验只检查字段完整性、有效引用和状态约束，不声称能自动证明代码在语义上符合用户意图。`tests/test-intent-alignment-review.cjs` 覆盖这些规则及 Node/Python 检查器一致性。
