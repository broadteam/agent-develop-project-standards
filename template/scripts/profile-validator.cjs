'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ENUMS = {
  'profile.status': ['needs_review', 'confirmed'],
  'profile.type': ['web', 'api', 'saas', 'desktop', 'mobile', 'library', 'cli', 'monorepo', 'other', 'unknown'],
  'profile.scale': ['small', 'medium', 'large', 'unknown'],
  'profile.risk': ['low', 'medium', 'high', 'critical', 'unknown'],
  'profile.architecture': ['modular_monolith', 'layered', 'microservices', 'event_driven', 'monolith', 'other', 'unknown']
};

function parseProfile(source) {
  const data = {};
  let section = '';
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([\w.-]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (data[section]) throw new Error(`第 ${index + 1} 行重复 section：[${section}]`);
      data[section] = {};
      continue;
    }
    const kv = line.match(/^([\w.-]+)\s*=\s*(.*?)\s*(?:#.*)?$/);
    if (!kv || !section) throw new Error(`第 ${index + 1} 行 TOML 子集语法不受支持：${line}`);
    const [, key, value] = kv;
    if (Object.hasOwn(data[section], key)) throw new Error(`第 ${index + 1} 行重复键：${section}.${key}`);
    if (/^".*"$/.test(value)) data[section][key] = value.slice(1, -1);
    else if (/^\d+$/.test(value)) data[section][key] = Number(value);
    else if (/^\[(?:\s*"[^"]*"\s*(?:,\s*"[^"]*"\s*)*)?\]$/.test(value)) {
      data[section][key] = [...value.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    } else throw new Error(`第 ${index + 1} 行值类型不受支持：${section}.${key}`);
  }
  return data;
}

function validateProfile(root) {
  const errors = [], warnings = [];
  const profilePath = path.join(root, 'project-profile.toml');
  const registryPath = path.join(root, 'policy', 'capabilities.json');
  if (!fs.existsSync(profilePath)) return { errors: ['缺少 project-profile.toml'], warnings };
  if (!fs.existsSync(registryPath)) return { errors: ['缺少 policy/capabilities.json（能力注册表）'], warnings };
  let profile, registry;
  try { profile = parseProfile(fs.readFileSync(profilePath, 'utf8')); }
  catch (error) { return { errors: [`project-profile.toml：${error.message}`], warnings }; }
  try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
  catch (error) { return { errors: [`policy/capabilities.json 无法解析：${error.message}`], warnings }; }

  const expected = {
    profile: ['schema_version','status','name','description','type','scale','risk','architecture'],
    stack: ['detected','primary','framework','package_manager'],
    capabilities: Object.keys(registry.capabilities ?? {}),
    verification: ['lint','typecheck','test','build','ci']
  };
  for (const [section, keys] of Object.entries(expected)) {
    if (!profile[section]) { errors.push(`project-profile.toml 缺少 [${section}]`); continue; }
    for (const key of keys) if (!Object.hasOwn(profile[section], key)) errors.push(`project-profile.toml 缺少 ${section}.${key}`);
    for (const key of Object.keys(profile[section])) if (!keys.includes(key)) errors.push(`project-profile.toml 存在未知字段：${section}.${key}`);
  }
  for (const section of Object.keys(profile)) if (!Object.hasOwn(expected, section)) errors.push(`project-profile.toml 存在未知 section：[${section}]`);

  if (profile.profile) {
    if (profile.profile.schema_version !== registry.schema_version) errors.push(`画像 schema_version 不匹配：${profile.profile.schema_version}，注册表要求 ${registry.schema_version}`);
    for (const [field, values] of Object.entries(ENUMS)) {
      const [section, key] = field.split('.');
      if (profile[section] && Object.hasOwn(profile[section], key) && !values.includes(profile[section][key])) errors.push(`非法枚举值：${field} = ${profile[section][key]}（允许：${values.join(', ')}）`);
    }
    if (profile.profile.status === 'needs_review') warnings.push('项目画像尚未确认（needs_review）；探测值不得作为已确认项目事实。');
    if (profile.profile.status === 'confirmed') {
      for (const field of ['type','scale','risk','architecture']) if (profile.profile[field] === 'unknown') errors.push(`画像已标记 confirmed，但 profile.${field} 仍为 unknown`);
    }
  }
  if (profile.stack) {
    for (const key of ['primary','framework','package_manager']) if (typeof profile.stack[key] !== 'string') errors.push(`stack.${key} 必须是字符串`);
    if (!Array.isArray(profile.stack.detected) || profile.stack.detected.some((v) => typeof v !== 'string')) errors.push('stack.detected 必须是字符串数组');
    else if (!profile.stack.detected.length) errors.push('stack.detected 不能为空；未知技术栈请使用 ["generic"]');
  }
  if (profile.capabilities) {
    for (const [name, definition] of Object.entries(registry.capabilities ?? {})) {
      const value = profile.capabilities[name];
      if (value !== undefined && !definition.values.includes(value)) errors.push(`非法能力配置：capabilities.${name} = ${value}（允许：${definition.values.join(', ')}）`);
    }
    const roadmap = profile.capabilities.roadmap;
    if (roadmap === 'on' && profile.capabilities.task_tracking === 'off') errors.push('能力依赖冲突：roadmap=on 要求 task_tracking 不得为 off');
    if (profile.capabilities.stack_rules === 'on' && profile.stack?.detected?.every((v) => v === 'generic')) errors.push('stack_rules=on 要求至少一个已确认的非 generic 技术栈');
    if (profile.capabilities.release_governance === 'strict' && profile.capabilities.quality_gates === 'baseline') errors.push('release_governance=strict 要求 quality_gates 为 standard 或 strict');
    if (profile.capabilities.quality_gates === 'strict' && profile.verification && !['lint','test','build'].some((key) => typeof profile.verification[key] === 'string' && profile.verification[key].trim())) errors.push('quality_gates=strict 至少需要配置 lint、test、build 中一项适用的验证命令');
  }
  if (profile.verification) for (const key of expected.verification) if (typeof profile.verification[key] !== 'string') errors.push(`verification.${key} 必须是字符串`);
  return { errors, warnings };
}

module.exports = { parseProfile, validateProfile };
