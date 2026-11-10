#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-standards-init-'));
// Created inside the test and removed in finally: proves untracked artifacts under
// template/ are filtered out of the install.
const junkDir = path.join(root, 'template/scripts/__pycache__');
function snapshotTree(dir, rel = '') {
  const entries = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const childRel = path.posix.join(rel.split(path.sep).join('/'), name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) entries.push([childRel, 'symlink', fs.readlinkSync(absolute)]);
    else if (stat.isDirectory()) entries.push([childRel, 'directory', stat.mode & 0o777, ...snapshotTree(absolute, childRel)]);
    else entries.push([childRel, 'file', stat.mode & 0o777, fs.readFileSync(absolute).toString('base64')]);
  }
  return entries;
}
try {
  // Placeholder contract: every {{KEY}} used by the template must be a key init knows.
  // fill() degrades an unknown key to a visible （待填：KEY） marker instead of failing,
  // so a template/init mismatch would ship a half-filled file to the user.
  const initSource = fs.readFileSync(path.join(root, 'init.cjs'), 'utf8');
  const block = initSource.match(/const replacements = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'init.cjs 缺少 replacements 定义');
  const knownKeys = new Set([...block[1].matchAll(/(?:^|[\s{,])([A-Z][A-Z0-9_]*)\s*[:,]/g)].map((m) => m[1]));
  knownKeys.add('IGNORE_ENTRIES'); // rendered separately into the managed .gitignore block
  const usedKeys = new Set();
  const collectPlaceholders = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { collectPlaceholders(full); continue; }
      for (const match of fs.readFileSync(full, 'utf8').matchAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g)) usedKeys.add(match[1]);
    }
  };
  collectPlaceholders(path.join(root, 'template'));
  const unknownKeys = [...usedKeys].filter((key) => !knownKeys.has(key)).sort();
  assert.deepEqual(unknownKeys, [], `模板使用了 init 不认识的占位符：${unknownKeys.join(', ')}`);

  // Untracked build artifacts under template/ (created by running the Python checker or an
  // editor) are gitignored, so CI never sees them, but they must not reach the project.
  fs.mkdirSync(junkDir, { recursive: true });
  fs.writeFileSync(path.join(junkDir, 'probe.cpython-313.pyc'), 'junk');

  const project = path.join(tmp, 'php-app');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'composer.json'), JSON.stringify({ name: 'acme/demo-app', description: 'Demo "PHP" app' }));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'demo-frontend', scripts: { build: 'vite build' }, devDependencies: { vite: '^6.0.0' } }));
  fs.mkdirSync(path.join(project, '.githooks'), { recursive: true });
  const originalHook = '#!/bin/sh\necho project-hook\n';
  fs.writeFileSync(path.join(project, '.githooks/pre-commit'), originalHook);
  fs.writeFileSync(path.join(project, '.gitignore'), '.tmp/\n');
  // An interrupted --force run leaves transaction files in the project root. Whitelisting them
  // would make the governance gate treat that junk as legitimate forever.
  const staleArtifact = '.AGENTS.md.agent-standards-backup-9999-1';
  fs.writeFileSync(path.join(project, staleArtifact), 'stale');
  const beforePreview = JSON.stringify(snapshotTree(project));
  const preview = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--force', '--dry-run'], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.deepEqual(JSON.stringify(snapshotTree(project)), beforePreview, '--dry-run must leave the complete target tree unchanged');

  const unknownFlag = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--unknown-option'], { encoding: 'utf8' });
  assert.equal(unknownFlag.status, 2, 'unknown options must be rejected');
  const multipleTargets = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, path.join(tmp, 'another-target')], { encoding: 'utf8' });
  assert.equal(multipleTargets.status, 2, 'multiple target directories must be rejected');
  const replaceWithoutForce = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--replace-hook'], { encoding: 'utf8' });
  assert.equal(replaceWithoutForce.status, 2, '--replace-hook must require --force');
  assert.deepEqual(JSON.stringify(snapshotTree(project)), beforePreview, 'invalid arguments must not mutate the target');

  const run = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--force'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(fs.readFileSync(path.join(project, '.githooks/pre-commit'), 'utf8'), originalHook, 'existing hook must be protected even with --force');
  const ignore = fs.readFileSync(path.join(project, '.gitignore'), 'utf8');
  assert.match(ignore, /vendor\//, '.gitignore should merge missing entries even if .tmp/ already exists');
  assert.match(ignore, /agent-project-standards \(managed\)/);
  const gov = fs.readFileSync(path.join(project, 'gov.toml'), 'utf8');
  assert.doesNotMatch(gov, /agent-standards-backup/, '安装残留的事务文件不得进入根目录白名单');
  // Not whitelisted means it surfaces as a violation instead of being silently legitimized.
  const staleCheck = spawnSync(process.execPath, [path.join(project, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(staleCheck.status, 1, '残留事务文件必须被判为未登记文件');
  assert.match(staleCheck.stdout, /根目录出现未登记文件/);
  // The governance message suggests whitelisting, which is exactly wrong for these files;
  // init must name them for what they are.
  const staleRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--force'], { encoding: 'utf8' });
  assert.equal(staleRun.status, 0, staleRun.stdout + staleRun.stderr);
  // Warnings are written to stderr, like the rest of the report's diagnostics.
  assert.match(staleRun.stdout + staleRun.stderr, /上次安装残留的事务文件/);
  assert.match(staleRun.stdout + staleRun.stderr, /不要加进 gov\.toml/);
  fs.rmSync(path.join(project, staleArtifact));
  const profile = fs.readFileSync(path.join(project, 'project-profile.toml'), 'utf8');
  assert.match(profile, /status = "needs_review"/);
  assert.match(profile, /detected = \["php", "node"\]/);
  assert.match(profile, /multi_agent = "off"/);
  assert.match(gov, /language = "php"/);
  assert.match(gov, /package_manager = "composer\+npm"/);
  assert.ok(fs.existsSync(path.join(project, 'scripts/generate-board.cjs')));
  assert.ok(!fs.existsSync(path.join(project, 'scripts/__pycache__')), '模板里的编译缓存不得复制进项目');
  assert.ok(!fs.existsSync(path.join(project, 'scripts/probe.cpython-313.pyc')), '模板里的 .pyc 不得复制进项目');
  // The README tells the user to add project-specific wording to AGENTS.md. Shipping an entry
  // file at 99% of its own budget makes the governance gate block exactly that edit.
  const installedGov = fs.readFileSync(path.join(project, 'gov.toml'), 'utf8');
  const agentsBudget = Number(installedGov.match(/^agents_bytes\s*=\s*(\d+)/m)[1]);
  const installedAgents = Buffer.byteLength(
    fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8').replace(/\r\n/g, '\n'), 'utf8');
  assert.ok(
    agentsBudget - installedAgents >= 1024,
    `初始化后的 AGENTS.md 只留 ${agentsBudget - installedAgents}B 余量（${installedAgents}/${agentsBudget}B），至少要留 1024B 给项目自有规则`);
  // An unknown placeholder would ship to the user as a literal {{X}} marker: init only
  // substitutes known keys, so the installed tree is scanned instead of trusted.
  const leftovers = [];
  const isTextFile = (name) => /\.(?:md|toml|json|cjs|py|example)$/.test(name) || name === '.gitignore' || name === 'pre-commit';
  const scanPlaceholders = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '.git') scanPlaceholders(full); continue; }
      if (!isTextFile(entry.name)) continue;
      for (const match of fs.readFileSync(full, 'utf8').matchAll(/\{\{[A-Z_]+\}\}/g)) {
        leftovers.push(`${path.relative(project, full)} → ${match[0]}`);
      }
    }
  };
  scanPlaceholders(project);
  assert.deepEqual(leftovers, [], '初始化后仍残留未替换的占位符');
  const installManifest = JSON.parse(fs.readFileSync(path.join(project, '.agent-standards.json'), 'utf8'));
  assert.equal(installManifest.format_version, 1);
  assert.equal(installManifest.baseline_state, 'complete');
  assert.ok(installManifest.managed_files['gov.toml']);
  assert.ok(installManifest.managed_blocks['.gitignore']);
  assert.ok(installManifest.derived_paths.includes('.spec/tasks/BOARD.md'));
  assert.ok(!installManifest.preserved_paths.includes('AGENTS.md'));
  assert.ok(!installManifest.preserved_paths.includes('.githooks/pre-commit'), 'protected project hooks are intentionally unmanaged, not an unknown template baseline');
  const profileValidator = require(path.join(root, 'template/scripts/profile-validator.cjs'));
  const profileResult = profileValidator.validateProfile(project);
  assert.deepEqual(profileResult.errors, []);
  assert.ok(profileResult.warnings.some((warning) => warning.includes('needs_review')));
  const profilePath = path.join(project, 'project-profile.toml');
  const validProfile = fs.readFileSync(profilePath, 'utf8');
  fs.writeFileSync(profilePath, validProfile.replace('task_tracking = "auto"', 'task_tracking = "invalid"'));
  assert.ok(profileValidator.validateProfile(project).errors.some((error) => error.includes('非法能力配置')));
  fs.writeFileSync(profilePath, validProfile.replace('roadmap = "auto"', 'roadmap = "on"').replace('task_tracking = "auto"', 'task_tracking = "off"'));
  assert.ok(profileValidator.validateProfile(project).errors.some((error) => error.includes('能力依赖冲突')));
  fs.writeFileSync(profilePath, validProfile);
  const governance = spawnSync(process.execPath, [path.join(project, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(governance.status, 0, governance.stdout + governance.stderr);
  let python = spawnSync('python3', [path.join(project, 'scripts/check_governance.py')], { encoding: 'utf8' });
  if (python.error) python = spawnSync('python', [path.join(project, 'scripts/check_governance.py')], { encoding: 'utf8' });
  if (!python.error) assert.equal(python.status, 0, python.stdout + python.stderr);
  const replaceHook = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--force', '--replace-hook'], { encoding: 'utf8' });
  assert.equal(replaceHook.status, 0, replaceHook.stdout + replaceHook.stderr);
  assert.match(fs.readFileSync(path.join(project, '.githooks/pre-commit'), 'utf8'), /失败关闭/);
  if (process.platform !== 'win32') {
    fs.writeFileSync(path.join(project, '.githooks/pre-commit.local'), '#!/bin/sh\nexit 9\n');
    const localHook = spawnSync('/bin/sh', ['.githooks/pre-commit'], { cwd: project, env: process.env, encoding: 'utf8' });
    assert.equal(localHook.status, 9, 'project-specific hook failure must block commit');
    fs.unlinkSync(path.join(project, '.githooks/pre-commit.local'));
  }
  const again = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal((fs.readFileSync(path.join(project, '.gitignore'), 'utf8').match(/agent-project-standards \(managed\)/g) || []).length, 2, 'managed block must not duplicate');
  const noRuntime = path.join(tmp, 'no-runtime');
  fs.mkdirSync(noRuntime);
  const setup = spawnSync(process.execPath, [path.join(root, 'init.cjs'), noRuntime], { encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stdout + setup.stderr);
  if (process.platform !== 'win32') {
    const noRuntimeHook = spawnSync('/bin/sh', ['.githooks/pre-commit'], { cwd: noRuntime, env: { PATH: '/nonexistent' }, encoding: 'utf8' });
    assert.equal(noRuntimeHook.status, 1, 'pre-commit must fail closed when no runtime is available');
    assert.match(noRuntimeHook.stderr, /找不到可用的治理检查运行环境/);
  }

  // Dry-run validates an existing BOARD but never regenerates it.
  const dryRunBoardProject = path.join(tmp, 'dry-run-board-project');
  fs.mkdirSync(path.join(dryRunBoardProject, '.spec/tasks'), { recursive: true });
  fs.copyFileSync(path.join(root, 'template/.spec/tasks/index.md'), path.join(dryRunBoardProject, '.spec/tasks/index.md'));
  const staleBoard = '# Custom board\n\n<!-- GENERATED:START -->\nstale content\n<!-- GENERATED:END -->\n';
  fs.writeFileSync(path.join(dryRunBoardProject, '.spec/tasks/BOARD.md'), staleBoard);
  const boardPreview = spawnSync(process.execPath, [path.join(root, 'init.cjs'), dryRunBoardProject, '--dry-run'], { encoding: 'utf8' });
  assert.equal(boardPreview.status, 0, boardPreview.stdout + boardPreview.stderr);
  assert.equal(fs.readFileSync(path.join(dryRunBoardProject, '.spec/tasks/BOARD.md'), 'utf8'), staleBoard, 'dry-run must not regenerate a stale BOARD');

  // A malformed derived view must be detected before any template files are installed.
  const malformedBoardProject = path.join(tmp, 'malformed-board-project');
  fs.mkdirSync(path.join(malformedBoardProject, '.spec/tasks'), { recursive: true });
  fs.writeFileSync(path.join(malformedBoardProject, '.spec/tasks/index.md'), fs.readFileSync(path.join(root, 'template/.spec/tasks/index.md'), 'utf8'));
  fs.writeFileSync(path.join(malformedBoardProject, '.spec/tasks/BOARD.md'), '# User board without managed markers\n');
  const malformedBoardRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), malformedBoardProject, '--force'], { encoding: 'utf8' });
  assert.equal(malformedBoardRun.status, 1, malformedBoardRun.stdout + malformedBoardRun.stderr);
  assert.match(malformedBoardRun.stderr, /BOARD 预检失败/);
  assert.deepEqual(fs.readdirSync(malformedBoardProject), ['.spec'], 'BOARD preflight must fail before installing unrelated templates');

  // If a later installation step fails, overwritten files and new artifacts must roll back.
  const rollbackProject = path.join(tmp, 'rollback-project');
  fs.mkdirSync(rollbackProject);
  const originalAgents = '# Project-owned rules\nKeep this exact content.\n';
  fs.writeFileSync(path.join(rollbackProject, 'AGENTS.md'), originalAgents);
  const rollbackBefore = JSON.stringify(snapshotTree(rollbackProject));
  const failedInstall = spawnSync(process.execPath, [path.join(root, 'init.cjs'), rollbackProject, '--force'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', AGENT_STANDARDS_TEST_FAIL_AFTER_PATH: 'AGENTS.md' },
  });
  assert.equal(failedInstall.status, 1, failedInstall.stdout + failedInstall.stderr);
  assert.match(failedInstall.stderr, /已尝试回滚本次写入/);
  assert.ok(failedInstall.stderr.includes('测试故障注入：AGENTS.md'));
  assert.equal(JSON.stringify(snapshotTree(rollbackProject)), rollbackBefore, 'failed initialization must restore overwritten files and remove newly created artifacts');

  const rollbackHookProject = path.join(tmp, 'rollback-hook-project');
  fs.mkdirSync(path.join(rollbackHookProject, '.githooks'), { recursive: true });
  const originalRollbackHook = '#!/bin/sh\n# keep project hook\nexit 0\n';
  fs.writeFileSync(path.join(rollbackHookProject, '.githooks/pre-commit'), originalRollbackHook);
  if (process.platform !== 'win32') fs.chmodSync(path.join(rollbackHookProject, '.githooks/pre-commit'), 0o755);
  const rollbackHookBefore = JSON.stringify(snapshotTree(rollbackHookProject));
  const failedHookReplacement = spawnSync(process.execPath, [
    path.join(root, 'init.cjs'), rollbackHookProject, '--force', '--replace-hook',
  ], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', AGENT_STANDARDS_TEST_FAIL_AFTER_PATH: '.githooks/pre-commit' },
  });
  assert.equal(failedHookReplacement.status, 1, failedHookReplacement.stdout + failedHookReplacement.stderr);
  assert.equal(JSON.stringify(snapshotTree(rollbackHookProject)), rollbackHookBefore, 'failed hook replacement must restore original hook content and mode');

  // A target-owned generator is user code: initialization must never execute it.
  const customGeneratorProject = path.join(tmp, 'custom-generator-project');
  fs.mkdirSync(path.join(customGeneratorProject, '.spec/tasks'), { recursive: true });
  fs.mkdirSync(path.join(customGeneratorProject, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'template/.spec/tasks/index.md'), path.join(customGeneratorProject, '.spec/tasks/index.md'));
  const executionMarker = path.join(customGeneratorProject, 'CUSTOM_GENERATOR_WAS_EXECUTED');
  const customGeneratorSource = "require('node:fs').writeFileSync(" + JSON.stringify(executionMarker) + ", 'executed');\n";
  fs.writeFileSync(path.join(customGeneratorProject, 'scripts/generate-board.cjs'), customGeneratorSource);
  const customGeneratorRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), customGeneratorProject], { encoding: 'utf8' });
  assert.equal(customGeneratorRun.status, 0, customGeneratorRun.stdout + customGeneratorRun.stderr);
  assert.equal(fs.existsSync(executionMarker), false, 'initializer must not execute a project-owned generator');
  assert.ok(fs.existsSync(path.join(customGeneratorProject, '.spec/tasks/BOARD.md')), 'trusted bundled generator should still produce BOARD.md');

  // Existing symlinked managed paths must be rejected before any template file is written.
  const symlinkProject = path.join(tmp, 'symlink-project');
  const externalDir = path.join(tmp, 'external-target');
  fs.mkdirSync(symlinkProject);
  fs.mkdirSync(externalDir);
  fs.writeFileSync(path.join(externalDir, 'keep.txt'), 'external data must remain untouched');
  let symlinkCreated = false;
  try {
    fs.symlinkSync(externalDir, path.join(symlinkProject, '.spec'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkCreated = true;
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) throw error;
    console.warn('Skipping Windows symlink fixture: current runner does not permit symlink creation.');
  }
  if (symlinkCreated) {
    const blocked = spawnSync(process.execPath, [path.join(root, 'init.cjs'), symlinkProject, '--force'], { encoding: 'utf8' });
    assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
    assert.match(blocked.stderr, /安全预检失败/);
    assert.deepEqual(fs.readdirSync(symlinkProject), ['.spec'], 'preflight must abort before writing any template file');
    assert.equal(fs.readFileSync(path.join(externalDir, 'keep.txt'), 'utf8'), 'external data must remain untouched');
  }

  const symlinkIgnoreProject = path.join(tmp, 'symlink-ignore-project');
  const externalIgnore = path.join(tmp, 'external-ignore');
  fs.mkdirSync(symlinkIgnoreProject);
  fs.writeFileSync(externalIgnore, 'external ignore file');
  let ignoreSymlinkCreated = false;
  try {
    fs.symlinkSync(externalIgnore, path.join(symlinkIgnoreProject, '.gitignore'), 'file');
    ignoreSymlinkCreated = true;
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) throw error;
    console.warn('Skipping Windows file-symlink fixture: current runner does not permit symlink creation.');
  }
  if (ignoreSymlinkCreated) {
    const blocked = spawnSync(process.execPath, [path.join(root, 'init.cjs'), symlinkIgnoreProject, '--force'], { encoding: 'utf8' });
    assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
    assert.equal(fs.readFileSync(externalIgnore, 'utf8'), 'external ignore file', '.gitignore symlink target must not be modified');
    assert.deepEqual(fs.readdirSync(symlinkIgnoreProject), ['.gitignore'], 'file-symlink preflight must happen before template writes');
  }

  const strictProject = path.join(tmp, 'strict-project');
  fs.mkdirSync(path.join(strictProject, 'legacy-folder'), { recursive: true });
  const strictSetup = spawnSync(process.execPath, [path.join(root, 'init.cjs'), strictProject, '--strict-scan'], { encoding: 'utf8' });
  assert.equal(strictSetup.status, 0, strictSetup.stdout + strictSetup.stderr);
  const strictGov = fs.readFileSync(path.join(strictProject, 'gov.toml'), 'utf8');
  assert.doesNotMatch(strictGov, /legacy-folder/);
  const strictCheck = spawnSync(process.execPath, [path.join(strictProject, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(strictCheck.status, 1);
  assert.match(strictCheck.stdout, /legacy-folder\//);
  // Root-level plan files are imported instead of failing the first governance run: someone who
  // just installed governance should not have to hand-migrate their own notes.
  const planProject = path.join(tmp, 'plan-app');
  fs.mkdirSync(planProject);
  fs.writeFileSync(path.join(planProject, 'package.json'), JSON.stringify({ name: 'plan-app' }));
  const todoText = '# TODO\n\n- [ ] 加登录页\n- [ ] 修导出 bug\n';
  fs.writeFileSync(path.join(planProject, 'TODO.md'), todoText);
  fs.writeFileSync(path.join(planProject, 'NOTES.md'), '# Notes\n\n- 接口草稿\n');
  const planRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), planProject], { encoding: 'utf8' });
  assert.equal(planRun.status, 0, planRun.stdout + planRun.stderr);
  assert.match(planRun.stdout, /导入 2 项/);
  assert.ok(!fs.existsSync(path.join(planProject, 'TODO.md')), '根目录计划文件应被移走');
  assert.ok(!fs.existsSync(path.join(planProject, 'NOTES.md')), '根目录计划文件应被移走');
  assert.equal(
    fs.readFileSync(path.join(planProject, '.spec/tasks/T1/imported/TODO.md'), 'utf8'),
    todoText,
    '导入必须逐字保留原文');
  assert.match(
    fs.readFileSync(path.join(planProject, '.spec/tasks/index.md'), 'utf8'),
    /\| T1 \| 导入：根目录计划文件（NOTES\.md、TODO\.md） \| planned \|/);
  const planCheck = spawnSync(process.execPath, [path.join(planProject, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(planCheck.status, 0, `导入后治理检查必须直接通过：\n${planCheck.stdout}${planCheck.stderr}`);

  // Opting out must leave the files alone — and then the gate is expected to fail.
  const keepProject = path.join(tmp, 'keep-plans-app');
  fs.mkdirSync(keepProject);
  fs.writeFileSync(path.join(keepProject, 'package.json'), JSON.stringify({ name: 'keep-plans' }));
  fs.writeFileSync(path.join(keepProject, 'TODO.md'), todoText);
  const keepRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), keepProject, '--no-import-plans'], { encoding: 'utf8' });
  assert.equal(keepRun.status, 0, keepRun.stdout + keepRun.stderr);
  assert.ok(fs.existsSync(path.join(keepProject, 'TODO.md')), '--no-import-plans 不得移动文件');
  const keepCheck = spawnSync(process.execPath, [path.join(keepProject, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(keepCheck.status, 1, '选择不导入时，根目录计划文件必须被判违规');

  console.log('test-init: all cases passed');
} finally {
  fs.rmSync(junkDir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}
