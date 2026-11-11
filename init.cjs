#!/usr/bin/env node
/** Install the project-standard template without destroying project-owned files. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TEMPLATE = path.join(__dirname, 'template');

// A closed stdout (e.g. `node init.cjs . | head`) must not kill the installer mid-transaction:
// the process would die after writing some files, leaving orphaned backups and a half-installed
// project. Ignore EPIPE and keep writing; the files matter, the report does not.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => { if (error.code !== 'EPIPE') throw error; });
}
const argv = process.argv.slice(2);
const VALID_FLAGS = new Set(['--force', '--dry-run', '--replace-hook', '--strict-scan', '--no-import-plans', '--update']);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const unknownFlags = [...flags].filter((flag) => !VALID_FLAGS.has(flag));
if (unknownFlags.length || positional.length > 1) {
  console.error('参数错误。用法：node init.cjs [目标目录] [--dry-run] [--force] [--replace-hook] [--strict-scan] [--no-import-plans]');
  if (unknownFlags.length) console.error('未知参数：' + unknownFlags.join(', '));
  if (positional.length > 1) console.error('目标目录只能指定一个。');
  process.exit(2);
}
const FORCE = flags.has('--force');
const DRY = flags.has('--dry-run');
const REPLACE_HOOK = flags.has('--replace-hook');
const STRICT_SCAN = flags.has('--strict-scan');
const IMPORT_PLANS = !flags.has('--no-import-plans');
// Refresh only files that are still byte-identical to what a previous run installed. Anything
// the project edited is left alone and reported. This is the "upgrade" path; --force overwrites
// everything and is not an upgrade mechanism.
const UPDATE = flags.has('--update');
if (REPLACE_HOOK && !FORCE) {
  console.error('--replace-hook 必须与 --force 一起使用，避免产生不明确的覆盖意图。');
  process.exit(2);
}
const TARGET = path.resolve(positional[0] ?? process.cwd());

if (!fs.existsSync(TARGET) || !fs.statSync(TARGET).isDirectory()) {
  console.error(`目标目录不存在或不是目录：${TARGET}`);
  process.exit(1);
}
if (!fs.existsSync(TEMPLATE)) {
  console.error(`找不到模板目录：${TEMPLATE}`);
  process.exit(1);
}

const VERSION_PATH = path.join(TEMPLATE, 'policy/standards-version.json');
let templateVersionInfo;
try {
  templateVersionInfo = JSON.parse(fs.readFileSync(VERSION_PATH, 'utf8'));
  if (templateVersionInfo.schema_version !== 1
    || typeof templateVersionInfo.version !== 'string'
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(templateVersionInfo.version)) {
    throw new Error('版本文件 schema 或 version 字段无效');
  }
} catch (error) {
  console.error('[init] 无法读取模板版本：' + error.message);
  process.exit(1);
}
const TEMPLATE_VERSION = templateVersionInfo.version;
const manifestPath = path.join(TARGET, '.agent-standards.json');
let previousManifest = null;
try {
  const stat = fs.lstatSync(manifestPath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('.agent-standards.json 必须是普通文件');
  previousManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (previousManifest.format_version !== 1
    || typeof previousManifest.managed_files !== 'object'
    || previousManifest.managed_files === null
    || Array.isArray(previousManifest.managed_files)
    || !Array.isArray(previousManifest.preserved_paths)
    || (previousManifest.managed_blocks !== undefined && (typeof previousManifest.managed_blocks !== 'object' || previousManifest.managed_blocks === null || Array.isArray(previousManifest.managed_blocks)))
    || (previousManifest.derived_paths !== undefined && !Array.isArray(previousManifest.derived_paths))) {
    throw new Error('不支持或损坏的 .agent-standards.json 格式；请先备份并人工检查，初始化未执行');
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('[init] 无法读取安装基线：' + error.message);
    process.exit(1);
  }
}

const has = (f) => fs.existsSync(path.join(TARGET, f));
const readJson = (f) => {
  try { return JSON.parse(fs.readFileSync(path.join(TARGET, f), 'utf8')); }
  catch (e) { console.error(`无法解析 ${f}: ${e.message}`); process.exit(1); }
};
const pkg = has('package.json') ? readJson('package.json') : {};
const composer = has('composer.json') ? readJson('composer.json') : {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const php = has('composer.json') || has('artisan') || has('think') || has('thinkphp') || has('hyperf');
const java = has('pom.xml') || has('build.gradle') || has('build.gradle.kts');
const python = has('pyproject.toml') || has('requirements.txt') || has('setup.py');
const node = has('package.json');
const dotnet = fs.readdirSync(TARGET).some((f) => f.endsWith('.csproj') || f.endsWith('.sln'));
const STACKS = [php && 'php', java && 'java', python && 'python', has('go.mod') && 'go', has('Cargo.toml') && 'rust', node && 'node', dotnet && 'dotnet'].filter(Boolean);

let STACK = 'generic';
if (has('go.mod')) STACK = 'go';
else if (has('Cargo.toml')) STACK = 'rust';
else if (java) STACK = 'java';
else if (python) STACK = 'python';
else if (php) STACK = 'php';
else if (node) STACK = deps.electron || has('electron-builder.yml') ? 'electron' : (deps.vite || deps.next || deps.nuxt ? 'node-web' : 'node');
else if (dotnet) STACK = 'dotnet';

const PROFILES = {
  electron: { label: 'Electron 桌面应用', src: ['src', 'app', 'main'], out: 'out', ignore: ['out/', 'dist/', 'dist-electron/', 'release/'], cmds: ['npm run dev', 'npm run build', 'npm run dist'] },
  'node-web': { label: 'Node 前端 / Web', src: ['src', 'app', 'pages'], out: 'dist', ignore: ['dist/', 'out/', 'coverage/'], cmds: ['npm run dev', 'npm run build'] },
  node: { label: 'Node 库 / 服务', src: ['src', 'lib'], out: 'dist', ignore: ['dist/', 'coverage/'], cmds: ['npm run build', 'npm test'] },
  php: { label: 'PHP', src: ['app', 'src'], out: 'build', ignore: ['vendor/', 'build/', 'dist/', '.phpunit.cache/'], cmds: ['composer install', 'composer test  # 若已配置'] },
  python: { label: 'Python', src: ['src', 'app', 'lib'], out: 'dist', ignore: ['__pycache__/', '*.py[cod]', '.venv/', 'venv/', 'dist/', 'build/', '.pytest_cache/', '.mypy_cache/'], cmds: ['python -m pytest', 'python -m build  # 若已配置'] },
  java: { label: 'Java / Kotlin', src: ['src/main/java', 'src'], out: 'target', ignore: ['target/', 'build/', '.gradle/', '*.class'], cmds: ['./mvnw test  # 或 gradlew test', './mvnw package  # 或 gradlew build'] },
  go: { label: 'Go', src: ['cmd', 'internal', 'pkg'], out: 'bin', ignore: ['bin/', 'dist/', '*.exe'], cmds: ['go build ./...', 'go test ./...'] },
  rust: { label: 'Rust', src: ['src'], out: 'target', ignore: ['target/'], cmds: ['cargo build', 'cargo test'] },
  dotnet: { label: '.NET', src: ['src'], out: 'bin', ignore: ['bin/', 'obj/'], cmds: ['dotnet build', 'dotnet test'] },
  generic: { label: '通用（未识别技术栈）', src: ['src', 'app', 'lib'], out: 'build', ignore: ['build/', 'dist/', 'out/'], cmds: ['# 按项目实际填写'] },
};
const profile = PROFILES[STACK];
const rawName = pkg.name || composer.name || path.basename(TARGET);
const PROJECT_NAME = String(rawName).replace(/^@[^/]+\//, '').split(/[-_.]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const PROJECT_DESC = pkg.description || composer.description || '（一句话说清这个项目解决什么问题）';
const SRC_DIR = profile.src.find(has) ?? profile.src[0];
const BUILD_OUTPUT = profile.out;
const jsPackageManager = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : node ? 'npm' : null;
const pythonPackageManager = has('uv.lock') ? 'uv' : has('poetry.lock') ? 'poetry' : python ? 'pip' : null;
const javaPackageManager = has('mvnw') || has('pom.xml') ? 'maven' : has('gradlew') || has('build.gradle') || has('build.gradle.kts') ? 'gradle' : null;
const packageManagers = [has('composer.json') && 'composer', javaPackageManager, pythonPackageManager, jsPackageManager].filter(Boolean);
const packageManager = packageManagers.join('+') || 'unknown';
const scripts = pkg.scripts ?? {};
const cmdLines = Object.keys(scripts).filter(k => ['dev', 'start', 'build', 'test', 'lint', 'typecheck'].includes(k)).map(k => `${jsPackageManager || 'npm'} run ${k}`);
const COMMANDS = cmdLines.length ? cmdLines.join('\n') : profile.cmds.join('\n');

// Governance tooling lives in a dot-directory so it never collides with a project's own
// scripts/. 'scripts' stays in this list only for projects installed before 3.0.0; the migration
// below removes our files from there and leaves anything the project wrote alone.
const TEMPLATE_DIRS = ['.memory', '.spec', '.tmp', '.githooks', '.standards', 'policy'];
const TEMPLATE_FILES = ['AGENTS.md', 'ROUTER.md', 'CLAUDE.md', 'GEMINI.md', 'gov.toml', 'project-profile.toml', '.gitattributes', '.gitignore', '.agent-standards.json'];
const ALWAYS_SKIP = new Set(['.git', 'node_modules']);
// A --force run that is interrupted can leave its own transaction files behind. If the next
// run whitelisted them, the governance gate would treat that junk as legitimate forever.
const isInternalArtifact = (name) => /\.agent-standards-(?:backup|tmp|rollback)-/.test(name);
const entries = fs.readdirSync(TARGET, { withFileTypes: true });
const existingDirs = entries.filter(e => e.isDirectory() && !ALWAYS_SKIP.has(e.name) && !isInternalArtifact(e.name)).map(e => e.name);
const existingFiles = entries.filter((e) => (e.isFile() || e.isSymbolicLink()) && !isInternalArtifact(e.name)).map(e => e.name);
// Root-level plan files are a governance violation by definition. Rather than failing the very
// first check and asking a human to hand-migrate, import them (see importPlanFiles below).
// The forbidden names live in gov.toml [forbid] only; do not restate them here.
const FORBIDDEN_PATTERNS = (() => {
  const line = fs.readFileSync(path.join(TEMPLATE, 'gov.toml'), 'utf8')
    .split(/\r?\n/).find((entry) => /^\s*file_patterns\s*=/.test(entry));
  if (!line) return [];
  return [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1].replace(/\\\\/g, '\\')).map((pattern) => {
    const insensitive = pattern.startsWith('(?i)');
    try { return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? 'i' : ''); } catch { return null; }
  }).filter(Boolean);
})();
// Only markdown: .bak/.orig/.DS_Store are junk to delete, not plans to import.
const isPlanFile = (name) => name.toLowerCase().endsWith('.md') && FORBIDDEN_PATTERNS.some((re) => re.test(name));
const planFiles = IMPORT_PLANS ? entries.filter((e) => e.isFile() && isPlanFile(e.name)).map((e) => e.name).sort() : [];

// A project that already wrote its own entry file is the common case, not the exception. If that
// file is over the template's budget, installing anyway means the very first governance run fails
// on it — and the project ends up with two rule systems that nobody reconciles. Say so before
// writing anything, instead of leaving a half-adopted tree behind.
const TEMPLATE_BUDGET = (() => {
  const line = fs.readFileSync(path.join(TEMPLATE, 'gov.toml'), 'utf8').split(/\r?\n/).find((entry) => /^\s*agents_bytes\s*=/.test(entry));
  const value = line ? Number((line.match(/=\s*(\d+)/) || [])[1]) : NaN;
  return Number.isFinite(value) ? value : null;
})();
const entryFile = path.join(TARGET, 'AGENTS.md');
const entryBytes = (() => {
  if (!fs.existsSync(entryFile)) return 0;
  const raw = fs.readFileSync(entryFile);
  return raw.length - (raw.toString('latin1').split('\r\n').length - 1);
})();
if (TEMPLATE_BUDGET && entryBytes > TEMPLATE_BUDGET && !FORCE
  && !(previousManifest?.managed_files?.['AGENTS.md'])) {
  console.error(`[init] 目标项目已有自己的 AGENTS.md（${entryBytes}B），是模板预算 ${TEMPLATE_BUDGET}B 的 ${(entryBytes / TEMPLATE_BUDGET).toFixed(1)} 倍。`);
  console.error('      模板不会改写你的入口文件，但装完之后治理检查会直接判它超预算。三条路，选一条再来：');
  console.error('      1. 拆分（推荐）：细则搬进 .spec/01-architecture.md、.spec/02-conventions.md，AGENTS.md 只留入口与指针');
  console.error(`      2. 不接管入口：只想用检查工具的话，先把 gov.toml 的 agents_bytes 调到 ≥${entryBytes}，再用 --force 装`);
  console.error('      3. 不装：已有成熟规范的项目，装进去只会变成两套并存');
  console.error('      未写入任何文件。');
  process.exit(1);
}
const BUILD_DIRS = [BUILD_OUTPUT];
const allowedDirs = [...new Set([...(STRICT_SCAN ? [] : existingDirs), ...TEMPLATE_DIRS, ...BUILD_DIRS])].sort();
// Plan files are about to be imported out of the root, so they must not enter the whitelist.
const allowedFiles = [...new Set([...existingFiles.filter((name) => !planFiles.includes(name)), ...TEMPLATE_FILES])].sort();

const today = new Date().toISOString().slice(0, 10);
const replacements = {
  PROJECT_NAME, PROJECT_DESC, SRC_DIR, BUILD_OUTPUT, TODAY: today,
  LANGUAGE: STACK, FRAMEWORK: php ? (has('artisan') ? 'laravel' : has('think') || has('thinkphp') ? 'thinkphp' : has('hyperf') ? 'hyperf' : 'php-framework-unspecified') : java ? 'spring-or-java-unspecified' : node ? 'node-framework-unspecified' : STACK,
  PACKAGE_MANAGER: packageManager,
  ALLOWED_DIRS: allowedDirs.join('  '), ALLOWED_FILES: allowedFiles.join(' '), COMMANDS,
  DETECTED_STACKS: (STACKS.length ? STACKS : ['generic']).map((s) => JSON.stringify(s)).join(', '),
  DEV_COMMANDS: scripts.dev ? `${jsPackageManager || 'npm'} run dev` : '# 按项目实际填写',
  BUILD_COMMANDS: scripts.build ? `${jsPackageManager || 'npm'} run build` : '# 按项目实际填写',
  MILESTONE: '（待填）', CURRENT_STATE: '（待填：一句话说清现在到哪一步）',
  IN_PROGRESS: '（待填）', BLOCKED: '（待填）', NEXT: '（待填）',
  PROJECT_PITCH: '（待填：这个项目是给谁解决什么问题的）',
  ARCH_LAYERS: '（待填：画出分层）', CORE_INTERFACES: '（待填：列出关键接口）',
  DATA_TABLE: '（待填）', MECH_TABLE: '（待填）',
};
const capabilityResolution = require(path.join(TEMPLATE, '.standards/capability-resolver.cjs'))
  .loadCapabilityResolution(TARGET, TEMPLATE);
if (capabilityResolution.errors.length) {
  console.error('能力配置无法解析：\n' + capabilityResolution.errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

// Refuse to follow project-owned symlinks while installing managed files.
// A symlinked project root itself is allowed; links below that root are not.
function assertSafeTargetFile(relPath) {
  const parts = relPath.split(/[\\/]+/).filter(Boolean);
  if (!parts.length || path.isAbsolute(relPath) || parts.some((part) => part === '.' || part === '..')) {
    throw new Error('非法目标相对路径：' + relPath);
  }
  let cursor = TARGET;
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    let stat;
    try { stat = fs.lstatSync(cursor); }
    catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error('拒绝写入包含符号链接的目标路径：' + relPath + '（' + path.relative(TARGET, cursor) + '）');
    }
    if (i < parts.length - 1 && !stat.isDirectory()) {
      throw new Error('目标路径的父级不是目录：' + path.relative(TARGET, cursor));
    }
    if (i === parts.length - 1 && stat.isDirectory()) {
      throw new Error('目标文件位置已存在同名目录：' + relPath);
    }
  }
}
// Untracked build artifacts can appear under template/ on any machine that ran the Python
// checker or an editor. They are gitignored, so CI never sees them, but copying them would
// ship junk into every initialized project.
const TEMPLATE_JUNK = /(?:^|\/)(?:__pycache__|\.pytest_cache|\.mypy_cache|\.DS_Store|Thumbs\.db)(?:\/|$)|\.(?:pyc|pyo|swp|swo|orig|rej)$|~$/;

function collectTemplateFiles(dir, rel = '', includeExcluded = false) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = path.posix.join(rel.split(path.sep).join('/'), entry.name);
    if (TEMPLATE_JUNK.test(relPath)) continue;
    if (!includeExcluded && capabilityResolution.isExcluded(relPath)) continue;
    if (entry.isDirectory()) result.push(...collectTemplateFiles(path.join(dir, entry.name), relPath, includeExcluded));
    else if (entry.name !== '.gitignore.append') result.push(relPath);
  }
  return result;
}
const allTemplatePaths = collectTemplateFiles(TEMPLATE, '', true);
const excludedTemplatePaths = allTemplatePaths.filter((relPath) => capabilityResolution.isExcluded(relPath)).sort();
const preflightPaths = allTemplatePaths.filter((relPath) => !capabilityResolution.isExcluded(relPath));
preflightPaths.push('.agent-standards.json');
for (const stack of [...new Set(STACKS.map((value) => value === 'electron' || value === 'node-web' ? 'node' : value))]) {
  if (capabilityResolution.capabilities.stack_rules?.status === 'disabled') break;
  const presetPath = path.join(__dirname, 'presets', 'stacks', stack + '.md');
  if (fs.existsSync(presetPath)) preflightPaths.push('.spec/stacks/' + stack + '.md');
}
preflightPaths.push('.gitignore');
if (capabilityResolution.capabilities.task_tracking?.status !== 'disabled'
  && (has('.spec/tasks/index.md') || preflightPaths.includes('.spec/tasks/index.md'))) {
  preflightPaths.push('.spec/tasks/BOARD.md');
}
try {
  for (const relPath of new Set(preflightPaths)) assertSafeTargetFile(relPath);
} catch (error) {
  console.error('[init] 安全预检失败，未写入任何模板文件：' + error.message);
  process.exit(1);
}

// Validate an existing derived BOARD before any template write. --validate is
// read-only; generation itself happens only after installation succeeds.
if (capabilityResolution.capabilities.task_tracking?.status !== 'disabled' && has('.spec/tasks/index.md')) {
  const validation = spawnSync(process.execPath, [
    path.join(TEMPLATE, '.standards/generate-board.cjs'), '--root', TARGET, '--validate',
  ], { cwd: TARGET, encoding: 'utf8' });
  if (validation.status !== 0) {
    console.error('[init] BOARD 预检失败，未写入任何模板文件：' + (validation.stderr || validation.stdout || '未知错误'));
    process.exit(1);
  }
}

function fill(s) {
  let out = s;
  for (const [k, v] of Object.entries(replacements)) out = out.split(`{{${k}}}`).join(v);
  return out.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => `（待填：${k}）`);
}

const report = { created: [], skipped: [], forced: [], protected: [], warnings: [], imported: [], updated: [], conflicts: [], migrated: [] };
const managedFiles = { ...(previousManifest?.managed_files ?? {}) };
const preservedPaths = new Set(previousManifest?.preserved_paths ?? []);
const managedBlocks = { ...(previousManifest?.managed_blocks ?? {}) };
const derivedPaths = new Set(previousManifest?.derived_paths ?? []);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
function trackManagedFile(targetPath, sourcePath, renderedContent) {
  const sourceBytes = fs.readFileSync(sourcePath);
  managedFiles[targetPath] = {
    source: path.relative(__dirname, sourcePath).split(path.sep).join('/'),
    template_sha256: sha256(sourceBytes),
    installed_sha256: sha256(Buffer.isBuffer(renderedContent) ? renderedContent : Buffer.from(renderedContent, 'utf8')),
    installed_mode: fs.statSync(path.join(TARGET, targetPath)).mode & 0o777,
    template_version: TEMPLATE_VERSION,
  };
  preservedPaths.delete(targetPath);
}
function trackPreservedPath(targetPath) {
  if (targetPath === '.githooks/pre-commit') return; // project-owned hook is intentionally outside template ownership
  if (!managedFiles[targetPath]) preservedPaths.add(targetPath);
}
const transaction = { files: [], directories: [], committed: false };
let transactionSequence = 0;

function snapshotManagedFile(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return { existed: false };
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('拒绝修改非普通文件：' + path.relative(TARGET, file));
  return { existed: true, content: fs.readFileSync(file), mode: stat.mode & 0o777 };
}
function ensureDirectoryTransactional(dir) {
  const missing = [];
  let cursor = dir;
  while (!fs.existsSync(cursor)) {
    missing.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error('无法创建目标目录：' + dir);
    cursor = parent;
  }
  const parentStat = fs.lstatSync(cursor);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error('目标父目录不安全：' + cursor);
  for (const item of missing.reverse()) {
    fs.mkdirSync(item);
    transaction.directories.push(item);
  }
}
function writeTransactional(file, content, encoding = 'utf8') {
  ensureDirectoryTransactional(path.dirname(file));
  const before = snapshotManagedFile(file);
  const sequence = ++transactionSequence;
  const temp = path.join(path.dirname(file), '.' + path.basename(file) + '.agent-standards-tmp-' + process.pid + '-' + sequence);
  const backup = before.existed
    ? path.join(path.dirname(file), '.' + path.basename(file) + '.agent-standards-backup-' + process.pid + '-' + sequence)
    : null;
  try {
    fs.writeFileSync(temp, content, encoding);
    if (before.existed) fs.chmodSync(temp, before.mode);
    if (before.existed) fs.renameSync(file, backup);
    try { fs.renameSync(temp, file); }
    catch (error) {
      if (backup && fs.existsSync(backup)) fs.renameSync(backup, file);
      throw error;
    }
    transaction.files.push({ file, before, backup });
    // Deterministic failure injection is available only to the repository's own
    // tests; normal project initialization cannot activate this path.
    if (process.env.NODE_ENV === 'test' && process.env.AGENT_STANDARDS_TEST_FAIL_AFTER_PATH) {
      const rel = path.relative(TARGET, file).split(path.sep).join('/');
      if (rel === process.env.AGENT_STANDARDS_TEST_FAIL_AFTER_PATH) {
        throw new Error('测试故障注入：' + rel);
      }
    }
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
    throw error;
  }
}
function recordExternalWrite(file) {
  transaction.files.push({ file, before: snapshotManagedFile(file), backup: null, external: true });
}
function chmodTransactional(file, mode) {
  const before = fs.statSync(file).mode & 0o777;
  fs.chmodSync(file, mode);
  transaction.files.push({ file, before: { existed: true, mode: before, metadataOnly: true }, backup: null });
}
function removeTransactional(file) {
  // Register before unlinking: a crash in between leaves an entry whose restore is a no-op
  // overwrite, never a file that vanished without the transaction knowing.
  const before = snapshotManagedFile(file);
  transaction.files.push({ file, before, backup: null });
  fs.unlinkSync(file);
}
function rollbackTransaction() {
  const failures = [];
  for (const entry of [...transaction.files].reverse()) {
    try {
      if (entry.backup && fs.existsSync(entry.backup)) {
        if (fs.existsSync(entry.file)) fs.unlinkSync(entry.file);
        fs.renameSync(entry.backup, entry.file);
      } else if (entry.before.metadataOnly) {
        fs.chmodSync(entry.file, entry.before.mode);
      } else if (entry.before.existed) {
        const restore = entry.file + '.agent-standards-rollback-' + process.pid + '-' + (++transactionSequence);
        fs.writeFileSync(restore, entry.before.content);
        if (entry.before.mode !== undefined) fs.chmodSync(restore, entry.before.mode);
        if (fs.existsSync(entry.file)) fs.unlinkSync(entry.file);
        fs.renameSync(restore, entry.file);
      } else if (fs.existsSync(entry.file)) {
        fs.unlinkSync(entry.file);
      }
    } catch (error) {
      failures.push(path.relative(TARGET, entry.file) + ': ' + error.message);
    }
  }
  for (const dir of [...transaction.directories].reverse()) {
    try { fs.rmdirSync(dir); }
    catch (error) { if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') failures.push(path.relative(TARGET, dir) + ': ' + error.message); }
  }
  return failures;
}
function commitTransaction() {
  for (const entry of transaction.files) {
    if (entry.backup && fs.existsSync(entry.backup)) {
      try { fs.unlinkSync(entry.backup); }
      catch (error) { report.warnings.push('安装已完成，但无法清理备份文件：' + path.relative(TARGET, entry.backup) + '（' + error.message + '）'); }
    }
  }
  transaction.committed = true;
}
// Capability-aware entry file: a project that turned a capability off must not be told to use it.
// Blocks are marked in the template so the enabled case reads normally and the disabled case is
// replaced by an explicit slot instead of a stale instruction.
const CAPABILITY_LABELS = {
  task_tracking: '.spec/tasks/',
  roadmap: '.spec/roadmap/',
  adr: '.spec/adr/',
  module_boundaries: '模块边界',
  stack_rules: '.spec/stacks/',
  multi_agent: '多 Agent 并发协作约定',
};
const capabilityDisabled = (ids) => ids.some((id) => capabilityResolution.capabilities[id]?.status === 'disabled');

function renderCapabilityBlocks(content) {
  return content
    .replace(/<!--cap:([a-z0-9_,]+)-->\r?\n?([\s\S]*?)<!--\/cap-->\r?\n?/g,
      (match, ids, body) => (capabilityDisabled(ids.split(',')) ? '' : body))
    .replace(/<!--cap-note:([a-z0-9_,]+)-->\r?\n?([\s\S]*?)<!--\/cap-note-->\r?\n?/g,
      (match, ids, body) => (capabilityDisabled(ids.split(',')) ? body : ''));
}

function capabilityNotice() {
  const disabled = Object.keys(CAPABILITY_LABELS).filter((id) => capabilityDisabled([id]));
  if (!disabled.length) return '';
  return `> **本项目已关闭能力：${disabled.join('、')}**（见 \`project-profile.toml [capabilities]\`）。对应的可选指引与门禁不会启用；已存在的历史记录不会因此删除。若任务确实需要某项已关闭能力，先由维护者调整配置或明确替代方案。\n\n`;
}

// Template-owned directories are always legitimate, and a newer release may add one (3.0.0 added
// .standards). Both the refresh path and the customized-gov.toml path need this.
function ensureTemplateDirs(text) {
  const line = text.match(/^allowed_dirs = \[(.*)\]$/m);
  if (!line) return text;
  const present = [...line[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (!TEMPLATE_DIRS.some((dir) => !present.includes(dir))) return text;
  const merged = [...new Set([...present, ...TEMPLATE_DIRS])].sort();
  return text.replace(line[0], `allowed_dirs = [${merged.map((value) => JSON.stringify(value)).join(', ')}]`);
}

function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const relPath = path.posix.join(rel.split(path.sep).join('/'), entry.name);
    if (TEMPLATE_JUNK.test(relPath)) continue;
    if (capabilityResolution.isExcluded(relPath)) continue;
    if (entry.isDirectory()) { walk(from, relPath); continue; }
    if (entry.name === '.gitignore.append') continue;
    const to = path.join(TARGET, relPath);
    const exists = fs.existsSync(to);
    // A project-owned hook is protected even under --force unless explicitly opted in. But a hook
    // this installer created and nobody edited is ours: without refreshing it, a release that
    // moves the checker path leaves a hook pointing at a file that no longer exists.
    if (relPath === '.githooks/pre-commit' && exists && !REPLACE_HOOK) {
      const installedSha = managedFiles[relPath]?.installed_sha256;
      const ours = installedSha && sha256(fs.readFileSync(to)) === installedSha;
      if (!(UPDATE && ours)) {
        report.protected.push(relPath); trackPreservedPath(relPath); continue;
      }
      report.updated.push(relPath);
    }
    if (exists && !FORCE) {
      const installedSha = managedFiles[relPath]?.installed_sha256;
      const pristine = installedSha && sha256(fs.readFileSync(to)) === installedSha;
      if (!(UPDATE && pristine)) {
        report.skipped.push(relPath);
        trackPreservedPath(relPath);
        // A same-named file that this installer has never managed is the project's own. Skipping
        // it silently would leave the project running a foreign script under our path.
        // Derived files (BOARD.md) and capability-pruned paths are expected to be unmanaged.
        if (!installedSha && !derivedPaths.has(relPath)) report.conflicts.push(relPath);
        continue;
      }
      report.updated.push(relPath);
    }
    if (!DRY) {
      ensureDirectoryTransactional(path.dirname(to));
      let content = fill(fs.readFileSync(from, 'utf8'));
      if (relPath === 'AGENTS.md' || relPath === 'ROUTER.md' || relPath === '.spec/01-architecture.md') {
        content = renderCapabilityBlocks(content);
      }
      if (relPath === 'AGENTS.md') {
        const notice = capabilityNotice();
        if (notice) content = content.replace(/^(#[^\n]*\n)/, `$1\n${notice}`);
      }
      if (relPath === 'project-profile.toml') {
        const detected = (STACKS.length ? STACKS : ['generic']).map((stack) => JSON.stringify(stack)).join(', ');
        content = content.replace(/^detected = \["generic"\]$/m, `detected = [${detected}]`);
      }
      if (relPath === 'gov.toml') {
        const tomlValues = { name: PROJECT_NAME, desc: PROJECT_DESC, language: STACK, framework: replacements.FRAMEWORK, package_manager: packageManager, src_dir: SRC_DIR, build_output: BUILD_OUTPUT };
        for (const [key, value] of Object.entries(tomlValues)) {
          content = content.replace(new RegExp(`^${key} = \".*\"$`, 'm'), `${key} = ${JSON.stringify(String(value))}`);
        }
        // --update must not wipe the project's root whitelist: the template ships empty
        // placeholders that are only filled on a first install.
        if (exists) {
          const previous = fs.readFileSync(to, 'utf8');
          for (const key of ['allowed_dirs', 'allowed_files']) {
            const line = previous.match(new RegExp(`^${key} = \\[.*\\]$`, 'm'));
            if (line) content = content.replace(new RegExp(`^${key} = \\[\\]$`, 'm'), line[0]);
          }
        }
        // Template-owned directories are always legitimate, and a newer release may have added
        // one (3.0.0 added .standards). Only needed on the upgrade path: a fresh install fills
        // these arrays from the root scan afterwards, and touching them here would break that.
        if (exists) content = ensureTemplateDirs(content);
      }
      writeTransactional(to, content, 'utf8');
      trackManagedFile(relPath, from, content);
    }
    (exists ? report.forced : report.created).push(relPath);
  }
}
try {
walk(TEMPLATE);

// Add only the detected language profiles. They are on-demand references, not always-loaded rules.
const presetMap = [...new Set(STACKS.map((stack) => stack === 'electron' || stack === 'node-web' ? 'node' : stack))];
for (const stack of presetMap) {
  if (capabilityResolution.capabilities.stack_rules?.status === 'disabled') break;
  const from = path.join(__dirname, 'presets', 'stacks', `${stack}.md`);
  if (!fs.existsSync(from)) continue;
  const rel = `.spec/stacks/${stack}.md`;
  const to = path.join(TARGET, rel);
  const exists = fs.existsSync(to);
  if (exists && !FORCE) {
    // Same rule as the main walk: --update refreshes only untouched files.
    const installedSha = managedFiles[rel]?.installed_sha256;
    const pristine = installedSha && sha256(fs.readFileSync(to)) === installedSha;
    if (!(UPDATE && pristine)) {
      report.skipped.push(rel);
      trackPreservedPath(rel);
      continue;
    }
    report.updated.push(rel);
  }
  if (!DRY) { const content = fs.readFileSync(from, 'utf8'); ensureDirectoryTransactional(path.dirname(to)); writeTransactional(to, content, 'utf8'); trackManagedFile(rel, from, content); }
  (exists ? report.forced : report.created).push(rel);
}

// Populate the initial root allowlist only when this run created/replaced gov.toml.
const govPath = path.join(TARGET, 'gov.toml');
if (report.created.includes('gov.toml') || report.forced.includes('gov.toml')) {
  const quote = (value) => JSON.stringify(value);
  const dirsToml = `allowed_dirs = [${allowedDirs.map(quote).join(', ')}]`;
  const filesToml = `allowed_files = [${allowedFiles.map(quote).join(', ')}]`;
  if (!DRY) {
    let govText = fs.readFileSync(govPath, 'utf8');
    govText = govText.replace(/^allowed_dirs = \[\]/m, dirsToml).replace(/^allowed_files = \[\]/m, filesToml);
    const requiredLine = govText.match(/^files = \[(.*)\]$/m);
    if (requiredLine) {
      const required = [...requiredLine[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((rel) => !capabilityResolution.isExcluded(rel));
      for (const stack of presetMap) {
        const rel = `.spec/stacks/${stack}.md`;
        if (fs.existsSync(path.join(TARGET, rel)) && !required.includes(rel)) required.push(rel);
      }
      govText = govText.replace(requiredLine[0], `files = [${required.map(quote).join(', ')}]`);
    }
    writeTransactional(govPath, govText, 'utf8');
    if (managedFiles['gov.toml']) managedFiles['gov.toml'].installed_sha256 = sha256(govText);
  }
}

// Merge .gitignore entries independently and idempotently; reject malformed managed markers.
const ignoreSrc = path.join(TEMPLATE, '.gitignore.append');
const ignoreDst = path.join(TARGET, '.gitignore');
const START = '# >>> agent-project-standards (managed)';
const END = '# <<< agent-project-standards (managed)';
if (fs.existsSync(ignoreSrc)) {
  const desired = fs.readFileSync(ignoreSrc, 'utf8').replace('{{IGNORE_ENTRIES}}', profile.ignore.join('\n')).trim();
  const current = fs.existsSync(ignoreDst) ? fs.readFileSync(ignoreDst, 'utf8') : '';
  const startAt = current.indexOf(START);
  const endAt = current.indexOf(END);
  const duplicateStart = startAt >= 0 && current.indexOf(START, startAt + START.length) >= 0;
  const duplicateEnd = endAt >= 0 && current.indexOf(END, endAt + END.length) >= 0;
  if (duplicateStart || duplicateEnd || ((startAt >= 0) !== (endAt >= 0)) || (startAt >= 0 && endAt < startAt)) {
    throw new Error('.gitignore 中 Agent Standards 托管区块标记损坏或重复；请先人工修复，未继续修改。');
  }
  const managedBlock = `${START}\n${desired}\n${END}`;
  const next = startAt >= 0
    ? current.slice(0, startAt) + managedBlock + current.slice(endAt + END.length)
    : `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${managedBlock}\n`;
  if (next !== current) {
    if (!DRY) writeTransactional(ignoreDst, next, 'utf8');
    report.created.push('.gitignore（合并托管区块）');
  } else report.skipped.push('.gitignore（托管区块已是最新）');
  if (!DRY) {
    const blockStart = next.indexOf(START);
    const blockEnd = next.indexOf(END, blockStart + START.length);
    const managedRegion = next.slice(blockStart, blockEnd + END.length);
    managedBlocks['.gitignore'] = {
      source: 'template/.gitignore.append',
      template_sha256: sha256(fs.readFileSync(ignoreSrc)),
      installed_sha256: sha256(managedRegion),
      template_version: TEMPLATE_VERSION,
    };
  }
}

function buildImportCard(names, importedRel) {
  const list = names.map((name) => `- \`${importedRel}/${name}\``).join('\n');
  return `# T1 导入：根目录计划文件

- 状态：planned（以 \`../index.md\` 为准）
- 波次：W1
- 来源：初始化器自动迁移，原文逐字保留

## 背景

项目在接入规范前把计划写在根目录。根目录计划文件会和 \`.spec/tasks/index.md\` 争夺
「唯一状态源」，所以初始化器把原文移到这里，并从根目录移除。原文没有被改写。

${list}

## 接下来要做的

1. 把原文里仍然有效的条目拆成卡片：\`.spec/tasks/T2/card.md\`、\`T3\`……
2. 每条写清范围（允许改哪些路径）和验收（怎么证明做完）。
3. 在 \`.spec/tasks/index.md\` 登记新卡，再运行 \`node .standards/generate-board.cjs\`。
4. 原文处理完后可以删掉 \`${importedRel}/\`。

## 范围

（待填：这些计划涉及哪些路径）

## 验收

（待填：怎么证明每条做完）
`;
}

// Import root-level plan files into the task index. Someone who just installed governance
// should not be greeted by a red check telling them to hand-migrate their own notes.
if (planFiles.length && capabilityResolution.capabilities.task_tracking?.status !== 'disabled') {
  const cardRel = '.spec/tasks/T1/card.md';
  const cardPath = path.join(TARGET, cardRel);
  const renderedExample = fill(fs.readFileSync(path.join(TEMPLATE, cardRel), 'utf8'));
  const currentCard = fs.existsSync(cardPath) ? fs.readFileSync(cardPath, 'utf8') : null;
  const canImport = report.created.includes(cardRel) || report.forced.includes(cardRel)
    || (currentCard !== null && currentCard === renderedExample);

  if (!canImport) {
    report.warnings.push(`根目录有 ${planFiles.length} 个计划文件（${planFiles.join('、')}），但 T1 已被项目使用，未自动导入。请手工并入 .spec/tasks/ 后删除根目录文件。`);
  } else if (DRY) {
    for (const name of planFiles) report.imported.push(`${name} → .spec/tasks/T1/imported/${name}`);
  } else {
    const importedRel = '.spec/tasks/T1/imported';
    ensureDirectoryTransactional(path.join(TARGET, importedRel));
    for (const name of planFiles) {
      const from = path.join(TARGET, name);
      writeTransactional(path.join(TARGET, importedRel, name), fs.readFileSync(from));
      removeTransactional(from);
      report.imported.push(`${name} → ${importedRel}/${name}`);
    }
    const card = buildImportCard(planFiles, importedRel);
    writeTransactional(cardPath, card, 'utf8');
    // The card and the index row are now project state, not template content. Keep them out of
    // managed_files so a later --update cannot revert them to the template's example card.
    delete managedFiles[cardRel];
    derivedPaths.add(cardRel);

    const indexPath = path.join(TARGET, '.spec/tasks/index.md');
    if (fs.existsSync(indexPath)) {
      const indexText = fs.readFileSync(indexPath, 'utf8');
      const title = `导入：根目录计划文件（${planFiles.join('、')}）`;
      const nextIndex = indexText.replace(/^\| T1 \|.*$/m, `| T1 | ${title} | planned | \`${importedRel}/\` |`);
      if (nextIndex !== indexText) {
        writeTransactional(indexPath, nextIndex, 'utf8');
        delete managedFiles['.spec/tasks/index.md'];
        derivedPaths.add('.spec/tasks/index.md');
      }
    }
  }
}

// 3.0.0 moved the governance tooling from scripts/ to .standards/ so it stops colliding with a
// project's own scripts directory. Remove our old copies, but only ones we can prove we installed:
// the recorded hash must still match, otherwise the project edited it and it is theirs to keep.
const legacyScripts = path.join(TARGET, 'scripts');
if (fs.existsSync(legacyScripts)) {
  for (const rel of Object.keys(previousManifest?.managed_files ?? {}).filter((key) => key.startsWith('scripts/'))) {
    const file = path.join(TARGET, rel);
    if (!fs.existsSync(file)) continue;
    const recorded = previousManifest.managed_files[rel].installed_sha256;
    if (!recorded || sha256(fs.readFileSync(file)) !== recorded) continue;
    if (!DRY) removeTransactional(file);
    delete managedFiles[rel];
    report.migrated.push(rel);
  }
  if (!DRY) {
    try { if (fs.readdirSync(legacyScripts).length === 0) fs.rmdirSync(legacyScripts); } catch {}
  }
}

// A customized gov.toml is skipped by --update, so its required-file list can keep pointing at
// paths that no longer exist. Rewrite only our own script names, and only when the new file is
// actually present — the check is idempotent so a half-migrated project converges.
const govFile = path.join(TARGET, 'gov.toml');
if (fs.existsSync(govFile)) {
  const before = fs.readFileSync(govFile, 'utf8');
  let after = before.replace(/(?:^|[^.\w])scripts\/(capability-resolver\.cjs|check-governance\.cjs|check_governance\.py|generate-board\.cjs|profile-validator\.cjs|profile_validator\.py|sync-memory\.cjs|task-context-resolver\.cjs)/g,
    (match, name) => (fs.existsSync(path.join(TARGET, '.standards', name))
      ? match.replace(`scripts/${name}`, `.standards/${name}`)
      : match));
  after = ensureTemplateDirs(after);
  if (after !== before && !DRY) {
    writeTransactional(govFile, after, 'utf8');
    if (managedFiles['gov.toml']) managedFiles['gov.toml'].installed_sha256 = sha256(after);
    report.migrated.push('gov.toml 中的脚本路径');
  }
}

// Set executable bit only on a hook created/replaced by this run.
const hook = path.join(TARGET, '.githooks', 'pre-commit');
if (!DRY && fs.existsSync(hook) && (report.created.includes('.githooks/pre-commit') || report.forced.includes('.githooks/pre-commit'))) {
  try { chmodTransactional(hook, 0o755); } catch (error) { report.warnings.push('无法设置 pre-commit 可执行位，请在 Unix 环境执行 chmod +x .githooks/pre-commit（' + error.message + '）'); }
}
if (!DRY && managedFiles['.githooks/pre-commit'] && fs.existsSync(hook)) {
  managedFiles['.githooks/pre-commit'].installed_mode = fs.statSync(hook).mode & 0o777;
}
if (!DRY && capabilityResolution.capabilities.task_tracking?.status !== 'disabled'
  && fs.existsSync(path.join(TARGET, '.spec/tasks/index.md'))) {
  // Execute the generator shipped with this initializer, never a project-owned
  // script that may have been skipped or preserved during installation.
  const trustedGenerator = path.join(TEMPLATE, '.standards/generate-board.cjs');
  recordExternalWrite(path.join(TARGET, '.spec/tasks/BOARD.md'));
  const generated = spawnSync(process.execPath, [trustedGenerator, '--root', TARGET], { cwd: TARGET, encoding: 'utf8' });
  if (generated.status !== 0) throw new Error((generated.stderr || generated.stdout || 'BOARD 生成失败').trim());
  delete managedFiles['.spec/tasks/BOARD.md'];
  preservedPaths.delete('.spec/tasks/BOARD.md');
  derivedPaths.add('.spec/tasks/BOARD.md');
}
// Directories the template itself creates are not "pre-existing" project structure. Counting
// them made a repeat run warn about .spec/.memory/scripts, which trains users to ignore warnings.
const preexistingDirs = existingDirs.filter((name) => !TEMPLATE_DIRS.includes(name));
if (preexistingDirs.length) {
  report.warnings.push(STRICT_SCAN
    ? `严格扫描：${preexistingDirs.length} 个既有根目录不会自动纳入白名单；请人工确认后逐项登记。`
    : `发现 ${preexistingDirs.length} 个既有根目录，兼容模式下已纳入白名单；请人工审查 gov.toml [dirs]。`);
}
if (STACKS.length > 1) report.warnings.push(`检测到多技术栈：${STACKS.join(', ')}。当前默认配置按 ${STACK} 生成，请人工确认 gov.toml [project]。`);
if (report.conflicts.length) {
  report.warnings.push(`有 ${report.conflicts.length} 个路径上已存在本工具从未管理过的同名文件（${report.conflicts.slice(0, 3).join('、')}${report.conflicts.length > 3 ? ' 等' : ''}），已原样保留、未覆盖。如果它们不是你的定制，而是残留或同名误放，请人工确认后再删——否则治理检查跑的可能是别人的脚本。`);
}
if (!DRY) {
  const staleAfter = Object.keys(managedFiles).filter((rel) => managedFiles[rel].template_version
    && managedFiles[rel].template_version !== TEMPLATE_VERSION);
  if (staleAfter.length) {
    report.warnings.push(`有 ${staleAfter.length} 个受管文件仍是旧版本内容（已存在，未更新），整体版本标记保持 ${previousManifest?.installed_with_version ?? '未登记'}。要刷新请用 --update（只更新未被改动过的文件），或按 DEPLOY.md 的升级流程人工处理。`);
  }
}
// Leftovers from an earlier interrupted run can sit anywhere in the tree, not just the root.
// They are deliberately not whitelisted, so the governance gate reports them as unregistered files — which suggests
// whitelisting them. Say what they actually are before the user "fixes" it the wrong way.
function findStaleArtifacts(dir, rel = '', found = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (isInternalArtifact(entry.name)) { found.push(relPath); continue; }
    if (entry.isDirectory()) findStaleArtifacts(path.join(dir, entry.name), relPath, found);
  }
  return found;
}
const ownBackups = new Set(transaction.files.map((entry) => entry.backup).filter(Boolean)
  .map((file) => path.relative(TARGET, file).split(path.sep).join('/')));
const staleArtifacts = findStaleArtifacts(TARGET)
  .filter((rel) => !ownBackups.has(rel))
  .sort();
if (staleArtifacts.length) {
  report.warnings.push(`发现 ${staleArtifacts.length} 个上次安装残留的事务文件（${staleArtifacts.slice(0, 3).join('、')}${staleArtifacts.length > 3 ? ' 等' : ''}）。确认没有安装进程在运行后可直接删除；不要加进 gov.toml [dirs]。`);
}
if (!DRY) {
  const preserved = [...preservedPaths].sort();
  // Never claim a version the files do not actually carry. Files that were skipped keep their
  // recorded template_version, so the overall marker only advances when everything matches.
  const stale = Object.keys(managedFiles).filter((rel) => managedFiles[rel].template_version
    && managedFiles[rel].template_version !== TEMPLATE_VERSION);
  const installedVersion = stale.length ? (previousManifest?.installed_with_version ?? TEMPLATE_VERSION) : TEMPLATE_VERSION;
  const manifest = {
    format_version: 1,
    installed_with_version: installedVersion,
    baseline_state: preserved.length ? 'partial_unknown' : 'complete',
    managed_files: Object.fromEntries(Object.entries(managedFiles).sort(([a], [b]) => a.localeCompare(b))),
    managed_blocks: managedBlocks,
    preserved_paths: preserved,
    derived_paths: [...derivedPaths].sort(),
    excluded_paths: excludedTemplatePaths,
  };
  writeTransactional(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
} catch (error) {
  const rollbackFailures = DRY ? [] : rollbackTransaction();
  console.error('[init] 初始化失败' + (DRY ? '' : '，已尝试回滚本次写入') + '：' + error.message);
  for (const failure of rollbackFailures) console.error('[init] 回滚失败：' + failure);
  process.exit(1);
}
if (!DRY) commitTransaction();

console.log(`\n铺设规范 → ${TARGET}\n`);
console.log(`  主技术栈  ${STACK}（${profile.label}）`);
console.log(`  检测栈    ${STACKS.join(', ') || 'generic'}`);
console.log(`  包管理器  ${packageManager}`);
console.log('  能力解析  ' + Object.entries(capabilityResolution.capabilities).map(([id, item]) => id + '=' + item.status).join(', '));
console.log(`  项目名    ${PROJECT_NAME}`);
console.log(`  源码目录  ${SRC_DIR}`);
console.log(`  产物目录  ${BUILD_OUTPUT}`);
for (const [label, list] of [['新建', report.created], ['更新', report.updated], ['覆盖', report.forced], ['跳过', report.skipped], ['保护', report.protected], ['导入', report.imported], ['迁移', report.migrated]]) {
  if (list.length) console.log(`\n  ${label} ${list.length} 项：\n${list.map(x => `    ${x}`).join('\n')}`);
}
for (const warning of report.warnings) console.warn(`\n  ⚠ ${warning}`);
if (DRY) console.log('\n  （--dry-run，未写入任何文件）');
else console.log('\n下一步：检查 gov.toml 白名单、填写 MEMORY.md 断点、确认项目构建/测试命令，然后运行治理检查。');
