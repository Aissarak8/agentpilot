'use strict';

const crypto=require('crypto');
const EventEmitter=require('events');
const fs=require('fs');
const path=require('path');
const { spawn:nodeSpawn }=require('child_process');
const { atomicWrite }=require('./delivery-queue');
const { CodexUsageStreamCollector }=require('./codex-usage-stream');
const { acquireFileLock,corruptStoreError,processAlive,readJsonState }=require('./file-lock');

const TERMINAL=new Set(['completed','failed','cancelled','interrupted']);
const nowIso=now=>new Date(now()).toISOString();
const clean=(value,fallback='unknown',max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
const PROCESS_ERROR_CATEGORIES=new Map([['ENOENT','executable_not_found'],['EACCES','executable_permission'],['EPERM','executable_permission'],['EINVAL','invalid_executable']]);
const classifyProcessError=error=>PROCESS_ERROR_CATEGORIES.get(error?.code)||'process_start';
function classifyStderr(chunk){const text=String(chunk).toLowerCase();if(/not inside a trusted directory|skip-git-repo-check/.test(text))return'workspace_not_trusted';if(/not logged in|unauthorized|authentication required/.test(text))return'authentication';if(/dns|tls|certificate|connection (failed|refused)|network.*(failed|unavailable)|timed out/.test(text))return'network';if(/unexpected argument|unrecognized (argument|option)|usage: codex/.test(text))return'cli_arguments';if(/sandbox|permission denied|access is denied/.test(text))return'sandbox';return null;}

function resolveExecutable(value,{env=process.env,platform=process.platform,exists=fs.existsSync}={}){
  const requested=clean(value,'',1024);if(!requested)return null;
  const native=platform==='win32'?requested.toLowerCase().endsWith('.exe'):true;
  if(!native)return null;
  const hasPath=path.isAbsolute(requested)||requested.includes('/')||requested.includes('\\');
  const delimiter=platform==='win32'?';':':';
  const candidates=hasPath?[requested]:String(env.PATH||'').split(delimiter).filter(Boolean).map(folder=>path.join(folder,requested));
  return candidates.find(candidate=>{try{return exists(candidate);}catch{return false;}})||null;
}

class TaskStore {
  constructor(file,{now=Date.now,maxItems=100}={}){this.file=file;this.now=now;this.maxItems=maxItems;this.items=[];try{this.transact(()=>{let changed=false;for(const item of this.items){if((item.status==='running'||item.status==='cancelling')&&!processAlive(item.ownerPid)){item.status='interrupted';item.ownerPid=null;item.errorCategory='extension_restart';item.endedAt=nowIso(this.now);item.durationMs=Math.max(0,this.now()-Date.parse(item.startedAt));changed=true;}}return changed;});}catch(error){if(error.code!=='store_corrupt')throw error;}}
  read(){const state=readJsonState(this.file);this.readStatus=state.status;if(state.status==='missing')return[];if(state.status!=='ok'||!state.value||!Array.isArray(state.value.items)){this.readStatus='corrupt';return[];}return state.value.items.filter(item=>item&&typeof item.id==='string').slice(-this.maxItems);}
  save(){this.items=this.items.slice(-this.maxItems);atomicWrite(this.file,{version:1,items:this.items});}
  transact(change){const release=acquireFileLock(this.file,{now:this.now});if(!release)throw Object.assign(new Error('Task metadata is busy.'),{code:'store_busy'});try{this.items=this.read();if(['corrupt','oversized'].includes(this.readStatus))throw corruptStoreError();const save=change();if(save)this.save();return save;}finally{release();}}
  start(input){let created;this.transact(()=>{created={id:clean(input.id,'',128),provider:'codex',project:clean(input.project),model:clean(input.model),status:'running',ownerPid:process.pid,startedAt:input.startedAt,endedAt:null,durationMs:null,threadId:null,usageRecordId:null,errorCategory:null};this.items.push(created);return true;});return created;}
  update(id,patch){let updated=null;this.transact(()=>{const item=this.items.find(candidate=>candidate.id===id);if(!item)return false;Object.assign(item,patch);if(Object.prototype.hasOwnProperty.call(patch,'status'))item.ownerPid=['running','cancelling'].includes(patch.status)?process.pid:null;updated=item;return true;});return updated;}
  recent(){this.items=this.read();return [...this.items].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).slice(0,20);}
}

