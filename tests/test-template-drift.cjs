#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { analyzeDrift } = require('../tools/check-template-drift.cjs');
const { buildBaseline } = require('../tools/adopt-template-baseline.cjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-template-drift-'));
const init = (project) => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
function snapshotTree(dir, rel = '') {
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const child = path.posix.join(rel.split(path.sep).join('/'), name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) result.push([child, 'symlink', fs.readlinkSync(absolute)]);
    else if (stat.isDirectory()) result.push([child, 'dir', ...snapshotTree(absolute, child)]);
    else result.push([child, 'file', fs.readFileSync(absolute).toString('base64')]);
  }
  return result;
}
function cloneStandards(destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(root, 'template'), path.join(destination, 'template'), { recursive: true });
}
try {
  const cleanProject = path.join(tmp, 'clean');
  fs.mkdirSync(cleanProject);
  const installed = init(cleanProject);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const markerPath = path.join(cleanProject, '.agent-standards.json');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  assert.equal(marker.format_version, 1);
  assert.equal(marker.baseline_state, 'complete');
  assert.ok(marker.managed_files['.spec/02-conventions.md']);
  assert.ok(marker.managed_blocks['.gitignore']);
  assert.ok(marker.derived_paths.includes('.spec/tasks/BOARD.md'));
  const clean = analyzeDrift({ projectRoot: cleanProject, standardsRoot: root });
  assert.equal(clean.ok, true, JSON.stringify(clean, null, 2));

  // The report is strictly read-only.
  const beforeRead = JSON.stringify(snapshotTree(cleanProject));
  analyzeDrift({ projectRoot: cleanProject, standardsRoot: root });
  assert.equal(JSON.stringify(snapshotTree(cleanProject)), beforeRead);

  // Text outside the managed .gitignore block is project-owned and must not be mistaken for template drift.
  const gitignoreProject = path.join(tmp, 'gitignore-boundary');
  fs.mkdirSync(gitignoreProject);
  const gitignoreInstall = init(gitignoreProject);
  assert.equal(gitignoreInstall.status, 0, gitignoreInstall.stdout + gitignoreInstall.stderr);
  const gitignorePath = path.join(gitignoreProject, '.gitignore');
  fs.appendFileSync(gitignorePath, '\n# Project-owned ignore rule\nlocal-cache/\n');
  const outsideBlock = analyzeDrift({ projectRoot: gitignoreProject, standardsRoot: root });
  assert.ok(outsideBlock.findings.some((item) => item.path === '.gitignore' && item.status === 'current'),
    JSON.stringify(outsideBlock.findings.filter((item) => item.path === '.gitignore')));

  // Changes inside the managed block are tracked separately from user content.
  const gitignoreText = fs.readFileSync(gitignorePath, 'utf8');
  const blockEnd = gitignoreText.indexOf('# <<< agent-project-standards (managed)');
  assert.ok(blockEnd >= 0, 'managed ignore block end marker must exist');
  fs.writeFileSync(gitignorePath, gitignoreText.slice(0, blockEnd) + '# project edit inside managed block\n' + gitignoreText.slice(blockEnd));
  const insideBlock = analyzeDrift({ projectRoot: gitignoreProject, standardsRoot: root });
  assert.ok(insideBlock.findings.some((item) => item.path === '.gitignore' && item.status === 'local_customized'));

  // A symlinked parent directory must not cause the checker to read outside the project.
  if (process.platform !== 'win32') {
    const linkedProject = path.join(tmp, 'linked-parent');
    fs.mkdirSync(linkedProject);
    const linkedInstall = init(linkedProject);
    assert.equal(linkedInstall.status, 0, linkedInstall.stdout + linkedInstall.stderr);
    const outsideSpec = path.join(tmp, 'outside-spec');
    fs.mkdirSync(outsideSpec);
    fs.writeFileSync(path.join(outsideSpec, '02-conventions.md'), '# external file must not be trusted\n');
    fs.renameSync(path.join(linkedProject, '.spec'), path.join(linkedProject, '.spec-real'));
    fs.symlinkSync(outsideSpec, path.join(linkedProject, '.spec'), 'dir');
    const linked = analyzeDrift({ projectRoot: linkedProject, standardsRoot: root });
    assert.ok(linked.findings.some((item) => item.path === '.spec/02-conventions.md' && item.status === 'local_unsafe'));
    assert.equal(fs.readFileSync(path.join(outsideSpec, '02-conventions.md'), 'utf8'), '# external file must not be trusted\n');

    const legacyLinkedProject = path.join(tmp, 'legacy-linked-parent');
    fs.mkdirSync(legacyLinkedProject);
    fs.mkdirSync(path.join(legacyLinkedProject, '.memory'));
    fs.symlinkSync(outsideSpec, path.join(legacyLinkedProject, '.spec'), 'dir');
    assert.throws(() => buildBaseline({ projectRoot: legacyLinkedProject, standardsRoot: root }), /路径包含符号链接/);
  }

  // On POSIX, changing executable mode is local drift even when bytes are unchanged.
  if (process.platform !== 'win32') {
    const hook = path.join(cleanProject, '.githooks/pre-commit');
    const originalMode = fs.statSync(hook).mode & 0o777;
    fs.chmodSync(hook, originalMode & ~0o111);
    const modeDrift = analyzeDrift({ projectRoot: cleanProject, standardsRoot: root });
    assert.ok(modeDrift.findings.some((item) => item.path === '.githooks/pre-commit' && item.status === 'local_customized'));
    fs.chmodSync(hook, originalMode);
  }

  // A project-only change is identified as local customization, not upstream drift.
  const conventions = path.join(cleanProject, '.spec/02-conventions.md');
  fs.appendFileSync(conventions, '\n## Project-specific customization\n');
  const local = analyzeDrift({ projectRoot: cleanProject, standardsRoot: root });
  assert.ok(local.findings.some((item) => item.path === '.spec/02-conventions.md' && item.status === 'local_customized'));

  // Simulate a newer template checkout without changing the repository under test.
  const newerStandards = path.join(tmp, 'newer-standards');
  cloneStandards(newerStandards);
  const newerConvention = path.join(newerStandards, 'template/.spec/02-conventions.md');
  fs.appendFileSync(newerConvention, '\n## Upstream addition\n');
  const versionPath = path.join(newerStandards, 'template/policy/standards-version.json');
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  version.version = '2.0.0-rc.13';
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');

  // A future upstream change to the managed source plus a local block edit is a conflict.
  const newerIgnoreSource = path.join(newerStandards, 'template/.gitignore.append');
  fs.appendFileSync(newerIgnoreSource, '\n# Upstream ignore addition\n');
  const ignoreConflict = analyzeDrift({ projectRoot: gitignoreProject, standardsRoot: newerStandards });
  assert.ok(ignoreConflict.findings.some((item) => item.path === '.gitignore' && item.status === 'conflict'));

  const conflict = analyzeDrift({ projectRoot: cleanProject, standardsRoot: newerStandards });
  assert.ok(conflict.findings.some((item) => item.path === '.spec/02-conventions.md' && item.status === 'conflict'));
  assert.equal(conflict.current_version, '2.0.0-rc.13');

  // On an untouched install, an upstream-only change is reported as update_available.
  const upstreamProject = path.join(tmp, 'upstream-only');
  fs.mkdirSync(upstreamProject);
  const upstreamInstall = init(upstreamProject);
  assert.equal(upstreamInstall.status, 0, upstreamInstall.stdout + upstreamInstall.stderr);
  const upstream = analyzeDrift({ projectRoot: upstreamProject, standardsRoot: newerStandards });
  assert.ok(upstream.findings.some((item) => item.path === '.spec/02-conventions.md' && item.status === 'update_available'));

  // New files are reported but never written to the installed project.
  fs.writeFileSync(path.join(newerStandards, 'template/.spec/new-guidance.md'), '# New guidance\n');
  const withNewFile = analyzeDrift({ projectRoot: upstreamProject, standardsRoot: newerStandards });
  assert.ok(withNewFile.findings.some((item) => item.path === '.spec/new-guidance.md' && item.status === 'new_upstream_file'));
  assert.equal(fs.existsSync(path.join(upstreamProject, '.spec/new-guidance.md')), false);

  // A legacy project has no provable baseline; do not guess which files are customized.
  const legacyProject = path.join(tmp, 'legacy');
  fs.mkdirSync(legacyProject);
  fs.writeFileSync(path.join(legacyProject, 'AGENTS.md'), '# Custom rules\n');
  const legacy = analyzeDrift({ projectRoot: legacyProject, standardsRoot: root });
  assert.equal(legacy.reason, 'baseline_missing');
  const cli = spawnSync(process.execPath, [path.join(root, 'tools/check-template-drift.cjs'), '--root', legacyProject], { encoding: 'utf8' });
  assert.equal(cli.status, 2, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /无法可靠区分上游修改与项目定制/);

  // Initializing a legacy project records skipped files as unbaselined, not clean.
  const migratedLegacy = init(legacyProject);
  assert.equal(migratedLegacy.status, 0, migratedLegacy.stdout + migratedLegacy.stderr);
  const legacyMarker = JSON.parse(fs.readFileSync(path.join(legacyProject, '.agent-standards.json'), 'utf8'));
  assert.equal(legacyMarker.baseline_state, 'partial_unknown');
  assert.ok(legacyMarker.preserved_paths.includes('AGENTS.md'));
  const partial = analyzeDrift({ projectRoot: legacyProject, standardsRoot: root });
  assert.equal(partial.baseline_incomplete, true);
  assert.ok(partial.findings.some((item) => item.path === 'AGENTS.md' && item.status === 'legacy_preserved'));

  // Baseline adoption is a separate, explicit, metadata-only operation.
  const legacyBeforeAdoption = JSON.stringify(snapshotTree(legacyProject));
  const adoptionPreview = spawnSync(process.execPath, [
    path.join(root, 'tools/adopt-template-baseline.cjs'), '--root', legacyProject, '--dry-run'
  ], { encoding: 'utf8' });
  assert.equal(adoptionPreview.status, 0, adoptionPreview.stdout + adoptionPreview.stderr);
  assert.equal(JSON.stringify(snapshotTree(legacyProject)), legacyBeforeAdoption, 'baseline preview must be read-only');
  const adoption = spawnSync(process.execPath, [
    path.join(root, 'tools/adopt-template-baseline.cjs'), '--root', legacyProject, '--confirm-reviewed'
  ], { encoding: 'utf8' });
  assert.equal(adoption.status, 0, adoption.stdout + adoption.stderr);
  const adoptedMarker = JSON.parse(fs.readFileSync(path.join(legacyProject, '.agent-standards.json'), 'utf8'));
  assert.equal(adoptedMarker.baseline_state, 'complete');
  assert.equal(adoptedMarker.baseline_adopted_after_review, true);
  assert.equal(adoptedMarker.managed_files['AGENTS.md'].customized_at_baseline, true);
  assert.equal(fs.readFileSync(path.join(legacyProject, 'AGENTS.md'), 'utf8'), '# Custom rules\n', 'adoption must not rewrite local rules');
  const adopted = analyzeDrift({ projectRoot: legacyProject, standardsRoot: root });
  assert.equal(adopted.ok, true, JSON.stringify(adopted, null, 2));
  assert.ok(adopted.findings.some((item) => item.path === 'AGENTS.md' && item.status === 'accepted_customization'));

  // A later upstream edit to a reviewed custom file must become a conflict.
  fs.appendFileSync(path.join(newerStandards, 'template/AGENTS.md'), '\n## New core guidance\n');
  const adoptedConflict = analyzeDrift({ projectRoot: legacyProject, standardsRoot: newerStandards });
  assert.ok(adoptedConflict.findings.some((item) => item.path === 'AGENTS.md' && item.status === 'conflict'));

  // A tampered manifest cannot make the checker read outside the project root.
  const tampered = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  tampered.managed_files['outside'] = {
    source: '../README.md', template_sha256: '0'.repeat(64), installed_sha256: '0'.repeat(64)
  };
  fs.writeFileSync(markerPath, JSON.stringify(tampered, null, 2));
  assert.throws(() => analyzeDrift({ projectRoot: cleanProject, standardsRoot: root }), /越出允许目录/);

  console.log('test-template-drift: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
