#!/usr/bin/env node
'use strict';

// Validate repository-local Markdown links without making CI depend on the network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['.git', 'node_modules']);
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
}

assert.deepEqual(failures, [], `broken local Markdown links:\n${failures.join('\n')}`);
console.log(`test-doc-links: ${markdown.length} Markdown files checked`);
