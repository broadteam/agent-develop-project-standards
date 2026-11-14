#!/usr/bin/env node
'use strict';

// End-to-end governance lifecycle on a disposable initialized project.
// No Agent client is launched and no real business repository is touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-governance-lifecycle-'));
const project = path.join(tempRoot, 'project');
const today = new Date().toISOString().slice(0, 10);
const fullSha = /^[a-f0-9]{40}$/i;

function write(rel, content) {
  const file = path.join(project, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
function read(rel) {
  return fs.readFileSync(path.join(project, rel), 'utf8');
}
function runNode(rel, args = []) {
  return spawnSync(process.execPath, [path.join(project, rel), ...args], {
    cwd: project, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' }
  });
}
function runPythonGate() {
  const executable = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  return spawnSync(executable, [path.join(project, '.standards/check_governance.py')], {
    cwd: project, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' }
  });
}
function writeTaskIndex(status) {
  write('.spec/tasks/index.md', [
    '# 任务索引',
    '',
    '## 当前波次：W1',
    '',
    '| ID | 标题 | 状态 | 范围（改哪） |',
    '|---|---|---|---|',
    '| T1 | 实现设备注册入口 | ' + status + ' | src/ |',
    '',
    '## 已归档波次',
    '',
    '| 波次 | 卡数 | 状态 | 详情 |',
    '|---|---|---|---|',
    '| — | — | — | — |',
    ''
  ].join('\n'));
}
function writeRequirement(status, evidence) {
  write('.spec/requirements/INDEX.md', [
    '# 需求索引',
    '',
    '| ID | 关联目标 | 需求（可观察结果） | 验收判据 | 状态 | 来源/变更 | 验证 |',
    '|---|---|---|---|---|---|---|',
    '| R001 | G001 | 注册入口返回可查询的设备标识 | 命令退出码为 0 且输出 device_id | ' + status + ' | user_explicit / — | ' + evidence + ' |',
    ''
  ].join('\n'));
}
function writeVerification(result, commit, verdict) {
  write('.tmp/verification.log', 'device registration smoke check: ' + verdict + '\n');
  write('.spec/verification/INDEX.md', [
    '# 验证证据索引',
    '',
    '| ID | 覆盖需求 | 验证类型 | 结果 | 证据位置 |',
    '|---|---|---|---|---|',
    '| V001 | R001 | automated_test | ' + result + ' | .tmp/verification.log |',
    '',
    '### V001 — 设备注册端到端验证',
    '',
    '- 日期：' + today,
    '- 覆盖需求：R001',
    '- 验证类型：automated_test',
    '- 结果：' + result,
    '- Commit：' + commit,
    '- 执行环境：' + process.platform + ' / Node ' + process.versions.node,
    '- 命令/步骤：node src/device-registration.js',
    '- 证据：.tmp/verification.log',
    '- 判定：' + verdict,
    '- 限制：' + (result === 'partial' ? '唯一性冲突场景尚未覆盖' : '本夹具验证声明范围，不代表真实客户端集成测试'),
    ''
  ].join('\n'));
}
function writeTaskCard(commit, includeCloseout) {
  const lines = [
    '# T1 实现设备注册入口',
    '',
    '- 创建日期：' + today,
    '- 波次：W1',
    '- 关联目标：G001',
    '- 关联需求：R001',
    '- 关联变更：—',
    '- 意图对齐：required',
    '- 意图对齐豁免原因：—',
    '',
    '## 背景',
    '',
    '用户需要通过稳定入口创建设备，并获得可查询的设备标识。',
    '',
    '## 范围',
    '',
    '- 允许修改路径：src/device-registration.js',
    '- 不在范围内：数据库迁移、认证流程和生产部署。',
    '',
    '## 开工意图对齐',
    '',
    '- 对齐目标与需求：G001 / R001',
    '- 已接受变更：无',
    '- 预期贡献：提供可重复执行的设备注册入口，满足 R001 的验收条件。',
    '- 保留约束：不改变已有接口语义；不接触生产数据；不引入新依赖。',
    '',
    '## 验收',
    '',
    '- [x] 运行 node src/device-registration.js，输出设备创建成功。',
    '- [x] 输出中包含可用于后续查询的设备标识。'
  ];
  if (includeCloseout) {
    lines.push(
      '',
      '## 收口意图对齐',
      '',
      '- 结论：aligned',
      '- 计划与实际差异：无实质偏离。',
      '- 偏离理由：无。',
      '- 实现依据：' + commit,
      '- 验证证据：V001',
      '- 目标/需求影响：G001 / R001 的验收判据均已覆盖，范围与约束未变化。',
      '- 对应已确认变更：—',
      '- 未解决问题/后续动作：无。'
    );
  }
  lines.push('');
  write('.spec/tasks/T1/card.md', lines.join('\n'));
}
function writeCheckpoint(state, next) {
  write('.memory/MEMORY.md', [
    '# Disposable fixture — cross-session memory',
    '',
    '## §0 断点',
    '',
    '- **' + today + ' 状态**：' + state,
    '- 正在做：G001 / R001 / T1 — 设备注册',
    '- 待裁定/暂停原因：无',
    '- 下一步：' + next,
    '',
    '## §1 项目事实',
    '',
    '- 本 fixture 仅验证仓库治理闭环，不是实际业务项目。',
    ''
  ].join('\n'));
}

try {
  fs.mkdirSync(project, { recursive: true });
  // Include all fixture-owned root directories in the installer's initial allowlist.
  fs.mkdirSync(path.join(project, 'src'));
  fs.mkdirSync(path.join(project, '.tmp'));

  const init = spawnSync(process.execPath, [path.join(repoRoot, 'init.cjs'), project], {
    cwd: repoRoot, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' }
  });
  assert.equal(init.status, 0, 'fresh-project initialization failed:\n' + init.stdout + init.stderr);
  assert.ok(fs.existsSync(path.join(project, '.agent-standards.json')));
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));

  // 1. Record the original user goal and its observable requirement in their
  // respective authoritative files. The change ledger remains append-only and empty.
  write('.spec/intent/BASELINE.md', [
    '# 项目原始目标基线',
    '',
    '- 基线版本：B1',
    '- 状态：confirmed',
    '- 建立日期：' + today,
    '- 来源：user_request',
    '- 来源说明：fixture 中明确给定的用户需求。',
    '',
    '## 项目问题',
    '',
    '需要一个稳定、可验证的设备注册入口。',
    '',
    '## 目标',
    '',
    '| ID | 目标结果 | 优先级 | 来源/确认状态 | 可验证成功判据 |',
    '|---|---|---|---|---|',
    '| G001 | 用户可以注册设备并获得可查询的设备标识 | P1 | user_request / confirmed | 注册成功后输出设备标识，后续可按标识查询 |',
    '',
    '## 核心约束',
    '',
    '- 必须满足：不接触生产数据，不引入未批准的依赖。',
    '- 明确不做：数据库迁移、生产部署和真实客户端集成。',
    '',
    '## 基线确认',
    '',
    '- 确认状态：confirmed',
    '- 用户确认记录：' + today + ' / fixture 中显式给定',
    '- 未确认项：无',
    ''
  ].join('\n'));
  write('.spec/intent/CHANGES.md', '# 项目意图变更账本\n\n## 历史记录\n');
  writeRequirement('accepted', '—');
  writeTaskIndex('in_progress');
  writeTaskCard('', false);
  writeCheckpoint('T1 in_progress / R001 accepted', '完成设备注册入口并验证输出。');

  // 2. Resolve a cross-session task's minimal required context from the project.
  write('.tmp/task-context.json', JSON.stringify({
    kind: 'code_change', risk: 'medium', impact: 'local',
    uncertainty: 'medium', cross_session: true, task_id: 'T1'
  }, null, 2));
  const contextRun = runNode('.standards/task-context-resolver.cjs', [
    '--input', '.tmp/task-context.json', '--format', 'json'
  ]);
  assert.equal(contextRun.status, 0, 'context resolver failed:\n' + contextRun.stdout + contextRun.stderr);
  const context = JSON.parse(contextRun.stdout);
  const requiredPaths = context.requiredRead.map(item => item.path);
  for (const rel of [
    '.spec/intent/BASELINE.md', '.spec/intent/CHANGES.md',
    '.spec/requirements/INDEX.md', '.spec/tasks/index.md', '.spec/tasks/T1/card.md'
  ]) {
    assert.ok(requiredPaths.includes(rel), 'cross-session context omitted ' + rel);
    assert.ok(fs.existsSync(path.join(project, rel)), 'resolver selected missing context ' + rel);
  }
  assert.ok(context.alwaysRead.some(item => item.path === '.memory/MEMORY.md' && item.section === '§0'));
  assert.equal(context.capabilityDecisions.task_tracking.decision, 'auto_selected_for_task');

  // 3. The task's in-progress state is valid before the code change starts.
  const initialBoard = runNode('.standards/generate-board.cjs');
  assert.equal(initialBoard.status, 0, 'initial Board generation failed:\n' + initialBoard.stdout + initialBoard.stderr);
  const kickoffGate = runNode('.standards/check-governance.cjs');
  assert.equal(kickoffGate.status, 0, 'kickoff governance failed:\n' + kickoffGate.stdout + kickoffGate.stderr);

  // 4. Make and commit a tiny real code change in the disposable Git repository.
  write('src/device-registration.js', [
    "'use strict';",
    "const deviceId = 'fixture-device-001';",
    "console.log('device_id=' + deviceId);",
    ''
  ].join('\n'));
  const gitInit = spawnSync('git', ['-C', project, 'init', '-q'], { encoding: 'utf8' });
  assert.equal(gitInit.status, 0, 'fixture git init failed: ' + gitInit.stderr);
  const gitAdd = spawnSync('git', ['-C', project, 'add', '--', 'src/device-registration.js'], { encoding: 'utf8' });
  assert.equal(gitAdd.status, 0, 'fixture git add failed: ' + gitAdd.stderr);
  const gitCommit = spawnSync('git', [
    '-C', project, '-c', 'user.name=Standards Fixture',
    '-c', 'user.email=standards-fixture@example.invalid',
    'commit', '-m', 'test: add device registration fixture'
  ], { encoding: 'utf8' });
  assert.equal(gitCommit.status, 0, 'fixture code commit failed: ' + gitCommit.stdout + gitCommit.stderr);
  const revision = spawnSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(revision.status, 0, revision.stderr);
  const commit = revision.stdout.trim();
  assert.match(commit, fullSha, 'verification requires a full commit SHA');

  // 5. A partial V record cannot close a tracked task.
  const smoke = runNode('src/device-registration.js');
  assert.equal(smoke.status, 0, 'fixture implementation failed:\n' + smoke.stdout + smoke.stderr);
  assert.match(smoke.stdout, /device_id=fixture-device-001/);
  writeVerification('partial', commit, '注册入口可运行，但唯一性场景尚未覆盖。');
  writeTaskCard(commit, true);
  writeTaskIndex('done');
  writeRequirement('implemented', 'V001');
  writeCheckpoint('T1 done / R001 implemented; V001 partial', '补齐验收证据后再将 R001 标记 verified。');
  const partialGate = runNode('.standards/check-governance.cjs');
  assert.notEqual(partialGate.status, 0, 'partial evidence must block a done task');
  assert.match(partialGate.stdout + partialGate.stderr, /V001 不是 pass/);

  // 6. Passing evidence bound to the exact code commit permits verified closeout.
  writeVerification('pass', commit, '注册入口退出码为 0，并输出可用于后续查询的设备标识。');
  writeRequirement('verified', 'V001');
  writeCheckpoint('T1 done / R001 verified', '后续会话从 AGENTS.md、MEMORY §0 与权威索引恢复；R001 已由 V001 覆盖。');
  const finalBoard = runNode('.standards/generate-board.cjs');
  assert.equal(finalBoard.status, 0, 'final Board generation failed:\n' + finalBoard.stdout + finalBoard.stderr);
  const boardCheck = runNode('.standards/generate-board.cjs', ['--check']);
  assert.equal(boardCheck.status, 0, 'derived Board is stale:\n' + boardCheck.stdout + boardCheck.stderr);

  const nodeGate = runNode('.standards/check-governance.cjs');
  const pythonGate = runPythonGate();
  assert.equal(nodeGate.status, 0, 'final Node governance failed:\n' + nodeGate.stdout + nodeGate.stderr);
  assert.equal(pythonGate.status, 0, 'final Python governance failed:\n' + pythonGate.stdout + pythonGate.stderr);
  assert.equal(nodeGate.stdout, pythonGate.stdout, 'Node/Python governance output differs');
  assert.equal(nodeGate.stderr, pythonGate.stderr, 'Node/Python governance diagnostics differ');

  // 7. A fresh session resolves work from repository-owned records, not chat history.
  const recovery = runNode('.standards/task-context-resolver.cjs', [
    '--input', '.tmp/task-context.json', '--format', 'json'
  ]);
  assert.equal(recovery.status, 0, 'cross-session recovery failed:\n' + recovery.stdout + recovery.stderr);
  const recovered = JSON.parse(recovery.stdout);
  assert.ok(recovered.alwaysRead.some(item => item.path === '.memory/MEMORY.md' && item.section === '§0'));
  assert.ok(recovered.requiredRead.some(item => item.path === '.spec/intent/BASELINE.md'));
  assert.ok(recovered.requiredRead.some(item => item.path === '.spec/requirements/INDEX.md'));
  assert.ok(recovered.requiredRead.some(item => item.path === '.spec/tasks/T1/card.md'));
  assert.match(read('.memory/MEMORY.md'), /G001 \/ R001 \/ T1/);
  assert.match(read('.memory/MEMORY.md'), /R001 verified/);
  assert.match(read('.spec/requirements/INDEX.md'), /\| verified \| user_explicit \/ — \| V001 \|/);
  assert.match(read('.spec/verification/INDEX.md'), new RegExp('Commit：' + commit));
  assert.ok(read('.spec/tasks/BOARD.md').includes('| T1 | 实现设备注册入口 |'));
  assert.match(read('.spec/tasks/BOARD.md'), /完成 1/);

  console.log('test-governance-lifecycle: initialization → intent → context → execution → evidence gate → recovery passed');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
