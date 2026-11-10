#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const requirements = read('template/.spec/requirements/INDEX.md');
const verification = read('template/.spec/verification/INDEX.md');
const registry = read('template/.spec/REGISTRY.md');
const card = read('template/.spec/tasks/T1/card.md');
const milestone = read('template/.spec/roadmap/M1/milestone.md');
const gov = read('template/gov.toml');
const ci = read('.github/workflows/standards-ci.yml');

assert.match(requirements, /需求索引/);
assert.match(requirements, /R001/);
for (const state of ['proposed', 'accepted', 'in_progress', 'implemented', 'verified', 'deferred', 'withdrawn']) {
  assert.ok(requirements.includes(state), 'missing requirement state: ' + state);
}
assert.match(requirements, /implemented 不等于 verified/);
assert.match(requirements, /只有存在有效 V 记录/);
assert.match(requirements, /不得为每张任务卡机械创建需求/);
assert.match(requirements, /deferred \/ withdrawn 必须有对应用户确认的 C 记录/);
assert.match(verification, /V001/);
assert.match(verification, /完整 SHA/);
assert.match(verification, /CI run URL/);
assert.match(verification, /partial 不足以将需求标记为 verified/);
assert.match(verification, /一个 V 记录可以证明多个 R/);
assert.match(registry, /Rnnn/);
assert.match(registry, /Vnnn/);
assert.match(card, /关联需求：R001/);
assert.match(card, /不自动证明关联需求或目标已完成/);
assert.match(card, /相关验证证据：Vnnn/);
assert.match(milestone, /需求：R001/);
assert.match(milestone, /V 证据/);
assert.match(milestone, /所有关联需求均已 verified/);
assert.match(gov, /\.spec\/requirements\/INDEX\.md/);
assert.match(gov, /\.spec\/verification\/INDEX\.md/);
assert.match(ci, /test-traceability-contract\.cjs/);

console.log('test-traceability-contract: all cases passed');
