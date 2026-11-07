#!/usr/bin/env node
/**
 * 治理检查 —— 把 AGENTS.md 里「能机器测的规则」变成闸门。
 *
 * 检查五件事：
 *   1. 根目录白名单（gov.toml [dirs]）
 *   2. 根目录禁用命名（gov.toml [forbid]）：out2 / test1 / TODO.md / *.bak ...
 *   3. 文档与索引预算（gov.toml [budget]）——同时是 token 预算
 *   4. 必需文件存在（gov.toml [required]）
 *   5. 索引 ↔ 卡片目录双向一致（gov.toml [layout]）
 *
 * 用法：node scripts/check-governance.cjs
 * 退出码：0 通过，1 违规（可直接进 CI / pre-commit）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GOV = path.join(ROOT, 'gov.toml');

if (!fs.existsSync(GOV)) {
  console.error('\n找不到 gov.toml，治理检查无法运行。\n');
  process.exit(1);
}

/** 极简 TOML 读取：只支持 `key = "str"` / `key = 数字` / `key = ["a","b"]`。 */
function readGov(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = {};
  let section = '';

  /** 去掉引号外的行尾注释，否则 `12288  # 说明` 会被当成字符串。 */
  const stripComment = (s) => {
    let inStr = false;
    for (let i = 0; i < s.length; i += 1) {
      const c = s[i];
      if (c === '"') inStr = !inStr;
      else if (c === '#' && !inStr) return s.slice(0, i);
    }
    return s;
  };

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;

    const sec = t.match(/^\[(\w+)\]$/);
    if (sec) {
      section = sec[1];
      out[section] = out[section] ?? {};
      continue;
    }

    const kv = t.match(/^(\w+)\s*=\s*(.+)$/);
    if (!kv || !section) continue;

    const [, key, rawVal] = kv;
    const val = stripComment(rawVal).trim();
    if (!val) continue;

    if (val.startsWith('[')) {
      out[section][key] = [...val.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
        m[1].replace(/\\\\/g, '\\'),
      );
    } else if (/^\d+$/.test(val)) {
      out[section][key] = Number(val);
    } else {
      out[section][key] = val.replace(/^"|"$/g, '');
    }
  }
  return out;
}

const gov = readGov(GOV);
const errors = [];
const notes = [];

const projectName = gov.project?.name ?? path.basename(ROOT);

/**
 * 编译 gov.toml 里的正则。支持前缀 `(?i)` 表示忽略大小写
 * （JS 的 RegExp 不支持内联标志，这里手动剥掉并转成 flag）。
 */
const toRegex = (list) =>
  (list ?? [])
    .map((p) => {
      try {
        const insensitive = p.startsWith('(?i)');
        return new RegExp(insensitive ? p.slice(4) : p, insensitive ? 'i' : '');
      } catch {
        errors.push(`gov.toml 里的正则写错了：${p}`);
        return null;
      }
    })
    .filter(Boolean);

const size = (rel) => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.statSync(p).size : null;
};

// ---------------------------------------------------------------- 1. 根目录白名单
const allowedDirs = new Set(gov.dirs?.allowed_dirs ?? []);
const allowedFiles = new Set(gov.dirs?.allowed_files ?? []);
// 这两个永远放行：一个是版本库元数据，一个是依赖，登记进白名单只会制造噪音
const ALWAYS_OK = new Set(['.git', 'node_modules']);

if (allowedDirs.size === 0 && allowedFiles.size === 0) {
  notes.push('gov.toml [dirs] 为空 —— 白名单未启用（建议运行 init 生成）');
} else {
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    const name = entry.name;
    if (ALWAYS_OK.has(name)) continue;
    if (entry.isDirectory()) {
      if (!allowedDirs.has(name)) {
        errors.push(
          `根目录出现未登记目录：${name}/  → 加到 gov.toml [dirs].allowed_dirs，或挪进 .tmp/ / 产物目录`,
        );
      }
    } else if (!allowedFiles.has(name)) {
      errors.push(`根目录出现未登记文件：${name}  → 加到 gov.toml [dirs].allowed_files，或挪进 .tmp/`);
    }
  }
}

// ---------------------------------------------------------------- 2. 禁用命名
const dirPatterns = toRegex(gov.forbid?.dir_patterns);
const filePatterns = toRegex(gov.forbid?.file_patterns);

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  const patterns = entry.isDirectory() ? dirPatterns : filePatterns;
  for (const re of patterns) {
    if (re.test(entry.name)) {
      errors.push(
        `命中禁用命名：${entry.name}  → 构建产物统一放固定目录，临时产物统一 .tmp/<任务ID>/，计划写进 .spec/`,
      );
      break;
    }
  }
}

