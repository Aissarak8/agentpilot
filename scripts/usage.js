#!/usr/bin/env node
'use strict';

const os = require('os');
const path = require('path');
const { ClaudeUsageAdapter, CodexUsageAdapter, UsageStore } = require('../usage');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { if (input.length < 1024 * 1024) input += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const adapter = process.argv[2] === 'claude-statusline' ? new ClaudeUsageAdapter() : new CodexUsageAdapter();
    const record = adapter.normalize(payload, { project: path.basename(process.cwd()) });
    const base = process.env.AGENTPILOT_DATA_DIR || path.join(os.homedir(), '.agentpilot');
    if (record) new UsageStore(path.join(base, 'usage.json')).add(record);
  } catch { process.exitCode = 0; }
});
