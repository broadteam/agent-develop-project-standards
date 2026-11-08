#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const template = path.join(root, 'template');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const agents = read('template/AGENTS.md');
const claude = read('template/CLAUDE.md').trim();
const gemini = read('template/GEMINI.md').trim();
const init = read('init.cjs');
const spec = read('SPEC-v2.0.md');

assert.ok(exists('template/AGENTS.md'), 'canonical AGENTS.md must exist');
assert.equal(claude, '@AGENTS.md', 'Claude entry must import the canonical rules');
assert.equal(gemini, '@./AGENTS.md', 'Gemini entry must import the canonical rules');
assert.match(agents, /唯一入口/);\nassert.ok(!claude.includes('\\n') && !gemini.includes('\\n'), 'client entrypoints must remain one-line pointers');\nassert.ok(!claude.includes('唯一入口') && !gemini.includes('唯一入口'), 'client entrypoints must not duplicate canonical rule prose');
assert.ok(init.includes("'AGENTS.md', 'ROUTER.md', 'CLAUDE.md', 'GEMINI.md'"), 'initializer must install all supported entry files');
assert.ok(!init.includes('.cursorrules'), 'initializer must not create the deprecated Cursor entry');
assert.ok(!exists('template/.cursorrules'), 'deprecated Cursor entry must not exist in the template');\nassert.ok(!exists('template/.cursor/rules'), 'client-specific scoped rules must not silently become a second canonical ruleset');
assert.ok(spec.includes('Cursor') && spec.includes('仅支持项目根目录'));
assert.ok(spec.includes('Gemini CLI') && spec.includes('@./AGENTS.md'));
assert.ok(spec.includes('Claude Code') && spec.includes('@AGENTS.md'));
assert.ok(spec.includes('Codex') && spec.includes('仓库根到当前工作目录'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-client-adapters-'));
try {
  const project = path.join(tmp, 'fixture-project');
  fs.mkdirSync(project);
  const install = spawnSync(process.execPath, [path.join(root, 'init.cjs'), project], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stdout + install.stderr);
  assert.equal(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8').trim(), '@AGENTS.md');
  assert.equal(fs.readFileSync(path.join(project, 'GEMINI.md'), 'utf8').trim(), '@./AGENTS.md');
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')), 'initializer must install canonical rules');\n  assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), fs.readFileSync(path.join(template, 'AGENTS.md'), 'utf8'), 'initializer must copy the canonical rule body unchanged');
  assert.ok(!fs.existsSync(path.join(project, '.cursorrules')), 'initializer must not install deprecated Cursor rules');\n  assert.ok(!fs.existsSync(path.join(project, '.cursor/rules')), 'initializer must not generate duplicate scoped rule files');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('test-client-adapters: all cases passed');
