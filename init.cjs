#!/usr/bin/env node
/**
 * 把通用规范模板铺进一个项目。
 *
 * 用法：
 *   node init.cjs                     # 铺到当前目录
 *   node init.cjs D:/path/to/project  # 铺到指定目录
 *   node init.cjs . --force           # 覆盖已存在的文件（危险，会盖掉你的 AGENTS.md）
 *   node init.cjs . --dry-run         # 只看会做什么，不写盘
 *
 * 做的事：
 *   1. 复制 template/ 下的规范文件（已存在则跳过，除非 --force）
 *   2. 读 package.json / 目录名，填 {{PROJECT_NAME}} 等占位符
 *   3. 扫描目标根目录，自动生成 gov.toml 的 [dirs] 白名单（保证一上来就通过检查）
 *   4. 把 .tmp/ 等条目追加进 .gitignore
 *   5. 给 pre-commit 加可执行位
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE = path.join(__dirname, 'template');

// ---------------------------------------------------------------- 参数
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const TARGET = path.resolve(positional[0] ?? process.cwd());
const FORCE = flags.has('--force');
const DRY = flags.has('--dry-run');

if (!fs.existsSync(TARGET)) {
  console.error(`目标目录不存在：${TARGET}`);
  process.exit(1);
}
if (!fs.existsSync(TEMPLATE)) {
  console.error(`找不到模板目录：${TEMPLATE}`);
  process.exit(1);
}

// ---------------------------------------------------------------- 项目信息探测
const has = (f) => fs.existsSync(path.join(TARGET, f));
const pkgPath = path.join(TARGET, 'package.json');
const pkg = has('package.json') ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

/**
 * 技术栈探测。只影响默认值（源码目录、产物目录、命令、忽略项），
 * 猜错也不影响规范本身——改 gov.toml [project] 即可。
 */
const STACK = (() => {
  if (has('go.mod')) return 'go';
  if (has('Cargo.toml')) return 'rust';
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) return 'java';
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) return 'python';
  if (
    fs.readdirSync(TARGET).some((f) => f.endsWith('.csproj') || f.endsWith('.sln'))
  )
    return 'dotnet';
  if (has('package.json')) {
    if (deps.electron || has('electron-builder.yml')) return 'electron';
    if (deps.vite || deps.next || deps.nuxt || deps['@vitejs/plugin-react']) return 'node-web';
    return 'node';
  }
  return 'generic';
})();

const PROFILES = {
  electron: {
    label: 'Electron 桌面应用',
    src: ['src', 'app', 'main'],
    out: 'out',
    ignore: ['out/', 'dist/', 'dist-electron/', 'release/'],
    cmds: ['npm run dev        # 开发', 'npm run build      # 构建', 'npm run dist       # 打包'],
  },
  'node-web': {
    label: 'Node 前端 / Web',
    src: ['src', 'app', 'pages'],
    out: 'dist',
    ignore: ['dist/', 'out/', 'release/', 'coverage/'],
    cmds: ['npm run dev        # 开发', 'npm run build      # 构建'],
  },
  node: {
    label: 'Node 库 / 服务',
    src: ['src', 'lib'],
    out: 'dist',
    ignore: ['dist/', 'coverage/'],
    cmds: ['npm run build      # 构建', 'npm test           # 测试'],
  },
  python: {
    label: 'Python',
    src: ['src', 'app', 'lib'],
    out: 'dist',
    ignore: ['__pycache__/', '*.py[cod]', '.venv/', 'venv/', 'dist/', 'build/', '.pytest_cache/', '.mypy_cache/'],
    cmds: ['python -m pytest   # 测试', 'python -m build    # 打包（若有）'],
  },
  java: {
    label: 'Java / Kotlin',
    src: ['src/main/java', 'src'],
    out: 'target',
    ignore: ['target/', 'build/', '.gradle/', '*.class'],
    cmds: ['./mvnw test        # 或 gradlew test', './mvnw package     # 或 gradlew build'],
  },
  go: {
    label: 'Go',
    src: ['cmd', 'internal', 'pkg'],
    out: 'bin',
    ignore: ['bin/', 'dist/', '*.exe'],
    cmds: ['go build ./...     # 构建', 'go test ./...      # 测试'],
  },
  rust: {
    label: 'Rust',
    src: ['src'],
    out: 'target',
    ignore: ['target/'],
    cmds: ['cargo build        # 构建', 'cargo test         # 测试'],
  },
  dotnet: {
    label: '.NET',
    src: ['src'],
    out: 'bin',
    ignore: ['bin/', 'obj/'],
    cmds: ['dotnet build       # 构建', 'dotnet test        # 测试'],
  },
  generic: {
    label: '通用（未识别技术栈）',
    src: ['src', 'app', 'lib', 'source'],
    out: 'build',
    ignore: ['build/', 'dist/', 'out/'],
    cmds: ['# 按项目实际填写'],
  },
};

