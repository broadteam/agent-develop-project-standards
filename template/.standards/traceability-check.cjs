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
  const changes = unique([...changesText.matchAll(/^###\s+(C\d+)\s+—\s+(.+)$/gm)].filter(m => !/简短标题|示例/.test(m[2])).map(m => m[1]), 'C');
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
  const taskIds = rows(taskIndex).filter(r => /^T\d+$/.test(r[0])).map(r => r[0]);
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
