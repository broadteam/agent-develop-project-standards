#!/usr/bin/env node
/** Generate the human-readable task board from the authoritative task index. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const rootAt = args.indexOf('--root');
if (rootAt >= 0 && !args[rootAt + 1]) { console.error('--root 缺少目标目录'); process.exit(2); }
const root = rootAt >= 0 ? path.resolve(args[rootAt + 1]) : path.resolve(__dirname, '..');
const indexPath = path.join(root, '.spec/tasks/index.md');
const boardPath = path.join(root, '.spec/tasks/BOARD.md');
if (!fs.existsSync(indexPath)) { console.error('缺少 .spec/tasks/index.md'); process.exit(1); }
const source = fs.readFileSync(indexPath, 'utf8');
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const lines = source.split(/\r?\n/);
const rows = [];
let inCurrent = false;
for (const line of lines) {
  if (/^##\s+当前波次/.test(line)) { inCurrent = true; continue; }
  if (inCurrent && /^##\s+/.test(line)) break;
  if (!inCurrent) continue;
  const m = line.match(/^\|\s*([A-Z]{1,3}\d[\w.-]*)\s*\|\s*([^|]+?)\s*\|\s*(planned|ready|in_progress|review|done|blocked|dropped)\s*\|\s*([^|]+?)\s*\|/);
  if (m) rows.push({ id: m[1], title: m[2].trim(), status: m[3], scope: m[4].trim() });
}
const groups = [
  ['进行中', ['in_progress', 'review']],
  ['就绪（ready）', ['ready']],
  ['计划中（planned）', ['planned']],
  ['阻塞（blocked）', ['blocked']],
  ['已完成 / 已放弃', ['done', 'dropped']],
];
let body = '';
for (const [label, statuses] of groups) {
  body += `\n## ${label}\n\n| 卡 | 标题 | 范围 |\n|---|---|---|\n`;
  const selected = rows.filter(r => statuses.includes(r.status));
  body += selected.length ? selected.map(r => `| ${r.id} | ${r.title.replace(/\|/g, '\\|')} | ${r.scope.replace(/\|/g, '\\|')} |`).join('\n') : '| — | 暂无 | — |';
  body += '\n';
}
body += `\n## 统计\n\n- 总计 ${rows.length} / 计划 ${rows.filter(r => r.status === 'planned').length} / 就绪 ${rows.filter(r => r.status === 'ready').length} / 进行 ${rows.filter(r => ['in_progress','review'].includes(r.status)).length} / 完成 ${rows.filter(r => r.status === 'done').length} / 阻塞 ${rows.filter(r => r.status === 'blocked').length}\n`;
const generatedHash = crypto.createHash('sha256').update(body).digest('hex');
body = `\n<!-- SOURCE-SHA256: ${sourceHash} -->\n<!-- GENERATED-SHA256: ${generatedHash} -->\n` + body;
const start = '<!-- GENERATED:START -->';
const end = '<!-- GENERATED:END -->';
let current = fs.existsSync(boardPath) ? fs.readFileSync(boardPath, 'utf8') : `# 工作板（自动生成视图）\n\n${start}\n${end}\n`;
const a = current.indexOf(start), b = current.indexOf(end);
if (a < 0 || b < a) { console.error('BOARD.md 缺少有效的 GENERATED 标记'); process.exit(1); }
if (args.includes('--validate')) {
  console.log('BOARD.md 结构有效。');
  process.exit(0);
}
const next = `${current.slice(0, a + start.length)}${body}${current.slice(b)}`;
if (process.argv.includes('--check')) {
  if (next !== current) { console.error('BOARD.md 已过期，请运行 node scripts/generate-board.cjs'); process.exit(1); }
  console.log('BOARD.md 与任务索引一致。');
} else {
  fs.writeFileSync(boardPath, next, 'utf8');
  console.log(`已生成 BOARD.md（${rows.length} 张任务卡）。`);
}
