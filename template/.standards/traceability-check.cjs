'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validateTraceability(root) {
  const errors = [];
  const read = (rel) => { const file = path.join(root, rel); return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : ''; };
  const rows = (text) => text.split('\n').filter(line => /^\|\s*[A-Z][A-Z0-9]*\d+\s*\|/.test(line)).map(line => line.split('|').slice(1, -1).map(x => x.trim()));
  const isPlaceholder = (values) => values.some(value => /（|\(\s*(?:可观察|用户需要|可重复|命令|报告|CI URL|简短)/.test(value));
  const unique = (items, label) => {
    const result = new Set();
    for (const id of items) { if (result.has(id)) errors.push(`追踪关系：${label} ID ${id} 重复`); result.add(id); }
    return result;
  };
  const baseline = read('.spec/intent/BASELINE.md');
  const changesText = read('.spec/intent/CHANGES.md');
  const reqText = read('.spec/requirements/INDEX.md');
  const verText = read('.spec/verification/INDEX.md');
  const taskIndex = read('.spec/tasks/index.md');
  const roadmapIndex = read('.spec/roadmap/INDEX.md');
  const goals = unique(rows(baseline).filter(r => /^G\d+$/.test(r[0]) && !isPlaceholder(r)).map(r => r[0]), 'G');
  const changeHeadings = [...changesText.matchAll(/^###\s+(C\d+)\s+—\s+(.+)$/gm)].filter(m => !/简短标题|示例/.test(m[2]));
  const changes = unique(changeHeadings.map(m => m[1]), 'C');
  const changeStatuses = new Map();
  for (const match of changeHeadings) {
    const start = match.index + match[0].length;
    const next = changesText.indexOf('\n### ', start);
    const block = changesText.slice(start, next < 0 ? undefined : next);
    const status = (block.match(/^- 状态：(.+)$/m) || [,''])[1].trim();
    changeStatuses.set(match[1], status);
  }
  const requirements = new Map();
  for (const r of rows(reqText)) {
    if (!/^R\d+$/.test(r[0]) || isPlaceholder(r)) continue;
    const [id, targetCell, , acceptance, status, source, evidence] = r;
    if (requirements.has(id)) errors.push(`追踪关系：需求 ID ${id} 重复`);
    requirements.set(id, { targets: targetCell.match(/G\d+/g) || [], acceptance, status, source, evidence });
    if (!['proposed','accepted','in_progress','implemented','verified','deferred','withdrawn'].includes(status)) errors.push(`追踪关系：需求 ${id} 状态非法：${status}`);
    if (!targetCell.startsWith('supporting:') && !targetCell.includes('none') && !targetCell.includes('—') && !targetCell.includes('G')) errors.push(`追踪关系：需求 ${id} 缺少有效目标或 supporting 说明`);
    for (const target of targetCell.match(/G\d+/g) || []) if (!goals.has(target)) errors.push(`追踪关系：需求 ${id} 引用了不存在的目标 ${target}`);
    for (const change of source.match(/C\d+/g) || []) if (!changes.has(change)) errors.push(`追踪关系：需求 ${id} 引用了不存在的变更 ${change}`);
  }
  const evidenceRecords = new Map();
  const evidenceHeadings = [...verText.matchAll(/^###\s+(V\d+)\s+—\s+(.+)$/gm)].filter(m => !/简短验证名称|示例/.test(m[2]));
  for (const match of evidenceHeadings) {
    const start = match.index + match[0].length;
    const next = verText.indexOf('\n### ', start);
    const block = verText.slice(start, next < 0 ? undefined : next);
    const field = (name) => (block.match(new RegExp('^- '+name+'：(.+)$','m')) || [,''])[1].trim();
    const covers = field('覆盖需求').match(/R\d+/g) || [];
    const result = field('结果');
    const commit = field('Commit');
    const evidence = field('证据');
    if (evidenceRecords.has(match[1])) errors.push(`追踪关系：验证证据 ID ${match[1]} 重复`);
    evidenceRecords.set(match[1], { covers, result, commit, evidence, block });
    if (!['pass','fail','partial'].includes(result)) errors.push(`追踪关系：验证证据 ${match[1]} 结果非法或缺失`);
    if (!/^[a-f0-9]{40}$/i.test(commit)) errors.push(`追踪关系：验证证据 ${match[1]} 缺少完整 40 位 Commit SHA`);
    if (!evidence || /（|\(|CI URL/.test(evidence)) errors.push(`追踪关系：验证证据 ${match[1]} 缺少具体证据位置`);
    for (const id of covers) if (!requirements.has(id)) errors.push(`追踪关系：验证证据 ${match[1]} 覆盖了不存在的需求 ${id}`);
  }
  for (const r of rows(verText)) {
    if (!/^V\d+$/.test(r[0]) || isPlaceholder(r)) continue;
    if (!evidenceRecords.has(r[0])) errors.push(`追踪关系：索引中的验证证据 ${r[0]} 缺少详情记录`);
  }
  const taskRows = rows(taskIndex).filter(r => /^T\d+$/.test(r[0]));
  const taskIds = taskRows.map(r => r[0]);
  const taskStatuses = new Map(taskRows.map(r => [r[0], r[2] || '']));
  const taskRefs = new Map();
  for (const id of taskIds) {
    const card = read(`.spec/tasks/${id}/card.md`);
    if (!card || /示例卡/.test(card.split('\n')[0])) continue;
    const get = (label) => (card.match(new RegExp('^- '+label+'：(.+)$','m')) || [,''])[1];
    const goalCell = get('关联目标'), reqCell = get('关联需求'), changeCell = get('关联变更');
    const refs = { goals: goalCell.match(/G\d+/g)||[], reqs:reqCell.match(/R\d+/g)||[], changes:changeCell.match(/C\d+/g)||[] };
    taskRefs.set(id, refs);
    for (const x of refs.goals) if (!goals.has(x)) errors.push(`追踪关系：任务 ${id} 引用了不存在的目标 ${x}`);
    for (const x of refs.reqs) if (!requirements.has(x)) errors.push(`追踪关系：任务 ${id} 引用了不存在的需求 ${x}`);
    for (const x of refs.changes) if (!changes.has(x)) errors.push(`追踪关系：任务 ${id} 引用了不存在的变更 ${x}`);
    if (!refs.goals.length && !/supporting:/.test(goalCell) && (goals.size > 0 || requirements.size > 0)) errors.push(`追踪关系：任务 ${id} 必须关联目标或说明 supporting 关系`);
    const alignmentMode = (card.match(/^- 意图对齐：(.+)$/m) || [,''])[1].trim();
    const taskStatus = taskStatuses.get(id);
    if (alignmentMode && !['required','not_applicable'].includes(alignmentMode)) errors.push('意图对齐：任务 ' + id + ' 的意图对齐模式非法：' + alignmentMode);
    if (alignmentMode === 'not_applicable' && ['in_progress','blocked','review','done'].includes(taskStatus)) {
      const waiver = (card.match(/^- 意图对齐豁免原因：(.+)$/m) || [,''])[1].trim();
      if (!waiver || /（|\\(|待填写|TODO/i.test(waiver)) errors.push('意图对齐：任务 ' + id + ' 标记 not_applicable 时必须说明豁免原因');
      if (refs.goals.length || refs.reqs.length) errors.push('意图对齐：任务 ' + id + ' 有目标/需求关联时不能标记 not_applicable');
    }
    if (alignmentMode === 'required' && ['in_progress','blocked','review','done'].includes(taskStatus)) {
      const section = (heading) => {
        const marker = '## ' + heading;
        const at = card.indexOf(marker);
        if (at < 0) return '';
        const start = card.indexOf('\n', at) + 1;
        const next = card.indexOf('\n## ', start);
        return card.slice(start, next < 0 ? undefined : next);
      };
      const field = (body, label) => (body.match(new RegExp('^- '+label+'：(.+)$','m')) || [,''])[1].trim();
      const kickoff = section('开工意图对齐');
      if (!kickoff) errors.push('意图对齐：任务 ' + id + ' 缺少开工意图对齐记录');
      const anchorText = field(kickoff, '对齐目标与需求');
      const kickoffGoals = anchorText.match(/G\d+/g) || [];
      const kickoffReqs = anchorText.match(/R\d+/g) || [];
      const kickoffChanges = field(kickoff, '已接受变更').match(/C\d+/g) || [];
      if (!kickoffGoals.length && !/supporting:/.test(anchorText)) errors.push('意图对齐：任务 ' + id + ' 开工记录缺少目标或 supporting 说明');
      for (const ref of kickoffGoals) if (!goals.has(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录引用了不存在的目标 ' + ref);
      for (const ref of kickoffReqs) if (!requirements.has(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录引用了不存在的需求 ' + ref);
      for (const ref of refs.goals) if (!kickoffGoals.includes(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录遗漏关联目标 ' + ref);
      for (const ref of refs.reqs) if (!kickoffReqs.includes(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录遗漏关联需求 ' + ref);
      for (const ref of kickoffChanges) {
        if (!refs.changes.includes(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录的变更 ' + ref + ' 未关联到任务');
        if (changeStatuses.get(ref) !== 'accepted') errors.push('意图对齐：任务 ' + id + ' 开工记录引用了非 accepted 变更 ' + ref);
      }
      for (const ref of refs.changes) if (changeStatuses.get(ref) === 'accepted' && !kickoffChanges.includes(ref)) errors.push('意图对齐：任务 ' + id + ' 开工记录未覆盖当前 accepted 变更 ' + ref);
      for (const label of ['预期贡献','保留约束']) {
        const value = field(kickoff, label);
        if (!value || /（|\(|待填写|TODO/i.test(value)) errors.push('意图对齐：任务 ' + id + ' 开工记录缺少有效的' + label);
      }
      if (['review','done'].includes(taskStatus)) {
        const closeout = section('收口意图对齐');
        if (!closeout) errors.push('意图对齐：任务 ' + id + ' 进入 ' + taskStatus + ' 前缺少收口意图对齐记录');
        const outcome = field(closeout, '结论');
        const difference = field(closeout, '计划与实际差异');
        const reason = field(closeout, '偏离理由');
        const proof = field(closeout, '实现依据');
        const evidenceRefs = field(closeout, '验证证据').match(/V\d+/g) || [];
        const confirmedChanges = field(closeout, '对应已确认变更').match(/C\d+/g) || [];
        const impact = field(closeout, '目标/需求影响');
        const next = field(closeout, '未解决问题/后续动作');
        if (!['aligned','justified_adjustment','user_confirmed_change','unresolved_drift'].includes(outcome)) errors.push('意图对齐：任务 ' + id + ' 收口结论非法或缺失');
        for (const item of [['计划与实际差异',difference],['目标/需求影响',impact],['未解决问题/后续动作',next]]) if (!item[1] || /（|\(|待填写|TODO/i.test(item[1])) errors.push('意图对齐：任务 ' + id + ' 收口记录缺少有效的' + item[0]);
        if (!/[a-f0-9]{40}/i.test(proof) && !/^no-code[:：]\s*.+/i.test(proof)) errors.push('意图对齐：任务 ' + id + ' 收口记录缺少完整 Commit SHA 或 no-code 原因');
        for (const ref of evidenceRefs) if (!evidenceRecords.has(ref)) errors.push('意图对齐：任务 ' + id + ' 收口记录引用了不存在的验证证据 ' + ref);
        if (outcome === 'justified_adjustment' && (!reason || reason === '无' || reason === '—')) errors.push('意图对齐：任务 ' + id + ' 的 justified_adjustment 必须说明偏离理由');
        if (outcome === 'user_confirmed_change' && !confirmedChanges.length) errors.push('意图对齐：任务 ' + id + ' 的 user_confirmed_change 必须填写对应的 accepted C 记录');
        for (const ref of confirmedChanges) if (!refs.changes.includes(ref) || changeStatuses.get(ref) !== 'accepted') errors.push('意图对齐：任务 ' + id + ' 的收口变更 ' + ref + ' 未关联到任务或不是 accepted');
        if (taskStatus === 'done' && outcome === 'unresolved_drift') errors.push('意图对齐：任务 ' + id + ' 存在 unresolved_drift，不能标记 done');
      }
    }
  }
  const milestoneIds = rows(roadmapIndex).filter(r => /^M\d+$/.test(r[0])).map(r => r[0]);
  const milestoneRefs = new Map();
  for (const id of milestoneIds) {
    const file = read(`.spec/roadmap/${id}/milestone.md`);
    if (!file || /示例里程碑/.test(file.split('\n')[0])) continue;
    const goalCell = (file.match(/^- 目标：(.+)$/m)||[,''])[1];
    const reqCell = (file.match(/^- 需求：(.+)$/m)||[,''])[1];
    const refs={goals:goalCell.match(/G\d+/g)||[],reqs:reqCell.match(/R\d+/g)||[]};
    milestoneRefs.set(id,refs);
    for(const x of refs.goals) if(!goals.has(x)) errors.push(`追踪关系：里程碑 ${id} 引用了不存在的目标 ${x}`);
    for(const x of refs.reqs) if(!requirements.has(x)) errors.push(`追踪关系：里程碑 ${id} 引用了不存在的需求 ${x}`);
  }

  for (const id of milestoneIds) {
    if (milestoneStatuses.get(id) !== '已完成') continue;
    const file = read(\`.spec/roadmap/\${id}/milestone.md\`);
    if (!file || /示例里程碑/.test(file.split('\n')[0])) continue;
    const mode = (file.match(/^- 意图对齐：(.+)$/m) || [,''])[1].trim();
    if (mode !== 'required') {
      if (mode === 'not_applicable') {
        const waiver = (file.match(/^- 意图对齐豁免原因：(.+)$/m) || [,''])[1].trim();
        if (!waiver || /（|\(|待填写|TODO/i.test(waiver)) errors.push(\`意图对齐：已完成里程碑 \${id} 的 not_applicable 必须说明原因\`);
      } else {
        errors.push(\`意图对齐：已完成里程碑 \${id} 必须显式启用意图对齐审查\`);
      }
      continue;
    }
    const section = (heading) => {
      const marker = '## ' + heading;
      const at = file.indexOf(marker);
      if (at < 0) return '';
      const start = file.indexOf('\n', at) + 1;
      const next = file.indexOf('\n## ', start);
      return file.slice(start, next < 0 ? undefined : next);
    };
    const field = (body, label) => (body.match(new RegExp('^- ' + label + '：(.+)
    if (['accepted','in_progress','implemented','verified'].includes(req.status)) {
      const hasTask=[...taskRefs.values()].some(ref=>ref.reqs.includes(id));
      const hasPass=[...evidenceRecords.values()].some(v=>v.result==='pass'&&v.covers.includes(id));
      if (!hasTask && !hasPass) errors.push(`追踪关系：活跃需求 ${id} 没有任务或通过的验证证据`);
    }
    if (req.status==='verified') {
      const declared = req.evidence.match(/V\d+/g) || [];
      const valid=[...evidenceRecords.values()].some(v=>v.result==='pass'&&v.covers.includes(id)&&/^[a-f0-9]{40}$/i.test(v.commit)&&v.evidence&&!/（|\(|CI URL/.test(v.evidence));
      if (!declared.length || declared.some(v => !evidenceRecords.has(v) || evidenceRecords.get(v).result !== 'pass' || !evidenceRecords.get(v).covers.includes(id))) errors.push(`追踪关系：需求 ${id} 的验证指针无效或未覆盖该需求`);
      if (!valid) errors.push(`追踪关系：需求 ${id} 标记 verified，但没有有效 pass 证据`);
    }
  }
  for (const goal of goals) {
    const hasRequirement=[...requirements.values()].some(r=>r.targets.includes(goal)&&['accepted','in_progress','implemented','verified'].includes(r.status));
    const hasTask=[...taskRefs.values()].some(r=>r.goals.includes(goal));
    if (!hasRequirement && !hasTask) errors.push(`追踪关系：活跃目标 ${goal} 没有需求或任务承接`);
  }
  return errors;
}
module.exports = { validateTraceability };
, 'm')) || [,''])[1].trim();
    const review = section('里程碑意图对齐回顾');
    if (!review) errors.push(\`意图对齐：已完成里程碑 \${id} 缺少意图对齐回顾\`);
    const goalProof = field(review, '目标成功判据对照');
    const deliveryProof = field(review, '实际交付与依据');
    const coverage = field(review, '需求验收覆盖');
    const outcome = field(review, '偏离结论');
    const reason = field(review, '偏离理由及已确认变化');
    const unresolved = field(review, '未解决漂移');
    const nextAction = field(review, '后续动作');
    for (const [label, value] of [['目标成功判据对照',goalProof],['实际交付与依据',deliveryProof],['需求验收覆盖',coverage],['未解决漂移',unresolved],['后续动作',nextAction]]) {
      if (!value || /（|\(|待填写|TODO/i.test(value)) errors.push(\`意图对齐：已完成里程碑 \${id} 缺少有效的\${label}\`);
    }
    if (!['aligned','justified_adjustment','user_confirmed_change'].includes(outcome)) errors.push(\`意图对齐：已完成里程碑 \${id} 的偏离结论非法或仍有 unresolved_drift\`);
    if (outcome === 'justified_adjustment' && (!reason || reason === '无' || reason === '—')) errors.push(\`意图对齐：里程碑 \${id} 的 justified_adjustment 必须说明理由\`);
    if (outcome === 'user_confirmed_change') {
      const confirmed = reason.match(/C\d+/g) || [];
      if (!confirmed.length || confirmed.some(ref => changeStatuses.get(ref) !== 'accepted')) errors.push(\`意图对齐：里程碑 \${id} 的 user_confirmed_change 必须引用 accepted C 记录\`);
    }
    if (unresolved && !['无','—','none'].includes(unresolved.toLowerCase())) errors.push(\`意图对齐：里程碑 \${id} 仍有未解决漂移，不能标记已完成\`);
    const deliverySha = (deliveryProof.match(/\b[a-f0-9]{40}\b/i) || [])[0] || '';
    if (!deliverySha && !/^no-code[:：]\s*.+/i.test(deliveryProof)) errors.push(\`意图对齐：已完成里程碑 \${id} 的实际交付与依据必须包含完整 Commit SHA 或 no-code 原因\`);
    const coverageVs = coverage.match(/V\d+/g) || [];
    const coverageCs = coverage.match(/C\d+/g) || [];
    for (const ref of coverageVs) if (!evidenceRecords.has(ref)) errors.push(\`意图对齐：里程碑 \${id} 引用了不存在的验证证据 \${ref}\`);
    for (const ref of coverageCs) if (changeStatuses.get(ref) !== 'accepted') errors.push(\`意图对齐：里程碑 \${id} 引用了非 accepted 变更 \${ref}\`);
    const reqRefs = milestoneRefs.get(id)?.reqs || [];
    for (const reqId of reqRefs) {
      const req = requirements.get(reqId);
      if (!req) continue;
      if (req.status === 'verified') {
        const covered = coverageVs.some(v => {
          const record = evidenceRecords.get(v);
          return record && record.result === 'pass' && record.covers.includes(reqId);
        });
        if (!covered) errors.push(\`意图对齐：已完成里程碑 \${id} 缺少需求 \${reqId} 的 pass 验收证据\`);
      } else if (['deferred','withdrawn'].includes(req.status)) {
        const decisions = (req.source.match(/C\d+/g) || []).filter(ref => changeStatuses.get(ref) === 'accepted');
        if (!decisions.length || !decisions.some(ref => coverageCs.includes(ref))) errors.push(\`意图对齐：已完成里程碑 \${id} 的需求 \${reqId} 缺少 accepted defer/withdrawal 决策\`);
      } else {
        errors.push(\`意图对齐：已完成里程碑 \${id} 的需求 \${reqId} 尚未 verified 或经用户确认暂缓/撤回\`);
      }
    }
    const taskSection = section('包含的卡');
    const includedTasks = [...taskSection.matchAll(/^\|\s*(T\d+)\s*\|/gm)].map(m => m[1]);
    for (const taskId of includedTasks) {
      const taskStatus = taskStatuses.get(taskId);
      if (!taskStatus) errors.push(\`意图对齐：已完成里程碑 \${id} 引用了不存在的任务 \${taskId}\`);
      else if (!['done','dropped'].includes(taskStatus)) errors.push(\`意图对齐：已完成里程碑 \${id} 的任务 \${taskId} 尚未 done/dropped\`);
      if (taskStatus === 'dropped') {
        const refs = taskRefs.get(taskId);
        if (!refs || !refs.changes.some(ref => changeStatuses.get(ref) === 'accepted')) errors.push(\`意图对齐：已完成里程碑 \${id} 的 dropped 任务 \${taskId} 缺少 accepted C 记录\`);
      }
    }
  }

  for (const [id, req] of requirements) {
    if (['accepted','in_progress','implemented','verified'].includes(req.status)) {
      const hasTask=[...taskRefs.values()].some(ref=>ref.reqs.includes(id));
      const hasPass=[...evidenceRecords.values()].some(v=>v.result==='pass'&&v.covers.includes(id));
      if (!hasTask && !hasPass) errors.push(`追踪关系：活跃需求 ${id} 没有任务或通过的验证证据`);
    }
    if (req.status==='verified') {
      const declared = req.evidence.match(/V\d+/g) || [];
      const valid=[...evidenceRecords.values()].some(v=>v.result==='pass'&&v.covers.includes(id)&&/^[a-f0-9]{40}$/i.test(v.commit)&&v.evidence&&!/（|\(|CI URL/.test(v.evidence));
      if (!declared.length || declared.some(v => !evidenceRecords.has(v) || evidenceRecords.get(v).result !== 'pass' || !evidenceRecords.get(v).covers.includes(id))) errors.push(`追踪关系：需求 ${id} 的验证指针无效或未覆盖该需求`);
      if (!valid) errors.push(`追踪关系：需求 ${id} 标记 verified，但没有有效 pass 证据`);
    }
  }
  for (const goal of goals) {
    const hasRequirement=[...requirements.values()].some(r=>r.targets.includes(goal)&&['accepted','in_progress','implemented','verified'].includes(r.status));
    const hasTask=[...taskRefs.values()].some(r=>r.goals.includes(goal));
    if (!hasRequirement && !hasTask) errors.push(`追踪关系：活跃目标 ${goal} 没有需求或任务承接`);
  }
  return errors;
}
module.exports = { validateTraceability };
