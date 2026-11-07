# {{PROJECT_NAME}} — AI 开工协议

> {{PROJECT_DESC}}
>
> **本文件是唯一入口。** 其他 agent 的入口文件（CLAUDE.md / GEMINI.md）只做指针；Cursor 原生读取 AGENTS.md，不再生成已弃用的 `.cursorrules`，不写第二套规范。

---

## 0. 不可协商四条

1. **项目内自足**。只读写本项目目录；**禁止**主动在项目外创建、修改或删除项目文件、业务数据与开发产物。工具运行所需的标准缓存（如 Maven/Gradle/npm/Python 缓存）和系统临时数据允许由工具自动维护，但不得擅自修改用户环境。
   唯一例外：产品运行时写自己的用户数据目录——那是产品数据，不是开发产物。
2. **根目录白名单**。根目录只允许 `gov.toml [dirs]` 列出的目录/文件；临时产物只能进 `.tmp/<任务ID>/`，构建产物只能进 `{{BUILD_OUTPUT}}/`。
   **禁止** `out2` `test1` `tmp` `新建文件夹` 这类序号/随手目录。
3. **单一入口 + 单一记忆**。规则看本文件，状态看 `.memory/MEMORY.md`。
   **禁止**任何 agent 将私有 memory 或 rules 文件作为项目状态、任务进度、架构决策的权威来源。
4. **一次改动一次提交**。提交信息写清"动了什么 + 为什么"。

---

## 0.2 操作权限

操作权限按 `.spec/00-constitution.md`「Agent 操作权限」执行。任务卡授权的是代码修改范围，不自动授权不可逆、外部可见或影响用户数据的操作；工具具备某项能力，不代表 Agent 已获授权。

## 0.3 冲突裁决顺序

| 级 | 权威文件 | 回答 |
|---|---|---|
| 1 | 本文件 §0 四条 + 用户当次指令 | 什么绝对不能做 |
| 2 | `.spec/00-constitution.md` 红线 | 宪法级约束 |
| 3 | `.spec/01-architecture.md` + `.spec/adr/` | 应该怎么实现 |
| 4 | `.spec/02-conventions.md` | 命名/代码/提交 |
| 5 | `.spec/tasks/<ID>/card.md` 的 scope | 这一次允许改什么 |
| 6 | 你自己的默认习惯 | 上面都没规定时 |

- 1~3 级矛盾 ⇒ **停下问用户**，不要自行裁决。
- **同一事实只准有一个家**（`.spec/REGISTRY.md`），别处只放指针。

---

## 0.5 会话协议

**开工五步**：
1. 本文件
2. `.spec/00-constitution.md` 红线
3. `.memory/MEMORY.md` §0 断点 + `.memory/PITFALLS.md`
4. `git log --oneline -5` 核对断点
5. `.spec/tasks/index.md` 找到你要做的卡，再读那张卡的 `card.md`（没有卡就先建卡，别直接动手）

**收口四件**（与提交同批）：
1. `.memory/log/<YYYY-MM-DD>.md` 追加一节（带 commit 号与实测数字）
2. 有跨会话必守的新规则 → 改 `.memory/MEMORY.md`
3. 踩到判据级的新坑 → 追加 `.memory/PITFALLS.md`
4. 覆盖 `.memory/MEMORY.md` §0 断点

**文档生命周期**（防止文档膨胀成负担）：

| 规则 | 说明 |
|---|---|
| 版本历史归 git | 不在文件头追加变更行，`git log` 就是历史 |
| 字节预算棘轮 | 阈值见 `gov.toml [budget]`；超了必须减等量再提交 |
| 机器可测就删文字 | 脚本能查的规则，只留一句指针指向闸门 |
| 取代而非追加 | 旧结论被推翻时标 `superseded` 并链接替代品，不并排共存 |
| 写规则前自问 | 这条防的是什么**已发生过**的错误？答不上来 = 多余 |

**规则 != 制约**：规则防的是已发生过的具体错误，不是想象中的风险。
如果一条规则阻止你解决真实问题 ⇒ 停，写 ADR 挑战它，由用户裁定。规则改起来和代码一样容易，才是健康的治理。

