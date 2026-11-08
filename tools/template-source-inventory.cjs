'use strict';

/**
 * Deterministic snapshot of all files that can affect an installed standards
 * release. It is read-only and never follows symlinks.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function walk(root, relative, entries) {
  const absolute = path.join(root, ...relative.split('/'));
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') {
      entries.push({ path: relative, kind: 'missing' });
      return;
    }
    throw error;
  }
  if (stat.isSymbolicLink()) {
    entries.push({
      path: relative,
      kind: 'symlink',
      target: fs.readlinkSync(absolute),
      mode: stat.mode & 0o777
    });
    return;
  }
  if (stat.isDirectory()) {
    entries.push({ path: relative, kind: 'directory' });
    for (const name of fs.readdirSync(absolute).sort()) {
      walk(root, relative + '/' + name, entries);
    }
    return;
  }
  if (stat.isFile()) {
    const bytes = fs.readFileSync(absolute);
    entries.push({
      path: relative,
      kind: 'file',
      sha256: sha256(bytes),
      mode: stat.mode & 0o777
    });
    return;
  }
  entries.push({ path: relative, kind: 'special', mode: stat.mode & 0o777 });
}
function buildTemplateSourceInventory(standardsRoot) {
  const root = path.resolve(standardsRoot);
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error('规范仓库根目录必须是真实目录');
  }
  const entries = [];
  walk(root, 'init.cjs', entries);
  walk(root, 'template', entries);
  walk(root, 'presets/stacks', entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const canonical = JSON.stringify(entries);
  return {
    sha256: sha256(Buffer.from(canonical, 'utf8')),
    entries
  };
}

module.exports = { buildTemplateSourceInventory };
