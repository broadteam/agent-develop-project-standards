'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveCapabilities(profile, registry) {
  const configured = profile.capabilities ?? {};
  const resolved = {};
  const errors = [];
  const excludedPaths = [];

  for (const [id, definition] of Object.entries(registry.capabilities ?? {})) {
    const value = Object.hasOwn(configured, id) ? configured[id] : definition.default;
    if (!definition.values.includes(value)) {
      errors.push('非法能力配置：capabilities.' + id + ' = ' + value);
      continue;
    }
    const status = definition.kind === 'profile' ? 'enabled' : value === 'off' ? 'disabled' : value === 'on' ? 'enabled' : 'deferred';
    resolved[id] = { configured: value, status };
    if (status === 'disabled') {
      for (const artifact of definition.artifacts ?? []) excludedPaths.push(artifact);
    }
  }

  for (const [id, definition] of Object.entries(registry.capabilities ?? {})) {
    const item = resolved[id];
    if (!item || item.status === 'disabled') continue;
    const dependency = definition.requires;
    if (dependency && (item.configured === dependency.when || item.status === 'deferred')) {
      const target = resolved[dependency.capability];
      if (!target || target.configured === dependency.not) {
        errors.push('能力依赖冲突：' + id + '=' + item.configured + ' 要求 ' + dependency.capability + ' 不得为 ' + dependency.not);
      }
    }
    const stackRequirement = definition.requires_stack;
    if (stackRequirement && item.configured === stackRequirement.when) {
      const detected = profile.stack?.detected ?? [];
      const hasConfirmedNonGenericStack = profile.profile?.status === 'confirmed' && Array.isArray(detected) && detected.some((value) => value !== 'generic');
      if (stackRequirement.non_generic && !hasConfirmedNonGenericStack) {
        errors.push(id + '=' + item.configured + ' 要求至少一个已确认的非 generic 技术栈');
      }
    }
  }

  return {
    capabilities: resolved,
    excludedPaths: [...new Set(excludedPaths)],
    errors,
    isExcluded(relativePath) {
      const normalized = relativePath.split(path.sep).join('/');
      return this.excludedPaths.some((entry) => normalized === entry || normalized.startsWith(entry.endsWith('/') ? entry : entry + '/'));
    }
  };
}

function loadCapabilityResolution(projectRoot, templateRoot) {
  const { parseProfile } = require('./profile-validator.cjs');
  const profilePath = path.join(projectRoot, 'project-profile.toml');
  const templateProfilePath = path.join(templateRoot, 'project-profile.toml');
  const registryPath = path.join(templateRoot, 'policy', 'capabilities.json');
  const profile = parseProfile(fs.readFileSync(fs.existsSync(profilePath) ? profilePath : templateProfilePath, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  return resolveCapabilities(profile, registry);
}

module.exports = { resolveCapabilities, loadCapabilityResolution };
