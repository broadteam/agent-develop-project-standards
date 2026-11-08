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
const BLOCK_START = '# >>> agent-project-standards (managed)';
const BLOCK_END = '# <<< agent-project-standards (managed)';
function readManagedBlock(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  assert.ok(start >= 0 && end > start, 'managed ignore block must be present');
  return text.slice(start, end + BLOCK_END.length);
}
function managedBlockHash(file) {
  return sha256(Buffer.from(readManagedBlock(file), 'utf8'));
}
function isManagedIgnoreAction(action) {
  return action.path === '.gitignore' && action.source === 'template/.gitignore.append';
}
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
function applyReviewedActions(project, standards, plan, deferPaths = new Set()) {
  const decisions = [];
  for (const action of plan.actions.filter(item => item.requires_human_review)) {
    const target = path.join(project, action.path);
    const source = action.source ? path.join(standards, action.source) : null;
    if (deferPaths.has(action.path)) {
      decisions.push({
        reviewer: 'baseline-record-maintainer',
        reviewed_at: '2026-11-08T16:00:00.000Z',
        path: action.path,
        decision: 'defer',
        reason: '本轮明确延期；文件和权限保持计划生成时的原状态。'
      });
      continue;
    }
    let decision = action.approval;
    if (isManagedIgnoreAction(action) && ['replace_candidate', 'add_candidate', 'restore_candidate'].includes(action.operation)) {
      const fullText = fs.readFileSync(target, 'utf8');
      const start = fullText.indexOf(BLOCK_START);
      const end = fullText.indexOf(BLOCK_END, start + BLOCK_START.length);
      assert.ok(start >= 0 && end > start, 'managed ignore block must be well-formed before replacement');
      const oldBlock = fullText.slice(start, end + BLOCK_END.length);
      const oldBody = oldBlock.slice(BLOCK_START.length + 1, oldBlock.length - BLOCK_END.length - 1);
      const sourceText = fs.readFileSync(source, 'utf8');
      const placeholder = '{{IGNORE_ENTRIES}}';
      const position = sourceText.indexOf(placeholder);
      assert.ok(position >= 0 && sourceText.indexOf(placeholder, position + placeholder.length) < 0);
      const suffix = sourceText.slice(position + placeholder.length).replace(/\s+$/, '');
      const newBlock = `${BLOCK_START}\n${oldBody}\n${suffix}\n${BLOCK_END}`;
      fs.writeFileSync(target, fullText.slice(0, start) + newBlock + fullText.slice(end + BLOCK_END.length));
    } else if (action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate') {
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
      row.result_sha256 = isManagedIgnoreAction(action) ? managedBlockHash(target) : sha256File(target);
      if (!isManagedIgnoreAction(action)) row.result_mode = fs.statSync(target).mode & 0o777;
    }
    decisions.push(row);
  }
  return { review_schema: 2, plan_id: plan.plan_id, decisions };
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

  // Change only the managed-block template suffix; retain project-owned rules outside the block.
  const ignoreSource = path.join(newer, 'template/.gitignore.append');
  const ignoreTemplate = fs.readFileSync(ignoreSource, 'utf8');
  assert.ok(ignoreTemplate.includes('{{IGNORE_ENTRIES}}'));
  fs.writeFileSync(ignoreSource, ignoreTemplate.replace(
    '{{IGNORE_ENTRIES}}\n',
    '{{IGNORE_ENTRIES}}\n# Reviewed managed-block footer\n'
  ));
  const projectIgnore = path.join(project, '.gitignore');
  fs.appendFileSync(projectIgnore, '\n# Project-owned ignore rules\nlocal-secrets/\n');

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
  assert.equal(byPath(plan, '.gitignore').operation, 'replace_candidate');
  assert.equal(plan.plan_schema, 2);
  assert.match(plan.source_inventory_sha256, /^[a-f0-9]{64}$/);

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
  assert.ok(preview.updated_paths.includes('.gitignore'));
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
  assert.equal(manifest.managed_blocks['.gitignore'].template_version, version.version);
  assert.ok(fs.readFileSync(projectIgnore, 'utf8').includes('# Project-owned ignore rules\\nlocal-secrets/'));

  const drift = analyzeDrift({ projectRoot: project, standardsRoot: newer });
  assert.equal(drift.ok, true, JSON.stringify(drift, null, 2));

  // A plan cannot be applied again after its source version has been committed to the manifest.
  assert.throws(
    () => buildRecord({ projectRoot: project, standardsRoot: newer, plan, review }),
    /source_version/
  );

  // Partial advancement: one explicitly deferred path keeps the overall version at the old release.
  const partialProject = path.join(tmp, 'partial-project');
  fs.mkdirSync(partialProject);
  const partialInstall = init(partialProject);
  assert.equal(partialInstall.status, 0, partialInstall.stdout + partialInstall.stderr);
  const partialPlan = buildUpgradePlan({ projectRoot: partialProject, standardsRoot: newer });
  assert.equal(byPath(partialPlan, addPath).operation, 'add_candidate');
  const deferredPaths = [addPath, updatePath].sort();
  const deferredExistingFileHash = sha256File(path.join(partialProject, updatePath));
  const partialReview = applyReviewedActions(partialProject, newer, partialPlan, new Set(deferredPaths));
  assert.ok(partialReview.decisions.some(item => item.path === addPath && item.decision === 'defer'));
  assert.ok(partialReview.decisions.some(item => item.path === updatePath && item.decision === 'defer'));
  const partialValidation = validateReview(partialPlan, partialReview);
  assert.equal(partialValidation.valid, true, partialValidation.errors.join('\n'));

  const partialPlanFile = path.join(tmp, 'partial-plan.json');
  const partialReviewFile = path.join(tmp, 'partial-review.json');
  writeJson(partialPlanFile, partialPlan);
  writeJson(partialReviewFile, partialReview);
  const partialRecord = spawnSync(process.execPath, [
    path.join(root, 'tools/record-reviewed-template-upgrade.cjs'),
    '--root', partialProject,
    '--standards-root', newer,
    '--plan', partialPlanFile,
    '--review', partialReviewFile,
    '--confirm-reviewed',
    '--json'
  ], { encoding: 'utf8' });
  assert.equal(partialRecord.status, 0, partialRecord.stdout + partialRecord.stderr);
  const partialOutput = JSON.parse(partialRecord.stdout);
  assert.deepEqual(partialOutput.deferred_paths, deferredPaths);
  assert.equal(partialOutput.installed_with_version, fromVersion);

  let partialManifest = readJson(path.join(partialProject, '.agent-standards.json'));
  assert.equal(partialManifest.installed_with_version, fromVersion, 'overall version must not advance while a path is deferred');
  assert.equal(partialManifest.last_upgrade.status, 'partial');
  assert.ok(partialManifest.last_upgrade.deferred_paths.includes(addPath));
  assert.ok(!partialManifest.managed_files[addPath], 'deferred addition must not enter the manifest');
  const partialDrift = analyzeDrift({ projectRoot: partialProject, standardsRoot: newer });
  assert.ok(partialDrift.findings.some(item => item.path === addPath && item.status === 'new_upstream_file'));
  assert.ok(partialDrift.findings.some(item => item.path === updatePath && item.status === 'update_available'));

  // Re-plan only the remaining change, apply it and complete the overall version transition.
  const followupPlan = buildUpgradePlan({ projectRoot: partialProject, standardsRoot: newer });
  assert.equal(followupPlan.source_version, fromVersion);
  assert.equal(followupPlan.target_version, version.version);
  assert.equal(byPath(followupPlan, addPath).operation, 'add_candidate');
  assert.equal(byPath(followupPlan, updatePath).operation, 'replace_candidate');
  const followupActions = [addPath, updatePath].map(filePath => byPath(followupPlan, filePath));
  const followupReview = {
    review_schema: 2,
    plan_id: followupPlan.plan_id,
    decisions: followupActions.map(action => {
      const target = path.join(partialProject, action.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(newer, action.source), target);
      return {
        reviewer: 'baseline-record-maintainer',
        reviewed_at: '2026-11-08T16:10:00.000Z',
        path: action.path,
        decision: action.approval,
        result_sha256: sha256File(target),
        result_mode: fs.statSync(target).mode & 0o777,
        reason: '延期路径已经单独审查并应用，现确认登记。'
      };
    })
  };
  assert.equal(validateReview(followupPlan, followupReview).valid, true);
  const followupFile = path.join(tmp, 'followup-review.json');
  const followupPlanFile = path.join(tmp, 'followup-plan.json');
  writeJson(followupFile, followupReview);
  writeJson(followupPlanFile, followupPlan);
  const followupRecord = spawnSync(process.execPath, [
    path.join(root, 'tools/record-reviewed-template-upgrade.cjs'),
    '--root', partialProject,
    '--standards-root', newer,
    '--plan', followupPlanFile,
    '--review', followupFile,
    '--confirm-reviewed',
    '--json'
  ], { encoding: 'utf8' });
  assert.equal(followupRecord.status, 0, followupRecord.stdout + followupRecord.stderr);
  partialManifest = readJson(path.join(partialProject, '.agent-standards.json'));
  assert.equal(partialManifest.installed_with_version, version.version);
  assert.equal(partialManifest.last_upgrade.status, 'complete');
  assert.deepEqual(partialManifest.last_upgrade.deferred_paths, []);
  assert.ok(partialManifest.managed_files[addPath]);
  assert.equal(partialManifest.managed_files[updatePath].template_version, version.version);
  const completedPartialDrift = analyzeDrift({ projectRoot: partialProject, standardsRoot: newer });
  assert.equal(completedPartialDrift.ok, true, JSON.stringify(completedPartialDrift, null, 2));

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
    review_schema: 2,
    plan_id: secondPlan.plan_id,
    decisions: secondPlan.actions.filter(action => action.requires_human_review).map(action => ({
      reviewer: 'maintainer',
      reviewed_at: '2026-11-08T16:05:00.000Z',
      path: action.path,
      decision: action.approval,
      ...(action.decision === 'approve_removal' ? {} : {
        result_sha256: sha256File(path.join(secondProject, action.path)),
        result_mode: fs.statSync(path.join(secondProject, action.path)).mode & 0o777
      }),
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

  // A target source added after plan creation invalidates the complete source inventory.
  const inventoryProject = path.join(tmp, 'inventory-stale-project');
  const inventoryTarget = path.join(tmp, 'inventory-stale-target');
  fs.mkdirSync(inventoryProject);
  assert.equal(init(inventoryProject).status, 0);
  cloneStandards(inventoryTarget);
  const inventoryVersionFile = path.join(inventoryTarget, 'template/policy/standards-version.json');
  const inventoryVersion = readJson(inventoryVersionFile);
  inventoryVersion.version = '2.0.0-inventory-stale-fixture';
  writeJson(inventoryVersionFile, inventoryVersion);
  const inventoryChangedPath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(inventoryTarget, 'template', inventoryChangedPath), '\n## Reviewed registry change\n');
  const inventoryPlan = buildUpgradePlan({ projectRoot: inventoryProject, standardsRoot: inventoryTarget });
  const inventoryReview = applyReviewedActions(inventoryProject, inventoryTarget, inventoryPlan);
  assert.equal(validateReview(inventoryPlan, inventoryReview).valid, true);
  const inventoryManifestBefore = fs.readFileSync(path.join(inventoryProject, '.agent-standards.json'));
  fs.appendFileSync(path.join(inventoryTarget, 'template/.spec/00-constitution.md'), '\n## Unplanned source change\n');
  assert.throws(
    () => buildRecord({ projectRoot: inventoryProject, standardsRoot: inventoryTarget, plan: inventoryPlan, review: inventoryReview }),
    /模板源快照已变化/
  );
  assert.equal(
    fs.readFileSync(path.join(inventoryProject, '.agent-standards.json')).equals(inventoryManifestBefore),
    true,
    'a source inventory mismatch must not advance the manifest'
  );

  // A reviewed file mode is evidence: a tampered result_mode must not advance the baseline.
  const modeProject = path.join(tmp, 'mode-mismatch-project');
  const modeTarget = path.join(tmp, 'mode-mismatch-target');
  fs.mkdirSync(modeProject);
  assert.equal(init(modeProject).status, 0);
  cloneStandards(modeTarget);
  const modeVersionFile = path.join(modeTarget, 'template/policy/standards-version.json');
  const modeVersion = readJson(modeVersionFile);
  modeVersion.version = '2.0.0-mode-fixture';
  writeJson(modeVersionFile, modeVersion);
  const modeChangedPath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(modeTarget, 'template', modeChangedPath), '\n## Mode fixture change\n');
  const modePlan = buildUpgradePlan({ projectRoot: modeProject, standardsRoot: modeTarget });
  const modeReview = applyReviewedActions(modeProject, modeTarget, modePlan);
  const modeDecision = modeReview.decisions.find(item => item.path === modeChangedPath);
  assert.ok(modeDecision);
  modeDecision.result_mode = modeDecision.result_mode === 0o644 ? 0o600 : 0o644;
  assert.equal(validateReview(modePlan, modeReview).valid, true, 'a different but well-formed mode remains structurally valid for content-stage verification');
  const modeManifestBefore = fs.readFileSync(path.join(modeProject, '.agent-standards.json'));
  assert.throws(
    () => buildRecord({ projectRoot: modeProject, standardsRoot: modeTarget, plan: modePlan, review: modeReview }),
    /result_mode 不匹配/
  );
  assert.equal(fs.readFileSync(path.join(modeProject, '.agent-standards.json')).equals(modeManifestBefore), true);

  console.log('test-template-upgrade-record: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
