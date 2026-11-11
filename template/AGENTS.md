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
3. **单一规则入口 + 分域事实源**。规则入口看本文件；`.memory/MEMORY.md` 只保存跨会话断点与稳定项目事实，不是所有领域状态的总账。
   意图、需求、验证分别以 `.spec/intent/`、`.spec/requirements/INDEX.md`、`.spec/verification/INDEX.md` 为始终有效的权威源；任务、路线图、ADR 仅在对应能力启用时使用各自索引/目录。
   <!--cap:roadmap-->
   启用 `roadmap` 时里程碑状态以 `.spec/roadmap/INDEX.md` 为准。
   <!--/cap-->
   关闭可选能力不删除历史记录，也不要求新建对应记录。客户端私有 memory 只能作缓存，不得成为任何领域事实的权威来源。
4. **一次改动一次提交**。提交信息写清"动了什么 + 为什么"。

---

## 0.2 操作权限

操作权限按 `.spec/00-constitution.md`「Agent 操作权限」执行。启用 `task_tracking` 时任务卡只授权代码范围；关闭时以用户当次指令为范围。二者都不自动授权不可逆、外部可见或影响用户数据的操作。

## 0.3 冲突裁决顺序

| 级 | 权威文件 | 回答 |
|---|---|---|
| 1 | 本文件 §0 四条 + 用户当次指令 | 什么绝对不能做 |
| 2 | `.spec/00-constitution.md` 红线 | 宪法级约束 |
| 3 | `.spec/01-architecture.md`；启用 `adr` 时参考 `.spec/adr/` | 应该怎么实现 |
| 4 | `.spec/02-conventions.md` | 命名/代码/提交 |
| 5 | 启用 `task_tracking` 时，以任务卡 scope 为修改范围；未启用时以用户当次授权为准 | 这一次允许改什么 |
| 6 | 你自己的默认习惯 | 上面都没规定时 |

- 1~3 级矛盾 ⇒ **停下问用户**，不要自行裁决。
- **同一事实只准有一个家**（`.spec/REGISTRY.md`），别处只放指针。

---

## 0.5 会话协议（按任务分级）

**每次会话的最小开工动作**：
1. 读取本文件。
2. 读取 `.memory/MEMORY.md` 的 §0 断点。
3. 仅在判断能力、技术栈或验证命令时读取画像相关字段；`needs_review` 候选不可当作已确认事实。
4. 判断本次工作属于「轻量任务」还是「跟踪任务」，再按下表读取额外材料。

只读当前任务所需材料；已读文件无需重复读取。

### 任务分级

| 类型 | 判定 | 工作方式 |
|---|---|---|
| **轻量任务** | 单点、局部、验收明确；不改变架构、模块边界、数据结构、对外契约、权限或依赖 | 用户当次指令就是范围；无需为了形式创建任务卡。完成相关验证即可 |
| **跟踪任务** | 跨模块/文件、跨会话、需求/验收不确定，或涉及架构、数据迁移、公共契约、安全边界、依赖变更 | 启用 `task_tracking` 时先读索引与任务卡；关闭时按用户明确范围推进，不创建模板任务记录 |
| **高风险操作** | 生产数据/环境、部署、外部可见操作、批量删除、Git 历史改写等 | 无论任务大小，按宪法权限表先取得明确授权 |

按**影响与不确定性**分级；范围或风险上升时立即升级为跟踪任务。

### 开工时按需读取

| 材料 | 读取时机 |
|---|---|
| `.spec/00-constitution.md` | 涉及权限、数据、安全、架构红线或高风险操作时；不要求每个轻量任务重复通读 |
<!--cap:task_tracking-->
| `.spec/tasks/index.md` + 对应 `card.md` | 跟踪任务；轻量任务无需强制建卡 |
<!--/cap-->
| `.spec/intent/BASELINE.md` + `CHANGES.md` | 跟踪任务、跨会话恢复、需求/计划变更或阶段回顾时 |
| `.spec/requirements/INDEX.md` | 跟踪任务必读；核对 R ID / 需求状态时读取 |
| `.spec/verification/INDEX.md` | 有 V 引用、验收收口或核对 verified 状态时读取 |
<!--cap:roadmap-->
| `.spec/roadmap/INDEX.md` + 里程碑详情 | 任务属于某个里程碑，或需要调整阶段计划时 |
<!--/cap-->
| `.memory/PITFALLS.md` | 当前问题涉及其中某个领域，或正在排查已知故障模式时；按主题定位，不要求每次通读 |
<!--cap:stack_rules-->
| `.spec/stacks/<stack>.md` | 启用 `stack_rules` 且本次任务涉及该技术栈时 |
<!--/cap-->
<!--cap:adr-->
| `.spec/adr/` | 需要理解或挑战相关架构决策时；只读相关 ADR |
<!--/cap-->
| `git log` / `git show` | 断点引用了提交、排查回归/历史行为、或当前实现意图不清时；不是每次会话的固定步骤 |

<!--cap:multi_agent-->
### 多 Agent 协作（仅启用时）

- 协作前声明工作区/分支、负责范围和写入文件集；共享文件避免并行写。
- 需求/验证索引与 MEMORY 采用单写者；启用 `task_tracking` 时任务索引/卡片、启用 `roadmap` 时里程碑索引、启用 `adr` 时 ADR 也采用单写者。冲突时排队交接，禁止最后写入覆盖。
- 写入前刷新最新 Commit 和文件；基线变化先重审。交接说明 Commit、未提交工作和验证状态；未验证不得标记 done。
<!--/cap-->

