'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { formatTelegramMessage, safeTelegramDiagnostic, sendTelegramMessage } = require('./telegram');
const { acquireFileLock } = require('./file-lock');

const MAX_ITEMS = 500;
const TRANSIENT_HTTP = new Set([500, 502, 503, 504]);
const SEND_LEASE_MS = 2 * 60 * 1000;

function cleanEvent(event) {
  return {
    id:String(event.id || '').slice(0, 128),
    time:String(event.time || '').slice(0, 64),
    agent:String(event.agent || 'unknown').slice(0, 32),
    kind:String(event.kind || 'unknown').slice(0, 32),
    project:String(event.project || 'unknown').slice(0, 160),
    sessionId:event.sessionId ? String(event.sessionId).slice(0, 160) : undefined,
    test:Boolean(event.test)
  };
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding:'utf8', mode:0o600 });
  try { fs.renameSync(temporary, file); }
  catch (error) { try { fs.unlinkSync(temporary); } catch {} throw error; }
}

function readState(file) {
  try {
    if (fs.statSync(file).size > 1024 * 1024) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && Array.isArray(parsed.items) ? parsed.items.filter(item => item && typeof item === 'object').slice(-MAX_ITEMS) : [];
  } catch { return []; }
}

function summarize(items) {
  const counts = { sent:0, pending:0, failed:0, uncertain:0, sending:0 };
  for (const item of items) if (Object.hasOwn(counts, item.status)) counts[item.status]++;
  return { counts, recent:[...items].sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 30) };
}

class DeliveryQueue {
  constructor(file, { send=sendTelegramMessage, now=()=>Date.now(), random=Math.random, maxItems=MAX_ITEMS, maxAttempts=5 } = {}) {
    this.file=file; this.send=send; this.now=now; this.random=random; this.maxItems=maxItems; this.maxAttempts=maxAttempts;this.ownerId=`${process.pid}-${crypto.randomUUID()}`;
    this.items=readState(file); this.running=false; this.recentAttempts=[];
    const release=acquireFileLock(this.file,{now:this.now});if(release)try{this.items=readState(file);if(this.recoverStaleSending())this.save();}finally{release();}
  }

  save() {
    this.items=this.items.slice(-this.maxItems);
    atomicWrite(this.file, { version:1, items:this.items });
  }

  recoverStaleSending(){let recovered=false;for(const item of this.items)if(item.status==='sending'&&(!item.lastAttemptAt||this.now()-Date.parse(item.lastAttemptAt)>SEND_LEASE_MS)){item.status='uncertain';item.deliveryOwner=null;item.lastErrorCategory='interrupted_during_send';item.nextRetryAt=null;item.updatedAt=new Date(this.now()).toISOString();recovered=true;}return recovered;}

  locked(change){const release=acquireFileLock(this.file,{now:this.now});if(!release)return{status:'busy_external'};try{this.items=readState(this.file);this.recoverStaleSending();return change();}finally{release();}}

  enqueue(event, { notifyExceptionalSessionEnd=true } = {}) {
    const safe=cleanEvent(event);
    return this.locked(()=>{if (!safe.id || this.items.some(item => item.sourceEventId === safe.id)) return { status:'duplicate' };
      if (safe.kind === 'session_ended') {const completed=safe.sessionId && this.items.some(item => item.sessionId === safe.sessionId && item.kind === 'completed');if (completed) return { status:'suppressed_completed_session' };if (!notifyExceptionalSessionEnd) return { status:'session_end_disabled' };}
      const timestamp=new Date(this.now()).toISOString();const item={ sourceEventId:safe.id, agent:safe.agent, kind:safe.kind, project:safe.project, eventTime:safe.time, sessionId:safe.sessionId, test:safe.test, status:'pending', attemptCount:0, lastAttemptAt:null, lastErrorCategory:null, telegramMessageId:null, nextRetryAt:timestamp, createdAt:timestamp, updatedAt:timestamp };
      this.items.push(item);this.save();return { status:'queued',item };});
  }

