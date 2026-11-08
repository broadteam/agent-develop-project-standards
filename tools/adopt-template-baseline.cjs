#!/usr/bin/env node
'use strict';

/**
 * Explicitly records a reviewed baseline for an existing project.
 * Only .agent-standards.json is written; project rules and code are untouched.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const START = '# >>> agent-project-standards (managed)';
const END = '# <<< agent-project-standards (managed)';
const MARKER = '.agent-standards.json';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function safePath(root, rel) {
  if (!rel || path.isAbsolute(rel)) throw new Error('路径必须是项目内相对路径：' + rel);
  const absolute = path.resolve(root, rel);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('路径越界：' + rel);
  return absolute;
}
function hashRegularFile(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('拒绝将非普通文件纳入基线：' + file);
  return { hash: sha256(fs.readFileSync(file)), mode: stat.mode & 0o777 };
}
function collectTemplateFiles(templateRoot, rel = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(templateRoot, rel), { withFileTypes: true })) {
    const sourceRel = path.posix.join(rel.split(path.sep).join('/'), entry.name);
    const full = path.join(templateRoot, sourceRel);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...collectTemplateFiles(templateRoot, sourceRel));
    else if (entry.isFile() && sourceRel !== '.gitignore.append') files.push(sourceRel);
  }
  return files;
}
function readVersion(standardsRoot) {
  const value = JSON.parse(fs.readFileSync(path.join(standardsRoot, 'template/policy/standards-version.json'), 'utf8'));
  if (value.schema_version !== 1 || typeof value.version !== 'string') throw new Error('模板版本文件无效');
  return value.version;
}
function buildBaseline({ projectRoot, standardsRoot }) {
  const root = path.resolve(projectRoot);
  const sourceRoot = path.resolve(standardsRoot);
  const markerPath = path.join(root, MARKER);
  const prior = hashRegularFile(markerPath);
  let previous = null;
  if (prior) {
    previous = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (previous.format_version !== 1 || !previous.managed_files || typeof previous.managed_files !== 'object' || Array.isArray(previous.managed_files)) {
      throw new Error(MARKER + ' 格式无效；拒绝覆盖');
    }
  }

  const managedFiles = { ...(previous?.managed_files ?? {}) };
  const preserved = new Set(previous?.preserved_paths ?? []);
  const derived = new Set(previous?.derived_paths ?? []);
  const excluded = new Set(previous?.excluded_paths ?? []);
  const adopted = [];
  const skipped = [];

  for (const sourceRel of collectTemplateFiles(path.join(sourceRoot, 'template'))) {
    const source = path.join(sourceRoot, 'template', sourceRel);
    const targetRel = sourceRel;
    if (derived.has(targetRel) || excluded.has(targetRel) || targetRel === '.spec/tasks/BOARD.md') continue;
    if (managedFiles[targetRel]) continue;
    const target = safePath(root, targetRel);
    const targetInfo = hashRegularFile(target);
    if (!targetInfo) continue;
    const sourceInfo = hashRegularFile(source);
    if (!sourceInfo) continue;
    managedFiles[targetRel] = {
      source: 'template/' + sourceRel,
      template_sha256: sourceInfo.hash,
      installed_sha256: targetInfo.hash,
      installed_mode: targetInfo.mode,
      template_version: readVersion(sourceRoot),
      customized_at_baseline: targetInfo.hash !== sourceInfo.hash
    };
    preserved.delete(targetRel);
    adopted.push(targetRel);
  }

  // Optional stack presets live outside template/ but are installed into .spec/stacks/.
  const presetsRoot = path.join(sourceRoot, 'presets/stacks');
  if (fs.existsSync(presetsRoot)) {
    for (const name of fs.readdirSync(presetsRoot)) {
      if (!name.endsWith('.md')) continue;
      const targetRel = '.spec/stacks/' + name;
      if (managedFiles[targetRel]) continue;
      const sourceRel = 'presets/stacks/' + name;
      const source = path.join(sourceRoot, sourceRel);
      const target = safePath(root, targetRel);
      const targetInfo = hashRegularFile(target);
      if (!targetInfo) continue;
      const sourceInfo = hashRegularFile(source);
      if (!sourceInfo) continue;
      managedFiles[targetRel] = {
        source: sourceRel,
        template_sha256: sourceInfo.hash,
        installed_sha256: targetInfo.hash,
        installed_mode: targetInfo.mode,
        template_version: readVersion(sourceRoot),
        customized_at_baseline: targetInfo.hash !== sourceInfo.hash
      };
      preserved.delete(targetRel);
      adopted.push(targetRel);
    }
  }

  const ignoreFile = path.join(root, '.gitignore');
  const ignoreInfo = hashRegularFile(ignoreFile);
  const ignoreSource = path.join(sourceRoot, 'template/.gitignore.append');
  const ignoreSourceInfo = hashRegularFile(ignoreSource);
  if (ignoreInfo && ignoreSourceInfo) {
    const text = fs.readFileSync(ignoreFile, 'utf8');
    const start = text.indexOf(START);
    const end = text.indexOf(END);
    const duplicateStart = start >= 0 && text.indexOf(START, start + START.length) >= 0;
    const duplicateEnd = end >= 0 && text.indexOf(END, end + END.length) >= 0;
    if (start >= 0 && end >= start && !duplicateStart && !duplicateEnd) {
      const block = text.slice(start, end + END.length);
      const managedBlocks = { ...(previous?.managed_blocks ?? {}) };
      managedBlocks['.gitignore'] = {
        source: 'template/.gitignore.append',
        template_sha256: ignoreSourceInfo.hash,
        installed_sha256: sha256(block),
        template_version: readVersion(sourceRoot),
        customized_at_baseline: true
      };
      previous = { ...(previous ?? {}), managed_blocks: managedBlocks };
    }
  }

  const remainingPreserved = [...preserved].filter(rel => rel !== '.githooks/pre-commit').sort();
  const manifest = {
    format_version: 1,
    installed_with_version: readVersion(sourceRoot),
    baseline_state: remainingPreserved.length ? 'partial_unknown' : 'complete',
    managed_files: Object.fromEntries(Object.entries(managedFiles).sort(([a], [b]) => a.localeCompare(b))),
    managed_blocks: previous?.managed_blocks ?? {},
    preserved_paths: remainingPreserved,
    derived_paths: [...derived].sort(),
    excluded_paths: [...excluded].sort(),
    baseline_adopted_after_review: true
  };
  return { manifest, adopted: adopted.sort(), remaining_preserved: remainingPreserved };
}
function parseArgs(argv) {
  const args = { root: null, standardsRoot: path.resolve(__dirname, '..'), dryRun: false, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (argv[i] === '--standards-root' && argv[i + 1]) args.standardsRoot = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--confirm-reviewed') args.confirm = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/adopt-template-baseline.cjs --root <项目目录> --dry-run');
      console.log('审查差异并确认后：node tools/adopt-template-baseline.cjs --root <项目目录> --confirm-reviewed');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!args.root) throw new Error('必须指定 --root <项目目录>');
  if (!args.dryRun && !args.confirm) throw new Error('写入基线必须显式指定 --confirm-reviewed；建议先执行 --dry-run');
  if (args.dryRun && args.confirm) throw new Error('--dry-run 与 --confirm-reviewed 不能同时使用');
  return args;
}
function main(argv) {
  const args = parseArgs(argv);
  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) throw new Error('项目目录不存在');
  const result = buildBaseline({ projectRoot: args.root, standardsRoot: args.standardsRoot });
  console.log('可登记为已审查基线的文件：' + result.adopted.length);
  for (const file of result.adopted) console.log('  - ' + file);
  console.log('仍未识别的保留路径：' + result.remaining_preserved.length);
  for (const file of result.remaining_preserved) console.log('  - ' + file);
  if (args.dryRun) {
    console.log('预览完成，未写入任何文件。');
    return 0;
  }
  const markerPath = path.join(path.resolve(args.root), MARKER);
  const temp = markerPath + '.tmp-' + process.pid;
  fs.writeFileSync(temp, JSON.stringify(result.manifest, null, 2) + '\n', { flag: 'wx' });
  try { fs.renameSync(temp, markerPath); }
  catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
  console.log('已更新 .agent-standards.json；项目规则文件未被修改。');
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[adopt-template-baseline] ' + error.message); process.exitCode = 2; }
}
module.exports = { buildBaseline };
