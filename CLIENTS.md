# 客户端适配

> 一套规则正文，多个客户端入口。本文件只回答「哪个客户端怎么进来、验证到什么程度」。
> 规则正文永远是 `AGENTS.md`；适配文件只做指针，不写第二套规范。

## 1. 现状矩阵

> **官方文档核对日期：2026-11-15。** 文档核对只证明厂商公开声明了某种入口或加载行为，不代表本仓库已启动该客户端验证。

| 客户端 | 项目入口 | 加载行为与边界 | 用户/项目级配置 | 模板行为 | 验证程度 |
|---|---|---|---|---|---|
| Codex | `AGENTS.md` | 从项目根到当前工作目录逐层加载；每层优先使用 `AGENTS.override.md` 替代普通 `AGENTS.md`，不是追加 | 用户级配置在 `~/.codex/` | 根级原生读取；模板不生成 override | 契约测试 + 官方文档 |
| Claude Code | `CLAUDE.md` → `@AGENTS.md` | 导入递归最多四跳。v2.1.277+ 可直接读取 `AGENTS.md`；但默认若工作目录或其上方存在 `CLAUDE.md` / `CLAUDE.local.md`，则走 Claude 文件入口。模板保留导入指针以兼容旧版本和仅支持 CLAUDE 的会话 | 用户级 `~/.claude/`；项目级 `.claude/` | ✅ 生成一行导入指针 | 契约测试 + 官方文档 |
| Gemini CLI | `GEMINI.md` → `@./AGENTS.md` | 默认发现 `GEMINI.md`；可用 `context.fileName` 配置一个或多个文件名（例如同时包含 `AGENTS.md`）。支持 `@file` 导入、祖先上下文与按需子目录发现 | 用户级 `~/.gemini/`；行为由 settings 配置 | ✅ 生成一行导入指针 | 契约测试 + 官方文档 |
| Cursor | `AGENTS.md` | 根目录及子目录均支持；嵌套规则随 Agent 在相应目录工作而应用，父级与更具体目录规则组合 | `.cursor/rules/` 是共享项目配置，应入库 | 原生读取；不生成已弃用的 `.cursorrules` | 契约测试 + 官方文档 |
| OpenCode V2 | `AGENTS.md` | 加载全局及 workspace 路径上的 `AGENTS.md`；嵌套文件在 Agent 探索/读取相应目录时发现；多个文件合并，不负责裁决冲突。配置中的 `instructions` 在 AGENTS 文件后追加；V2 不把 `CLAUDE.md` 作为回退入口 | 全局 `~/.config/opencode/`；项目配置目录 `.opencode/` | 原生读取 | 官方文档核对（V2） |
| WorkBuddy | `.codebuddy/` 项目配置；兼容 `AGENTS.md` | 官方文档列出项目级 Rules、Agents、Skills、Commands 与 `CODEBUDDY.md`，并声明兼容现有 `AGENTS.md`；多个入口间的精确优先级未完整说明 | `.codebuddy/` 是可提交、团队共享的项目配置；用户级 `~/.codebuddy/` | 不生成产品专属配置 | 官方文档核对 |
| CodeBuddy IDE | 根目录 `CODEBUDDY.md`；条件回退为根目录 `AGENTS.md` | `CODEBUDDY.md` 存在时默认读取它；仅当根目录没有 `CODEBUDDY.md` 时，才自动加载根目录 `AGENTS.md`。结构化项目规则在 `.codebuddy/rules/` | `.codebuddy/rules/` 与用户规则 | 不生成产品专属配置 | 官方文档核对 |
| CatPaw / ZCode | 未知 | 尚无可确认的公开项目规则加载约定 | 未知 | — | **未验证** |

「验证程度」的含义：

- **契约测试**：`tests/test-client-adapters.cjs` 验证本仓库生成的入口、指针目标、文档边界和初始化结果；它不启动客户端。
- **官方文档核对**：按表中链接核对厂商公开说明，但不能证明特定版本、账号配置和实际项目加载结果。
- **未验证**：缺少可靠公开依据或未进行实际验证，不得声称支持。

**目前没有任何客户端完成本仓库的真实 CLI / IDE 端到端验收。** 表中的契约测试和文档核对都不是运行时集成证据。

## 2. 共享规范正文，不假设客户端语义相同

