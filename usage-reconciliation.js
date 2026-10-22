'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const TOKEN_FIELDS=['inputTokens','outputTokens','cachedInputTokens','reasoningTokens','cacheCreationInputTokens','totalTokens'];
const sum=(records,field)=>records.reduce((total,record)=>total+(Number(record?.[field])||0),0);
const totals=records=>Object.fromEntries(TOKEN_FIELDS.map(field=>[field,sum(records,field)]));
const checksumBuffer=value=>crypto.createHash('sha256').update(value).digest('hex');

function readSource(file){const bytes=fs.readFileSync(file);const parsed=JSON.parse(bytes.toString('utf8'));return{bytes,checksum:checksumBuffer(bytes),records:Array.isArray(parsed.records)?parsed.records:[]};}
function legacyAppRecord(record){return record?.source==='codex-app-server'&&record.sourceAccounting!=='cumulative'&&!record.turnId;}
function candidateRecords(records){
  const exact=[],groups=new Map();
  for(const record of records){if(!legacyAppRecord(record)){exact.push(record);continue;}const key=[record.provider,record.sessionId,record.source].join('\u001f');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);}
  const candidates=[...exact],ambiguous=[];
  for(const group of groups.values()){
    const ordered=group.slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));let run=[],runs=[];
    for(const record of ordered){if(run.length&&Number(record.totalTokens||0)<Number(run.at(-1).totalTokens||0)){runs.push(run);run=[];}run.push(record);}if(run.length)runs.push(run);
    candidates.push(...runs.map(items=>items.at(-1)));
    ambiguous.push({recordCount:ordered.length,runCount:runs.length,rawTotal:sum(ordered,'totalTokens'),candidateTotal:sum(runs.map(items=>items.at(-1)),'totalTokens'),reason:'legacy_turn_ids_unavailable'});
  }
  return{exact,candidates,ambiguous};
}

function dryRun(file){
  const source=readSource(file),classified=candidateRecords(source.records),raw=totals(source.records),candidate=totals(classified.candidates);
  return{version:1,createdAt:new Date().toISOString(),sourceFile:path.basename(file),sourceChecksum:source.checksum,sourceRecordCount:source.records.length,rawTotals:raw,candidateTotals:candidate,verifiedRecordCount:classified.exact.length,uncertainRecordCount:classified.ambiguous.reduce((n,item)=>n+item.recordCount,0),ambiguousGroups:classified.ambiguous,provenExcludedRecordIds:[],projectionPolicy:'preserve_uncertain'};
}

function atomicWrite(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.${Date.now()}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600});fs.renameSync(temp,file);}
function withLock(file,work){const lock=`${file}.lock`;try{fs.mkdirSync(lock);}catch(error){if(error.code==='EEXIST')return{status:'busy'};throw error;}try{return work();}finally{try{fs.rmdirSync(lock);}catch{}}}

class UsageReconciliationStore{
  constructor(usageFile,projectionFile){this.usageFile=usageFile;this.projectionFile=projectionFile;}
  dryRun(){return dryRun(this.usageFile);}
  backup(report=this.dryRun(),now=new Date()){
    const current=readSource(this.usageFile);if(current.checksum!==report.sourceChecksum)return{status:'stale'};
    const stamp=now.toISOString().replace(/[:.]/g,'-'),backupFile=`${this.usageFile}.${stamp}.bak`;
    fs.writeFileSync(backupFile,current.bytes,{flag:'wx',mode:0o600});const backupChecksum=checksumBuffer(fs.readFileSync(backupFile));
    if(backupChecksum!==current.checksum){try{fs.unlinkSync(backupFile);}catch{}throw new Error('backup_checksum_mismatch');}
    return{status:'backed_up',backupFile,checksum:backupChecksum};
  }
  apply(report,backup){return withLock(this.projectionFile,()=>{
    const current=readSource(this.usageFile);if(current.checksum!==report.sourceChecksum)return{status:'stale'};
    if(!backup||backup.checksum!==current.checksum||!fs.existsSync(backup.backupFile))return{status:'backup_required'};
    if(checksumBuffer(fs.readFileSync(backup.backupFile))!==current.checksum)return{status:'backup_invalid'};
    const projection={version:1,enabled:true,createdAt:new Date().toISOString(),sourceChecksum:current.checksum,sourceRecordCount:current.records.length,projectionPolicy:'preserve_uncertain',provenExcludedRecordIds:report.provenExcludedRecordIds||[],rawTotals:report.rawTotals,candidateTotals:report.candidateTotals,uncertainRecordCount:report.uncertainRecordCount,ambiguousGroupCount:report.ambiguousGroups.length,backupFile:path.basename(backup.backupFile),backupChecksum:backup.checksum};
    atomicWrite(this.projectionFile,projection);return{status:'applied',projection};
  });}
  load(){try{const projection=JSON.parse(fs.readFileSync(this.projectionFile,'utf8')),current=readSource(this.usageFile);if(!projection?.enabled)return{status:'disabled'};if(projection.sourceChecksum!==current.checksum)return{status:'stale',projection};return{status:'active',projection};}catch(error){return{status:error.code==='ENOENT'?'none':'invalid'};}}
  records(records){const state=this.load();if(state.status!=='active')return{records,state};const excluded=new Set(state.projection.provenExcludedRecordIds||[]);return{records:records.filter(record=>!excluded.has(record.id)),state};}
  rollback(){return withLock(this.projectionFile,()=>{try{fs.unlinkSync(this.projectionFile);return{status:'rolled_back'};}catch(error){return{status:error.code==='ENOENT'?'none':'failed'};}});}
}

module.exports={UsageReconciliationStore,candidateRecords,checksumBuffer,dryRun,legacyAppRecord,totals};
