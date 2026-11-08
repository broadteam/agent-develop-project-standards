# 通用项目规范模板

一套可复用、跨项目、跨 Agent 的 AI 协作与工程治理规范。目标是让不同项目共享稳定的治理底座，同时保留项目自身的技术栈与业务约束。

## 核心原则

1. **唯一规则入口**：`AGENTS.md` 是项目规则主入口；`CLAUDE.md`、`GEMINI.md` 仅做客户端适配指针。Cursor 原生支持 `AGENTS.md`，不再生成已弃用的 `.cursorrules`。
2. **唯一项目状态源**：`.memory/` 保存跨会话项目事实；客户端私有记忆可以存在，但不得成为项目状态、任务进度或架构决策的权威来源。
3. **机器可测**：能由脚本、测试或 CI 验证的约束，不只写成自然语言。
4. **目录纪律**：根目录白名单、临时产物固定位置、构建产物固定位置。
5. **安全失败**：治理检查无法运行时必须失败关闭，不得静默跳过。

6. **按需治理**：每次会话只读取规则入口与记忆断点；任务卡、宪法细则、踩坑记录和历史按风险与任务类型加载。
7. **轻量任务不强制建卡**：局部、低风险、验收明确的工作直接处理；跨模块、跨会话或高不确定性工作才进入任务跟踪流程。

---

## 环境要求

- Node.js 18+（初始化、Node 治理检查、看板生成与测试）。
- Python 3.10+（需要使用 Python 版治理检查时）。
- Git（启用提交钩子时）。

## 快速开始

```bash
node init.cjs /path/to/your-project --dry-run
node init.cjs /path/to/your-project
cd /path/to/your-project
git config core.hooksPath .githooks
node scripts/generate-board.cjs
node scripts/check-governance.cjs
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

初始化与治理检查会读取 `project-profile.toml` 与 `policy/capabilities.json`，通过 Capability Resolver 计算能力状态：`on` 为启用、`off` 为关闭并裁剪注册表声明的可选模板产物及对应可选门禁、`auto` 保持 `deferred`，交由具体任务上下文判断。关闭能力不会删除项目中已经存在的文件；core 门禁始终执行。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

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
node scripts/task-context-resolver.cjs --input .tmp/task-context.json
# 需要机器读取时
node scripts/task-context-resolver.cjs --input .tmp/task-context.json --format json
```

解析器根据任务描述和项目能力画像，列出固定基线、必读规范、按需规范、能力判定和已配置验证命令。它只提供上下文建议，不创建任务卡、不修改项目画像、不执行命令，也不授予任何操作权限。输入是任务事实声明，Agent 不得为了得到更少的读取清单而低估风险或影响范围。

### 初始化参数

| 参数 | 行为 |
|---|---|
| `--dry-run` | 预览变更，不写文件 |
| `--force` | 覆盖已存在的模板文件；已有 `pre-commit` 仍受保护 |
| `--replace-hook` | 与 `--force` 同时使用时，允许替换已有 `pre-commit` |
| `--strict-scan` | 不把未知的既有根目录自动加入白名单 |

初始化前会检查所有将写入的目标路径：若目标文件、父目录或 `.gitignore` 路径包含项目内符号链接，会在写入前失败关闭，避免沿链接写到项目目录之外。已存在的 BOARD 生成区块也会先做只读结构检查。

初始化过程采用轻量回滚日志：单文件先写同目录临时文件再替换；后续步骤失败时，会尝试恢复本次覆盖的文件并删除本次新建的文件/目录。该机制覆盖可捕获的运行时错误，不等同于断电、强制终止或文件系统损坏下的事务保证；迁移仍应先备份并审查 dry-run。

若目标项目已存在自己的 `scripts/generate-board.cjs`，初始化器不会执行它。初始化时使用仓库随附的生成器并显式指定目标项目目录，项目自有脚本仅保留供维护者自行运行。

