# 部署到项目

> 面向两种人：想把规范铺到自己项目里的**你**，和替你执行的 **AI**。
> 本文只讲「怎么装、会动什么、怎么退」，规范本身怎么用见 `AGENTS.md`。

---

## 1. 一句话部署（直接说给 AI）

```
把 D:/develop/project-standards 的规范铺到 <目标目录>：
先 --dry-run 把差异给我看，我确认后再正式执行，装完跑一次治理检查并把结果贴给我。
```

AI 展开后就是三条命令，没有别的步骤：

```bash
node D:/develop/project-standards/init.cjs <目标目录> --dry-run   # 只看，不写盘
node D:/develop/project-standards/init.cjs <目标目录>             # 正式铺
node <目标目录>/.standards/check-governance.cjs                      # 验收：应输出「全部通过」
```

不需要先建目录、不需要改 package.json、不需要装依赖。`init.cjs` 零依赖，Node 22+ 直接跑。

**为什么先 dry-run**：它会打印「新建 / 覆盖 / 跳过 / 保护 / 导入」五类清单。你只需要看其中两类：
`覆盖` 应该是空的（有内容说明会动你已有文件）；仅在启用 `task_tracking` 时，`导入` 清单才会列出准备搬走的根目录计划文件。

### AI 遇到这些情况必须先问你，不许自己决定

把下面这段一起丢给 AI，它就不会自作主张：

```
铺之前如果遇到以下情况，停下来把选项列给我，不要自己选：
1. dry-run 的「覆盖」不是空的 —— 说明会动我已有的文件
2. 出现「同名文件从未被管理过」的警告 —— 可能是我的脚本，也可能是残留
3. 启用 `task_tracking` 且根目录有计划文件要导入，但我已经有 `.spec/tasks/T1` —— 导进去会冲突
4. 检测到多技术栈 —— 默认只按主栈生成，选错了规则就不对
5. 装完治理检查不通过 —— 把违规项和我的原始状态一起给我，不要自己改我的文件
```

这条比命令本身重要：**部署是可以回滚的，但"AI 顺手帮我改了两行代码"不能。**

---

## 2. 它会动什么，不会动什么

| 对象 | 行为 |
|---|---|
| 40 个规范文件（`AGENTS.md`、`.spec/`、`.memory/`、`scripts/` 等） | **只创建不存在的**。已存在一律跳过，不覆盖 |
| 你已有的 `.githooks/pre-commit` | **零改动**。它只会在旁边放一个 `pre-commit.local.example` 作参考 |
| `.gitignore` | 追加一个带 `# >>> agent-project-standards (managed)` 标记的区块；**区块外的规则原样保留** |
| 根目录的 `TODO.md` / `PLAN.md` / `NOTES.md` / `BACKLOG.md` 等 | 启用 `task_tracking` 时默认导入到 `.spec/tasks/T1/imported/`；关闭时保留现有计划入口，不导入模板任务卡 |
| `gov.toml` 的根目录白名单 | 按当前根目录自动生成，**保证装完就能通过检查**，不会一上来就报你违规 |
| 业务代码 / 依赖 / 构建配置 / 现有测试 | **完全不碰** |

### `scripts/` 会不会和项目自己的目录打架

治理脚本装在 `scripts/` 下（`check-governance.cjs`、`generate-board.cjs` 等）。三种情况：

| 情况 | 行为 |
|---|---|
| 项目没有 `scripts/` | 新建，无冲突 |
| 项目已有 `scripts/`，但文件名不重 | 治理脚本**加进去**，你的脚本原样不动。会混在同一个目录里，但不覆盖、不重命名 |
| 项目已有同名文件（如自己写了 `.standards/generate-board.cjs`） | **保留你的文件并明确告警**。这种情况治理检查跑的会是你的脚本——所以必须人工确认 |

如果你介意混在一起，可以改 `gov.toml [paths]` 把脚本挪到子目录——但模板里所有引用都是硬编码的 `scripts/`，改起来要连带改钩子和文档。**建议在接入大量项目之前决定**：要么接受混放（简单），要么在下一版统一改成 `scripts/agent-standards/`（干净，但对已铺的项目是破坏性变更）。

唯一的强制覆盖开关是 `--force`。它存在的意义是「重新渲染模板」，不是升级手段；日常别用。

### 会打断你的开发进程吗

不会。装完你照常写代码、照常提交。唯一的差别是：**提交前多了一道治理检查**——但它默认不会自动生效（见 §4）。

---

## 3. 根目录的计划文件为什么必须搬走

仅当 `task_tracking` 启用时，根目录的 `TODO.md` 和 `.spec/tasks/index.md` 才是两个竞争的任务入口；两份答案必然走样，所以启用任务跟踪时要求计划只有一个家。若关闭 `task_tracking`，初始化器保留项目已有的计划入口，不导入模板任务卡，也不执行模板根目录计划文件禁令。

对已经写了 `TODO.md` 的项目，只有三种处理方式：

