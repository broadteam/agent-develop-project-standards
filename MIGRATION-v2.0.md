# 从 1.2.x 迁移到 Agent 项目开发规范 2.0

> 2.0 迁移必须先审查差异。不要直接对已定制项目执行 `init.cjs --force`。

## 迁移原则

- 先备份，再 dry-run，再逐项审查。
- 保留项目自有规则、Hook、CI、构建命令和架构决策。
- 只自动迁移可以确定映射的模板文件；存在冲突时输出报告并由维护者决定。
- 不在生产项目上首次验证迁移。先用临时 fixture 覆盖空项目、已有文件、多栈和自定义 Hook 场景。
- 迁移失败必须明确报告已完成步骤与未完成步骤，不得声称回滚成功，除非已验证。
- 初始化器会在写入前拒绝目标路径中的符号链接，并对可捕获的运行时写入失败尝试回滚本次文件变更；这不是断电级事务，迁移前仍须备份。

## 建议步骤

1. 记录当前规范版本、Git commit、项目根目录清单和自定义文件清单。
2. 备份 `AGENTS.md`、`gov.toml`、`project-profile.toml`（若已有）、`.spec/`、`.memory/`、`.githooks/` 与 CI 配置。
3. 在项目副本或临时 fixture 中执行 2.0 初始化器 `--dry-run`，审查创建、跳过、覆盖、保护清单。
4. 从新规范仓库执行 `node tools/check-template-drift.cjs --root <项目目录>`。若项目没有 `.agent-standards.json`，先将其视为历史基线未知；不要把旧规则内容推断为与当前模板一致。人工审查、备份并确认当前内容后，可先运行 `tools/adopt-template-baseline.cjs --dry-run`，再显式执行 `--confirm-reviewed` 仅登记元数据基线。
5. 在基线可比较后，执行 `node tools/plan-template-upgrade.cjs --root <项目目录> --json` 生成只读升级计划。记录 `plan_id`，逐项审查源路径、目标路径、基线哈希、当前哈希和建议动作；对每个待审条目记录 `reviewer`、`reviewed_at`、`path`、`decision`、`reason` 和 `result_sha256`（`approve_removal` 除外）；对 `manual_merge` 另记录 `baseline_ref`、`merge_result_ref`。 完成后，将计划和审查记录交给 `tools/validate-template-upgrade-review.cjs --plan <plan.json> --review <review.json>` 校验；校验器只验证完整性，不会执行变更。双向修改必须先通过升级前 Git 历史、备份或旧模板 checkout 恢复共同基线，再进行三方人工合并；记录 `baseline_ref` 和 `merge_result_ref`。安装清单只存哈希，不包含基线正文；无法恢复基线时不得宣称已完成三方合并。上游移除不得直接删除项目文件；新通用模板文件和项目已安装的技术栈预设也要确认是否适用；未选择的语言预设不属于该项目的升级对象。
6. 比较 2.0 的规则入口、客户端指针、记忆模型、任务索引和治理配置；逐项处理项目定制。首次引入 `project-profile.toml` 时，初始化器只填写可探测的技术栈候选，项目类型、规模、风险、架构与能力开关必须由维护者确认后将 status 改为 `confirmed`。
7. 检查 Hook 路径与执行权限；保留原有项目专属检查。`--replace-hook` 必须与 `--force` 同时指定；初始化器不会执行项目已有的同名 BOARD 生成脚本。
8. 运行 Node/Python 治理检查、初始化回归、检查器 parity、项目 lint/类型检查/测试和构建。
9. 更新规范版本标识、迁移记录与交接断点。

## 升级预览的职责与失败恢复

`tools/plan-template-upgrade.cjs` 是只读规划工具，不是升级应用器。它将漂移分类转换为候选动作：上游更新、保留本地修改、三方合并、删除审查、恢复候选、新文件候选、基线审查和同名文件归属审查。报告包含稳定的 `plan_id`、版本、逐文件哈希证据和人工决策契约。

当前版本没有升级应用器。`validate-template-upgrade-review.cjs` 会读取计划和审查 JSON 并只校验记录完整性，但不会执行或应用任何决策，也不会写入项目文件。维护者完成审查并校验通过后，应在独立 Git 分支/工作树和备份副本中手工执行已批准的变化；不能因报告建议 `replace_candidate` 就直接运行 `init.cjs --force`。计划中的 `blocked` 项必须先修复并重新生成报告。

在真正执行任何升级变更前：

1. 保存当前完整工作树备份，并记录 Git commit、未提交改动和当前安装清单。
2. 只处理已经有明确决策的路径；冲突文件先基于“安装基线 / 当前项目 / 当前上游”三方比较。
3. 每批变更后运行漂移检查、治理检查、项目测试和构建；保留可回退的文件级差异。
4. 若验证失败，停止后续变更；从备份恢复本批修改的文件，再重新运行检查。不要通过再次执行 `--force` 掩盖失败。
5. 记录恢复结果及仍未恢复的项目；没有实际验证的回滚必须标记为 `unverified`。