`AGENTS.md` 已成为多个编码客户端支持的通用入口，但**文件名相同不意味着加载时机、优先级和作用域相同**：

- Codex、Cursor、OpenCode V2 原生读取 `AGENTS.md`，但嵌套发现和 override 语义不同。
- Claude Code 与 Gemini CLI 保留一行导入指针；Claude 新版虽可直接读取 AGENTS，但默认配置下 CLAUDE 文件可能优先，Gemini 则要通过 `context.fileName` 才会把 AGENTS 文件名纳入发现。
- CodeBuddy IDE 的 AGENTS 兼容是条件回退；根目录已有 `CODEBUDDY.md` 时不能假定它还会读取 `AGENTS.md`。
- WorkBuddy 的公开项目配置以 `.codebuddy/` 为核心，并声明兼容 AGENTS；不应把它与 CodeBuddy IDE 的单一回退规则混为一谈。

因此，根入口保持 `AGENTS.md` 单一事实源；客户端加载机制只记录可证实的具体约定。实际是否加载，必须通过对应客户端的上下文视图或独立运行测试确认。

**但入口通了只解决一半问题。** 很多客户端还有自己的**项目级记忆目录**——规则读得到，状态却写在自己的目录里，换个客户端就"失忆"。这一层必须单独约定，见 §3。

## 3. 客户端私有记忆怎么和项目权威文件对齐

这是最容易漏的一块。部分客户端会保存自己的本地项目数据，另一些（如 WorkBuddy / CodeBuddy）则提供可提交的共享项目配置。两者必须区分，否则会出现两种坏情况：

- Agent 把项目状态写进私有目录，换个客户端就"失忆"
- `.memory/MEMORY.md` 的 §0 永远是模板里的「待填」，真实状态散在各家私有目录里

**原则：私有记忆是缓存，仓库内按领域划分的权威文件才是事实来源。** `.memory/` 只保存跨会话断点与稳定事实摘要，不是任务、需求、意图或验证的总账。不是禁止私有记忆，是不许它成为唯一副本。

落地成三条可执行规则（已写进 `AGENTS.md` §0.5 收口要求）：

| 时机 | 做什么 |
|---|---|
| 开工 | 读 `.memory/MEMORY.md` §0 恢复断点；再按任务读取对应领域的仓库权威文件 |
| 收口 | 意图、需求、验证写回各自 core 权威文件；仅在启用 `task_tracking` / `roadmap` / `adr` 时，任务、里程碑、架构决策分别写回对应权威文件；MEMORY 只更新断点/稳定事实；私有记忆可留缓存 |
| 冲突 | 仓库内对应领域的权威文件优先于客户端私有记忆；可复现的故障教训才记入 PITFALLS |

**哪些私有目录该忽略**：只忽略纯工具数据/缓存。`.cursor/rules/`、`.claude/commands/` 这类团队共享配置要入库。`.workbuddy-ai/` 属于前者，模板已默认忽略；其他客户端按同一标准判断后，自己加到 `.gitignore` 的托管区块**外面**——区块内是模板生成的，会被覆盖。

### 机制：单向镜像，不靠自觉

光在 `AGENTS.md` 写"私有记忆是缓存"没用——agent 有自己的规矩，它不读你的规则你也拦不住。所以把状态**送到它一定会读的地方**：

```bash
node .standards/sync-memory.cjs          # 把 .memory/MEMORY.md 的 §0 镜像进私有记忆
node .standards/sync-memory.cjs --check  # 校验是否过期（治理检查用的是同一个判断）
```

在 `gov.toml` 声明目标，没声明就不镜像（不猜）。目标路径必须位于项目内，不能经过符号链接：

```toml
[memory]
mirrors = [".workbuddy-ai/memory/MEMORY.md"]
```

| 规则 | 含义 |
|---|---|
| **单向** | `.memory/` → 私有文件。反向不做：私有文件的格式每家不同，反向解析一定会错 |
| **只占一个带标记的区块** | `<!-- >>> agent-standards memory mirror -->` 之间由脚本维护，区块外你自己写的内容一个字不动 |
| **可检测** | §0 变了但没同步，`check-governance` 直接报错，Node 与 Python 输出逐字节一致 |
| **路径受限** | 目标必须是项目内相对普通文件路径；拒绝绝对路径、`..` 和任何符号链接；全部目标预检通过后才写入 |
| **不猜路径** | `mirrors` 默认空。你不声明，它就不动任何私有目录 |