// ---------------------------------------------------------------- 3. 预算（含 token）
const budget = gov.budget ?? {};
const budgetChecks = [
  ['AGENTS.md', budget.agents_bytes, '唯一入口'],
  ['.memory/MEMORY.md', budget.memory_bytes, '跨会话状态页'],
  ['.memory/PITFALLS.md', budget.pitfalls_bytes, '判据与实证'],
  [gov.layout?.tasks_index ?? '.spec/tasks/index.md', budget.index_bytes, '任务索引（超了先归档已完成波次）'],
  [gov.layout?.roadmap_index ?? '.spec/roadmap/INDEX.md', budget.roadmap_bytes, '里程碑索引（超了先归档已完成里程碑）'],
];

for (const [rel, limit, label] of budgetChecks) {
  const s = size(rel);
  if (s === null) continue; // 存在性由第 4 步检查
  if (limit && s > limit) {
    errors.push(`超预算：${rel} ${s}B > ${limit}B（${label}）`);
  } else if (limit) {
    notes.push(`${rel}  ${s}/${limit}B  (${Math.round((s / limit) * 100)}%)`);
  }
}

// 每张卡 / 每个里程碑的详情文件大小
const scanDetail = (dirRel, file, label) => {
  const dir = path.join(ROOT, dirRel);
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'archive' || e.name === 'assets') continue;
    const rel = path.join(dirRel, e.name, file);
    const s = size(rel);
    if (s === null) {
      errors.push(`${label} ${e.name} 缺少 ${file}（应在 ${dirRel}/${e.name}/ 下）`);
    } else if (budget.card_bytes && s > budget.card_bytes) {
      errors.push(
        `超预算：${rel} ${s}B > ${budget.card_bytes}B（${label}详情）→ 过程挪去 log.md 或 .tmp/，只留结论`,
      );
    }
  }
};
scanDetail(gov.layout?.tasks_dir ?? '.spec/tasks', 'card.md', '任务卡');
scanDetail(gov.layout?.roadmap_dir ?? '.spec/roadmap', 'milestone.md', '里程碑');

// ---------------------------------------------------------------- 4. 必需文件
for (const rel of gov.required?.files ?? []) {
  if (!fs.existsSync(path.join(ROOT, rel))) errors.push(`缺少必需文件：${rel}`);
}

// ---------------------------------------------------------------- 5. 索引 ↔ 目录一致性
/** 从 markdown 表格里抓出「ID 在首列」的行。ID 形如 T1 / M2 / W3。 */
function idsFromIndex(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  const ids = new Set();
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*([A-Z]{1,3}\d[\w.-]*)\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function dirsIn(rel, ignore = []) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !ignore.includes(e.name))
    .map((e) => e.name);
}

const ignoreDirs = gov.layout?.tasks_ignore ?? ['archive', 'assets'];

const consistency = (indexRel, dirRel, label) => {
  const ids = idsFromIndex(indexRel);
  if (!ids) return;
  const dirs = dirsIn(dirRel, ignoreDirs);

  for (const id of ids) {
    if (!dirs.includes(id)) {
      errors.push(`${label}：索引里有 ${id}，但 ${dirRel}/${id}/ 不存在（建目录 + 详情文件）`);
    }
  }
  for (const d of dirs) {
    if (!ids.has(d)) {
      errors.push(`${label}：${dirRel}/${d}/ 存在，但 ${indexRel} 里没有登记（补一行，或删掉目录）`);
    }
  }
};

consistency(
  gov.layout?.tasks_index ?? '.spec/tasks/index.md',
  gov.layout?.tasks_dir ?? '.spec/tasks',
  '任务卡',
);
consistency(
  gov.layout?.roadmap_index ?? '.spec/roadmap/INDEX.md',
  gov.layout?.roadmap_dir ?? '.spec/roadmap',
  '里程碑',
);

// ---------------------------------------------------------------- 输出
console.log(`\n治理检查  ${projectName}\n`);

for (const n of notes) console.log(`  · ${n}`);

if (errors.length === 0) {
  console.log('\n  ✅ 全部通过\n');
  process.exit(0);
}

console.log(`\n  ❌ ${errors.length} 项违规：\n`);
for (const e of errors) console.log(`  - ${e}`);
console.log('');
process.exit(1);
