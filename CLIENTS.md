# 客户端适配

> 一套规则正文，多个客户端入口。本文件只回答「哪个客户端怎么进来、验证到什么程度」。
> 规则正文永远是 `AGENTS.md`；适配文件只做指针，不写第二套规范。

## 1. 现状矩阵

| 客户端 | 入口 | 加载方式 | 模板是否生成 | 验证程度 |
|---|---|---|---|---|
| Codex | `AGENTS.md` | 从仓库根到当前目录逐层加载，更深目录后加载、更具体者优先；同目录有 `AGENTS.override.md` 时**替代**而非追加 | 原生读取 | 契约测试 |
| Claude Code | `CLAUDE.md` | `@AGENTS.md` 导入，可递归最多四跳，向上查找 | ✅ 生成 | 契约测试 |
| Gemini CLI | `GEMINI.md` | `@./AGENTS.md` 导入，支持多上下文文件名 | ✅ 生成 | 契约测试 |
| Cursor | `AGENTS.md` | 原生支持；父目录与更具体目录组合，后者优先 | 原生读取 | 契约测试 |
| **OpenCode** | `AGENTS.md` | 原生读取，优先级最高；同级只取第一个匹配；额外规则可在 `opencode.json` 的 `instructions` 里列 glob | 原生读取 | 文档核对 |
| **WorkBuddy / CodeBuddy** | `AGENTS.md` | 按 AGENTS 约定读取；企业版另有「项目规则」功能（Markdown + front-matter） | 原生读取 | 文档核对 |
| **CatPaw / ZCode** | 未知 | 未找到公开的规则文件约定 | — | **未验证** |

「验证程度」的含义：

- **契约测试**：`tests/test-client-adapters.cjs` 验证入口文件存在、指针指向真实文件、没有第二套正文
- **文档核对**：只核对了官方/社区文档，没有启动真实客户端
- **未验证**：不知道它读什么文件，不要声称支持

**没有任何一个客户端做过真实 CLI 端到端验证。** 矩阵里的"支持"指入口和加载语义对得上，不指行为一致。

## 2. 为什么大多数国内客户端不需要适配

2026 年的主流编码 Agent 已经收敛到 `AGENTS.md` 这个约定（Codex 带起来的，Cursor、OpenCode、CodeBuddy 等跟进）。所以：

- **原生读 `AGENTS.md` 的**：不需要任何适配文件，铺完就能用
- **需要指针的**（Claude Code、Gemini CLI）：模板已生成 `CLAUDE.md` / `GEMINI.md`
- **完全不读 `AGENTS.md` 的**：才需要写适配器

判断方法：在项目里让该客户端回答一句「本项目的规则文件是哪个」。答不上来就说明它没读到。

## 3. 怎么新增一个客户端适配

三步，别多：

1. **确认它读什么**：查官方文档，找到「rules / instructions / memory / context」这类配置项。不要凭猜测。
2. **写指针**：新建入口文件，内容只有一行导入或一句指路。例如：

   ```markdown
   Read AGENTS.md for project rules and .memory/MEMORY.md for current state.
   ```

   禁止在适配文件里复制规则正文——一旦复制，两份必然走样。
3. **加契约断言**：在 `tests/test-client-adapters.cjs` 里加一条，验证这个入口存在、指向的文件存在、且没有包含第二套规则正文。

如果该客户端支持配置文件（如 `opencode.json` 的 `instructions`），可以顺带把 `.spec/02-conventions.md`、`.spec/stacks/<stack>.md` 列进去——但**不要把 `.spec/**` 全量塞进去**，那等于每次会话都加载整套规范，违背按需读取。

## 4. 已知限制

- 客户端升级可能改变加载行为。矩阵里的结论有核对日期，过期需重核。
- 客户端的用户级规则、个人记忆、本地配置**不由本模板管理**；项目事实仍以仓库内文件为准。
- 同一事实的优先级：仓库权威文件 > 客户端私有规则 > 个人记忆。
- 局部规则（子目录 `AGENTS.md`）只在有独立稳定职责时才加，且必须与根规则不重复。Codex 的 `AGENTS.override.md` 是例外——它替代根规则，加之前要人工确认红线还在。
