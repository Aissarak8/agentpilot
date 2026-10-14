const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { TelegramDelivery, describeTelegramError, formatTelegramMessage, telegramRequest, validToken } = require('../telegram');

const event = { id:'evt-1', time:'2026-10-14T10:30:00.000Z', agent:'codex', kind:'completed', project:'agentpilot', test:false };

test('formats Telegram messages with metadata only', () => {
  const text = formatTelegramMessage({ ...event, prompt:'PRIVATE', sourceCode:'SECRET' });
  assert.match(text, /Agent: codex/); assert.match(text, /Event: completed/); assert.match(text, /Project: agentpilot/); assert.match(text, /2026-10-14T10:30:00.000Z/);
  assert.doesNotMatch(text, /PRIVATE|SECRET|prompt|sourceCode/);
});

test('disabled Telegram delivery does not call network', async () => {
  let calls = 0; const delivery = new TelegramDelivery({ send:async()=>{ calls++; } });
  assert.equal((await delivery.deliver(event, { enabled:false, token:'x', chatId:'1' })).status, 'disabled'); assert.equal(calls, 0);
});

test('missing Telegram configuration does not call network', async () => {
  let calls = 0; const delivery = new TelegramDelivery({ send:async()=>{ calls++; } });
  assert.equal((await delivery.deliver(event, { enabled:true })).status, 'missing_configuration'); assert.equal(calls, 0);
});

test('deduplicates Telegram notifications by event id', async () => {
  let calls = 0; const delivery = new TelegramDelivery({ send:async()=>{ calls++; } }); const config={ enabled:true, token:'token', chatId:'1' };
  assert.equal((await delivery.deliver(event, config)).status, 'delivered'); assert.equal((await delivery.deliver(event, config)).status, 'duplicate'); assert.equal(calls, 1);
});

test('delivery failures are contained and sanitized', async () => {
  const delivery = new TelegramDelivery({ send:async()=>{ throw new Error('Telegram network request failed'); } });
  const result = await delivery.deliver(event, { enabled:true, token:'secret-token', chatId:'1' });
  assert.equal(result.status, 'failed'); assert.equal(result.message, 'Telegram network request failed'); assert.doesNotMatch(JSON.stringify(result), /secret-token/);
});

test('Telegram HTTP failures reject without exposing token', async () => {
  const requestImpl = (options, callback) => { const req = new EventEmitter(); req.end = () => { const res = new EventEmitter(); res.statusCode = 401; res.setEncoding = () => {}; callback(res); res.emit('data', '{"ok":false,"description":"unauthorized"}'); res.emit('end'); }; req.destroy = error => req.emit('error', error); return req; };
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz', 'getMe', {}, { requestImpl }), error => error.code === 'invalid_token' && error.httpStatus === 401 && !error.message.includes('12345:'));
});

test('distinguishes timeout from network failure', async () => {
  const timeoutRequest = () => { const req=new EventEmitter(); req.end=()=>req.emit('timeout'); req.destroy=()=>req.emit('error',new Error('socket closed')); return req; };
  const networkRequest = () => { const req=new EventEmitter(); req.end=()=>req.emit('error',new Error('dns details')); req.destroy=()=>{}; return req; };
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz','getMe',{}, {requestImpl:timeoutRequest,timeoutMs:25}), error=>error.code==='timeout');
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz','getMe',{}, {requestImpl:networkRequest}), error=>error.code==='network' && !error.message.includes('dns details'));
});

test('classifies other HTTP failures', async () => {
  const responseFor = status => (options,callback) => { const req=new EventEmitter(); req.destroy=()=>{}; req.end=()=>{const res=new EventEmitter();res.statusCode=status;res.setEncoding=()=>{};callback(res);res.emit('data','{"ok":false}');res.emit('end');};return req;};
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz','getMe',{}, {requestImpl:responseFor(403)}), error=>error.code==='forbidden');
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz','getMe',{}, {requestImpl:responseFor(429)}), error=>error.code==='rate_limited');
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz','getMe',{}, {requestImpl:responseFor(500)}), error=>error.code==='http_error' && error.httpStatus===500);
});

test('trims copy-paste whitespace without weakening token validation', () => {
  assert.equal(validToken('  12345:abcdefghijklmnopqrstuvwxyz\r\n'),true);
  assert.equal(validToken('12345:abc defghijklmnopqrstuvwxyz'),false);
});

test('provides actionable sanitized error messages', () => {
  assert.match(describeTelegramError({code:'invalid_token'}),/HTTP 401/);
  assert.match(describeTelegramError({code:'timeout'}),/timeout/);
  assert.match(describeTelegramError({code:'network'}),/api\.telegram\.org/);
  assert.doesNotMatch(describeTelegramError({code:'unknown',message:'12345:secret'}),/12345:secret/);
});

test('permission and session-end events are deliverable', async () => {
  const seen=[]; const delivery=new TelegramDelivery({send:async(token,chat,text)=>seen.push(text)}); const config={enabled:true,token:'x',chatId:'1'};
  assert.equal((await delivery.deliver({...event,id:'a',kind:'attention'},config)).status,'delivered');
  assert.equal((await delivery.deliver({...event,id:'b',kind:'session_ended'},config)).status,'delivered'); assert.equal(seen.length,2);
});