const profile = PROFILES[STACK];

const rawName = pkg.name || path.basename(TARGET);
const PROJECT_NAME = rawName
  .replace(/^@[^/]+\//, '')
  .split(/[-_.]/)
  .filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(' ');

const PROJECT_DESC = pkg.description || '（一句话说清这个项目解决什么问题）';

const SRC_DIR = profile.src.find((d) => has(d)) ?? profile.src[0] ?? '.';
const BUILD_OUTPUT = profile.out;

const scripts = pkg.scripts ?? {};
const cmdLines = [];
for (const [k, v] of Object.entries(scripts)) {
  if (['dev', 'start', 'build', 'test', 'lint', 'typecheck'].includes(k)) {
    cmdLines.push(`npm run ${k}`.padEnd(18) + `# ${String(v).slice(0, 56)}`);
  }
}
const COMMANDS = cmdLines.length ? cmdLines.join('\n') : profile.cmds.join('\n');

// ---------------------------------------------------------------- 根目录扫描
const SKIP_SCAN = new Set([
  'node_modules',
  '.git',
  '.tmp',
  'out',
  'dist',
  'dist-electron',
  'build',
  'release',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  'coverage',
]);

const scanDirs = [];
const scanFiles = [];
for (const entry of fs.readdirSync(TARGET, { withFileTypes: true })) {
  const n = entry.name;
  if (entry.isDirectory()) {
    scanDirs.push(n);
  } else if (entry.isFile() || entry.isSymbolicLink()) {
    scanFiles.push(n);
  }
}

// 白名单 = 目标里实际存在的 + 模板会带进来的 + 常见目录
// 注意：目录和文件必须分开列，否则 .cursorrules 这类 dotfile 会被当成目录塞进 allowed_dirs。
const TEMPLATE_DIRS = ['.memory', '.spec', '.tmp', '.githooks', 'scripts'];
const TEMPLATE_FILES = [
  'AGENTS.md',
  'ROUTER.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules',
  'gov.toml',
  '.gitattributes',
  '.gitignore',
];
const USUAL_DIRS = ['.github', '.vscode', '.idea', 'docs', 'deliverables', 'tests', 'test', 'public', 'assets'];
// 产物目录即使当前不存在也要放行，否则第一次构建就会被自己的闸门拦住
const BUILD_DIRS = ['out', 'dist', 'dist-electron', 'build', 'release', 'coverage'];

const allowedDirs = [
  ...new Set([...scanDirs, ...TEMPLATE_DIRS, ...USUAL_DIRS, ...BUILD_DIRS]),
]
  .filter((n) => !['.git', 'node_modules'].includes(n))
  .sort();

const allowedFiles = [...new Set([...scanFiles, ...TEMPLATE_FILES])].sort();

// ---------------------------------------------------------------- 占位符
const today = new Date().toISOString().slice(0, 10);

const REPLACEMENTS = {
  PROJECT_NAME,
  PROJECT_DESC,
  SRC_DIR,
  BUILD_OUTPUT,
  TODAY: today,
  ALLOWED_DIRS: allowedDirs.join('  '),
  ALLOWED_FILES: allowedFiles.join(' '),
  COMMANDS,
  DEV_COMMANDS: scripts.dev ? 'npm run dev' : '# 按项目实际填写',
  BUILD_COMMANDS: scripts.build ? 'npm run build' : '# 按项目实际填写',
  MILESTONE: '（待填）',
  CURRENT_STATE: '（待填：一句话说清现在到哪一步）',
  IN_PROGRESS: '（待填）',
  BLOCKED: '（待填）',
  NEXT: '（待填）',
  PROJECT_PITCH: '（待填：这个项目是给谁解决什么问题的）',
  ARCH_LAYERS: '（待填：画出分层，例如 main → service → repository）',
  CORE_INTERFACES: '（待填：列出改了就要同步改文档的接口）',
  DATA_TABLE: '（待填）',
  MECH_TABLE: '（待填）',
};

function fill(text) {
  let out = text;
  for (const [k, v] of Object.entries(REPLACEMENTS)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  // 兜底：模板里没定义的占位符，替换成显眼的待填标记，而不是留下 {{X}}
  out = out.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => `（待填：${k}）`);
  return out;
}

// ---------------------------------------------------------------- 复制
const report = { created: [], skipped: [], forced: [] };

function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const relPath = path.join(rel, entry.name);

    if (entry.isDirectory()) {
      walk(from, relPath);
      continue;
    }

    // .gitignore.append 单独处理，不直接落盘
    if (entry.name === '.gitignore.append') continue;

    const to = path.join(TARGET, relPath);
    const exists = fs.existsSync(to);

    if (exists && !FORCE) {
      report.skipped.push(relPath);
      continue;
    }

    if (!DRY) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const raw = fs.readFileSync(from, 'utf8');
      fs.writeFileSync(to, fill(raw), 'utf8');
    }
    (exists ? report.forced : report.created).push(relPath);
  }
}

