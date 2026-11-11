#!/usr/bin/env node
'use strict';

/**
 * Task Context Resolver
 *
 * Read-only planning helper. It never edits project files, changes profile
 * values, creates task cards, executes verification commands, or bypasses gates.
 * "auto" is resolved only for the supplied task descriptor.
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseProfile } = require('./profile-validator.cjs');
const { resolveCapabilities } = require('./capability-resolver.cjs');

const TASK_ENUMS = {
  kind: ['code_change', 'bugfix', 'debugging', 'api_change', 'database_change', 'architecture_change', 'module_change', 'security_change', 'dependency_change', 'release', 'planning', 'incident'],
  risk: ['low', 'medium', 'high', 'critical', 'unknown'],
  impact: ['local', 'module', 'cross_module', 'public_contract', 'data', 'security', 'production', 'system'],
  uncertainty: ['low', 'medium', 'high', 'unknown']
};
const ALLOWED_KEYS = new Set([
  'summary', 'kind', 'risk', 'impact', 'uncertainty', 'cross_session',
  'stacks', 'task_id', 'milestone_id', 'multiple_agents', 'release_target'
]);
const HIGH_IMPACTS = new Set(['data', 'security', 'production']);
const CODE_KINDS = new Set(['code_change', 'bugfix', 'debugging', 'api_change', 'database_change', 'architecture_change', 'module_change', 'security_change', 'dependency_change']);

function normalizeTask(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('任务描述必须是 JSON object。');
  const errors = [];
  for (const key of Object.keys(input)) if (!ALLOWED_KEYS.has(key)) errors.push('未知任务字段：' + key);
  const task = {
    summary: typeof input.summary === 'string' ? input.summary.trim() : '',
    kind: input.kind ?? 'code_change',
    risk: input.risk ?? 'unknown',
    impact: input.impact ?? 'local',
    uncertainty: input.uncertainty ?? 'unknown',
    cross_session: input.cross_session ?? false,
    stacks: input.stacks ?? [],
    task_id: input.task_id ?? '',
    milestone_id: input.milestone_id ?? '',
    multiple_agents: input.multiple_agents ?? false,
    release_target: input.release_target ?? 'non_production'
  };
  for (const [field, values] of Object.entries(TASK_ENUMS)) {
    if (!values.includes(task[field])) errors.push('非法任务字段：' + field + ' = ' + task[field] + '（允许：' + values.join(', ') + '）');
  }
  for (const field of ['cross_session', 'multiple_agents']) {
    if (typeof task[field] !== 'boolean') errors.push(field + ' 必须是 boolean。');
  }
  if (!Array.isArray(task.stacks) || task.stacks.some((item) => typeof item !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item))) {
    errors.push('stacks 必须是由小写技术栈 ID 组成的数组。');
  } else {
    task.stacks = [...new Set(task.stacks)];
  }
  for (const field of ['task_id', 'milestone_id']) {
    if (task[field] && (typeof task[field] !== 'string' || !/^[A-Z]{1,3}[0-9][A-Za-z0-9._-]*$/.test(task[field]))) {
      errors.push(field + ' 格式非法，只允许安全的任务/里程碑 ID。');
    }
  }
  if (!['production', 'staging', 'development', 'non_production'].includes(task.release_target)) {
    errors.push('非法 release_target：' + task.release_target);
  }
  if (task.summary.length > 240) errors.push('summary 最长 240 个字符。');
  if (errors.length) throw new Error(errors.join('\n'));
  return task;
}

function resolveTaskContext(input, options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const task = normalizeTask(input);
  const profile = options.profile ?? parseProfile(fs.readFileSync(path.join(root, 'project-profile.toml'), 'utf8'));
  const registry = options.registry ?? JSON.parse(fs.readFileSync(path.join(root, 'policy/capabilities.json'), 'utf8'));
  const baseResolution = resolveCapabilities(profile, registry);
  const warnings = [...baseResolution.errors];
  const alwaysRead = [];
  const requiredRead = [];
  const optionalRead = [];
  const nextActions = [];

  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const pushUnique = (list, item) => {
    if (!list.some((entry) => entry.path === item.path)) list.push(item);
  };
  const add = (list, rel, reason, section = '') => {
    const item = { path: rel, reason };
    if (section) item.section = section;
    if (exists(rel)) pushUnique(list, item);
    else warnings.push('建议读取的文件当前不存在：' + rel + '（' + reason + '）');
  };

  add(alwaysRead, 'AGENTS.md', '统一规则入口');
  add(alwaysRead, '.memory/MEMORY.md', '跨会话断点', '§0');
  const profileStatus = profile.profile?.status ?? 'needs_review';
  const profileFields = ['profile.status', 'stack.primary', 'stack.detected', 'capabilities'];
  add(optionalRead, 'project-profile.toml', '仅在需要核实能力开关、技术栈候选或验证命令时读取：' + profileFields.join('、'));

  const signals = new Set();
  if (task.cross_session) signals.add('cross_session');
  if (task.task_id) signals.add('task_id_present');
  if (task.uncertainty === 'high') signals.add('uncertainty_high');
  if (task.risk === 'high' || task.risk === 'critical') signals.add('risk_high');
  if (task.impact === 'cross_module') signals.add('impact_cross_module');
  if (task.impact === 'public_contract') signals.add('impact_public_contract');
  if (task.impact === 'data') signals.add('impact_data');
  if (task.impact === 'security') signals.add('impact_security');
  if (task.impact === 'production' || task.release_target === 'production') signals.add('impact_production');
  if (task.impact === 'system') signals.add('impact_system');
  if (task.kind === 'architecture_change') signals.add('kind_architecture_change');
  if (task.kind === 'database_change') signals.add('kind_database_change');
  if (task.kind === 'security_change') signals.add('kind_security_change');
  if (task.kind === 'dependency_change') signals.add('kind_dependency_change');
  if (task.kind === 'module_change') signals.add('kind_module_change');
  if (task.kind === 'incident') signals.add('kind_incident');
  if (task.kind === 'release') signals.add('kind_release');
  if (task.milestone_id) signals.add('milestone_planning');
  if (task.multiple_agents) signals.add('multiple_agents');

  let stacks = task.stacks;
  if (!stacks.length && profileStatus === 'confirmed' && profile.stack?.primary && profile.stack.primary !== 'generic') {
    stacks = [profile.stack.primary];
  }
  if (stacks.length) signals.add('stack_involved');

  const decisions = {};
  for (const [id, definition] of Object.entries(registry.capabilities ?? {})) {
    const configured = profile.capabilities?.[id] ?? definition.default;
    const triggers = definition.task_context?.when_any ?? [];
    const matched = triggers.filter((trigger) => signals.has(trigger));
    let selected = false;
    let effective = configured;
    let decision = 'not_relevant';

    if (definition.kind === 'profile') {
      selected = matched.length > 0;
      decision = selected ? 'load_for_task' : 'profile_available';
    } else if (configured === 'off') {
      decision = matched.length ? 'disabled_by_project' : 'disabled';
      if (matched.length) warnings.push('任务触发了 ' + id + '，但项目画像将其设为 off；不会绕过项目选择。触发条件：' + matched.join(', '));
    } else if (configured === 'on') {
      selected = matched.length > 0;
      decision = selected ? 'load_for_task' : 'enabled_but_not_relevant';
    } else if (configured === 'auto') {
      selected = matched.length > 0;
      effective = selected ? 'on' : 'off';
      decision = selected ? 'auto_selected_for_task' : 'auto_not_selected_for_task';
    } else {
      decision = 'profile_available';
    }
    decisions[id] = { configured, effective, decision, matched };
  }

  const taskDecision = decisions.task_tracking;
  if (taskDecision?.decision === 'auto_selected_for_task' || (taskDecision?.configured === 'on' && taskDecision.matched.length)) {
    add(requiredRead, '.spec/intent/BASELINE.md', '跟踪任务必须恢复原始目标基线，防止局部工作取代项目目标');
    add(requiredRead, '.spec/intent/CHANGES.md', '跟踪任务必须核对用户已确认的意图变化与未决事项');
    add(requiredRead, '.spec/tasks/index.md', '当前任务需要跟踪；先读活跃任务索引');
    if (task.task_id) {
      add(requiredRead, '.spec/tasks/' + task.task_id + '/card.md', '当前任务卡的范围与验收');
      add(optionalRead, '.spec/tasks/' + task.task_id + '/log.md', '需要恢复执行历史或跨会话续作时读取');
    } else {
      nextActions.push('任务需要跟踪，但未提供 task_id：先检查任务索引，必要时创建任务卡；解析器不会自动创建。');
    }
  }

  const roadmapDecision = decisions.roadmap;
  if (roadmapDecision?.decision === 'auto_selected_for_task' || (roadmapDecision?.configured === 'on' && roadmapDecision.matched.length)) {
    add(requiredRead, '.spec/roadmap/INDEX.md', '当前工作属于里程碑规划');
    if (task.milestone_id) add(requiredRead, '.spec/roadmap/' + task.milestone_id + '/milestone.md', '当前里程碑详情');
  }

  const architectureRelevant = ['cross_module', 'public_contract', 'data', 'security', 'system'].includes(task.impact)
    || ['architecture_change', 'database_change', 'module_change', 'security_change'].includes(task.kind);
  if (architectureRelevant || decisions.module_boundaries?.decision === 'auto_selected_for_task' || (decisions.module_boundaries?.configured === 'on' && decisions.module_boundaries.matched.length)) {
    add(requiredRead, '.spec/01-architecture.md', '任务触及模块边界、数据结构、公共契约或系统架构');
  }
  if (CODE_KINDS.has(task.kind)) add(requiredRead, '.spec/02-conventions.md', '代码变更的通用工程约定');

  const adrDecision = decisions.adr;
  const adrTriggered = adrDecision?.decision === 'auto_selected_for_task' || (adrDecision?.configured === 'on' && adrDecision.matched.length);
  if (adrTriggered) {
    add(requiredRead, '.spec/adr/README.md', '判断是否存在相关既有架构决策；只追溯相关 ADR');
    nextActions.push('若本次改变长期架构取舍、模块依赖或公共契约，评估是否新增 ADR；不是每次高风险任务都自动创建 ADR。');
  }

  const stackDecision = decisions.stack_rules;
  const stackSelected = stackDecision && (stackDecision.decision === 'auto_selected_for_task' || (stackDecision.configured === 'on' && stackDecision.matched.length));
  if (stackSelected) {
    if (!stacks.length) warnings.push('stack_rules 已触发，但任务未指定技术栈，且项目画像不是已确认状态；请明确本次涉及的技术栈。');
    for (const stack of stacks) {
      const normalized = stack === 'electron' || stack === 'node-web' ? 'node' : stack;
      add(requiredRead, '.spec/stacks/' + normalized + '.md', '本任务涉及技术栈：' + stack);
    }
  }

  const constitutionNeeded = ['high', 'critical'].includes(task.risk)
    || ['data', 'security', 'production', 'public_contract', 'system'].includes(task.impact)
    || task.release_target === 'production'
    || task.kind === 'security_change';
  if (constitutionNeeded) {
    add(requiredRead, '.spec/00-constitution.md', '任务风险或影响触及权限、安全、数据或生产边界');
  } else if (task.risk === 'unknown') {
    add(optionalRead, '.spec/00-constitution.md', '风险尚未评估；确认权限与不可逆操作边界');
    warnings.push('risk=unknown：请先判断是否涉及生产、数据、安全或外部可见操作。');
  }

  if (task.kind === 'debugging' || task.kind === 'incident') {
    add(optionalRead, '.memory/PITFALLS.md', '排查故障时按主题检索已验证的历史教训');
    if (task.kind === 'incident') add(requiredRead, '.spec/03-delivery.md', '事件处置与恢复可能涉及交付/回滚边界');
  }

  const deliveryNeeded = task.kind === 'release' || task.release_target === 'production'
    || ['data', 'security', 'production'].includes(task.impact)
    || decisions.quality_gates?.decision === 'auto_selected_for_task'
    || decisions.release_governance?.decision === 'auto_selected_for_task';
  if (deliveryNeeded) add(requiredRead, '.spec/03-delivery.md', '验证、发布、回滚与交付边界');

  const registryRelevant = ['api_change', 'database_change', 'architecture_change'].includes(task.kind)
    || ['public_contract', 'data'].includes(task.impact);
  if (registryRelevant) add(optionalRead, '.spec/REGISTRY.md', '核对标识符、接口名、字段和数据实体登记');

  if (task.impact === 'cross_module' || task.impact === 'system') {
    nextActions.push('检查涉及模块的允许依赖方向与所有权；如果项目配置了架构测试，必须执行对应测试。');
  }
  if (task.multiple_agents && decisions.multi_agent?.decision === 'disabled_by_project') {
    nextActions.push('当前任务声明使用多个 Agent，但项目未启用 multi_agent 能力；先明确共享文件、任务认领与并发写入协调方式。');
  }
  if (profileStatus !== 'confirmed') warnings.push('项目画像状态为 ' + profileStatus + '；只把任务显式给出的 stacks 和画像中已确认的内容当作事实。');

  const commands = {};
  if (deliveryNeeded || task.kind === 'release' || task.risk === 'high' || task.risk === 'critical') {
    for (const key of ['lint', 'typecheck', 'test', 'build', 'ci']) {
      const value = profile.verification?.[key];
      if (typeof value === 'string' && value.trim()) commands[key] = value.trim();
    }
  }

  return {
    task,
    riskAssessment: {
      supplied: task.risk,
      highImpact: HIGH_IMPACTS.has(task.impact) || task.impact === 'public_contract' || task.impact === 'system' || task.release_target === 'production',
      constitutionRequired: constitutionNeeded
    },
    alwaysRead,
    requiredRead,
    optionalRead,
    capabilityDecisions: decisions,
    verificationCommands: commands,
    nextActions,
    warnings: [...new Set(warnings)]
  };
}

function renderText(result) {
  const lines = [];
  lines.push('任务上下文解析');
  lines.push('类型：' + result.task.kind + ' | 风险：' + result.task.risk + ' | 影响：' + result.task.impact);
  for (const [label, items] of [['固定基线', result.alwaysRead], ['本任务需要读取', result.requiredRead], ['按需读取', result.optionalRead]]) {
    lines.push('');
    lines.push(label + '：');
    if (!items.length) lines.push('  （无）');
    for (const item of items) lines.push('  - ' + item.path + (item.section ? ' ' + item.section : '') + ' — ' + item.reason);
  }
  lines.push('');
  lines.push('能力判定：');
  for (const [id, item] of Object.entries(result.capabilityDecisions)) {
    lines.push('  - ' + id + ': ' + item.configured + ' → ' + item.decision + (item.matched.length ? ' [' + item.matched.join(', ') + ']' : ''));
  }
  if (Object.keys(result.verificationCommands).length) {
    lines.push('');
    lines.push('已配置验证命令（仅列出，不自动执行）：');
    for (const [id, command] of Object.entries(result.verificationCommands)) lines.push('  - ' + id + ': ' + command);
  }
  if (result.nextActions.length) {
    lines.push('');
    lines.push('后续动作：');
    for (const item of result.nextActions) lines.push('  - ' + item);
  }
  if (result.warnings.length) {
    lines.push('');
    lines.push('提醒：');
    for (const item of result.warnings) lines.push('  - ' + item);
  }
  return lines.join('\n');
}

function main(argv) {
  let inputPath = '.tmp/task-context.json';
  let format = 'text';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) inputPath = argv[++i];
    else if (argv[i] === '--format' && ['text', 'json'].includes(argv[i + 1])) format = argv[++i];
    else if (argv[i] === '--help') {
      console.log('用法：node .standards/task-context-resolver.cjs [--input .tmp/task-context.json] [--format text|json]');
      console.log('任务描述示例：{"kind":"database_change","risk":"high","impact":"data","cross_session":true,"uncertainty":"medium","stacks":["java"],"task_id":"T12"}');
      return 0;
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  const root = process.cwd();
  const absoluteInput = path.resolve(root, inputPath);
  const relativeInput = path.relative(root, absoluteInput);
  if (relativeInput.startsWith('..') || path.isAbsolute(relativeInput)) throw new Error('--input 必须位于项目目录内，建议放在 .tmp/。');
  if (!fs.existsSync(absoluteInput)) throw new Error('找不到任务描述文件：' + inputPath + '。先创建 .tmp/task-context.json，参考 --help 中的示例。');
  const task = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
  const profile = parseProfile(fs.readFileSync(path.join(root, 'project-profile.toml'), 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'policy/capabilities.json'), 'utf8'));
  const result = resolveTaskContext(task, { root, profile, registry });
  console.log(format === 'json' ? JSON.stringify(result, null, 2) : renderText(result));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[task-context] ' + error.message); process.exitCode = 1; }
}

module.exports = { normalizeTask, resolveTaskContext, renderText, TASK_ENUMS };
