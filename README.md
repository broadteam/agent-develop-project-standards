# 通用项目规范模板

一套可以直接铺到任何项目里的 AI 协作规范。**目标：换项目不用重新教 agent 规矩。**

核心思路只有四条：

1. **唯一入口** —— 规则只在 `AGENTS.md`，`CLAUDE.md` / `GEMINI.md` / `.cursorrules` 只做指针
2. **唯一记忆** —— 状态只在 `.memory/`，任何 agent 不建自己的 memory
3. **机器可测** —— 能用脚本查的规则不写成长篇文字，写成闸门
4. **目录纪律** —— 根目录白名单 + 临时产物只进 `.tmp/` + 产物只进固定目录

---

## 用法（3 步）

```bash
# 1. 复制到项目旁（或直接放在 D:/develop 下）
#    本目录就是模板本体，不用复制

# 2. 铺进目标项目
node D:/develop/project-standards/init.cjs D:/develop/你的项目

# 3. 启用提交闸门（每个克隆都要做一次）
cd D:/develop/你的项目
git config core.hooksPath .githooks
```

`init.cjs` 会自动做这些事：

| 动作 | 说明 |
|---|---|
| 复制规范文件 | 已存在的文件**跳过**，不覆盖你写好的内容（`--force` 才覆盖） |
| 填占位符 | 项目名从 `package.json` 或目录名推断，日期填当天 |
| 扫描根目录 | 自动生成 `gov.toml` 的 `[dirs]` 白名单，**保证一上来就能通过检查** |
| 追加 .gitignore | 补上 `.tmp/`、产物目录、工具数据目录 |
| 加可执行位 | `pre-commit` 钩子 |

先看会做什么不改任何东西：

```bash
node D:/develop/project-standards/init.cjs D:/develop/你的项目 --dry-run
```

---

## 目录结构

```
project-standards/
├─ README.md          ← 你在这里
├─ init.cjs           ← 铺设脚本
└─ template/          ← 被复制的内容
   ├─ AGENTS.md              唯一入口（含 §2.5 计划规范、§2.6 分级读取）
   ├─ ROUTER.md              按「要做什么」查权威文件
   ├─ CLAUDE.md / GEMINI.md / .cursorrules   一行指针
   ├─ gov.toml               预算 / 白名单 / 禁用命名 / 布局
   ├─ .gitattributes         shell 脚本锁 LF
   ├─ .gitignore.append      追加进项目的 .gitignore
   ├─ .githooks/pre-commit   提交闸门（自动选 node / python）
   ├─ scripts/
   │  ├─ check-governance.cjs   治理检查（Node 版）
   │  └─ check_governance.py    治理检查（Python 版，行为一致）
   ├─ .spec/
   │  ├─ 00-constitution.md  红线
   │  ├─ 01-architecture.md  分层 / 契约 / 数据位置
   │  ├─ 02-conventions.md   命名 / 语言规范 / 文案纪律 / 提交
   │  ├─ 03-delivery.md      构建 / 产物 / 发布检查单
   │  ├─ REGISTRY.md         标识符唯一登记处
   │  ├─ roadmap/
   │  │  ├─ INDEX.md         里程碑索引（≤4KB，只读这个）
   │  │  └─ M1/milestone.md  单个里程碑详情
   │  ├─ tasks/
   │  │  ├─ index.md         任务索引 + 唯一状态源（≤8KB）
   │  │  ├─ BOARD.md         看板视图（人看）
   │  │  ├─ archive/         已完成波次归档（默认不读）
   │  │  └─ T1/
   │  │     ├─ card.md       这张卡：背景 / 范围 / 验收
   │  │     └─ log.md        执行流水：试了什么、错在哪、最终方案
   │  └─ adr/README.md       ADR 模板
   ├─ .memory/
   │  ├─ MEMORY.md           跨会话记忆（§0 断点）
   │  ├─ PITFALLS.md         通用实证
   │  └─ log/                每日收口日志
   └─ .tmp/                  临时产物唯一去处
```

---

## 铺完之后要手动做的四件事

`init` 只能填机械信息，这四件必须人做：

1. **`AGENTS.md` §0** —— 四条不可协商的措辞。通用版已经能用，但加上项目特有的会更准。
2. **`.spec/00-constitution.md`** —— 后半段「项目特有」三条是示例，改成你项目的实际红线，或者删掉。
3. **`.memory/MEMORY.md` §0** —— 断点。这是换 agent 时唯一必读的状态。
4. **给 `pre-commit` 追加本项目的检查** —— 模板只装通用治理检查，不知道你的类型检查 / lint / 测试命令：

```sh
# 追加到 .githooks/pre-commit 末尾（"通过"之前）
echo "[pre-commit] 类型检查..."
npm run typecheck || exit 1
```

**不追加 = 静默降级**：钩子照样打印"通过"，但类型错误照样能提交。这比没有钩子更危险——你会以为有保护。

---

## 支持哪些技术栈

规范结构本身与语言无关；`init.cjs` 会探测技术栈，决定默认的源码目录、产物目录、命令和忽略项。

| 探测依据 | 判定 | 源码目录 | 产物目录 |
|---|---|---|---|
| `package.json` + `electron` | Electron 桌面 | `src` | `out` |
| `package.json` + `vite`/`next`/`nuxt` | 前端 Web | `src` | `dist` |
| `package.json` | Node 库/服务 | `src` | `dist` |
| `pyproject.toml` / `requirements.txt` | Python | `src` | `dist` |
| `pom.xml` / `build.gradle(.kts)` | Java / Kotlin | `src/main/java` | `target` |
| `go.mod` | Go | `cmd` | `bin` |
| `Cargo.toml` | Rust | `src` | `target` |
| `*.csproj` / `*.sln` | .NET | `src` | `bin` |
| 都没有 | 通用 | `src` | `build` |