**收口要求**：
- 启用 `task_tracking` 时，跟踪任务按卡片完成开工/收口意图对齐；`unresolved_drift` 不得 done。
- 启用 `roadmap` 时，已完成里程碑必须完成意图对齐回顾，不得带未解决漂移关闭。
- 意图对齐是对应跟踪记录的校验约束，不是独立的全局开关；关闭任务跟踪/路线图时，不扫描其保留的历史记录。
- 轻量任务：只有产生了后续会话必须知道的事实、决策或未完成事项时，才更新记忆/日志；不要为了留痕重复抄写代码 diff。
- 目标/范围变化→`CHANGES.md`；需求状态→`requirements/INDEX.md`；验证证据→`verification/INDEX.md`；任务/里程碑/ADR 仅在对应能力启用时写入各自权威源。不要双写。
- 可复现的判据级教训进入 `.memory/PITFALLS.md`。
- 客户端私有记忆只作缓存；项目事实写回仓库权威源，开工只恢复 `.memory/MEMORY.md` §0。
- 任何验证都如实记录：未执行标记 `unverified`，不得写成通过。

**规则阻碍真实工作时**不得绕过检查；说明冲突并请求用户裁定。启用 `adr` 时记入 ADR，关闭时写入 `.spec/01-architecture.md` 或 PR 审查记录。普通流程规则可提最小修订。

---

## 1. 文件所有权

| 位置 | 谁能改 |
|---|---|
| `AGENTS.md` / `gov.toml` / `.spec/00-constitution.md` | 仅用户确认后 |
| `.spec/**` | 先改文档再改代码 |
| `.spec/REGISTRY.md` | 新增标识符时同步登记（唯一事实源） |
<!--cap:task_tracking-->
| `.spec/tasks/index.md` | 改状态；卡详情改各自的 `card.md` |
<!--/cap-->
| `{{SRC_DIR}}/**` | 启用 `task_tracking` 时按任务卡范围；关闭时按用户当次授权 |
| `.memory/log/**` | 只追加 |
| `.memory/MEMORY.md` | 只更新稳定事实/决策指针或覆盖 §0；领域状态写回各自权威文件 |
| `.memory/PITFALLS.md` | 只增不改结论 |

---

## 2. 文档路由

按任务定位权威文件使用 `ROUTER.md`；文件预算见 `gov.toml [budget]`。不要在本文件复制目录清单。

---

## 2.5 计划与待办（唯一家）

<!--cap-note:task_tracking-->
> **本项目已关闭 `task_tracking`。** 把本项目的待办放在哪写在这里：填写既有文件或系统入口；不要改用未启用的模板任务目录。
<!--/cap-note-->

<!--cap-note:roadmap-->
> **本项目已关闭 `roadmap`。** 把阶段计划放在哪写在这里：填写既有规划入口；不要改用未启用的模板里程碑目录。
<!--/cap-note-->

一次任务内的多步执行不落盘；确需临时记录时放在 `.tmp/<任务ID>/plan.md`，任务结束后清理。

<!--cap:task_tracking-->
几天内的持续工作使用 `.spec/tasks/<ID>/`：`card.md`（背景/范围/验收）+ `log.md`（流水）；先读 `index.md`，再读命中的任务卡。
<!--/cap-->

<!--cap:roadmap-->
几周至几个月、需要多个任务协同的阶段计划使用 `.spec/roadmap/<ID>/milestone.md`；先读 `roadmap/INDEX.md`，再读命中的里程碑。
<!--/cap-->

<!--cap:task_tracking-->
根目录禁止散落 `TODO.md` / `PLAN.md` / `PROGRESS.md`；使用 `.spec/tasks/` 作为唯一任务入口。完整清单由 `gov.toml [forbid]` 和治理检查执行。
<!--/cap-->

---

## 2.6 分级读取

- **L0**：`AGENTS.md` + `.memory/MEMORY.md` §0，每次会话读取。
- **L1**：相关需求/验证索引；任务/里程碑索引仅在对应能力启用且本次需要时读取。
- **L2**：命中的任务卡、里程碑、ADR、技术栈或需求详情；只读相关条目。
- **L3**：归档、历史日志和旧方案；默认不读，仅在追溯时读取。

先按问题定位索引，再读详情；信息不足时扩展读取。不要为省 Token 猜测，也不要删除影响正确性/安全的事实。

## 3. 临时产物

临时脚本、探针和一次性数据统一放 `.tmp/<任务ID>/`，不放根目录、系统临时目录或用户目录；验证后立即删除，最迟 7 天清理，不得入 Git（`.gitignore` 已排除 `.tmp/`）。
**判定**：明天删除仍可构建的文件才是临时产物。

## 4. 目录白名单（机器可测）

`node .standards/check-governance.cjs` 检查根目录。允许的目录与文件以 `gov.toml [dirs]` 为**唯一来源**，本文件不重复列举——重复的清单会随每次重跑变长，且两处必然走样。

新增根级目录/文件 ⇒ 先改 `gov.toml [dirs]`，再跑检查确认通过。

---

## 5. 快速命令

```bash
{{COMMANDS}}

# 治理检查
node .standards/check-governance.cjs

# 一次性启用提交闸门（每个新克隆都要执行）
git config core.hooksPath .githooks
```

**提交闸门**：`pre-commit` 执行通用治理检查；项目专属 lint、类型检查和测试配置在 `.githooks/pre-commit.local`，模板见 `.githooks/pre-commit.local.example`。未配置的检查不视为通过。完整铺设说明见仓库 README / DEPLOY 文档。
