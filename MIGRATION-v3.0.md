# 迁移到 3.0.0：`scripts/` → `.standards/`

> 3.0.0 把治理工具从 `scripts/` 挪到 `.standards/`。**这是一次破坏性变更**：所有命令路径都变了。
> 本文说明为什么改、改了什么、怎么迁、以及哪些情况需要人工处理。

## 为什么改

`scripts/` 是项目自己的目录。把治理工具塞进去有三个问题：

1. **撞名**：项目里已经有个 `scripts/check-governance.cjs`，`init` 会跳过它并保留——治理检查从此跑的是别人的脚本，而且没人知道。
2. **混淆**：`scripts/build.sh` 和 `scripts/generate-board.cjs` 并排放，看不出哪个是项目资产、哪个是工具。
3. **占用**：项目想用 `scripts/` 放自己的东西，得先确认会不会和工具撞。

换成点开头目录，和 `.spec/`、`.memory/` 一致：一眼能看出是治理设施，不会撞名，也不会混进项目的可见目录树。

## 命令怎么变

| 之前 | 现在 |
|---|---|
| `node scripts/check-governance.cjs` | `node .standards/check-governance.cjs` |
| `node scripts/generate-board.cjs` | `node .standards/generate-board.cjs` |
| `node scripts/sync-memory.cjs` | `node .standards/sync-memory.cjs` |
| `python scripts/check_governance.py` | `python .standards/check_governance.py` |
| `node scripts/task-context-resolver.cjs` | `node .standards/task-context-resolver.cjs` |

其余同理：`profile-validator`、`capability-resolver`、`profile_validator.py`。

## 怎么迁

```bash
node <standards>/init.cjs <项目> --update
```

`--update` 会自动做四件事：

1. 把 8 个工具脚本装进 `.standards/`
2. 删除 `scripts/` 下**由本工具安装、且内容未被改动过**的副本（用清单里的哈希核对）
3. 若 `scripts/` 因此变空，删掉该目录；**项目自己写的脚本原样保留**
4. 把 `gov.toml [required].files` 里的旧路径改成新路径，并把 `.standards` 加进 `allowed_dirs`

**顺序很重要**：第 4 步对「被项目定制过、`--update` 本来会跳过」的 `gov.toml` 也会生效——否则清单还指着已删除的文件，治理检查会报「缺少必需文件」。这一步只改我们自己的 8 个文件名，不碰别的。

### 自动迁移的安全边界

- 只识别并清理上面列出的 8 个旧工具文件，不会按 manifest 中任意的 `scripts/*` 路径删除文件。
- 旧脚本必须是普通文件，`scripts/` 必须是普通目录；符号链接、非普通文件、缺少安装哈希或哈希不匹配的文件都会保留并给出告警。
- `scripts/` 只有在迁移文件全部删除后确实为空，才会在安装事务提交成功后清理。提交前发生错误时，回滚仍可在原目录恢复文件。
- 迁移不会删除项目自己的脚本；若旧目录仍有业务文件，目录自然保留。

## 需要人工处理的三种情况

| 情况 | 表现 | 怎么办 |
|---|---|---|
| 你改过 `scripts/` 下的工具脚本 | 迁移不删它（哈希对不上） | 自己判断：改动还有用就搬进 `.standards/` 再改，没用就删 |
| 你的钩子调用旧路径 | 提交时报「找不到治理检查」并失败关闭 | 改钩子里的路径，或让 `--update` 刷新（钩子是本工具装的且未改动时会自动更新） |
| CI / 脚本里写死了旧路径 | 流水线报错 | 全局搜索 `scripts/check-governance` 等 8 个名字，替换成 `.standards/` |

**为什么迁移不删"改过的"副本**：改过就说明它已经是项目资产了，删掉等于替你丢代码。宁可留下一个旧文件让你决定，也不猜。

## 为什么不干脆同时保留两个位置

保留 `scripts/` 会让「哪份在生效」变成一个新的不确定性——两份脚本都会存在，谁都不知道检查器实际跑的是哪个。**同一个事实只能有一个家**，迁移就得是一次性的、彻底的。

## 回滚

```bash
git revert <迁移提交>
```

迁移只做三件事：新建 `.standards/`、删除 `scripts/` 下的受管副本、改 `gov.toml` 的路径。全部在 git 里，可完整回滚。
