# 单次规范升级记录模板

> 用于记录某个项目从一个规范版本升级到另一个版本的完整过程。
> 本文件是人工审计记录模板，不是升级命令，也不授予自动应用权限。
> 建议项目在需要长期追溯时，将填写后的副本提交到 .spec/migrations/<target-version>-<plan-id>.md。
> 完整备份应放在项目目录之外；不要把业务数据备份或大体积构建产物提交到 Git。

## 1. 升级身份

| 字段 | 记录 |
|---|---|
| 项目标识 | <project-name> |
| 升级记录状态 | draft / partial / complete / rolled_back / unverified |
| 来源规范版本 | <source-version> |
| 目标规范版本 | <target-version> |
| 规范仓库 commit | <standards-commit-sha> |
| 项目升级前 commit | <project-before-commit-sha> |
| 升级计划 ID | <plan-id> |
| 负责人 / 审核人 | <reviewer> |
| 开始时间 / 完成时间 | <ISO-8601> / <ISO-8601> |

## 2. 升级前保护点

| 项目 | 记录 |
|---|---|
| 工作分支 / worktree | <branch-or-worktree> |
| 工作区是否干净 | yes / no；若为 no，说明未提交改动如何保存 |
| Git 保存点 | <commit / tag / stash reference> |
| 完整备份位置 | <project-external-backup-path-or-backup-id> |
| 备份创建时间 | <ISO-8601> |
| 备份校验方式 | <tree hash / archive checksum / restore test reference> |
| 安装清单原始 SHA-256 | <.agent-standards.json sha256> |

确认项：

- [ ] 项目目录外的完整备份可读取。
- [ ] 已记录升级前 Git commit 和未提交改动。
- [ ] 已确认目标规范仓库 commit 与版本号。
- [ ] 已确认本次升级不直接修改 main 或生产分支。

## 3. 计划与审批证据

| 文件 | 归档位置 / 引用 | SHA-256 |
|---|---|---|
| upgrade-plan.json | <path-or-artifact-id> | <sha256> |
| upgrade-review.json | <path-or-artifact-id> | <sha256> |
| 升级前 drift JSON | <path-or-artifact-id> | <sha256> |

计划生成命令：

~~~bash
node tools/plan-template-upgrade.cjs \
  --root <project-root> \
  --standards-root <standards-repository> \
  --json
~~~

审批校验命令：

~~~bash
node tools/validate-template-upgrade-review.cjs \
  --plan <upgrade-plan.json> \
  --review <upgrade-review.json> \
  --json
~~~

审批记录必须绑定同一个 plan_id。每个需要人工确认的路径必须有 reviewer、reviewed_at、decision 和 reason；除 approve_removal、defer 外，还必须记录实际结果 result_sha256。manual_merge 还必须记录 baseline_ref 与 merge_result_ref。

## 4. 逐路径处理记录

每条计划路径一行。不要只记录“升级完成”，应记录实际决策和结果证据。

| 路径 | 原计划状态 / 动作 | 人工决定 | 实际结果 SHA-256 | 基线处理 | 备注 |
|---|---|---|---|---|---|
| <path> | update_available / replace_candidate | approve_upstream | <result-sha256> | advanced | <note> |
| <path> | conflict / manual_merge | manual_merge | <result-sha256> | advanced-as-customized | baseline_ref=<ref>; merge_result_ref=<ref> |
| <path> | new_upstream_file / add_candidate | defer | n/a | unchanged | <defer reason> |
| <path> | upstream_removed / review_removal | approve_removal | n/a | entry-removed | <reference / impact> |

延期规则：

- defer 是明确的延期决定，不是忽略差异。
- 登记时会核对延期路径仍保持计划生成时的存在状态、内容哈希和权限。
- 只要有延期路径，整体 installed_with_version 必须保持来源版本。
- 后续必须重新生成计划；不能继续使用旧 plan_id 处理已变化的项目状态。

