# 会话交接：Agent 项目开发规范 2.0

更新时间：2026-11-10

## 项目目标与边界

- 仓库：`broadteam/agent-develop-project-standards`。
- 目标：建立跨 Agent、跨项目可复用的工程治理模板；规则、项目事实和验证结果各有唯一权威来源。
- 不把真实 SaaS 项目当作 2.0 的验收试点；只通过可重复的临时 fixture 验证。
- 不合并 PR、不修改 `main`，除非用户另行明确授权。
- 不以文档表述替代可执行验证；未运行或未覆盖的结论必须标记 `unverified`。

## 当前 Git 状态

- 工作分支：`feat/standards-v2.0-seven-pillars`，跟踪 `origin/feat/standards-v2.0-seven-pillars`。
- 2.0 范围与验收标准的唯一权威：`SPEC-v2.0.md`；七大方向状态见其 §5。
- 版本事实源：`template/policy/standards-version.json` = `2.0.0-rc.15`。
- 相关 PR：#2（Draft，不要合并）。
- **CI 状态必须按 commit SHA 现场查询**，不要引用本文件里的历史结论（见 `.memory/PITFALLS.md` P14）。

## 本轮完成（2026-11-10）

起因：本地把 v2 分支快进到 origin 后跑测试，`test-parity` 与 `test-capability-resolver` 在 Windows 上必挂。

**先纠正一个容易误判的点**：这两个测试在 CI 的 Windows 任务上一直是绿的，所以不能说是"CI 撒谎"。CI 的 checkout 不启用 `core.autocrlf`，工作区是 LF；Windows 开发机默认 `true`，工作区是 CRLF。**CI 只覆盖了 LF 世界，恰好绕开了缺陷**——这类"绿得毫无意义"的通过比红灯更危险，因为它让缺陷活了六轮。详见 `.memory/PITFALLS.md` P14。

### 修复

| 缺陷 | 根因 | 处理 |
|---|---|---|
| Node/Python 输出不等 | Windows 文本模式 stdout 把 `\n` 翻成 `\r\n`，Node 不翻，断言比原始字节 | Python 检查器把 stdout/stderr 固定为 UTF-8 + LF |
| 字节预算跨平台不等价 | 预算读磁盘原始字节；同一 `AGENTS.md` LF 11814B / CRLF 12029B（预算 12288B → 96% vs 98%） | 按 LF 归一化后计字节，Node 与 Python 同口径 |
| BOARD 跨平台误判过期 | 源哈希与生成哈希对原始字节取 SHA；Windows 生成的看板在 Linux 必判过期 | 两侧哈希都归一化，`generate-board` 写入也统一 LF |
| parity 夹具清单非法 | 字面量写成 4 个字符而非合法 JSON；只查存在性所以没暴露 | 改为合法的空对象加换行 |

### 新增闸门（都对应已发生过的错误，不是假想风险）

- `test-parity`：CRLF 检出的预算字节必须与 LF 一致；CRLF 的 `BOARD.md` 仍须通过校验。
- `test-doc-links`：README 目录树必须解析得到真实路径。此前已漂移——漏了 5 个根文档、7 个测试、4 个模板脚本。
- `test-init`：模板里每个 `{{KEY}}` 都必须是 init 认识的键。`fill()` 会把未知键降级成可见的 `（待填：KEY）` 而不是报错，等于把半填好的文件发给用户。
- `test-migration-v2`：空项目**真实首次安装**后治理检查必须直接通过。此前只覆盖 `--dry-run`，而那正是用户最常见的第一条路径。

### 顺带修正

- 升级计划/审批测试改为从真实版本号推导目标版本，升版本不再需要改测试（实测把版本临时改成 rc.16，5 个升级测试全过）。
- 运行时下限从 Node 18 / Python 3.10 抬到 **Node 22 / Python 3.11**，并写进 `policy/standards-version.json`。原下限既已过维护期，又从未被 CI 跑过——"支持"当时只是未经验证的承诺。CI 矩阵改为 Node 22/24 × Python 3.11/3.13 × Ubuntu/Windows，共 8 个任务，下限与最新都在覆盖内。
- README 目录树按实际仓库重写；`gov.toml [budget]` 补上计量口径说明；`PITFALLS` 新增 P13（换行符使预算与哈希跨平台不等价）、P14（"CI 全绿"不能跨会话转述）。

## 七大方向状态

`SPEC-v2.0.md` §5 现在是**可判定**的：6 个 `done`、1 个 `partial`（第七方向），每行都给出机器验证入口与已知限制。发布门槛 §3 的 8 项中 7 项已勾选。

第七方向保持 `partial` 是刻意取舍：计划、审批、登记、漂移、恢复演练都可重复，但"人工应用 → 校验 → 推进基线"仍需维护者手工执行。按 §4 的边界，在真实升级成本有实证前不做自动应用器。

## 本机验证结果（2026-11-10）

环境：Windows 11，Node v22.22.2，Python 3.13.14，`core.autocrlf=true`。

- 语法检查：19 个 `.cjs` / `.py` 全部通过。
- 回归测试：**14 / 14 通过**（含 4 组模板升级测试、parity、init、migration、doc-links）。
- 本轮提交：见 `git log --oneline 0aa0043..HEAD`（修复、交接重写、`keep_or_archive` 回归、运行时下限、P14 修正）。

### CI 验证记录（按 commit 绑定）

| commit | 事件 | 结果 |
|---|---|---|
| `984e697` | push + pull_request | **8 / 8 任务全绿**（Ubuntu / Windows × Node 22/24 × Python 3.11/3.13） |
| `4c73d4f` | push + pull_request | **8 / 8 任务全绿** |

后续提交若只改文档，仍应按该 commit 的 checks 复核；若改了代码，必须重新跑完整矩阵，不能沿用上表结论。

## 已知限制（不得越界声称）

- 未启动任何真实客户端 CLI（Codex / Claude Code / Gemini / Cursor），客户端兼容性只到入口与导入契约层面。
- 自动升级应用器、自动回滚器、真实跨版本项目迁移均未实现；不得把预览、审批或基线登记描述成自动迁移完成。
- 初始化的事务边界只覆盖可捕获的运行时异常；进程被强杀或断电不在保证内。
- 锚点链接（`#标题`）未纳入文档校验，因为当前仓库未使用该形式。
- 跨客户端的记忆恢复效果未独立验证。

## 下一步

1. **修正 PR #2 的目标分支**。PR #2 现在指向 `docs/low-friction-agent-protocol-v1.2.0`，不是 `main`；照此合并会把 2.0 内容并进 v1.2.0 文档分支，`main` 永远拿不到。需在 GitHub 上把 base 改成 `main`（或在确认是有意堆叠后记录原因）。
2. 复核本次推送后 8 个 CI 任务的结果；绿了才把发布门槛第 7 项勾上，未复核前保持未勾选。
3. 复核第七方向剩余项：managed block 与 `defer` 的长期漂移行为已有回归；`keep_or_archive` 本轮补齐。仍需观察真实项目规模下的表现。
4. 若要推进第七方向到 `done`，先按 `UPGRADE-RECORD-TEMPLATE.md` 完成一次真实跨版本升级的人工记录。
5. 门槛全绿后再决定是否把 `2.0.0-rc.15` 标记为 `2.0.0`。

## 恢复工作的方法

新会话先读本文件、`SPEC-v2.0.md` §5、`git status --short --branch`，然后跑 `node tests/*.cjs`（Windows 上需 `PYTHONUTF8=1`）。不要把旧聊天摘要当作仓库事实；遇到客户端行为变更，先核对该客户端官方文档，再改兼容性说明和契约测试。
