#!/usr/bin/env python3
"""治理检查（Python 版）—— 与 check-governance.cjs 行为一致。

为什么有两个版本：这套规范要能铺到任何项目。前端/Node 项目用 .cjs，
Python/Java/Go 项目不一定装了 Node，用这个 .py。

检查五件事：
  1. 根目录白名单（gov.toml [dirs]）
  2. 根目录禁用命名（gov.toml [forbid]）
  3. 文档与索引预算（gov.toml [budget]）——同时是 token 预算
  4. 必需文件存在（gov.toml [required]）
  5. 索引 ↔ 卡片目录双向一致（gov.toml [layout]）

用法：python scripts/check_governance.py
退出码：0 通过，1 违规
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOV = ROOT / "gov.toml"

if not GOV.exists():
    print("\n找不到 gov.toml，治理检查无法运行。\n")
    sys.exit(1)


def strip_comment(s: str) -> str:
    """去掉引号外的行尾注释。"""
    in_str = False
    for i, ch in enumerate(s):
        if ch == '"':
            in_str = not in_str
        elif ch == "#" and not in_str:
            return s[:i]
    return s


def read_gov(path: Path) -> dict:
    """极简 TOML 读取：只支持 key = "str" / 数字 / ["a","b"]。"""
    data: dict[str, dict] = {}
    section = ""

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        t = raw_line.strip()
        if not t or t.startswith("#"):
            continue

        sec = re.match(r"^\[(\w+)\]$", t)
        if sec:
            section = sec.group(1)
            data.setdefault(section, {})
            continue

        kv = re.match(r"^(\w+)\s*=\s*(.+)$", t)
        if not kv or not section:
            continue

        key, raw_val = kv.group(1), kv.group(2)
        val = strip_comment(raw_val).strip()
        if not val:
            continue

        if val.startswith("["):
            items = []
            for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', val):
                items.append(m.group(1).replace("\\\\", "\\"))
            data[section][key] = items
        elif val.isdigit():
            data[section][key] = int(val)
        else:
            data[section][key] = val.strip('"')

    return data


gov = read_gov(GOV)
errors: list[str] = []
notes: list[str] = []

project_name = gov.get("project", {}).get("name") or ROOT.name
entries = sorted(os.listdir(ROOT))


def size_of(rel: str) -> int | None:
    p = ROOT / rel
    return p.stat().st_size if p.exists() else None


# ---------------------------------------------------------------- 1. 白名单
allowed_dirs = set(gov.get("dirs", {}).get("allowed_dirs", []))
allowed_files = set(gov.get("dirs", {}).get("allowed_files", []))
ALWAYS_OK = {".git", "node_modules"}

if not allowed_dirs and not allowed_files:
    notes.append("gov.toml [dirs] 为空 —— 白名单未启用（建议运行 init 生成）")
else:
    for name in entries:
        if name in ALWAYS_OK:
            continue
        full = ROOT / name
        if full.is_dir():
            if name not in allowed_dirs:
                errors.append(
                    f"根目录出现未登记目录：{name}/  → 加到 gov.toml [dirs].allowed_dirs，"
                    "或挪进 .tmp/ / 产物目录"
                )
        elif name not in allowed_files:
            errors.append(
                f"根目录出现未登记文件：{name}  → 加到 gov.toml [dirs].allowed_files，或挪进 .tmp/"
            )


# ---------------------------------------------------------------- 2. 禁用命名
def to_regexes(patterns: list[str]) -> list[re.Pattern]:
    out = []
    for p in patterns:
        try:
            flags = re.IGNORECASE if p.startswith("(?i)") else 0
            out.append(re.compile(p[4:] if flags else p, flags))
        except re.error:
            errors.append(f"gov.toml 里的正则写错了：{p}")
    return out


forbid = gov.get("forbid", {})
dir_res = to_regexes(forbid.get("dir_patterns", []))
file_res = to_regexes(forbid.get("file_patterns", []))

for name in entries:
    res = dir_res if (ROOT / name).is_dir() else file_res
    if any(r.search(name) for r in res):
        errors.append(
            f"命中禁用命名：{name}  → 构建产物统一放固定目录，临时产物统一 .tmp/<任务ID>/，计划写进 .spec/"
        )

# ---------------------------------------------------------------- 3. 预算
budget = gov.get("budget", {})
layout = gov.get("layout", {})

budget_checks = [
    ("AGENTS.md", budget.get("agents_bytes"), "唯一入口"),
    (".memory/MEMORY.md", budget.get("memory_bytes"), "跨会话状态页"),
    (".memory/PITFALLS.md", budget.get("pitfalls_bytes"), "判据与实证"),
    (layout.get("tasks_index", ".spec/tasks/index.md"), budget.get("index_bytes"), "任务索引"),
    (layout.get("roadmap_index", ".spec/roadmap/INDEX.md"), budget.get("roadmap_bytes"), "里程碑索引"),
]

for rel, limit, label in budget_checks:
    s = size_of(rel)
    if s is None:
        continue
    if limit and s > limit:
        errors.append(f"超预算：{rel} {s}B > {limit}B（{label}）")
    elif limit:
        notes.append(f"{rel}  {s}/{limit}B  ({round(s / limit * 100)}%)")


def scan_detail(dir_rel: str, filename: str, label: str) -> None:
    d = ROOT / dir_rel
    if not d.exists():
        return
    card_limit = budget.get("card_bytes")
    for e in sorted(d.iterdir()):
        if not e.is_dir() or e.name in ("archive", "assets"):
            continue
        rel = f"{dir_rel}/{e.name}/{filename}"
        s = size_of(rel)
        if s is None:
            errors.append(f"{label} {e.name} 缺少 {filename}（应在 {dir_rel}/{e.name}/ 下）")
        elif card_limit and s > card_limit:
            errors.append(
                f"超预算：{rel} {s}B > {card_limit}B（{label}详情）→ 过程挪去 log.md 或 .tmp/，只留结论"
            )


scan_detail(layout.get("tasks_dir", ".spec/tasks"), "card.md", "任务卡")
scan_detail(layout.get("roadmap_dir", ".spec/roadmap"), "milestone.md", "里程碑")

# ---------------------------------------------------------------- 4. 必需文件
for rel in gov.get("required", {}).get("files", []):
    if not (ROOT / rel).exists():
        errors.append(f"缺少必需文件：{rel}")


# ---------------------------------------------------------------- 5. 索引 ↔ 目录一致性
ID_RE = re.compile(r"^\|\s*([A-Z]{1,3}\d[\w.-]*)\s*\|")


def ids_from_index(rel: str) -> set[str] | None:
    p = ROOT / rel
    if not p.exists():
        return None
    ids: set[str] = set()
    for line in p.read_text(encoding="utf-8").splitlines():
        m = ID_RE.match(line)
        if m:
            ids.add(m.group(1))
    return ids


def dirs_in(rel: str, ignore: list[str]) -> list[str]:
    d = ROOT / rel
    if not d.exists():
        return []
    return [e.name for e in d.iterdir() if e.is_dir() and e.name not in ignore]


ignore_dirs = layout.get("tasks_ignore", ["archive", "assets"])


def consistency(index_rel: str, dir_rel: str, label: str) -> None:
    ids = ids_from_index(index_rel)
    if ids is None:
        return
    dirs = dirs_in(dir_rel, ignore_dirs)

    for i in sorted(ids):
        if i not in dirs:
            errors.append(f"{label}：索引里有 {i}，但 {dir_rel}/{i}/ 不存在（建目录 + 详情文件）")
    for d in sorted(dirs):
        if d not in ids:
            errors.append(f"{label}：{dir_rel}/{d}/ 存在，但 {index_rel} 里没有登记（补一行，或删掉目录）")


consistency(
    layout.get("tasks_index", ".spec/tasks/index.md"),
    layout.get("tasks_dir", ".spec/tasks"),
    "任务卡",
)
consistency(
    layout.get("roadmap_index", ".spec/roadmap/INDEX.md"),
    layout.get("roadmap_dir", ".spec/roadmap"),
    "里程碑",
)

# ---------------------------------------------------------------- 输出
print(f"\n治理检查  {project_name}\n")
for n in notes:
    print(f"  · {n}")

if not errors:
    print("\n  ✅ 全部通过\n")
    sys.exit(0)

print(f"\n  ❌ {len(errors)} 项违规：\n")
for e in errors:
    print(f"  - {e}")
print()
sys.exit(1)
