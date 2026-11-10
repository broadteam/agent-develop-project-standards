#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateTraceability } = require('../template/.standards/traceability-check.cjs');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-continuity-simulation-'));
const root = path.join(temp, 'project');
const commitSha = 'b'.repeat(40);
const ciUrl = 'https://github.com/example/project/actions/runs/42';

function write(rel, content) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
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
function assertGraph(stage) {
  const nodeErrors = validateTraceability(root);
  const pyErrors = pythonErrors();
  assert.deepEqual(nodeErrors, pyErrors, stage + ': Node/Python checker parity');
  assert.deepEqual(nodeErrors, [], stage + ': traceability graph must remain valid\n' + nodeErrors.join('\n'));
}

const change = (id, title, type, source, status, body) => `### ${id} — ${title}

- 日期：2026-11-11
- 类型：${type}
- 来源：${source}
- 状态：${status}
- 关联目标：G001
- 关联任务/里程碑/ADR：T1 / M1 / —

**变化内容**

${body}

**决策与影响**

- 用户决定/待确认问题：${status === 'pending' ? '待确认，不进入当前有效意图' : '已明确确认'}
- 对范围、优先级、验收或约束的影响：按记录内容处理
- 需要调整的任务、里程碑或决策：只调整已确认的部分
- 后续验证方式：关联 R001 的验收证据
`;

