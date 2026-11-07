#!/usr/bin/env node
/** Install the project-standard template without destroying project-owned files. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEMPLATE = path.join(__dirname, 'template');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const TARGET = path.resolve(positional[0] ?? process.cwd());
const FORCE = flags.has('--force');
const DRY = flags.has('--dry-run');
const REPLACE_HOOK = flags.has('--replace-hook');
const STRICT_SCAN = flags.has('--strict-scan');

if (!fs.existsSync(TARGET) || !fs.statSync(TARGET).isDirectory()) {
  console.error(`目标目录不存在或不是目录：${TARGET}`);
  process.exit(1);
}
if (!fs.existsSync(TEMPLATE)) {
  console.error(`找不到模板目录：${TEMPLATE}`);
  process.exit(1);
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

const TEMPLATE_DIRS = ['.memory', '.spec', '.tmp', '.githooks', 'scripts', 'policy'];
const TEMPLATE_FILES = ['AGENTS.md', 'ROUTER.md', 'CLAUDE.md', 'GEMINI.md', 'gov.toml', 'project-profile.toml', '.gitattributes', '.gitignore'];
const ALWAYS_SKIP = new Set(['.git', 'node_modules']);
const entries = fs.readdirSync(TARGET, { withFileTypes: true });
const existingDirs = entries.filter(e => e.isDirectory() && !ALWAYS_SKIP.has(e.name)).map(e => e.name);
const existingFiles = entries.filter(e => e.isFile() || e.isSymbolicLink()).map(e => e.name);
const BUILD_DIRS = [BUILD_OUTPUT];
const allowedDirs = [...new Set([...(STRICT_SCAN ? [] : existingDirs), ...TEMPLATE_DIRS, ...BUILD_DIRS])].sort();
const allowedFiles = [...new Set([...existingFiles, ...TEMPLATE_FILES])].sort();

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
const capabilityResolution = require(path.join(TEMPLATE, 'scripts/capability-resolver.cjs'))
  .loadCapabilityResolution(TARGET, TEMPLATE);
if (capabilityResolution.errors.length) {
  console.error('能力配置无法解析：\\n' + capabilityResolution.errors.map((e) => '  - ' + e).join('\\n'));
  process.exit(1);
}

function fill(s) {
  let out = s;
  for (const [k, v] of Object.entries(replacements)) out = out.split(`{{${k}}}`).join(v);
  return out.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => `（待填：${k}）`);
}

const report = { created: [], skipped: [], forced: [], protected: [], warnings: [] };
function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const relPath = path.posix.join(rel.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) { walk(from, relPath); continue; }
    if (entry.name === '.gitignore.append') continue;
    const to = path.join(TARGET, relPath);
    const exists = fs.existsSync(to);
    // A project-owned hook is protected even under --force unless explicitly opted in.
    if (relPath === '.githooks/pre-commit' && exists && !REPLACE_HOOK) {
      report.protected.push(relPath); continue;
    }
    if (exists && !FORCE) { report.skipped.push(relPath); continue; }
    if (!DRY) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      let content = fill(fs.readFileSync(from, 'utf8'));
      if (relPath === 'project-profile.toml') {
        const detected = (STACKS.length ? STACKS : ['generic']).map((stack) => JSON.stringify(stack)).join(', ');
        content = content.replace(/^detected = \["generic"\]$/m, `detected = [${detected}]`);
      }
      if (relPath === 'gov.toml') {
        const tomlValues = { name: PROJECT_NAME, desc: PROJECT_DESC, language: STACK, framework: replacements.FRAMEWORK, package_manager: packageManager, src_dir: SRC_DIR, build_output: BUILD_OUTPUT };
        for (const [key, value] of Object.entries(tomlValues)) {
          content = content.replace(new RegExp(`^${key} = \".*\"$`, 'm'), `${key} = ${JSON.stringify(String(value))}`);
        }
      }
      fs.writeFileSync(to, content, 'utf8');
    }
    (exists ? report.forced : report.created).push(relPath);
  }
}
walk(TEMPLATE);

// Add only the detected language profiles. They are on-demand references, not always-loaded rules.
const presetMap = [...new Set(STACKS.map((stack) => stack === 'electron' || stack === 'node-web' ? 'node' : stack))];
for (const stack of presetMap) {\n  if (capabilityResolution.capabilities.stack_rules?.status === 'disabled') break;
  const from = path.join(__dirname, 'presets', 'stacks', `${stack}.md`);
  if (!fs.existsSync(from)) continue;
  const rel = `.spec/stacks/${stack}.md`;
  const to = path.join(TARGET, rel);
  const exists = fs.existsSync(to);
  if (exists && !FORCE) { report.skipped.push(rel); continue; }
  if (!DRY) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, fs.readFileSync(from, 'utf8'), 'utf8'); }
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
      const required = [...requiredLine[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      for (const stack of presetMap) {
        const rel = `.spec/stacks/${stack}.md`;
        if (fs.existsSync(path.join(TARGET, rel)) && !required.includes(rel)) required.push(rel);
      }
      govText = govText.replace(requiredLine[0], `files = [${required.map(quote).join(', ')}]`);
    }
    fs.writeFileSync(govPath, govText, 'utf8');
  }
}

// Merge .gitignore entries independently and idempotently; do not use one sentinel as a proxy for all rules.
const ignoreSrc = path.join(TEMPLATE, '.gitignore.append');
const ignoreDst = path.join(TARGET, '.gitignore');
const START = '# >>> agent-project-standards (managed)';
const END = '# <<< agent-project-standards (managed)';
if (fs.existsSync(ignoreSrc)) {
  const desired = fs.readFileSync(ignoreSrc, 'utf8').replace('{{IGNORE_ENTRIES}}', profile.ignore.join('\n')).trim();
  const current = fs.existsSync(ignoreDst) ? fs.readFileSync(ignoreDst, 'utf8') : '';
  const block = `${START}\n${desired}\n${END}`;
  const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  const next = re.test(current) ? current.replace(re, block) : `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${block}\n`;
  if (next !== current) {
    if (!DRY) fs.writeFileSync(ignoreDst, next, 'utf8');
    report.created.push('.gitignore（合并托管区块）');
  } else report.skipped.push('.gitignore（托管区块已是最新）');
}

// Set executable bit only on a hook created/replaced by this run.
const hook = path.join(TARGET, '.githooks', 'pre-commit');
if (!DRY && fs.existsSync(hook) && (report.created.includes('.githooks/pre-commit') || report.forced.includes('.githooks/pre-commit'))) {
  try { fs.chmodSync(hook, 0o755); } catch { report.warnings.push('无法设置 pre-commit 可执行位，请在 Unix 环境执行 chmod +x .githooks/pre-commit'); }
}
if (!DRY && fs.existsSync(path.join(TARGET, 'scripts/generate-board.cjs')) && fs.existsSync(path.join(TARGET, '.spec/tasks/index.md'))) {
  const generated = spawnSync(process.execPath, [path.join(TARGET, 'scripts/generate-board.cjs')], { cwd: TARGET, encoding: 'utf8' });
  if (generated.status !== 0) { console.error(generated.stdout || '', generated.stderr || ''); process.exit(1); }
}
if (existingDirs.length) {
  report.warnings.push(STRICT_SCAN
    ? `严格扫描：${existingDirs.length} 个既有根目录不会自动纳入白名单；请人工确认后逐项登记。`
    : `发现 ${existingDirs.length} 个既有根目录，兼容模式下已纳入白名单；请人工审查 gov.toml [dirs]。`);
}
if (STACKS.length > 1) report.warnings.push(`检测到多技术栈：${STACKS.join(', ')}。当前默认配置按 ${STACK} 生成，请人工确认 gov.toml [project]。`);

console.log(`\n铺设规范 → ${TARGET}\n`);
console.log(`  主技术栈  ${STACK}（${profile.label}）`);
console.log(`  检测栈    ${STACKS.join(', ') || 'generic'}`);
console.log(`  包管理器  ${packageManager}`);\nconsole.log('  能力解析  ' + Object.entries(capabilityResolution.capabilities).map(([id, item]) => id + '=' + item.status).join(', '));
console.log(`  项目名    ${PROJECT_NAME}`);
console.log(`  源码目录  ${SRC_DIR}`);
console.log(`  产物目录  ${BUILD_OUTPUT}`);
for (const [label, list] of [['新建', report.created], ['覆盖', report.forced], ['跳过', report.skipped], ['保护', report.protected]]) {
  if (list.length) console.log(`\n  ${label} ${list.length} 项：\n${list.map(x => `    ${x}`).join('\n')}`);
}
for (const warning of report.warnings) console.warn(`\n  ⚠ ${warning}`);
if (DRY) console.log('\n  （--dry-run，未写入任何文件）');
else console.log('\n下一步：检查 gov.toml 白名单、填写 MEMORY.md 断点、确认项目构建/测试命令，然后运行治理检查。');
