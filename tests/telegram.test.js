const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { TelegramDelivery, formatTelegramMessage, telegramRequest } = require('../telegram');

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
  await assert.rejects(telegramRequest('12345:abcdefghijklmnopqrstuvwxyz', 'getMe', {}, { requestImpl }), error => !error.message.includes('12345:'));
});

test('permission and session-end events are deliverable', async () => {
  const seen=[]; const delivery=new TelegramDelivery({send:async(token,chat,text)=>seen.push(text)}); const config={enabled:true,token:'x',chatId:'1'};
  assert.equal((await delivery.deliver({...event,id:'a',kind:'attention'},config)).status,'delivered');
  assert.equal((await delivery.deliver({...event,id:'b',kind:'session_ended'},config)).status,'delivered'); assert.equal(seen.length,2);
});