class CodexTaskRunner extends EventEmitter {
  constructor({taskStore,usageStore,spawn=nodeSpawn,now=Date.now,terminate,timeoutMs=30*60*1000}={}){super();this.taskStore=taskStore;this.usageStore=usageStore;this.spawn=spawn;this.now=now;this.terminate=terminate||terminateProcess;this.timeoutMs=timeoutMs;this.active=null;}
  start({executable,cwd,prompt,model}){
    if(this.active)throw Object.assign(new Error('A Codex task is already running.'),{code:'busy'});
    if(typeof prompt!=='string'||!prompt.trim())throw Object.assign(new Error('Task is required.'),{code:'invalid_task'});
    if(!path.isAbsolute(cwd||''))throw Object.assign(new Error('Workspace path must be absolute.'),{code:'invalid_workspace'});
    if(process.platform==='win32'&&/\.(cmd|bat)$/i.test(executable||''))throw Object.assign(new Error('Use the native codex.exe on Windows.'),{code:'unsafe_launcher'});
    const id=`runner-${crypto.randomUUID()}`,startedAt=nowIso(this.now),project=path.basename(cwd),task=this.taskStore.start({id,project,model,startedAt});
    const args=['exec','--json'];if(model)args.push('--model',model);args.push('-');
    let child;
    try{child=this.spawn(executable,args,{cwd,env:process.env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});}
    catch(error){const category=classifyProcessError(error),endedAt=nowIso(this.now),updated=this.taskStore.update(task.id,{status:'failed',endedAt,durationMs:Math.max(0,this.now()-Date.parse(startedAt)),errorCategory:category});this.emit('lifecycle',this.lifecycle(updated,'failed'));this.emit('change',updated);throw Object.assign(error,{agentpilotCategory:category});}
    const state={task,child,completed:false,failed:false,cancelled:false,finished:false,timer:null,stderrBytes:0};this.active=state;
    const collector=new CodexUsageStreamCollector(this.usageStore,{project,model,onPayload:payload=>this.onPayload(state,payload),onUsage:(record,result)=>{if(result?.status==='stored'||result?.status==='duplicate')this.taskStore.update(id,{usageRecordId:record.id});}});
    state.collector=collector;
    child.stdout?.on('data',chunk=>collector.consume(chunk));
    child.stderr?.on('data',chunk=>{state.stderrBytes=Math.min(65536,state.stderrBytes+Buffer.byteLength(chunk));state.errorCategory=state.errorCategory||classifyStderr(chunk);});
    child.on('error',error=>{state.failed=true;this.finish(task,'failed',classifyProcessError(error));});
    child.on('exit',(code,signal)=>{collector.finish();if(state.finished)return;if(state.cancelled)this.finish(task,'cancelled','user_cancelled');else if(state.completed&&code===0)this.finish(task,'completed',null);else this.finish(task,'failed',state.errorCategory||(state.failed?'codex_turn_failed':signal?'process_signal':'unexpected_exit'));});
    state.timer=setTimeout(()=>{if(state.finished)return;state.failed=true;this.terminate(child);this.finish(task,'failed','timeout');},this.timeoutMs);
    child.stdin?.end(prompt);
    this.emit('lifecycle',this.lifecycle(task,'session_started'));
    this.emit('change',task);
    return task;
  }
  onPayload(state,payload){
    if(payload.type==='thread.started'&&typeof payload.thread_id==='string'){state.task.threadId=payload.thread_id;this.taskStore.update(state.task.id,{threadId:payload.thread_id});}
    else if(payload.type==='turn.completed')state.completed=true;
    else if(payload.type==='turn.failed'||payload.type==='error')state.failed=true;
  }
  cancel(){if(!this.active||this.active.finished)return false;const state=this.active;state.cancelled=true;this.taskStore.update(state.task.id,{status:'cancelling'});this.terminate(state.child);this.finish(state.task,'cancelled','user_cancelled');return true;}
  finish(task,status,errorCategory){const state=this.active;if(!state||state.task.id!==task.id||state.finished)return;state.finished=true;clearTimeout(state.timer);const endedAt=nowIso(this.now),durationMs=Math.max(0,this.now()-Date.parse(task.startedAt));const updated=this.taskStore.update(task.id,{status,endedAt,durationMs,errorCategory});this.active=null;const kind=status==='completed'?'completed':status==='cancelled'?'interrupted':'failed';this.emit('lifecycle',this.lifecycle(updated,kind));this.emit('change',updated);}
  lifecycle(task,kind){return {id:`${task.id}-${kind}`,time:kind==='session_started'?task.startedAt:task.endedAt||nowIso(this.now),agent:'codex',kind,project:task.project,source:'agentpilot_runner',sessionId:task.threadId||task.id,model:task.model==='unknown'?undefined:task.model,errorCategory:task.errorCategory||undefined,test:false};}
  dispose(){this.cancel();}
}

function terminateProcess(child){if(!child||child.killed)return;try{if(process.platform==='win32'&&Number.isInteger(child.pid))nodeSpawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',shell:false});else child.kill('SIGTERM');}catch{try{child.kill();}catch{}}}

module.exports={ CodexTaskRunner, TaskStore, TERMINAL, classifyProcessError, classifyStderr, resolveExecutable, terminateProcess };
