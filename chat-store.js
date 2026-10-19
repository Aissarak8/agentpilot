'use strict';

const crypto=require('crypto');
const fs=require('fs');
const { atomicWrite }=require('./delivery-queue');

const clean=(value,fallback='unknown',max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
class ChatSessionStore {
  constructor(file,{maxItems=50}={}){this.file=file;this.maxItems=maxItems;this.items=this.read();for(const item of this.items)if(item.status==='running')item.status='interrupted';this.save();}
  read(){try{if(fs.statSync(this.file).size>1024*1024)return[];const parsed=JSON.parse(fs.readFileSync(this.file,'utf8'));return Array.isArray(parsed.items)?parsed.items.filter(item=>item&&typeof item.id==='string').slice(-this.maxItems):[];}catch{return[];}}
  save(){atomicWrite(this.file,{version:1,items:this.items.slice(-this.maxItems)});}
  create({project,model}){const now=new Date().toISOString(),item={id:`chat-${crypto.randomUUID()}`,threadId:null,title:`Conversation ${this.items.length+1}`,project:clean(project),model:clean(model),status:'new',createdAt:now,updatedAt:now,lastTurnId:null,lastErrorCategory:null};this.items.push(item);this.items=this.items.slice(-this.maxItems);this.save();return item;}
  update(id,patch){const item=this.items.find(value=>value.id===id);if(!item)return null;const allowed={};for(const key of ['threadId','title','model','status','updatedAt','lastTurnId','lastErrorCategory'])if(Object.prototype.hasOwnProperty.call(patch,key))allowed[key]=key==='title'?clean(patch[key],item.title,80):patch[key];Object.assign(item,allowed);this.save();return item;}
  get(id){return this.items.find(item=>item.id===id)||null;}
  recent(){return [...this.items].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
}

module.exports={ChatSessionStore};
