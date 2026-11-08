#!/usr/bin/env node
/** Governance gate. Keep output and semantics in parity with check_governance.py. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const GOV = path.join(ROOT, 'gov.toml');
if (!fs.existsSync(GOV)) { console.error('\n找不到 gov.toml，治理检查无法运行。\n'); process.exit(1); }

// Supported TOML subset: single-line sections, strings, integers and single-line string arrays.
function readGov(file) {
  const raw = fs.readFileSync(file, 'utf8'); const out = {}; let section = '';
  const stripComment = (s) => { let q = false, esc = false; for (let i=0;i<s.length;i++) { const c=s[i]; if (c==='"' && !esc) q=!q; if (c==='#' && !q) return s.slice(0,i); esc = c==='\\' && !esc; if (c!=='\\') esc=false; } return s; };
  for (const line of raw.split(/\r?\n/)) {
    const t=line.trim(); if (!t || t.startsWith('#')) continue;
    const sec=t.match(/^\[([\w.-]+)\]$/); if (sec) { section=sec[1]; out[section] ??= {}; continue; }
    const kv=t.match(/^([\w.-]+)\s*=\s*(.+)$/); if (!kv || !section) { console.error(`gov.toml 语法不受支持：${t}`); process.exit(1); }
    const val=stripComment(kv[2]).trim();
    if (val.startsWith('[')) {
      if (!val.endsWith(']')) { console.error(`gov.toml 数组必须写在单行：${kv[1]}`); process.exit(1); }
      const items=[...val.slice(1,-1).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m=>m[1].replace(/\\([\\"])/g,'$1'));
      out[section][kv[1]]=items;
    } else if (/^\d+$/.test(val)) out[section][kv[1]]=Number(val);
    else if (/^".*"$/.test(val)) out[section][kv[1]]=val.slice(1,-1);
    else { console.error(`gov.toml 值不受支持：${kv[1]} = ${val}`); process.exit(1); }
  }
  return out;
}
const gov=readGov(GOV), errors=[], notes=[];
const projectName=gov.project?.name ?? path.basename(ROOT);
const capabilityResolution = require('./capability-resolver.cjs').loadCapabilityResolution(ROOT, ROOT);
for (const error of capabilityResolution.errors) errors.push(error);
const capabilityEnabled = (id) => capabilityResolution.capabilities[id]?.status !== 'disabled';
const sorted=(xs)=>xs.sort((a,b)=>a.localeCompare(b));
const rootEntries=fs.readdirSync(ROOT,{withFileTypes:true});
const isDir=(e)=>e.isDirectory(); // Symlinks are consistently treated as file-like entries.
const size=(rel)=>{const p=path.join(ROOT,rel); try { return fs.statSync(p).size; } catch { return null; }};
const toRegex=(list)=> (list??[]).map(p=>{try{const i=p.startsWith('(?i)');return new RegExp(i?p.slice(4):p,i?'i':'');}catch{errors.push(`gov.toml 里的正则写错了：${p}`);return null;}}).filter(Boolean);

// 1. Root allowlist
const allowedDirs=new Set(gov.dirs?.allowed_dirs??[]), allowedFiles=new Set(gov.dirs?.allowed_files??[]), ALWAYS_OK=new Set(['.git','node_modules']);
if (!allowedDirs.size && !allowedFiles.size) notes.push('gov.toml [dirs] 为空 —— 白名单未启用（建议运行 init 生成）');
else for (const e of rootEntries) { const n=e.name; if(ALWAYS_OK.has(n))continue; if(isDir(e)){if(!allowedDirs.has(n))errors.push(`根目录出现未登记目录：${n}/  → 加到 gov.toml [dirs].allowed_dirs，或挪进 .tmp/ / 产物目录`);} else if(!allowedFiles.has(n)) errors.push(`根目录出现未登记文件：${n}  → 加到 gov.toml [dirs].allowed_files，或挪进 .tmp/`); }

// 2. Forbidden root names
const dirRes=toRegex(gov.forbid?.dir_patterns), fileRes=toRegex(gov.forbid?.file_patterns);
for(const e of rootEntries){const list=isDir(e)?dirRes:fileRes;if(list.some(r=>r.test(e.name)))errors.push(`命中禁用命名：${e.name}  → 构建产物统一放固定目录，临时产物统一 .tmp/<任务ID>/，计划写进 .spec/`);}

// 3. Budgets
const budget=gov.budget??{}, layout=gov.layout??{};
const budgetChecks=[['AGENTS.md',budget.agents_bytes,'唯一入口'],['.memory/MEMORY.md',budget.memory_bytes,'跨会话状态页'],['.memory/PITFALLS.md',budget.pitfalls_bytes,'判据与实证'],...(capabilityEnabled('task_tracking')?[[layout.tasks_index??'.spec/tasks/index.md',budget.index_bytes,'任务索引（超了先归档已完成波次）']]:[]),...(capabilityEnabled('roadmap')?[[layout.roadmap_index??'.spec/roadmap/INDEX.md',budget.roadmap_bytes,'里程碑索引（超了先归档已完成里程碑）']]:[])];
for(const [rel,limit,label] of budgetChecks){const n=size(rel);if(n===null)continue;if(limit&&n>limit)errors.push(`超预算：${rel} ${n}B > ${limit}B（${label}）`);else if(limit)notes.push(`${rel}  ${n}/${limit}B  (${Math.round(n/limit*100)}%)`);}
function scanDetail(dirRel,filename,label,requireLog=false){const dir=path.join(ROOT,dirRel);if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(!isDir(e)||['archive','assets'].includes(e.name))continue;const rel=path.posix.join(dirRel,e.name,filename);const n=size(rel);if(n===null)errors.push(`${label} ${e.name} 缺少 ${filename}（应在 ${dirRel}/${e.name}/ 下）`);else if(budget.card_bytes&&n>budget.card_bytes)errors.push(`超预算：${rel} ${n}B > ${budget.card_bytes}B（${label}详情）→ 过程挪去 log.md 或 .tmp/，只留结论`);if(requireLog&&size(path.posix.join(dirRel,e.name,'log.md'))===null)errors.push(`任务卡 ${e.name} 缺少 log.md（应在 ${dirRel}/${e.name}/ 下）`);}}
if(capabilityEnabled('task_tracking'))scanDetail(layout.tasks_dir??'.spec/tasks','card.md','任务卡',true);if(capabilityEnabled('roadmap'))scanDetail(layout.roadmap_dir??'.spec/roadmap','milestone.md','里程碑');

// 4. Required files
for(const rel of gov.required?.files??[])if(!capabilityResolution.isExcluded(rel)&&!fs.existsSync(path.join(ROOT,rel)))errors.push(`缺少必需文件：${rel}`);

// 5. Active index ↔ directory consistency. Archived directories are deliberately outside the active index.
function tableRows(rel, heading, statusColumn){const p=path.join(ROOT,rel);if(!fs.existsSync(p))return null;const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);let active=false, rows=[];for(const line of lines){if(line.startsWith('## ')){if(active)break;if(line.replace(/^##\s*/, '').startsWith(heading))active=true;continue;}if(!active)continue;const cells=line.split('|').slice(1,-1).map(v=>v.trim());if(cells.length>statusColumn&&/^[A-Z]{1,3}\d[\w.-]*$/.test(cells[0]))rows.push({id:cells[0],title:cells[1]??'',status:cells[statusColumn]??''});}return rows;}
function consistency(indexRel,dirRel,label,heading,statusAllowed=null,statusColumn=2,ignoreList=layout.tasks_ignore??['archive','assets']){const rows=tableRows(indexRel,heading,statusColumn);if(rows===null)return;const seen=new Set();for(const r of rows){if(seen.has(r.id))errors.push(`${label}：${indexRel} 中 ID ${r.id} 重复`);seen.add(r.id);if(statusAllowed&&!statusAllowed.includes(r.status))errors.push(`${label}：${r.id} 状态非法：${r.status}`);}const dir=path.join(ROOT,dirRel);const dirs=fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).filter(e=>isDir(e)&&!ignoreList.includes(e.name)).map(e=>e.name):[];for(const r of rows)if(!dirs.includes(r.id))errors.push(`${label}：索引里有 ${r.id}，但 ${dirRel}/${r.id}/ 不存在（建目录 + 详情文件）`);for(const d of dirs)if(!seen.has(d))errors.push(`${label}：${dirRel}/${d}/ 存在，但 ${indexRel} 里没有登记（补一行，或移入 archive/）`);}
if(capabilityEnabled('task_tracking'))consistency(layout.tasks_index??'.spec/tasks/index.md',layout.tasks_dir??'.spec/tasks','任务卡','当前波次',['planned','ready','in_progress','review','done','blocked','dropped'],2,layout.tasks_ignore??['archive','assets']);
if(capabilityEnabled('roadmap'))consistency(layout.roadmap_index??'.spec/roadmap/INDEX.md',layout.roadmap_dir??'.spec/roadmap','里程碑','里程碑',['未开始','进行中','已完成','已放弃'],3,layout.roadmap_ignore??['archive','assets']);

