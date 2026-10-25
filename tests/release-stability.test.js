'use strict';

const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const test=require('node:test');
const {ChatSessionStore}=require('../chat-store');
const {TaskStore}=require('../codex-task-runner');
const {DeliveryQueue}=require('../delivery-queue');
const {NotificationClaims}=require('../notification-claims');
const {AdvisorFeedbackStore}=require('../smart-model-advisor');
const {UsageStore}=require('../usage');

const corruptFile=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-corrupt-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'store.json'),bytes=Buffer.from('{"partial":');fs.writeFileSync(file,bytes);return{file,bytes};};

test('metadata stores fail closed without overwriting malformed files',t=>{
  for(const Store of [ChatSessionStore,TaskStore]){const {file,bytes}=corruptFile(t),store=new Store(file);assert.throws(()=>Store===ChatSessionStore?store.create({project:'p'}):store.start({id:'x',project:'p',startedAt:new Date().toISOString()}),error=>error.code==='store_corrupt');assert.deepEqual(fs.readFileSync(file),bytes);}
  {const {file,bytes}=corruptFile(t),store=new UsageStore(file);assert.equal(store.add({id:'x',timestamp:new Date().toISOString(),provider:'codex',model:'m',project:'p',sessionId:'s',source:'test',accounting:'incremental',totalTokens:1}).status,'store_corrupt');assert.deepEqual(fs.readFileSync(file),bytes);}
  {const {file,bytes}=corruptFile(t),queue=new DeliveryQueue(file);assert.equal(queue.enqueue({id:'x'}).status,'store_corrupt');assert.deepEqual(fs.readFileSync(file),bytes);}
  {const {file,bytes}=corruptFile(t),claims=new NotificationClaims(file);assert.equal(claims.claim('x'),false);assert.deepEqual(fs.readFileSync(file),bytes);}
  {const {file,bytes}=corruptFile(t),feedback=new AdvisorFeedbackStore(file);assert.equal(feedback.add({model:'m',category:'debugging',outcome:'successful'}).reason,'store_corrupt');assert.deepEqual(fs.readFileSync(file),bytes);}
});

test('event appends remain deduplicated under the shared file lock',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-events-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'events.jsonl'),{appendEvent,readEvents}=require('../core'),event={id:'same',time:new Date().toISOString(),agent:'codex',kind:'completed',project:'p'};assert.equal(appendEvent(file,event).stored,true);assert.equal(appendEvent(file,event).reason,'duplicate');assert.equal(readEvents(file).length,1);});

test('Dashboard onboarding explains that model discovery requires explicit Chat authorization',()=>{const Module=require('module'),original=Module._load;Module._load=function(name,...args){if(name==='vscode')return{};return original.call(this,name,...args);};const {advisorMarkup}=require('../extension');Module._load=original;const html=advisorMarkup({models:[],result:null});assert.match(html,/Opening the Dashboard never starts Codex/);assert.match(html,/explicitly authorize an AgentPilot-owned Codex conversation/);});

test('opening Dashboard cannot auto-start Codex and idle polling skips full rerenders',()=>{const source=fs.readFileSync(path.join(__dirname,'..','extension.js'),'utf8'),openLine=source.split(/\r?\n/).find(line=>line.includes("registerCommand('agentpilot.openDashboard'")),refreshLine=source.split(/\r?\n/).find(line=>line.includes('const refresh = async'));assert.ok(openLine);assert.doesNotMatch(openLine,/ensureClient/);assert.match(refreshLine,/if\(fresh\.length\)await updateDashboard/);});

test('Dashboard reports corrupt usage and Telegram storage without exposing contents',()=>{const Module=require('module'),original=Module._load;Module._load=function(name,...args){if(name==='vscode')return{};return original.call(this,name,...args);};const {render,usageMarkup}=require('../extension');Module._load=original;const analytics={storageStatus:'corrupt',totals:{records:0},byProvider:{},byModel:{},byProject:{},bySource:{},daily:{},weekly:{},records:[]};assert.match(usageMarkup(analytics),/will not overwrite it/);const html=render([],{connected:false,enabled:true,history:{storageStatus:'corrupt',counts:{},recent:[]}},analytics,'nonce');assert.match(html,/Delivery history needs attention/);assert.doesNotMatch(html,/\{"partial"/);});

test('VSIX excludes development-only images, audits, tests, credentials and local stores',()=>{const ignore=fs.readFileSync(path.join(__dirname,'..','.vscodeignore'),'utf8');for(const pattern of ['docs/**','agentpilot-readme-screenshots/**','tests/**','.env.*','**/auth.json','**/credentials.json','*.jsonl','.agentpilot/**','RELEASE_READINESS_REPORT.md','TOKEN_USAGE_AUDIT.md'])assert.ok(ignore.includes(pattern),pattern);for(const runtime of ['extension.js','codex-app-server.js','scripts/hook.py','scripts/windows-toast.ps1'])assert.equal(ignore.split(/\r?\n/).includes(runtime),false,runtime);});
