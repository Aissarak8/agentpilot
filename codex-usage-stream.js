'use strict';

const path = require('path');
const { CodexUsageAdapter } = require('./usage');

class CodexUsageStreamCollector {
  constructor(store, options = {}) {
    this.store = store;
    this.project = options.project || path.basename(process.cwd());
    this.model = options.model;
    this.sessionId = undefined;
    this.buffer = '';
    this.maxLineBytes = options.maxLineBytes || 2 * 1024 * 1024;
    this.adapter = options.adapter || new CodexUsageAdapter();
    this.onPayload = options.onPayload;
    this.onUsage = options.onUsage;
    this.results = [];
  }
  consume(chunk) {
    this.buffer += String(chunk);
    if (Buffer.byteLength(this.buffer, 'utf8') > this.maxLineBytes && !this.buffer.includes('\n')) { this.buffer=''; return; }
    let newline;
    while ((newline=this.buffer.indexOf('\n')) >= 0) { const line=this.buffer.slice(0,newline); this.buffer=this.buffer.slice(newline+1); this.consumeLine(line); }
  }
  finish() { if(this.buffer.trim()) this.consumeLine(this.buffer); this.buffer=''; return this.results; }
  consumeLine(line) {
    let payload; try { payload=JSON.parse(line); } catch { return null; }
    this.onPayload?.(payload);
    if(payload.type==='thread.started' && typeof payload.thread_id==='string') this.sessionId=payload.thread_id;
    if(payload.type!=='turn.completed' || !payload.usage) return null;
    const record=this.adapter.normalize(payload,{source:'codex-cli-json',sessionId:this.sessionId,project:this.project,model:this.model,accounting:'incremental'});
    if(!record) return null;
    const result=this.store.add(record); this.results.push(result); this.onUsage?.(record,result); return result;
  }
}

function modelFromArgs(args) {
  for(let index=0;index<args.length;index++){if(args[index]==='-m'||args[index]==='--model')return args[index+1];if(args[index].startsWith('--model='))return args[index].slice(8);}
  return undefined;
}

module.exports={ CodexUsageStreamCollector, modelFromArgs };
