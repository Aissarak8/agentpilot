'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'reasoningTokens', 'cacheCreationInputTokens', 'totalTokens'];
const asCount = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.trunc(Number(value)) : undefined;
const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const stableId = parts => crypto.createHash('sha256').update(parts.map(value => String(value ?? '')).join('\u001f')).digest('hex').slice(0, 32);
const safeText = (value, fallback = 'unknown') => typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
const optionalText = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : undefined;

function finalize(record, identity) {
  const parsedTime = Date.parse(record.timestamp || '');
  const clean = {
    version: 1,
    timestamp: new Date(Number.isFinite(parsedTime) ? parsedTime : Date.now()).toISOString(),
    provider: record.provider,
    model: safeText(record.model),
    project: safeText(record.project),
    sessionId: safeText(record.sessionId),
    source: record.source,
    confidence: record.confidence || 'verified',
    accounting: record.accounting === 'cumulative' ? 'cumulative' : 'incremental'
  };
  const turnId=optionalText(record.turnId);if(turnId)clean.turnId=turnId;
  for (const field of TOKEN_FIELDS) {
    const value = asCount(record[field]);
    if (value !== undefined) clean[field] = value;
  }
  if (clean.totalTokens === undefined && clean.inputTokens !== undefined && clean.outputTokens !== undefined) {
    clean.totalTokens = clean.inputTokens + clean.outputTokens;
  }
  if (!TOKEN_FIELDS.some(field => clean[field] !== undefined)) return null;
  clean.id = safeText(record.id, stableId([clean.provider, clean.source, clean.sessionId, identity, clean.model, ...TOKEN_FIELDS.map(field => clean[field]) ]));
  return clean;
}

class CodexUsageAdapter {
  normalize(payload, context = {}) {
    if (!payload || typeof payload !== 'object') return null;
    const notification = payload.method === 'thread/tokenUsage/updated' ? payload.params : payload;
    const tokenUsage = notification?.tokenUsage;
    const usage = payload.usage || payload.turn?.usage || payload.response?.usage || tokenUsage?.last || tokenUsage?.total;
    if (!usage || typeof usage !== 'object') return null;
    const inputDetails = usage.input_tokens_details || usage.inputTokensDetails || {};
    const outputDetails = usage.output_tokens_details || usage.outputTokensDetails || {};
    return finalize({
      provider: 'codex', source: context.source || (tokenUsage ? 'codex-app-server' : 'codex-structured-usage'), confidence: 'verified',
      timestamp: first(payload.timestamp, payload.created_at, context.timestamp),
      model: first(payload.model, payload.turn?.model, context.model),
      project: first(context.project, payload.project),
      sessionId: first(notification?.threadId, payload.thread_id, payload.session_id, context.sessionId),
      turnId: first(notification?.turnId, payload.turn_id, payload.turn?.id, context.turnId),
      accounting: first(context.accounting, payload.accounting, tokenUsage?.last ? 'cumulative' : undefined),
      inputTokens: first(usage.input_tokens, usage.inputTokens),
      outputTokens: first(usage.output_tokens, usage.outputTokens),
      cachedInputTokens: first(usage.cached_input_tokens, inputDetails.cached_tokens, inputDetails.cachedTokens),
      cacheCreationInputTokens: first(usage.cache_write_input_tokens, usage.cacheWriteInputTokens),
      reasoningTokens: first(usage.reasoning_output_tokens, usage.reasoningOutputTokens, usage.reasoning_tokens, outputDetails.reasoning_tokens, outputDetails.reasoningTokens),
      totalTokens: first(usage.total_tokens, usage.totalTokens)
    }, first(notification?.turnId, payload.turn_id, payload.turn?.id, payload.id, context.identity));
  }
}