**为什么不做双向同步**：双向要理解每家的数据格式，格式一变就静默错位。单向镜像最坏情况是"副本旧了"，而旧副本会被检查当场抓出来。

### 私有记忆里已经堆了真内容怎么办

镜像只同步 6 行断点。如果私有目录里已经有上百行项目知识（很常见），做一次归位：

1. 把内容归入对应权威文件：意图/范围变化进 `.spec/intent/`，需求进 `.spec/requirements/`，验证进 `.spec/verification/`；仅在启用 `task_tracking` 时任务状态进 `.spec/tasks/index.md`，仅在启用 `roadmap` 时里程碑状态进 `.spec/roadmap/INDEX.md`，仅在启用 `adr` 时架构决策进 `.spec/adr/`；MEMORY 只留稳定事实摘要与恢复断点
2. 私有记忆里只留会话流水和客户端自己的笔记
3. 跑一次 `sync-memory`，断点区块盖在顶部
4. 之后维护各领域自己的权威文件；MEMORY 仅维护断点/稳定事实，私有文件靠镜像保持断点同步

归位要人工判断哪些算"项目级事实"，**不要指望脚本自动分类**——它分不清"这条是项目约定"还是"这条是这次会话的临时决定"。

## 4. 怎么新增一个客户端适配

三步，别多：

1. **确认它读什么**：查官方文档，找到「rules / instructions / memory / context」这类配置项。不要凭猜测。
2. **写指针**：新建入口文件，内容只有一行导入或一句指路。例如：

   ```markdown
   Read AGENTS.md for project rules and .memory/MEMORY.md for the cross-session breakpoint; consult the relevant .spec index for domain state.
   ```

   禁止在适配文件里复制规则正文——一旦复制，两份必然走样。
3. **加契约断言**：在 `tests/test-client-adapters.cjs` 里加一条，验证这个入口存在、指向的文件存在、且没有包含第二套规则正文。

如果该客户端支持配置文件（如 `opencode.json` 的 `instructions`），可以顺带把 `.spec/02-conventions.md` 列进去；仅当项目启用 `stack_rules` 时，再加入实际涉及的 `.spec/stacks/<stack>.md`——但**不要把 `.spec/**` 全量塞进去**，那等于每次会话都加载整套规范，违背按需读取。

## 5. 已知限制

- 客户端升级可能改变加载行为；本矩阵按 2026-11-15 的官方文档核对，后续版本仍需复核。
- Claude Code 的直接 AGENTS 支持有最低版本要求；模板保留 `CLAUDE.md` 导入指针，不据此宣称所有 Claude 会话都以同样方式加载。
- Gemini 的子目录 AGENTS 发现取决于 `context.fileName` 配置；只生成根 `GEMINI.md`，不擅自改用户级 settings。
- CodeBuddy 的 AGENTS 回退仅适用于根目录没有 `CODEBUDDY.md` 的情况；已有同名文件时必须由项目维护者合并规则。
- WorkBuddy 与 CodeBuddy 的多入口优先级未在所引官方页面中完整说明；在真实客户端验证前保持“文档核对”，不升级为集成支持。
- OpenCode V2 的加载方式不能套用 V1 的 `CLAUDE.md` 回退语义；本矩阵只陈述 V2 官方说明。
- 客户端用户级规则、个人记忆、本地配置**不由本模板管理**；项目事实仍以仓库内文件为准。
- 同一事实的优先级：该领域的仓库权威文件 > 客户端私有规则 > 个人记忆。
- 局部规则（子目录 `AGENTS.md`）只在有独立稳定职责时才加，且必须与根规则不重复。Codex 的 `AGENTS.override.md` 是例外——它替代根规则，加之前要人工确认红线还在。

官方依据：
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude Code memory and AGENTS.md](https://code.claude.com/docs/zh-CN/memory)
- [Gemini CLI context files](https://geminicli.com/docs/cli/gemini-md/)
- [Cursor Rules](https://cursor.com/docs/rules)
- [OpenCode V2 Instructions](https://opencode.ai/docs/instructions)
- [WorkBuddy project configuration](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)
- [CodeBuddy IDE Rules](https://cloud.tencent.com/document/product/1831/137442)
