#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-standards-init-'));
try {
  const project = path.join(tmp, 'php-app');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'composer.json'), JSON.stringify({ name: 'acme/demo-app', description: 'Demo "PHP" app' }));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'demo-frontend', scripts: { build: 'vite build' }, devDependencies: { vite: '^6.0.0' } }));
  fs.mkdirSync(path.join(project, '.githooks'), { recursive: true });
  const originalHook = '#!/bin/sh\necho project-hook\n';
  fs.writeFileSync(path.join(project, '.githooks/pre-commit'), originalHook);
  fs.writeFileSync(path.join(project, '.gitignore'), '.tmp/\n');
  const run = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, '--force'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(fs.readFileSync(path.join(project, '.githooks/pre-commit'), 'utf8'), originalHook, 'existing hook must be protected even with --force');
  const ignore = fs.readFileSync(path.join(project, '.gitignore'), 'utf8');
  assert.match(ignore, /vendor\//, '.gitignore should merge missing entries even if .tmp/ already exists');
  assert.match(ignore, /agent-project-standards \(managed\)/);
  const gov = fs.readFileSync(path.join(project, 'gov.toml'), 'utf8');
  const profile = fs.readFileSync(path.join(project, 'project-profile.toml'), 'utf8');
  assert.match(profile, /status = "needs_review"/);
  assert.match(profile, /detected = \["php", "node"\]/);
  assert.match(profile, /multi_agent = "off"/);
  assert.match(gov, /language = "php"/);
  assert.match(gov, /package_manager = "composer\+npm"/);
  assert.ok(fs.existsSync(path.join(project, 'scripts/generate-board.cjs')));
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

  const strictProject = path.join(tmp, 'strict-project');
  fs.mkdirSync(path.join(strictProject, 'legacy-folder'), { recursive: true });
  const strictSetup = spawnSync(process.execPath, [path.join(root, 'init.cjs'), strictProject, '--strict-scan'], { encoding: 'utf8' });
  assert.equal(strictSetup.status, 0, strictSetup.stdout + strictSetup.stderr);
  const strictGov = fs.readFileSync(path.join(strictProject, 'gov.toml'), 'utf8');
  assert.doesNotMatch(strictGov, /legacy-folder/);
  const strictCheck = spawnSync(process.execPath, [path.join(strictProject, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(strictCheck.status, 1);
  assert.match(strictCheck.stdout, /legacy-folder\//);
  console.log('test-init: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