---

## 1. 文件所有权

| 位置 | 谁能改 |
|---|---|
| `AGENTS.md` / `gov.toml` / `.spec/00-constitution.md` | 仅用户确认后 |
| `.spec/**` | 先改文档再改代码 |
| `.spec/REGISTRY.md` | 新增标识符时同步登记（唯一事实源） |
| `.spec/tasks/index.md` | 改状态；卡详情改各自的 `card.md` |
| `{{SRC_DIR}}/**` | 按任务卡范围 |
| `.memory/log/**` | 只追加 |
| `.memory/MEMORY.md` | 只在新增跨会话规则或覆盖 §0 时改 |
| `.memory/PITFALLS.md` | 只增不改结论 |

---

## 2. 文档地图

| 位置 | 内容 |
|---|---|
| `.spec/00-constitution.md` | 红线（不可协商的技术约束） |
| `.spec/01-architecture.md` | 架构、目录职责、数据位置 |
| `.spec/02-conventions.md` | 跨语言命名、提交信息、文案纪律 |
| `.spec/stacks/<stack>.md` | 当前项目技术栈专属约定（按任务按需读取） |
| `.spec/03-delivery.md` | 构建、打包、产物路径、发布检查 |
| `.spec/roadmap/INDEX.md` | 里程碑**索引**（≤4KB，只读这个） |
| `.spec/roadmap/<ID>/milestone.md` | 单个里程碑详情（只在做它时读） |
| `.spec/REGISTRY.md` | **标识符唯一登记处** |
| `.spec/tasks/index.md` | 任务卡**索引 + 唯一状态源**（≤8KB） |
| `.spec/tasks/<ID>/card.md` | 单张卡：背景/范围/验收（≤4KB） |
| `.spec/tasks/<ID>/log.md` | 单张卡执行流水（只追加，追溯用） |
| `.spec/tasks/archive/W<n>/` | 已完成波次的完整任务卡归档（**默认不读**） |
| `.spec/adr/` | 架构决策记录（推翻既有设计时必写） |
| `.memory/MEMORY.md` | 跨会话记忆（随 git 走） |
| `.memory/PITFALLS.md` | 已踩过的坑（只增不改结论） |
| `.memory/log/` | 每日收口日志 |

---

## 2.5 计划与待办（唯一家）

Agent 最容易干的事：在根目录建 `TODO.md`、`PLAN.md`、`ROADMAP.md`、`NEXT_STEPS.md`、`progress.md`，
然后下次没人知道哪个是最新的。**这些文件一律禁止出现在根目录**，由治理检查拦截。

计划分三层，各有唯一的家：

| 时间尺度 | 放哪 | 怎么读 |
|---|---|---|
| 一次任务内的多步执行 | 不落盘；要落就 `.tmp/<任务ID>/plan.md`，做完即删 | 随用随建 |
| 几天的具体动作 | `.spec/tasks/<ID>/`：`card.md`（背景/范围/验收）+ `log.md`（流水） | 先读 `index.md`，再读命中的那张 |
| 几周~几个月 | `.spec/roadmap/<ID>/milestone.md` | 先读 `roadmap/INDEX.md`，再读命中的那个 |

**判定口诀**：这件事明天还在吗？
不在 ⇒ `.tmp/`；在但几天能做完 ⇒ 卡；要拆成好几张卡 ⇒ 里程碑。

**根目录禁止出现**（出现即违规）：
`TODO.md` `PLAN.md` `ROADMAP.md` `NEXT.md` `NEXT_STEPS.md` `PROGRESS.md` `NOTES.md` `BACKLOG.md` `TASKS.md` `CHECKLIST.md`

**为什么按目录而不是一个大文件**：一张卡一个目录，读一张卡只花一份 token；
写在同一个文件里，200 张卡就是 200 倍的读取成本，而且改一次要重读全文。

---

## 2.6 分级读取（省 token 的硬规则）

> 规范的目的不只是"整齐"，还包括**防止 AI 无意义地吞上下文**。
> 中大型项目里，乱读一次就可能烧掉半个上下文窗口，然后真正该看的东西被挤掉。