| 方式 | 结果 |
|---|---|
| 报错让你自己搬 | 你要先读懂规范才知道往哪搬——多数人会直接放弃或回滚 |
| 加进白名单放行 | 等于第一天就破例，规范从此形同虚设 |
| **启用 `task_tracking` 时默认自动导入** | 原文完整搬进 `.spec/tasks/T1/imported/`，根目录清空，检查通过 |

启用 `task_tracking` 时，导入做的事：

1. 把原文**逐字节**复制到 `.spec/tasks/T1/imported/<原文件名>`，不改一个字
2. 生成一张任务卡 `.spec/tasks/T1/card.md`，指向原文，并列出「接下来要做的」
3. 从根目录移除原文件（在事务里，失败会回滚）
4. 在 `.spec/tasks/index.md` 登记 `T1`

启用 `task_tracking` 时，若不想自动搬运可加 `--no-import-plans`；此时根目录计划文件仍会被判违规，需自行迁移或整理。关闭 `task_tracking` 时则不会导入这些文件，也不会因它们留在根目录而阻断初始化。

---

## 4. 和你已有的规则冲突吗

三处可能重叠，处理方式各不相同：

| 已有规则 | 处理 |
|---|---|
| 你自己的 `.githooks/pre-commit`（build / lint / test） | 保护不动。想让治理检查也参与，**在你自己钩子的末尾加一行**：`node .standards/check-governance.cjs \|\| exit 1` |
| 你自己的 `.gitignore` 规则 | 原样保留，规范只追加托管区块 |
| 你自己的 `AGENTS.md` / `CLAUDE.md` | **跳过不覆盖**。这种情况规范不会接管你的规则，需要你手工把两套并起来 |
| 根目录已有 `docs/`、`scripts/`、`tests/` 等同名目录 | 兼容模式下自动进白名单，不会报冲突 |

**默认不会替你启用提交闸门。** `core.hooksPath` 要你自己设（`git config core.hooksPath .githooks`）。这是刻意的：闸门没跑，你只是没享受到保护；闸门跑错，你会被误拦而放弃整套东西。先让它跑通，再上闸门。

### 关掉某个能力，入口文件会跟着变

`project-profile.toml [capabilities]` 里设成 `off` 的能力（比如 `task_tracking`、`roadmap`），`AGENTS.md` 里对应段落会在**安装时**被替换成两样东西：

1. 顶部一句横幅，列清哪些能力已关闭、下文哪些引用不适用
2. §2.5 里一个待填槽位，让你写清本项目的替代做法

不会出现「入口文件教你用 `.spec/tasks/`，而那个目录根本没装」这种自相矛盾。

**但改能力要在安装前定好。** 装完之后再改 `project-profile.toml`，`init` 不会重写已存在的 `AGENTS.md`（它默认跳过已存在文件），需要你手工改那两处，或者用 `--force` 重写（会连带覆盖其它模板文件，先确认没有定制）。

这条对「已经有自己的待办体系」的项目特别有用：关掉 `task_tracking` 与 `roadmap`，保留你自己的 roadmap 文档，入口文件就不会再提 `.spec/tasks/`。

---

## 5. 装完的三件事

1. **填 `.memory/MEMORY.md` 的 §0 断点**——换会话时 AI 靠这四行恢复上下文
2. **确认 `.spec/03-delivery.md` 的构建/测试命令**——模板不知道你的项目怎么跑
3. **把治理检查接进你的钩子或 CI**（见 §4）
4. **如果你的客户端有自己的项目记忆目录**，在 `gov.toml [memory] mirrors` 里声明它，再跑 `node .standards/sync-memory.cjs`。否则那个目录和 `.memory/` 会各说各话，换客户端就"失忆"。详见 `CLIENTS.md` §3

`project-profile.toml` 的 `status` 是 `needs_review`，意思是「技术栈是探测出来的，别当成事实」。确认后再改成 `confirmed`。

---

## 6. 怎么退

```bash
cd <目标目录>
git checkout -- .gitignore        # 还原 .gitignore
git clean -fd                     # 删除新增的未跟踪文件
```

`git clean -fd` **不会删被 .gitignore 忽略的文件**（`node_modules/`、`dist/`、`.env` 之类都安全）。执行前先跑 `git status --short` 确认未跟踪项只有规范文件。

如果导入过计划文件，原文在 `.spec/tasks/T1/imported/`，退之前先拷回去。

---

## 7. 怎么升级

**先回答「我怎么知道项目用的是哪一版」**：每个铺过规范的项目根目录都有 `.agent-standards.json`，里面记着：

| 字段 | 含义 |
|---|---|
| `installed_with_version` | 项目当前整体采用的规范版本；只有所有受管路径都收口后才推进 |
| `managed_files.<路径>.template_version` | 单个受管文件来自哪个模板版本 |
| `managed_files.<路径>.installed_sha256` | 最近一次登记的项目文件哈希，用于识别后续本地修改 |
| `derived_paths` | 由脚本生成、不归模板管的文件（如 `BOARD.md`） |

