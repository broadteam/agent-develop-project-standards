#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const usage = 'Usage: node tools/client-smoke/create-fixture.cjs <new-disposable-directory>';
const inside = (base, candidate) => candidate === base || candidate.startsWith(base + path.sep);

function fail(message) {
  process.stderr.write(message + '\n' + usage + '\n');
  process.exitCode = 2;
}

const requested = process.argv[2];
if (!requested || requested === '--help' || requested === '-h' || process.argv.length > 3) {
  if (requested === '--help' || requested === '-h') {
    process.stdout.write(usage + '\n');
    process.exit(0);
  }
  fail('必须指定一个尚不存在的临时目录。');
}

const target = path.resolve(process.cwd(), requested);
if (inside(ROOT, target) || inside(target, ROOT)) {
  fail('为避免误改仓库，目标目录不能位于本工具仓库内，也不能是包含本仓库的父目录。');
}
try {
  fs.lstatSync(target);
  fail('目标目录已经存在；脚本不会覆盖或清理既有目录。');
} catch (error) {
  if (error.code !== 'ENOENT') {
    fail('无法检查目标目录：' + error.message);
  }
}
if (process.exitCode) process.exit(process.exitCode);

const rootToken = crypto.randomBytes(8).toString('hex').toUpperCase();
const memoryToken = crypto.randomBytes(8).toString('hex').toUpperCase();
const nestedToken = crypto.randomBytes(8).toString('hex').toUpperCase();
const checkpointToken = crypto.randomBytes(8).toString('hex').toUpperCase();
let created = false;

try {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(target);
  created = true;
  // Create the nested directory before initialization so it enters the disposable
  // project's generated root allowlist instead of leaving a governance violation.
  fs.mkdirSync(path.join(target, 'nested'));

  const init = spawnSync(process.execPath, [path.join(ROOT, 'init.cjs'), target], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (init.error || init.status !== 0) {
    throw new Error('模板初始化失败：\n' + (init.stdout || '') + (init.stderr || '') + (init.error ? init.error.message : ''));
  }

  const agentsPath = path.join(target, 'AGENTS.md');
  const agents = fs.readFileSync(agentsPath, 'utf8');
  const probeRules = [
    '',
    '## Temporary client-loading smoke probe',
    '',
    'This section exists only in a disposable client-smoke fixture.',
    'For [CLIENT-SMOKE:ROOT], consult the current root rules and the §0 breakpoint in .memory/MEMORY.md, then return exactly:',
    'ROOT_RULE=' + rootToken,
    'MEMORY_BREAKPOINT=' + memoryToken,
    'Do not infer or invent either value. Do not modify files for this probe.',
    '',
    'For [CLIENT-SMOKE:WRITE], append the exact CROSS_SESSION_CHECKPOINT line supplied by the user to the §0 section of .memory/MEMORY.md. Preserve all other content and do not edit any other file.',
    'For [CLIENT-SMOKE:RESTORE], read the current §0 breakpoint from .memory/MEMORY.md and return its CROSS_SESSION_CHECKPOINT line exactly. Do not rely on prior chat context.',
    '',
    'For [CLIENT-SMOKE:NESTED], inspect nested/probe.md without changing it, then return the root, nested and memory markers exactly as instructed by the nested AGENTS.md.',
    '',
  ].join('\n');
  fs.writeFileSync(agentsPath, agents.replace(/\s*$/, '') + '\n' + probeRules, 'utf8');

  const memoryPath = path.join(target, '.memory', 'MEMORY.md');
  let memory = fs.readFileSync(memoryPath, 'utf8');
  const breakpointHeading = '## §0 断点（跟踪任务收口或跨会话暂停时覆盖，6 行内）';
  const headingAt = memory.indexOf(breakpointHeading);
  if (headingAt < 0) throw new Error('模板记忆文件缺少预期的 §0 断点标题。');
  const insertAt = memory.indexOf('\n', headingAt);
  if (insertAt < 0) throw new Error('无法定位记忆断点区块。');
  const memoryMarker = '\n- Client smoke marker (temporary): MEMORY_BREAKPOINT=' + memoryToken + '\n';
  memory = memory.slice(0, insertAt + 1) + memoryMarker + memory.slice(insertAt + 1);
  fs.writeFileSync(memoryPath, memory, 'utf8');

  const nestedRules = [
    '# Nested client-loading smoke probe',
    '',
    'This file is temporary and exists only to test directory-scoped instruction discovery.',
    'For [CLIENT-SMOKE:NESTED], inspect the adjacent probe.md without editing it and return exactly these three lines:',
    'ROOT_RULE=' + rootToken,
    'NESTED_RULE=' + nestedToken,
    'MEMORY_BREAKPOINT=' + memoryToken,
    'Do not infer or invent values. The root AGENTS.md and .memory/MEMORY.md remain authoritative for their respective markers.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(target, 'nested', 'AGENTS.md'), nestedRules, 'utf8');
  fs.writeFileSync(path.join(target, 'nested', 'probe.md'), '# Nested probe file\n\nRead-only smoke-test target. Do not modify this file.\n', 'utf8');

  const governance = spawnSync(process.execPath, [path.join(target, '.standards', 'check-governance.cjs')], {
    cwd: target,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (governance.error || governance.status !== 0) {
    throw new Error('生成后的夹具未通过治理检查：\n' + (governance.stdout || '') + (governance.stderr || '') + (governance.error ? governance.error.message : ''));
  }

  process.stdout.write([
    'Client smoke fixture created:',
    target,
    '',
    'Keep the following expected values out of the Agent prompts.',
    'Root probe:',
    'ROOT_RULE=' + rootToken,
    'MEMORY_BREAKPOINT=' + memoryToken,
    '',
    'Nested probe adds:',
    'NESTED_RULE=' + nestedToken,
    '',
    'Session A must write this line to .memory/MEMORY.md; a completely new Session B must restore it:',
    'CROSS_SESSION_CHECKPOINT=' + checkpointToken,
    '',
    'The fixture passed its generated-project governance check.',
  ].join('\n') + '\n');
} catch (error) {
  if (created) fs.rmSync(target, { recursive: true, force: true });
  process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
  process.exitCode = 1;
}
