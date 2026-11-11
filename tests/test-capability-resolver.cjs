#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { resolveCapabilities } = require('../template/.standards/capability-resolver.cjs');
function assertResolverParity(label, profile) {
  const node = resolveCapabilities(profile, registry);
  const script = [
    'import json, sys',
    `sys.path.insert(0, ${JSON.stringify(path.join(root, 'template/.standards'))})`,
    'from profile_validator import resolve_capabilities',
    'print(json.dumps(resolve_capabilities(json.loads(sys.argv[1]), json.loads(sys.argv[2])), ensure_ascii=False))'
  ].join('; ');
  let result = spawnSync(process.env.PYTHON || 'python3', ['-c', script, JSON.stringify(profile), JSON.stringify(registry)], { encoding: 'utf8' });
  if (result.error && !process.env.PYTHON) result = spawnSync('python', ['-c', script, JSON.stringify(profile), JSON.stringify(registry)], { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const python = JSON.parse(result.stdout.trim());
  assert.deepEqual({ capabilities: python.capabilities, excludedPaths: python.excluded_paths, errors: python.errors }, { capabilities: node.capabilities, excludedPaths: node.excludedPaths, errors: node.errors }, label + ': Node/Python resolver results differ');
}
const registry = JSON.parse(fs.readFileSync(path.join(root, 'template/policy/capabilities.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'SPEC-v2.0.md'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'DEPLOY.md'), 'utf8');
const clients = fs.readFileSync(path.join(root, 'CLIENTS.md'), 'utf8');

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
for (const requiredCore of ['.spec/intent/BASELINE.md','.spec/intent/CHANGES.md','.spec/requirements/INDEX.md','.spec/verification/INDEX.md']) assert.ok(registry.core.rules.includes(requiredCore), requiredCore + ' must be an always-on foundation');
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
const invalidStack = resolveCapabilities({stack:{detected:['generic']},capabilities:{stack_rules:'on'}}, registry);
assert.ok(invalidStack.errors.some((error) => error.includes('stack_rules=on')));
const unconfirmedStack = resolveCapabilities({profile:{status:'needs_review'},stack:{detected:['php']},capabilities:{stack_rules:'on'}}, registry);
assert.ok(unconfirmedStack.errors.some((error) => error.includes('stack_rules=on')), 'a detected but unconfirmed stack must not satisfy stack_rules=on');
const confirmedStack = resolveCapabilities({profile:{status:'confirmed'},stack:{detected:['php']},capabilities:{stack_rules:'on'}}, registry);
assert.deepEqual(confirmedStack.errors, [], 'a confirmed non-generic stack satisfies stack_rules=on');
const invalidRelease = resolveCapabilities({capabilities:{quality_gates:'baseline',release_governance:'strict'}}, registry);
assert.ok(invalidRelease.errors.some((error) => error.includes('release_governance=strict')));
const invalidAutoRoadmap = resolveCapabilities({capabilities:{task_tracking:'off',roadmap:'auto'}}, registry);
assert.ok(invalidAutoRoadmap.errors.some((error) => error.includes('roadmap=auto') && error.includes('task_tracking')));
assertResolverParity('default auto capability resolution', {});
assertResolverParity('roadmap auto must respect task_tracking dependency', { capabilities: { task_tracking: 'off', roadmap: 'auto' } });
assertResolverParity('stack_rules on requires a confirmed non-generic stack', { stack: { detected: ['generic'] }, capabilities: { stack_rules: 'on' } });
assertResolverParity('stack_rules on rejects an unconfirmed concrete stack', { profile: { status: 'needs_review' }, stack: { detected: ['php'] }, capabilities: { stack_rules: 'on' } });
assertResolverParity('stack_rules on accepts a confirmed concrete stack', { profile: { status: 'confirmed' }, stack: { detected: ['php'] }, capabilities: { stack_rules: 'on' } });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-capability-resolver-'));
try {
  // auto defers optional task rules by task context, but does not disable repository data integrity checks.
  const autoProject = path.join(tmp, 'auto-project');
  fs.mkdirSync(autoProject);
  const autoInstall = spawnSync(process.execPath, [path.join(root, 'init.cjs'), autoProject], { encoding: 'utf8' });
  assert.equal(autoInstall.status, 0, autoInstall.stdout + autoInstall.stderr);
  const emptyAutoGate = spawnSync(process.execPath, [path.join(autoProject, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(emptyAutoGate.status, 0, emptyAutoGate.stdout + emptyAutoGate.stderr, 'auto must not force an otherwise unnecessary task card');
  fs.mkdirSync(path.join(autoProject, '.spec/tasks/T777'), { recursive: true });
  fs.writeFileSync(path.join(autoProject, '.spec/tasks/T777/card.md'), '# Existing tracked record\\n');
  fs.writeFileSync(path.join(autoProject, '.spec/tasks/T777/log.md'), '# Log\\n');
  const indexedAutoGate = spawnSync(process.execPath, [path.join(autoProject, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(indexedAutoGate.status, 1, indexedAutoGate.stdout + indexedAutoGate.stderr);
  assert.match(indexedAutoGate.stdout, /存在，但 .*index\.md 里没有登记/);
  let indexedAutoPython = spawnSync('python3', [path.join(autoProject, '.standards/check_governance.py')], { encoding: 'utf8' });
  if (indexedAutoPython.error) indexedAutoPython = spawnSync('python', [path.join(autoProject, '.standards/check_governance.py')], { encoding: 'utf8' });
  if (!indexedAutoPython.error) {
    assert.equal(indexedAutoPython.status, 1, indexedAutoPython.stdout + indexedAutoPython.stderr);
    assert.equal(indexedAutoGate.stdout, indexedAutoPython.stdout, 'auto static data gates must preserve Node/Python parity');
  }

  const project = path.join(tmp, 'lean-project');
  fs.mkdirSync(project);
  const profileTemplate = fs.readFileSync(path.join(root, 'template/project-profile.toml'), 'utf8')
    .replace('task_tracking = "auto"', 'task_tracking = "off"')
    .replace('roadmap = "auto"', 'roadmap = "off"')
    .replace('adr = "auto"', 'adr = "off"')
    .replace('stack_rules = "auto"', 'stack_rules = "off"');
  fs.writeFileSync(path.join(project, 'project-profile.toml'), profileTemplate);
  const existingPlan = path.join(project, 'TODO.md');
  fs.writeFileSync(existingPlan, '# Existing project plan: keep as project-owned tracker');
  const run = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  for (const rel of ['.spec/tasks', '.spec/roadmap', '.spec/adr', '.spec/stacks']) {
    assert.equal(fs.existsSync(path.join(project, rel)), false, rel + ' should be omitted when capability is off');
  }
  const gov = fs.readFileSync(path.join(project, 'gov.toml'), 'utf8');
  const requiredFiles = gov.match(/^files = \[(.*)\]$/m)?.[1] ?? '';
  assert.ok(fs.existsSync(existingPlan), 'existing root plan must not be migrated when task_tracking is off');
  const allowedFiles = gov.match(/^allowed_files = \[(.*)\]$/m)?.[1] ?? '';
  assert.ok(allowedFiles.includes('TODO.md'), 'existing root plan must remain whitelisted when task_tracking is off');
  assert.ok(!gov.includes('(?i)^(todo|plan|roadmap'), 'root-plan prohibition is disabled with task_tracking');
  assert.doesNotMatch(requiredFiles, /\.spec\/(tasks|roadmap|adr|stacks)\//);
  assert.ok(fs.existsSync(path.join(project, '.spec/00-constitution.md')), 'core rules must remain');
  assert.ok(fs.existsSync(path.join(project, '.spec/01-architecture.md')), 'base architecture guidance must remain');
  const memoryTemplate = fs.readFileSync(path.join(project, '.memory/MEMORY.md'), 'utf8');
  assert.match(memoryTemplate, /关闭时引用 `\.spec\/01-architecture\.md` 或 PR 审查记录/);
  assert.match(memoryTemplate, /仅在启用 `task_tracking`、`roadmap`、`adr` 时/);
  assert.match(memoryTemplate, /关闭对应能力时，不得假设这些路径存在或要求维护/);
  const leanConstitution = fs.readFileSync(path.join(project, '.spec/00-constitution.md'), 'utf8');
  const leanAgents = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  assert.match(leanConstitution, /关闭时更新 `\.spec\/01-architecture\.md` 或 PR 审查记录/);
  assert.match(leanAgents, /关闭时在 `\.spec\/01-architecture\.md` 或 PR 审查记录中保存裁定/);
  const nodeGate = spawnSync(process.execPath, [path.join(project, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(nodeGate.status, 0, nodeGate.stdout + nodeGate.stderr);
  const pythonGate = spawnSync(process.env.PYTHON || 'python3', [path.join(project, '.standards/check_governance.py')], { encoding: 'utf8' });
  if (pythonGate.error && !process.env.PYTHON) {
    const fallback = spawnSync('python', [path.join(project, '.standards/check_governance.py')], { encoding: 'utf8' });
    if (!fallback.error) assert.equal(fallback.status, 0, fallback.stdout + fallback.stderr);
  } else {
    assert.equal(pythonGate.status, 0, pythonGate.stdout + pythonGate.stderr);
    assert.equal(nodeGate.stdout, pythonGate.stdout, 'Node/Python capability-off gate output must match');
  }
  // Turning optional capabilities off preserves historical files without enforcing their gates.
  const oldTaskDir = path.join(project, '.spec/tasks/T99');
  fs.mkdirSync(oldTaskDir, { recursive: true });
  fs.writeFileSync(path.join(project, '.spec/tasks/index.md'), [
    '# Historical task index', '',
    '| ID | 标题 | 状态 | 优先级 |',
    '|---|---|---|---|',
    '| T99 | preserved legacy task | done | normal |', ''
  ].join('\n'));
  fs.writeFileSync(path.join(oldTaskDir, 'card.md'), '# Historical task\n\n- 创建日期：not-a-date\n- 意图对齐：invalid\n');
  const oldMilestoneDir = path.join(project, '.spec/roadmap/M99');
  fs.mkdirSync(oldMilestoneDir, { recursive: true });
  fs.writeFileSync(path.join(project, '.spec/roadmap/INDEX.md'), [
    '# Historical roadmap', '',
    '| ID | 标题 | 时间 | 状态 |',
    '|---|---|---|---|',
    '| M99 | preserved legacy milestone | long | 已完成 |', ''
  ].join('\n'));
  fs.writeFileSync(path.join(oldMilestoneDir, 'milestone.md'), '# Historical milestone\n\n- 创建日期：not-a-date\n- 意图对齐：invalid\n');
  const nodeGateWithHistory = spawnSync(process.execPath, [path.join(project, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(nodeGateWithHistory.status, 0, nodeGateWithHistory.stdout + nodeGateWithHistory.stderr);
  const pythonGateWithHistory = spawnSync(process.env.PYTHON || 'python3', [path.join(project, '.standards/check_governance.py')], { encoding: 'utf8' });
  if (!pythonGateWithHistory.error) {
    assert.equal(pythonGateWithHistory.status, 0, pythonGateWithHistory.stdout + pythonGateWithHistory.stderr);
    assert.equal(nodeGateWithHistory.stdout, pythonGateWithHistory.stdout, 'Node/Python must both skip optional historical record gates when disabled');
  }

  // Validate independent capability combinations rather than only all-on/all-off presets.
  const taskOnlyProject = path.join(tmp, 'task-only-project');
  fs.mkdirSync(taskOnlyProject);
  const taskOnlyProfile = profileTemplate
    .replace('task_tracking = "off"', 'task_tracking = "on"')
    .replace('multi_agent = "off"', 'multi_agent = "on"')
    .replace('module_boundaries = "auto"', 'module_boundaries = "off"');
  fs.writeFileSync(path.join(taskOnlyProject, 'project-profile.toml'), taskOnlyProfile);
  const taskOnlyRun = spawnSync(process.execPath, [path.join(root, 'init.cjs'), taskOnlyProject], { encoding: 'utf8' });
  assert.equal(taskOnlyRun.status, 0, taskOnlyRun.stdout + taskOnlyRun.stderr);
  const taskOnlyAgents = fs.readFileSync(path.join(taskOnlyProject, 'AGENTS.md'), 'utf8');
  const taskOnlyRouter = fs.readFileSync(path.join(taskOnlyProject, 'ROUTER.md'), 'utf8');
  const taskOnlyArchitecture = fs.readFileSync(path.join(taskOnlyProject, '.spec/01-architecture.md'), 'utf8');
  assert.match(taskOnlyAgents, /几天内的持续工作使用 `.spec\/tasks\//, 'task_tracking=on must retain task guidance');
  assert.doesNotMatch(taskOnlyAgents, /几周至几个月.*\.spec\/roadmap/s, 'roadmap=off must not retain roadmap instructions');
  assert.match(taskOnlyAgents, /多 Agent 协作（仅启用时）/, 'multi_agent=on must add shared-write coordination rules');
  assert.match(taskOnlyRouter, /\.spec\/tasks\/index\.md/);
  assert.doesNotMatch(taskOnlyRouter, /\.spec\/roadmap\/INDEX\.md/);
  assert.doesNotMatch(taskOnlyRouter, /\.spec\/adr\/README\.md/);
  assert.doesNotMatch(taskOnlyRouter, /\.spec\/stacks\//);
  assert.match(taskOnlyArchitecture, /基础依赖原则/, 'base architecture constraints must remain even when module_boundaries is off');
  assert.match(taskOnlyArchitecture, /外层通过显式接口依赖内层/, 'module_boundaries=off must not disable core one-way dependency rules');
  assert.doesNotMatch(taskOnlyArchitecture, /模块依赖矩阵/, 'module_boundaries=off must remove its optional matrix instructions');
  assert.doesNotMatch(taskOnlyAgents, /里程碑状态以 `\.spec\/roadmap\/INDEX\.md` 为准/, 'roadmap=off must not retain an unconditional authority pointer');
  assert.match(taskOnlyAgents, /启用 `adr` 时 ADR 也采用单写者/, 'multi_agent rules must not assume ADR is enabled');
  const taskOnlyConstitution = fs.readFileSync(path.join(taskOnlyProject, '.spec/00-constitution.md'), 'utf8');
  assert.match(taskOnlyConstitution, /启用 `task_tracking` 时，任务状态以/, 'constitution must mark task state as optional');
  assert.match(taskOnlyConstitution, /启用 `adr` 时，架构决策以/, 'constitution must mark ADR as optional');
  const taskOnlyGate = spawnSync(process.execPath, [path.join(taskOnlyProject, '.standards/check-governance.cjs')], { encoding: 'utf8' });
  assert.equal(taskOnlyGate.status, 0, taskOnlyGate.stdout + taskOnlyGate.stderr);
  assert.match(readme, /关闭 `task_tracking` 或 `roadmap` 时，保留项目已有的计划\/历史文件/, 'README must describe disabled task/roadmap behavior');
  assert.match(spec, /启用 `task_tracking` 时，`.spec\/tasks\/index\.md`/, 'SPEC must mark task index as optional');
  assert.match(deploy, /关闭 `task_tracking` 时则不会导入这些文件/, 'DEPLOY must document task_tracking=off plan preservation');
  assert.match(clients, /仅当项目启用 `stack_rules` 时/, 'CLIENTS must not recommend disabled stack files');
  assert.match(clients, /仅在启用 `roadmap` 时里程碑状态进 `\.spec\/roadmap\/INDEX\.md`/, 'CLIENTS must mark roadmap state as optional');
  assert.match(clients, /仅在启用 `task_tracking` \/ `roadmap` \/ `adr` 时，任务、里程碑、架构决策分别写回对应权威文件/, 'CLIENTS closeout map must qualify optional state domains');
  assert.match(deploy, /启用 `adr` 时写 ADR；关闭时写入 `\.spec\/01-architecture\.md` 或 PR 审查记录/, 'DEPLOY must use the stable ADR-off decision record path');
  assert.match(readme, /仅在启用 `task_tracking` \/ `roadmap` \/ `adr` 时/, 'README must qualify task, milestone, and ADR state sources');
  assert.match(spec, /关闭时记入 `\.spec\/01-architecture\.md` 或 PR 审查记录/, 'SPEC must define a stable ADR-off decision record path');
  assert.match(readme, /仅在启用 `task_tracking` 时再记录 T 任务锚点/, 'README must mark the task anchor as optional');
  assert.match(readme, /仅在启用 `adr` 时，架构决策以 ADR 为准/, 'README must mark ADR as optional');
  assert.match(spec, /启用 `task_tracking` 时，Board 源哈希与生成内容哈希/, 'SPEC must qualify the Board acceptance gate');
  assert.match(deploy, /启用 `task_tracking` 时默认导入到/, 'DEPLOY must condition plan import on task tracking');

} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('test-capability-resolver: all cases passed');
