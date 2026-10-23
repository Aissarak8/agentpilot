'use strict';

const fs=require('fs');
const path=require('path');
const { atomicWrite }=require('./delivery-queue');
const { acquireFileLock,readJsonState }=require('./file-lock');

class NotificationClaims {
  constructor(file,{maxItems=2000}={}){this.file=file;this.maxItems=maxItems;}
  read(){const state=readJsonState(this.file);this.readStatus=state.status;if(state.status==='missing')return[];if(state.status!=='ok'||!state.value||!Array.isArray(state.value.ids)){this.readStatus='corrupt';return[];}return state.value.ids.filter(id=>typeof id==='string').slice(-this.maxItems);}
  claim(id){const safe=typeof id==='string'?id.slice(0,128):'';if(!safe)return false;fs.mkdirSync(path.dirname(this.file),{recursive:true});const release=acquireFileLock(this.file);if(!release)return false;try{const ids=this.read();if(['corrupt','oversized'].includes(this.readStatus)||ids.includes(safe))return false;ids.push(safe);atomicWrite(this.file,{version:1,ids:ids.slice(-this.maxItems)});return true;}finally{release();}}
}

module.exports={NotificationClaims};
