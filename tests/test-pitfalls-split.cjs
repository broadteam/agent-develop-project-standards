#!/usr/bin/env node
'use strict';

// Lessons only accumulate, so a single PITFALLS.md will eventually exceed any budget. Splitting by
// topic is allowed; drifting out of sync is not. The index and the files on disk must agree, in
// both checkers, with identical output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-pitfalls-split-'));
const PLACEHOLDER = '| — | — | 未拆分时保持这一行 |';

const runNode = (dir) => spawnSync(process.execPath, [path.join(dir, 'scripts/check-governance.cjs')], { cwd: dir, encoding: 'utf8' });
const runPython = (dir) => {
  const env = { ...process.env, PYTHONUTF8: '1' };
  let result = spawnSync('python3', [path.join(dir, 'scripts/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  if (result.error) result = spawnSync('python', [path.join(dir, 'scripts/check_governance.py')], { cwd: dir, encoding: 'utf8', env });
  return result;
};
const registerTopic = (dir, row) => {
  const file = path.join(dir, '.memory/PITFALLS.md');
  const text = fs.readFileSync(file, 'utf8');
  const headerRe = /\| 主题 \| 文件 \| 什么时候读 \|\r?\n\|---\|---\|---\|/;
  if (text.includes(PLACEHOLDER)) {
    fs.writeFileSync(file, text.replace(PLACEHOLDER, row));
    return;
  }
  assert.ok(headerRe.test(text), 'PITFALLS.md 缺少主题表表头');
  fs.writeFileSync(file, text.replace(headerRe, (matched) => `${matched}\n${row}`));
};

try {
  const project = path.join(tmp, 'split-app');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'split-app' }));
  const installed = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  assert.equal(runNode(project).status, 0, '未拆分时应通过');

  // A topic file nobody registered: it exists, but no one knows when to read it.
  fs.writeFileSync(path.join(project, '.memory/PITFALLS-build.md'), '# 构建坑\n\n- P99 示例\n');
  const unregistered = runNode(project);
  assert.equal(unregistered.status, 1);
  assert.match(unregistered.stdout, /未在 PITFALLS\.md 主题表登记/);

  // Registering it clears the error.
  registerTopic(project, '| 构建 | PITFALLS-build.md | 改依赖或打包时 |');
  assert.equal(runNode(project).status, 0, '登记后应通过');

  // A row pointing at a file that does not exist is the mirror image of the same mistake.
  registerTopic(project, '| 构建 | PITFALLS-build.md | 改依赖或打包时 |\n| 幽灵 | PITFALLS-ghost.md | 不存在 |');
  const dangling = runNode(project);
  assert.equal(dangling.status, 1);
  assert.match(dangling.stdout, /引用了不存在的主题文件：PITFALLS-ghost\.md/);
  const pythonDangling = runPython(project);
  if (!pythonDangling.error) {
    assert.equal(pythonDangling.status, 1);
    assert.equal(pythonDangling.stdout, dangling.stdout, 'Node 与 Python 的主题表提示必须逐字节一致');
  }

  // Each topic file carries its own budget, so one oversized file cannot hide behind the split.
  fs.writeFileSync(path.join(project, '.memory/PITFALLS-build.md'), '# 构建坑\n\n' + '- 一条很长的教训\n'.repeat(1200));
  const oversized = runNode(project);
  assert.equal(oversized.status, 1);
  assert.match(oversized.stdout, /PITFALLS-build\.md 超出预算/);

  console.log('test-pitfalls-split: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
