#!/usr/bin/env node
'use strict';

// Mirror the authoritative breakpoint (§0 of .memory/MEMORY.md) into client-private memory
// files. Some clients only ever read their own memory directory, and no rule in AGENTS.md can
// force them to look elsewhere — but they will read the file they own. So the state is copied
// to where they look, in a clearly marked block that this script owns.
//
// One-way, generated, never merged: the block is replaced on every run. Nothing else in the
// target file is touched, so the client keeps its own notes.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const JSON_OUT = process.argv.includes('--json');
const START = '<!-- >>> agent-standards memory mirror (generated) -->';
const END = '<!-- <<< agent-standards memory mirror -->';

function fail(message) {
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(message);
  process.exit(1);
}

// Only [memory].mirrors and [paths].memory are needed, so a full TOML parser would be overkill.
function readGov() {
  const file = path.join(ROOT, 'gov.toml');
  if (!fs.existsSync(file)) fail('缺少 gov.toml，无法确定记忆镜像目标。');
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const section = (name) => {
    const match = text.match(new RegExp(`^\\[${name}\\]\\s*$`, 'm'));
    if (!match) return '';
    const rest = text.slice(match.index + match[0].length);
    const next = rest.search(/^\[/m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const paths = section('paths');
  const memoryPath = (paths.match(/^memory\s*=\s*"([^"]+)"/m) || [, '.memory'])[1];
  const mirrorLine = section('memory').match(/^mirrors\s*=\s*\[(.*)\]\s*$/m);
  const mirrors = mirrorLine
    ? [...mirrorLine[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1].replace(/\\\\/g, '\\'))
    : [];
  return { authority: `${memoryPath}/MEMORY.md`, mirrors };
}

function breakpointSection(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^##\s*§0\b/.test(line));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

const gov = readGov();
const authorityFile = path.join(ROOT, gov.authority);
if (!fs.existsSync(authorityFile)) fail(`缺少权威记忆文件：${gov.authority}`);
const breakpoint = breakpointSection(fs.readFileSync(authorityFile, 'utf8'));
if (!breakpoint) fail(`${gov.authority} 里找不到 §0 断点小节。`);

const block = [
  START,
  '<!-- 项目断点：由 .memory/MEMORY.md §0 生成，勿手工编辑 -->',
  '',
  breakpoint,
  '',
  `> 项目级事实请写回 \`${gov.authority}\`；本区块每次同步都会被覆盖。`,
  END,
].join('\n');

const results = [];
for (const rel of gov.mirrors) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { results.push({ path: rel, status: 'missing' }); continue; }
  const current = fs.readFileSync(file, 'utf8');
  const startAt = current.indexOf(START);
  const endAt = current.indexOf(END);
  if ((startAt >= 0) !== (endAt >= 0) || (startAt >= 0 && endAt < startAt)) {
    fail(`${rel} 里的镜像区块标记损坏；请人工修复后重试（未写入）。`);
  }
  const next = startAt >= 0
    ? current.slice(0, startAt) + block + current.slice(endAt + END.length)
    : `${block}\n\n${current}`;
  const same = next.replace(/\r\n/g, '\n') === current.replace(/\r\n/g, '\n');
  results.push({ path: rel, status: same ? 'current' : (startAt >= 0 ? 'updated' : 'created') });
  if (!same && !CHECK) fs.writeFileSync(file, next, 'utf8');
}

const stale = results.filter((item) => item.status === 'updated' || item.status === 'created');
if (CHECK) {
  const ok = stale.length === 0;
  if (JSON_OUT) console.log(JSON.stringify({ ok, mirrors: results }, null, 2));
  else if (!ok) console.error(`客户端私有记忆断点未同步：${stale.map((item) => item.path).join('、')}\n运行 node scripts/sync-memory.cjs 更新。`);
  process.exit(ok ? 0 : 1);
}

if (JSON_OUT) console.log(JSON.stringify({ ok: true, mirrors: results }, null, 2));
else {
  if (!results.length) console.log('gov.toml [memory].mirrors 为空，未镜像任何客户端私有记忆。');
  for (const item of results) console.log(`  ${item.status.padEnd(8)} ${item.path}`);
  if (stale.length) console.log(`\n已把 ${gov.authority} 的 §0 镜像到 ${stale.length} 个私有记忆文件。`);
}