### 分级

| 级 | 内容 | 预算 | 什么时候读 |
|---|---|---|---|
| **L0 每次会话必读** | `AGENTS.md` + `.memory/MEMORY.md` §0 | ≤ 16KB | 开工时，只读一次 |
| **L1 按需索引** | `.spec/tasks/index.md`、`.spec/roadmap/INDEX.md` | 各 ≤ 8KB / 4KB | 需要知道"现在有什么"时 |
| **L2 单点详情** | 命中的 `card.md` / `milestone.md` | 每个 ≤ 4KB | 只读你正在做的那一个 |
| **L3 归档** | `.spec/tasks/archive/`、`.spec/roadmap/archive/`、`.memory/archive/` | 不设限 | **默认不读**，只在追溯历史时按需查 |

### 硬规则

1. **先索引，后详情**。禁止"把整个目录 cat 一遍再挑"——那是 L1 变 L3。
2. **禁止读归档**。归档是给追溯用的，不是给开工用的。
3. **一次只读一张卡**。做 T7 就不要读 T1 的 `log.md`。
4. **索引超预算就归档**。`index.md` 超 8KB ⇒ 把已完成波次的完整任务目录移到 `archive/W<n>/`，在索引与归档索引中留指针。
5. **别重复读同一个文件**。读过就记住，需要引用时写路径，不要为了"确认一下"再读一遍。
6. **结论进文档，过程进 `.tmp/`**。探针输出、大段日志不要写进 `log.md`，只写结论与数字。

### 索引为什么必须小

索引是**唯一每次都要读的东西**，所以它的体积直接决定每次会话的固定成本。
一张卡一行（约 50 字节），200 张卡约 10KB——已经接近上限，所以：
**完成的波次必须归档**，索引只保留"当前波次 + 历史一行指针"。

---

## 3. 临时产物（脚本/探针/一次性数据）

| 规则 | 说明 |
|---|---|
| **统一落 `.tmp/`** | 只准放 `.tmp/<任务ID>/`，**禁止**项目根、系统 temp、桌面、下载目录 |
| 按任务建子目录 | `.tmp/<card-id>/`——能追溯到哪件事产生的 |
| 用完即删 | 探针跑完、bug 修完 ⇒ 删掉整个子目录 |
| 超过 7 天定期清 | 收口时顺手看一眼，7 天没动过的删掉 |
| 禁止进 git | `.gitignore` 已排除 `.tmp/` |
| 禁止放系统目录 | 换机器就丢，且污染宿主 |

**判定口诀**：这个文件如果明天删掉，项目还能不能构建？能 ⇒ 它属于 `.tmp/`。

---

## 4. 目录白名单（机器可测）

`npm run gov`（或 `node scripts/check-governance.cjs`）会检查根目录。允许的项见 `gov.toml [dirs]`：

```
目录：{{ALLOWED_DIRS}}
文件：{{ALLOWED_FILES}}
```

新增根级目录/文件 ⇒ 先改 `gov.toml [dirs]`，再跑检查确认通过。

---

## 5. 快速命令

```bash
{{COMMANDS}}

# 治理检查
node scripts/check-governance.cjs

# 一次性启用提交闸门（每个新克隆都要执行）
git config core.hooksPath .githooks
```

**pre-commit 钩子**会跑治理检查，不通过直接拦下。确属误判时改 `gov.toml [dirs]`，不要用 `--no-verify` 绕。

**通用 Hook 与项目检查分离**：项目专属检查写入 `.githooks/pre-commit.local`，不要直接修改通用 `pre-commit`。
模板不知道你项目的类型检查 / lint / 测试命令，所以 `pre-commit` 默认只跑治理检查。
铺完之后复制 `.githooks/pre-commit.local.example` 为 `.githooks/pre-commit.local`，启用本项目检查：

```sh
cp .githooks/pre-commit.local.example .githooks/pre-commit.local
# 编辑 pre-commit.local，取消注释并替换成项目真实命令
```

**模板不会声称项目测试已通过**：未配置的项目检查不会被假装执行。每个项目应在钩子或 CI 中明确配置构建、lint、类型检查和测试命令。
