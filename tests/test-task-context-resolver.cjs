#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseProfile } = require('../template/.standards/profile-validator.cjs');
const { resolveTaskContext, normalizeTask } = require('../template/.standards/task-context-resolver.cjs');

const repoRoot = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'template/policy/capabilities.json'), 'utf8'));
const profileText = fs.readFileSync(path.join(repoRoot, 'template/project-profile.toml'), 'utf8')
  .replace('status = "needs_review"', 'status = "confirmed"')
  .replace('type = "unknown"', 'type = "saas"')
  .replace('scale = "unknown"', 'scale = "medium"')
  .replace('risk = "unknown"', 'risk = "high"')
  .replace('architecture = "unknown"', 'architecture = "modular_monolith"')
  .replace('detected = ["generic"]', 'detected = ["php", "java"]')
  .replace('primary = "{{LANGUAGE}}"', 'primary = "php"')
  .replace('framework = "{{FRAMEWORK}}"', 'framework = "thinkphp"')
  .replace('package_manager = "{{PACKAGE_MANAGER}}"', 'package_manager = "composer"');
const profile = parseProfile(profileText);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-context-'));
try {
  const root = path.join(tmp, 'project');
  const files = [
    'AGENTS.md', '.memory/MEMORY.md', '.memory/PITFALLS.md', 'project-profile.toml',
    '.spec/intent/BASELINE.md', '.spec/intent/CHANGES.md',
    'policy/capabilities.json', '.spec/00-constitution.md', '.spec/01-architecture.md',
    '.spec/02-conventions.md', '.spec/03-delivery.md', '.spec/REGISTRY.md',
    '.spec/tasks/index.md', '.spec/tasks/T12/card.md', '.spec/tasks/T12/log.md',
    '.spec/roadmap/INDEX.md', '.spec/roadmap/M1/milestone.md', '.spec/adr/README.md',
    '.spec/stacks/php.md', '.spec/stacks/java.md'
  ];
  for (const rel of files) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# fixture ' + rel + '\n');
  }
  fs.writeFileSync(path.join(root, 'project-profile.toml'), profileText);
  fs.writeFileSync(path.join(root, 'policy/capabilities.json'), JSON.stringify(registry));

  const small = resolveTaskContext({
    kind: 'code_change', risk: 'low', impact: 'local', uncertainty: 'low', stacks: ['php']
  }, { root, profile, registry });
  const smallRequired = small.requiredRead.map((x) => x.path);
  assert.ok(small.alwaysRead.some((x) => x.path === 'AGENTS.md'));
  assert.ok(small.alwaysRead.some((x) => x.path === '.memory/MEMORY.md' && x.section === '§0'));
  assert.ok(!small.alwaysRead.some((x) => x.path === 'project-profile.toml'), 'project profile is not part of every session baseline');
  assert.ok(small.optionalRead.some((x) => x.path === 'project-profile.toml'), 'profile details are available on demand');
  assert.ok(smallRequired.includes('.spec/02-conventions.md'));
  assert.ok(smallRequired.includes('.spec/stacks/php.md'));
  assert.ok(!smallRequired.includes('.spec/tasks/index.md'));
  assert.ok(!smallRequired.includes('.spec/adr/README.md'));
  assert.ok(!smallRequired.includes('.spec/00-constitution.md'));
  assert.equal(small.capabilityDecisions.task_tracking.effective, 'off');

  const complex = resolveTaskContext({
    kind: 'database_change', risk: 'high', impact: 'data', uncertainty: 'high',
    cross_session: true, stacks: ['java'], task_id: 'T12', milestone_id: 'M1'
  }, { root, profile, registry });
  const complexRequired = complex.requiredRead.map((x) => x.path);
  assert.ok(complexRequired.includes('.spec/00-constitution.md'));
  assert.ok(complexRequired.includes('.spec/01-architecture.md'));
  assert.ok(complexRequired.includes('.spec/adr/README.md'));
  assert.ok(complexRequired.includes('.spec/intent/BASELINE.md'));
  assert.ok(complexRequired.includes('.spec/intent/CHANGES.md'));
  assert.ok(complexRequired.includes('.spec/tasks/index.md'));
  assert.ok(complexRequired.includes('.spec/tasks/T12/card.md'));
  assert.ok(complexRequired.includes('.spec/roadmap/INDEX.md'));
  assert.ok(complexRequired.includes('.spec/roadmap/M1/milestone.md'));
  assert.ok(complexRequired.includes('.spec/stacks/java.md'));
  assert.ok(complexRequired.includes('.spec/03-delivery.md'));
  assert.ok(complex.optionalRead.some((x) => x.path === '.spec/tasks/T12/log.md'));
  assert.equal(complex.capabilityDecisions.task_tracking.effective, 'on');
  assert.equal(complex.capabilityDecisions.adr.effective, 'on');
  assert.equal(complex.capabilityDecisions.roadmap.effective, 'on');
  assert.equal(complex.verificationCommands.test, undefined, 'empty verification commands must not be invented');

  const overriddenProfile = parseProfile(profileText);
  overriddenProfile.capabilities.task_tracking = 'off';
  overriddenProfile.capabilities.adr = 'off';
  const overridden = resolveTaskContext({
    kind: 'architecture_change', risk: 'high', impact: 'cross_module',
    uncertainty: 'high', cross_session: true
  }, { root, profile: overriddenProfile, registry });
  const overriddenPaths = overridden.requiredRead.map((x) => x.path);
  assert.ok(overriddenPaths.includes('.spec/intent/BASELINE.md'), 'cross-session intent context remains required when task_tracking is off');
  assert.ok(overriddenPaths.includes('.spec/intent/CHANGES.md'), 'accepted intent changes remain visible when task_tracking is off');
  assert.ok(!overriddenPaths.includes('.spec/tasks/index.md'));
  assert.ok(!overriddenPaths.includes('.spec/adr/README.md'));
  assert.ok(overridden.warnings.some((x) => x.includes('task_tracking')));
  assert.ok(overridden.warnings.some((x) => x.includes('adr')));

  const noBoundariesProfile = parseProfile(profileText);
  noBoundariesProfile.capabilities.module_boundaries = 'off';
  const boundariesOff = resolveTaskContext({
    kind: 'module_change', risk: 'high', impact: 'cross_module', uncertainty: 'high'
  }, { root, profile: noBoundariesProfile, registry });
  assert.ok(boundariesOff.nextActions.some((x) => x.includes('已关闭 module_boundaries')));
  assert.ok(!boundariesOff.nextActions.some((x) => x.includes('检查涉及模块的允许依赖方向')));

  const milestoneOnly = resolveTaskContext({
    kind: 'code_change', risk: 'low', impact: 'local', uncertainty: 'low', milestone_id: 'M1'
  }, { root, profile, registry });
  const milestonePaths = milestoneOnly.requiredRead.map((x) => x.path);
  assert.ok(milestonePaths.includes('.spec/tasks/index.md'), 'milestone planning must also activate auto task tracking');
  assert.ok(milestonePaths.includes('.spec/roadmap/INDEX.md'));
  assert.equal(milestoneOnly.capabilityDecisions.task_tracking.effective, 'on');

  const noTaskTrackingProfile = parseProfile(profileText);
  noTaskTrackingProfile.capabilities.task_tracking = 'off';
  noTaskTrackingProfile.capabilities.roadmap = 'auto';
  const blockedRoadmap = resolveTaskContext({
    kind: 'code_change', risk: 'low', impact: 'local', uncertainty: 'low', milestone_id: 'M1'
  }, { root, profile: noTaskTrackingProfile, registry });
  assert.equal(blockedRoadmap.capabilityDecisions.roadmap.decision, 'disabled_by_dependency');
  assert.ok(blockedRoadmap.warnings.some((x) => x.includes('task_tracking')));
  assert.ok(!blockedRoadmap.requiredRead.some((x) => x.path === '.spec/roadmap/INDEX.md'));

  const productionRelease = resolveTaskContext({
    kind: 'code_change', risk: 'medium', impact: 'local', release_target: 'production'
  }, { root, profile, registry });
  assert.ok(productionRelease.requiredRead.some((x) => x.path === '.spec/00-constitution.md'));
  assert.ok(productionRelease.requiredRead.some((x) => x.path === '.spec/03-delivery.md'));
  assert.equal(productionRelease.capabilityDecisions.release_governance.decision, 'load_for_task');
  assert.equal(productionRelease.capabilityDecisions.release_governance.effective, 'light', 'profile capabilities load task-relevant guidance without being rewritten as toggles');
  assert.equal(productionRelease.riskAssessment.highImpact, true);

  const unknownRisk = resolveTaskContext({ kind: 'code_change', impact: 'local' }, { root, profile, registry });
  assert.ok(unknownRisk.optionalRead.some((x) => x.path === '.spec/00-constitution.md'));
  assert.ok(unknownRisk.warnings.some((x) => x.includes('risk=unknown')));

  assert.throws(() => normalizeTask({ stacks: ['../../outside'] }), /stacks/);
  assert.throws(() => normalizeTask({ kind: 'unknown_kind' }), /kind/);
  const help = spawnSync(process.execPath, [path.join(repoRoot, 'template/.standards/task-context-resolver.cjs'), '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stdout + help.stderr);
  assert.match(help.stdout, /task-context.json/);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('test-task-context-resolver: all cases passed');