本仓库的 `tests/test-template-upgrade-recovery.cjs` 会在临时目录中验证一条完整演练：生成计划并校验审批 → 手工替换获批规则文件及项目内版本元数据 → 注入根目录白名单违规使治理检查失败 → 从项目外完整备份恢复 → 比较恢复前后文件树 → 重新运行治理、漂移和升级计划，确认恢复到旧版本状态且原计划 ID 可复现。该测试不是自动回滚器，也不触碰真实项目。

实际项目发生失败时，建议使用升级前 Git commit/独立 worktree 作为主要恢复点，外部备份作为第二恢复来源。恢复时停止后续修改，先保存失败现场日志；恢复文件与目录后重新运行治理检查、项目测试、构建及漂移检查，并比较原 commit、安装清单、文件树和未提交改动。未逐项验证的恢复必须标记为 `unverified`。

新增 `tools/record-reviewed-template-upgrade.cjs` 用于成功升级后的基线登记。它不应用模板内容，只验证 plan/review、原 manifest 基线、当前模板源和项目内实际结果哈希，然后原子更新 `.agent-standards.json`。先执行 `--dry-run`，确认后再显式执行 `--confirm-reviewed`。它只推进已批准且哈希匹配的条目；本地定制必须用 `keep_project` 明确接受，人工合并必须记录共同基线、合并结果和结果哈希；上游删除必须确认目标已删除或明确保留并记录哈希。未处理状态、过期计划或任一结果不匹配都会拒绝登记，manifest 不写入。

登记成功后，必须重新运行 `check-template-drift.cjs`、项目治理、测试和构建。该工具推进的是安装元数据，不是自动升级应用器，也不代替项目验证；自动升级应用器和自动回滚器仍未实现。不要手工编辑 manifest，也不要使用 `adopt-template-baseline.cjs` 代替升级登记。

目前仓库尚未提供自动升级应用器或升级回滚器。上述是人工迁移的安全流程，不代表自动事务能力已经实现。

## 成功升级后的基线登记

手工应用并验证获批文件后，使用：

```bash
node tools/record-reviewed-template-upgrade.cjs \
  --root <项目目录> \
  --standards-root <规范仓库目录> \
  --plan <upgrade-plan.json> \
  --review <review.json> \
  --dry-run

# 备份并确认 dry-run 通过后，显式写入
node tools/record-reviewed-template-upgrade.cjs \
  --root <项目目录> \
  --standards-root <规范仓库目录> \
  --plan <upgrade-plan.json> \
  --review <review.json> \
  --confirm-reviewed
```

登记器会校验 plan_id、review 完整性、来源版本、逐文件旧基线哈希、当前模板源哈希及审查记录中的实际结果哈希。它只写 `.agent-standards.json`，不应用模板文件；登记失败时原 manifest 保持不变。登记成功后必须重新执行漂移检查、治理检查、项目测试和构建。此工具不提供自动升级或自动回滚能力。

## 不兼容变化登记

2.0 迁移若改变以下任一内容，必须在正式发布说明中列出旧格式、新格式、自动化程度和回滚方式：

- 文件路径或权威事实源；
- `gov.toml` 配置键/语义；
- 任务索引表结构、状态枚举或归档布局；
- Agent 客户端入口文件；
- 初始化器参数或默认覆盖行为；
- 治理检查器退出码、诊断格式或检查范围。

## 迁移完成判据

- [ ] 项目维护者确认迁移差异。
- [ ] 自定义规则和项目专属 Hook 未丢失。
- [ ] 迁移后治理检查通过。
- [ ] 项目自己的测试与构建已实际执行，未执行项标记为 `unverified`。
- [ ] 迁移记录包含来源版本、目标版本、提交号和人工处理项。
- [ ] 已登记安装基线；无法恢复历史基线的旧项目必须明确标记并经维护者审查后才允许采纳当前基线。
- [ ] 对上游与本地同时修改的文件形成逐项人工合并结论；漂移与升级预览工具不得自动覆盖。
- [ ] 已生成并审查升级计划，记录 `plan_id` 及所有待审路径的 reviewer / reviewed_at / decision / reason。
- [ ] 本次迁移没有把只读预览误当成升级已应用；手工应用后通过 `record-reviewed-template-upgrade.cjs` 推进已审批基线，并重新运行漂移/治理/项目测试。
- [ ] 如果没有自动应用器或自动回滚器，必须明确记录其不存在。
- [ ] 回滚路径可执行或明确标记为未验证；临时恢复演练必须覆盖工作树恢复和恢复后重新验证。
