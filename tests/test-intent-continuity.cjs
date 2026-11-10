#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const baseline = read('template/.spec/intent/BASELINE.md');
const changes = read('template/.spec/intent/CHANGES.md');
const agentsText = read('template/AGENTS.md');
const routerText = read('template/ROUTER.md');
const card = read('template/.spec/tasks/T1/card.md');
const milestone = read('template/.spec/roadmap/M1/milestone.md');
const gov = read('template/gov.toml');
const resolverText = read('template/.standards/task-context-resolver.cjs');
const ci = read('.github/workflows/standards-ci.yml');

assert.match(baseline, /项目原始目标基线/);
assert.match(baseline, /用户明确陈述与 Agent 推断/);
assert.match(baseline, /确认后不得静默改写/);
assert.match(baseline, /可验证成功判据/);
assert.match(baseline, /project_adoption/);
assert.match(baseline, /G001/);
assert.match(baseline, /Non-goals/);

for (const type of ['clarification','correction','addition','scope_change','reprioritization','defer','withdrawal','restore']) {
  assert.ok(changes.includes(type), 'missing change type: ' + type);
}
assert.match(changes, /追加式记录/);
assert.match(changes, /agent_proposed/);
assert.match(changes, /不得自行升级为用户决定/);
assert.match(changes, /不复制聊天全文/);
assert.match(changes, /不等于取消其他目标/);
assert.match(changes, /当前有效状态以基线加所有适用的 accepted 记录推导/);
assert.match(changes, /每轮对话的意图检查协议/);
for (const kind of ['continuation', 'clarification', 'bounded_interruption', 'intent_change', 'conflict_or_ambiguity']) {
  assert.ok(changes.includes(kind), 'missing conversation intent classification: ' + kind);
}
assert.match(changes, /pending 不进入当前有效意图/);
assert.match(changes, /保护中断现场/);
assert.match(changes, /只向用户提出一个最关键的澄清问题/);
assert.match(changes, /恢复与收口做偏离检查/);
const memory = read('template/.memory/MEMORY.md');
assert.match(memory, /G\/R\/T ID/);
assert.match(memory, /pending Cnnn/);
assert.match(memory, /恢复原断点/);


assert.match(agentsText, /CHANGES\.md/);
assert.match(changes, /局部修复不代表整体目标完成/);
assert.match(routerText, /原始目标基线与变更账本/);
assert.match(card, /关联目标：G001/);
assert.match(card, /关联变更：C001/);
assert.match(milestone, /关联目标/);
assert.match(milestone, /局部任务全部完成替代目标验收/);
assert.match(gov, /\.spec\/intent\/BASELINE\.md/);
assert.match(gov, /\.spec\/intent\/CHANGES\.md/);
assert.match(resolverText, /\.spec\/intent\/BASELINE\.md/);
assert.match(resolverText, /\.spec\/intent\/CHANGES\.md/);
assert.match(ci, /test-intent-continuity\.cjs/);

console.log('test-intent-continuity: all cases passed');
