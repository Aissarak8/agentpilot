'use strict';

const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const test=require('node:test');
const {UsageReconciliationStore,dryRun}=require('../usage-reconciliation');

function setup(t,records){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-reconcile-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const usage=path.join(dir,'usage.json'),projection=path.join(dir,'usage-reconciliation.json');fs.writeFileSync(usage,JSON.stringify({version:1,records,cursors:{}}));return{dir,usage,projection,store:new UsageReconciliationStore(usage,projection)};}
const base={provider:'codex',model:'m',project:'p',sessionId:'session',source:'codex-app-server',confidence:'verified',accounting:'incremental'};

test('dry-run reports raw and candidate totals while preserving ambiguous legacy records',t=>{const env=setup(t,[
  {...base,id:'one',timestamp:'2026-10-22T10:00:00Z',inputTokens:90,outputTokens:10,totalTokens:100},
  {...base,id:'two',timestamp:'2026-10-22T10:01:00Z',inputTokens:135,outputTokens:15,totalTokens:150},
  {...base,id:'cli',timestamp:'2026-10-22T10:02:00Z',source:'codex-cli-json',inputTokens:20,cachedInputTokens:5,outputTokens:2,reasoningTokens:1,totalTokens:22}
]);const report=env.store.dryRun();assert.equal(report.rawTotals.totalTokens,272);assert.equal(report.candidateTotals.totalTokens,172);assert.equal(report.uncertainRecordCount,2);assert.equal(report.verifiedRecordCount,1);assert.equal(report.ambiguousGroups[0].reason,'legacy_turn_ids_unavailable');assert.deepEqual(report.provenExcludedRecordIds,[]);assert.equal(fs.existsSync(env.projection),false);});

test('turn boundaries produce a candidate estimate but remain explicitly uncertain',t=>{const env=setup(t,[100,150,40,60].map((total,index)=>({...base,id:String(index),timestamp:`2026-10-22T10:0${index}:00Z`,totalTokens:total})));const report=dryRun(env.usage);assert.equal(report.rawTotals.totalTokens,350);assert.equal(report.candidateTotals.totalTokens,210);assert.equal(report.ambiguousGroups[0].runCount,2);assert.equal(report.uncertainRecordCount,4);});

test('modern normalized app-server and CLI records remain verified and source-isolated',t=>{const env=setup(t,[
  {...base,id:'app',timestamp:'2026-10-22T10:00:00Z',turnId:'turn',sourceAccounting:'cumulative',totalTokens:12},
  {...base,id:'cli',timestamp:'2026-10-22T10:01:00Z',source:'codex-cli-json',sessionId:'session',totalTokens:12}
]);const report=env.store.dryRun();assert.equal(report.verifiedRecordCount,2);assert.equal(report.uncertainRecordCount,0);assert.equal(report.rawTotals.totalTokens,24);assert.equal(report.candidateTotals.totalTokens,24);});

test('projection requires a verified backup, never mutates raw usage, and rolls back',t=>{const env=setup(t,[{...base,id:'one',timestamp:'2026-10-22T10:00:00Z',totalTokens:100}]),before=fs.readFileSync(env.usage);const report=env.store.dryRun();assert.equal(env.store.apply(report).status,'backup_required');const backup=env.store.backup(report,new Date('2026-10-22T12:00:00Z'));assert.equal(backup.status,'backed_up');assert.equal(backup.checksum,report.sourceChecksum);assert.deepEqual(fs.readFileSync(backup.backupFile),before);assert.equal(env.store.apply(report,backup).status,'applied');assert.equal(env.store.load().status,'active');assert.deepEqual(fs.readFileSync(env.usage),before);assert.equal(env.store.rollback().status,'rolled_back');assert.equal(env.store.load().status,'none');assert.deepEqual(fs.readFileSync(env.usage),before);});

test('projection application is idempotent and lock-safe',t=>{const env=setup(t,[{...base,id:'one',timestamp:'2026-10-22T10:00:00Z',totalTokens:100}]),report=env.store.dryRun(),backup=env.store.backup(report,new Date('2026-10-22T12:00:00Z'));assert.equal(env.store.apply(report,backup).status,'applied');assert.equal(env.store.apply(report,backup).status,'applied');fs.mkdirSync(`${env.projection}.lock`);assert.equal(env.store.apply(report,backup).status,'busy');});

test('checksum conflicts detect events arriving after dry-run or projection',t=>{const env=setup(t,[{...base,id:'one',timestamp:'2026-10-22T10:00:00Z',totalTokens:100}]),report=env.store.dryRun(),backup=env.store.backup(report,new Date('2026-10-22T12:00:00Z'));fs.writeFileSync(env.usage,JSON.stringify({version:1,records:[{...base,id:'new',timestamp:'2026-10-22T10:01:00Z',totalTokens:200}],cursors:{}}));assert.equal(env.store.apply(report,backup).status,'stale');assert.equal(env.store.load().status,'none');});

test('active projection becomes stale after a concurrent source write',t=>{const env=setup(t,[{...base,id:'one',timestamp:'2026-10-22T10:00:00Z',totalTokens:100}]),report=env.store.dryRun(),backup=env.store.backup(report,new Date('2026-10-22T12:00:00Z'));env.store.apply(report,backup);fs.appendFileSync(env.usage,' ');assert.equal(env.store.load().status,'stale');const view=env.store.records(JSON.parse(fs.readFileSync(env.usage,'utf8')).records);assert.equal(view.records.length,1);});

test('reconciliation metadata contains no private payload fields',t=>{const env=setup(t,[{...base,id:'one',timestamp:'2026-10-22T10:00:00Z',totalTokens:100,prompt:'PRIVATE PROMPT',response:'PRIVATE RESPONSE'}]),report=env.store.dryRun(),backup=env.store.backup(report,new Date('2026-10-22T12:00:00Z'));env.store.apply(report,backup);const metadata=fs.readFileSync(env.projection,'utf8');assert.doesNotMatch(metadata,/PRIVATE|prompt|response/);});
