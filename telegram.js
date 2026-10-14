'use strict';

const https = require('https');
const TELEGRAM_HOST = 'api.telegram.org';
const DEFAULT_TIMEOUT_MS = 8000;
const ALLOWED_KINDS = new Set(['completed', 'attention', 'session_ended']);

class TelegramError extends Error {
  constructor(code, message, httpStatus = 0) { super(message); this.name = 'TelegramError'; this.code = code; this.httpStatus = httpStatus; }
}

const normalizeToken = token => typeof token === 'string' ? token.trim() : '';
const validToken = token => /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(normalizeToken(token));
const validChatId = chatId => typeof chatId === 'string' && (/^-?\d{1,20}$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(chatId));

function formatTelegramMessage(event, { test = false } = {}) {
  const safe = value => String(value || 'unknown').replace(/[\r\n\t]+/g, ' ').slice(0, 160);
  const timestamp = Number.isNaN(Date.parse(event.time)) ? safe(event.time) : new Date(event.time).toISOString();
  return [test ? 'AgentPilot test notification' : 'AgentPilot agent notification', `Agent: ${safe(event.agent)}`, `Event: ${safe(event.kind)}`, `Project: ${safe(event.project)}`, `Time: ${timestamp}`].join('\n');
}

function describeTelegramError(error) {
  const messages = {
    invalid_format: 'The bot token format is invalid. Copy the full current token from @BotFather.',
    invalid_token: 'Telegram rejected the bot token (HTTP 401). The token may be incorrect or revoked.',
    forbidden: 'Telegram denied the request (HTTP 403). Check that the bot can access the destination chat.',
    rate_limited: 'Telegram rate-limited the request (HTTP 429). Wait and try again.',
    timeout: 'Telegram did not respond before the 8-second timeout. Check proxy or firewall settings.',
    network: 'AgentPilot could not reach api.telegram.org. Check DNS, proxy, firewall, and TLS inspection settings.',
    invalid_response: 'Telegram returned an unreadable response. A proxy or TLS inspection service may be interfering.',
    invalid_chat_id: 'The Telegram chat ID format is invalid.',
    http_error: `Telegram returned HTTP ${error?.httpStatus || 'error'}. Try again later.`
  };
  return messages[error?.code] || 'Telegram validation failed for an unknown reason.';
}

function telegramRequest(token, method, payload, options = {}) {
  const requestImpl = options.requestImpl || https.request;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const safeToken = normalizeToken(token);
  if (!validToken(safeToken)) return Promise.reject(new TelegramError('invalid_format', 'Invalid Telegram bot token format'));
  const body = JSON.stringify(payload || {});
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    let req;
    try {
      req = requestImpl({ hostname:TELEGRAM_HOST, port:443, path:`/bot${safeToken}/${method}`, method:'POST', headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) }, timeout:timeoutMs }, res => {
        let data = '';
        res.setEncoding?.('utf8');
        res.on('data', chunk => { if (data.length < 65536) data += chunk; });
        res.on('aborted', () => finish(reject, new TelegramError('network', 'Telegram closed the response early')));
        res.on('error', () => finish(reject, new TelegramError('network', 'Telegram response failed')));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { return finish(reject, new TelegramError('invalid_response', `Telegram returned an invalid response (HTTP ${res.statusCode || 0})`, res.statusCode || 0)); }
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.ok === true) return finish(resolve, parsed.result);
          const status = res.statusCode || 0;
          if (status === 401) return finish(reject, new TelegramError('invalid_token', 'Telegram rejected the bot token (HTTP 401)', status));
          if (status === 403) return finish(reject, new TelegramError('forbidden', 'Telegram denied the request (HTTP 403)', status));
          if (status === 429) return finish(reject, new TelegramError('rate_limited', 'Telegram rate limit reached (HTTP 429)', status));
          finish(reject, new TelegramError('http_error', `Telegram request failed (HTTP ${status})`, status));
        });
      });
    } catch { return finish(reject, new TelegramError('network', 'Telegram network request could not start')); }
    req.on('timeout', () => { finish(reject, new TelegramError('timeout', `Telegram request timed out after ${timeoutMs} ms`)); req.destroy(); });
    req.on('error', () => finish(reject, new TelegramError('network', 'Telegram network request failed')));
    req.end(body);
  });
}

const validateBotToken = (token, options) => telegramRequest(token, 'getMe', {}, options);
function sendTelegramMessage(token, chatId, text, options) {
  if (!validChatId(chatId)) return Promise.reject(new TelegramError('invalid_chat_id', 'Invalid Telegram chat ID format'));
  return telegramRequest(token, 'sendMessage', { chat_id:chatId, text, disable_web_page_preview:true }, options);
}

class TelegramDelivery {
  constructor({ send = sendTelegramMessage, maxPerMinute = 10 } = {}) { this.send = send; this.maxPerMinute = maxPerMinute; this.attempted = new Set(); this.recent = []; }
  async deliver(event, config) {
    if (!config.enabled) return { status:'disabled' };
    if (!config.token || !config.chatId) return { status:'missing_configuration' };
    if (!event || (!event.test && !ALLOWED_KINDS.has(event.kind))) return { status:'ignored' };
    if (event.id && this.attempted.has(event.id)) return { status:'duplicate' };
    const now = Date.now(); this.recent = this.recent.filter(time => now - time < 60000);
    if (this.recent.length >= this.maxPerMinute) return { status:'rate_limited' };
    if (event.id) this.attempted.add(event.id); this.recent.push(now);
    try { await this.send(config.token, config.chatId, formatTelegramMessage(event, { test:event.test })); return { status:'delivered', at:new Date(now).toISOString() }; }
    catch (error) { return { status:'failed', at:new Date(now).toISOString(), code:error instanceof TelegramError ? error.code : 'unknown', message:error instanceof Error ? error.message : 'Telegram delivery failed' }; }
  }
}

module.exports = { ALLOWED_KINDS, TelegramDelivery, TelegramError, describeTelegramError, formatTelegramMessage, normalizeToken, sendTelegramMessage, telegramRequest, validChatId, validToken, validateBotToken };