`init.cjs` 不会自动覆盖项目已有的提交钩子。若确实需要替换，必须显式执行：

```bash
node init.cjs /path/to/project --force --replace-hook
```

---

## 目录结构

```text
project-standards/
├── README.md
├── CHANGELOG.md
├── MIGRATION-v1.1.md
├── init.cjs
├── PROJECT-ADAPTATION-v2.0.md
├── presets/stacks/          # 按检测到的技术栈选择性铺设
├── tools/
│   ├── check-template-drift.cjs
│   ├── adopt-template-baseline.cjs
│   └── plan-template-upgrade.cjs
│   ├── php.md
│   ├── java.md
│   ├── node.md
│   ├── python.md
│   ├── go.md
│   ├── rust.md
│   └── dotnet.md
├── tests/
│   ├── test-init.cjs
│   └── test-parity.cjs
├── .github/workflows/standards-ci.yml
└── template/
    ├── AGENTS.md
    ├── policy/standards-version.json
    ├── ROUTER.md
    ├── CLAUDE.md
    ├── GEMINI.md
    ├── gov.toml
    ├── .gitattributes
    ├── .gitignore.append
    ├── .githooks/
    │   ├── pre-commit
    │   └── pre-commit.local.example
    ├── scripts/
    │   ├── check-governance.cjs
    │   ├── check_governance.py
    │   └── generate-board.cjs
    ├── .spec/
    │   ├── 00-constitution.md
    │   ├── 01-architecture.md
    │   ├── 02-conventions.md
    │   ├── 03-delivery.md
    │   ├── stacks/README.md + 当前项目技术栈文件
    │   ├── REGISTRY.md
    │   ├── adr/
    │   ├── roadmap/
    │   │   ├── INDEX.md
    │   │   └── archive/INDEX.md
    │   └── tasks/
    │       ├── index.md
    │       ├── BOARD.md
    │       ├── archive/INDEX.md
    │       └── T1/card.md + log.md
    ├── .memory/
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

检测到多技术栈时，脚本会提示人工确认，并将检测到的语言规范分别复制到 `.spec/stacks/`。`gov.toml [project]` 仍只记录一个主技术栈与默认构建配置，必须由维护者确认多栈项目的实际命令。

## 母模板与项目画像（2.0）

2.0 是完整能力母模板，不要求每个项目启用全部治理能力。初始化器会生成 project-profile.toml：技术栈只作为待确认的探测候选，项目类型、规模、风险、架构和能力开关由维护者确认。画像初始状态为 needs_review。

规则分为 core、capability、stack、project、advisory；core 不可关闭，其余能力按项目需要启用。项目画像只记录选择，不复制规则正文；Agent 仍通过 AGENTS.md 和 ROUTER.md 按任务加载规范。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

## 能力注册表与画像校验

能力元数据集中维护在 `template/policy/capabilities.json`，项目初始化后位于 `policy/capabilities.json`。项目画像只选择能力，不重复定义能力语义。Node/Python 双校验器会检查画像字段、枚举、schema 版本和能力依赖；`needs_review` 仅告警，不阻断初始化。详见 [PROJECT-ADAPTATION-v2.0.md](PROJECT-ADAPTATION-v2.0.md)。

## 任务与归档规则

- 当前任务的唯一状态源是 `.spec/tasks/index.md`。
- 每张活跃任务卡必须有 `.spec/tasks/<ID>/card.md` 和 `log.md`。
- `.spec/tasks/BOARD.md` 是派生视图，由 `node scripts/generate-board.cjs` 生成；治理检查会通过索引 SHA-256 标记检查其是否过期。
- 一个波次完成后，将该波次任务目录整体移动到 `.spec/tasks/archive/W<n>/`，并更新归档索引；归档目录默认不参与活跃任务一致性扫描。
- 里程碑同理：活跃索引与活跃目录对应，归档内容放入 `archive/`。

## 治理检查器

提供 Node 与 Python 两个零第三方依赖实现：

```bash
node scripts/check-governance.cjs
python3 scripts/check_governance.py
```

两者必须对相同仓库输出相同的违规项与退出码。当前 `gov.toml` 使用受限 TOML 子集：单行 section、字符串、整数、单行字符串数组；不要使用多行数组或复杂 TOML 特性。后续如需完整 TOML 语法，应引入明确依赖并同步两端实现。

检查覆盖：

- 根目录白名单与禁用命名；
- 关键文档字节预算；
- 必需文件；
- 活跃任务 / 里程碑索引与目录双向一致；
- 任务状态合法、ID 不重复、任务卡 `log.md` 存在；
- BOARD 派生视图未过期。

## Git Hook 与项目专属验证

`pre-commit` 先执行通用治理检查，再自动执行可选的 `.githooks/pre-commit.local`。把 `.githooks/pre-commit.local.example` 复制为 `.githooks/pre-commit.local`，按项目实际情况填写 lint、类型检查与测试命令。这样升级通用 Hook 时不会覆盖项目专属检查。找不到 Node/Python 或检查器文件时会失败关闭；未配置的检查不得宣称通过。

## 规范设计边界

- `.memory/` 是项目事实的权威来源，不要求客户端关闭其个人级记忆。
- 工具自动维护的标准缓存（例如 Maven、Gradle、npm、Python 缓存）不等同于 Agent 在项目外创建项目文件。
- 任务卡授权的是任务范围内的代码修改，不自动授权生产部署、Git Push、破坏性删除、数据库生产迁移或用户环境变更。
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
node tools/plan-template-upgrade.cjs --root /path/to/your-project --json
```

