#!/usr/bin/env node
'use strict';

// End-to-end baseline advancement for an already-applied, human-reviewed upgrade.
// All project data lives in a disposable OS temp directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { buildUpgradePlan } = require('../tools/plan-template-upgrade.cjs');
const { validateReview } = require('../tools/validate-template-upgrade-review.cjs');
const { analyzeDrift } = require('../tools/check-template-drift.cjs');
const { buildRecord } = require('../tools/record-reviewed-template-upgrade.cjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-template-upgrade-record-'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = file => sha256(fs.readFileSync(file));
const init = project => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });

function cloneStandards(destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(root, 'template'), path.join(destination, 'template'), { recursive: true });
  const presets = path.join(root, 'presets');
  if (fs.existsSync(presets)) fs.cpSync(presets, path.join(destination, 'presets'), { recursive: true });
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function snapshotTree(dir, rel = '') {
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const child = path.posix.join(rel.split(path.sep).join('/'), name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) result.push([child, 'symlink', fs.readlinkSync(absolute)]);
    else if (stat.isDirectory()) result.push([child, 'dir', ...snapshotTree(absolute, child)]);
    else result.push([child, 'file', fs.readFileSync(absolute).toString('base64'), stat.mode & 0o777]);
  }
  return result;
}
function byPath(plan, file) {
  const action = plan.actions.find(item => item.path === file);
  assert.ok(action, 'missing action for ' + file + '\n' + JSON.stringify(plan.actions, null, 2));
  return action;
}
function applyReviewedActions(project, standards, plan) {
  const decisions = [];
  for (const action of plan.actions.filter(item => item.requires_human_review)) {
    const target = path.join(project, action.path);
    const source = action.source ? path.join(standards, action.source) : null;
    let decision = action.approval;
    if (action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    } else if (action.operation === 'manual_merge') {
      const merged = fs.readFileSync(target, 'utf8') + '\n## Reviewed merged resolution\n';
      fs.writeFileSync(target, merged);
    } else if (action.operation === 'review_removal') {
      assert.equal(decision, 'approve_removal');
      fs.rmSync(target, { force: true });
    } else if (action.operation === 'ownership_review') {
      decision = 'classify_existing_file';
    } else if (action.status === 'local_customized') {
      decision = 'keep_project';
    }

    const row = {
      reviewer: 'baseline-record-maintainer',
      reviewed_at: '2026-11-08T16:00:00.000Z',
      path: action.path,
      decision,
      reason: '已检查文件差异和项目影响，确认本次处理结果。'
    };
    if (decision !== 'approve_removal') {
      if (action.operation === 'manual_merge') {
        row.baseline_ref = 'git:before-upgrade';
        row.merge_result_ref = 'git:reviewed-manual-merge';
      }
      if (action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate') {
        row.result_sha256 = sha256File(target);
      } else if (action.operation === 'local_customized' || action.status === 'local_customized'
        || action.operation === 'manual_merge' || action.operation === 'ownership_review'
        || (action.operation === 'review_removal' && decision === 'keep_or_archive')) {
        row.result_sha256 = sha256File(target);
      } else {
        row.result_sha256 = sha256File(target);
      }
    }
    decisions.push(row);
  }
  return { review_schema: 1, plan_id: plan.plan_id, decisions };
}

