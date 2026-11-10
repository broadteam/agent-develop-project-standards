#!/usr/bin/env node
'use strict';

// Exercises the safe path in MIGRATION-v2.0.md using disposable projects only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-standards-migration-v2-'));
const init = (project, ...args) => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project, ...args], { encoding: 'utf8' });

try {
  // A dry run of an empty project is a true preview: it must not create any artifact.
  const empty = path.join(tmp, 'empty-project');
  fs.mkdirSync(empty);
  const preview = init(empty, '--dry-run');
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.match(preview.stdout, /--dry-run/);
  assert.deepEqual(fs.readdirSync(empty), [], 'dry-run must not write an empty project');

  // A real first install on an empty project must be usable immediately: the governance
  // gate has to pass without any manual follow-up. This is the most common first-run path.
  const fresh = path.join(tmp, 'fresh-empty');
  fs.mkdirSync(fresh);
  const freshInit = init(fresh);
  assert.equal(freshInit.status, 0, freshInit.stdout + freshInit.stderr);
  const freshCheck = spawnSync(process.execPath, [path.join(fresh, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(freshCheck.status, 0, `首次安装后治理检查必须直接通过：\n${freshCheck.stdout}${freshCheck.stderr}`);
  assert.ok(fs.existsSync(path.join(fresh, '.agent-standards.json')), '首次安装必须生成安装清单');
  assert.match(fs.readFileSync(path.join(fresh, 'project-profile.toml'), 'utf8'), /status = "needs_review"/);

  // Model a 1.2.x project with local customizations and multiple detectable stacks.
  const existing = path.join(tmp, 'existing multi stack');
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'package.json'), JSON.stringify({ name: 'example/app', scripts: { test: 'node test.cjs' } }));
  fs.writeFileSync(path.join(existing, 'pyproject.toml'), '[project]\nname = "example-app"\n');
  fs.writeFileSync(path.join(existing, 'AGENTS.md'), '# Existing project rules\nDo not replace this customization.\n');
  fs.writeFileSync(path.join(existing, 'CLAUDE.md'), '# Existing Claude customization\n');
  fs.mkdirSync(path.join(existing, '.githooks'));
  const customHook = '#!/bin/sh\necho project-owned-hook\n';
  fs.writeFileSync(path.join(existing, '.githooks', 'pre-commit'), customHook);

  const before = new Map([
    ['AGENTS.md', fs.readFileSync(path.join(existing, 'AGENTS.md'), 'utf8')],
    ['CLAUDE.md', fs.readFileSync(path.join(existing, 'CLAUDE.md'), 'utf8')],
    ['.githooks/pre-commit', customHook],
  ]);
  const existingPreview = init(existing, '--dry-run');
  assert.equal(existingPreview.status, 0, existingPreview.stdout + existingPreview.stderr);
  for (const [rel, content] of before) assert.equal(fs.readFileSync(path.join(existing, rel), 'utf8'), content, `${rel} must survive migration preview`);
  assert.ok(!fs.existsSync(path.join(existing, 'gov.toml')), 'dry-run must not create migration files');

  const migrate = init(existing);
  assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
  for (const [rel, content] of before) assert.equal(fs.readFileSync(path.join(existing, rel), 'utf8'), content, `${rel} must not be overwritten without --force`);
  assert.ok(fs.existsSync(path.join(existing, 'GEMINI.md')), 'missing client pointers may be added safely');
  assert.ok(fs.existsSync(path.join(existing, 'project-profile.toml')));
  const migrationManifest = JSON.parse(fs.readFileSync(path.join(existing, '.agent-standards.json'), 'utf8'));
  assert.equal(migrationManifest.baseline_state, 'partial_unknown', 'pre-existing customized rules must not be assumed to match a clean template baseline');
  assert.ok(migrationManifest.preserved_paths.includes('AGENTS.md'));
  const profile = fs.readFileSync(path.join(existing, 'project-profile.toml'), 'utf8');
  assert.match(profile, /status = "needs_review"/);
  assert.match(profile, /detected = \["python", "node"\]/);
  assert.match(migrate.stderr, /检测到多技术栈：python, node/);

  // A second initialization must be safe and must not duplicate managed content.
  const stableFiles = ['gov.toml', 'project-profile.toml', '.gitignore', '.standards/check-governance.cjs'];
  const firstPass = new Map(stableFiles.map((rel) => [rel, fs.readFileSync(path.join(existing, rel), 'utf8')]));
  const secondPass = init(existing);
  assert.equal(secondPass.status, 0, secondPass.stdout + secondPass.stderr);
  for (const [rel, content] of firstPass) {
    assert.equal(fs.readFileSync(path.join(existing, rel), 'utf8'), content, `${rel} must remain stable after repeated initialization`);
  }
  for (const [rel, content] of before) {
    assert.equal(fs.readFileSync(path.join(existing, rel), 'utf8'), content, `${rel} must remain protected after repeated initialization`);
  }

  const governance = spawnSync(process.execPath, [path.join(existing, '.standards', 'check-governance.cjs')], { cwd: existing, encoding: 'utf8' });
  assert.equal(governance.status, 0, governance.stdout + governance.stderr);
  console.log('test-migration-v2: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
