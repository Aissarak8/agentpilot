'use strict';

const EventEmitter=require('events');
const { spawn:nodeSpawn }=require('child_process');
const { CodexUsageAdapter }=require('./usage');
const { classifyProcessError, classifyStderr, terminateProcess }=require('./codex-task-runner');

const APPROVAL_METHODS=new Set(['item/commandExecution/requestApproval','item/fileChange/requestApproval','item/permissions/requestApproval']);
const safeText=(value,fallback='unknown',max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
const safeError=error=>safeText(error?.code||error?.codexErrorInfo?.type||error?.codexErrorInfo||'app_server_error','app_server_error',80).replace(/[^a-zA-Z0-9_.-]/g,'_');

class CodexAppServerClient extends EventEmitter {
  constructor({executable,cwd,usageStore,spawn=nodeSpawn,terminate=terminateProcess,requestTimeoutMs=15000,clientInfo}={}){
    super();this.executable=executable;this.cwd=cwd;this.usageStore=usageStore;this.spawn=spawn;this.terminate=terminate;this.requestTimeoutMs=requestTimeoutMs;this.clientInfo=clientInfo||{name:'agentpilot',title:'AgentPilot',version:require('./package.json').version};this.nextId=1;this.pending=new Map();this.pendingApprovals=new Map();this.buffer='';this.process=null;this.ready=false;this.stopping=false;this.stopTimer=null;this.stderrCategory=null;this.activeTurns=new Map();this.threadModels=new Map();this.models=[];
  }
  async start(){
    if(this.ready)return this;
    if(this.process)throw Object.assign(new Error('App server is starting.'),{code:'starting'});
    let child;try{child=this.spawn(this.executable,['app-server','--listen','stdio://'],{cwd:this.cwd,env:process.env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});}catch(error){throw Object.assign(error,{agentpilotCategory:classifyProcessError(error)});}
    this.process=child;this.stopping=false;this.stderrCategory=null;
    child.stdout?.on('data',chunk=>this.consume(chunk));
    child.stderr?.on('data',chunk=>{this.stderrCategory=this.stderrCategory||classifyStderr(chunk);});
    child.on('error',error=>this.failAll(classifyProcessError(error)));
    child.on('exit',(code,signal)=>this.onExit(code,signal));
    try{await this.request('initialize',{clientInfo:this.clientInfo});this.notify('initialized',{});this.ready=true;this.emit('ready');return this;}catch(error){const category=this.stderrCategory||error.agentpilotCategory||error.code||'app_server_start';this.stop();throw Object.assign(error,{code:category,agentpilotCategory:category});}
  }
  send(message){if(!this.process?.stdin?.writable)throw Object.assign(new Error('App server is unavailable.'),{code:'not_running'});this.process.stdin.write(`${JSON.stringify(message)}\n`);}
  notify(method,params){this.send({method,params});}
  request(method,params,timeoutMs=this.requestTimeoutMs){
    const id=this.nextId++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Object.assign(new Error('App server request timed out.'),{code:'request_timeout',method}));},timeoutMs);this.pending.set(id,{resolve,reject,timer,method});try{this.send({method,id,params});}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
  }
  consume(chunk){this.buffer+=String(chunk);if(Buffer.byteLength(this.buffer)>4*1024*1024){this.buffer='';this.emit('diagnostic',{category:'oversized_message'});return;}let index;while((index=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,index);this.buffer=this.buffer.slice(index+1);if(line.trim())this.consumeLine(line);}}
  consumeLine(line){let message;try{message=JSON.parse(line);}catch{this.emit('diagnostic',{category:'malformed_message'});return;}if(!message||typeof message!=='object'||Array.isArray(message))return;if(message.id!==undefined&&(message.result!==undefined||message.error!==undefined)){const pending=this.pending.get(message.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(message.id);if(message.error)pending.reject(Object.assign(new Error('App server request failed.'),{code:'rpc_error',category:safeError(message.error),method:pending.method}));else pending.resolve(message.result);return;}if(message.id!==undefined&&typeof message.method==='string'){if(APPROVAL_METHODS.has(message.method)){const params=message.params;if(!params||typeof params!=='object'||typeof params.threadId!=='string'||typeof params.turnId!=='string'){this.send({id:message.id,error:{code:-32602,message:'Invalid approval request'}});this.emit('diagnostic',{category:'malformed_approval_request',method:safeText(message.method,'unknown',80)});return;}this.pendingApprovals.set(message.id,{method:message.method,params});this.emit('approval',{requestId:message.id,method:message.method,params});}else{this.send({id:message.id,error:{code:-32601,message:'Unsupported client request'}});this.emit('diagnostic',{category:'unsupported_server_request',method:safeText(message.method,'unknown',80)});}return;}if(typeof message.method==='string')this.onNotification(message);}
  onNotification(message){
    const params=message.params||{},method=message.method;this.emit('notification',{method,params});
    if(method==='turn/started'){const turn=params.turn||{};if(params.threadId&&turn.id)this.activeTurns.set(params.threadId,turn.id);this.emit('turn',{phase:'started',threadId:params.threadId,turn});}
    else if(method==='item/agentMessage/delta'&&typeof params.delta==='string')this.emit('delta',{threadId:params.threadId,turnId:params.turnId,itemId:params.itemId,delta:params.delta});
    else if(method==='item/completed'&&params.item?.type==='agentMessage')this.emit('message',{threadId:params.threadId,turnId:params.turnId,text:safeText(params.item.text,'',200000)});
    else if(method==='thread/tokenUsage/updated')this.onUsage(message);
    else if(method==='turn/completed'){if(params.threadId)this.activeTurns.delete(params.threadId);this.emit('turn',{phase:'completed',threadId:params.threadId,turn:params.turn||{}});}
    else if(method==='serverRequest/resolved'&&params.requestId!==undefined)this.pendingApprovals.delete(params.requestId);
    else if(method==='error')this.emit('diagnostic',{category:safeError(params.error)});
  }
  onUsage(message){if(!this.usageStore)return;const params=message.params||{},record=new CodexUsageAdapter().normalize(message,{source:'codex-app-server',project:this.cwd?.split(/[\\/]/).pop(),sessionId:params.threadId,turnId:params.turnId,identity:params.turnId,model:this.threadModels.get(params.threadId),accounting:'cumulative'});if(!record)return;const result=this.usageStore.add(record);this.emit('usage',{record:result.record||record,result,threadId:params.threadId,turnId:params.turnId});}
  async listModels(){const result=await this.request('model/list',{limit:100});this.models=(result?.data||result?.models||[]).filter(model=>model&&typeof model.id==='string').map(model=>({id:model.id,displayName:safeText(model.displayName||model.display_name||model.id,model.id,120),description:safeText(model.description,'',500),hidden:model.hidden===true,isDefault:model.isDefault===true,defaultReasoningEffort:safeText(model.defaultReasoningEffort,'',40),supportedReasoningEfforts:Array.isArray(model.supportedReasoningEfforts)?model.supportedReasoningEfforts.slice(0,20).map(value=>({reasoningEffort:safeText(value?.reasoningEffort||value,'',40),description:safeText(value?.description,'',200)})):[],additionalSpeedTiers:Array.isArray(model.additionalSpeedTiers)?model.additionalSpeedTiers.slice(0,20).map(value=>safeText(value,'',80)):[],serviceTiers:Array.isArray(model.serviceTiers)?model.serviceTiers.slice(0,20).map(value=>({id:safeText(value?.id,'',80),name:safeText(value?.name,'',80),description:safeText(value?.description,'',200)})):[]}));return this.models;}
  async startThread({cwd=this.cwd,model}={}){const params={cwd};if(model)params.model=model;const result=await this.request('thread/start',params),thread=result?.thread;if(thread?.id&&(model||thread.model))this.threadModels.set(thread.id,model||thread.model);return thread;}
  async resumeThread(threadId){const result=await this.request('thread/resume',{threadId}),thread=result?.thread;if(thread?.id&&thread.model)this.threadModels.set(thread.id,thread.model);return thread;}
  async startTurn(threadId,text,{model}={}){if(!threadId||typeof text!=='string'||!text.trim())throw Object.assign(new Error('Thread and message are required.'),{code:'invalid_turn'});const params={threadId,input:[{type:'text',text}]};if(model){params.model=model;this.threadModels.set(threadId,model);}const result=await this.request('turn/start',params,30000);return result?.turn;}
  async interrupt(threadId,turnId=this.activeTurns.get(threadId)){if(!threadId||!turnId)return false;await this.request('turn/interrupt',{threadId,turnId});return true;}
  respondApproval(requestId,decision){if(!['accept','decline','cancel'].includes(decision))throw Object.assign(new Error('Invalid approval decision.'),{code:'invalid_decision'});const pending=this.pendingApprovals.get(requestId);if(!pending)throw Object.assign(new Error('Approval request is no longer pending.'),{code:'approval_not_pending'});this.pendingApprovals.delete(requestId);if(pending.method==='item/permissions/requestApproval'){const permissions=decision==='accept'&&pending.params.permissions&&typeof pending.params.permissions==='object'?pending.params.permissions:{};this.send({id:requestId,result:{permissions,scope:'turn'}});}else this.send({id:requestId,result:{decision}});}
  stop({forceAfterMs=1000}={}){if(this.stopping)return;this.stopping=true;this.ready=false;for(const {timer,reject} of this.pending.values()){clearTimeout(timer);reject(Object.assign(new Error('App server stopped.'),{code:'process_stopped'}));}this.pending.clear();this.pendingApprovals.clear();const child=this.process;if(child){try{child.stdin?.end();}catch{}this.stopTimer=setTimeout(()=>{if(this.process===child)this.terminate(child);},forceAfterMs);this.stopTimer.unref?.();}}
  failAll(category){this.ready=false;for(const {timer,reject} of this.pending.values()){clearTimeout(timer);reject(Object.assign(new Error('App server process failed.'),{code:category}));}this.pending.clear();this.emit('diagnostic',{category});}
  onExit(code,signal){const wasStopping=this.stopping,category=this.stderrCategory||(signal?'process_signal':code===0?'process_exit':'unexpected_exit');clearTimeout(this.stopTimer);this.stopTimer=null;this.process=null;this.ready=false;if(!wasStopping){this.failAll(category);this.emit('exit',{category,code:Number.isInteger(code)?code:null,signal:signal||null});}this.emit('closed',{clean:wasStopping&&code===0,code:Number.isInteger(code)?code:null,signal:signal||null});}
}

module.exports={APPROVAL_METHODS,CodexAppServerClient,safeError};