try {
  write('.spec/intent/BASELINE.md', `# Intent Baseline

| ID | 目标结果 | 优先级 | 来源/确认状态 | 可验证成功判据 |
|---|---|---|---|---|
| G001 | 用户可以稳定注册并管理设备 | P1 | user_request | 注册设备后可查询并在列表展示 |
`);
  const originalBaseline = read('.spec/intent/BASELINE.md');
  write('.spec/intent/CHANGES.md', `# Intent Change Ledger

## 历史记录

${change('C001', '明确注册成功判据', 'clarification', 'user_explicit', 'accepted', '- 明确注册成功后必须可查询并显示在设备列表。')}
`);
  write('.spec/requirements/INDEX.md', `# Requirements

| ID | 关联目标 | 需求（可观察结果） | 验收判据 | 状态 | 来源/变更 | 验证 |
|---|---|---|---|---|---|---|
| R001 | G001 | 用户可以通过 API 注册设备 | POST /devices 返回 201，设备可查询 | accepted | user_explicit / C001 | — |
`);
  write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| — | — | — | — | — |
`);
  write('.spec/tasks/index.md', `# Tasks

## 当前波次：W1

| ID | 标题 | 状态 | 范围 |
|---|---|---|---|
| T1 | 实现设备注册 | in_progress | src/api |
`);
  write('.spec/tasks/T1/card.md', `# T1 Implement device registration

- 关联目标：G001
- 关联需求：R001
- 关联变更：C001

## 验收
- [ ] 注册后可查询并显示在设备列表
`);
  write('.spec/roadmap/INDEX.md', `# Roadmap

## 里程碑

| ID | 里程碑 | 依赖 | 状态 | 包含卡 |
|---|---|---|---|---|
| M1 | 设备接入 | — | 进行中 | T1 |
`);
  write('.spec/roadmap/M1/milestone.md', `# M1 Device onboarding

- 目标：G001
- 需求：R001
`);
  write('.memory/MEMORY.md', `## §0 断点

- 正在做：G001 / R001 / T1 — 设备注册
- 待裁定/暂停原因：无
- 下一步：完成注册接口并验证可查询
`);

  // S0: baseline and accepted clarification are coherent.
  assertGraph('S0 initial baseline');

  // S1: an urgent local bugfix interrupts the main task. It is supporting work,
  // not a new project goal; the original T1 resume point stays in MEMORY.
  write('.spec/tasks/index.md', read('.spec/tasks/index.md').replace('| T1 | 实现设备注册 | in_progress | src/api |', '| T1 | 实现设备注册 | in_progress | src/api |\n| T2 | 修复临时日志异常 | in_progress | src/logging |'));
  write('.spec/tasks/T2/card.md', `# T2 Temporary logging bugfix

- 关联目标：supporting: 临时排障，不改变 G001 的长期目标
- 关联需求：—
- 关联变更：—

## 验收
- [ ] 日志异常不再复现
`);
  write('.memory/MEMORY.md', read('.memory/MEMORY.md').replace('下一步：完成注册接口并验证可查询', '暂停点：T1 尚未完成注册接口\n- 下一步：先完成 T2 临时修复，再恢复 T1'));
  assertGraph('S1 bounded interruption');
  assert.match(read('.memory/MEMORY.md'), /G001 \/ R001 \/ T1/);
  assert.match(read('.memory/MEMORY.md'), /恢复 T1/);
  assert.equal(read('.spec/intent/BASELINE.md'), originalBaseline, 'interruption must not rewrite the baseline');

  // S2: an Agent proposes changing priority. Pending proposals must not become
  // accepted intent and must not be linked as active task changes.
  write('.spec/intent/CHANGES.md', read('.spec/intent/CHANGES.md') + '\n' +
    change('C002', '建议先重做设备架构', 'reprioritization', 'agent_proposed', 'pending', '- Agent 建议先重做设备架构，等待用户决定。'));
  assertGraph('S2 pending agent proposal');
  assert.match(read('.spec/intent/CHANGES.md'), /C002 — 建议先重做设备架构/);
  assert.match(read('.spec/intent/CHANGES.md'), /来源：agent_proposed\n- 状态：pending/);
  assert.doesNotMatch(read('.spec/tasks/T1/card.md'), /C002/);

  // S3: the user explicitly corrects the acceptance detail. Append C003 and
  // update only the requirement/task references; C001 remains historical.
  write('.spec/intent/CHANGES.md', read('.spec/intent/CHANGES.md') + '\n' +
    change('C003', '补充设备编号唯一性约束', 'correction', 'user_confirmed', 'accepted', '- 注册设备必须保证设备编号唯一。'));
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md')
    .replace('POST /devices 返回 201，设备可查询', 'POST /devices 返回 201，设备可查询且设备编号唯一')
    .replace('user_explicit / C001', 'user_confirmed / C003'));
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md').replace('关联变更：C001', '关联变更：C001 / C003'));
  assertGraph('S3 accepted correction');
  assert.match(read('.spec/intent/CHANGES.md'), /C001 — 明确注册成功判据/);
  assert.match(read('.spec/intent/CHANGES.md'), /C003 — 补充设备编号唯一性约束/);
  assert.equal(read('.spec/intent/BASELINE.md'), originalBaseline, 'correction must append a change, not rewrite baseline');

  // S4: a conflicting request is recorded as pending. The active requirement,
  // milestone and next action remain unchanged until the user resolves it.
  const activeRequirement = read('.spec/requirements/INDEX.md');
  const activeTask = read('.spec/tasks/T1/card.md');
  write('.spec/intent/CHANGES.md', read('.spec/intent/CHANGES.md') + '\n' +
    change('C004', '是否取消设备编号唯一约束', 'scope_change', 'user_explicit', 'pending', '- 新请求似乎与 C003 验收约束冲突，尚未确认是否撤回唯一性要求。'));
  write('.memory/MEMORY.md', read('.memory/MEMORY.md').replace('待裁定/暂停原因：无', '待裁定/暂停原因：C004 与 R001 的唯一性验收冲突，等待用户裁定'));
  assertGraph('S4 unresolved conflict');
  assert.equal(read('.spec/requirements/INDEX.md'), activeRequirement, 'pending conflict must not silently change accepted requirements');
  assert.equal(read('.spec/tasks/T1/card.md'), activeTask, 'pending conflict must not silently rewrite the task contract');
  assert.match(read('.memory/MEMORY.md'), /C004/);

  // S4.1: the user resolves the conflict explicitly. Append C005 rather than
  // rewriting C004; active requirement/task pointers move to the accepted decision.
  write('.spec/intent/CHANGES.md', read('.spec/intent/CHANGES.md') + '\n' +
    change('C005', '确认保留设备编号唯一约束', 'correction', 'user_confirmed', 'accepted', '- 用户确认保留 C003 的唯一性验收要求；本决定 supersedes C004。'));
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md').replace('user_confirmed / C003', 'user_confirmed / C005'));
  write('.spec/tasks/T1/card.md', read('.spec/tasks/T1/card.md').replace('C001 / C003', 'C001 / C003 / C005'));
  write('.memory/MEMORY.md', read('.memory/MEMORY.md').replace('C004 冲突仍待用户裁定', 'C004 已由 accepted C005 裁定；保留唯一性要求'));
  assertGraph('S4.1 user resolves conflict');

  // S5: after the interruption, the agent resumes T1. Marking the task done
  // alone does not make the requirement verified.
  write('.spec/tasks/index.md', read('.spec/tasks/index.md').replace('| T1 | 实现设备注册 | in_progress |', '| T1 | 实现设备注册 | done |'));
  write('.memory/MEMORY.md', `## §0 断点

- 正在做：G001 / R001 / T1 — 设备注册
- 待裁定/暂停原因：无；C004 已由 accepted C005 裁定
- 下一步：补齐唯一性验证并取得有效 V 证据
`);
  assertGraph('S5 resume after interruption');
  assert.match(read('.spec/requirements/INDEX.md'), /\| accepted \| user_confirmed \/ C005 \|/);
  assert.doesNotMatch(read('.spec/requirements/INDEX.md'), /\| verified \|/);

  // S6: partial evidence cannot close the requirement.
  write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| V001 | R001 | CI | partial | ${ciUrl} |

### V001 — device registration partial verification

- 日期：2026-11-11
- 覆盖需求：R001
- 验证类型：CI
- 结果：partial
- Commit：${commitSha}
- 执行环境：Ubuntu, Node 22
- 命令/步骤：npm test
- 证据：${ciUrl}
- 判定：注册返回 201；设备编号唯一性场景尚未覆盖
- 限制：唯一性验收未完成
`);
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md').replace('| accepted | user_confirmed / C003 |', '| implemented | user_confirmed / C003 |'));
  assertGraph('S6 partial evidence');
  assert.match(read('.spec/requirements/INDEX.md'), /\| implemented \|/);
  assert.doesNotMatch(read('.spec/requirements/INDEX.md'), /\| verified \|/);

  // S7: a passing record that covers the full acceptance criteria can verify R001.
  write('.spec/verification/INDEX.md', read('.spec/verification/INDEX.md')
    .replace('| partial |', '| pass |')
    .replace('唯一性验收未完成', '设备编号唯一性与查询验收全部通过')
    .replace('设备编号唯一性场景尚未覆盖', '设备编号唯一性与查询验收全部通过'));
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md')
    .replace('| implemented | user_confirmed / C005 |', '| verified | user_confirmed / C005 |')
    .replace('| implemented |', '| verified |')
    .replace('| V001 |', '| V001 |'));
  // The evidence pointer is the final column in the requirement index.
  write('.spec/requirements/INDEX.md', read('.spec/requirements/INDEX.md').replace('user_confirmed / C005 | — |', 'user_confirmed / C005 | V001 |'));
  assertGraph('S7 verified with passing evidence');

  console.log('test-intent-continuity-simulation: all scenarios passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