class ClaudeUsageAdapter {
  normalize(payload, context = {}) {
    if (!payload || typeof payload !== 'object') return null;
    const usage = payload.context_window?.current_usage;
    if (!usage || typeof usage !== 'object') return null;
    return finalize({
      provider: 'claude', source: 'claude-statusline', confidence: 'verified',
      timestamp: first(payload.timestamp, context.timestamp),
      model: first(payload.model?.id, payload.model?.display_name, context.model),
      project: first(payload.workspace?.project_dir && path.basename(payload.workspace.project_dir), context.project),
      sessionId: first(payload.session_id, context.sessionId), accounting: 'incremental',
      inputTokens: (asCount(usage.input_tokens) || 0) + (asCount(usage.cache_read_input_tokens) || 0) + (asCount(usage.cache_creation_input_tokens) || 0),
      outputTokens: usage.output_tokens,
      cachedInputTokens: usage.cache_read_input_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens,
    }, first(payload.prompt_id, context.identity));
  }
}

class UsageStore {
  constructor(file, options = {}) { this.file = file; this.maxRecords = options.maxRecords || 5000; this.retentionDays = options.retentionDays || 90; this.records = []; this.cursors = {}; this.load(); }
  load() {
    try {
      const stat = fs.statSync(this.file); if (stat.size > 5 * 1024 * 1024) return;
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.records = Array.isArray(parsed.records) ? parsed.records.filter(item => item && typeof item.id === 'string').slice(-this.maxRecords) : [];
      this.cursors = parsed.cursors && typeof parsed.cursors === 'object' ? parsed.cursors : {};
    } catch { this.records = []; this.cursors = {}; }
    this.prune(false);
  }
  prune(save = true) {
    const cutoff = Date.now() - this.retentionDays * 86400000;
    this.records = this.records.filter(item => Number.isFinite(Date.parse(item.timestamp)) && Date.parse(item.timestamp) >= cutoff).slice(-this.maxRecords);
    if (save) this.save();
  }
  add(record) {
    const lock = `${this.file}.lock`; let locked = false;
    fs.mkdirSync(path.dirname(this.file), { recursive:true });
    for (let attempt=0; attempt<25 && !locked; attempt++) { try { fs.mkdirSync(lock); locked=true; } catch (error) { if(error.code!=='EEXIST') throw error; try { if(Date.now()-fs.statSync(lock).mtimeMs>30000) fs.rmdirSync(lock); } catch {} if(!locked) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20); } }
    if (!locked) return { status:'busy' };
    try { return this.addLocked(record); } finally { try { fs.rmdirSync(lock); } catch {} }
  }
  addLocked(record) {
    this.load();
    if (!record || this.records.some(item => item.id === record.id)) return { status: 'duplicate' };
    let stored = { ...record };
    if (record.accounting === 'cumulative') {
      const key = [record.provider, record.sessionId, record.source, record.turnId || 'session'].join('\u001f');
      const previous = this.cursors[key] || {};
      const snapshot = { ...previous };
      if (TOKEN_FIELDS.some(field => record[field] !== undefined && previous[field] !== undefined && record[field] < previous[field])) return { status:'stale' };
      for (const field of TOKEN_FIELDS) { if (record[field] !== undefined) { snapshot[field] = record[field]; stored[field] = Math.max(0, record[field] - (previous[field] || 0)); } }
      this.cursors[key] = snapshot;
      stored.accounting = 'incremental'; stored.sourceAccounting = 'cumulative';
      if (!TOKEN_FIELDS.some(field => stored[field] > 0)) { this.save(); return { status: 'duplicate' }; }
    }
    this.records.push(stored); this.prune(false); this.save(); return { status: 'stored', record: stored };
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ version: 1, records: this.records, cursors: this.cursors }), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}

const BUILTIN_PRICING = {
  'codex:gpt-5.3-codex': { input: 1.75, cachedInput: 0.175, output: 14, currency: 'USD', unit: 1_000_000, source: 'https://developers.openai.com/api/docs/pricing', effectiveDate: '2026-10-15', version: '2026-10-15' }
};

