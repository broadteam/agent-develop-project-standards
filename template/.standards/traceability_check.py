#!/usr/bin/env python3
"""Traceability integrity checks shared by the Node and Python governance gates."""
from __future__ import annotations
import re
from pathlib import Path

def validate_traceability(root: Path) -> list[str]:
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
    task_index, roadmap_index = read(".spec/tasks/index.md"), read(".spec/roadmap/INDEX.md")
    goals = unique([r[0] for r in rows(baseline) if re.fullmatch(r"G\d+", r[0]) and not placeholder(r)], "G")
    change_headings = [m for m in re.finditer(r"^###\s+(C\d+)\s+—\s+(.+)$", changes_text, re.M) if not re.search(r"简短标题|示例", m.group(2))]
    changes = unique([m.group(1) for m in change_headings], "C")
    change_statuses: dict[str, str] = {}
    for match in change_headings:
        start = match.end()
        next_heading = changes_text.find("\n### ", start)
        block = changes_text[start:] if next_heading < 0 else changes_text[start:next_heading]
        status_match = re.search(r"^- 状态：(.+)$", block, re.M)
        change_statuses[match.group(1)] = status_match.group(1).strip() if status_match else ""
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
    task_statuses: dict[str, str] = {}
    for row in rows(task_index):
        task_id = row[0]
        if not re.fullmatch(r"T\d+", task_id):
            continue
        task_statuses[task_id] = row[2] if len(row) > 2 else ""
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
        alignment_match = re.search(r"^- 意图对齐：(.+)$", card, re.M)
        alignment_mode = alignment_match.group(1).strip() if alignment_match else ""
        task_status = task_statuses.get(task_id, "")
        if alignment_mode and alignment_mode not in {"required", "not_applicable"}:
            errors.append(f"意图对齐：任务 {task_id} 的意图对齐模式非法：{alignment_mode}")
        if alignment_mode == "not_applicable" and task_status in {"in_progress", "blocked", "review", "done"}:
            waiver_match = re.search(r"^- 意图对齐豁免原因：(.+)$", card, re.M)
            waiver = waiver_match.group(1).strip() if waiver_match else ""
            if not waiver or re.search(r"（|\\(|待填写|TODO", waiver, re.I):
                errors.append(f"意图对齐：任务 {task_id} 标记 not_applicable 时必须说明豁免原因")
            if refs["goals"] or refs["reqs"]:
                errors.append(f"意图对齐：任务 {task_id} 有目标/需求关联时不能标记 not_applicable")
        if alignment_mode == "required" and task_status in {"in_progress", "blocked", "review", "done"}:
            def section(heading: str) -> str:
                marker = "## " + heading
                at = card.find(marker)
                if at < 0:
                    return ""
                start = card.find("\n", at) + 1
                next_heading = card.find("\n## ", start)
                return card[start:] if next_heading < 0 else card[start:next_heading]
            def alignment_field(body: str, label: str) -> str:
                found = re.search(r"^- " + re.escape(label) + r"：(.+)$", body, re.M)
                return found.group(1).strip() if found else ""
            kickoff = section("开工意图对齐")
            if not kickoff:
                errors.append(f"意图对齐：任务 {task_id} 缺少开工意图对齐记录")
            anchor_text = alignment_field(kickoff, "对齐目标与需求")
            kickoff_goals, kickoff_reqs = re.findall(r"G\d+", anchor_text), re.findall(r"R\d+", anchor_text)
            kickoff_changes = re.findall(r"C\d+", alignment_field(kickoff, "已接受变更"))
            if not kickoff_goals and "supporting:" not in anchor_text:
                errors.append(f"意图对齐：任务 {task_id} 开工记录缺少目标或 supporting 说明")
            for ref in kickoff_goals:
                if ref not in goals: errors.append(f"意图对齐：任务 {task_id} 开工记录引用了不存在的目标 {ref}")
            for ref in kickoff_reqs:
                if ref not in requirements: errors.append(f"意图对齐：任务 {task_id} 开工记录引用了不存在的需求 {ref}")
            for ref in refs["goals"]:
                if ref not in kickoff_goals: errors.append(f"意图对齐：任务 {task_id} 开工记录遗漏关联目标 {ref}")
            for ref in refs["reqs"]:
                if ref not in kickoff_reqs: errors.append(f"意图对齐：任务 {task_id} 开工记录遗漏关联需求 {ref}")
            for ref in kickoff_changes:
                if ref not in refs["changes"]:
                    errors.append(f"意图对齐：任务 {task_id} 开工记录的变更 {ref} 未关联到任务")
                if change_statuses.get(ref) != "accepted":
                    errors.append(f"意图对齐：任务 {task_id} 开工记录引用了非 accepted 变更 {ref}")
            for ref in refs["changes"]:
                if change_statuses.get(ref) == "accepted" and ref not in kickoff_changes:
                    errors.append(f"意图对齐：任务 {task_id} 开工记录未覆盖当前 accepted 变更 {ref}")
            for label in ["预期贡献", "保留约束"]:
                value = alignment_field(kickoff, label)
                if not value or re.search(r"（|\(|待填写|TODO", value, re.I):
                    errors.append(f"意图对齐：任务 {task_id} 开工记录缺少有效的{label}")
            if task_status in {"review", "done"}:
                closeout = section("收口意图对齐")
                if not closeout:
                    errors.append(f"意图对齐：任务 {task_id} 进入 {task_status} 前缺少收口意图对齐记录")
                outcome = alignment_field(closeout, "结论")
                difference = alignment_field(closeout, "计划与实际差异")
                reason = alignment_field(closeout, "偏离理由")
                proof = alignment_field(closeout, "实现依据")
                evidence_refs = re.findall(r"V\d+", alignment_field(closeout, "验证证据"))
                confirmed_changes = re.findall(r"C\d+", alignment_field(closeout, "对应已确认变更"))
                impact = alignment_field(closeout, "目标/需求影响")
                next_action = alignment_field(closeout, "未解决问题/后续动作")
                if outcome not in {"aligned", "justified_adjustment", "user_confirmed_change", "unresolved_drift"}:
                    errors.append(f"意图对齐：任务 {task_id} 收口结论非法或缺失")
                for label, value in [("计划与实际差异", difference), ("目标/需求影响", impact), ("未解决问题/后续动作", next_action)]:
                    if not value or re.search(r"（|\(|待填写|TODO", value, re.I):
                        errors.append(f"意图对齐：任务 {task_id} 收口记录缺少有效的{label}")
                if not re.search(r"[a-f0-9]{40}", proof, re.I) and not re.match(r"no-code[:：]\s*.+", proof, re.I):
                    errors.append(f"意图对齐：任务 {task_id} 收口记录缺少完整 Commit SHA 或 no-code 原因")
                for ref in evidence_refs:
                    if ref not in evidence_records:
                        errors.append(f"意图对齐：任务 {task_id} 收口记录引用了不存在的验证证据 {ref}")
                if outcome == "justified_adjustment" and (not reason or reason in {"无", "—"}):
                    errors.append(f"意图对齐：任务 {task_id} 的 justified_adjustment 必须说明偏离理由")
                if outcome == "user_confirmed_change" and not confirmed_changes:
                    errors.append(f"意图对齐：任务 {task_id} 的 user_confirmed_change 必须填写对应的 accepted C 记录")
                for ref in confirmed_changes:
                    if ref not in refs["changes"] or change_statuses.get(ref) != "accepted":
                        errors.append(f"意图对齐：任务 {task_id} 的收口变更 {ref} 未关联到任务或不是 accepted")
                if task_status == "done" and outcome == "unresolved_drift":
                    errors.append(f"意图对齐：任务 {task_id} 存在 unresolved_drift，不能标记 done")

    milestone_refs: dict[str, dict] = {}
    milestone_rows = [row for row in rows(roadmap_index) if re.fullmatch(r\"M\\d+\", row[0])]
    milestone_statuses = {row[0]: (row[3] if len(row) > 3 else \"\") for row in milestone_rows}
    for row in milestone_rows:
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


    for milestone_id, milestone_status in milestone_statuses.items():
        if milestone_status != "已完成":
            continue
        detail = read(f".spec/roadmap/{milestone_id}/milestone.md")
        if not detail or "示例里程碑" in detail.split("\n")[0]:
            continue
        mode_match = re.search(r"^- 意图对齐：(.+)$", detail, re.M)
        mode = mode_match.group(1).strip() if mode_match else ""
        if mode != "required":
            if mode == "not_applicable":
                waiver_match = re.search(r"^- 意图对齐豁免原因：(.+)$", detail, re.M)
                waiver = waiver_match.group(1).strip() if waiver_match else ""
                if not waiver or re.search(r"（|\(|待填写|TODO", waiver, re.I):
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的 not_applicable 必须说明原因")
            else:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 必须显式启用意图对齐审查")
            continue
        def milestone_section(heading: str) -> str:
            marker = "## " + heading
            at = detail.find(marker)
            if at < 0:
                return ""
            start = detail.find("\n", at) + 1
            next_heading = detail.find("\n## ", start)
            return detail[start:] if next_heading < 0 else detail[start:next_heading]
        def milestone_field(body: str, label: str) -> str:
            found = re.search(r"^- " + re.escape(label) + r"：(.+)$", body, re.M)
            return found.group(1).strip() if found else ""
        review = milestone_section("里程碑意图对齐回顾")
        if not review:
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少意图对齐回顾")
        goal_proof = milestone_field(review, "目标成功判据对照")
        delivery_proof = milestone_field(review, "实际交付与依据")
        coverage = milestone_field(review, "需求验收覆盖")
        outcome = milestone_field(review, "偏离结论")
        reason = milestone_field(review, "偏离理由及已确认变化")
        unresolved = milestone_field(review, "未解决漂移")
        next_action = milestone_field(review, "后续动作")
        for label, value in [("目标成功判据对照", goal_proof), ("实际交付与依据", delivery_proof), ("需求验收覆盖", coverage), ("未解决漂移", unresolved), ("后续动作", next_action)]:
            if not value or re.search(r"（|\(|待填写|TODO", value, re.I):
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少有效的{label}")
        if outcome not in {"aligned", "justified_adjustment", "user_confirmed_change"}:
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的偏离结论非法或仍有 unresolved_drift")
        if outcome == "justified_adjustment" and (not reason or reason in {"无", "—"}):
            errors.append(f"意图对齐：里程碑 {milestone_id} 的 justified_adjustment 必须说明理由")
        if outcome == "user_confirmed_change":
            confirmed = re.findall(r"C\d+", reason)
            if not confirmed or any(change_statuses.get(ref) != "accepted" for ref in confirmed):
                errors.append(f"意图对齐：里程碑 {milestone_id} 的 user_confirmed_change 必须引用 accepted C 记录")
        if unresolved and unresolved.lower() not in {"无", "—", "none"}:
            errors.append(f"意图对齐：里程碑 {milestone_id} 仍有未解决漂移，不能标记已完成")
        delivery_sha_match = re.search(r"\b[a-f0-9]{40}\b", delivery_proof, re.I)
        if not delivery_sha_match and not re.match(r"no-code[:：]\s*.+", delivery_proof, re.I):
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的实际交付与依据必须包含完整 Commit SHA 或 no-code 原因")
        coverage_vs, coverage_cs = re.findall(r"V\d+", coverage), re.findall(r"C\d+", coverage)
        for ref in coverage_vs:
            if ref not in evidence_records:
                errors.append(f"意图对齐：里程碑 {milestone_id} 引用了不存在的验证证据 {ref}")
        for ref in coverage_cs:
            if change_statuses.get(ref) != "accepted":
                errors.append(f"意图对齐：里程碑 {milestone_id} 引用了非 accepted 变更 {ref}")
        refs = milestone_refs.get(milestone_id, {"goals": [], "reqs": []})
        for req_id in refs["reqs"]:
            req = requirements.get(req_id)
            if not req:
                continue
            if req["status"] == "verified":
                covered = any(ref in evidence_records and evidence_records[ref]["result"] == "pass" and req_id in evidence_records[ref]["covers"] for ref in coverage_vs)
                if not covered:
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少需求 {req_id} 的 pass 验收证据")
            elif req["status"] in {"deferred", "withdrawn"}:
                decisions = [ref for ref in re.findall(r"C\d+", req.get("source", "")) if change_statuses.get(ref) == "accepted"]
                if not decisions or not any(ref in coverage_cs for ref in decisions):
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的需求 {req_id} 缺少 accepted defer/withdrawal 决策")
            else:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的需求 {req_id} 尚未 verified 或经用户确认暂缓/撤回")
        task_section = milestone_section("包含的卡")
        included_tasks = re.findall(r"^\|\s*(T\d+)\s*\|", task_section, re.M)
        for task_id in included_tasks:
            task_status = task_statuses.get(task_id, "")
            if not task_status:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 引用了不存在的任务 {task_id}")
            elif task_status not in {"done", "dropped"}:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的任务 {task_id} 尚未 done/dropped")
            if task_status == "dropped":
                refs = task_refs.get(task_id, {})
                if not any(change_statuses.get(ref) == "accepted" for ref in refs.get("changes", [])):
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的 dropped 任务 {task_id} 缺少 accepted C 记录")

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
    return errors
