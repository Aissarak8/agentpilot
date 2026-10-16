'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');
const { ClaudeUsageAdapter, CodexUsageAdapter, CostEstimator, UsageStore, usageAnalytics } = require('../usage');

const temporary = t => { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-usage-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true})); return path.join(dir,'usage.json'); };

test('Codex adapter parses only explicit structured usage and omits unavailable fields', () => {
  const adapter = new CodexUsageAdapter();
  assert.equal(adapter.normalize({ type:'turn.completed', thread_id:'s1' }), null);
  const record = adapter.normalize({ type:'turn.completed', thread_id:'s1', turn_id:'t1', model:'gpt-5.3-codex', usage:{ input_tokens:100, cached_input_tokens:20, output_tokens:12 } }, { project:'demo' });
  assert.deepEqual({provider:record.provider,input:record.inputTokens,cached:record.cachedInputTokens,output:record.outputTokens,total:record.totalTokens}, {provider:'codex',input:100,cached:20,output:12,total:112});
  assert.equal(record.reasoningTokens, undefined);
  assert.doesNotMatch(JSON.stringify(record), /prompt|secret|source_code/i);
});

test('Claude adapter parses documented statusline usage and deduplicates repeated prompts', () => {
  const adapter = new ClaudeUsageAdapter();
  const payload={session_id:'s',prompt_id:'p',model:{id:'claude-test'},workspace:{project_dir:'C:/work/demo'},context_window:{current_usage:{input_tokens:10,output_tokens:4,cache_creation_input_tokens:3,cache_read_input_tokens:5}}};
  const one=adapter.normalize(payload), two=adapter.normalize(payload);
  assert.equal(one.id,two.id); assert.equal(one.inputTokens,18); assert.equal(one.totalTokens,22); assert.equal(one.project,'demo');
});

test('store persists, bounds records and deduplicates across restart', () => {
  const file=temporary(test); const store=new UsageStore(file,{maxRecords:2,retentionDays:36500});
  const base={timestamp:new Date().toISOString(),provider:'codex',model:'m',project:'p',sessionId:'s',source:'x',confidence:'verified',accounting:'incremental',totalTokens:1};
  assert.equal(store.add({...base,id:'1'}).status,'stored'); assert.equal(store.add({...base,id:'1'}).status,'duplicate');
  store.add({...base,id:'2'}); store.add({...base,id:'3'});
  const restarted=new UsageStore(file,{maxRecords:2,retentionDays:36500}); assert.deepEqual(restarted.records.map(x=>x.id),['2','3']); assert.equal(restarted.add({...base,id:'3'}).status,'duplicate');
});

test('cumulative snapshots become increments without double counting', () => {
  const file=temporary(test); const store=new UsageStore(file,{retentionDays:36500});
  const base={timestamp:new Date().toISOString(),provider:'codex',model:'m',project:'p',sessionId:'s',source:'api',confidence:'verified',accounting:'cumulative'};
  store.add({...base,id:'1',inputTokens:100,outputTokens:20,totalTokens:120});
  store.add({...base,id:'2',inputTokens:130,outputTokens:27,totalTokens:157});
  assert.deepEqual(store.records.map(x=>x.totalTokens),[120,37]);
  assert.equal(store.add({...base,id:'old',inputTokens:90,outputTokens:10,totalTokens:100}).status,'stale');
  store.add({...base,id:'3',inputTokens:140,outputTokens:30,totalTokens:170});
  assert.equal(store.records.at(-1).totalTokens,13);
});

test('cost estimator handles cached input and makes unknown pricing unavailable', () => {
  const estimator=new CostEstimator({}, {'codex:m':{input:2,cachedInput:1,output:4,unit:1000,currency:'USD',source:'official',effectiveDate:'2026-01-01'}});
  const result=estimator.estimate({provider:'codex',model:'m',inputTokens:100,cachedInputTokens:50,outputTokens:25});
  assert.equal(result.available,true); assert.equal(result.amount,0.25);
  assert.deepEqual(new CostEstimator().estimate({provider:'claude',model:'unknown'}),{available:false,reason:'pricing_unavailable'});
});

test('manual pricing overrides apply and cache creation requires an explicit rate', () => {
  const estimator=new CostEstimator({'claude:m':{input:3,cachedInput:0.3,cacheCreationInput:3.75,output:15,unit:1_000_000,currency:'USD'}});
  assert.equal(estimator.estimate({provider:'claude',model:'m',inputTokens:10,cacheCreationInputTokens:4,outputTokens:2}).available,true);
  assert.equal(new CostEstimator({}, {'claude:m':{input:3,output:15}}).estimate({provider:'claude',model:'m',cacheCreationInputTokens:1}).reason,'cache_creation_pricing_unavailable');
});

test('analytics groups data and honors date windows', () => {
  const now=new Date(), old=new Date(now.getTime()-40*86400000).toISOString();
  const records=[{timestamp:now.toISOString(),provider:'codex',model:'x',project:'a',totalTokens:10},{timestamp:old,provider:'claude',model:'y',project:'b',totalTokens:20}];
  const data=usageAnalytics(records,new CostEstimator(),{days:30});
  assert.equal(data.totals.records,1); assert.equal(data.byProvider.codex.totalTokens,10); assert.equal(data.byProvider.claude,undefined);
});

test('malformed and oversized stores fail closed without exposing content', () => {
  const file=temporary(test); fs.writeFileSync(file,'not json'); assert.deepEqual(new UsageStore(file).records,[]);
  fs.writeFileSync(file,'x'.repeat(5*1024*1024+1)); assert.deepEqual(new UsageStore(file).records,[]);
});

test('analytics uses local calendar dates and pricing retains provenance', () => {
  const record={timestamp:'2026-10-16T12:00:00Z',provider:'codex',model:'gpt-5.3-codex',project:'p',totalTokens:1};
  const estimator=new CostEstimator(), result=usageAnalytics([record],estimator,{days:0});
  assert.equal(Object.keys(result.daily).length,1);
  const estimate=estimator.estimate(record); assert.equal(estimate.available,true); assert.match(estimate.rate.source,/developers\.openai\.com/); assert.ok(estimate.rate.effectiveDate);
});

test('date filtering starts at local midnight rather than a rolling hour', () => {
  const now=new Date(2026,9,16,18,0,0), start=new Date(2026,9,10,0,0,0).toISOString(), before=new Date(2026,9,9,23,59,59).toISOString();
  const records=[start,before].map((timestamp,index)=>({timestamp,provider:'codex',model:'m',project:'p',totalTokens:index+1}));
  const result=usageAnalytics(records,new CostEstimator(),{days:7,now}); assert.equal(result.totals.records,1); assert.equal(result.totals.totalTokens,1);
});

test('Claude local collector persists metadata without private payload fields', t => {
  const file=temporary(t), dir=path.dirname(file);
  const payload={session_id:'session',prompt_id:'prompt',model:{id:'claude-test'},workspace:{project_dir:'C:/work/project'},context_window:{current_usage:{input_tokens:2,output_tokens:1}},transcript:'PRIVATE CONVERSATION',api_key:'PRIVATE SECRET'};
  const result=spawnSync(process.execPath,['scripts/usage.js','claude-statusline'],{cwd:path.join(__dirname,'..'),input:JSON.stringify(payload),encoding:'utf8',env:{...process.env,AGENTPILOT_DATA_DIR:dir}});
  assert.equal(result.status,0,result.stderr); const raw=fs.readFileSync(file,'utf8'); assert.doesNotMatch(raw,/PRIVATE|transcript|api_key/); assert.equal(JSON.parse(raw).records[0].totalTokens,3);
});
