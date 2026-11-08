#!/usr/bin/env node
'use strict';

/**
 * Read-only validator for a human-reviewed template upgrade plan.
 * Validates decisions only; it never applies changes or writes files.
 */
const fs = require('node:fs');
const path = require('node:path');
const { calculatePlanId } = require('./plan-template-upgrade.cjs');
const ALLOWED_DECISIONS = new Set([
  'approve_upstream',
  'keep_project',
  'manual_merge',
  'approve_removal',
  'keep_or_archive',
  'approve_restore',
  'approve_add',
  'review_legacy_file',
  'classify_existing_file',
  'manual_review',
  'defer'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function validTimestamp(value) {
  return nonEmpty(value) && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}
function validateReview(plan, review) {
  const errors = [];
  const warnings = [];
  if (!isObject(plan) || plan.plan_schema !== 1 || !Array.isArray(plan.actions)) {
    throw new Error('升级计划格式无效或 plan_schema 不受支持');
  }
  if (!nonEmpty(plan.plan_id) || calculatePlanId(plan) !== plan.plan_id) {
    throw new Error('升级计划 plan_id 与内容不匹配；计划可能已过期或被修改，请重新生成');
  }
  if (plan.can_apply_automatically !== false) {
    throw new Error('当前升级计划必须声明 can_apply_automatically=false');
  }
  if (!isObject(review) || review.review_schema !== 1 || !Array.isArray(review.decisions)) {
    throw new Error('人工审查记录格式无效；需要 review_schema=1 和 decisions 数组');
  }
  if (review.plan_id !== plan.plan_id) {
    throw new Error('人工审查记录 plan_id 与升级计划不匹配');
  }
  if (plan.baseline_missing || plan.baseline_incomplete) {
    errors.push('项目安装基线缺失或不完整，不能通过审批记录绕过；先完成基线审查并重新生成升级计划。');
  }
  for (const blocker of plan.global_blockers ?? []) {
    errors.push('未解除的升级阻断项：' + (blocker.code ?? 'UNKNOWN') + (blocker.path ? ' [' + blocker.path + ']' : ''));
  }

  const required = new Map(
    plan.actions.filter(action => action.requires_human_review).map(action => [action.path, action])
  );
  const seen = new Set();
  for (const decision of review.decisions) {
    if (!isObject(decision)) {
      errors.push('存在非对象的审查决策条目');
      continue;
    }
    const filePath = decision.path;
    if (!nonEmpty(filePath)) {
      errors.push('审查决策缺少 path');
      continue;
    }
    if (seen.has(filePath)) {
      errors.push('同一路径出现重复决策：' + filePath);
      continue;
    }
    seen.add(filePath);
    const action = required.get(filePath);
    if (!action) {
      errors.push('决策引用了不需要审批或不属于此计划的路径：' + filePath);
      continue;
    }
    if (!nonEmpty(decision.reviewer)) errors.push(filePath + '：缺少 reviewer');
    if (!validTimestamp(decision.reviewed_at)) errors.push(filePath + '：reviewed_at 必须是 ISO 8601 时间');
    if (!nonEmpty(decision.reason)) errors.push(filePath + '：缺少决策 reason');
    if (decision.decision !== 'approve_removal' && decision.decision !== 'defer' && !/^[a-f0-9]{64}$/.test(decision.result_sha256 || '')) {
      errors.push(filePath + '：必须提供实际结果文件/托管区块的 result_sha256（64 位小写 SHA-256）');
    }
    if (!nonEmpty(action.approval) || !ALLOWED_DECISIONS.has(action.approval)) {
      errors.push(filePath + '：计划包含未知的审批动作，不能被确认');
    }
    if (!nonEmpty(decision.decision)) errors.push(filePath + '：缺少 decision');
    else if (!ALLOWED_DECISIONS.has(decision.decision) || (decision.decision !== 'defer' && decision.decision !== action.approval)) {
      errors.push(filePath + '：decision 必须是已知动作并与计划要求一致（' + action.approval + '）');
    }
    if (action.operation === 'manual_merge') {
      if (!nonEmpty(decision.baseline_ref)) errors.push(filePath + '：manual_merge 必须提供 baseline_ref');
      if (!nonEmpty(decision.merge_result_ref)) errors.push(filePath + '：manual_merge 必须提供 merge_result_ref');
    }
    if (action.operation === 'blocked') errors.push(filePath + '：blocked 条目必须先修复并重新生成计划，不能通过审查记录解除');
  }
  const missing = [...required.keys()].filter(filePath => !seen.has(filePath));
  for (const filePath of missing) errors.push('缺少待审路径的决策：' + filePath);
  if (required.size === 0 && review.decisions.length) warnings.push('计划没有需要人工审批的条目；请确认是否引用了正确计划。');

  return {
    valid: errors.length === 0,
    review_complete: errors.length === 0,
    plan_id: plan.plan_id,
    source_version: plan.source_version,
    target_version: plan.target_version,
    required_decisions: required.size,
    submitted_decisions: review.decisions.length,
    missing_paths: missing,
    errors,
    warnings,
    can_apply_automatically: false,
    next_step: errors.length === 0
      ? '人工审查记录完整。该结果只证明决策记录符合计划，不会应用变更；仍需在备份/独立分支中按已批准项手动执行并验证。'
      : '先修正审查记录或计划阻断项，再重新运行校验。'
  };
}
function readJson(file, label) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(label + ' 必须是普通文件，不能是符号链接');
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}
function parseArgs(argv) {
  const args = { plan: null, review: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--plan' && argv[i + 1]) args.plan = argv[++i];
    else if (argv[i] === '--review' && argv[i + 1]) args.review = argv[++i];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--help') {
      console.log('用法：node tools/validate-template-upgrade-review.cjs --plan <upgrade-plan.json> --review <review.json> [--json]');
      process.exit(0);
    } else throw new Error('未知参数或参数缺失：' + argv[i]);
  }
  if (!args.plan || !args.review) throw new Error('必须指定 --plan 与 --review');
  return args;
}
function main(argv) {
  const args = parseArgs(argv);
  const result = validateReview(readJson(args.plan, '升级计划'), readJson(args.review, '人工审查记录'));
  console.log(args.json ? JSON.stringify(result, null, 2) : [
    '升级计划人工审查记录校验',
    'Plan ID：' + result.plan_id,
    '待审决策：' + result.submitted_decisions + ' / ' + result.required_decisions,
    '结果：' + (result.valid ? '有效' : '未通过'),
    ...result.errors.map(error => '- ' + error),
    result.next_step
  ].join('\n'));
  return result.valid ? 0 : 1;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error('[validate-template-upgrade-review] ' + error.message); process.exitCode = 2; }
}
module.exports = { validateReview };