/**
 * Archived records are intentionally excluded from active directory scans,
 * but their indexes remain a navigable integrity contract.
 */
function markdownTable(rel, sectionHeading = null) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let start = 0;
  if (sectionHeading) {
    start = lines.findIndex(line => line.startsWith('## ') && line.replace(/^##\\s*/, '').startsWith(sectionHeading));
    if (start < 0) return [];
  }
  let headerAt = -1;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].startsWith('|')) { headerAt = i; break; }
    if (sectionHeading && i > start && lines[i].startsWith('## ')) break;
  }
  if (headerAt < 0) return [];
  const headers = lines[headerAt].split('|').slice(1, -1).map(x => x.trim());
  const rows = [];
  for (let i = headerAt + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i].split('|').slice(1, -1).map(x => x.trim());
    if (cells.length !== headers.length || !cells[0] || cells[0] === '—') continue;
    rows.push(Object.fromEntries(headers.map((key, index) => [key, cells[index]])));
  }
  return rows;
}
function archivePathExists(rel, expectedFile) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) return false;
  const absolute = path.resolve(ROOT, rel);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return fs.existsSync(absolute) && (!expectedFile || fs.existsSync(path.join(absolute, expectedFile)));
}
function validateTaskArchives() {
  const active = markdownTable(layout.tasks_index ?? '.spec/tasks/index.md', '已归档波次');
  const catalog = markdownTable('.spec/tasks/archive/INDEX.md');
  const activeById = new Map(), catalogById = new Map();
  for (const row of active) {
    const id = row['波次'];
    if (activeById.has(id)) errors.push(`任务归档：活跃索引中波次 ${id} 重复`);
    activeById.set(id, row);
  }
  for (const row of catalog) {
    const id = row['波次'];
    if (catalogById.has(id)) errors.push(`任务归档：归档索引中波次 ${id} 重复`);
    catalogById.set(id, row);
  }
  for (const [id, row] of activeById) {
    const archived = catalogById.get(id);
    if (!archived) { errors.push(`任务归档：波次 ${id} 未登记到 archive/INDEX.md`); continue; }
    const activePathRaw = row['详情'] ?? '';
    const catalogPathRaw = archived['目录'] ?? '';
    const activePath = activePathRaw.endsWith('/') ? activePathRaw.slice(0, -1) : activePathRaw;
    const catalogPath = catalogPathRaw.endsWith('/') ? catalogPathRaw.slice(0, -1) : catalogPathRaw;
    if (!catalogPath || activePath !== catalogPath) errors.push(`任务归档：波次 ${id} 的目录指针不一致`);
    if (!archivePathExists(catalogPath)) { errors.push(`任务归档：波次 ${id} 的归档目录不存在或路径非法`); continue; }
    const dir = path.join(ROOT, catalogPath);
    const taskDirs = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
    const declared = Number(archived['任务数']);
    if (!Number.isInteger(declared) || declared !== taskDirs.length || Number(row['卡数']) !== taskDirs.length) {
      errors.push(`任务归档：波次 ${id} 任务数与目录内容不一致`);
    }
    for (const taskId of taskDirs) {
      for (const file of ['card.md', 'log.md']) {
        if (!fs.existsSync(path.join(dir, taskId, file))) errors.push(`任务归档：${id}/${taskId}/ 缺少 ${file}`);
      }
    }
  }
  for (const id of catalogById.keys()) if (!activeById.has(id)) errors.push(`任务归档：archive/INDEX.md 中波次 ${id} 未在任务索引登记`);
}
function validateRoadmapArchives() {
  const active = markdownTable(layout.roadmap_index ?? '.spec/roadmap/INDEX.md', '已归档里程碑');
  const catalog = markdownTable('.spec/roadmap/archive/INDEX.md');
  const activeById = new Map(), catalogById = new Map();
  for (const row of active) {
    const id = row['ID'];
    if (activeById.has(id)) errors.push(`里程碑归档：索引中 ID ${id} 重复`);
    activeById.set(id, row);
  }
  for (const row of catalog) {
    const id = row['ID'];
    if (catalogById.has(id)) errors.push(`里程碑归档：归档索引中 ID ${id} 重复`);
    catalogById.set(id, row);
  }
  for (const [id, row] of activeById) {
    const archived = catalogById.get(id);
    if (!archived) { errors.push(`里程碑归档：ID ${id} 未登记到 archive/INDEX.md`); continue; }
    if (row['里程碑'] !== archived['里程碑']) errors.push(`里程碑归档：ID ${id} 的名称不一致`);
    if (!archivePathExists(archived['目录'], 'milestone.md')) errors.push(`里程碑归档：ID ${id} 的目录或 milestone.md 不存在`);
  }
  for (const id of catalogById.keys()) if (!activeById.has(id)) errors.push(`里程碑归档：archive/INDEX.md 中 ID ${id} 未在路线图索引登记`);
}
if (capabilityEnabled('task_tracking')) validateTaskArchives();
if (capabilityEnabled('roadmap')) validateRoadmapArchives();

