'use strict';

const https = require('https');

const TELEGRAM_HOST = 'api.telegram.org';
const DEFAULT_TIMEOUT_MS = 8000;
const ALLOWED_KINDS = new Set(['completed', 'attention', 'session_ended']);

function validToken(token) {
  return typeof token === 'string' && /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token);
}

function validChatId(chatId) {
  return typeof chatId === 'string' && (/^-?\d{1,20}$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(chatId));
}

function formatTelegramMessage(event, { test = false } = {}) {
  const safe = value => String(value || 'unknown').replace(/[\r\n\t]+/g, ' ').slice(0, 160);
  const timestamp = Number.isNaN(Date.parse(event.time)) ? safe(event.time) : new Date(event.time).toISOString();
  return [test ? 'AgentPilot test notification' : 'AgentPilot agent notification', `Agent: ${safe(event.agent)}`, `Event: ${safe(event.kind)}`, `Project: ${safe(event.project)}`, `Time: ${timestamp}`].join('\n');
}

function telegramRequest(token, method, payload, options = {}) {
  const requestImpl = options.requestImpl || https.request;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  if (!validToken(token)) return Promise.reject(new Error('Invalid Telegram bot token format'));
  const body = JSON.stringify(payload || {});
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    const req = requestImpl({ hostname: TELEGRAM_HOST, port: 443, path: `/bot${token}/${method}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: timeoutMs }, res => {
      let data = '';
      res.setEncoding?.('utf8');
      res.on('data', chunk => { if (data.length < 65536) data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return finish(reject, new Error(`Telegram returned an invalid response (HTTP ${res.statusCode || 0})`)); }
        if (res.statusCode >= 200 && res.statusCode < 300 && parsed.ok === true) return finish(resolve, parsed.result);
        finish(reject, new Error(`Telegram request failed (HTTP ${res.statusCode || 0})`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Telegram request timed out')));
    req.on('error', () => finish(reject, new Error('Telegram network request failed')));
    req.end(body);
  });
}

function validateBotToken(token, options) { return telegramRequest(token, 'getMe', {}, options); }
function sendTelegramMessage(token, chatId, text, options) {
  if (!validChatId(chatId)) return Promise.reject(new Error('Invalid Telegram chat ID format'));
  return telegramRequest(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true }, options);
}

class TelegramDelivery {
  constructor({ send = sendTelegramMessage, maxPerMinute = 10 } = {}) { this.send = send; this.maxPerMinute = maxPerMinute; this.attempted = new Set(); this.recent = []; }
  async deliver(event, config) {
    if (!config.enabled) return { status: 'disabled' };
    if (!config.token || !config.chatId) return { status: 'missing_configuration' };
    if (!event || (!event.test && !ALLOWED_KINDS.has(event.kind))) return { status: 'ignored' };
    if (event.id && this.attempted.has(event.id)) return { status: 'duplicate' };
    const now = Date.now(); this.recent = this.recent.filter(time => now - time < 60000);
    if (this.recent.length >= this.maxPerMinute) return { status: 'rate_limited' };
    if (event.id) this.attempted.add(event.id); this.recent.push(now);
    try { await this.send(config.token, config.chatId, formatTelegramMessage(event, { test: event.test })); return { status: 'delivered', at: new Date(now).toISOString() }; }
    catch (error) { return { status: 'failed', at: new Date(now).toISOString(), message: error instanceof Error ? error.message : 'Telegram delivery failed' }; }
  }
}

module.exports = { ALLOWED_KINDS, TelegramDelivery, formatTelegramMessage, sendTelegramMessage, telegramRequest, validChatId, validToken, validateBotToken };
