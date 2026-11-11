#!/usr/bin/env node
'use strict';

/**
 * Explicitly records a reviewed baseline for an existing project.
 * Only .agent-standards.json is written; project rules and code are untouched.
 * A dry-run plan ID binds confirmation to the exact project + template snapshot.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildTemplateSourceInventory } = require('./template-source-inventory.cjs');

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
function hashRegularFileWithin(root, rel, label) {
  const absolute = safePath(root, rel);
  const relative = path.relative(root, absolute);
  const parts = relative.split(path.sep).filter(Boolean);
  let cursor = root;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    let stat;
    try { stat = fs.lstatSync(cursor); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (stat.isSymbolicLink()) throw new Error(label + ' 路径包含符号链接：' + rel);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(label + ' 父路径不是目录：' + rel);
    if (i === parts.length - 1 && !stat.isFile()) throw new Error(label + ' 不是普通文件：' + rel);
    if (i === parts.length - 1) return { hash: sha256(fs.readFileSync(cursor)), mode: stat.mode & 0o777 };
  }
  return null;
}
function collectTemplateFiles(templateRoot, rel = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(templateRoot, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const sourceRel = path.posix.join(rel.split(path.sep).join('/'), entry.name);
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
    if (previous.format_version !== 1 || !previous.managed_files || typeof previous.managed_files !== 'object'
      || Array.isArray(previous.managed_files) || !Array.isArray(previous.preserved_paths)) {
      throw new Error(MARKER + ' 格式无效；拒绝覆盖');
    }
  }

  const sourceInventory = buildTemplateSourceInventory(sourceRoot);
  const version = readVersion(sourceRoot);
  const managedFiles = { ...(previous?.managed_files ?? {}) };
  const preserved = new Set(previous?.preserved_paths ?? []);
  const derived = new Set(previous?.derived_paths ?? []);
  const excluded = new Set(previous?.excluded_paths ?? []);
  const adopted = [];
  const reviewInputs = [];

  function capture(sourceRel, targetRel) {
    const sourceInfo = hashRegularFileWithin(sourceRoot, sourceRel, '模板源');
    const targetInfo = hashRegularFileWithin(root, targetRel, '项目目标');
    reviewInputs.push({
      source: sourceRel,
      target: targetRel,
      source_sha256: sourceInfo?.hash ?? null,
      source_mode: sourceInfo?.mode ?? null,
      target_sha256: targetInfo?.hash ?? null,
      target_mode: targetInfo?.mode ?? null
    });
    return { sourceInfo, targetInfo };
  }

  for (const sourceRel of collectTemplateFiles(path.join(sourceRoot, 'template'))) {
    const targetRel = sourceRel;
    const { sourceInfo, targetInfo } = capture('template/' + sourceRel, targetRel);
    if (!sourceInfo || !targetInfo || derived.has(targetRel) || excluded.has(targetRel)
      || targetRel === '.spec/tasks/BOARD.md' || managedFiles[targetRel]) continue;
    managedFiles[targetRel] = {
      source: 'template/' + sourceRel,
      template_sha256: sourceInfo.hash,
      installed_sha256: targetInfo.hash,
      installed_mode: targetInfo.mode,
      template_version: version,
      customized_at_baseline: targetInfo.hash !== sourceInfo.hash
    };
    preserved.delete(targetRel);
    adopted.push(targetRel);
  }

  // Optional stack presets live outside template/ but are installed into .spec/stacks/.
  const presetsRoot = path.join(sourceRoot, 'presets/stacks');
  if (fs.existsSync(presetsRoot)) {
    for (const name of fs.readdirSync(presetsRoot).sort()) {
      if (!name.endsWith('.md')) continue;
      const targetRel = '.spec/stacks/' + name;
      const sourceRel = 'presets/stacks/' + name;
      const { sourceInfo, targetInfo } = capture(sourceRel, targetRel);
      if (!sourceInfo || !targetInfo || managedFiles[targetRel]) continue;
      managedFiles[targetRel] = {
        source: sourceRel,
        template_sha256: sourceInfo.hash,
        installed_sha256: targetInfo.hash,
        installed_mode: targetInfo.mode,
        template_version: version,
        customized_at_baseline: targetInfo.hash !== sourceInfo.hash
      };
      preserved.delete(targetRel);
      adopted.push(targetRel);
    }
  }

  // The full .gitignore file is included in the review snapshot conservatively, while only the
  // managed block is recorded in the baseline metadata.
  const { targetInfo: ignoreInfo, sourceInfo: ignoreSourceInfo } = capture('template/.gitignore.append', '.gitignore');
  if (ignoreInfo && ignoreSourceInfo) {
    const ignoreFile = path.join(root, '.gitignore');
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
        template_version: version,
        customized_at_baseline: true
      };
      previous = { ...(previous ?? {}), managed_blocks: managedBlocks };
    }
  }

  reviewInputs.sort((a, b) => a.target.localeCompare(b.target) || a.source.localeCompare(b.source));
  const remainingPreserved = [...preserved].filter(rel => rel !== '.githooks/pre-commit').sort();
  const manifest = {
    format_version: 1,
    installed_with_version: version,
    baseline_state: remainingPreserved.length ? 'partial_unknown' : 'complete',
    managed_files: Object.fromEntries(Object.entries(managedFiles).sort(([a], [b]) => a.localeCompare(b))),
    managed_blocks: previous?.managed_blocks ?? {},
    preserved_paths: remainingPreserved,
    derived_paths: [...derived].sort(),
    excluded_paths: [...excluded].sort(),
    baseline_adopted_after_review: true
  };
  const reviewSnapshot = {
    plan_schema: 1,
    source_version: version,
    source_inventory_sha256: sourceInventory.sha256,
    manifest_sha256: prior?.hash ?? null,
    manifest_mode: prior?.mode ?? null,
    review_inputs: reviewInputs,
    adopted: adopted.sort(),
    remaining_preserved: remainingPreserved
  };
  const snapshotSha256 = sha256(Buffer.from(JSON.stringify(reviewSnapshot), 'utf8'));
  return {
    manifest,
    adopted: adopted.sort(),
    remaining_preserved: remainingPreserved,
    source_inventory_sha256: sourceInventory.sha256,
    review_snapshot_sha256: snapshotSha256,
    plan_id: snapshotSha256.slice(0, 16)
  };
}
function parseArgs(argv) {
  const args = { root: null, standardsRoot: path.resolve(__dirname, '..'), dryRun: false, confirm: false, expectPlanId: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (argv[i] === '--standards-root' && argv[i + 1]) args.standardsRoot = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--confirm-reviewed') args.confirm = true;
    else if (argv[i] === '--expect-plan-id' && argv[i + 1]) args.expectPlanId = argv[++i];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/adopt-template-baseline.cjs --root <项目目录> --dry-run [--standards-root <规范仓库>] [--json]');
      console.log('审查预览中的 plan_id 后确认：node tools/adopt-template-baseline.cjs --root <项目目录> --expect-plan-id <plan_id> --confirm-reviewed');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!args.root) throw new Error('必须指定 --root <项目目录>');
  if (args.dryRun === args.confirm) throw new Error('必须且只能指定 --dry-run 或 --confirm-reviewed');
  if (args.confirm && !/^[a-f0-9]{16}$/.test(args.expectPlanId ?? '')) {
    throw new Error('确认基线必须提供 dry-run 输出的 --expect-plan-id <16 位 plan_id>');
  }
  if (args.dryRun && args.expectPlanId) throw new Error('--expect-plan-id 只能与 --confirm-reviewed 一起使用');
  return args;
}
function writeManifestAtomic(markerPath, manifest, mode) {
  const temp = markerPath + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', mode ?? 0o644);
    fs.writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, markerPath);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}
function main(argv) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root);
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('项目根目录必须是真实目录');
  const result = buildBaseline({ projectRoot: root, standardsRoot: args.standardsRoot });
  const output = {
    ok: true,
    mode: args.dryRun ? 'dry_run' : 'recorded',
    plan_id: result.plan_id,
    source_inventory_sha256: result.source_inventory_sha256,
    review_snapshot_sha256: result.review_snapshot_sha256,
    adopted_count: result.adopted.length,
    adopted: result.adopted,
    remaining_preserved: result.remaining_preserved,
    baseline_state: result.manifest.baseline_state,
    manifest_written: false
  };
  if (args.dryRun) {
    console.log(args.json ? JSON.stringify(output, null, 2) : [
      '旧项目安装基线采纳预览（只读）',
      'Plan ID：' + result.plan_id,
      '来源模板快照 SHA-256：' + result.source_inventory_sha256,
      '可登记文件：' + result.adopted.length,
      '未知归属保留路径：' + result.remaining_preserved.length,
      '未写入任何文件；人工审查后使用 --expect-plan-id ' + result.plan_id + ' --confirm-reviewed。'
    ].join('\n'));
    return 0;
  }

  if (result.plan_id !== args.expectPlanId) {
    throw new Error('项目文件、安装清单或模板源自 dry-run 后发生变化；拒绝采纳，请重新 dry-run 并复核新的 plan_id。');
  }
  // Rebuild once more immediately before writing. This is optimistic snapshot validation, not an
  // OS-level lock; concurrent editors should still pause while baseline adoption is confirmed.
  const current = buildBaseline({ projectRoot: root, standardsRoot: args.standardsRoot });
  if (current.plan_id !== args.expectPlanId) {
    throw new Error('确认前项目或模板快照再次变化；拒绝写入，请重新 dry-run 并复核。');
  }
  const markerPath = path.join(root, MARKER);
  writeManifestAtomic(markerPath, result.manifest, current.manifest_mode);
  output.mode = 'recorded';
  output.manifest_written = true;
  console.log(args.json ? JSON.stringify(output, null, 2) : [
    '已登记人工审查的旧项目安装基线',
    'Plan ID：' + result.plan_id,
    '登记文件：' + result.adopted.length,
    '仍未识别的保留路径：' + result.remaining_preserved.length,
    '基线状态：' + result.manifest.baseline_state,
    '只写入 .agent-standards.json；项目规则文件未修改。'
  ].join('\n'));
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[adopt-template-baseline] ' + error.message); process.exitCode = 2; }
}
module.exports = { buildBaseline, parseArgs, writeManifestAtomic };
