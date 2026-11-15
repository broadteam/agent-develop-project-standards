# 真实客户端冒烟测试

本测试用于验证客户端**实际启动后**是否加载了规则入口、记忆断点与嵌套目录规则，并能否在新会话中从仓库文件恢复状态。它与 `tests/test-client-adapters.cjs` 的契约测试不同：契约测试只检查模板文件和适配约定，不启动任何客户端。

## 1. 生成一次性项目

要求 Node.js 22+。选择一个**尚不存在**、且位于本规范仓库之外的临时目录：

```bash
node tools/client-smoke/create-fixture.cjs /tmp/agent-client-smoke
```

Windows PowerShell 示例：

```powershell
node tools/client-smoke/create-fixture.cjs "$env:TEMP\agent-client-smoke"
```

脚本调用仓库当前 `init.cjs` 生成项目，再加入三个随机探针：根规则标记、`.memory/MEMORY.md` 断点标记、嵌套规则标记。它还生成一个跨会话写入值。**终端输出中的期望值不要粘贴进 Agent 对话**，否则会污染测试。目标目录已存在时脚本拒绝运行，不会覆盖或清理既有目录；生成的项目必须通过自身的 `check-governance.cjs`。

## 2. 每个客户端都使用全新会话执行

把生成目录作为客户端的项目/工作区根目录打开。每个探针尽量使用独立的新会话，避免前一个会话已经读过的上下文造成假阳性。

### 根规则与记忆断点

在工作区根目录启动新会话，只发送下面的提示，不附带期望标记值：

```text
[CLIENT-SMOKE:ROOT]
请按项目开工协议恢复当前断点，然后只输出 ROOT_RULE 和 MEMORY_BREAKPOINT 两行。不要修改任何文件。
```

正确结果应精确匹配生成脚本在终端打印的两项值。检查客户端的上下文/文件读取记录，确认 `AGENTS.md` 和 `.memory/MEMORY.md` 确实被加载或读取；仅输出正确字符串但没有来源证据，不算通过。

### 嵌套目录规则

在另一个新会话中仍以同一项目为工作区，发送：

```text
[CLIENT-SMOKE:NESTED]
只读检查 nested/probe.md，不要修改文件。按项目规则只输出 ROOT_RULE、NESTED_RULE 和 MEMORY_BREAKPOINT 三行。
```

除根规则和记忆标记外，还必须精确返回嵌套标记。检查客户端的加载/读取记录，确认 `nested/AGENTS.md` 被应用。若厂商文档未承诺该客户端支持嵌套 AGENTS，记录为 `BLOCKED` 或 `NOT SUPPORTED`，不要把根级通过扩大解释为嵌套支持。

### 跨会话写入与恢复

从生成脚本的终端输出中复制 `CROSS_SESSION_CHECKPOINT=...`。在会话 A 中发送以下指令，并把占位符替换为终端给出的完整行：

```text
[CLIENT-SMOKE:WRITE]
请只把下面这一行追加到 .memory/MEMORY.md 的 §0 断点区，保留其他内容，不要修改其他文件：
CROSS_SESSION_CHECKPOINT=<粘贴终端打印的完整值>
```

确认会话 A 确实只修改了 `.memory/MEMORY.md`。关闭该会话，**新建一个完全独立的会话 B**，不要复制会话 A 的聊天内容或 checkpoint 值，只发送：

```text
[CLIENT-SMOKE:RESTORE]
从仓库当前的 .memory/MEMORY.md §0 恢复 CROSS_SESSION_CHECKPOINT，只输出该行，不要根据聊天历史推断。
```

会话 B 必须从文件读取并返回完全一致的值；检查其读取记录。若只在同一聊天中恢复，或客户端私有记忆里有值但仓库文件没有值，不算通过。

## 3. 客户端执行注意事项

| 客户端 | 本夹具中的入口 | 执行时特别核对 |
|---|---|---|
| Codex | 根/嵌套 `AGENTS.md` | 从项目根打开；嵌套探针必须针对 `nested/probe.md`，确认嵌套规则实际生效。 |
| Claude Code | `CLAUDE.md` → `@AGENTS.md` | 确认导入成功；记录实际 CLI 版本与项目信任/权限设置。 |
| Gemini CLI | `GEMINI.md` → `@./AGENTS.md` | 记录 `context.fileName` 等相关设置；不要假设未配置的 AGENTS 文件名自动发现。 |
| Cursor | 根/嵌套 `AGENTS.md` | 将生成目录作为 workspace 打开，并通过访问嵌套文件触发子目录规则。 |
| OpenCode V2 | 根/嵌套 `AGENTS.md` | 确认运行的是 V2 规则加载行为，不套用 V1 的 CLAUDE 回退假设。 |
| WorkBuddy | 项目配置与 AGENTS 兼容入口 | 官方文档未完整说明多入口优先级；必须检查实际上下文，未验证优先级就记录限制。 |
| CodeBuddy IDE | 根 `AGENTS.md` 条件回退 | 夹具刻意不创建 `CODEBUDDY.md`，以测试 AGENTS 回退；不要额外添加竞争入口。 |

CatPaw / ZCode 当前没有可确认的规则加载约定；除非另行查证，不将它们纳入支持结论。

## 4. 记录与通过标准

每个客户端分别记录：产品/客户端名称、完整版本号、操作系统、启动方式、工作区根路径、相关用户/项目设置、探针状态、证据文件位置和未解决限制。建议复制以下表格到本地测试记录：

| 客户端 / 版本 | 根规则+记忆 | 嵌套规则 | 新会话恢复 | 证据位置 / 限制 |
|---|---|---|---|---|
|  | NOT RUN | NOT RUN | NOT RUN |  |

状态只允许使用：`PASS`、`FAIL`、`BLOCKED`、`NOT RUN`、`NOT SUPPORTED`。完整端到端 `PASS` 必须同时满足：

1. 三个探针的返回值均与终端期望值精确一致。
2. 上下文视图、文件读取记录或等价的客户端证据能证明对应文件确实被加载/读取；单凭模型返回值不够。
3. 会话 A 只改了 `.memory/MEMORY.md`，会话 B 是全新会话，并且从该文件恢复 checkpoint。
4. 记录了客户端版本与必要配置；未验证的嵌套语义不得标为通过。

本仓库 CI 只运行夹具生成器和安全/结构回归，不安装或启动 Codex、Claude Code、Gemini CLI、Cursor、OpenCode、WorkBuddy 或 CodeBuddy。**在真实客户端逐一完成上述步骤前，CLIENTS.md 的真实 CLI/IDE 端到端状态仍然是未验证。**

## 5. 清理

所有客户端测试完成并保存证据后，删除整个一次性夹具目录。不要把随机标记、测试 checkpoint 或客户端会话日志合并进真实项目的治理文件。
