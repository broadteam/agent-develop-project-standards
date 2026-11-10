#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const agents = fs.readFileSync(path.join(root, 'template/AGENTS.md'), 'utf8');
const memory = fs.readFileSync(path.join(root, 'template/.memory/MEMORY.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'MIGRATION-v1.2.md'), 'utf8');

assert.match(agents, /每次会话的最小开工动作/);
assert.match(agents, /轻量任务/);
assert.match(agents, /无需为了形式创建任务卡/);
assert.match(agents, /高风险操作/);
assert.match(agents, /不要求每个轻量任务重复通读/);
assert.match(agents, /不是每次会话的固定步骤/);
assert.match(agents, /默认不读/);
assert.match(memory, /开工基线/);
assert.doesNotMatch(memory, /开工前必读.*constitution/);
assert.match(readme, /按需治理/);
assert.match(readme, /轻量任务不强制建卡/);
assert.match(readme, /MIGRATION-v1\.2\.md/);
assert.match(changelog, /## 1\.2\.0/);
assert.match(migration, /高风险操作/);
assert.ok(Buffer.byteLength(agents, 'utf8') <= 12288, 'AGENTS.md must remain within the default 12 KB budget');

console.log('test-policy: all cases passed');
