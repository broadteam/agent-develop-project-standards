#!/usr/bin/env node
'use strict';

// Validate repository-local Markdown links and the README directory tree without
// making CI depend on the network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Tool-side directories hold local state that is not part of the repository, so their
// Markdown must not affect this gate (otherwise CI and a developer machine disagree).
const ignored = new Set(['.git', 'node_modules', '.workbuddy-ai', '.tmp']);
const markdown = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(path.join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      markdown.push(path.join(dir, entry.name));
    }
  }
}
walk(root);

const failures = [];
for (const file of markdown) {
  const text = fs.readFileSync(file, 'utf8');
  const links = text.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (!target || target.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
    const pathname = decodeURIComponent(target.split('#', 1)[0]);
    if (!pathname) continue;
    const resolved = path.resolve(path.dirname(file), pathname);
    if (!fs.existsSync(resolved)) failures.push(`${path.relative(root, file)} → ${target}`);
  }
  // Reference-style definitions (`[label]: path`) point at the same kind of local file.
  for (const match of text.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)) {
    const target = match[1].trim();
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target.split('#', 1)[0]));
    if (!fs.existsSync(resolved)) failures.push(`${path.relative(root, file)} → [ref] ${target}`);
  }
}

// The README directory tree is the repository map. It drifted once already, so it is
// checked instead of trusted: every leaf must resolve to a real path.
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
assert.equal((changelog.match(/^## Unreleased$/gm) ?? []).length, 1, 'CHANGELOG must contain exactly one Unreleased section');

const readme = path.join(root, 'README.md');
const treeMatch = fs.readFileSync(readme, 'utf8').match(/```text\r?\n(project-standards\/[\s\S]*?)```/);
assert.ok(treeMatch, 'README.md 缺少 project-standards/ 目录树代码块');
const stack = [];
for (const line of treeMatch[1].split(/\r?\n/)) {
  const entry = line.match(/^((?:(?:│   |    ))*)(?:├── |└── )(.*)$/);
  if (!entry) continue;
  const depth = entry[1].length / 4;
  const name = entry[2].split('#')[0].split(' + ')[0].trim();
  if (!name) continue;
  stack.length = depth;
  stack[depth] = name.replace(/\/$/, '');
  const rel = stack.slice(0, depth + 1).join('/');
  if (!fs.existsSync(path.join(root, rel))) failures.push(`README.md 目录树 → ${rel}（实际不存在）`);
}

assert.deepEqual(failures, [], `broken local Markdown links or tree entries:\n${failures.join('\n')}`);
console.log(`test-doc-links: ${markdown.length} Markdown files checked, README tree verified`);
