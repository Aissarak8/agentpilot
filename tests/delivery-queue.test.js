const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DeliveryQueue } = require('../delivery-queue');
const { TelegramError } = require('../telegram');

const event = (overrides={}) => ({ id:'event-1', time:'2026-10-14T10:00:00Z', agent:'codex', kind:'completed', project:'demo', sessionId:'session-1', test:false, prompt:'PRIVATE', sourceCode:'SECRET', ...overrides });
const setup = options => { const directory=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-queue-')); const file=path.join(directory,'queue.json'); return { file, queue:new DeliveryQueue(file, options) }; };
const config = { enabled:true, token:'TOKEN_PRIVATE', chatId:'CHAT_PRIVATE' };

test('persists successful delivery and Telegram message id without private data', async () => {
  const {file,queue}=setup({send:async()=>({message_id:42})}); queue.enqueue(event());
  assert.equal((await queue.process(config)).status,'sent');
  const item=queue.items[0]; assert.equal(item.status,'sent'); assert.equal(item.attemptCount,1); assert.equal(item.telegramMessageId,42);
  const raw=fs.readFileSync(file,'utf8'); assert.doesNotMatch(raw,/TOKEN_PRIVATE|CHAT_PRIVATE|PRIVATE|SECRET|prompt|sourceCode/);
});

test('deduplicates persistently across restart', () => {
  const {file,queue}=setup(); assert.equal(queue.enqueue(event()).status,'queued');
  const restarted=new DeliveryQueue(file); assert.equal(restarted.enqueue(event()).status,'duplicate'); assert.equal(restarted.items.length,1);
});

test('restart marks an interrupted sending item uncertain', () => {
  const {file,queue}=setup(); queue.enqueue(event()); queue.items[0].status='sending'; queue.save();
  const restarted=new DeliveryQueue(file); assert.equal(restarted.items[0].status,'uncertain'); assert.equal(restarted.items[0].lastErrorCategory,'interrupted_during_send');
});

test('single worker prevents simultaneous sends', async () => {
  let release, calls=0; const wait=new Promise(resolve=>{release=resolve;});
  const {queue}=setup({send:async()=>{calls++;await wait;return{message_id:1};}}); queue.enqueue(event());
  const first=queue.process(config); assert.equal((await queue.process(config)).status,'busy'); release(); assert.equal((await first).status,'sent'); assert.equal(calls,1);
});

test('401 and 403 are terminal failures', async () => {
  for (const [code,status] of [['invalid_token',401],['forbidden',403]]) { const {queue}=setup({send:async()=>{throw new TelegramError(code,'safe',status,{httpStatus:status});}}); queue.enqueue(event()); const result=await queue.process(config); assert.equal(result.status,'failed'); assert.equal(result.item.nextRetryAt,null); }
});

test('429 respects bounded retry_after', async () => {
  const clock=Date.parse('2026-10-14T10:00:00Z'); const error=new TelegramError('rate_limited','safe',429,{httpStatus:429,retryAfter:12});
  const {queue}=setup({now:()=>clock,send:async()=>{throw error;}}); queue.enqueue(event()); const result=await queue.process(config);
  assert.equal(result.status,'pending'); assert.equal(Date.parse(result.item.nextRetryAt),clock+12000);
});

test('HTTP 5xx schedules bounded exponential backoff', async () => {
  let clock=Date.parse('2026-10-14T10:00:00Z'); const {queue}=setup({now:()=>clock,random:()=>0.5,send:async()=>{throw new TelegramError('http_error','safe',503,{httpStatus:503});}}); queue.enqueue(event());
  const first=await queue.process(config); assert.equal(first.status,'pending'); assert.equal(Date.parse(first.item.nextRetryAt),clock+5000);
  clock+=5000; const second=await queue.process(config); assert.equal(Date.parse(second.item.nextRetryAt),clock+10000); assert.equal(second.item.attemptCount,2);
});

test('timeout is uncertain and never automatically retried', async () => {
  const {queue}=setup({send:async()=>{throw new TelegramError('timeout','safe');}}); queue.enqueue(event()); const result=await queue.process(config);
  assert.equal(result.status,'uncertain'); assert.equal(result.item.nextRetryAt,null); assert.equal((await queue.process(config)).status,'idle');
});

test('disabled Telegram and missing credentials do not call network', async () => {
  let calls=0; const {queue}=setup({send:async()=>{calls++;}}); queue.enqueue(event()); assert.equal((await queue.process({...config,enabled:false})).status,'disabled'); assert.equal(calls,0);
  const result=await queue.process({enabled:true}); assert.equal(result.status,'failed'); assert.equal(result.item.lastErrorCategory,'missing_configuration'); assert.equal(calls,0);
});

test('completed event suppresses normal SessionEnd while exceptional SessionEnd is configurable', () => {
  const {queue}=setup(); queue.enqueue(event());
  assert.equal(queue.enqueue(event({id:'end-1',kind:'session_ended'})).status,'suppressed_completed_session');
  assert.equal(queue.enqueue(event({id:'end-2',kind:'session_ended',sessionId:'different'}),{notifyExceptionalSessionEnd:false}).status,'session_end_disabled');
  assert.equal(queue.enqueue(event({id:'end-3',kind:'session_ended',sessionId:'different'}),{notifyExceptionalSessionEnd:true}).status,'queued');
});

test('manual retry requires failed or uncertain state', async () => {
  const {queue}=setup({send:async()=>{throw new TelegramError('timeout','safe');}}); queue.enqueue(event()); await queue.process(config);
  assert.equal(queue.manualRetry('event-1'),true); assert.equal(queue.items[0].status,'pending'); assert.equal(queue.manualRetry('event-1'),false);
});

test('multiple windows preserve queued events and persistent deduplication',()=>{const {file,queue:first}=setup(),second=new DeliveryQueue(file);assert.equal(first.enqueue(event({id:'one'})).status,'queued');assert.equal(second.enqueue(event({id:'two'})).status,'queued');assert.equal(second.enqueue(event({id:'one'})).status,'duplicate');assert.deepEqual(new DeliveryQueue(file).items.map(item=>item.sourceEventId).sort(),['one','two']);});

test('multiple workers claim a delivery once and do not mark an active send uncertain',async()=>{let releaseSend,calls=0;const gate=new Promise(resolve=>{releaseSend=resolve;}),{file,queue:first}=setup({send:async()=>{calls++;await gate;return{message_id:9};}}),second=new DeliveryQueue(file,{send:async()=>{calls++;return{message_id:10};}});first.enqueue(event());const active=first.process(config);await new Promise(resolve=>setImmediate(resolve));const observer=new DeliveryQueue(file);assert.equal(observer.items[0].status,'sending');assert.equal((await second.process(config)).status,'idle');releaseSend();assert.equal((await active).status,'sent');assert.equal(calls,1);assert.equal(new DeliveryQueue(file).items[0].telegramMessageId,9);});
