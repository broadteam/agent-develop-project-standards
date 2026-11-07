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

### 初始化参数

| 参数 | 行为 |
|---|---|
| `--dry-run` | 预览变更，不写文件 |
| `--force` | 覆盖已存在的模板文件；已有 `pre-commit` 仍受保护 |
| `--replace-hook` | 与 `--force` 同时使用时，允许替换已有 `pre-commit` |
| `--strict-scan` | 不把未知的既有根目录自动加入白名单 |

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
├── presets/stacks/          # 按检测到的技术栈选择性铺设
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

## 版本与迁移

当前模板版本见 `CHANGELOG.md`。从 1.1.x 升级到 1.2.0 前，先阅读 `MIGRATION-v1.2.md`；不要对已经定制的项目直接执行 `--force`。

## 规范仓库自身的回归测试

在本仓库根目录运行：

```bash
node tests/test-init.cjs
node tests/test-parity.cjs
```

`test-init` 验证 PHP 项目探测、`.gitignore` 幂等合并以及已有 Hook 保护；`test-parity` 使用同一测试夹具验证 Node/Python 检查器的退出码和输出一致，并覆盖符号链接、非法状态、缺失日志、重复 ID、任务波次归档与 BOARD 过期检测。GitHub Actions 会在 Push 和 Pull Request 时执行这些检查。