探测错了不影响规范，改 `gov.toml [project]` 即可。

**治理检查有两个版本**：`check-governance.cjs`（Node）和 `check_governance.py`（Python），行为一致。
`pre-commit` 会按环境自动选——Python/Java/Go 项目即使没装 Node 也能跑闸门。

---

## 计划与待办放哪（重要）

Agent 最爱干的事：在根目录建 `TODO.md`、`PLAN.md`、`ROADMAP.md`、`NEXT_STEPS.md`、`progress.md`，
然后下次没人知道哪个是最新的。**这套规范把它们全部禁掉了**（治理检查会拦）。

计划分三层，各有唯一的家：

| 时间尺度 | 放哪 | 例子 |
|---|---|---|
| 一次任务内的多步执行 | 不落盘；要落就 `.tmp/<任务ID>/plan.md`，做完即删 | "先改 A，再跑 B，最后验证 C" |
| 几天的具体动作 | `.spec/tasks/<ID>/`（`card.md` + `log.md`），索引在 `tasks/index.md` | "给迁移加撤销入口" |
| 几周~几个月 | `.spec/roadmap/<ID>/milestone.md`，索引在 `roadmap/INDEX.md` | "v2 收尾" |

**判定口诀**：这件事明天还在吗？不在 ⇒ `.tmp/`；在但几天能做完 ⇒ 卡；要拆成好几张卡 ⇒ 里程碑。

**根目录禁止出现**：`TODO.md` `PLAN.md` `ROADMAP.md` `NEXT.md` `NEXT_STEPS.md` `PROGRESS.md` `NOTES.md` `BACKLOG.md` `TASKS.md` `CHECKLIST.md`（含大小写变体与 `TODO-v2.md` 这类后缀）。

为什么这么严：同一件事在三处各写一份，一定会互相打架；而"哪个是最新的"这个问题，靠人记是记不住的。

### 为什么按目录拆，而不是写一个大文件

中大型项目里，**一个大文件 = 每次都要读全文**。200 张卡写进一个 `roadmap.md`，
每次开工都吞 50KB 上下文，真正该看的代码反而被挤掉。

所以采用**索引 + 详情**两级：

| 文件 | 大小上限 | 什么时候读 |
|---|---|---|
| `tasks/index.md` | 8KB | 需要知道"现在有什么"时，读一次 |
| `tasks/<ID>/card.md` | 4KB | 只读你正在做的那一张 |
| `roadmap/INDEX.md` | 4KB | 需要知道"这个阶段干什么"时 |
| `roadmap/<ID>/milestone.md` | 4KB | 只读当前里程碑 |
| `archive/` | 不限 | **默认不读** |

索引超预算就归档已完成波次——**棘轮，只准降不准升**。治理检查会拦。

### 一张卡一个目录，追溯靠 log.md

```
.spec/tasks/T7/
  card.md   ← 静态：背景、范围、验收（写一次）
  log.md    ← 动态：试了什么、错在哪、最终方案（只追加）
```

下次有人问"当时为什么这么改"，答案在 `log.md`，不用翻 git log 猜。
**结论进 `log.md`，过程进 `.tmp/`**——探针输出、大段日志不要进仓库，只留结论和数字。

---

## 日常怎么用

| 场景 | 做什么 |
|---|---|
| 开工 | 读 `AGENTS.md` → `.spec/00-constitution.md` → `.memory/MEMORY.md` §0 |
| 加需求 | 先在 `.board/board.toml` 建卡（写清 `scope` 和 `accept`），再动手 |
| 改架构 | 先改 `.spec/01-architecture.md`，再改代码；推翻旧设计要写 ADR |
| 收工 | 追加 `.memory/log/<日期>.md`，更新 `.memory/MEMORY.md` §0 |
| 踩坑 | 追加 `.memory/PITFALLS.md`（现象 → 根因 → 对策） |
| 提交 | 钩子自动跑治理检查，不通过会被拦 |

---

## 治理检查查什么

```bash
node scripts/check-governance.cjs
```

| 检查 | 违规示例 | 提示 |
|---|---|---|
| 根目录白名单 | 建了 `test123/` | 加到 `gov.toml [dirs]` 或挪进 `.tmp/` |
| 禁用命名 | `out2/` `tmp1/` `备份.bak` | 产物统一放一处 |
| 计划文件散落 | 根目录出现 `TODO.md` / `PLAN.md` | 写进 `.board/` 或 `.spec/04-roadmap.md` |
| 文档预算 | `AGENTS.md` > 12KB | 先压缩或归档 |
| 必需文件 | 删了 `.spec/REGISTRY.md` | 补回来 |

零依赖，直接 `node` 跑，能进 CI，也能挂 pre-commit。

---

## 它不做什么

- **不生成业务代码**，只铺规矩。
- **不强制你遵守**——它只让"违反"这件事**可见**。真正的约束来自你愿不愿意跑检查。
- **不绑定技术栈**：默认值按 Node/前端项目推断（`src/`、`dist/`、`npm run`），别的栈改 `gov.toml [project]` 和 `.spec/03-delivery.md` 即可。

---

## 一个原则

> 规则防的是**已发生过的具体错误**，不是想象中的风险。
> 写一条规则前先问：它防的是什么？答不上来 = 多余，删掉。

规则膨胀的根因是"只追加不压缩"。所以这里设了字节预算：**加了必须减**。
如果一条规则阻止你解决真实问题，写 ADR 挑战它，由人裁定——规则改起来和代码一样容易，才是健康的治理。
