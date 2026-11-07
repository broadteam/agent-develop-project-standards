#!/usr/bin/env python3
"""Governance gate; semantics and output are kept in parity with check-governance.cjs."""
from __future__ import annotations
import hashlib
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOV = ROOT / "gov.toml"
if not GOV.exists():
    print("\n找不到 gov.toml，治理检查无法运行。\n")
    sys.exit(1)

# Supported TOML subset: one-line sections, strings, integers and one-line string arrays.
def strip_comment(value: str) -> str:
    quoted = escaped = False
    for i, char in enumerate(value):
        if char == '"' and not escaped:
            quoted = not quoted
        if char == "#" and not quoted:
            return value[:i]
        escaped = char == "\\" and not escaped
        if char != "\\":
            escaped = False
    return value

def read_gov(path: Path) -> dict:
    data: dict[str, dict] = {}
    section = ""
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        sec = re.match(r"^\[([\w.-]+)\]$", line)
        if sec:
            section = sec.group(1)
            data.setdefault(section, {})
            continue
        kv = re.match(r"^([\w.-]+)\s*=\s*(.+)$", line)
        if not kv or not section:
            print(f"gov.toml 语法不受支持：{line}")
            sys.exit(1)
        key, raw_value = kv.group(1), kv.group(2)
        value = strip_comment(raw_value).strip()
        if value.startswith("["):
            if not value.endswith("]"):
                print(f"gov.toml 数组必须写在单行：{key}")
                sys.exit(1)
            data[section][key] = [m.group(1).replace('\\\\', '\\').replace('\\"', '"') for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', value[1:-1])]
        elif value.isdigit():
            data[section][key] = int(value)
        elif value.startswith('"') and value.endswith('"'):
            data[section][key] = value[1:-1]
        else:
            print(f"gov.toml 值不受支持：{key} = {value}")
            sys.exit(1)
    return data

gov = read_gov(GOV)
errors: list[str] = []
notes: list[str] = []
layout = gov.get("layout", {})
project_name = gov.get("project", {}).get("name") or ROOT.name
entries = sorted(os.scandir(ROOT), key=lambda entry: entry.name)

def is_dir(entry: os.DirEntry) -> bool:
    # Match Node Dirent.isDirectory(): symlinks are file-like entries, not traversed.
    return entry.is_dir(follow_symlinks=False)

def size_of(rel: str) -> int | None:
    try:
        return (ROOT / rel).stat().st_size
    except OSError:
        return None

# 1. Root allowlist
allowed_dirs = set(gov.get("dirs", {}).get("allowed_dirs", []))
allowed_files = set(gov.get("dirs", {}).get("allowed_files", []))
always_ok = {".git", "node_modules"}
if not allowed_dirs and not allowed_files:
    notes.append("gov.toml [dirs] 为空 —— 白名单未启用（建议运行 init 生成）")
else:
    for entry in entries:
        name = entry.name
        if name in always_ok:
            continue
        if is_dir(entry):
            if name not in allowed_dirs:
                errors.append(f"根目录出现未登记目录：{name}/  → 加到 gov.toml [dirs].allowed_dirs，或挪进 .tmp/ / 产物目录")
        elif name not in allowed_files:
            errors.append(f"根目录出现未登记文件：{name}  → 加到 gov.toml [dirs].allowed_files，或挪进 .tmp/")

# 2. Forbidden root names
def to_regexes(patterns: list[str]) -> list[re.Pattern]:
    compiled = []
    for pattern in patterns:
        try:
            flags = re.IGNORECASE if pattern.startswith("(?i)") else 0
            compiled.append(re.compile(pattern[4:] if flags else pattern, flags))
        except re.error:
            errors.append(f"gov.toml 里的正则写错了：{pattern}")
    return compiled

forbid = gov.get("forbid", {})
dir_res = to_regexes(forbid.get("dir_patterns", []))
file_res = to_regexes(forbid.get("file_patterns", []))
for entry in entries:
    regexes = dir_res if is_dir(entry) else file_res
    if any(regex.search(entry.name) for regex in regexes):
        errors.append(f"命中禁用命名：{entry.name}  → 构建产物统一放固定目录，临时产物统一 .tmp/<任务ID>/，计划写进 .spec/")

# 3. Budgets
budget = gov.get("budget", {})
budget_checks = [
    ("AGENTS.md", budget.get("agents_bytes"), "唯一入口"),
    (".memory/MEMORY.md", budget.get("memory_bytes"), "跨会话状态页"),
    (".memory/PITFALLS.md", budget.get("pitfalls_bytes"), "判据与实证"),
    (layout.get("tasks_index", ".spec/tasks/index.md"), budget.get("index_bytes"), "任务索引（超了先归档已完成波次）"),
    (layout.get("roadmap_index", ".spec/roadmap/INDEX.md"), budget.get("roadmap_bytes"), "里程碑索引（超了先归档已完成里程碑）"),
]
for rel, limit, label in budget_checks:
    size = size_of(rel)
    if size is None:
        continue
    if limit and size > limit:
        errors.append(f"超预算：{rel} {size}B > {limit}B（{label}）")
    elif limit:
        notes.append(f"{rel}  {size}/{limit}B  ({round(size / limit * 100)}%)")

def scan_detail(dir_rel: str, filename: str, label: str, require_log: bool = False) -> None:
    directory = ROOT / dir_rel
    if not directory.exists():
        return
    for entry in sorted(os.scandir(directory), key=lambda item: item.name):
        if not is_dir(entry) or entry.name in ("archive", "assets"):
            continue
        rel = f"{dir_rel}/{entry.name}/{filename}"
        size = size_of(rel)
        if size is None:
            errors.append(f"{label} {entry.name} 缺少 {filename}（应在 {dir_rel}/{entry.name}/ 下）")
        elif budget.get("card_bytes") and size > budget["card_bytes"]:
            errors.append(f"超预算：{rel} {size}B > {budget['card_bytes']}B（{label}详情）→ 过程挪去 log.md 或 .tmp/，只留结论")
        if require_log and size_of(f"{dir_rel}/{entry.name}/log.md") is None:
            errors.append(f"任务卡 {entry.name} 缺少 log.md（应在 {dir_rel}/{entry.name}/ 下）")

scan_detail(layout.get("tasks_dir", ".spec/tasks"), "card.md", "任务卡", True)
scan_detail(layout.get("roadmap_dir", ".spec/roadmap"), "milestone.md", "里程碑")

# 4. Required files
for rel in gov.get("required", {}).get("files", []):
    if not (ROOT / rel).exists():
        errors.append(f"缺少必需文件：{rel}")

# 5. Active index ↔ directory consistency; archive folders are intentionally excluded.
def table_rows(rel: str, heading: str, status_column: int) -> list[dict] | None:
    path = ROOT / rel
    if not path.exists():
        return None
    rows: list[dict] = []
    active = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            if active:
                break
            if line[3:].startswith(heading):
                active = True
            continue
        if not active:
            continue
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        if len(cells) > status_column and re.match(r"^[A-Z]{1,3}\d[\w.-]*$", cells[0]):
            rows.append({"id": cells[0], "title": cells[1] if len(cells) > 1 else "", "status": cells[status_column]})
    return rows

def consistency(index_rel: str, dir_rel: str, label: str, heading: str, allowed_status: list[str] | None = None, status_column: int = 2, ignore_dirs: list[str] | None = None) -> None:
    rows = table_rows(index_rel, heading, status_column)
    if rows is None:
        return
    seen: set[str] = set()
    for row in rows:
        if row["id"] in seen:
            errors.append(f"{label}：{index_rel} 中 ID {row['id']} 重复")
        seen.add(row["id"])
        if allowed_status is not None and row["status"] not in allowed_status:
            errors.append(f"{label}：{row['id']} 状态非法：{row['status']}")
    directory = ROOT / dir_rel
    ignored = ignore_dirs if ignore_dirs is not None else layout.get("tasks_ignore", ["archive", "assets"])
    dirs = [e.name for e in sorted(os.scandir(directory), key=lambda item: item.name) if is_dir(e) and e.name not in ignored] if directory.exists() else []
    for row in rows:
        if row["id"] not in dirs:
            errors.append(f"{label}：索引里有 {row['id']}，但 {dir_rel}/{row['id']}/ 不存在（建目录 + 详情文件）")
    for name in dirs:
        if name not in seen:
            errors.append(f"{label}：{dir_rel}/{name}/ 存在，但 {index_rel} 里没有登记（补一行，或移入 archive/）")

consistency(layout.get("tasks_index", ".spec/tasks/index.md"), layout.get("tasks_dir", ".spec/tasks"), "任务卡", "当前波次", ["planned", "ready", "in_progress", "review", "done", "blocked", "dropped"], 2, layout.get("tasks_ignore", ["archive", "assets"]))
consistency(layout.get("roadmap_index", ".spec/roadmap/INDEX.md"), layout.get("roadmap_dir", ".spec/roadmap"), "里程碑", "里程碑", ["未开始", "进行中", "已完成", "已放弃"], 3, layout.get("roadmap_ignore", ["archive", "assets"]))

# 6. Generated board freshness
index_path = ROOT / layout.get("tasks_index", ".spec/tasks/index.md")
board_path = ROOT / ".spec/tasks/BOARD.md"
if index_path.exists() and board_path.exists():
    digest = hashlib.sha256(index_path.read_bytes()).hexdigest()
    board_text = board_path.read_text(encoding="utf-8")
    generated = re.search(r"<!-- GENERATED-SHA256: ([a-f0-9]+) -->\r?\n([\s\S]*?)<!-- GENERATED:END -->", board_text)
    body_ok = bool(generated and hashlib.sha256(generated.group(2).encode("utf-8")).hexdigest() == generated.group(1))
    if f"<!-- SOURCE-SHA256: {digest} -->" not in board_text or not body_ok:
        errors.append(".spec/tasks/BOARD.md 已过期或被手工修改，请运行 node scripts/generate-board.cjs")

print(f"\n治理检查  {project_name}\n")
for note in notes:
    print(f"  · {note}")
if not errors:
    print("\n  ✅ 全部通过\n")
    sys.exit(0)
print(f"\n  ❌ {len(errors)} 项违规：\n")
for error in errors:
    print(f"  - {error}")
print()
sys.exit(1)
