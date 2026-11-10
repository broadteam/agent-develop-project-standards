#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { resolveCapabilities } = require('../template/scripts/capability-resolver.cjs');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'template/policy/capabilities.json'), 'utf8'));

const profile = { capabilities: {
  task_tracking: 'off', roadmap: 'off', adr: 'auto', stack_rules: 'off',
  module_boundaries: 'auto', multi_agent: 'off', memory_mode: 'light',
  quality_gates: 'baseline', release_governance: 'light'
}};
const resolved = resolveCapabilities(profile, registry);
assert.deepEqual(resolved.errors, []);
assert.equal(resolved.capabilities.task_tracking.status, 'disabled');
assert.equal(resolved.capabilities.quality_gates.status, 'enabled');
assert.equal(resolved.capabilities.adr.status, 'deferred');
assert.ok(registry.core.rules.every((rule) => !Object.values(registry.capabilities).some((capability) => (capability.artifacts ?? []).some((artifact) => rule === artifact || rule.startsWith(artifact)))));
assert.equal(resolved.capabilities.adr.status, 'deferred');
assert.equal(resolved.capabilities.module_boundaries.status, 'deferred');
assert.equal(resolved.isExcluded('.spec/tasks/index.md'), true);
assert.equal(resolved.isExcluded('.spec/roadmap/M1/milestone.md'), true);
assert.equal(resolved.isExcluded('.spec/adr/README.md'), false);
assert.equal(resolved.isExcluded('.spec/01-architecture.md'), false);
assert.equal(resolved.isExcluded('.spec/stacks/java.md'), true);
assert.equal(resolved.isExcluded('.spec/02-conventions.md'), false);

const defaults = resolveCapabilities({}, registry);
assert.equal(defaults.capabilities.task_tracking.configured, 'auto');
assert.equal(defaults.capabilities.task_tracking.status, 'deferred');
assert.equal(defaults.isExcluded('.spec/tasks/index.md'), false, 'auto must not prune artifacts');

const invalid = resolveCapabilities({ capabilities: { roadmap: 'on', task_tracking: 'off' } }, registry);
assert.ok(invalid.errors.some((error) => error.includes('能力依赖冲突')));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-capability-resolver-'));
try {
  const project = path.join(tmp, 'lean-project');
  fs.mkdirSync(project);
  const profileTemplate = fs.readFileSync(path.join(root, 'template/project-profile.toml'), 'utf8')
    .replace('task_tracking = "auto"', 'task_tracking = "off"')
    .replace('roadmap = "auto"', 'roadmap = "off"')
    .replace('adr = "auto"', 'adr = "off"')
    .replace('stack_rules = "auto"', 'stack_rules = "off"');
  fs.writeFileSync(path.join(project, 'project-profile.toml'), profileTemplate);
  const run = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  for (const rel of ['.spec/tasks', '.spec/roadmap', '.spec/adr', '.spec/stacks']) {
    assert.equal(fs.existsSync(path.join(project, rel)), false, rel + ' should be omitted when capability is off');
  }
  const gov = fs.readFileSync(path.join(project, 'gov.toml'), 'utf8');
  const requiredFiles = gov.match(/^files = \[(.*)\]$/m)?.[1] ?? '';
  assert.doesNotMatch(requiredFiles, /\.spec\/(tasks|roadmap|adr|stacks)\//);
  assert.ok(fs.existsSync(path.join(project, '.spec/00-constitution.md')), 'core rules must remain');
  assert.ok(fs.existsSync(path.join(project, '.spec/01-architecture.md')), 'base architecture guidance must remain');
  const nodeGate = spawnSync(process.execPath, [path.join(project, 'scripts/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(nodeGate.status, 0, nodeGate.stdout + nodeGate.stderr);
  const pythonGate = spawnSync(process.env.PYTHON || 'python3', [path.join(project, 'scripts/check_governance.py')], { encoding: 'utf8' });
  if (pythonGate.error && !process.env.PYTHON) {
    const fallback = spawnSync('python', [path.join(project, 'scripts/check_governance.py')], { encoding: 'utf8' });
    if (!fallback.error) assert.equal(fallback.status, 0, fallback.stdout + fallback.stderr);
  } else {
    assert.equal(pythonGate.status, 0, pythonGate.stdout + pythonGate.stderr);
    assert.equal(nodeGate.stdout, pythonGate.stdout, 'Node/Python capability-off gate output must match');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('test-capability-resolver: all cases passed');
