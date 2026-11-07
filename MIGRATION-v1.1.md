# 从旧模板迁移到 1.1.0

本次升级修复初始化与治理行为，不应直接用 `init.cjs --force` 覆盖已经运行的项目。先备份并检查 Git diff，再逐项迁移。

## 必做

1. 将新版 `scripts/check-governance.cjs`、`scripts/check_governance.py` 和 `scripts/generate-board.cjs` 放入项目。
2. 更新 `gov.toml [required]`，增加 `.spec/tasks/BOARD.md`、两个归档 `INDEX.md`、`.spec/stacks/README.md` 和 `scripts/generate-board.cjs`。
3. 将已有 `pre-commit` 与新版治理检查合并；不要直接覆盖项目自己的 lint、测试或安全检查。新版模板在缺少 Node/Python 时会失败关闭。项目专属检查迁移到 `.githooks/pre-commit.local`，参考 `.githooks/pre-commit.local.example`。
4. 在 `.gitignore` 末尾合并新版 `# >>> agent-project-standards (managed)` 区块；保留项目原有规则。
5. 执行 `node scripts/generate-board.cjs`，再运行 Node 和 Python 两套治理检查。

## 任务归档迁移

旧版可能只把已完成波次写成 `archive/W1.md` 摘要，但活跃目录仍留在 `.spec/tasks/`。新版要求归档保留完整任务详情：

```text
.spec/tasks/archive/W1/T1/card.md
.spec/tasks/archive/W1/T1/log.md
.spec/tasks/archive/W1/T2/card.md
.spec/tasks/archive/W1/T2/log.md
```

迁移时将整个任务目录移动到对应波次目录，在 `.spec/tasks/index.md` 中删除已归档任务的活跃行，在 `.spec/tasks/archive/INDEX.md` 中登记波次。不要只移动摘要文件而丢失原始卡片和日志。

## Agent 入口

- Cursor 原生读取根目录 `AGENTS.md`；删除旧 `.cursorrules`，不要再维护第二份规则。
- `CLAUDE.md` 使用 `@AGENTS.md`。
- `GEMINI.md` 使用 `@./AGENTS.md`。

## 技术栈规范

按项目真实使用的语言，将 `presets/stacks/` 中对应文件复制到 `.spec/stacks/`。多栈项目可以保留多份，但 Agent 只按当前任务读取相关文件。项目专属命令与框架差异由维护者补充。

## 验收

```bash
node scripts/generate-board.cjs
node scripts/check-governance.cjs
python3 scripts/check_governance.py
```

两套治理检查的退出码和诊断输出应一致。若有差异，先修复检查器，不要通过放宽白名单掩盖问题。
