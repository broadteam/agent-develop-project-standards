#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateTraceability } = require('../template/.standards/traceability-check.cjs');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-alignment-review-'));
const root = path.join(temp, 'project');
const commit = 'c'.repeat(40);

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function pythonErrors() {
  const script = [
    'import json, sys; sys.dont_write_bytecode = True',
    'from pathlib import Path',
    `sys.path.insert(0, ${JSON.stringify(path.resolve(__dirname, '../template/.standards'))})`,
    'from traceability_check import validate_traceability',
    'print(json.dumps(validate_traceability(Path(sys.argv[1])), ensure_ascii=False))',
  ].join('; ');
  const result = spawnSync(process.env.PYTHON || 'python3', ['-c', script, root], { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}
function assertParity(label, expected = []) {
  const node = validateTraceability(root);
  const python = pythonErrors();
  assert.deepEqual(node, python, label + ': Node/Python output differs');
  for (const fragment of expected) {
    assert.ok(node.some(error => error.includes(fragment)), label + ': missing "' + fragment + '"\n' + node.join('\n'));
  }
  if (!expected.length) assert.deepEqual(node, [], label + ': expected no errors\n' + node.join('\n'));
  return node;
}
function base(status = 'in_progress') {
  write('.spec/intent/BASELINE.md', `# Baseline

| ID | 目标结果 | 优先级 | 来源/确认状态 | 可验证成功判据 |
|---|---|---|---|---|
| G001 | 用户可以创建并查询设备 | P1 | user_request / confirmed | 创建设备后可以通过 API 查询 |
`);
  write('.spec/intent/CHANGES.md', `# Change ledger

### C001 — 明确设备查询范围

- 日期：2026-11-11
- 类型：clarification
- 来源：user_confirmed
- 状态：accepted
- 关联目标：G001
- 关联任务/里程碑/ADR：T1 / M1 / —

**变化内容**

- 原有理解/状态：查询方式尚未明确
- 新增或修正后的明确内容：创建后可通过 API 查询

**决策与影响**

- 用户决定/待确认问题：用户确认
- 对范围、优先级、验收或约束的影响：明确验收
- 需要调整的任务、里程碑或决策：T1
- 后续验证方式：API 集成测试
`);
  write('.spec/requirements/INDEX.md', `# Requirements

| ID | 关联目标 | 需求（可观察结果） | 验收判据 | 状态 | 来源/变更 | 验证 |
|---|---|---|---|---|---|---|
| R001 | G001 | 用户可以创建并查询设备 | POST /devices 返回 201，随后 GET /devices/{id} 返回该设备 | accepted | user_confirmed / C001 | — |
`);
  write('.spec/verification/INDEX.md', '# Verification\n\n## 证据记录\n\n| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |\n|---|---|---|---|---|\n');
  write('.spec/tasks/index.md', `# Tasks

| ID | 标题 | 状态 | 范围 |
|---|---|---|---|
| T1 | 实现设备创建与查询 | ${status} | src/device |
`);
  write('.spec/tasks/T1/card.md', `# T1 Implement device creation and query

- 创建日期：2026-11-11
- 关联目标：G001
- 关联需求：R001
- 关联变更：C001
- 意图对齐：required

## 开工意图对齐

- 对齐目标与需求：G001 / R001
- 已接受变更：C001
- 预期贡献：实现创建设备后可通过 API 查询的完整路径
- 保留约束：租户隔离、现有 API 错误码和数据库兼容性

## 验收

- [ ] 创建设备返回 201
- [ ] 随后查询返回同一设备
`);
  write('.spec/roadmap/INDEX.md', '# Roadmap\n\n## 里程碑\n\n| ID | 里程碑 | 依赖 | 状态 | 包含卡 |\n|---|---|---|---|---|\n');
}

try {
  base();
  assertParity('valid kickoff alignment');

  // Every task association must be present in the kickoff alignment anchor.
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md').replace('对齐目标与需求：G001 / R001', '对齐目标与需求：G001'));
  assertParity('kickoff omits linked requirement', ['开工记录遗漏关联需求 R001']);

  base();
  // A task cannot treat a pending Agent proposal as an accepted intent change.
  write('.spec/intent/CHANGES.md', read('.spec/intent/CHANGES.md').replace('状态：accepted', '状态：pending'));
  assertParity('pending change linked to task', ['开工记录引用了非 accepted 变更 C001']);

  base('done');
  assertParity('done without closeout', ['进入 done 前缺少收口意图对齐记录']);

  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：unresolved_drift
- 计划与实际差异：实际实现绕过租户上下文，与原验收不一致
- 偏离理由：尚未确认是否允许改变租户隔离约束
- 实现依据：${commit}
- 验证证据：命令 npm test，失败
- 目标/需求影响：G001 / R001 可能不再满足
- 未解决问题/后续动作：等待用户裁定并创建修复任务
`);
  assertParity('unresolved drift cannot be done', ['存在 unresolved_drift，不能标记 done']);

  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：justified_adjustment
- 计划与实际差异：实现改用现有 Repository 方法，没有改变接口或验收
- 偏离理由：复用既有事务边界，避免重复实现
- 实现依据：${commit}
- 验证证据：V999
- 目标/需求影响：无，G001 / R001 验收保持不变
- 未解决问题/后续动作：无
`);
  assertParity('missing verification reference', ['引用了不存在的验证证据 V999']);

  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：justified_adjustment
- 计划与实际差异：实现改用现有 Repository 方法，没有改变接口或验收
- 偏离理由：无
- 实现依据：short-sha
- 验证证据：命令 npm test，结果 pass
- 目标/需求影响：无，G001 / R001 验收保持不变
- 未解决问题/后续动作：无
`);
  assertParity('unsubstantiated adjustment', [
    'justified_adjustment 必须说明偏离理由',
    '缺少完整 Commit SHA 或 no-code 原因',
  ]);

  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md')
    .replace('- 关联变更：C001', '- 关联变更：—')
    .replace('- 已接受变更：C001', '- 已接受变更：无')
    + `
## 收口意图对齐

- 结论：user_confirmed_change
- 计划与实际差异：用户要求改变 API 返回结构
- 偏离理由：用户确认变更
- 实现依据：${commit}
- 验证证据：命令 npm test，结果 pass
- 目标/需求影响：需求验收结构发生变化
- 未解决问题/后续动作：更新需求与变更记录
`);
  assertParity('user change without accepted C', ['user_confirmed_change 必须填写对应的 accepted C 记录']);

  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：aligned
- 计划与实际差异：无实质偏离，代码实现与预期贡献一致
- 偏离理由：无
- 实现依据：${commit}
- 验证证据：命令 npm test，结果 pass
- 目标/需求影响：G001 / R001 目标和验收均未改变
- 未解决问题/后续动作：无
`);
  assertParity('aligned closeout with commit evidence');


  // A closeout V record must cover at least one of this task's requirements
  // and must have been run against the exact implementation commit being reviewed.
  base('done');
  write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| V001 | R002 | CI | pass | https://github.com/example/run/1 |

### V001 — unrelated requirement evidence

- 日期：2026-11-11
- 覆盖需求：R002
- 验证类型：CI
- 结果：pass
- Commit：${commit}
- 执行环境：Ubuntu
- 命令/步骤：npm test
- 证据：https://github.com/example/run/1
- 判定：R002 passed
- 限制：无
`);
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：aligned
- 计划与实际差异：无实质偏离
- 偏离理由：无
- 实现依据：${commit}
- 验证证据：V001
- 目标/需求影响：G001 / R001 保持一致
- 未解决问题/后续动作：无
`);
  assertParity('task evidence must cover a linked requirement', ['未覆盖该任务关联需求']);

  base('done');
  write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| V001 | R001 | CI | pass | https://github.com/example/run/1 |

