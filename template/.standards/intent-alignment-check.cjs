'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validateIntentAlignment(root) {
  const errors = [];
  const read = (rel) => {
    const file = path.join(root, rel);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  };
  const rows = (content) => content.split('\n')
    .filter(line => /^\|\s*[A-Z][A-Z0-9]*\d+\s*\|/.test(line))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
  const field = (body, label) => {
    const match = body.match(new RegExp('^- ' + label + '：(.+)$', 'm'));
    return match ? match[1].trim() : '';
  };
  const section = (content, heading) => {
    const marker = '## ' + heading;
    const at = content.indexOf(marker);
    if (at < 0) return '';
    const start = content.indexOf('\n', at) + 1;
    const next = content.indexOf('\n## ', start);
    return content.slice(start, next < 0 ? undefined : next);
  };
  const placeholder = (value) => !value || /（|\(|待填写|TODO|TBD/i.test(value);
  const refs = (value, regex) => value.match(regex) || [];

  const baseline = read('.spec/intent/BASELINE.md');
  const changesText = read('.spec/intent/CHANGES.md');
  const requirementsText = read('.spec/requirements/INDEX.md');
  const verificationText = read('.spec/verification/INDEX.md');
  const taskIndex = read('.spec/tasks/index.md');
  const roadmapIndex = read('.spec/roadmap/INDEX.md');

  const goals = new Set(rows(baseline)
    .filter(row => /^G\d+$/.test(row[0]) && !row.some(placeholder))
    .map(row => row[0]));

  const changeStatuses = new Map();
  const changeHeadings = [...changesText.matchAll(/^###\s+(C\d+)\s+—\s+(.+)$/gm)]
    .filter(match => !/简短标题|示例/.test(match[2]));
  for (const match of changeHeadings) {
    const start = match.index + match[0].length;
    const next = changesText.indexOf('\n### ', start);
    const block = changesText.slice(start, next < 0 ? undefined : next);
    changeStatuses.set(match[1], field(block, '状态'));
  }

  const requirements = new Map();
  for (const row of rows(requirementsText)) {
    if (!/^R\d+$/.test(row[0]) || row.some(placeholder)) continue;
    requirements.set(row[0], { status: row[4] || '', source: row[5] || '', evidence: row[6] || '' });
  }

  const evidenceRecords = new Map();
  const evidenceHeadings = [...verificationText.matchAll(/^###\s+(V\d+)\s+—\s+(.+)$/gm)]
    .filter(match => !/简短验证名称|示例/.test(match[2]));
  for (const match of evidenceHeadings) {
    const start = match.index + match[0].length;
    const next = verificationText.indexOf('\n### ', start);
    const block = verificationText.slice(start, next < 0 ? undefined : next);
    evidenceRecords.set(match[1], {
      covers: refs(field(block, '覆盖需求'), /R\d+/g),
      result: field(block, '结果'),
      commit: field(block, 'Commit'),
      evidence: field(block, '证据')
    });
  }

  const taskRows = rows(taskIndex).filter(row => /^T\d+$/.test(row[0]));
  const taskStatuses = new Map(taskRows.map(row => [row[0], row[2] || '']));
  const taskRefs = new Map();

  for (const taskId of taskStatuses.keys()) {
    const card = read('.spec/tasks/' + taskId + '/card.md');
    if (!card || /示例卡/.test(card.split('\n')[0])) continue;
    const taskRef = {
      goals: refs(field(card, '关联目标'), /G\d+/g),
      reqs: refs(field(card, '关联需求'), /R\d+/g),
      changes: refs(field(card, '关联变更'), /C\d+/g)
    };
    taskRefs.set(taskId, taskRef);

    const mode = field(card, '意图对齐');
    const createdAt = field(card, '创建日期');
    const status = taskStatuses.get(taskId);
    if (createdAt && !/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) errors.push('意图对齐：任务 ' + taskId + ' 的创建日期格式必须为 YYYY-MM-DD');
    if (!mode) {
      if (createdAt) errors.push('意图对齐：新建任务 ' + taskId + ' 缺少意图对齐模式；新任务必须显式 required 或 not_applicable');
      continue; // Legacy cards without a creation date remain compatible.
    }
    if (!['required', 'not_applicable'].includes(mode)) {
      errors.push('意图对齐：任务 ' + taskId + ' 的意图对齐模式非法：' + mode);
      continue;
    }
    if (mode === 'not_applicable') {
      if (['in_progress', 'blocked', 'review', 'done'].includes(status)) {
        const waiver = field(card, '意图对齐豁免原因');
        if (placeholder(waiver) || waiver === '—') {
          errors.push('意图对齐：任务 ' + taskId + ' 标记 not_applicable 时必须说明豁免原因');
        }
        if (taskRef.goals.length || taskRef.reqs.length) {
          errors.push('意图对齐：任务 ' + taskId + ' 有目标/需求关联时不能标记 not_applicable');
        }
      }
      continue;
    }
    if (!['in_progress', 'blocked', 'review', 'done'].includes(status)) continue;

    const kickoff = section(card, '开工意图对齐');
    if (!kickoff) errors.push('意图对齐：任务 ' + taskId + ' 缺少开工意图对齐记录');
    const anchor = field(kickoff, '对齐目标与需求');
    const kickoffGoals = refs(anchor, /G\d+/g);
    const kickoffReqs = refs(anchor, /R\d+/g);
    const kickoffChanges = refs(field(kickoff, '已接受变更'), /C\d+/g);
    if (!kickoffGoals.length && !/supporting:/.test(anchor)) {
      errors.push('意图对齐：任务 ' + taskId + ' 开工记录缺少目标或 supporting 说明');
    }
    for (const ref of kickoffGoals) {
      if (!goals.has(ref)) errors.push('意图对齐：任务 ' + taskId + ' 开工记录引用了不存在的目标 ' + ref);
    }
    for (const ref of kickoffReqs) {
      if (!requirements.has(ref)) errors.push('意图对齐：任务 ' + taskId + ' 开工记录引用了不存在的需求 ' + ref);
    }
    for (const ref of taskRef.goals) {
      if (!kickoffGoals.includes(ref)) errors.push('意图对齐：任务 ' + taskId + ' 开工记录遗漏关联目标 ' + ref);
    }
    for (const ref of taskRef.reqs) {
      if (!kickoffReqs.includes(ref)) errors.push('意图对齐：任务 ' + taskId + ' 开工记录遗漏关联需求 ' + ref);
    }
    for (const ref of kickoffChanges) {
      if (!taskRef.changes.includes(ref)) errors.push('意图对齐：任务 ' + taskId + ' 开工记录的变更 ' + ref + ' 未关联到任务');
      if (changeStatuses.get(ref) !== 'accepted') {
        errors.push('意图对齐：任务 ' + taskId + ' 开工记录引用了非 accepted 变更 ' + ref);
      }
    }
    for (const ref of taskRef.changes) {
      if (changeStatuses.get(ref) === 'accepted' && !kickoffChanges.includes(ref)) {
        errors.push('意图对齐：任务 ' + taskId + ' 开工记录未覆盖当前 accepted 变更 ' + ref);
      }
    }
    for (const label of ['预期贡献', '保留约束']) {
      if (placeholder(field(kickoff, label))) {
        errors.push('意图对齐：任务 ' + taskId + ' 开工记录缺少有效的' + label);
      }
    }

    if (!['review', 'done'].includes(status)) continue;
    const closeout = section(card, '收口意图对齐');
    if (!closeout) errors.push('意图对齐：任务 ' + taskId + ' 进入 ' + status + ' 前缺少收口意图对齐记录');
    const outcome = field(closeout, '结论');
    const difference = field(closeout, '计划与实际差异');
    const reason = field(closeout, '偏离理由');
    const proof = field(closeout, '实现依据');
    const verificationText = field(closeout, '验证证据');
    const evidenceRefs = refs(verificationText, /V\d+/g);
    const confirmedChanges = refs(field(closeout, '对应已确认变更'), /C\d+/g);
    const impact = field(closeout, '目标/需求影响');
    const nextAction = field(closeout, '未解决问题/后续动作');
    if (!['aligned', 'justified_adjustment', 'user_confirmed_change', 'unresolved_drift'].includes(outcome)) {
      errors.push('意图对齐：任务 ' + taskId + ' 收口结论非法或缺失');
    }
    for (const [label, value] of [
      ['计划与实际差异', difference],
      ['目标/需求影响', impact],
      ['未解决问题/后续动作', nextAction]
    ]) {
      if (placeholder(value)) errors.push('意图对齐：任务 ' + taskId + ' 收口记录缺少有效的' + label);
    }
    const shaMatch = proof.match(/\b[a-f0-9]{40}\b/i);
    const proofSha = shaMatch ? shaMatch[0].toLowerCase() : '';
    if (!proofSha && !/^no-code[:：]\s*.+/i.test(proof)) {
      errors.push('意图对齐：任务 ' + taskId + ' 收口记录缺少完整 Commit SHA 或 no-code 原因');
    }
    if (!evidenceRefs.length) {
      if (placeholder(verificationText) || !/(命令|步骤)/.test(verificationText) ||
          !/(结果|通过|失败|pass|fail|partial)/i.test(verificationText)) {
        errors.push('意图对齐：任务 ' + taskId + ' 必须引用 Vnnn，或填写可复现验证步骤及结果');
      }
    }
    for (const ref of evidenceRefs) {
      const record = evidenceRecords.get(ref);
      if (!record) {
        errors.push('意图对齐：任务 ' + taskId + ' 收口记录引用了不存在的验证证据 ' + ref);
      } else {
        if (taskRef.reqs.length && !taskRef.reqs.some(reqId => record.covers.includes(reqId))) {
          errors.push('意图对齐：任务 ' + taskId + ' 的验证证据 ' + ref + ' 未覆盖该任务关联需求');
        }
        if (proofSha && record.commit.toLowerCase() !== proofSha) {
          errors.push('意图对齐：任务 ' + taskId + ' 的验证证据 ' + ref + ' 与收口 Commit SHA 不一致');
        }
        if (status === 'done' && record.result !== 'pass') errors.push('意图对齐：任务 ' + taskId + ' 标记 done，但验证证据 ' + ref + ' 不是 pass');
      }
    }
    if (outcome === 'justified_adjustment' && (!reason || reason === '无' || reason === '—')) {
      errors.push('意图对齐：任务 ' + taskId + ' 的 justified_adjustment 必须说明偏离理由');
    }
    if (outcome === 'user_confirmed_change' && !confirmedChanges.length) {
      errors.push('意图对齐：任务 ' + taskId + ' 的 user_confirmed_change 必须填写对应的 accepted C 记录');
    }
    for (const ref of confirmedChanges) {
      if (!taskRef.changes.includes(ref) || changeStatuses.get(ref) !== 'accepted') {
        errors.push('意图对齐：任务 ' + taskId + ' 的收口变更 ' + ref + ' 未关联到任务或不是 accepted');
      }
    }
    if (status === 'done' && outcome === 'unresolved_drift') {
      errors.push('意图对齐：任务 ' + taskId + ' 存在 unresolved_drift，不能标记 done');
    }
  }

  const milestoneRows = rows(roadmapIndex).filter(row => /^M\d+$/.test(row[0]));
  const milestoneStatuses = new Map(milestoneRows.map(row => [row[0], row[3] || '']));
  const milestoneRefs = new Map();
  for (const row of milestoneRows) {
    const milestoneId = row[0];
    const detail = read('.spec/roadmap/' + milestoneId + '/milestone.md');
    if (!detail || /示例里程碑/.test(detail.split('\n')[0])) continue;
    const goalsIn = refs(field(detail, '目标'), /G\d+/g);
    const reqsIn = refs(field(detail, '需求'), /R\d+/g);
    const mode = field(detail, '意图对齐');
    const createdAt = field(detail, '创建日期');
    if (createdAt && !/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) errors.push('意图对齐：里程碑 ' + milestoneId + ' 的创建日期格式必须为 YYYY-MM-DD');
    if (createdAt && !mode) errors.push('意图对齐：新建里程碑 ' + milestoneId + ' 缺少意图对齐模式；新里程碑必须显式 required 或 not_applicable');
    if (mode && !['required', 'not_applicable'].includes(mode)) errors.push('意图对齐：里程碑 ' + milestoneId + ' 的意图对齐模式非法：' + mode);
    milestoneRefs.set(milestoneId, { goals: goalsIn, reqs: reqsIn });
    for (const ref of goalsIn) {
      if (!goals.has(ref)) errors.push('追踪关系：里程碑 ' + milestoneId + ' 引用了不存在的目标 ' + ref);
    }
    for (const ref of reqsIn) {
      if (!requirements.has(ref)) errors.push('追踪关系：里程碑 ' + milestoneId + ' 引用了不存在的需求 ' + ref);
    }
  }

  for (const [milestoneId, milestoneStatus] of milestoneStatuses) {
    if (milestoneStatus !== '已完成') continue;
    const detail = read('.spec/roadmap/' + milestoneId + '/milestone.md');
    if (!detail || /示例里程碑/.test(detail.split('\n')[0])) continue;
    const mode = field(detail, '意图对齐');
    if (!mode) continue; // Existing milestones opt in explicitly.
    if (mode === 'not_applicable') {
      const waiver = field(detail, '意图对齐豁免原因');
      const refsForMilestone = milestoneRefs.get(milestoneId) || { goals: [], reqs: [] };
      if (placeholder(waiver) || waiver === '—') {
        errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的 not_applicable 必须说明原因');
      }
      if (refsForMilestone.goals.length || refsForMilestone.reqs.length) {
        errors.push('意图对齐：里程碑 ' + milestoneId + ' 有目标/需求关联时不能标记 not_applicable');
      }
      continue;
    }
    if (mode !== 'required') {
      errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的意图对齐模式非法：' + mode);
      continue;
    }

    const review = section(detail, '里程碑意图对齐回顾');
    if (!review) errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 缺少意图对齐回顾');
    const goalProof = field(review, '目标成功判据对照');
    const deliveryProof = field(review, '实际交付与依据');
    const coverage = field(review, '需求验收覆盖');
    const outcome = field(review, '偏离结论');
    const reason = field(review, '偏离理由及已确认变化');
    const unresolved = field(review, '未解决漂移');
    const nextAction = field(review, '后续动作');
    for (const [label, value] of [
      ['目标成功判据对照', goalProof],
      ['实际交付与依据', deliveryProof],
      ['需求验收覆盖', coverage],
      ['未解决漂移', unresolved],
      ['后续动作', nextAction]
    ]) {
      if (placeholder(value)) errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 缺少有效的' + label);
    }
    if (!['aligned', 'justified_adjustment', 'user_confirmed_change'].includes(outcome)) {
      errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的偏离结论非法或仍有 unresolved_drift');
    }
    if (outcome === 'justified_adjustment' && (!reason || reason === '无' || reason === '—')) {
      errors.push('意图对齐：里程碑 ' + milestoneId + ' 的 justified_adjustment 必须说明理由');
    }
    if (outcome === 'user_confirmed_change') {
      const confirmed = refs(reason, /C\d+/g);
      if (!confirmed.length || confirmed.some(ref => changeStatuses.get(ref) !== 'accepted')) {
        errors.push('意图对齐：里程碑 ' + milestoneId + ' 的 user_confirmed_change 必须引用 accepted C 记录');
      }
    }
    if (unresolved && !['无', '—', 'none'].includes(unresolved.toLowerCase())) {
      errors.push('意图对齐：里程碑 ' + milestoneId + ' 仍有未解决漂移，不能标记已完成');
    }
    const deliveryShas = new Set([...deliveryProof.matchAll(/\b[a-f0-9]{40}\b/gi)].map(match => match[0].toLowerCase()));
    if (!deliveryShas.size && !/^no-code[:：]\s*.+/i.test(deliveryProof)) {
      errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的实际交付与依据必须包含完整 Commit SHA 或 no-code 原因');
    }
    const coverageVs = refs(coverage, /V\d+/g);
    const coverageCs = refs(coverage, /C\d+/g);
    for (const ref of coverageVs) {
      const record = evidenceRecords.get(ref);
      if (!record) errors.push('意图对齐：里程碑 ' + milestoneId + ' 引用了不存在的验证证据 ' + ref);
      else if (deliveryShas.size && !deliveryShas.has(record.commit.toLowerCase())) errors.push('意图对齐：里程碑 ' + milestoneId + ' 的验证证据 ' + ref + ' 不属于里程碑交付 Commit 集合');
    }
    for (const ref of coverageCs) {
      if (changeStatuses.get(ref) !== 'accepted') errors.push('意图对齐：里程碑 ' + milestoneId + ' 引用了非 accepted 变更 ' + ref);
    }
    const reqRefs = (milestoneRefs.get(milestoneId) || { reqs: [] }).reqs;
    for (const reqId of reqRefs) {
      const req = requirements.get(reqId);
      if (!req) continue;
      if (req.status === 'verified') {
        const covered = coverageVs.some(ref => {
          const record = evidenceRecords.get(ref);
          return record && record.result === 'pass' && record.covers.includes(reqId);
        });
        if (!covered) errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 缺少需求 ' + reqId + ' 的 pass 验收证据');
      } else if (['deferred', 'withdrawn'].includes(req.status)) {
        const decisions = refs(req.source, /C\d+/g).filter(ref => changeStatuses.get(ref) === 'accepted');
        if (!decisions.length || !decisions.some(ref => coverageCs.includes(ref))) {
          errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的需求 ' + reqId + ' 缺少 accepted defer/withdrawal 决策');
        }
      } else {
        errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的需求 ' + reqId + ' 尚未 verified 或经用户确认暂缓/撤回');
      }
    }
    const taskSection = section(detail, '包含的卡');
    const includedTasks = [...taskSection.matchAll(/^\|\s*(T\d+)\s*\|/gm)].map(match => match[1]);
    for (const taskId of includedTasks) {
      const status = taskStatuses.get(taskId);
      if (!status) {
        errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 引用了不存在的任务 ' + taskId);
      } else if (!['done', 'dropped'].includes(status)) {
        errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的任务 ' + taskId + ' 尚未 done/dropped');
      }
      if (status === 'dropped') {
        const task = taskRefs.get(taskId);
        if (!task || !task.changes.some(ref => changeStatuses.get(ref) === 'accepted')) {
          errors.push('意图对齐：已完成里程碑 ' + milestoneId + ' 的 dropped 任务 ' + taskId + ' 缺少 accepted C 记录');
        }
      }
    }
  }

  return errors;
}

module.exports = { validateIntentAlignment };