try {
  const project = path.join(tmp, 'project');
  const newer = path.join(tmp, 'standards-target');
  fs.mkdirSync(project);
  const installed = init(project);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);

  // Create one target release with all important baseline outcomes.
  cloneStandards(newer);
  const versionPath = path.join(newer, 'template/policy/standards-version.json');
  const version = readJson(versionPath);
  const fromVersion = version.version;
  version.version = '2.0.0-baseline-record-fixture';
  writeJson(versionPath, version);

  const localPath = '.spec/01-architecture.md';
  fs.appendFileSync(path.join(project, localPath), '\n## Local project-only customization\n');

  const conflictPath = '.spec/02-conventions.md';
  fs.appendFileSync(path.join(project, conflictPath), '\n## Existing project-side change\n');
  fs.appendFileSync(path.join(newer, 'template', conflictPath), '\n## New upstream-side change\n');

  const updatePath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(newer, 'template', updatePath), '\n## New upstream-only guidance\n');

  const removePath = '.spec/03-delivery.md';
  fs.unlinkSync(path.join(newer, 'template', removePath));

  const addPath = '.spec/new-baseline-rule.md';
  fs.writeFileSync(path.join(newer, 'template', addPath), '# New baseline rule\n');

  const plan = buildUpgradePlan({ projectRoot: project, standardsRoot: newer });
  assert.equal(plan.source_version, fromVersion);
  assert.equal(plan.target_version, version.version);
  assert.equal(byPath(plan, localPath).approval, 'keep_project');
  assert.equal(byPath(plan, conflictPath).operation, 'manual_merge');
  assert.equal(byPath(plan, updatePath).operation, 'replace_candidate');
  assert.equal(byPath(plan, removePath).operation, 'review_removal');
  assert.equal(byPath(plan, addPath).operation, 'add_candidate');
  assert.equal(byPath(plan, 'policy/standards-version.json').operation, 'replace_candidate');

  // Apply the human-reviewed file changes, then write a result-hash-bound review record.
  const review = applyReviewedActions(project, newer, plan);
  const validation = validateReview(plan, review);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const reviewFile = path.join(tmp, 'review.json');
  const planFile = path.join(tmp, 'plan.json');
  writeJson(planFile, plan);
  writeJson(reviewFile, review);
  const markerPath = path.join(project, '.agent-standards.json');
  const beforeRecord = fs.readFileSync(markerPath);
  const beforeSnapshot = JSON.stringify(snapshotTree(project));

  // Dry run verifies every result but never modifies the manifest.
  const preview = buildRecord({ projectRoot: project, standardsRoot: newer, plan, review });
  assert.equal(preview.from_version, fromVersion);
  assert.equal(preview.to_version, version.version);
  assert.ok(preview.updated_paths.includes(updatePath));
  assert.ok(preview.updated_paths.includes(localPath));
  assert.ok(preview.updated_paths.includes(conflictPath));
  assert.ok(preview.updated_paths.includes(addPath));
  assert.ok(preview.removed_paths.includes(removePath));
  assert.equal(fs.readFileSync(markerPath).equals(beforeRecord), true);
  assert.equal(JSON.stringify(snapshotTree(project)), beforeSnapshot, 'buildRecord preview must be read-only');

  // CLI dry-run is also read-only.
  const cliPreview = spawnSync(process.execPath, [
    path.join(root, 'tools/record-reviewed-template-upgrade.cjs'),
    '--root', project,
    '--standards-root', newer,
    '--plan', planFile,
    '--review', reviewFile,
    '--dry-run',
    '--json'
  ], { encoding: 'utf8' });
  assert.equal(cliPreview.status, 0, cliPreview.stdout + cliPreview.stderr);
  assert.equal(JSON.parse(cliPreview.stdout).manifest_written, false);
  assert.equal(fs.readFileSync(markerPath).equals(beforeRecord), true);

  // Explicit confirmation atomically advances the baseline metadata only.
  const cliRecord = spawnSync(process.execPath, [
    path.join(root, 'tools/record-reviewed-template-upgrade.cjs'),
    '--root', project,
    '--standards-root', newer,
    '--plan', planFile,
    '--review', reviewFile,
    '--confirm-reviewed',
    '--json'
  ], { encoding: 'utf8' });
  assert.equal(cliRecord.status, 0, cliRecord.stdout + cliRecord.stderr);
  const cliOutput = JSON.parse(cliRecord.stdout);
  assert.equal(cliOutput.manifest_written, true);
  assert.equal(cliOutput.to_version, version.version);

  const manifest = readJson(markerPath);
  assert.equal(manifest.installed_with_version, version.version);
  assert.equal(manifest.baseline_state, 'complete');
  assert.equal(manifest.last_upgrade.plan_id, plan.plan_id);
  assert.equal(manifest.last_upgrade.from_version, fromVersion);
  assert.equal(manifest.last_upgrade.to_version, version.version);
  assert.ok(manifest.last_upgrade.updated_paths.includes(localPath));
  assert.ok(manifest.last_upgrade.updated_paths.includes(conflictPath));
  assert.ok(!manifest.managed_files[removePath], 'approved upstream deletion must remove the tracking entry');
  assert.ok(manifest.managed_files[addPath], 'approved new template file must enter the baseline');
  assert.equal(manifest.managed_files[localPath].customized_at_baseline, true);
  assert.equal(manifest.managed_files[conflictPath].customized_at_baseline, true);
  assert.equal(manifest.managed_files[localPath].installed_sha256, sha256File(path.join(project, localPath)));
  assert.equal(manifest.managed_files[conflictPath].installed_sha256, sha256File(path.join(project, conflictPath)));
  assert.ok(Object.values(manifest.managed_files).every(entry => entry.template_version === version.version));
  assert.ok(Object.values(manifest.managed_blocks).every(entry => entry.template_version === version.version));

  const drift = analyzeDrift({ projectRoot: project, standardsRoot: newer });
  assert.equal(drift.ok, true, JSON.stringify(drift, null, 2));

  // A plan cannot be applied again after its source version has been committed to the manifest.
  assert.throws(
    () => buildRecord({ projectRoot: project, standardsRoot: newer, plan, review }),
    /source_version/
  );

  // Failure path: an approved output hash that no longer matches the project must not advance the manifest.
  const secondProject = path.join(tmp, 'tampered-project');
  fs.mkdirSync(secondProject);
  const secondInstall = init(secondProject);
  assert.equal(secondInstall.status, 0, secondInstall.stdout + secondInstall.stderr);
  const secondTarget = path.join(tmp, 'second-target');
  cloneStandards(secondTarget);
  const secondVersionFile = path.join(secondTarget, 'template/policy/standards-version.json');
  const secondVersion = readJson(secondVersionFile);
  secondVersion.version = '2.0.0-tamper-fixture';
  writeJson(secondVersionFile, secondVersion);
  const secondPath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(secondTarget, 'template', secondPath), '\n## approved source\n');
  const secondPlan = buildUpgradePlan({ projectRoot: secondProject, standardsRoot: secondTarget });
  const secondAction = byPath(secondPlan, secondPath);
  const secondReplaceActions = secondPlan.actions.filter(action => action.operation === 'replace_candidate');
  for (const action of secondReplaceActions) {
    fs.copyFileSync(path.join(secondTarget, action.source), path.join(secondProject, action.path));
  }
  const secondReview = {
    review_schema: 1,
    plan_id: secondPlan.plan_id,
    decisions: secondPlan.actions.filter(action => action.requires_human_review).map(action => ({
      reviewer: 'maintainer',
      reviewed_at: '2026-11-08T16:05:00.000Z',
      path: action.path,
      decision: action.approval,
      ...(action.decision === 'approve_removal' ? {} : { result_sha256: sha256File(path.join(secondProject, action.path)) }),
      reason: '已审查'
    }))
  };
  const secondReviewFile = path.join(tmp, 'second-review.json');
  const secondPlanFile = path.join(tmp, 'second-plan.json');
  writeJson(secondReviewFile, secondReview);
  writeJson(secondPlanFile, secondPlan);
  fs.appendFileSync(path.join(secondProject, secondPath), '\nlate unauthorized edit\n');
  const secondManifestBefore = fs.readFileSync(path.join(secondProject, '.agent-standards.json'));
  assert.throws(
    () => buildRecord({ projectRoot: secondProject, standardsRoot: secondTarget, plan: secondPlan, review: secondReview }),
    /result_sha256 不匹配/
  );
  assert.equal(fs.readFileSync(path.join(secondProject, '.agent-standards.json')).equals(secondManifestBefore), true);

  console.log('test-template-upgrade-record: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
