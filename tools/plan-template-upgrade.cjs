#!/usr/bin/env node
'use strict';

/**
 * Read-only upgrade planner.
 * It converts drift findings into an explicit, reviewable action plan.
 * It never modifies project files, applies updates, deletes files or merges content.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { analyzeDrift } = require('./check-template-drift.cjs');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function planAction(finding) {
  const base = {
    path: finding.path,
    source: finding.source ?? null,
    status: finding.status,
    operation: 'none',
    recommendation: 'keep_current',
    requires_human_review: false,
    approval: null,
    reason: finding.detail ?? null,
    evidence: {
      baseline_version: finding.baseline_version ?? null,
      current_version: finding.current_version ?? null,
      upstream_changed: finding.upstream_changed ?? null,
      local_changed: finding.local_changed ?? null,
      baseline_template_sha256: finding.baseline_template_sha256 ?? null,
      current_template_sha256: finding.current_template_sha256 ?? null,
      baseline_installed_sha256: finding.baseline_installed_sha256 ?? null,
      current_installed_sha256: finding.current_installed_sha256 ?? null,
      baseline_installed_mode: finding.baseline_installed_mode ?? null,
      current_installed_mode: finding.current_installed_mode ?? null
    }
  };
  switch (finding.status) {
    case 'current':
    case 'removed_both':
      return { ...base, recommendation: 'no_change' };
    case 'accepted_customization':
      return { ...base, recommendation: 'preserve_reviewed_customization' };
    case 'accepted_removed':
      return { ...base, recommendation: 'preserve_reviewed_upstream_removal' };
    case 'update_available':
      return {
        ...base,
        operation: 'replace_candidate',
        recommendation: 'review_upstream_then_replace',
        requires_human_review: true,
        approval: 'approve_upstream',
        reason: '项目文件与安装基线一致，只有上游模板发生变化；审阅 diff 后才可替换。'
      };
    case 'local_customized':
      return {
        ...base,
        recommendation: 'preserve_local_change',
        requires_human_review: true,
        approval: 'keep_project',
        reason: '当前上游未修改该文件；升级时可保留项目定制，但必须明确确认并登记新的已审查基线。'
      };
    case 'conflict':
      return {
        ...base,
        operation: 'manual_merge',
        recommendation: 'manual_three_way_merge',
        requires_human_review: true,
        approval: 'manual_merge',
        reason: '模板和项目均相对基线发生变化。安装清单只保存基线哈希，没有保存基线正文；必须先从升级前 Git 历史、备份或旧模板 checkout 恢复共同基线，再进行三方人工合并。'
      };
    case 'upstream_removed':
      return {
        ...base,
        operation: 'review_removal',
        recommendation: finding.local_changed ? 'preserve_or_archive_local_file' : 'review_delete_candidate',
        requires_human_review: true,
        approval: finding.local_changed ? 'keep_or_archive' : 'approve_removal',
        reason: finding.local_changed
          ? '上游已移除且项目内容/权限也偏离基线；不得删除项目文件。'
          : '上游已移除，但项目仍有基线文件；人工确认引用关系后再决定是否删除或保留。'
      };
    case 'local_missing':
      return {
        ...base,
        operation: 'restore_candidate',
        recommendation: 'review_restore_from_current_template',
        requires_human_review: true,
        approval: 'approve_restore',
        reason: '项目文件缺失；确认该文件仍适用于当前项目后，才从当前模板恢复。'
      };
    case 'new_upstream_file':
      return {
        ...base,
        operation: 'add_candidate',
        recommendation: 'review_new_template_file',
        requires_human_review: true,
        approval: 'approve_add',
        reason: '母模板新增文件；先确认项目能力与目录布局是否需要该文件。'
      };
    case 'legacy_preserved':
      return {
        ...base,
        operation: 'baseline_review',
        recommendation: 'review_then_adopt_baseline',
        requires_human_review: true,
        approval: 'review_legacy_file',
        reason: '文件在旧项目初始化时被保留，没有可信历史基线；先检查并确认归属，再运行独立基线采纳流程。'
      };
    case 'untracked_collision':
      return {
        ...base,
        operation: 'ownership_review',
        recommendation: 'determine_file_ownership',
        requires_human_review: true,
        approval: 'classify_existing_file',
        reason: '母模板新增路径已存在同名项目文件，但安装清单没有登记，不能推断其归属。'
      };
    case 'local_unsafe':
    case 'upstream_unsafe':
    case 'unsafe':
    case 'managed_block_malformed':
      return {
        ...base,
        operation: 'blocked',
        recommendation: 'repair_unsafe_path_or_metadata_first',
        requires_human_review: true,
        approval: null,
        reason: finding.detail ?? '路径或托管区块不安全；先修复后重新生成升级计划。'
      };
    default:
      return {
        ...base,
        operation: 'manual_review',
        recommendation: 'inspect_before_upgrade',
        requires_human_review: true,
        approval: 'manual_review',
        reason: finding.detail ?? '未知状态，不能自动推断升级动作。'
      };
  }
}
function calculatePlanId(plan) {
  const payload = { ...plan };
  delete payload.plan_id;
  return sha256(JSON.stringify(payload)).slice(0, 16);
}
function buildUpgradePlan({ projectRoot, standardsRoot }) {
  const report = analyzeDrift({ projectRoot, standardsRoot });
  const sourceVersion = report.installed_with_version ?? null;
  const targetVersion = report.current_version ?? null;
  const baselineMissing = report.reason === 'baseline_missing';
  const baselineIncomplete = report.baseline_incomplete === true;
  const actions = (report.findings ?? []).map(planAction).sort((a, b) =>
    a.path.localeCompare(b.path) || a.operation.localeCompare(b.operation));
  const globalBlockers = [];
  if (baselineMissing) {
    globalBlockers.push({
      code: 'BASELINE_MISSING',
      message: '项目没有 .agent-standards.json；无法可靠比较旧模板与项目定制。先审查后建立基线。'
    });
  }
  if (baselineIncomplete) {
    globalBlockers.push({
      code: 'BASELINE_INCOMPLETE',
      message: '安装清单包含历史保留文件或未知基线；先逐项审查，不能把本计划当作可直接应用的升级清单。'
    });
  }
  for (const action of actions) {
    if (action.operation === 'blocked') {
      globalBlockers.push({
        code: 'UNSAFE_ENTRY',
        path: action.path,
        message: action.reason
      });
    }
  }
  const counts = {
    no_change: 0,
    replace_candidate: 0,
    manual_merge: 0,
    review_removal: 0,
    restore_candidate: 0,
    add_candidate: 0,
    baseline_review: 0,
    ownership_review: 0,
    blocked: 0,
    manual_review: 0
  };
  for (const action of actions) {
    if (Object.prototype.hasOwnProperty.call(counts, action.operation)) counts[action.operation]++;
    else if (action.operation === 'none') counts.no_change++;
  }
  const reviewRequired = actions.some(action => action.requires_human_review) || globalBlockers.length > 0;
  const plan = {
    plan_schema: 1,
    mode: 'read_only_preview',
    source_version: sourceVersion,
    target_version: targetVersion,
    version_label_changed: sourceVersion !== targetVersion,
    baseline_state: report.baseline_state ?? 'missing',
    baseline_missing: baselineMissing,
    baseline_incomplete: baselineIncomplete,
    can_apply_automatically: false,
    human_review_required: reviewRequired,
    baseline_recovery: {
      manifest_stores_baseline_content: false,
      conflicts_require_external_base: true,
      recovery_sources: ['升级前项目 Git commit / 分支', '升级前完整备份', '与 installed_with_version 对应的旧模板 checkout'],
      rule: '哈希只能证明内容是否变化，不能重建共同基线正文；无法恢复基线时不得声称完成三方合并。'
    },
    global_blockers: globalBlockers,
    summary: {
      total_entries: actions.length,
      ...counts,
      human_review: actions.filter(action => action.requires_human_review).length
    },
    preserved_paths: report.preserved_paths ?? [],
    actions,
    approval_contract: {
      required_fields: ['reviewer', 'reviewed_at', 'path', 'decision', 'reason'],
      additional_required_fields: { manual_merge: ['baseline_ref', 'merge_result_ref'] },
      allowed_decisions: [
        'approve_upstream',
        'keep_project',
        'manual_merge',
        'approve_removal',
        'keep_or_archive',
        'approve_restore',
        'approve_add',
        'review_legacy_file',
        'classify_existing_file',
        'manual_review'
      ],
      rule: '每个 requires_human_review=true 的条目必须有明确决策和理由；manual_merge 还必须记录共同基线来源 baseline_ref 与合并结果 merge_result_ref；任何 blocked 项必须先修复并重新生成计划。当前版本仅生成预览，不读取审批文件、不执行任何动作。'
    },
    next_steps: baselineMissing
      ? ['备份项目并人工比较现有规范', '按需使用 adopt-template-baseline.cjs --dry-run', '完成审查后才可显式采纳基线并重新生成计划']
      : baselineIncomplete
        ? ['先处理 preserved_paths 中的未知归属文件', '完成审查后显式采纳基线', '重新生成升级预览']
        : globalBlockers.length
          ? ['先修复所有路径或元数据阻断项', '重新生成升级预览']
          : reviewRequired
            ? ['逐项审查 actions 中的 source、目标路径和建议动作', '冲突项先恢复共同基线，再记录 baseline_ref 与 merge_result_ref', '形成 reviewer/reviewed_at/decision/reason 决策记录', '完成审查后再设计独立的升级应用器']
            : ['模板内容无待处理差异；仍应在目标项目验证当前构建、测试与治理检查'],
    guarantee: '本命令只读取项目和规范仓库，绝不写入、删除、覆盖、移动或合并文件。'
  };
  plan.plan_id = calculatePlanId(plan);
  return plan;
}
function parseArgs(argv) {
  const args = { root: null, standardsRoot: path.resolve(__dirname, '..'), json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (argv[i] === '--standards-root' && argv[i + 1]) args.standardsRoot = argv[++i];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/plan-template-upgrade.cjs --root <项目目录> [--standards-root <规范仓库目录>] [--json]');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!args.root) throw new Error('必须指定 --root <项目目录>');
  return args;
}
function renderText(plan) {
  const lines = [
    '规范模板升级预览（只读）',
    '计划 ID：' + plan.plan_id,
    '来源版本：' + (plan.source_version ?? 'unknown'),
    '目标版本：' + (plan.target_version ?? 'unknown'),
    '基线状态：' + plan.baseline_state,
    '自动应用：禁止',
    '人工审查：' + (plan.human_review_required ? '需要' : '当前差异无需逐项处理')
  ];
  for (const blocker of plan.global_blockers) lines.push('阻断：' + blocker.code + (blocker.path ? ' [' + blocker.path + ']' : '') + ' - ' + blocker.message);
  for (const action of plan.actions) {
    if (action.operation === 'none') continue;
    lines.push('- [' + action.status + '] ' + action.path + ' => ' + action.recommendation
      + (action.requires_human_review ? '（需人工确认：' + action.approval + '）' : '')
      + (action.reason ? '；' + action.reason : ''));
  }
  lines.push('汇总：' + JSON.stringify(plan.summary));
  lines.push('下一步：' + plan.next_steps.join('；'));
  lines.push(plan.guarantee);
  return lines.join('\n');
}
function main(argv) {
  const args = parseArgs(argv);
  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) throw new Error('项目目录不存在：' + args.root);
  const plan = buildUpgradePlan({ projectRoot: args.root, standardsRoot: args.standardsRoot });
  console.log(args.json ? JSON.stringify(plan, null, 2) : renderText(plan));
  if (plan.baseline_missing || plan.baseline_incomplete || plan.global_blockers.length || plan.human_review_required) return 1;
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[template-upgrade-plan] ' + error.message); process.exitCode = 2; }
}
module.exports = { buildUpgradePlan, calculatePlanId, planAction, renderText };
