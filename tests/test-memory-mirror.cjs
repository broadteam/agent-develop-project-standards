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
const runNode = (dir, script, ...args) => spawnSync(process.execPath, [path.join(dir, '.standards', script), ...args], { cwd: dir, encoding: 'utf8' });
const runPython = (dir) => {
  const env = { ...process.env, PYTHONUTF8: '1' };
  let result = spawnSync('python3', [path.join(dir, '.standards/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  if (result.error) result = spawnSync('python', [path.join(dir, '.standards/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  return result;
};
const setMirrors = (dir, paths) => {
  const govPath = path.join(dir, 'gov.toml');
  const text = fs.readFileSync(govPath, 'utf8');
  const pattern = /^mirrors = \[.*\]\r?$/m;
  assert.match(text, pattern, 'gov.toml 应提供 mirrors 配置行');
  fs.writeFileSync(govPath, text.replace(pattern, `mirrors = [${paths.map((item) => JSON.stringify(item)).join(', ')}]`));
};
const setMirror = (dir) => setMirrors(dir, [MIRROR]);

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

  // All configured paths must be validated before any target is modified. Traversal,
  // absolute paths, Windows drive paths and symlink targets are rejected fail-closed.
  const outside = path.join(tmp, 'outside-memory.md');
  fs.writeFileSync(outside, 'outside must remain untouched\n');
  const authorityPathForSafety = path.join(project, '.memory/MEMORY.md');
  fs.writeFileSync(authorityPathForSafety, fs.readFileSync(authorityPathForSafety, 'utf8').replace('断点已被改写', '断点二次改写'));
  const safeBefore = fs.readFileSync(path.join(project, MIRROR), 'utf8');
  setMirrors(project, [MIRROR, '../outside-memory.md']);
  const traversalSync = runNode(project, 'sync-memory.cjs');
  assert.equal(traversalSync.status, 1);
  assert.match(traversalSync.stderr, /记忆镜像路径非法：\.\.\/outside-memory\.md/);
  assert.equal(fs.readFileSync(path.join(project, MIRROR), 'utf8'), safeBefore,
    'an invalid later target must prevent earlier mirror writes');
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside must remain untouched\n');

  const traversalNode = runNode(project, 'check-governance.cjs');
  const traversalPython = runPython(project);
  assert.equal(traversalNode.status, 1);
  assert.match(traversalNode.stdout, /记忆镜像路径非法：\.\.\/outside-memory\.md/);
  if (!traversalPython.error) {
    assert.equal(traversalPython.status, 1);
    assert.equal(traversalPython.stdout, traversalNode.stdout, 'invalid mirror path diagnostics must match');
  }

  setMirrors(project, ['/tmp/outside-memory.md']);
  assert.equal(runNode(project, 'sync-memory.cjs').status, 1, 'absolute paths must be rejected');
  setMirrors(project, ['C:/outside/MEMORY.md']);
  assert.equal(runNode(project, 'sync-memory.cjs').status, 1, 'Windows drive paths must be rejected');

  const escape = path.join(project, '.workbuddy-ai/memory/ESCAPE.md');
  let symlinkCreated = false;
  try { fs.symlinkSync(outside, escape, 'file'); symlinkCreated = true; }
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) throw error;
  }
  if (symlinkCreated) {
    setMirrors(project, [MIRROR, '.workbuddy-ai/memory/ESCAPE.md']);
    const beforeSymlinkBlocked = fs.readFileSync(path.join(project, MIRROR), 'utf8');
    const symlinkSync = runNode(project, 'sync-memory.cjs');
    assert.equal(symlinkSync.status, 1);
    assert.match(symlinkSync.stderr, /禁止经过符号链接/);
    assert.equal(fs.readFileSync(path.join(project, MIRROR), 'utf8'), beforeSymlinkBlocked);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'outside must remain untouched\n');
    const symlinkNode = runNode(project, 'check-governance.cjs');
    const symlinkPython = runPython(project);
    assert.equal(symlinkNode.status, 1);
    assert.match(symlinkNode.stdout, /禁止经过符号链接/);
    if (!symlinkPython.error) assert.equal(symlinkPython.stdout, symlinkNode.stdout);
    fs.unlinkSync(escape);
  }

  setMirror(project);
  // A declared target that does not exist is skipped, not an error: not every machine has it.
  fs.rmSync(path.join(project, '.workbuddy-ai'), { recursive: true, force: true });
  assert.equal(runNode(project, 'sync-memory.cjs', '--check').status, 0, '目标不存在时应跳过');

  console.log('test-memory-mirror: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