// 6. Generated board freshness
const taskIndex=path.join(ROOT,layout.tasks_index??'.spec/tasks/index.md'), board=path.join(ROOT,'.spec/tasks/BOARD.md');
if(capabilityEnabled('task_tracking')&&fs.existsSync(taskIndex)&&fs.existsSync(board)){const hash=crypto.createHash('sha256').update(fs.readFileSync(taskIndex)).digest('hex');const b=fs.readFileSync(board,'utf8');const sourceOk=b.includes(`<!-- SOURCE-SHA256: ${hash} -->`);const generated=b.match(/<!-- GENERATED-SHA256: ([a-f0-9]+) -->\r?\n([\s\S]*?)<!-- GENERATED:END -->/);const bodyOk=generated&&crypto.createHash('sha256').update(generated[2]).digest('hex')===generated[1];if(!sourceOk||!bodyOk)errors.push('.spec/tasks/BOARD.md 已过期或被手工修改，请运行 node scripts/generate-board.cjs');}

const profileValidation = require('./profile-validator.cjs').validateProfile(ROOT);
for (const warning of profileValidation.warnings) notes.push(warning);
for (const error of profileValidation.errors) errors.push(error);

console.log(`\n治理检查  ${projectName}\n`);
for(const n of notes)console.log(`  · ${n}`);if(!errors.length){console.log('\n  ✅ 全部通过\n');process.exit(0);}console.log(`\n  ❌ ${errors.length} 项违规：\n`);for(const e of errors)console.log(`  - ${e}`);console.log('');process.exit(1);
