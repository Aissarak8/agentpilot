'use strict';

const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { spawnSync }=require('child_process');
const test=require('node:test');
const { CodexUsageStreamCollector, modelFromArgs }=require('../codex-usage-stream');
const { CodexUsageAdapter, UsageStore }=require('../usage');

const setup=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-codex-usage-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {file:path.join(dir,'usage.json'),store:new UsageStore(path.join(dir,'usage.json'),{retentionDays:36500})};};

test('collects the real Codex CLI JSONL shape without retaining message content',t=>{
  const {file,store}=setup(t), collector=new CodexUsageStreamCollector(store,{project:'repo',model:'gpt-test'});
  collector.consume('{"type":"thread.started","thread_id":"thread-real"}\n{"type":"item.completed","item":{"id":"item","type":"agent_message","text":"PRIVATE RESPONSE"}}\n');
  collector.consume('{"type":"turn.completed","usage":{"input_tokens":13651,"cached_input_tokens":200,"cache_write_input_tokens":0,"output_tokens":5,"reasoning_output_tokens":2}}\n');
  const record=JSON.parse(fs.readFileSync(file,'utf8')).records[0];
  assert.deepEqual({source:record.source,session:record.sessionId,model:record.model,input:record.inputTokens,cached:record.cachedInputTokens,output:record.outputTokens,reasoning:record.reasoningTokens,total:record.totalTokens},{source:'codex-cli-json',session:'thread-real',model:'gpt-test',input:13651,cached:200,output:5,reasoning:2,total:13656});
  assert.doesNotMatch(JSON.stringify(record),/PRIVATE|agent_message|item/);
});

test('stream collector handles chunk boundaries, malformed lines and persistent duplicates',t=>{
  const {file,store}=setup(t), first=new CodexUsageStreamCollector(store,{project:'repo'});
  first.consume('{bad}\n{"type":"thread.started","thread_id":"same"}\n{"type":"turn.comp');
  first.consume('leted","usage":{"input_tokens":10,"output_tokens":2}}'); first.finish();
  const restarted=new CodexUsageStreamCollector(new UsageStore(file,{retentionDays:36500}),{project:'repo'});
  restarted.consume('{"type":"thread.started","thread_id":"same"}\n{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":2}}\n');
  assert.equal(restarted.results[0].status,'duplicate'); assert.equal(new UsageStore(file,{retentionDays:36500}).records.length,1);
});

test('normalizes documented app-server token usage notification using last-turn counts',()=>{
  const record=new CodexUsageAdapter().normalize({method:'thread/tokenUsage/updated',params:{threadId:'thread',turnId:'turn',tokenUsage:{last:{inputTokens:20,cachedInputTokens:4,cacheWriteInputTokens:1,outputTokens:3,reasoningOutputTokens:2,totalTokens:23},total:{inputTokens:200,outputTokens:30,totalTokens:230}}}},{project:'repo',model:'gpt-test'});
  assert.deepEqual({source:record.source,accounting:record.accounting,input:record.inputTokens,total:record.totalTokens,reasoning:record.reasoningTokens},{source:'codex-app-server',accounting:'incremental',input:20,total:23,reasoning:2});
});

test('extracts only explicitly supplied CLI model attribution',()=>{
  assert.equal(modelFromArgs(['exec','--model','gpt-a']),'gpt-a'); assert.equal(modelFromArgs(['exec','--model=gpt-b']),'gpt-b'); assert.equal(modelFromArgs(['exec']),undefined);
});

test('Windows wrapper rejects shell launchers before executing them',()=>{
  if(process.platform!=='win32')return;
  const result=spawnSync(process.execPath,['scripts/codex-exec.js','--codex-path=unsafe.cmd','harmless'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
  assert.equal(result.status,2); assert.match(result.stderr,/native codex\.exe/);
});
