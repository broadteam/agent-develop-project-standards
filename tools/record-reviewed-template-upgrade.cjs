#!/usr/bin/env node
'use strict';

/**
 * Records a reviewed, already-applied template upgrade into .agent-standards.json.
 *
 * This tool does NOT apply template files. It validates the saved plan/review,
 * verifies the actual project bytes, then atomically advances only manifest
 * metadata. It never copies, deletes, merges or edits project rule files.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateReview } = require('./validate-template-upgrade-review.cjs');
const { buildTemplateSourceInventory } = require('./template-source-inventory.cjs');

const MARKER = '.agent-standards.json';
const BLOCK_START = '# >>> agent-project-standards (managed)';
const BLOCK_END = '# <<< agent-project-standards (managed)';
const HASH_RE = /^[a-f0-9]{64}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function assertRealDirectory(dir, label) {
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(label + ' 必须是真实目录，不能是符号链接：' + dir);
  }
}
function resolveInside(root, rel, label) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) {
    throw new Error(label + ' 必须是根目录内相对路径：' + rel);
  }
  const absolute = path.resolve(root, rel);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(label + ' 越出允许目录：' + rel);
  }
  return absolute;
}
function inspectWithin(root, rel, label) {
  const absolute = resolveInside(root, rel, label);
  const relative = path.relative(root, absolute);
  const parts = relative.split(path.sep).filter(Boolean);
  let cursor = root;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    let stat;
    try { stat = fs.lstatSync(cursor); }
    catch (error) {
      if (error.code === 'ENOENT') return { exists: false, hash: null, mode: null, absolute };
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(label + ' 路径包含符号链接：' + rel);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(label + ' 父路径不是目录：' + rel);
    if (i === parts.length - 1 && !stat.isFile()) throw new Error(label + ' 不是普通文件：' + rel);
    if (i === parts.length - 1) {
      const bytes = fs.readFileSync(cursor);
      return { exists: true, hash: sha256(bytes), mode: stat.mode & 0o777, bytes, absolute };
    }
  }
  return { exists: false, hash: null, mode: null, absolute };
}
function inspectExternalFile(file, label) {
  const absolute = path.resolve(file);
  const root = path.parse(absolute).root;
  const relative = path.relative(root, absolute);
  const parts = relative.split(path.sep).filter(Boolean);
  let cursor = root;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(label + ' 路径包含符号链接：' + file);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(label + ' 父路径不是目录：' + file);
    if (i === parts.length - 1 && !stat.isFile()) throw new Error(label + ' 必须是普通文件：' + file);
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}
function readManagedBlock(projectRoot) {
  const file = inspectWithin(projectRoot, '.gitignore', '项目 .gitignore');
  if (!file.exists) return { exists: false, hash: null, mode: null };
  const text = file.bytes.toString('utf8');
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start < 0 && end < 0) return { exists: false, hash: null, mode: file.mode };
  if (start < 0 || end < start
    || text.indexOf(BLOCK_START, start + BLOCK_START.length) >= 0
    || text.indexOf(BLOCK_END, end + BLOCK_END.length) >= 0) {
    throw new Error('.gitignore 托管区块标记重复或结构损坏');
  }
  return {
    exists: true,
    hash: sha256(Buffer.from(text.slice(start, end + BLOCK_END.length), 'utf8')),
    content: text.slice(start, end + BLOCK_END.length),
    mode: file.mode
  };
}
function readVersion(standardsRoot) {
  const file = inspectWithin(standardsRoot, 'template/policy/standards-version.json', '模板版本文件');
  if (!file.exists) throw new Error('模板版本文件不存在');
  const version = JSON.parse(file.bytes.toString('utf8'));
  if (version.schema_version !== 1 || typeof version.version !== 'string') {
    throw new Error('模板版本文件格式无效');
  }
  return version.version;
}
function readManifest(projectRoot) {
  const file = inspectWithin(projectRoot, MARKER, '安装基线文件');
  if (!file.exists) throw new Error('项目缺少 ' + MARKER);
  const manifest = JSON.parse(file.bytes.toString('utf8'));
  if (manifest.format_version !== 1 || !isObject(manifest.managed_files)
    || !Array.isArray(manifest.preserved_paths) || !Array.isArray(manifest.derived_paths ?? [])
    || !Array.isArray(manifest.excluded_paths ?? [])
    || !isObject(manifest.managed_blocks ?? {})) {
    throw new Error(MARKER + ' 格式无效或不受支持');
  }
  return { manifest, bytes: file.bytes, mode: file.mode };
}
function actionEntry(manifest, action) {
  const isManagedBlock = action.path === '.gitignore' && action.source === 'template/.gitignore.append';
  const table = isManagedBlock ? manifest.managed_blocks : manifest.managed_files;
  return { isManagedBlock, table, entry: table[action.path] ?? null };
}
function checkPlanBaseline(manifest, action, entry, isManagedBlock) {
  const evidence = action.evidence ?? {};
  if (entry) {
    if (entry.source !== action.source) {
      throw new Error(action.path + '：计划 source 与安装基线 source 不匹配，计划可能过期');
    }
    if (evidence.baseline_template_sha256 !== entry.template_sha256
      || evidence.baseline_installed_sha256 !== entry.installed_sha256
      || (evidence.baseline_version ?? null) !== (entry.template_version ?? null)
      || (evidence.baseline_installed_mode ?? null) !== (entry.installed_mode ?? null)) {
      throw new Error(action.path + '：计划共同基线与当前 manifest 不匹配，请重新生成计划');
    }
  } else if (evidence.baseline_template_sha256 || evidence.baseline_installed_sha256) {
    throw new Error(action.path + '：计划包含历史基线，但 manifest 中没有对应条目');
  }
}
function actionActual(projectRoot, action, isManagedBlock) {
  if (isManagedBlock) return readManagedBlock(projectRoot);
  return inspectWithin(projectRoot, action.path, '项目目标文件 ' + action.path);
}
function sourceActual(standardsRoot, action) {
  if (!action.source) return { exists: false, hash: null, mode: null };
  return inspectWithin(standardsRoot, action.source, '模板源文件 ' + action.source);
}
function requireDecision(decisions, action) {
  if (!action.requires_human_review) return null;
  const decision = decisions.get(action.path);
  if (!decision) throw new Error(action.path + '：缺少人工审批决策');
  return decision;
}
function verifyManagedBlockTemplateCompatibility(source, actual, targetPath) {
  if (!source.exists || !actual.exists || !Buffer.isBuffer(source.bytes) || typeof actual.content !== 'string') {
    throw new Error(targetPath + '：无法验证 .gitignore 托管区块的模板来源');
  }
  const sourceText = source.bytes.toString('utf8');
  const placeholder = '{{IGNORE_ENTRIES}}';
  const position = sourceText.indexOf(placeholder);
  if (position < 0 || sourceText.indexOf(placeholder, position + placeholder.length) >= 0) {
    throw new Error(targetPath + '：模板 .gitignore 源必须且只能包含一个 IGNORE_ENTRIES 占位符');
  }
  const prefix = sourceText.slice(0, position);
  const suffix = sourceText.slice(position + placeholder.length);
  const inner = actual.content.slice(BLOCK_START.length + 1, actual.content.length - BLOCK_END.length - 1);
  const requiredPrefix = prefix.replace(/^\s+/, '');
  const requiredSuffix = suffix.replace(/\s+$/, '');
  if (!inner.startsWith(requiredPrefix) || (requiredSuffix && !inner.endsWith(requiredSuffix))
    || inner.includes(placeholder)) {
    throw new Error(targetPath + '：托管区块不符合当前模板的固定结构；请重新渲染并审查区块');
  }
}
function verifyReviewedResult(action, decision, actual, source, isManagedBlock) {
  if (action.operation === 'review_removal' && decision.decision === 'approve_removal') {
    if (actual.exists) throw new Error(action.path + '：审批为 approve_removal，但项目文件/区块仍存在');
    if (source.exists) throw new Error(action.path + '：上游源仍存在，拒绝登记删除');
    return;
  }
  if (!actual.exists) throw new Error(action.path + '：目标文件/托管区块尚未按计划应用');
  if (!HASH_RE.test(decision.result_sha256 || '') || actual.hash !== decision.result_sha256) {
    throw new Error(action.path + '：实际内容哈希与审查记录 result_sha256 不匹配');
  }
  if (!isManagedBlock && (!Number.isInteger(decision.result_mode)
    || decision.result_mode < 0 || decision.result_mode > 0o777 || actual.mode !== decision.result_mode)) {
    throw new Error(action.path + '：实际文件权限与审查记录 result_mode 不匹配');
  }
  if (action.operation === 'replace_candidate' || action.operation === 'add_candidate' || action.operation === 'restore_candidate') {
    if (!source.exists) throw new Error(action.path + '：当前模板源已经不存在，计划已过期');
    if (isManagedBlock) {
      verifyManagedBlockTemplateCompatibility(source, actual, action.path);
    } else if (actual.hash !== source.hash) {
      throw new Error(action.path + '：目标内容必须与当前模板源完全一致；若是人工合并，应生成 manual_merge 决策');
    }
  }
  if (action.operation === 'review_removal' && decision.decision === 'keep_or_archive') {
    if (source.exists) throw new Error(action.path + '：上游源仍存在，不应登记为已接受移除');
  }
}
function assertPlannedProjectSnapshot(action, actual) {
  const evidence = action.evidence ?? {};
  const expectedHash = evidence.current_installed_sha256 ?? null;
  if (!actual.exists || expectedHash === null || actual.hash !== expectedHash) {
    throw new Error(action.path + '：项目文件内容已偏离计划快照；请重新生成计划和审批记录');
  }
  const expectedMode = evidence.current_installed_mode;
  if (expectedMode !== null && expectedMode !== undefined && actual.mode !== expectedMode) {
    throw new Error(action.path + '：项目文件权限已偏离计划快照；请重新生成计划和审批记录');
  }
}
function advanceEntry(action, actual, source, oldEntry, decision, version, isManagedBlock) {
  const entry = { ...(oldEntry ?? {}) };
  entry.source = action.source;
  entry.template_version = version;
  if (source.exists) entry.template_sha256 = source.hash;
  if (actual.exists) {
    entry.installed_sha256 = actual.hash;
    entry.installed_mode = actual.mode;
  }
  if (decision?.decision === 'manual_merge'
    || decision?.decision === 'keep_project'
    || decision?.decision === 'keep_or_archive') {
    entry.customized_at_baseline = true;
  } else if (decision?.decision === 'classify_existing_file') {
    entry.customized_at_baseline = actual.hash !== source.hash;
  } else if (decision?.decision === 'approve_upstream'
    || decision?.decision === 'approve_add'
    || decision?.decision === 'approve_restore') {
    entry.customized_at_baseline = false;
  }
  if (decision?.decision === 'keep_or_archive') {
    entry.upstream_removed_accepted = true;
  } else {
    delete entry.upstream_removed_accepted;
  }
  if (isManagedBlock) {
    delete entry.installed_mode;
  }
  return entry;
}
function buildRecord({ projectRoot, standardsRoot, plan, review }) {
  const targetRoot = path.resolve(projectRoot);
  const sourceRoot = path.resolve(standardsRoot);
  assertRealDirectory(targetRoot, '项目根目录');
  assertRealDirectory(sourceRoot, '规范仓库根目录');

  const validation = validateReview(plan, review);
  if (!validation.valid) throw new Error('人工审批记录未通过：' + validation.errors.join('；'));
  if (plan.baseline_missing || plan.baseline_incomplete || plan.global_blockers?.length) {
    throw new Error('升级计划存在全局阻断项，不能推进安装基线');
  }
  if (plan.mode !== 'read_only_preview' || plan.can_apply_automatically !== false) {
    throw new Error('升级计划模式无效；只接受当前只读预览格式');
  }

  const { manifest, bytes: oldManifestBytes, mode: manifestMode } = readManifest(targetRoot);
  if (manifest.baseline_state !== 'complete') throw new Error('项目安装基线不完整，不能推进升级版本');
  if (!plan.source_version || manifest.installed_with_version !== plan.source_version) {
    throw new Error('项目当前安装版本与升级计划 source_version 不一致；请重新生成计划');
  }
  const currentVersion = readVersion(sourceRoot);
  if (currentVersion !== plan.target_version) {
    throw new Error('规范仓库当前版本已变化；请重新生成计划和审批记录');
  }
  if (!HASH_RE.test(plan.source_inventory_sha256 || '')) {
    throw new Error('升级计划缺少有效的 source_inventory_sha256；请重新生成 plan_schema=2 计划');
  }
  const currentInventory = buildTemplateSourceInventory(sourceRoot);
  if (currentInventory.sha256 !== plan.source_inventory_sha256) {
    throw new Error('目标规范模板源快照已变化（新增、删除、内容或权限变化）；请重新生成升级计划和审批记录');
  }
  if (!plan.target_version || plan.target_version === plan.source_version) {
    throw new Error('升级目标版本与来源版本相同或无效');
  }

  const decisions = new Map((review.decisions ?? []).map(item => [item.path, item]));
  const seenPaths = new Set();
  const updatedPaths = [];
  const removedPaths = [];
  const preservedPaths = [];
  const deferredPaths = [];
  const manifestDraft = JSON.parse(JSON.stringify(manifest));

  for (const action of plan.actions) {
    if (!action || typeof action.path !== 'string' || seenPaths.has(action.path)) {
      throw new Error('升级计划包含无效或重复路径');
    }
    seenPaths.add(action.path);
    const { isManagedBlock, table, entry } = actionEntry(manifestDraft, action);
    checkPlanBaseline(manifestDraft, action, entry, isManagedBlock);
    const actual = actionActual(targetRoot, action, isManagedBlock);
    const source = sourceActual(sourceRoot, action);
    const decision = requireDecision(decisions, action);

    if (source.exists && action.evidence?.current_template_sha256
      && source.hash !== action.evidence.current_template_sha256) {
      throw new Error(action.path + '：模板源内容已变化，计划已过期');
    }

    if (decision?.decision === 'defer') {
      const expectedHash = action.evidence?.current_installed_sha256 ?? null;
      const expectedExists = expectedHash !== null;
      if (actual.exists !== expectedExists || (actual.exists && actual.hash !== expectedHash)) {
        throw new Error(action.path + '：defer 只允许保持计划生成时的原项目状态；目标文件已被修改或应用，请重新生成计划');
      }
      const expectedMode = action.evidence?.current_installed_mode;
      if (actual.exists && expectedMode !== null && expectedMode !== undefined && actual.mode !== expectedMode) {
        throw new Error(action.path + '：defer 期间文件权限发生变化，请重新生成计划');
      }
      deferredPaths.push(action.path);
      continue;
    }

    if (action.operation === 'blocked' || action.operation === 'manual_review'
      || action.operation === 'baseline_review') {
      throw new Error(action.path + '：该计划状态尚不支持自动登记基线：' + action.operation);
    }

    if (action.status === 'removed_both') {
      if (actual.exists || source.exists || !entry) throw new Error(action.path + '：removed_both 状态已变化');
      delete table[action.path];
      removedPaths.push(action.path);
      continue;
    }

    if (action.status === 'accepted_removed') {
      if (source.exists || !actual.exists || !entry?.upstream_removed_accepted) {
        throw new Error(action.path + '：已接受上游移除状态不一致');
      }
      entry.template_version = plan.target_version;
      preservedPaths.push(action.path);
      continue;
    }

    if (action.status === 'current' || action.status === 'accepted_customization') {
      if (!entry || !source.exists || !actual.exists) throw new Error(action.path + '：当前基线条目/文件缺失');
      if (action.evidence?.current_template_sha256 !== source.hash
        || action.evidence?.current_installed_sha256 !== actual.hash
        || (action.evidence?.current_installed_mode !== null && action.evidence?.current_installed_mode !== undefined
          && action.evidence.current_installed_mode !== actual.mode)) {
        throw new Error(action.path + '：实际内容与计划快照不一致');
      }
      table[action.path] = advanceEntry(action, actual, source, entry, null, plan.target_version, isManagedBlock);
      updatedPaths.push(action.path);
      continue;
    }

    if (!decision) throw new Error(action.path + '：必须先完成审批');
    const supported = new Set([
      'replace_candidate', 'manual_merge', 'review_removal',
      'restore_candidate', 'add_candidate', 'none', 'ownership_review'
    ]);
    if (!supported.has(action.operation)) {
      throw new Error(action.path + '：不支持的升级动作 ' + action.operation);
    }
    if (decision.decision === 'keep_project' || decision.decision === 'keep_or_archive'
      || decision.decision === 'classify_existing_file') {
      assertPlannedProjectSnapshot(action, actual);
    }
    verifyReviewedResult(action, decision, actual, source, isManagedBlock);

    if (action.operation === 'review_removal' && decision.decision === 'approve_removal') {
      delete table[action.path];
      removedPaths.push(action.path);
      continue;
    }

    if (action.operation === 'ownership_review' && decision.decision !== 'classify_existing_file') {
      throw new Error(action.path + '：同名文件归属只能使用 classify_existing_file 决策');
    }
    if (action.operation === 'replace_candidate' && decision.decision !== 'approve_upstream') {
      throw new Error(action.path + '：替换候选必须使用 approve_upstream');
    }
    if (action.operation === 'manual_merge' && decision.decision !== 'manual_merge') {
      throw new Error(action.path + '：冲突文件必须使用 manual_merge');
    }
    if (action.operation === 'restore_candidate' && decision.decision !== 'approve_restore') {
      throw new Error(action.path + '：恢复候选必须使用 approve_restore');
    }
    if (action.operation === 'add_candidate' && decision.decision !== 'approve_add') {
      throw new Error(action.path + '：新增候选必须使用 approve_add');
    }
    if (action.operation === 'review_removal'
      && !['keep_or_archive', 'approve_removal'].includes(decision.decision)) {
      throw new Error(action.path + '：上游移除只能选择 keep_or_archive 或 approve_removal');
    }
    if (action.status === 'local_customized' && decision.decision !== 'keep_project') {
      throw new Error(action.path + '：本地定制必须明确选择 keep_project');
    }

    const nextEntry = advanceEntry(action, actual, source, entry, decision, plan.target_version, isManagedBlock);
    table[action.path] = nextEntry;
    updatedPaths.push(action.path);
  }

  // Every unresolved review decision would make an all-project version label misleading.
  for (const item of manifestDraft.preserved_paths ?? []) {
    throw new Error('仍有历史保留路径未进入完整基线：' + item);
  }
  const stalePaths = [
    ...Object.entries(manifestDraft.managed_files)
      .filter(([, entry]) => entry.template_version !== plan.target_version && entry.upstream_removed_accepted !== true)
      .map(([filePath]) => filePath),
    ...Object.entries(manifestDraft.managed_blocks)
      .filter(([, entry]) => entry.template_version !== plan.target_version && entry.upstream_removed_accepted !== true)
      .map(([filePath]) => filePath)
  ];
  const deferredSet = new Set(deferredPaths);
  const unexplainedStale = stalePaths.filter(filePath => !deferredSet.has(filePath));
  if (unexplainedStale.length) {
    throw new Error('存在未登记为 defer 的旧基线条目：' + unexplainedStale.join(', '));
  }

  const isComplete = deferredPaths.length === 0;
  manifestDraft.installed_with_version = isComplete ? plan.target_version : plan.source_version;
  manifestDraft.baseline_state = 'complete';
  manifestDraft.last_upgrade = {
    status: isComplete ? 'complete' : 'partial',
    plan_id: plan.plan_id,
    from_version: plan.source_version,
    to_version: plan.target_version,
    recorded_at: new Date().toISOString(),
    review_sha256: sha256(Buffer.from(JSON.stringify(review), 'utf8')),
    updated_paths: updatedPaths.sort(),
    removed_paths: removedPaths.sort(),
    preserved_upstream_removed_paths: preservedPaths.sort(),
    deferred_paths: deferredPaths.sort(),
    decision_count: review.decisions.length
  };

  return {
    manifest: manifestDraft,
    old_manifest_sha256: sha256(oldManifestBytes),
    manifest_mode: manifestMode,
    plan_id: plan.plan_id,
    from_version: plan.source_version,
    to_version: plan.target_version,
    updated_paths: updatedPaths.sort(),
    removed_paths: removedPaths.sort(),
    preserved_upstream_removed_paths: preservedPaths.sort(),
    deferred_paths: deferredPaths.sort(),
    installed_with_version: manifestDraft.installed_with_version,
    review_validation: validation
  };
}
function writeManifestAtomic(projectRoot, manifest, mode) {
  const markerPath = path.join(projectRoot, MARKER);
  const tempPath = path.join(projectRoot, MARKER + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex'));
  const content = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  let fd;
  try {
    fd = fs.openSync(tempPath, 'wx', mode);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tempPath, markerPath);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tempPath); } catch {}
    throw error;
  }
}
function parseArgs(argv) {
  const args = {
    root: null,
    standardsRoot: path.resolve(__dirname, '..'),
    plan: null,
    review: null,
    dryRun: false,
    confirm: false,
    json: false
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (argv[i] === '--standards-root' && argv[i + 1]) args.standardsRoot = argv[++i];
    else if (argv[i] === '--plan' && argv[i + 1]) args.plan = argv[++i];
    else if (argv[i] === '--review' && argv[i + 1]) args.review = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--confirm-reviewed') args.confirm = true;
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/record-reviewed-template-upgrade.cjs --root <项目目录> --standards-root <规范仓库> --plan <plan.json> --review <review.json> --dry-run');
      console.log('审核和备份完成后：在相同参数基础上使用 --confirm-reviewed 写入 manifest。');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!args.root || !args.plan || !args.review) throw new Error('必须指定 --root、--plan 和 --review');
  if (args.dryRun === args.confirm) throw new Error('必须且只能指定 --dry-run 或 --confirm-reviewed');
  return args;
}
function main(argv) {
  const args = parseArgs(argv);
  const projectRoot = path.resolve(args.root);
  const standardsRoot = path.resolve(args.standardsRoot);
  assertRealDirectory(projectRoot, '项目根目录');
  assertRealDirectory(standardsRoot, '规范仓库根目录');
  const plan = inspectExternalFile(args.plan, '升级计划');
  const review = inspectExternalFile(args.review, '人工审查记录');
  const result = buildRecord({ projectRoot, standardsRoot, plan, review });
  if (!args.dryRun) {
    const marker = inspectWithin(projectRoot, MARKER, '安装基线文件');
    if (!marker.exists || marker.hash !== result.old_manifest_sha256) {
      throw new Error('manifest 在校验期间发生变化；拒绝覆盖，请重新生成计划和审查记录');
    }
    writeManifestAtomic(projectRoot, result.manifest, result.manifest_mode);
  }
  const output = {
    ok: true,
    mode: args.dryRun ? 'dry_run' : 'recorded',
    plan_id: result.plan_id,
    from_version: result.from_version,
    to_version: result.to_version,
    updated_paths: result.updated_paths,
    removed_paths: result.removed_paths,
    preserved_upstream_removed_paths: result.preserved_upstream_removed_paths,
    deferred_paths: result.deferred_paths,
    installed_with_version: result.installed_with_version,
    manifest_written: !args.dryRun,
    next_step: args.dryRun
      ? '预览通过；备份项目并确认实际文件结果后，使用 --confirm-reviewed 写入已验证基线。defer 路径保持旧基线。'
      : result.deferred_paths.length
        ? '已推进已批准路径；整体 installed_with_version 保持旧版本。重新生成升级计划，只处理 deferred_paths。'
        : '全部计划路径已收口并推进整体安装版本；现在运行 check-template-drift.cjs 和项目治理/测试，确认无残余漂移。'
  };
  console.log(args.json ? JSON.stringify(output, null, 2) : [
    '已审查升级基线登记',
    'Plan ID：' + result.plan_id,
    '版本：' + result.from_version + ' -> ' + result.to_version,
    '更新条目：' + result.updated_paths.length,
    '移除条目：' + result.removed_paths.length,
    '保留上游移除：' + result.preserved_upstream_removed_paths.length,
    '延期路径：' + result.deferred_paths.length,
    '整体安装版本：' + result.installed_with_version,
    'Manifest 写入：' + (args.dryRun ? '否（dry-run）' : '是'),
    output.next_step
  ].join('\n'));
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    console.error('[record-reviewed-template-upgrade] ' + error.message);
    process.exitCode = 2;
  }
}
module.exports = { buildRecord, writeManifestAtomic };
