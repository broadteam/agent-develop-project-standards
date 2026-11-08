#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildUpgradePlan } = require('../tools/plan-template-upgrade.cjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-template-upgrade-plan-'));
const init = project => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
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
  const presets = path.join(root, 'presets');
  if (fs.existsSync(presets)) fs.cpSync(presets, path.join(destination, 'presets'), { recursive: true });
}
function byPath(plan, file) {
  const item = plan.actions.find(action => action.path === file);
  assert.ok(item, 'expected an upgrade plan entry for ' + file + '\n' + JSON.stringify(plan.actions, null, 2));
  return item;
}
try {
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const installed = init(project);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);

  const cleanBefore = JSON.stringify(snapshotTree(project));
  const cleanPlan = buildUpgradePlan({ projectRoot: project, standardsRoot: root });
  assert.equal(cleanPlan.mode, 'read_only_preview');
  assert.equal(cleanPlan.can_apply_automatically, false);
  assert.equal(cleanPlan.human_review_required, false);
  assert.equal(cleanPlan.summary.no_change, cleanPlan.actions.length);
  assert.equal(cleanPlan.global_blockers.length, 0);
  assert.equal(JSON.stringify(snapshotTree(project)), cleanBefore, 'upgrade planning must not mutate the project');
  const cleanPlanAgain = buildUpgradePlan({ projectRoot: project, standardsRoot: root });
  assert.equal(cleanPlanAgain.plan_id, cleanPlan.plan_id, 'identical inputs must produce a stable plan ID');

  // Prepare a simulated rc.13 template checkout.
  const newerStandards = path.join(tmp, 'standards-rc13');
  cloneStandards(newerStandards);
  const versionFile = path.join(newerStandards, 'template/policy/standards-version.json');
  const version = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  version.version = '2.0.0-rc.14';
  fs.writeFileSync(versionFile, JSON.stringify(version, null, 2) + '\n');

  // Both sides changed: a three-way manual merge is mandatory.
  const conflictPath = '.spec/02-conventions.md';
  fs.appendFileSync(path.join(project, conflictPath), '\n## Project convention override\n');
  fs.appendFileSync(path.join(newerStandards, 'template', conflictPath), '\n## Upstream convention update\n');

  // Upstream-only change: safe replacement candidate, but still requires explicit approval.
  const updatePath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(newerStandards, 'template', updatePath), '\n## Upstream registry note\n');

  // Project-only change: keep project content; no template update action is necessary.
  const localPath = '.spec/01-architecture.md';
  fs.appendFileSync(path.join(project, localPath), '\n## Local architecture note\n');

  // Upstream removed a file while the project still has its untouched baseline copy.
  const removedPath = '.spec/03-delivery.md';
  fs.unlinkSync(path.join(newerStandards, 'template', removedPath));

  // Both sides removed a file: no deletion action is needed.
  const removedBothPath = '.spec/00-constitution.md';
  fs.unlinkSync(path.join(newerStandards, 'template', removedBothPath));
  fs.unlinkSync(path.join(project, removedBothPath));

  // A missing local file can only be restored after explicit review.
  const missingPath = 'ROUTER.md';
  fs.unlinkSync(path.join(project, missingPath));

  // New template file, no target collision.
  const newPath = '.spec/new-guidance.md';
  fs.writeFileSync(path.join(newerStandards, 'template', newPath), '# New upstream guidance\n');

  // New template file colliding with an untracked project-owned path.
  const collisionPath = '.spec/new-collision.md';
  fs.writeFileSync(path.join(newerStandards, 'template', collisionPath), '# New upstream collision\n');
  fs.writeFileSync(path.join(project, collisionPath), '# Existing project file\n');

  // Unselected stack presets are not project-wide upgrade candidates.
  // A Java project that actually installed its preset must see upstream changes to that preset.
  fs.appendFileSync(path.join(newerStandards, 'presets/stacks/java.md'), '\n## Upstream Java preset update\n');
  const javaProject = path.join(tmp, 'java-project');
  fs.mkdirSync(javaProject);
  fs.writeFileSync(path.join(javaProject, 'pom.xml'), '<project/>\n');
  const javaInstall = init(javaProject);
  assert.equal(javaInstall.status, 0, javaInstall.stdout + javaInstall.stderr);
  const javaManifest = JSON.parse(fs.readFileSync(path.join(javaProject, '.agent-standards.json'), 'utf8'));
  assert.ok(javaManifest.managed_files['.spec/stacks/java.md'], 'detected Java project must record the installed Java preset');
  const javaPlan = buildUpgradePlan({ projectRoot: javaProject, standardsRoot: newerStandards });
  assert.equal(byPath(javaPlan, '.spec/stacks/java.md').operation, 'replace_candidate');
  assert.equal(byPath(javaPlan, '.spec/stacks/java.md').status, 'update_available');

  const beforePlan = JSON.stringify(snapshotTree(project));
  const plan = buildUpgradePlan({ projectRoot: project, standardsRoot: newerStandards });
  assert.equal(plan.source_version, '2.0.0-rc.13');
  assert.equal(plan.target_version, '2.0.0-rc.14');
  assert.equal(plan.version_label_changed, true);
  assert.equal(plan.can_apply_automatically, false);
  assert.equal(plan.human_review_required, true);
  assert.equal(JSON.stringify(snapshotTree(project)), beforePlan, 'upgrade plan must not write, delete or change permissions');

  assert.equal(byPath(plan, conflictPath).operation, 'manual_merge');
  assert.equal(byPath(plan, conflictPath).approval, 'manual_merge');
  assert.equal(byPath(plan, updatePath).operation, 'replace_candidate');
  assert.equal(byPath(plan, updatePath).approval, 'approve_upstream');
  assert.equal(byPath(plan, localPath).recommendation, 'preserve_local_change');
  assert.equal(byPath(plan, localPath).requires_human_review, false);
  assert.equal(byPath(plan, removedPath).operation, 'review_removal');
  assert.equal(byPath(plan, removedBothPath).status, 'removed_both');
  assert.equal(byPath(plan, removedBothPath).operation, 'none');
  assert.equal(byPath(plan, missingPath).operation, 'restore_candidate');
  assert.equal(byPath(plan, newPath).operation, 'add_candidate');
  assert.equal(byPath(plan, collisionPath).operation, 'ownership_review');
  assert.ok(plan.actions.every(action => typeof action.source === 'string' || action.status === 'unsafe'));

  const planAgain = buildUpgradePlan({ projectRoot: project, standardsRoot: newerStandards });
  assert.equal(planAgain.plan_id, plan.plan_id, 'same project/template pair must produce the same plan ID');

  // The CLI exposes both human and JSON output, and does not write a plan file.
  const markerBeforeCli = JSON.stringify(snapshotTree(project));
  const cli = spawnSync(process.execPath, [
    path.join(root, 'tools/plan-template-upgrade.cjs'),
    '--root', project,
    '--standards-root', newerStandards,
    '--json'
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 1, cli.stdout + cli.stderr);
  const cliPlan = JSON.parse(cli.stdout);
  assert.equal(cliPlan.plan_id, plan.plan_id);
  assert.equal(cliPlan.can_apply_automatically, false);
  assert.equal(JSON.stringify(snapshotTree(project)), markerBeforeCli);

  // Missing and partial baselines block confident upgrade planning.
  const legacy = path.join(tmp, 'legacy');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'AGENTS.md'), '# Legacy custom rules\n');
  const missingBaselinePlan = buildUpgradePlan({ projectRoot: legacy, standardsRoot: root });
  assert.equal(missingBaselinePlan.baseline_missing, true);
  assert.ok(missingBaselinePlan.global_blockers.some(item => item.code === 'BASELINE_MISSING'));
  assert.equal(missingBaselinePlan.can_apply_automatically, false);

  const partialInstall = init(legacy);
  assert.equal(partialInstall.status, 0, partialInstall.stdout + partialInstall.stderr);
  const partialPlan = buildUpgradePlan({ projectRoot: legacy, standardsRoot: newerStandards });
  assert.equal(partialPlan.baseline_incomplete, true);
  assert.ok(partialPlan.global_blockers.some(item => item.code === 'BASELINE_INCOMPLETE'));
  assert.ok(partialPlan.actions.some(item => item.path === 'AGENTS.md' && item.operation === 'baseline_review'));

  console.log('test-template-upgrade-plan: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
