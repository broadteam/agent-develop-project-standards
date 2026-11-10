#!/usr/bin/env node
'use strict';

// A client that only reads its own memory directory will never see .memory/. No rule in
// AGENTS.md can force it to look, so the breakpoint is mirrored into the file it does read.
// These cases pin the mirror to be one-way, idempotent and detectable when stale.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-memory-mirror-'));
const MIRROR = '.workbuddy-ai/memory/MEMORY.md';
const clientOwned = '# 客户端自己的记忆\n\n这里的内容不属于模板。\n';

const init = (dir) => spawnSync(process.execPath, [path.join(root, 'init.cjs'), dir], { encoding: 'utf8' });
const runNode = (dir, script, ...args) => spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], { cwd: dir, encoding: 'utf8' });
const runPython = (dir) => {
  const env = { ...process.env, PYTHONUTF8: '1' };
  let result = spawnSync('python3', [path.join(dir, 'scripts/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  if (result.error) result = spawnSync('python', [path.join(dir, 'scripts/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  return result;
};
const setMirror = (dir) => {
  const govPath = path.join(dir, 'gov.toml');
  const text = fs.readFileSync(govPath, 'utf8');
  assert.match(text, /^mirrors = \[\]\r?$/m, 'gov.toml 应默认不配置镜像目标（不猜客户端）');
  fs.writeFileSync(govPath, text.replace(/^mirrors = \[\]\r?$/m, `mirrors = ["${MIRROR}"]`));
};

try {
  const project = path.join(tmp, 'mirror-app');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'mirror-app' }));
  // The client's directory exists before governance is installed, as it does in a real project.
  fs.mkdirSync(path.join(project, '.workbuddy-ai/memory'), { recursive: true });
  fs.writeFileSync(path.join(project, MIRROR), clientOwned);
  const installed = init(project);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);

  // With no declared target the script is a no-op: guessing a client path would be worse.
  const idle = runNode(project, 'sync-memory.cjs');
  assert.equal(idle.status, 0, idle.stdout + idle.stderr);
  assert.match(idle.stdout, /mirrors 为空/);

  setMirror(project);

  const created = runNode(project, 'sync-memory.cjs');
  assert.equal(created.status, 0, created.stdout + created.stderr);
  const mirrored = fs.readFileSync(path.join(project, MIRROR), 'utf8');
  assert.match(mirrored, /memory mirror \(generated\)/);
  assert.ok(mirrored.includes(clientOwned.trim()), '镜像不得改动客户端自己写的内容');
  assert.match(mirrored, /## §0 断点/, '镜像必须包含权威断点');

  // Idempotent: a second run changes nothing and --check agrees.
  assert.equal(runNode(project, 'sync-memory.cjs', '--check').status, 0);
  assert.equal(fs.readFileSync(path.join(project, MIRROR), 'utf8'), mirrored);

  // Update the authority without syncing: the gate must say so, in both checkers, identically.
  const authorityPath = path.join(project, '.memory/MEMORY.md');
  fs.writeFileSync(authorityPath, fs.readFileSync(authorityPath, 'utf8').replace('（待填：一句话说清现在到哪一步）', '断点已被改写'));
  const staleCheck = runNode(project, 'sync-memory.cjs', '--check');
  assert.equal(staleCheck.status, 1, '断点变化后 --check 必须失败');
  assert.match(staleCheck.stderr, /未同步/);

  const nodeGovernance = runNode(project, 'check-governance.cjs');
  assert.equal(nodeGovernance.status, 1, '治理检查必须发现镜像过期');
  assert.match(nodeGovernance.stdout, /客户端私有记忆断点未同步/);
  const pythonGovernance = runPython(project);
  if (!pythonGovernance.error) {
    assert.equal(pythonGovernance.status, 1);
    assert.equal(pythonGovernance.stdout, nodeGovernance.stdout, 'Node 与 Python 的过期提示必须逐字节一致');
  }

  // Syncing again clears it.
  assert.equal(runNode(project, 'sync-memory.cjs').status, 0);
  assert.equal(runNode(project, 'sync-memory.cjs', '--check').status, 0);
  assert.equal(runNode(project, 'check-governance.cjs').status, 0, '同步后治理检查应通过');

  // A declared target that does not exist is skipped, not an error: not every machine has it.
  fs.rmSync(path.join(project, '.workbuddy-ai'), { recursive: true, force: true });
  assert.equal(runNode(project, 'sync-memory.cjs', '--check').status, 0, '目标不存在时应跳过');

  console.log('test-memory-mirror: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
