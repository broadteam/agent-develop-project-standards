#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildUpgradePlan } = require('../tools/plan-template-upgrade.cjs');
const { validateReview } = require('../tools/validate-template-upgrade-review.cjs');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-template-upgrade-review-'));
const init = project => spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
function cloneStandards(destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(root, 'template'), path.join(destination, 'template'), { recursive: true });
  const presets = path.join(root, 'presets');
  if (fs.existsSync(presets)) fs.cpSync(presets, path.join(destination, 'presets'), { recursive: true });
}
function buildFixture() {
  const project = path.join(tmp, 'project');
  fs.mkdirSync(project);
  const installed = init(project);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const newer = path.join(tmp, 'newer-standards');
  cloneStandards(newer);
  const versionPath = path.join(newer, 'template/policy/standards-version.json');
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  version.version = '2.0.0-rc.14';
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');

  const conflictPath = '.spec/02-conventions.md';
  fs.appendFileSync(path.join(project, conflictPath), '\n## Local change\n');
  fs.appendFileSync(path.join(newer, 'template', conflictPath), '\n## Upstream change\n');
  const updatePath = '.spec/REGISTRY.md';
  fs.appendFileSync(path.join(newer, 'template', updatePath), '\n## Upstream-only change\n');
  const newPath = '.spec/new-review-rule.md';
  fs.writeFileSync(path.join(newer, 'template', newPath), '# New rule\n');
  const plan = buildUpgradePlan({ projectRoot: project, standardsRoot: newer });
  return { project, newer, plan, conflictPath };
}
try {
  const { project, newer, plan, conflictPath } = buildFixture();
  const required = plan.actions.filter(action => action.requires_human_review);
  assert.ok(required.length >= 3);
  const review = {
    review_schema: 1,
    plan_id: plan.plan_id,
    decisions: required.map(action => ({
      reviewer: 'standards-maintainer',
      reviewed_at: '2026-11-08T15:00:00.000Z',
      path: action.path,
      decision: action.approval,
      reason: '已对照项目影响和模板变更完成审查。',
      ...(action.operation === 'manual_merge'
        ? { baseline_ref: 'project-git:pre-upgrade-commit', merge_result_ref: 'project-git:reviewed-merge-commit' }
        : {})
    }))
  };
  const valid = validateReview(plan, review);
  assert.equal(valid.valid, true, valid.errors.join('\n'));
  assert.equal(valid.can_apply_automatically, false);
  assert.equal(valid.required_decisions, required.length);

  const incomplete = { ...review, decisions: review.decisions.slice(1) };
  const incompleteResult = validateReview(plan, incomplete);
  assert.equal(incompleteResult.valid, false);
  assert.ok(incompleteResult.missing_paths.length > 0);

  const wrongPlan = { ...review, plan_id: '0000000000000000' };
  assert.throws(() => validateReview(plan, wrongPlan), /plan_id/);

  const wrongDecision = {
    ...review,
    decisions: review.decisions.map((item, index) => index === 0 ? { ...item, decision: 'keep_project' } : item)
  };
  assert.equal(validateReview(plan, wrongDecision).valid, false);

  const missingReviewer = {
    ...review,
    decisions: review.decisions.map(item => item.path === conflictPath ? { ...item, reviewer: '' } : item)
  };
  assert.equal(validateReview(plan, missingReviewer).valid, false);

  const missingBase = {
    ...review,
    decisions: review.decisions.map(item => item.path === conflictPath
      ? { ...item, baseline_ref: '', merge_result_ref: '' }
      : item)
  };
  const missingBaseResult = validateReview(plan, missingBase);
  assert.equal(missingBaseResult.valid, false);
  assert.ok(missingBaseResult.errors.some(error => error.includes('baseline_ref')));
  assert.ok(missingBaseResult.errors.some(error => error.includes('merge_result_ref')));

  const duplicateDecision = { ...review, decisions: [...review.decisions, review.decisions[0]] };
  assert.equal(validateReview(plan, duplicateDecision).valid, false);

  const tamperedPlan = { ...plan, target_version: '2.0.0-rc.99' };
  assert.throws(() => validateReview(tamperedPlan, review), /plan_id/);

  // CLI validation is read-only and returns success only for a complete review.
  const planFile = path.join(tmp, 'upgrade-plan.json');
  const reviewFile = path.join(tmp, 'upgrade-review.json');
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
  fs.writeFileSync(reviewFile, JSON.stringify(review, null, 2));
  const before = fs.readdirSync(project).sort().join('|');
  const cli = spawnSync(process.execPath, [
    path.join(root, 'tools/validate-template-upgrade-review.cjs'),
    '--plan', planFile, '--review', reviewFile, '--json'
  ], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  const cliResult = JSON.parse(cli.stdout);
  assert.equal(cliResult.valid, true);
  assert.equal(cliResult.plan_id, plan.plan_id);
  assert.equal(fs.readdirSync(project).sort().join('|'), before, 'review validation must not modify the project');

  // Baseline blockers cannot be bypassed by supplying an otherwise empty review.
  const legacy = path.join(tmp, 'legacy');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'AGENTS.md'), '# Existing project rules\n');
  const partialInstall = init(legacy);
  assert.equal(partialInstall.status, 0, partialInstall.stdout + partialInstall.stderr);
  const blockedPlan = buildUpgradePlan({ projectRoot: legacy, standardsRoot: newer });
  const blockedReview = { review_schema: 1, plan_id: blockedPlan.plan_id, decisions: [] };
  assert.equal(validateReview(blockedPlan, blockedReview).valid, false);

  console.log('test-template-upgrade-review: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
