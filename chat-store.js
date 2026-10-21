'use strict';

const crypto=require('crypto');
const fs=require('fs');
const { atomicWrite }=require('./delivery-queue');
const { acquireFileLock,processAlive }=require('./file-lock');

const clean=(value,fallback='unknown',max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
class ChatSessionStore {
  constructor(file,{maxItems=50}={}){this.file=file;this.maxItems=maxItems;this.items=[];this.transact(()=>{let changed=false;for(const item of this.items)if(['running','waiting'].includes(item.status)&&!processAlive(item.ownerPid)){item.status='interrupted';item.ownerPid=null;item.lastErrorCategory='extension_restart';item.updatedAt=new Date().toISOString();changed=true;}return changed||!fs.existsSync(this.file);});}
  read(){try{if(fs.statSync(this.file).size>1024*1024)return[];const parsed=JSON.parse(fs.readFileSync(this.file,'utf8'));return Array.isArray(parsed.items)?parsed.items.filter(item=>item&&typeof item.id==='string').slice(-this.maxItems):[];}catch{return[];}}
  save(){atomicWrite(this.file,{version:1,items:this.items.slice(-this.maxItems)});}
  transact(change){const release=acquireFileLock(this.file);if(!release)throw Object.assign(new Error('Session metadata is busy.'),{code:'store_busy'});try{this.items=this.read();const save=change();if(save)this.save();return save;}finally{release();}}
  create({project,model}){let created;this.transact(()=>{const now=new Date().toISOString();created={id:`chat-${crypto.randomUUID()}`,threadId:null,title:`Conversation ${this.items.length+1}`,project:clean(project),model:clean(model),status:'new',ownerPid:null,createdAt:now,updatedAt:now,lastTurnId:null,lastErrorCategory:null};this.items.push(created);this.items=this.items.slice(-this.maxItems);return true;});return created;}
  update(id,patch){let updated=null;this.transact(()=>{const item=this.items.find(value=>value.id===id);if(!item)return false;const allowed={};for(const key of ['threadId','title','model','status','updatedAt','lastTurnId','lastErrorCategory'])if(Object.prototype.hasOwnProperty.call(patch,key))allowed[key]=key==='title'?clean(patch[key],item.title,80):patch[key];Object.assign(item,allowed);if(Object.prototype.hasOwnProperty.call(patch,'status'))item.ownerPid=['running','waiting'].includes(patch.status)?process.pid:null;updated=item;return true;});return updated;}
  get(id){return this.items.find(item=>item.id===id)||null;}
  rename(id,title){return this.update(id,{title:clean(title,'Conversation',80),updatedAt:new Date().toISOString()});}
  delete(id){let removed=null;this.transact(()=>{const index=this.items.findIndex(item=>item.id===id);if(index<0)return false;[removed]=this.items.splice(index,1);return true;});return removed;}
  recent(){this.items=this.read();return [...this.items].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
}

module.exports={ChatSessionStore};
