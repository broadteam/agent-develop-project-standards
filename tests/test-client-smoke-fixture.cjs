#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const generator = path.join(root, 'tools', 'client-smoke', 'create-fixture.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-client-smoke-fixture-'));
const run = (target) => spawnSync(process.execPath, [generator, target], { cwd: root, encoding: 'utf8', windowsHide: true });

try {
  const help = spawnSync(process.execPath, [generator, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stdout + help.stderr);
  assert.match(help.stdout, /new-disposable-directory/);

  const target = path.join(tmp, 'generated-project');
  const created = run(target);
  assert.equal(created.status, 0, created.stdout + created.stderr);
  const rootToken = created.stdout.match(/^ROOT_RULE=([A-F0-9]{16})$/m);
  const memoryToken = created.stdout.match(/^MEMORY_BREAKPOINT=([A-F0-9]{16})$/m);
  const nestedToken = created.stdout.match(/^NESTED_RULE=([A-F0-9]{16})$/m);
  const checkpointToken = created.stdout.match(/^CROSS_SESSION_CHECKPOINT=([A-F0-9]{16})$/m);
  assert.ok(rootToken && memoryToken && nestedToken && checkpointToken, created.stdout);

  const agents = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  const memory = fs.readFileSync(path.join(target, '.memory', 'MEMORY.md'), 'utf8');
  const nestedAgents = fs.readFileSync(path.join(target, 'nested', 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('ROOT_RULE=' + rootToken[1]));
  assert.ok(memory.includes('MEMORY_BREAKPOINT=' + memoryToken[1]));
  assert.ok(nestedAgents.includes('NESTED_RULE=' + nestedToken[1]));
  assert.ok(nestedAgents.includes('ROOT_RULE=' + rootToken[1]));
  assert.ok(nestedAgents.includes('MEMORY_BREAKPOINT=' + memoryToken[1]));
  assert.ok(fs.existsSync(path.join(target, 'nested', 'probe.md')));
  assert.equal(fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8').trim(), '@AGENTS.md');
  assert.equal(fs.readFileSync(path.join(target, 'GEMINI.md'), 'utf8').trim(), '@./AGENTS.md');
  assert.ok(!fs.existsSync(path.join(target, 'CODEBUDDY.md')), 'CodeBuddy IDE smoke must exercise AGENTS fallback, not a competing CODEBUDDY.md');

  const governance = spawnSync(process.execPath, [path.join(target, '.standards', 'check-governance.cjs')], { cwd: target, encoding: 'utf8' });
  assert.equal(governance.status, 0, governance.stdout + governance.stderr);

  const existing = path.join(tmp, 'existing-project');
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'keep.txt'), 'do-not-overwrite\n');
  const refused = run(existing);
  assert.notEqual(refused.status, 0, 'generator must refuse an existing target directory');
  assert.equal(fs.readFileSync(path.join(existing, 'keep.txt'), 'utf8'), 'do-not-overwrite\n');

  const insideRepository = path.join(root, '.client-smoke-test-must-not-create');
  const refusedRepositoryPath = run(insideRepository);
  assert.notEqual(refusedRepositoryPath.status, 0, 'generator must refuse to create fixtures inside its own repository');
  assert.ok(!fs.existsSync(insideRepository), 'refused in-repository target must remain absent');

  console.log('test-client-smoke-fixture: all cases passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
