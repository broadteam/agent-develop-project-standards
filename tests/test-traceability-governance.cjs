#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateTraceability } = require('../template/.standards/traceability-check.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'traceability-governance-'));
const root = path.join(tmp, 'project');
const sha = 'a'.repeat(40);
function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
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
  const nodeErrors = validateTraceability(root);
  const pyErrors = pythonErrors();
  assert.deepEqual(nodeErrors, pyErrors, label + ': Node/Python results differ');
  if (expected.length) {
    for (const fragment of expected) assert.ok(nodeErrors.some(error => error.includes(fragment)), label + ': missing ' + fragment + '\n' + nodeErrors.join('\n'));
  } else {
    assert.deepEqual(nodeErrors, [], label + ': expected clean traceability graph');
  }
  return nodeErrors;
}
try {
  write('.spec/intent/BASELINE.md', `# Baseline

| ID | 目标结果 | 优先级 | 来源/确认状态 | 可验证成功判据 |
|---|---|---|---|---|
| G001 | 用户可以完成设备注册 | P1 | user_request | 注册接口返回成功且设备出现在列表 |
`);
  write('.spec/intent/CHANGES.md', '# Changes\n\n## 历史记录\n');
  write('.spec/requirements/INDEX.md', `# Requirements

| ID | 关联目标 | 需求（可观察结果） | 验收判据 | 状态 | 来源/变更 | 验证 |
|---|---|---|---|---|---|---|
| R001 | G001 | 用户可以通过 API 注册设备 | POST /devices 返回 201，设备可查询 | verified | user_explicit | V001 |
`);
  write('.spec/verification/INDEX.md', `# Verification

| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |
|---|---|---|---|---|
| V001 | R001 | CI | pass | https://github.com/acme/app/actions/runs/123 |

### V001 — device registration CI

- 日期：2026-11-11
- 覆盖需求：R001
- 验证类型：CI
- 结果：pass
- Commit：${sha}
- 执行环境：Ubuntu, Node 22
- 命令/步骤：npm test
- 证据：https://github.com/acme/app/actions/runs/123
- 判定：AC-1 通过；POST /devices 返回 201 且设备可查询
- 限制：未覆盖并发注册
`);
  write('.spec/tasks/index.md', `# Tasks

## 当前波次：W1

| ID | 标题 | 状态 | 范围 |
|---|---|---|---|
| T1 | 实现设备注册 API | done | src/api |
`);
  write('.spec/tasks/T1/card.md', `# T1 Implement device registration

- 关联目标：G001
- 关联需求：R001
- 关联变更：—

## 背景
实现用户要求的设备注册能力。
`);
  write('.spec/roadmap/INDEX.md', `# Roadmap

## 里程碑

| ID | 里程碑 | 依赖 | 状态 | 包含卡 |
|---|---|---|---|---|
| M1 | 设备接入 | — | 已完成 | T1 |
`);
  write('.spec/roadmap/M1/milestone.md', `# M1 Device onboarding

- 目标：G001
- 需求：R001
`);

  assertParity('valid graph');

  write('.spec/tasks/T1/card.md', fs.readFileSync(path.join(root, '.spec/tasks/T1/card.md'), 'utf8').replace('R001', 'R999'));
  assertParity('dangling task requirement', ['任务 T1 引用了不存在的需求 R999']);
  write('.spec/tasks/T1/card.md', fs.readFileSync(path.join(root, '.spec/tasks/T1/card.md'), 'utf8').replace('R999', 'R001'));

  write('.spec/requirements/INDEX.md', fs.readFileSync(path.join(root, '.spec/requirements/INDEX.md'), 'utf8').replace('| R001 | G001 |', '| R001 | G999 |'));
  assertParity('dangling requirement goal', ['需求 R001 引用了不存在的目标 G999']);
  write('.spec/requirements/INDEX.md', fs.readFileSync(path.join(root, '.spec/requirements/INDEX.md'), 'utf8').replace('| R001 | G999 |', '| R001 | G001 |'));

  write('.spec/verification/INDEX.md', fs.readFileSync(path.join(root, '.spec/verification/INDEX.md'), 'utf8').replace('Commit：' + sha, 'Commit：short-sha'));
  assertParity('invalid evidence commit', ['验证证据 V001 缺少完整 40 位 Commit SHA', '需求 R001 标记 verified，但没有有效 pass 证据']);
  write('.spec/verification/INDEX.md', fs.readFileSync(path.join(root, '.spec/verification/INDEX.md'), 'utf8').replace('Commit：short-sha', 'Commit：' + sha));

  write('.spec/verification/INDEX.md', fs.readFileSync(path.join(root, '.spec/verification/INDEX.md'), 'utf8').replace('结果：pass', '结果：partial'));
  assertParity('partial cannot verify', ['需求 R001 的验证指针无效或未覆盖该需求', '需求 R001 标记 verified，但没有有效 pass 证据']);
  write('.spec/verification/INDEX.md', fs.readFileSync(path.join(root, '.spec/verification/INDEX.md'), 'utf8').replace('结果：partial', '结果：pass'));

  write('.spec/requirements/INDEX.md', fs.readFileSync(path.join(root, '.spec/requirements/INDEX.md'), 'utf8').replace('verified | user_explicit', 'accepted | user_explicit'));
  write('.spec/verification/INDEX.md', fs.readFileSync(path.join(root, '.spec/verification/INDEX.md'), 'utf8').replace('结果：pass', '结果：partial'));
  write('.spec/tasks/T1/card.md', fs.readFileSync(path.join(root, '.spec/tasks/T1/card.md'), 'utf8').replace('R001', '—'));
  assertParity('accepted requirement needs work item or evidence', ['活跃需求 R001 没有任务或通过的验证证据']);
  console.log('test-traceability-governance: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