walk(TEMPLATE);

// ---------------------------------------------------------------- gov.toml 白名单
// 若 gov.toml 是本次新建的，把扫描结果写进去；已存在则不动（避免覆盖用户自定义）
const govPath = path.join(TARGET, 'gov.toml');
if (report.created.includes('gov.toml') || report.forced.includes('gov.toml')) {
  if (!DRY) {
    let gov = fs.readFileSync(govPath, 'utf8');
    gov = gov.replace(/allowed_dirs = \[\]/, `allowed_dirs = [${allowedDirs.map((d) => `"${d}"`).join(', ')}]`);
    gov = gov.replace(/allowed_files = \[\]/, `allowed_files = [${allowedFiles.map((f) => `"${f}"`).join(', ')}]`);
    fs.writeFileSync(govPath, gov, 'utf8');
  }
}

// ---------------------------------------------------------------- .gitignore
const ignoreSrc = path.join(TEMPLATE, '.gitignore.append');
const ignoreDst = path.join(TARGET, '.gitignore');
if (fs.existsSync(ignoreSrc)) {
  const appendRaw = fs
    .readFileSync(ignoreSrc, 'utf8')
    .split('{{IGNORE_ENTRIES}}')
    .join(profile.ignore.join('\n'));

  const current = fs.existsSync(ignoreDst) ? fs.readFileSync(ignoreDst, 'utf8') : '';
  if (!current.includes('.tmp/')) {
    if (!DRY) fs.writeFileSync(ignoreDst, `${current.replace(/\s*$/, '')}\n${appendRaw}`, 'utf8');
    report.created.push('.gitignore（追加条目）');
  } else {
    report.skipped.push('.gitignore（已有 .tmp/，未改动）');
  }
}

// ---------------------------------------------------------------- 钩子可执行位
const hook = path.join(TARGET, '.githooks', 'pre-commit');
if (!DRY && fs.existsSync(hook)) {
  try {
    fs.chmodSync(hook, 0o755);
  } catch {
    /* Windows 上可能不支持，忽略 */
  }
}

// ---------------------------------------------------------------- 输出
console.log(`\n铺设规范 → ${TARGET}\n`);
console.log(`  技术栈    ${STACK}（${profile.label}）`);
console.log(`  项目名    ${PROJECT_NAME}`);
console.log(`  源码目录  ${SRC_DIR}`);
console.log(`  产物目录  ${BUILD_OUTPUT}`);
console.log('');

if (report.created.length) {
  console.log(`  新建 ${report.created.length} 个文件：`);
  for (const f of report.created) console.log(`    + ${f}`);
}
if (report.forced.length) {
  console.log(`\n  覆盖 ${report.forced.length} 个文件：`);
  for (const f of report.forced) console.log(`    ~ ${f}`);
}
if (report.skipped.length) {
  console.log(`\n  跳过 ${report.skipped.length} 个已存在的文件（用 --force 覆盖）：`);
  for (const f of report.skipped.slice(0, 8)) console.log(`    = ${f}`);
  if (report.skipped.length > 8) console.log(`    … 还有 ${report.skipped.length - 8} 个`);
}

if (DRY) {
  console.log('\n  （--dry-run，未写入任何文件）\n');
  process.exit(0);
}

console.log(`
下一步：
  1. 打开 AGENTS.md，改 §0 四条里跟本项目相关的措辞
  2. 打开 .spec/00-constitution.md，把「项目特有」几条改成实际约束
  3. 填 .memory/MEMORY.md 的 §0 断点
  4. 跑一次检查：node scripts/check-governance.cjs
  5. 启用提交闸门：git config core.hooksPath .githooks
`);
