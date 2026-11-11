#!/usr/bin/env python3
"""Task and milestone intent alignment checks. Mirrors intent-alignment-check.cjs."""
from __future__ import annotations

import re
from pathlib import Path


def validate_intent_alignment(root: Path, *, task_tracking: bool = True, roadmap: bool = True) -> list[str]:
    errors: list[str] = []

    def read(rel: str) -> str:
        file = root / rel
        return file.read_text(encoding="utf-8").replace("\r\n", "\n") if file.is_file() else ""

    def rows(content: str) -> list[list[str]]:
        return [
            [cell.strip() for cell in line.split("|")[1:-1]]
            for line in content.split("\n")
            if re.match(r"^\|\s*[A-Z][A-Z0-9]*\d+\s*\|", line)
        ]

    def field(body: str, label: str) -> str:
        match = re.search(r"^- " + re.escape(label) + r"：(.+)$", body, re.M)
        return match.group(1).strip() if match else ""

    def section(content: str, heading: str) -> str:
        marker = "## " + heading
        at = content.find(marker)
        if at < 0:
            return ""
        start = content.find("\n", at) + 1
        next_heading = content.find("\n## ", start)
        return content[start:] if next_heading < 0 else content[start:next_heading]

    def placeholder(value: str) -> bool:
        return not value or re.search(r"（|\(|待填写|TODO|TBD", value, re.I) is not None

    def refs(value: str, pattern: str) -> list[str]:
        return re.findall(pattern, value)

    baseline = read(".spec/intent/BASELINE.md")
    changes_text = read(".spec/intent/CHANGES.md")
    requirements_text = read(".spec/requirements/INDEX.md")
    verification_text = read(".spec/verification/INDEX.md")
    task_index = read(".spec/tasks/index.md") if task_tracking else ""
    roadmap_index = read(".spec/roadmap/INDEX.md") if roadmap else ""

    goals = {
        row[0] for row in rows(baseline)
        if re.fullmatch(r"G\d+", row[0]) and not any(placeholder(cell) for cell in row)
    }

    change_statuses: dict[str, str] = {}
    change_headings = [
        match for match in re.finditer(r"^###\s+(C\d+)\s+—\s+(.+)$", changes_text, re.M)
        if not re.search(r"简短标题|示例", match.group(2))
    ]
    for match in change_headings:
        start = match.end()
        next_heading = changes_text.find("\n### ", start)
        block = changes_text[start:] if next_heading < 0 else changes_text[start:next_heading]
        change_statuses[match.group(1)] = field(block, "状态")

    requirements: dict[str, dict] = {}
    for row in rows(requirements_text):
        if not re.fullmatch(r"R\d+", row[0]) or any(placeholder(cell) for cell in row):
            continue
        req_id, target_cell, _, acceptance, status, source, evidence = row[:7]
        requirements[req_id] = {
            "targets": refs(target_cell, r"G\d+"),
            "status": status,
            "source": source,
            "evidence": evidence,
        }

    evidence_records: dict[str, dict] = {}
    headings = [
        match for match in re.finditer(r"^###\s+(V\d+)\s+—\s+(.+)$", verification_text, re.M)
        if not re.search(r"简短验证名称|示例", match.group(2))
    ]
    for match in headings:
        start = match.end()
        next_heading = verification_text.find("\n### ", start)
        block = verification_text[start:] if next_heading < 0 else verification_text[start:next_heading]
        evidence_records[match.group(1)] = {
            "covers": refs(field(block, "覆盖需求"), r"R\d+"),
            "result": field(block, "结果"),
            "commit": field(block, "Commit"),
            "evidence": field(block, "证据"),
        }

    task_statuses: dict[str, str] = {}
    task_refs: dict[str, dict] = {}
    for row in (rows(task_index) if task_tracking else []):
        task_id = row[0]
        if not re.fullmatch(r"T\d+", task_id):
            continue
        task_statuses[task_id] = row[2] if len(row) > 2 else ""
        card = read(".spec/tasks/" + task_id + "/card.md")
        if not card or "示例卡" in card.split("\n")[0]:
            continue
        task_ref = {
            "goals": refs(field(card, "关联目标"), r"G\d+"),
            "reqs": refs(field(card, "关联需求"), r"R\d+"),
            "changes": refs(field(card, "关联变更"), r"C\d+"),
        }
        task_refs[task_id] = task_ref
        mode = field(card, "意图对齐")
        created_at = field(card, "创建日期")
        status = task_statuses[task_id]
        if created_at and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", created_at):
            errors.append(f"意图对齐：任务 {task_id} 的创建日期格式必须为 YYYY-MM-DD")
        if not mode:
            if created_at:
                errors.append(f"意图对齐：新建任务 {task_id} 缺少意图对齐模式；新任务必须显式 required 或 not_applicable")
            continue  # Legacy cards without a creation date remain compatible.
        if mode not in {"required", "not_applicable"}:
            errors.append(f"意图对齐：任务 {task_id} 的意图对齐模式非法：{mode}")
            continue
        if mode == "not_applicable":
            if status in {"in_progress", "blocked", "review", "done"}:
                waiver = field(card, "意图对齐豁免原因")
                if placeholder(waiver) or waiver == "—":
                    errors.append(f"意图对齐：任务 {task_id} 标记 not_applicable 时必须说明豁免原因")
                if task_ref["goals"] or task_ref["reqs"]:
                    errors.append(f"意图对齐：任务 {task_id} 有目标/需求关联时不能标记 not_applicable")
            continue
        if status not in {"in_progress", "blocked", "review", "done"}:
            continue

        kickoff = section(card, "开工意图对齐")
        if not kickoff:
            errors.append(f"意图对齐：任务 {task_id} 缺少开工意图对齐记录")
        anchor = field(kickoff, "对齐目标与需求")
        kickoff_goals = refs(anchor, r"G\d+")
        kickoff_reqs = refs(anchor, r"R\d+")
        kickoff_changes = refs(field(kickoff, "已接受变更"), r"C\d+")
        if not kickoff_goals and "supporting:" not in anchor:
            errors.append(f"意图对齐：任务 {task_id} 开工记录缺少目标或 supporting 说明")
        for ref in kickoff_goals:
            if ref not in goals:
                errors.append(f"意图对齐：任务 {task_id} 开工记录引用了不存在的目标 {ref}")
        for ref in kickoff_reqs:
            if ref not in requirements:
                errors.append(f"意图对齐：任务 {task_id} 开工记录引用了不存在的需求 {ref}")
        for ref in task_ref["goals"]:
            if ref not in kickoff_goals:
                errors.append(f"意图对齐：任务 {task_id} 开工记录遗漏关联目标 {ref}")
        for ref in task_ref["reqs"]:
            if ref not in kickoff_reqs:
                errors.append(f"意图对齐：任务 {task_id} 开工记录遗漏关联需求 {ref}")
        for ref in kickoff_changes:
            if ref not in task_ref["changes"]:
                errors.append(f"意图对齐：任务 {task_id} 开工记录的变更 {ref} 未关联到任务")
            if change_statuses.get(ref) != "accepted":
                errors.append(f"意图对齐：任务 {task_id} 开工记录引用了非 accepted 变更 {ref}")
        for ref in task_ref["changes"]:
            if change_statuses.get(ref) == "accepted" and ref not in kickoff_changes:
                errors.append(f"意图对齐：任务 {task_id} 开工记录未覆盖当前 accepted 变更 {ref}")
        for label in ["预期贡献", "保留约束"]:
            if placeholder(field(kickoff, label)):
                errors.append(f"意图对齐：任务 {task_id} 开工记录缺少有效的{label}")

        if status not in {"review", "done"}:
            continue
        closeout = section(card, "收口意图对齐")
        if not closeout:
            errors.append(f"意图对齐：任务 {task_id} 进入 {status} 前缺少收口意图对齐记录")
        outcome = field(closeout, "结论")
        difference = field(closeout, "计划与实际差异")
        reason = field(closeout, "偏离理由")
        proof = field(closeout, "实现依据")
        verification_text = field(closeout, "验证证据")
        evidence_refs = refs(verification_text, r"V\d+")
        confirmed_changes = refs(field(closeout, "对应已确认变更"), r"C\d+")
        impact = field(closeout, "目标/需求影响")
        next_action = field(closeout, "未解决问题/后续动作")
        if outcome not in {"aligned", "justified_adjustment", "user_confirmed_change", "unresolved_drift"}:
            errors.append(f"意图对齐：任务 {task_id} 收口结论非法或缺失")
        for label, value in [("计划与实际差异", difference), ("目标/需求影响", impact), ("未解决问题/后续动作", next_action)]:
            if placeholder(value):
                errors.append(f"意图对齐：任务 {task_id} 收口记录缺少有效的{label}")
        sha_match = re.search(r"\b[a-f0-9]{40}\b", proof, re.I)
        proof_sha = sha_match.group(0).lower() if sha_match else ""
        if not proof_sha and not re.match(r"no-code[:：]\s*.+", proof, re.I):
            errors.append(f"意图对齐：任务 {task_id} 收口记录缺少完整 Commit SHA 或 no-code 原因")
        if not evidence_refs:
            if placeholder(verification_text) or not re.search(r"命令|步骤", verification_text) or not re.search(r"结果|通过|失败|pass|fail|partial", verification_text, re.I):
                errors.append(f"意图对齐：任务 {task_id} 必须引用 Vnnn，或填写可复现验证步骤及结果")
        if status == "done" and not evidence_refs and not re.search(r"(?:结果|判定)[:：]?\s*(?:通过|成功|pass(?:ed)?\b)(?![\w])", verification_text, re.I):
            errors.append(f"意图对齐：任务 {task_id} 没有 V 证据却标记 done；可复现验证结果必须明确为 pass/通过")
        for ref in evidence_refs:
            record = evidence_records.get(ref)
            if not record:
                errors.append(f"意图对齐：任务 {task_id} 收口记录引用了不存在的验证证据 {ref}")
            else:
                if task_ref["reqs"] and not any(req_id in record["covers"] for req_id in task_ref["reqs"]):
                    errors.append(f"意图对齐：任务 {task_id} 的验证证据 {ref} 未覆盖该任务关联需求")
                if proof_sha and record["commit"].lower() != proof_sha:
                    errors.append(f"意图对齐：任务 {task_id} 的验证证据 {ref} 与收口 Commit SHA 不一致")
                if status == "done" and record["result"] != "pass":
                    errors.append(f"意图对齐：任务 {task_id} 标记 done，但验证证据 {ref} 不是 pass")
        if outcome == "justified_adjustment" and (not reason or reason in {"无", "—"}):
            errors.append(f"意图对齐：任务 {task_id} 的 justified_adjustment 必须说明偏离理由")
        if outcome == "user_confirmed_change" and not confirmed_changes:
            errors.append(f"意图对齐：任务 {task_id} 的 user_confirmed_change 必须填写对应的 accepted C 记录")
        for ref in confirmed_changes:
            if ref not in task_ref["changes"] or change_statuses.get(ref) != "accepted":
                errors.append(f"意图对齐：任务 {task_id} 的收口变更 {ref} 未关联到任务或不是 accepted")
        if status == "done" and outcome == "unresolved_drift":
            errors.append(f"意图对齐：任务 {task_id} 存在 unresolved_drift，不能标记 done")

    milestone_rows = [row for row in rows(roadmap_index) if re.fullmatch(r"M\d+", row[0])] if roadmap else []
    milestone_statuses = {row[0]: (row[3] if len(row) > 3 else "") for row in milestone_rows}
    milestone_refs: dict[str, dict] = {}
    for row in milestone_rows:
        milestone_id = row[0]
        detail = read(".spec/roadmap/" + milestone_id + "/milestone.md")
        if not detail or "示例里程碑" in detail.split("\n")[0]:
            continue
        goals_in = refs(field(detail, "目标"), r"G\d+")
        reqs_in = refs(field(detail, "需求"), r"R\d+")
        mode = field(detail, "意图对齐")
        created_at = field(detail, "创建日期")
        if created_at and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", created_at):
            errors.append(f"意图对齐：里程碑 {milestone_id} 的创建日期格式必须为 YYYY-MM-DD")
        if created_at and not mode:
            errors.append(f"意图对齐：新建里程碑 {milestone_id} 缺少意图对齐模式；新里程碑必须显式 required 或 not_applicable")
        if mode and mode not in {"required", "not_applicable"}:
            errors.append(f"意图对齐：里程碑 {milestone_id} 的意图对齐模式非法：{mode}")
        milestone_refs[milestone_id] = {"goals": goals_in, "reqs": reqs_in}
        for ref in goals_in:
            if ref not in goals:
                errors.append(f"追踪关系：里程碑 {milestone_id} 引用了不存在的目标 {ref}")
        for ref in reqs_in:
            if ref not in requirements:
                errors.append(f"追踪关系：里程碑 {milestone_id} 引用了不存在的需求 {ref}")

    for milestone_id, milestone_status in milestone_statuses.items():
        if milestone_status != "已完成":
            continue
        detail = read(".spec/roadmap/" + milestone_id + "/milestone.md")
        if not detail or "示例里程碑" in detail.split("\n")[0]:
            continue
        mode = field(detail, "意图对齐")
        if not mode:
            continue
        if mode == "not_applicable":
            waiver = field(detail, "意图对齐豁免原因")
            refs_for_milestone = milestone_refs.get(milestone_id, {"goals": [], "reqs": []})
            if placeholder(waiver) or waiver == "—":
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的 not_applicable 必须说明原因")
            if refs_for_milestone["goals"] or refs_for_milestone["reqs"]:
                errors.append(f"意图对齐：里程碑 {milestone_id} 有目标/需求关联时不能标记 not_applicable")
            continue
        if mode != "required":
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的意图对齐模式非法：{mode}")
            continue
        review = section(detail, "里程碑意图对齐回顾")
        if not review:
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少意图对齐回顾")
        goal_proof = field(review, "目标成功判据对照")
        delivery_proof = field(review, "实际交付与依据")
        coverage = field(review, "需求验收覆盖")
        outcome = field(review, "偏离结论")
        reason = field(review, "偏离理由及已确认变化")
        unresolved = field(review, "未解决漂移")
        next_action = field(review, "后续动作")
        for label, value in [
            ("目标成功判据对照", goal_proof),
            ("实际交付与依据", delivery_proof),
            ("需求验收覆盖", coverage),
            ("未解决漂移", unresolved),
            ("后续动作", next_action),
        ]:
            if placeholder(value):
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少有效的{label}")
        if outcome not in {"aligned", "justified_adjustment", "user_confirmed_change"}:
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的偏离结论非法或仍有 unresolved_drift")
        if outcome == "justified_adjustment" and (not reason or reason in {"无", "—"}):
            errors.append(f"意图对齐：里程碑 {milestone_id} 的 justified_adjustment 必须说明理由")
        if outcome == "user_confirmed_change":
            confirmed = refs(reason, r"C\d+")
            if not confirmed or any(change_statuses.get(ref) != "accepted" for ref in confirmed):
                errors.append(f"意图对齐：里程碑 {milestone_id} 的 user_confirmed_change 必须引用 accepted C 记录")
        if unresolved and unresolved.lower() not in {"无", "—", "none"}:
            errors.append(f"意图对齐：里程碑 {milestone_id} 仍有未解决漂移，不能标记已完成")
        delivery_shas = {match.group(0).lower() for match in re.finditer(r"\b[a-f0-9]{40}\b", delivery_proof, re.I)}
        if not delivery_shas and not re.match(r"no-code[:：]\s*.+", delivery_proof, re.I):
            errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的实际交付与依据必须包含完整 Commit SHA 或 no-code 原因")
        coverage_vs = refs(coverage, r"V\d+")
        coverage_cs = refs(coverage, r"C\d+")
        for ref in coverage_vs:
            record = evidence_records.get(ref)
            if not record:
                errors.append(f"意图对齐：里程碑 {milestone_id} 引用了不存在的验证证据 {ref}")
            elif delivery_shas and record["commit"].lower() not in delivery_shas:
                errors.append(f"意图对齐：里程碑 {milestone_id} 的验证证据 {ref} 不属于里程碑交付 Commit 集合")
        for ref in coverage_cs:
            if change_statuses.get(ref) != "accepted":
                errors.append(f"意图对齐：里程碑 {milestone_id} 引用了非 accepted 变更 {ref}")
        req_ids = milestone_refs.get(milestone_id, {"goals": [], "reqs": []})["reqs"]
        for req_id in req_ids:
            req = requirements.get(req_id)
            if not req:
                continue
            if req["status"] == "verified":
                covered = any(
                    ref in evidence_records
                    and evidence_records[ref]["result"] == "pass"
                    and req_id in evidence_records[ref]["covers"]
                    for ref in coverage_vs
                )
                if not covered:
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 缺少需求 {req_id} 的 pass 验收证据")
            elif req["status"] in {"deferred", "withdrawn"}:
                decisions = [
                    ref for ref in refs(req.get("source", ""), r"C\d+")
                    if change_statuses.get(ref) == "accepted"
                ]
                if not decisions or not any(ref in coverage_cs for ref in decisions):
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的需求 {req_id} 缺少 accepted defer/withdrawal 决策")
            else:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的需求 {req_id} 尚未 verified 或经用户确认暂缓/撤回")
        task_section = section(detail, "包含的卡")
        included_tasks = re.findall(r"^\|\s*(T\d+)\s*\|", task_section, re.M)
        for task_id in included_tasks:
            status = task_statuses.get(task_id, "")
            if not status:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 引用了不存在的任务 {task_id}")
            elif status not in {"done", "dropped"}:
                errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的任务 {task_id} 尚未 done/dropped")
            if status == "dropped":
                task = task_refs.get(task_id, {})
                if not any(change_statuses.get(ref) == "accepted" for ref in task.get("changes", [])):
                    errors.append(f"意图对齐：已完成里程碑 {milestone_id} 的 dropped 任务 {task_id} 缺少 accepted C 记录")

    return errors


__all__ = ["validate_intent_alignment"]