需要比较另一个规范仓库目录时，增加 `--standards-root /path/to/project-standards`。预览输出包含稳定的 `plan_id`、来源/目标版本、逐文件建议动作、哈希证据、阻断项以及人工审批字段。它覆盖普通模板文件和技术栈预设。

计划将变化分为：可审查的上游替换候选、项目本地修改保留、双向冲突（三方人工合并）、上游移除审查、本地缺失恢复候选、上游新增文件候选、旧项目基线审查和未登记同名文件归属审查。任何删除、覆盖或合并都不会自动执行。

`plan-template-upgrade.cjs` 目前只生成预览，不读取审批文件、不应用计划，也不回滚项目内容。维护者必须为每个待审条目记录 `reviewer`、`reviewed_at`、`path`、`decision` 和 `reason`；阻断项先修复并重新生成计划。**当前版本没有自动升级应用器，不能把计划报告当作升级已经完成。**

退出码：`0` 没有待处理的人工差异；`1` 有差异、基线不完整或存在阻断；`2` 参数、路径或元数据无效。升级前仍应在独立分支/备份副本中操作，并在变更后运行治理检查、项目测试和构建。

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
node tests/test-parity.cjs
node tests/test-policy.cjs
node tests/test-v2-spec.cjs
node tests/test-client-adapters.cjs
node tests/test-migration-v2.cjs
node tests/test-doc-links.cjs
```

`test-init` 验证 PHP 项目探测、`.gitignore` 幂等合并以及已有 Hook 保护；`test-parity` 使用同一测试夹具验证 Node/Python 检查器的退出码和输出一致，并覆盖符号链接、非法状态、缺失日志、重复 ID、任务波次归档与 BOARD 过期检测；`test-migration-v2` 在临时项目中演练空项目 preview 和已有多栈项目的安全迁移；`test-template-drift` 验证安装基线与只读漂移检测；`test-template-upgrade-plan` 验证升级建议、人工确认契约和预览零写入；`test-doc-links` 验证所有仓库内 Markdown 相对链接。GitHub Actions 在 Ubuntu 与 Windows 的 Push 和 Pull Request 中执行这些检查。
