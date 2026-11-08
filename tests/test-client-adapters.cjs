#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
assert.match(agents, /唯一入口/);
assert.match(init, /'AGENTS\.md'.*'CLAUDE\.md'.*'GEMINI\.md'/s, 'initializer must install all supported entry files');
assert.doesNotMatch(init, /\.cursorrules/, 'initializer must not create the deprecated Cursor entry');
assert.ok(!exists('template/.cursorrules'), 'deprecated Cursor entry must not exist in the template');
assert.match(spec, /Cursor[\s\S]*root-level only/i);
assert.match(spec, /Gemini CLI[\s\S]*@\.\/AGENTS\.md/);
assert.match(spec, /Claude Code[\s\S]*@AGENTS\.md/);
assert.match(spec, /Codex[\s\S]*root-to-leaf/i);

console.log('test-client-adapters: all cases passed');