先查看差异：

```bash
node <规范仓库>/tools/check-template-drift.cjs --root <目标项目>
```

它会区分上游更新、本地定制、双向冲突、文件缺失、上游移除和旧项目基线未知。**不要先用 `--force`，也不要手工改 `.agent-standards.json`。**

### 两种升级方式

#### A. 快速安全刷新：`init.cjs --update`

适用于：只想刷新模板中**项目文件仍与上次安装哈希完全一致**的部分，不需要逐路径审批记录。

```bash
node <规范仓库>/init.cjs <目标项目> --update
node <目标项目>/.standards/check-governance.cjs
```

`--update` 只替换未被项目修改过的受管文件；本地改动、未知归属文件和冲突文件会保留并报告。只要仍有受管文件留在旧模板版本，`installed_with_version` 就不会前移。它不会生成 plan/review，也不会自动解决本地定制或双向冲突。

#### B. 审计式升级：计划 → 审批 → 手工应用 → 登记

适用于：跨版本正式升级、涉及本地定制/双向冲突/上游删除，或需要逐路径保存审核责任与结果证据的情况。这是有审计要求时的标准流程：

1. 在独立分支或 worktree 中操作，记录项目当前 commit、未提交改动，并在项目目录外创建可验证的完整备份。
2. 生成只读升级计划。将 JSON 输出保存为 `upgrade-plan.json`：

   ```bash
   node <规范仓库>/tools/plan-template-upgrade.cjs --root <目标项目> --standards-root <规范仓库> --json
   ```

   有待人工审查或阻断项时，命令会以非零状态结束；这不代表已经执行或修改了项目。必须检查 JSON 中的 `global_blockers` 和逐路径 `actions`，不能把退出码当作审批结论。
3. 为每个待审路径填写 `reviewer`、`reviewed_at`、`decision`、`reason` 和实际结果 `result_sha256`；普通文件还要填写 `result_mode`。双向冲突必须恢复共同基线并记录 `baseline_ref`、`merge_result_ref`。将审查结果保存为 `upgrade-review.json` 后运行：

   ```bash
   node <规范仓库>/tools/validate-template-upgrade-review.cjs --plan upgrade-plan.json --review upgrade-review.json --json
   ```

4. 只在备份副本/独立工作树中手工应用已批准的文件变更。不要把计划建议当作自动执行授权；任何文件或模板源变化后，都应重新生成计划并重新审查。
5. 应用并验证后，先预览基线登记：

   ```bash
   node <规范仓库>/tools/record-reviewed-template-upgrade.cjs --root <目标项目> --standards-root <规范仓库> --plan upgrade-plan.json --review upgrade-review.json --dry-run
   ```

   复核输出和备份后，才将同一命令的 `--dry-run` 替换为 `--confirm-reviewed`。**登记器只校验实际文件结果并更新 `.agent-standards.json`，不会应用、覆盖、删除或合并模板文件。**
6. 重新运行漂移检查、治理检查和项目自己的 lint、类型检查、测试与构建。未实际执行的项目验证必须记为 `unverified`。

明确延期的路径使用 `defer` 决策；登记器会确认它仍保持计划生成时的状态。只要还有延期路径，整体版本仍保持来源版本，之后必须重新生成计划处理剩余路径。

完整字段、恢复流程与归档要求见 [MIGRATION-v2.0.md](MIGRATION-v2.0.md) 和 [UPGRADE-RECORD-TEMPLATE.md](UPGRADE-RECORD-TEMPLATE.md)。

### 为什么不用 `--force`

`--force` 会把所有模板文件重写，包括项目定制的 `AGENTS.md`。它是「重新渲染模板」开关，不是升级机制；用它升级可能直接覆盖项目规则。升级时使用上面的安全刷新或审计式流程。

## 8. 谁在治理：人还是 AI

**现在是「AI 执行、人批准」。** 具体分工：

| 环节 | 谁做 |
|---|---|
| 探测技术栈、铺文件、生成白名单、导入计划文件 | AI（`init.cjs` 一条命令） |
| 决定要不要铺、要不要开提交闸门、确认项目画像 | 人 |
| 日常判断「这算轻量任务还是跟踪任务」、该读哪些规范 | AI（`AGENTS.md` §0.5 + `task-context-resolver.cjs`） |
| 判定架构取舍、推翻既有规则 | 人（启用 `adr` 时写 ADR；关闭时写入 `.spec/01-architecture.md` 或 PR 审查记录） |

AI 能一条命令铺完，但**不该由它自己决定「这个项目要不要被治理」**——那是你的决定。同样，闸门拦下你的时候，改规则必须由人裁定；启用 `adr` 时写 ADR，关闭时写入 `.spec/01-architecture.md` 或 PR 审查记录，不允许 AI 自己放行。

想让 AI 全自动，缺的不是命令，而是「授权边界」：哪些项目可以自动铺、铺完要不要自动开闸门、违规了能不能自动改代码。这三条目前都没定，所以保持人工确认。
