#!/usr/bin/env python3
"""Traceability integrity checks shared by the Node and Python governance gates."""
from __future__ import annotations
import re
from pathlib import Path
from intent_alignment_check import validate_intent_alignment

def validate_traceability(root: Path, *, task_tracking: bool = True, roadmap: bool = True) -> list[str]:
    errors: list[str] = []
    def read(rel: str) -> str:
        file = root / rel
        return file.read_text(encoding="utf-8").replace("\r\n", "\n") if file.is_file() else ""
    def rows(content: str) -> list[list[str]]:
        result = []
        for line in content.split("\n"):
            if re.match(r"^\|\s*[A-Z][A-Z0-9]*\d+\s*\|", line):
                result.append([cell.strip() for cell in line.split("|")[1:-1]])
        return result
    def placeholder(values: list[str]) -> bool:
        return any(re.search(r"（|\(\s*(?:可观察|用户需要|可重复|命令|报告|CI URL|简短)", value) for value in values)
    def unique(items: list[str], label: str) -> set[str]:
        found: set[str] = set()
        for item in items:
            if item in found:
                errors.append(f"追踪关系：{label} ID {item} 重复")
            found.add(item)
        return found

    baseline, changes_text = read(".spec/intent/BASELINE.md"), read(".spec/intent/CHANGES.md")
    req_text, ver_text = read(".spec/requirements/INDEX.md"), read(".spec/verification/INDEX.md")
    task_index = read(".spec/tasks/index.md") if task_tracking else ""
    roadmap_index = read(".spec/roadmap/INDEX.md") if roadmap else ""
    goals = unique([r[0] for r in rows(baseline) if re.fullmatch(r"G\d+", r[0]) and not placeholder(r)], "G")
    changes = unique([m.group(1) for m in re.finditer(r"^###\s+(C\d+)\s+—\s+(.+)$", changes_text, re.M) if not re.search(r"简短标题|示例", m.group(2))], "C")
    requirements: dict[str, dict] = {}
    for row in rows(req_text):
        if not re.fullmatch(r"R\d+", row[0]) or placeholder(row):
            continue
        req_id, target_cell, _, acceptance, status, source, evidence = row[:7]
        if req_id in requirements:
            errors.append(f"追踪关系：需求 ID {req_id} 重复")
        targets = re.findall(r"G\d+", target_cell)
        requirements[req_id] = {"targets": targets, "status": status, "evidence": evidence}
        if status not in {"proposed","accepted","in_progress","implemented","verified","deferred","withdrawn"}:
            errors.append(f"追踪关系：需求 {req_id} 状态非法：{status}")
        if not target_cell.startswith("supporting:") and "none" not in target_cell and "—" not in target_cell and "G" not in target_cell:
            errors.append(f"追踪关系：需求 {req_id} 缺少有效目标或 supporting 说明")
        for target in targets:
            if target not in goals:
                errors.append(f"追踪关系：需求 {req_id} 引用了不存在的目标 {target}")
        for change in re.findall(r"C\d+", source):
            if change not in changes:
                errors.append(f"追踪关系：需求 {req_id} 引用了不存在的变更 {change}")

    evidence_records: dict[str, dict] = {}
    headings = [m for m in re.finditer(r"^###\s+(V\d+)\s+—\s+(.+)$", ver_text, re.M) if not re.search(r"简短验证名称|示例", m.group(2))]
    for match in headings:
        start = match.end()
        next_heading = ver_text.find("\n### ", start)
        block = ver_text[start:] if next_heading < 0 else ver_text[start:next_heading]
        def field(name: str) -> str:
            found = re.search(r"^- " + re.escape(name) + r"：(.+)$", block, re.M)
            return found.group(1).strip() if found else ""
        covers, result, commit, evidence = re.findall(r"R\d+", field("覆盖需求")), field("结果"), field("Commit"), field("证据")
        if match.group(1) in evidence_records:
            errors.append(f"追踪关系：验证证据 ID {match.group(1)} 重复")
        evidence_records[match.group(1)] = {"covers": covers, "result": result, "commit": commit, "evidence": evidence}
        if result not in {"pass","fail","partial"}:
            errors.append(f"追踪关系：验证证据 {match.group(1)} 结果非法或缺失")
        if not re.fullmatch(r"[a-f0-9]{40}", commit, re.I):
            errors.append(f"追踪关系：验证证据 {match.group(1)} 缺少完整 40 位 Commit SHA")
        if not evidence or re.search(r"（|\(|CI URL", evidence):
            errors.append(f"追踪关系：验证证据 {match.group(1)} 缺少具体证据位置")
        for req_id in covers:
            if req_id not in requirements:
                errors.append(f"追踪关系：验证证据 {match.group(1)} 覆盖了不存在的需求 {req_id}")
    for row in rows(ver_text):
        if re.fullmatch(r"V\d+", row[0]) and not placeholder(row) and row[0] not in evidence_records:
            errors.append(f"追踪关系：索引中的验证证据 {row[0]} 缺少详情记录")

    task_refs: dict[str, dict] = {}
    for row in (rows(task_index) if task_tracking else []):
        task_id = row[0]
        if not re.fullmatch(r"T\d+", task_id):
            continue
        card = read(f".spec/tasks/{task_id}/card.md")
        if not card or "示例卡" in card.split("\n")[0]:
            continue
        def card_field(label: str) -> str:
            found = re.search(r"^- " + label + r"：(.+)$", card, re.M)
            return found.group(1) if found else ""
        goal_cell, req_cell, change_cell = card_field("关联目标"), card_field("关联需求"), card_field("关联变更")
        refs = {"goals": re.findall(r"G\d+", goal_cell), "reqs": re.findall(r"R\d+", req_cell), "changes": re.findall(r"C\d+", change_cell)}
        task_refs[task_id] = refs
        for ref in refs["goals"]:
            if ref not in goals: errors.append(f"追踪关系：任务 {task_id} 引用了不存在的目标 {ref}")
        for ref in refs["reqs"]:
            if ref not in requirements: errors.append(f"追踪关系：任务 {task_id} 引用了不存在的需求 {ref}")
        for ref in refs["changes"]:
            if ref not in changes: errors.append(f"追踪关系：任务 {task_id} 引用了不存在的变更 {ref}")
        if not refs["goals"] and "supporting:" not in goal_cell and (goals or requirements):
            errors.append(f"追踪关系：任务 {task_id} 必须关联目标或说明 supporting 关系")

    milestone_refs: dict[str, dict] = {}
    for row in (rows(roadmap_index) if roadmap else []):
        milestone_id = row[0]
        if not re.fullmatch(r"M\d+", milestone_id):
            continue
        detail = read(f".spec/roadmap/{milestone_id}/milestone.md")
        if not detail or "示例里程碑" in detail.split("\n")[0]:
            continue
        goal_match = re.search(r"^- 目标：(.+)$", detail, re.M)
        req_match = re.search(r"^- 需求：(.+)$", detail, re.M)
        goals_in = re.findall(r"G\d+", goal_match.group(1) if goal_match else "")
        reqs_in = re.findall(r"R\d+", req_match.group(1) if req_match else "")
        milestone_refs[milestone_id] = {"goals": goals_in, "reqs": reqs_in}
        for ref in goals_in:
            if ref not in goals: errors.append(f"追踪关系：里程碑 {milestone_id} 引用了不存在的目标 {ref}")
        for ref in reqs_in:
            if ref not in requirements: errors.append(f"追踪关系：里程碑 {milestone_id} 引用了不存在的需求 {ref}")

    for req_id, req in requirements.items():
        if req["status"] in {"accepted","in_progress","implemented","verified"}:
            has_task = any(req_id in refs["reqs"] for refs in task_refs.values())
            has_pass = any(v["result"] == "pass" and req_id in v["covers"] for v in evidence_records.values())
            if not has_task and not has_pass:
                errors.append(f"追踪关系：活跃需求 {req_id} 没有任务或通过的验证证据")
        if req["status"] == "verified":
            declared = re.findall(r"V\d+", req.get("evidence", ""))
            if not declared or any(item not in evidence_records or evidence_records[item]["result"] != "pass" or req_id not in evidence_records[item]["covers"] for item in declared):
                errors.append(f"追踪关系：需求 {req_id} 的验证指针无效或未覆盖该需求")
            valid = any(v["result"] == "pass" and req_id in v["covers"] and re.fullmatch(r"[a-f0-9]{40}", v["commit"], re.I) and v["evidence"] and not re.search(r"（|\(|CI URL", v["evidence"]) for v in evidence_records.values())
            if not valid:
                errors.append(f"追踪关系：需求 {req_id} 标记 verified，但没有有效 pass 证据")
    for goal in goals:
        has_req = any(goal in req["targets"] and req["status"] in {"accepted","in_progress","implemented","verified"} for req in requirements.values())
        has_task = any(goal in refs["goals"] for refs in task_refs.values())
        if not has_req and not has_task:
            errors.append(f"追踪关系：活跃目标 {goal} 没有需求或任务承接")
    errors.extend(validate_intent_alignment(root, task_tracking=task_tracking, roadmap=roadmap))
    return errors
