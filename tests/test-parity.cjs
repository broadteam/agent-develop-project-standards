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
  // The governance fixture must satisfy the new installation metadata requirement.
  fs.writeFileSync(path.join(fixture, '.agent-standards.json'), '{}\n');
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
  const taskArchiveIndex = path.join(fixture, '.spec/tasks/archive/INDEX.md');
  const taskArchiveOriginal = fs.readFileSync(taskArchiveIndex, 'utf8');
  fs.writeFileSync(taskArchiveIndex, taskArchiveOriginal.replace('| — | — | — | — |', '| W1 | 1 | 2026-11-08 | archive/W1/ |'));
  run(process.execPath, ['scripts/generate-board.cjs']);
  result = assertParity('archived wave');
  assert.equal(result.status, 0, result.stdout + result.stderr);

  // Archive catalogs must match the active archive pointer and the real contents.
  fs.writeFileSync(taskArchiveIndex, fs.readFileSync(taskArchiveIndex, 'utf8').replace('| W1 | 1 |', '| W1 | 2 |'));
  result = assertParity('archived task count mismatch');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /任务归档：波次 W1 任务数与目录内容不一致/);
  fs.writeFileSync(taskArchiveIndex, taskArchiveOriginal.replace('| — | — | — | — |', '| W1 | 1 | 2026-11-08 | archive/W1/ |'));
  const archivedLog = path.join(fixture, '.spec/tasks/archive/W1/T1/log.md');
  const archivedLogText = fs.readFileSync(archivedLog, 'utf8');
  fs.unlinkSync(archivedLog);
  result = assertParity('archived task missing log');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /任务归档：W1\/T1\/ 缺少 log.md/);
  fs.writeFileSync(archivedLog, archivedLogText);

  // Archive paths cannot escape their owning archive root; unindexed folders are rejected.
  const taskIndexText = fs.readFileSync(index, 'utf8');
  fs.writeFileSync(index, taskIndexText.replace('`archive/W1/`', '`../../README.md`'));
  fs.writeFileSync(taskArchiveIndex, fs.readFileSync(taskArchiveIndex, 'utf8').replace('archive/W1/', '../../README.md'));
  result = assertParity('archive path traversal');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /任务归档：波次 W1 的归档目录不存在或路径非法/);
  fs.writeFileSync(index, taskIndexText);
  fs.writeFileSync(taskArchiveIndex, taskArchiveOriginal.replace('| — | — | — | — |', '| W1 | 1 | 2026-11-08 | archive/W1/ |'));
  fs.mkdirSync(path.join(fixture, '.spec/tasks/archive/W2'));
  result = assertParity('orphan task archive directory');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /任务归档：归档目录 W2 未登记到 archive\/INDEX\.md/);
  fs.rmdirSync(path.join(fixture, '.spec/tasks/archive/W2'));

  // Roadmap archives have the same two-way catalog and detail-file contract.
  const roadmapWithoutActive = originalRoadmap
    .replace('| M1 | 示例里程碑：把这张换成你的第一阶段 | — | 未开始 | T1 |', '| — | — | — | — | — |');
  const roadmapArchiveMarker = '## 已归档里程碑';
  const roadmapArchiveAt = roadmapWithoutActive.indexOf(roadmapArchiveMarker);
  const roadmapActive = roadmapWithoutActive.slice(0, roadmapArchiveAt)
    + roadmapWithoutActive.slice(roadmapArchiveAt).replace('| — | — | — |', '| M1 | 示例里程碑：把这张换成你的第一阶段 | 已完成并归档 |');
  fs.writeFileSync(roadmapIndex, roadmapActive);
  fs.mkdirSync(path.join(fixture, '.spec/roadmap/archive'), { recursive: true });
  fs.renameSync(path.join(fixture, '.spec/roadmap/M1'), path.join(fixture, '.spec/roadmap/archive/M1'));
  const roadmapArchiveIndex = path.join(fixture, '.spec/roadmap/archive/INDEX.md');
  const roadmapArchiveOriginal = fs.readFileSync(roadmapArchiveIndex, 'utf8');
  fs.writeFileSync(roadmapArchiveIndex, roadmapArchiveOriginal.replace('| — | — | — | — |', '| M1 | 示例里程碑：把这张换成你的第一阶段 | 2026-11-08 | archive/M1/ |'));
  result = assertParity('archived milestone');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  fs.writeFileSync(roadmapArchiveIndex, fs.readFileSync(roadmapArchiveIndex, 'utf8').replace('archive/M1/', 'archive/Missing/'));
  result = assertParity('archived milestone missing directory');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /里程碑归档：ID M1 的目录或 milestone\.md 不存在/);
  fs.writeFileSync(roadmapArchiveIndex, roadmapArchiveOriginal.replace('| — | — | — | — |', '| M1 | 示例里程碑：把这张换成你的第一阶段 | 2026-11-08 | archive/M1/ |'));

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

  // Line endings must not change semantics. Windows developers commonly have
  // core.autocrlf=true, so a CRLF checkout has to report the same budget bytes and
  // the same board freshness as an LF one.
  run(process.execPath, ['scripts/generate-board.cjs']);
  const agentsPath = path.join(fixture, 'AGENTS.md');
  const agentsLf = fs.readFileSync(agentsPath, 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(agentsPath, agentsLf, 'utf8');
  const lfRun = assertParity('LF checkout');
  assert.equal(lfRun.status, 0, lfRun.stdout + lfRun.stderr);
  const budgetLine = (out) => out.split('\n').find((line) => line.includes('AGENTS.md  '));
  const lfBudget = budgetLine(lfRun.stdout);
  assert.ok(lfBudget, '缺少 AGENTS.md 预算行');

  fs.writeFileSync(agentsPath, agentsLf.replace(/\n/g, '\r\n'), 'utf8');
  const crlfRun = assertParity('CRLF checkout');
  assert.equal(crlfRun.status, 0, crlfRun.stdout + crlfRun.stderr);
  assert.equal(budgetLine(crlfRun.stdout), lfBudget, 'CRLF 检出不得改变预算字节数');

  fs.writeFileSync(boardPath, fs.readFileSync(boardPath, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8');
  const crlfBoardRun = assertParity('CRLF board');
  assert.equal(crlfBoardRun.status, 0, crlfBoardRun.stdout + crlfBoardRun.stderr);

  console.log('test-parity: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
