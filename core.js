'use strict';
const fs=require('fs'); const crypto=require('crypto');
const AGENTS=new Set(['codex','claude','test']);
const KINDS=new Set(['completed','attention','failed','interrupted','session_started','session_ended']);
const clean=(v,f='',n=160)=>(typeof v==='string'||typeof v==='number')?String(v).slice(0,n):f;
function normalizeEvent(input,defaults={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const agent=clean(input.agent||defaults.agent).toLowerCase(),kind=clean(input.kind||defaults.kind).toLowerCase();
  if(!AGENTS.has(agent)||!KINDS.has(kind))return null;
  const event={version:Number.isInteger(input.version)?input.version:1,id:clean(input.id),time:clean(input.time)||new Date().toISOString(),agent,kind,project:clean(input.project,'unknown',80),source:clean(input.source,agent==='test'?'test':'legacy',32),test:input.test===true||agent==='test'};
  for(const key of ['sessionId','turnId','model','hook','errorCategory']){const value=clean(input[key]);if(value)event[key]=value;}
  if(!event.id)event.id=crypto.createHash('sha256').update([event.time,event.agent,event.kind,event.project].join('|')).digest('hex').slice(0,24);
  return event;
}
function readEvents(file,limit=500){try{return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(-limit).map(line=>{try{return normalizeEvent(JSON.parse(line));}catch{return null;}}).filter(Boolean);}catch{return [];}}
function appendEvent(file,input){const event=normalizeEvent(input);if(!event)return{stored:false,reason:'invalid'};if(readEvents(file).some(e=>e.id===event.id))return{stored:false,reason:'duplicate',event};fs.appendFileSync(file,`${JSON.stringify(event)}\n`,'utf8');return{stored:true,event};}
function dashboardData(events){const safe=events.map(normalizeEvent).filter(Boolean),real=safe.filter(e=>!e.test),latest=new Map();for(const e of real)latest.set(`${e.agent}:${e.sessionId||e.project}`,e);const status={codex:'unknown',claude:'unknown'};for(const e of latest.values())if(e.agent in status)status[e.agent]=e.kind==='attention'?'needs input':e.kind==='failed'?'error':e.kind==='session_started'?'active':'idle';return{total:safe.length,real:real.length,tests:safe.length-real.length,codex:real.filter(e=>e.agent==='codex').length,claude:real.filter(e=>e.agent==='claude').length,status,recent:safe.slice(-100).reverse()};}
module.exports={appendEvent,dashboardData,normalizeEvent,readEvents};
