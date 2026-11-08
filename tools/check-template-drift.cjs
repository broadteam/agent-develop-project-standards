#!/usr/bin/env node
'use strict';

/**
 * Read-only comparison between an installed project and a standards checkout.
 * This tool never writes, merges, or upgrades project files.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MARKER = '.agent-standards.json';
const BLOCK_START = '# >>> agent-project-standards (managed)';
const BLOCK_END = '# <<< agent-project-standards (managed)';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function resolveInside(root, rel, label) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) {
    throw new Error(label + ' 必须是项目内相对路径：' + rel);
  }
  const absolute = path.resolve(root, rel);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(label + ' 越出允许目录：' + rel);
  }
  return absolute;
}
function regularFileHash(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return { exists: false, hash: null };
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return { exists: true, unsafe: true, hash: null };
  return { exists: true, unsafe: false, hash: sha256(fs.readFileSync(file)) };
}
function walkTemplateFiles(templateRoot, rel = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(templateRoot, rel), { withFileTypes: true })) {
    const relative = path.posix.join(rel.split(path.sep).join('/'), entry.name);
    const absolute = path.join(templateRoot, relative);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkTemplateFiles(templateRoot, relative));
    else if (entry.isFile() && relative !== '.gitignore.append') {
      files.push({ target: relative, source: 'template/' + relative });
    }
  }
  return files;
}
function classifyFile(targetRoot, standardsRoot, targetPath, entry, currentVersion) {
  const sourcePath = resolveInside(standardsRoot, entry.source, '模板源路径');
  const projectPath = resolveInside(targetRoot, targetPath, '项目目标路径');
  const baselineTemplate = entry.template_sha256;
  const baselineInstalled = entry.installed_sha256;
  if (!/^[a-f0-9]{64}$/.test(baselineTemplate || '') || !/^[a-f0-9]{64}$/.test(baselineInstalled || '')) {
    throw new Error('安装基线哈希无效：' + targetPath);
  }
  const source = regularFileHash(sourcePath);
  const installed = regularFileHash(projectPath);
  if (source.unsafe) return { path: targetPath, status: 'upstream_unsafe', detail: '当前模板源不是普通文件' };
  if (installed.unsafe) return { path: targetPath, status: 'local_unsafe', detail: '项目目标不是普通文件或是符号链接' };
  if (!source.exists) {
    return { path: targetPath, status: 'upstream_removed', local_changed: installed.exists && installed.hash !== baselineInstalled };
  }
  if (!installed.exists) return { path: targetPath, status: 'local_missing', upstream_changed: source.hash !== baselineTemplate };
  const upstreamChanged = source.hash !== baselineTemplate;
  const localChanged = installed.hash !== baselineInstalled
    || (entry.installed_mode !== undefined && installed.mode !== entry.installed_mode);
  const customizedAtBaseline = entry.customized_at_baseline === true;
  let status = 'current';
  if (upstreamChanged && (localChanged || customizedAtBaseline)) status = 'conflict';
  else if (upstreamChanged) status = 'update_available';
  else if (localChanged) status = 'local_customized';
  else if (customizedAtBaseline) status = 'accepted_customization';
  return {
    path: targetPath,
    status,
    upstream_changed: upstreamChanged,
    local_changed: localChanged,
    baseline_version: entry.template_version ?? null,
    current_version: currentVersion
  };
}
function extractManagedBlock(file) {
  const value = regularFileHash(file);
  if (!value.exists || value.unsafe) return value;
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start < 0 || end < start || text.indexOf(BLOCK_START, start + BLOCK_START.length) >= 0
    || text.indexOf(BLOCK_END, end + BLOCK_END.length) >= 0) {
    return { exists: true, unsafe: false, malformed: true, hash: null };
  }
  return { exists: true, unsafe: false, malformed: false, hash: sha256(text.slice(start, end + BLOCK_END.length)) };
}
function classifyManagedBlock(targetRoot, standardsRoot, targetPath, entry, currentVersion) {
  const sourcePath = resolveInside(standardsRoot, entry.source, '托管区块源路径');
  const projectPath = resolveInside(targetRoot, targetPath, '托管区块目标路径');
  if (!/^[a-f0-9]{64}$/.test(entry.template_sha256 || '') || !/^[a-f0-9]{64}$/.test(entry.installed_sha256 || '')) {
    throw new Error('托管区块基线哈希无效：' + targetPath);
  }
  const source = regularFileHash(sourcePath);
  const installed = extractManagedBlock(projectPath);
  if (source.unsafe || installed.unsafe) return { path: targetPath, status: 'unsafe' };
  if (!source.exists) return { path: targetPath, status: 'upstream_removed' };
  if (!installed.exists) return { path: targetPath, status: 'local_missing' };
  if (installed.malformed) return { path: targetPath, status: 'managed_block_malformed' };
  const upstreamChanged = source.hash !== entry.template_sha256;
  const localChanged = installed.hash !== entry.installed_sha256;
  return {
    path: targetPath,
    status: upstreamChanged && localChanged ? 'conflict'
      : upstreamChanged ? 'update_available'
        : localChanged ? 'local_customized' : 'current',
    upstream_changed: upstreamChanged,
    local_changed: localChanged,
    baseline_version: entry.template_version ?? null,
    current_version: currentVersion
  };
}
function readCurrentVersion(standardsRoot) {
  const file = path.join(standardsRoot, 'template/policy/standards-version.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.schema_version !== 1 || typeof value.version !== 'string') throw new Error('模板版本文件无效');
  return value.version;
}
function analyzeDrift({ projectRoot, standardsRoot }) {
  const targetRoot = path.resolve(projectRoot);
  const sourceRoot = path.resolve(standardsRoot);
  const manifestPath = path.join(targetRoot, MARKER);
  const manifestFile = regularFileHash(manifestPath);
  if (!manifestFile.exists) {
    return {
      ok: false,
      reason: 'baseline_missing',
      current_version: readCurrentVersion(sourceRoot),
      findings: [],
      preserved_paths: [],
      summary: { current: 0, update_available: 0, local_customized: 0, conflict: 0, other: 0 }
    };
  }
  if (manifestFile.unsafe) throw new Error(MARKER + ' 必须是普通文件，拒绝跟随符号链接');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format_version !== 1 || !manifest.managed_files || typeof manifest.managed_files !== 'object'
    || Array.isArray(manifest.managed_files)) throw new Error(MARKER + ' 格式不受支持或已损坏');
  const currentVersion = readCurrentVersion(sourceRoot);
  const templateRoot = path.join(sourceRoot, 'template');
  const currentFiles = walkTemplateFiles(templateRoot);
  const tracked = manifest.managed_files;
  const derived = new Set(manifest.derived_paths ?? []);
  const excluded = new Set(manifest.excluded_paths ?? []);
  const preserved = new Set(manifest.preserved_paths ?? []);
  const findings = [];

  for (const [targetPath, entry] of Object.entries(tracked)) {
    if (!entry || typeof entry !== 'object') throw new Error('安装基线条目无效：' + targetPath);
    findings.push(classifyFile(targetRoot, sourceRoot, targetPath, entry, currentVersion));
  }
  for (const [targetPath, entry] of Object.entries(manifest.managed_blocks ?? {})) {
    if (!entry || typeof entry !== 'object') throw new Error('托管区块基线条目无效：' + targetPath);
    findings.push(classifyManagedBlock(targetRoot, sourceRoot, targetPath, entry, currentVersion));
  }

  for (const file of currentFiles) {
    if (tracked[file.target] || derived.has(file.target) || excluded.has(file.target)) continue;
    const absolute = resolveInside(targetRoot, file.target, '新模板文件路径');
    const installed = regularFileHash(absolute);
    if (installed.unsafe) findings.push({ path: file.target, status: 'local_unsafe', detail: '目标为符号链接或非普通文件' });
    else if (installed.exists && preserved.has(file.target)) findings.push({ path: file.target, status: 'legacy_preserved', detail: '安装时保留的既有文件，缺少可比较的历史基线' });
    else if (installed.exists) findings.push({ path: file.target, status: 'untracked_collision', detail: '目标已存在但不在安装基线中，需人工判断归属' });
    else findings.push({ path: file.target, status: 'new_upstream_file', detail: '当前模板新增文件，尚未安装' });
  }

  const summary = { current: 0, accepted_customization: 0, update_available: 0, local_customized: 0, conflict: 0, other: 0 };
  for (const finding of findings) {
    if (Object.prototype.hasOwnProperty.call(summary, finding.status)) summary[finding.status]++;
    else summary.other++;
  }
  const baselineIncomplete = manifest.baseline_state !== 'complete';
  return {
    ok: findings.every(item => item.status === 'current' || item.status === 'accepted_customization') && !baselineIncomplete,
    current_version: currentVersion,
    installed_with_version: manifest.installed_with_version ?? null,
    baseline_state: manifest.baseline_state ?? 'unknown',
    baseline_incomplete: baselineIncomplete,
    findings,
    preserved_paths: [...preserved].sort(),
    summary
  };
}
function renderText(result) {
  const labels = {
    current: '一致',
    accepted_customization: '已审查并接受的项目定制',
    update_available: '上游有更新',
    local_customized: '项目本地已修改',
    conflict: '双向冲突（必须人工合并）',
    upstream_removed: '上游已移除',
    local_missing: '项目文件缺失',
    legacy_preserved: '旧项目保留文件（基线未知）',
    untracked_collision: '未登记的同名文件',
    new_upstream_file: '新增模板文件',
    local_unsafe: '项目目标不安全',
    upstream_unsafe: '模板源不安全',
    unsafe: '托管区块路径不安全',
    managed_block_malformed: '.gitignore 托管区块损坏'
  };
  const lines = [
    '规范模板漂移检查',
    '当前模板版本：' + (result.current_version ?? 'unknown'),
    '项目安装版本：' + (result.installed_with_version ?? 'unknown'),
    '安装基线：' + (result.baseline_state ?? 'missing')
  ];
  if (result.reason === 'baseline_missing') {
    lines.push('未找到 ' + MARKER + '。这是旧版/未登记项目，无法可靠区分上游修改与项目定制。');
    lines.push('请先备份并审查差异；本工具不会自动创建基线或覆盖文件。');
    return lines.join('\n');
  }
  if (result.baseline_incomplete) lines.push('警告：安装时存在未纳入基线的既有文件；这些文件必须人工核对。');
  for (const item of result.findings) {
    if (item.status === 'current' || item.status === 'accepted_customization') continue;
    lines.push('- ' + item.path + ': ' + (labels[item.status] ?? item.status) + (item.detail ? '（' + item.detail + '）' : ''));
  }
  lines.push('汇总：一致 ' + result.summary.current + '；已接受定制 ' + result.summary.accepted_customization + '；上游更新 ' + result.summary.update_available + '；本地修改 ' + result.summary.local_customized + '；双向冲突 ' + result.summary.conflict + '；其他 ' + result.summary.other);
  lines.push(result.ok ? '结果：无漂移。' : '结果：存在差异；本工具只报告，不写入或合并文件。');
  return lines.join('\n');
}
function parseArgs(argv) {
  const result = { root: null, standardsRoot: path.resolve(__dirname, '..'), json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) result.root = argv[++i];
    else if (argv[i] === '--standards-root' && argv[i + 1]) result.standardsRoot = argv[++i];
    else if (argv[i] === '--json') result.json = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/check-template-drift.cjs --root <项目目录> [--standards-root <规范仓库目录>] [--json]');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!result.root) throw new Error('必须指定 --root <项目目录>');
  return result;
}
function main(argv) {
  const args = parseArgs(argv);
  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) throw new Error('项目目录不存在：' + args.root);
  const result = analyzeDrift({ projectRoot: args.root, standardsRoot: args.standardsRoot });
  console.log(args.json ? JSON.stringify(result, null, 2) : renderText(result));
  if (result.reason === 'baseline_missing') return 2;
  return result.ok ? 0 : 1;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[template-drift] ' + error.message); process.exitCode = 2; }
}
module.exports = { analyzeDrift, renderText, readCurrentVersion };
