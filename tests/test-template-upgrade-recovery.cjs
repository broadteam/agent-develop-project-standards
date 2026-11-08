#!/usr/bin/env node
'use strict';

// End-to-end recovery drill using disposable projects only.
// It simulates a human-approved file replacement, a failed governance check,
// restoring a full pre-upgrade backup, and re-validating the restored state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildUpgradePlan } = require('../tools/plan-template-upgrade.cjs');
const { validateReview } = require('../tools/validate-template-upgrade-review.cjs');
const { analyzeDrift } = require('../tools/check-template-drift.cjs');
const crypto = require('node:crypto');
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-template-upgrade-recovery-'));
const init = project => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
const governance = project => spawnSync(
  process.execPath,
  [path.join(project, 'scripts/check-governance.cjs')],
  { cwd: project, encoding: 'utf8' }
);

function snapshotTree(dir, rel = '') {
  const result = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const child = path.posix.join(rel.split(path.sep).join('/'), name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      result.push({ path: child, type: 'symlink', target: fs.readlinkSync(absolute), mode: stat.mode & 0o777 });
    } else if (stat.isDirectory()) {
      result.push({ path: child, type: 'directory', mode: stat.mode & 0o777 });
      result.push(...snapshotTree(absolute, child));
    } else {
      result.push({
        path: child,
        type: 'file',
        content: fs.readFileSync(absolute).toString('base64'),
        mode: stat.mode & 0o777
      });
    }
  }
  return result;
}
function copyEntry(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    fs.symlinkSync(fs.readlinkSync(source), destination, stat.isDirectory() ? 'dir' : 'file');
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(destination);
    for (const name of fs.readdirSync(source)) copyEntry(path.join(source, name), path.join(destination, name));
    try { fs.chmodSync(destination, stat.mode & 0o777); } catch {}
    return;
  }
  fs.copyFileSync(source, destination);
  try { fs.chmodSync(destination, stat.mode & 0o777); } catch {}
}
function copyDirectoryContents(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of fs.readdirSync(source)) copyEntry(path.join(source, name), path.join(destination, name));
}
function clearDirectory(dir) {
  for (const name of fs.readdirSync(dir)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
}
function cloneStandards(destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(root, 'template'), path.join(destination, 'template'), { recursive: true });
  const presets = path.join(root, 'presets');
  if (fs.existsSync(presets)) fs.cpSync(presets, path.join(destination, 'presets'), { recursive: true });
}
function findAction(plan, target) {
  const action = plan.actions.find(item => item.path === target);
  assert.ok(action, 'upgrade plan should include ' + target);
  return action;
}

