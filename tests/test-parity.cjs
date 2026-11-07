#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-standards-parity-'));
const fixture = path.join(tmp, 'repo');
function copy(src, dst) { fs.cpSync(src, dst, { recursive: true }); }
function run(cmd, args) { return spawnSync(cmd, args, { cwd: fixture, encoding: 'utf8' }); }
function assertParity(label) {
  const node = run(process.execPath, ['scripts/check-governance.cjs']);
  let py = run(process.env.PYTHON || 'python3', ['scripts/check_governance.py']);
  if (py.error && !process.env.PYTHON) py = run('python', ['scripts/check_governance.py']);
  if (py.error) throw new Error(`Python 3.10+ is required for parity tests: ${py.error.message}`);
  assert.equal(node.status, py.status, `${label}: exit code differs\nNode:\n${node.stdout}${node.stderr}\nPython:\n${py.stdout}${py.stderr}`);
  assert.equal(node.stdout, py.stdout, `${label}: stdout differs\nNode:\n${node.stdout}\nPython:\n${py.stdout}`);
  assert.equal(node.stderr, py.stderr, `${label}: stderr differs`);
  return node;
}
try {
  copy(path.join(root, 'template'), fixture);
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.rmSync(path.join(fixture, '.gitignore.append'), { force: true });
  // Make a self-contained fixture and generate its board/hash.
  const rootEntries = fs.readdirSync(fixture, { withFileTypes: true });
  const dirs = rootEntries.filter(e => e.isDirectory()).map(e => e.name);
  const files = rootEntries.filter(e => e.isFile() && e.name !== '.gitignore.append').map(e => e.name);
  const gov = fs.readFileSync(path.join(fixture, 'gov.toml'), 'utf8')
    .replace('allowed_dirs = []', `allowed_dirs = [${dirs.map(x => `"${x}"`).join(', ')}]`)
    .replace('allowed_files = []', `allowed_files = [${files.map(x => `"${x}"`).join(', ')}]`);
  fs.writeFileSync(path.join(fixture, 'gov.toml'), gov);
  run(process.execPath, ['scripts/generate-board.cjs']);
  let result = assertParity('baseline');
  assert.equal(result.status, 0, result.stdout + result.stderr);

  // Symlink classification must match between Node and Python.
  let symlinkCreated = true;
  try { fs.symlinkSync(path.join(fixture, 'src'), path.join(fixture, 'linked_src'), 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) symlinkCreated = false; else throw error; }
  if (symlinkCreated) {
    result = assertParity('directory symlink');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /根目录出现未登记文件：linked_src/);
    fs.unlinkSync(path.join(fixture, 'linked_src'));
  }

  // Invalid status, missing log and duplicate ID are all deterministic violations.
  const index = path.join(fixture, '.spec/tasks/index.md');
  const original = fs.readFileSync(index, 'utf8');
  fs.writeFileSync(index, original.replace('| planned |', '| nonsense |'));
  result = assertParity('invalid status');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /状态非法/);
  fs.writeFileSync(index, original);
  fs.unlinkSync(path.join(fixture, '.spec/tasks/T1/log.md'));
  result = assertParity('missing task log');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /缺少 log.md/);
  fs.writeFileSync(path.join(fixture, '.spec/tasks/T1/log.md'), 'test log\n');
  fs.writeFileSync(index, original.replace('| T1 |', '| T1 | 示例重复 | planned | `{{SRC_DIR}}/` |\n| T1 |'));
  result = assertParity('duplicate task id');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ID T1 重复/);

  const roadmapIndex = path.join(fixture, '.spec/roadmap/INDEX.md');
  const originalRoadmap = fs.readFileSync(roadmapIndex, 'utf8');
  fs.writeFileSync(roadmapIndex, originalRoadmap.replace('| M1 | 示例里程碑：把这张换成你的第一阶段 | — | 未开始 | T1 |', '| M1 | 示例里程碑：把这张换成你的第一阶段 | — | invalid | T1 |'));
  result = assertParity('invalid milestone status');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /M1 状态非法/);
  fs.writeFileSync(roadmapIndex, originalRoadmap);

  // Archiving a complete wave removes it from active checks without losing its files.
  const archivedIndex = original.replace('| T1 | 示例卡：把这张换成你的第一件事 | planned | `{{SRC_DIR}}/` |', '| — | — | — | — |');
  const archiveMarker = '## 已归档波次';
  const archiveAt = archivedIndex.indexOf(archiveMarker);
  fs.writeFileSync(index, archivedIndex.slice(0, archiveAt) + archivedIndex.slice(archiveAt).replace('| — | — | — | — |', '| W1 | 1 | done | `archive/W1/` |'));
  fs.mkdirSync(path.join(fixture, '.spec/tasks/archive/W1'), { recursive: true });
  fs.renameSync(path.join(fixture, '.spec/tasks/T1'), path.join(fixture, '.spec/tasks/archive/W1/T1'));
  run(process.execPath, ['scripts/generate-board.cjs']);
  result = assertParity('archived wave');
  assert.equal(result.status, 0, result.stdout + result.stderr);

  // Any subsequent index edit must invalidate the derived board until regenerated.
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8') + '\n<!-- changed -->\n');
  result = assertParity('stale board');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BOARD.md 已过期/);
  run(process.execPath, ['scripts/generate-board.cjs']);
  const boardPath = path.join(fixture, '.spec/tasks/BOARD.md');
  fs.writeFileSync(boardPath, fs.readFileSync(boardPath, 'utf8').replace('## 进行中', '## 手工篡改'));
  result = assertParity('manually edited board');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BOARD.md 已过期或被手工修改/);

  console.log('test-parity: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