### V001 — correct requirement evidence

- 日期：2026-11-11
- 覆盖需求：R001
- 验证类型：CI
- 结果：pass
- Commit：${'d'.repeat(40)}
- 执行环境：Ubuntu
- 命令/步骤：npm test
- 证据：https://github.com/example/run/1
- 判定：R001 passed
- 限制：无
`);
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：aligned
- 计划与实际差异：无实质偏离
- 偏离理由：无
- 实现依据：${commit}
- 验证证据：V001
- 目标/需求影响：G001 / R001 保持一致
- 未解决问题/后续动作：无
`);
  assertParity('task evidence must match implementation commit', ['与收口 Commit SHA 不一致']);

  // A completed milestone must have its own review; task-level review is not enough.
  function completedMilestone() {
    base('done');
    write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md').replace('| accepted | user_confirmed / C001 | — |', '| verified | user_confirmed / C001 | V001 |'));
    write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| V001 | R001 | CI | pass | https://github.com/example/run/2 |

### V001 — requirement acceptance

- 日期：2026-11-11
- 覆盖需求：R001
- 验证类型：CI
- 结果：pass
- Commit：${commit}
- 执行环境：Ubuntu
- 命令/步骤：npm test
- 证据：https://github.com/example/run/2
- 判定：R001 acceptance passed
- 限制：无
`);
    write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + `
## 收口意图对齐

- 结论：aligned
- 计划与实际差异：无实质偏离
- 偏离理由：无
- 实现依据：${commit}
- 验证证据：V001
- 目标/需求影响：G001 / R001 达成
- 未解决问题/后续动作：无
`);
    write('.spec/roadmap/INDEX.md', `# Roadmap

## 里程碑

| ID | 里程碑 | 依赖 | 状态 | 包含卡 |
|---|---|---|---|---|
| M1 | 设备接入 | — | 已完成 | T1 |
`);
    write('.spec/roadmap/M1/milestone.md', `# M1 Device onboarding

- 创建日期：2026-11-11
- 意图对齐：required
- 目标：G001
- 需求：R001

## 包含的卡

| 卡 | 说明 |
|---|---|
| T1 | 设备接入 |

## 里程碑意图对齐回顾

- 目标成功判据对照：注册设备后可通过 API 查询，已满足
- 实际交付与依据：commit ${commit}；实现设备创建与查询
- 需求验收覆盖：R001 -> V001
- 偏离结论：aligned
- 偏离理由及已确认变化：无
- 未解决漂移：无
- 后续动作：无
`);
  }
  completedMilestone();
  assertParity('completed milestone with valid alignment review');

  completedMilestone();
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md').replace('## 里程碑意图对齐回顾', '## 里程碑回顾'));
  assertParity('completed milestone without review', ['已完成里程碑 M1 缺少意图对齐回顾']);

  completedMilestone();
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md').replace('偏离结论：aligned', '偏离结论：unresolved_drift').replace('未解决漂移：无', '未解决漂移：租户隔离要求是否可以撤销仍待确认'));
  assertParity('unresolved milestone drift cannot close', ['仍有未解决漂移，不能标记已完成']);

  completedMilestone();
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md').replace('偏离结论：aligned', '偏离结论：justified_adjustment').replace('偏离理由及已确认变化：无', '偏离理由及已确认变化：无'));
  assertParity('milestone justified adjustment requires reason', ['justified_adjustment 必须说明理由']);

  completedMilestone();
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md').replace('| verified | user_confirmed / C001 | V001 |', '| accepted | user_confirmed / C001 | — |'));
  assertParity('completed milestone cannot hide unfinished requirement', ['需求 R001 尚未 verified 或经用户确认暂缓/撤回']);


  // New task records cannot bypass alignment by deleting only the mode field.
  base('in_progress');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md').replace('- 意图对齐：required\n', ''));
  assertParity('new task missing alignment mode', ['新建任务 T1 缺少意图对齐模式']);

  // A done task cannot use partial/failing V evidence as successful closeout proof.
  base('done');
  write('.spec/verification/INDEX.md', '# Verification\n\n| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |\n|---|---|---|---|---|\n| V001 | R001 | CI | partial | https://github.com/example/run/3 |\n\n### V001 — partial verification\n\n- 日期：2026-11-11\n- 覆盖需求：R001\n- 验证类型：CI\n- 结果：partial\n- Commit：' + commit + '\n- 执行环境：Ubuntu\n- 命令/步骤：npm test\n- 证据：https://github.com/example/run/3\n- 判定：部分场景通过\n- 限制：仍有未覆盖场景\n');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md') + '\n## 收口意图对齐\n\n- 结论：aligned\n- 计划与实际差异：无实质偏离\n- 偏离理由：无\n- 实现依据：' + commit + '\n- 验证证据：V001\n- 目标/需求影响：G001 / R001 保持一致\n- 未解决问题/后续动作：无\n');
  assertParity('done task requires pass verification', ['标记 done，但验证证据 V001 不是 pass']);

  // Milestone evidence must be bound to the exact delivery commit.
  completedMilestone();
  write('.spec/verification/INDEX.md', read('.spec/verification/INDEX.md').replace(commit, 'd'.repeat(40)));
  assertParity('milestone evidence commit must match delivery', ['与里程碑交付 Commit SHA 不一致']);

  // A milestone may contain multiple delivery commits; V evidence can bind to any declared commit.
  completedMilestone();
  const secondCommit = 'd'.repeat(40);
  write('.spec/verification/INDEX.md', read('.spec/verification/INDEX.md').replace(commit, secondCommit));
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md').replace('- 实现依据：' + commit, '- 实现依据：' + secondCommit));
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md').replace('commit ' + commit, 'commits ' + commit + ' and ' + secondCommit));
  assertParity('milestone supports multiple delivery commits');
  // New milestones cannot bypass alignment by deleting only the mode field.
  completedMilestone();
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md').replace('- 意图对齐：required\n', ''));
  assertParity('new milestone missing alignment mode', ['新建里程碑 M1 缺少意图对齐模式']);
  // Legacy task cards without an explicit opt-in stay backward compatible.
  base('done');
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md')
    .replace('- 意图对齐：required\n', '')
    .replace('- 创建日期：2026-11-11\n', '')
    .replace(/\n## 开工意图对齐[\s\S]*$/, '\n'));
  assertParity('legacy task card without explicit alignment mode');

  // Legacy completed milestones without an explicit opt-in are not retroactively blocked.
  completedMilestone();
  write('.spec/roadmap/M1/milestone.md', read('.spec/roadmap/M1/milestone.md')
    .replace('- 意图对齐：required\n', '')
    .replace('- 创建日期：2026-11-11\n', '')
    .replace(/\n## 里程碑意图对齐回顾[\s\S]*$/, '\n'));
  assertParity('legacy completed milestone without explicit alignment mode');

  console.log('test-intent-alignment-review: all cases passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
