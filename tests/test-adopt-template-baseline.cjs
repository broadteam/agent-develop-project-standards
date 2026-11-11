#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildBaseline } = require('../tools/adopt-template-baseline.cjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-adopt-baseline-'));
const tool = path.join(root, 'tools/adopt-template-baseline.cjs');

function cloneStandards(destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(root, 'template'), path.join(destination, 'template'), { recursive: true });
  const presets = path.join(root, 'presets');
  if (fs.existsSync(presets)) fs.cpSync(presets, path.join(destination, 'presets'), { recursive: true });
}
function snapshotTree(dir, rel = '') {
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const child = path.posix.join(rel.split(path.sep).join('/'), name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) result.push({ path: child, type: 'symlink', target: fs.readlinkSync(absolute), mode: stat.mode & 0o777 });
    else if (stat.isDirectory()) {
      result.push({ path: child, type: 'directory', mode: stat.mode & 0o777 });
      result.push(...snapshotTree(absolute, child));
    } else {
      result.push({ path: child, type: 'file', hash: require('node:crypto').createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'), mode: stat.mode & 0o777 });
    }
  }
  return result;
}
function run(project, standards, ...args) {
  return spawnSync(process.execPath, [
    tool, '--root', project, '--standards-root', standards, ...args
  ], { encoding: 'utf8' });
}
function writeTemplateFile(project, standards, rel, content) {
  const source = path.join(standards, 'template', rel);
  const target = path.join(project, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (content !== undefined) fs.writeFileSync(target, content);
  return target;
}
function expectStaleConfirmation(project, standards, planId, reason) {
  const rejected = run(project, standards, '--expect-plan-id', planId, '--confirm-reviewed', '--json');
  assert.equal(rejected.status, 2, rejected.stdout + rejected.stderr);
  assert.match(rejected.stderr, /发生变化|再次变化/);
  assert.ok(!fs.existsSync(path.join(project, '.agent-standards.json')), reason);
}

try {
  const standards = path.join(tmp, 'standards');
  const project = path.join(tmp, 'legacy-project');
  cloneStandards(standards);
  fs.mkdirSync(project);

  // Simulate an established project that retained a handful of template files but has no
  // trustworthy installer manifest. One file is intentionally customized before adoption.
  writeTemplateFile(project, standards, 'AGENTS.md',
    fs.readFileSync(path.join(standards, 'template/AGENTS.md'), 'utf8') + '\n<!-- legacy project rule -->\n');
  writeTemplateFile(project, standards, '.spec/01-architecture.md');
  writeTemplateFile(project, standards, '.spec/02-conventions.md');
  writeTemplateFile(project, standards, '.spec/REGISTRY.md');
  writeTemplateFile(project, standards, '.memory/MEMORY.md');
  const customBefore = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  const originalSnapshot = snapshotTree(project);

  const preview = run(project, standards, '--dry-run', '--json');
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  const plan = JSON.parse(preview.stdout);
  assert.match(plan.plan_id, /^[a-f0-9]{16}$/);
  assert.match(plan.source_inventory_sha256, /^[a-f0-9]{64}$/);
  assert.match(plan.review_snapshot_sha256, /^[a-f0-9]{64}$/);
  assert.ok(plan.adopted.includes('AGENTS.md'));
  assert.equal(fs.existsSync(path.join(project, '.agent-standards.json')), false);
  assert.deepEqual(snapshotTree(project), originalSnapshot, 'dry-run must not modify the old project');

  const missingId = run(project, standards, '--confirm-reviewed', '--json');
  assert.equal(missingId.status, 2);
  assert.match(missingId.stderr, /expect-plan-id/);
  expectStaleConfirmation(project, standards, '0000000000000000', 'wrong plan ID must not write a manifest');

  // The project changes after human review: old approval must become unusable.
  fs.appendFileSync(path.join(project, 'AGENTS.md'), '\n<!-- changed after review -->\n');
  expectStaleConfirmation(project, standards, plan.plan_id, 'project drift after review must invalidate baseline adoption');

  // A new preview is still invalidated when the target template checkout changes.
  const projectPreview = run(project, standards, '--dry-run', '--json');
  assert.equal(projectPreview.status, 0, projectPreview.stdout + projectPreview.stderr);
  const projectPlan = JSON.parse(projectPreview.stdout);
  fs.appendFileSync(path.join(standards, 'template/.spec/02-conventions.md'), '\n## Source changed after review\n');
  expectStaleConfirmation(project, standards, projectPlan.plan_id, 'template source drift after review must invalidate baseline adoption');

  // A fresh preview can be explicitly confirmed. Only the manifest may be added; all project
  // rules remain byte-identical to the post-review snapshot.
  const freshPreview = run(project, standards, '--dry-run', '--json');
  assert.equal(freshPreview.status, 0, freshPreview.stdout + freshPreview.stderr);
  const freshPlan = JSON.parse(freshPreview.stdout);
  const beforeConfirm = snapshotTree(project);
  const confirm = run(project, standards, '--expect-plan-id', freshPlan.plan_id, '--confirm-reviewed', '--json');
  assert.equal(confirm.status, 0, confirm.stdout + confirm.stderr);
  const recorded = JSON.parse(confirm.stdout);
  assert.equal(recorded.plan_id, freshPlan.plan_id);
  assert.equal(recorded.manifest_written, true);
  assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'));
  const manifestPath = path.join(project, '.agent-standards.json');
  assert.ok(fs.existsSync(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.baseline_adopted_after_review, true);
  assert.equal(manifest.managed_files['AGENTS.md'].customized_at_baseline, true);
  assert.equal(manifest.managed_files['AGENTS.md'].installed_sha256,
    require('node:crypto').createHash('sha256').update(customBefore + '\n<!-- changed after review -->\n').digest('hex'));
  const afterConfirm = snapshotTree(project).filter(item => item.path !== '.agent-standards.json');
  assert.deepEqual(afterConfirm, beforeConfirm, 'confirmation may update only .agent-standards.json');

  // Existing manifest edits are also part of the review snapshot and invalidate a stale plan.
  writeTemplateFile(project, standards, '.spec/00-constitution.md');
  const markerEditPreview = run(project, standards, '--dry-run', '--json');
  assert.equal(markerEditPreview.status, 0, markerEditPreview.stdout + markerEditPreview.stderr);
  const markerPlan = JSON.parse(markerEditPreview.stdout);
  const editedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  editedManifest.project_review_note = 'changed after dry-run';
  fs.writeFileSync(manifestPath, JSON.stringify(editedManifest, null, 2) + '\n');
  const manifestBeforeRejectedConfirm = fs.readFileSync(manifestPath);
  const manifestStale = run(project, standards, '--expect-plan-id', markerPlan.plan_id, '--confirm-reviewed', '--json');
  assert.equal(manifestStale.status, 2, manifestStale.stdout + manifestStale.stderr);
  assert.match(manifestStale.stderr, /发生变化/);
  assert.ok(fs.readFileSync(manifestPath).equals(manifestBeforeRejectedConfirm), 'stale approval must not overwrite a changed manifest');

  const finalPreview = run(project, standards, '--dry-run', '--json');
  assert.equal(finalPreview.status, 0, finalPreview.stdout + finalPreview.stderr);
  const finalPlan = JSON.parse(finalPreview.stdout);
  const finalConfirm = run(project, standards, '--expect-plan-id', finalPlan.plan_id, '--confirm-reviewed', '--json');
  assert.equal(finalConfirm.status, 0, finalConfirm.stdout + finalConfirm.stderr);
  const finalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(finalManifest.managed_files['.spec/00-constitution.md']);
  assert.equal(finalManifest.project_review_note, 'changed after dry-run');

  console.log('test-adopt-template-baseline: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