class CostEstimator {
  constructor(overrides = {}, pricing = BUILTIN_PRICING) { this.overrides = overrides && typeof overrides === 'object' ? overrides : {}; this.pricing = pricing; }
  rateFor(record) { const key = `${record.provider}:${record.model}`; return this.overrides[key] || this.pricing[key] || null; }
  estimate(record) {
    const rate = this.rateFor(record); if (!rate) return { available: false, reason: 'pricing_unavailable' };
    if (record.cacheCreationInputTokens && rate.cacheCreationInput === undefined) return { available: false, reason: 'cache_creation_pricing_unavailable', rate };
    const unit = Number(rate.unit) || 1_000_000;
    const input = record.inputTokens || 0, cached = record.cachedInputTokens || 0, output = record.outputTokens || 0, reasoning = record.reasoningTokens || 0, cacheCreation = record.cacheCreationInputTokens || 0;
    const uncached = Math.max(0, input - cached - cacheCreation);
    const amount = (uncached * Number(rate.input || 0) + cached * Number(rate.cachedInput ?? rate.input ?? 0) + cacheCreation * Number(rate.cacheCreationInput || 0) + output * Number(rate.output || 0)) / unit;
    return { available: true, amount, currency: rate.currency || 'USD', rate, reasoningIncludedInOutput: reasoning > 0 };
  }
}

const dayKey = value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
const weekKey = value => { const date=new Date(value); date.setHours(0,0,0,0); date.setDate(date.getDate()-((date.getDay()+6)%7)); return dayKey(date); };
function usageAnalytics(records, estimator, options = {}) {
  const days = Number(options.days) || 0, boundary = new Date(options.now || Date.now());
  if (days) { boundary.setHours(0,0,0,0); boundary.setDate(boundary.getDate() - (days - 1)); }
  const cutoff = days ? boundary.getTime() : 0;
  const filtered = records.filter(record => !cutoff || Date.parse(record.timestamp) >= cutoff);
  const totals = { records: filtered.length, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, nonCachedInputTokens: 0, cacheBreakdownRecords: 0, reasoningTokens: 0, totalTokens: 0, estimatedCost: 0, pricedRecords: 0 };
  const byProvider = {}, byModel = {}, byProject = {}, bySource = {}, daily = {}, weekly = {};
  const add = (map, key, record) => { const row = map[key] ||= { records:0,totalTokens:0,estimatedCost:0,pricedRecords:0 }; row.records++; row.totalTokens += record.totalTokens || 0; const cost=estimator.estimate(record); if(cost.available){row.estimatedCost+=cost.amount;row.pricedRecords++;} };
  for (const record of filtered) {
    for (const field of ['inputTokens','outputTokens','cachedInputTokens','reasoningTokens','totalTokens']) totals[field] += record[field] || 0;
    if(record.inputTokens!==undefined&&(record.cachedInputTokens!==undefined||record.cacheCreationInputTokens!==undefined)){totals.cacheBreakdownRecords++;totals.nonCachedInputTokens+=Math.max(0,(record.inputTokens||0)-(record.cachedInputTokens||0)-(record.cacheCreationInputTokens||0));}
    const cost = estimator.estimate(record); if (cost.available) { totals.estimatedCost += cost.amount; totals.pricedRecords++; }
    add(byProvider, record.provider, record); add(byModel, record.model, record); add(byProject, record.project, record); add(bySource, `${record.source} (${record.confidence})`, record); add(daily, dayKey(record.timestamp), record); add(weekly, weekKey(record.timestamp), record);
  }
  return { totals, byProvider, byModel, byProject, bySource, daily, weekly, records: filtered };
}

module.exports = { BUILTIN_PRICING, ClaudeUsageAdapter, CodexUsageAdapter, CostEstimator, TOKEN_FIELDS, UsageStore, usageAnalytics };