try {
  const project = path.join(tmp, 'project');
  const backup = path.join(tmp, 'backup-before-upgrade');
  const newerStandards = path.join(tmp, 'standards-next');
  fs.mkdirSync(project);

  const installed = init(project);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const initialGovernance = governance(project);
  assert.equal(initialGovernance.status, 0, initialGovernance.stdout + initialGovernance.stderr);
  const initialSnapshot = snapshotTree(project);

  // Build a target release with one deliberately small upstream-only change.
  cloneStandards(newerStandards);
  const versionPath = path.join(newerStandards, 'template/policy/standards-version.json');
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  const installedVersion = version.version;
  version.version = '2.0.0-recovery-fixture';
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');
  const approvedPath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(newerStandards, 'template', approvedPath), '\n## Approved fixture update\n');

  const planBefore = buildUpgradePlan({ projectRoot: project, standardsRoot: newerStandards });
  assert.equal(planBefore.plan_schema, 2);
  assert.match(planBefore.source_inventory_sha256, /^[a-f0-9]{64}$/);
  assert.equal(planBefore.source_version, installedVersion);
  assert.equal(planBefore.target_version, '2.0.0-recovery-fixture');
  const approvedAction = findAction(planBefore, approvedPath);
  assert.equal(approvedAction.operation, 'replace_candidate');
  assert.equal(approvedAction.approval, 'approve_upstream');

  const requiredActions = planBefore.actions.filter(action => action.requires_human_review);
  const replacementActions = requiredActions.filter(action => action.operation === 'replace_candidate');
  assert.deepEqual(
    replacementActions.map(action => action.path).sort(),
    [approvedPath, 'policy/standards-version.json'].sort(),
    'the small batch must include the approved rule file and its installed version metadata'
  );
  assert.ok(requiredActions.length >= replacementActions.length);
  const review = {
    review_schema: 2,
    plan_id: planBefore.plan_id,
    decisions: requiredActions.map(action => ({
      reviewer: 'recovery-fixture-maintainer',
      reviewed_at: '2026-11-08T15:30:00.000Z',
      path: action.path,
      decision: action.approval,
      result_sha256: action.approval === 'approve_removal'
        ? undefined
        : action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate'
          ? sha256File(path.join(newerStandards, action.source))
          : fs.existsSync(path.join(project, action.path)) ? sha256File(path.join(project, action.path)) : undefined,
      result_mode: action.approval === 'approve_removal'
        ? undefined
        : action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate'
          ? fs.statSync(path.join(newerStandards, action.source)).mode & 0o777
          : fs.existsSync(path.join(project, action.path)) ? fs.statSync(path.join(project, action.path)).mode & 0o777 : undefined,
      reason: action.path === approvedPath
        ? '该通用登记说明仅有上游更新，已检查目标文件差异，批准在临时项目中演练。'
        : '该计划项已检查并按计划要求记录决策；本次恢复演练只实际执行登记说明文件的替换。',
      ...(action.operation === 'manual_merge'
        ? { baseline_ref: 'fixture:pre-upgrade-backup', merge_result_ref: 'fixture:reviewed-merge-not-applied' }
        : {})
    }))
  };
  const approval = validateReview(planBefore, review);
  assert.equal(approval.valid, true, approval.errors.join('\n'));
  assert.equal(approval.can_apply_automatically, false);

  // Preserve a complete backup outside the project tree before manual execution.
  copyDirectoryContents(project, backup);
  const backupSnapshot = snapshotTree(backup);
  assert.deepEqual(backupSnapshot, initialSnapshot, 'backup must be an exact tree snapshot before changes');

  // Simulate a maintainer manually applying the complete, reviewed replacement batch.
  for (const action of replacementActions) {
    const sourceFile = path.join(newerStandards, action.source);
    const targetFile = path.join(project, action.path);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(sourceFile, targetFile);
    assert.notEqual(
      fs.readFileSync(targetFile, 'utf8'),
      fs.readFileSync(path.join(backup, action.path), 'utf8'),
      action.path + ' must reflect the reviewed upstream replacement'
    );
  }

  // Inject a deterministic governance failure after the partial upgrade.
  const injectedFailurePath = path.join(project, 'unreviewed-root-entry');
  fs.mkdirSync(injectedFailurePath);
  const failedValidation = governance(project);
  assert.notEqual(failedValidation.status, 0, 'governance must fail after the unapproved root directory is injected');

  // Stop the upgrade batch, restore the whole pre-upgrade tree, then verify byte-for-byte recovery.
  clearDirectory(project);
  copyDirectoryContents(backup, project);
  assert.deepEqual(snapshotTree(project), initialSnapshot, 'rollback must restore every original file, directory, link and mode');

  const recoveredGovernance = governance(project);
  assert.equal(recoveredGovernance.status, 0, recoveredGovernance.stdout + recoveredGovernance.stderr);

  // The original release remains clean; the attempted target upgrade is still available.
  const recoveredDrift = analyzeDrift({ projectRoot: project, standardsRoot: root });
  assert.equal(recoveredDrift.ok, true, JSON.stringify(recoveredDrift, null, 2));
  const planAfterRollback = buildUpgradePlan({ projectRoot: project, standardsRoot: newerStandards });
  assert.equal(planAfterRollback.plan_id, planBefore.plan_id, 'restored tree must reproduce the exact same upgrade plan');
  assert.equal(findAction(planAfterRollback, approvedPath).status, 'update_available');
  assert.equal(findAction(planAfterRollback, approvedPath).operation, 'replace_candidate');
  assert.equal(fs.existsSync(injectedFailurePath), false, 'failed-attempt artifacts must be removed during restore');

  console.log('test-template-upgrade-recovery: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