## 5. 批次执行与验证

每个手工执行批次分别记录：

| 批次 | 批次范围 | 执行人 | 变更 commit | 结果 |
|---|---|---|---|---|
| 1 | <approved paths> | <operator> | <commit-sha> | passed / failed |
| 2 | <deferred paths after replanning> | <operator> | <commit-sha> | passed / failed |

每批次验证：

| 检查项 | 命令 / CI 运行引用 | 结果 |
|---|---|---|
| 规范治理 | node scripts/check-governance.cjs | passed / failed / unverified |
| 模板漂移 | node tools/check-template-drift.cjs --root <project> | clean / remaining |
| 项目测试 | <project-specific test command> | passed / failed / unverified |
| 类型检查 / lint | <project-specific command> | passed / failed / unverified |
| 构建 | <project-specific build command> | passed / failed / unverified |

没有实际执行的检查必须写 unverified，不能把“命令未运行”记成通过。

## 6. 基线登记证据

先 dry-run：

~~~bash
node tools/record-reviewed-template-upgrade.cjs \
  --root <project-root> \
  --standards-root <standards-repository> \
  --plan <upgrade-plan.json> \
  --review <upgrade-review.json> \
  --dry-run
~~~

备份和结果复核后，显式登记：

~~~bash
node tools/record-reviewed-template-upgrade.cjs \
  --root <project-root> \
  --standards-root <standards-repository> \
  --plan <upgrade-plan.json> \
  --review <upgrade-review.json> \
  --confirm-reviewed \
  --json
~~~

| 字段 | 记录 |
|---|---|
| dry-run 输出 SHA-256 / artifact | <reference> |
| 最终登记输出 SHA-256 / artifact | <reference> |
| 登记前 manifest SHA-256 | <sha256> |
| 登记后 manifest SHA-256 | <sha256> |
| installed_with_version | <version> |
| last_upgrade.status | partial / complete |
| last_upgrade.plan_id | <plan-id> |
| updated_paths | <count / list reference> |
| removed_paths | <count / list reference> |
| deferred_paths | <count / list reference> |

登记工具只修改 .agent-standards.json，不应用模板文件。登记成功后仍必须重新运行漂移检查、治理检查和项目测试/构建。

## 7. 失败与恢复记录

若任一验证失败：

1. 停止后续升级批次，保存失败现场日志。
2. 记录失败时的 Git commit、工作树差异和 manifest SHA-256。
3. 从升级前 Git 保存点和项目目录外备份恢复。
4. 比较恢复前后的文件、目录、符号链接、权限和未提交改动。
5. 重新运行治理、漂移、项目测试与构建。

| 字段 | 记录 |
|---|---|
| 失败时间 | <ISO-8601> |
| 失败批次 / 路径 | <batch / paths> |
| 失败日志引用 | <artifact-id-or-path> |
| 恢复来源 | <git-commit / backup-id> |
| 恢复后工作树比较 | identical / different / unverified |
| 恢复后 manifest SHA-256 | <sha256> |
| 恢复后治理 / 测试 | passed / failed / unverified |
| 恢复后的升级 plan ID | <plan-id> |

未完成逐项恢复验证时，记录状态必须为 unverified；不得仅凭恢复命令退出码宣称恢复成功。

## 8. 最终结论

- [ ] 所有计划路径均已处理，且没有未解释的延期路径。
- [ ] 整体 installed_with_version 已推进到目标版本。
- [ ] 最终 drift 检查没有待处理差异。
- [ ] 项目治理检查通过。
- [ ] 项目测试、类型检查/lint、构建均有真实结果或明确标记 unverified。
- [ ] 升级记录、plan、review、Git commit 和备份引用已按项目约定归档。
- [ ] 失败/恢复记录完整；若发生恢复，恢复状态已实际验证。

最终状态： complete / partial / rolled_back / unverified

负责人确认： <name>

确认时间： <ISO-8601>