  history() { this.items=readState(this.file);return summarize(this.items); }

  manualRetry(sourceEventId) {
    return this.locked(()=>{const item=this.items.find(candidate => candidate.sourceEventId === sourceEventId);if (!item || !['failed','uncertain'].includes(item.status)) return false;item.status='pending';item.nextRetryAt=new Date(this.now()).toISOString();item.lastErrorCategory=null;item.updatedAt=item.nextRetryAt;this.save();return true;});
  }

  nextDue() {
    const now=this.now();
    return this.items.find(item => item.status === 'pending' && (!item.nextRetryAt || Date.parse(item.nextRetryAt) <= now));
  }

  backoff(attempt) {
    const base=Math.min(300000, 5000 * (2 ** Math.max(0, attempt - 1)));
    return Math.round(base * (0.75 + this.random() * 0.5));
  }

  async process(config) {
    if (this.running || !config?.enabled) return { status:this.running?'busy':'disabled' };
    this.recentAttempts=this.recentAttempts.filter(value => this.now()-value < 60000);
    if (this.recentAttempts.length >= 10) return { status:'rate_limited_locally' };
    const claimed=this.locked(()=>{const item=this.nextDue();if(!item)return{status:'idle'};if(!config.token||!config.chatId){item.status='failed';item.lastErrorCategory='missing_configuration';item.nextRetryAt=null;item.updatedAt=new Date(this.now()).toISOString();this.save();return{status:'failed',item};}this.running=true;item.status='sending';item.deliveryOwner=this.ownerId;item.attemptCount++;item.lastAttemptAt=new Date(this.now()).toISOString();item.updatedAt=item.lastAttemptAt;this.recentAttempts.push(this.now());this.save();return{status:'claimed',item};});
    if(claimed.status!=='claimed')return claimed;const item=claimed.item;
    let outcome;
    try {
      const result=await this.send(config.token, config.chatId, formatTelegramMessage({ id:item.sourceEventId, time:item.eventTime, agent:item.agent, kind:item.kind, project:item.project, test:item.test }, { test:item.test }));
      outcome={status:'sent',telegramMessageId:Number.isFinite(result?.message_id)?result.message_id:null};
    } catch (error) {
      const diagnostic=safeTelegramDiagnostic(error),category=diagnostic.category,status=diagnostic.httpStatus;outcome={status:'failed',diagnostic,lastErrorCategory:category,nextRetryAt:null};
      if(category==='timeout'||category==='network')outcome.status='uncertain';
      else if(category==='rate_limited'&&item.attemptCount<this.maxAttempts){outcome.status='pending';outcome.nextRetryAt=new Date(this.now()+Math.max(1000,Number(diagnostic.retryAfter||0)*1000||this.backoff(item.attemptCount))).toISOString();}
      else if(TRANSIENT_HTTP.has(status)&&item.attemptCount<this.maxAttempts){outcome.status='pending';outcome.nextRetryAt=new Date(this.now()+this.backoff(item.attemptCount)).toISOString();}
    }
    const committed=this.locked(()=>{const current=this.items.find(candidate=>candidate.sourceEventId===item.sourceEventId);if(!current||current.status!=='sending'||current.deliveryOwner!==this.ownerId)return{status:'uncertain_conflict'};current.status=outcome.status;current.deliveryOwner=null;current.telegramMessageId=outcome.telegramMessageId??current.telegramMessageId;current.lastErrorCategory=outcome.lastErrorCategory||null;current.nextRetryAt=outcome.nextRetryAt||null;current.updatedAt=new Date(this.now()).toISOString();this.save();return{status:current.status,item:current,diagnostic:outcome.diagnostic};});this.running=false;return committed;
  }
}

module.exports={ DeliveryQueue, SEND_LEASE_MS, atomicWrite, cleanEvent, readState, summarize };
