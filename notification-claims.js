'use strict';

const fs=require('fs');
const path=require('path');
const { atomicWrite }=require('./delivery-queue');
const { acquireFileLock }=require('./file-lock');

class NotificationClaims {
  constructor(file,{maxItems=2000}={}){this.file=file;this.maxItems=maxItems;}
  read(){try{if(fs.statSync(this.file).size>1024*1024)return[];const parsed=JSON.parse(fs.readFileSync(this.file,'utf8'));return Array.isArray(parsed.ids)?parsed.ids.filter(id=>typeof id==='string').slice(-this.maxItems):[];}catch{return[];}}
  claim(id){const safe=typeof id==='string'?id.slice(0,128):'';if(!safe)return false;fs.mkdirSync(path.dirname(this.file),{recursive:true});const release=acquireFileLock(this.file);if(!release)return false;try{const ids=this.read();if(ids.includes(safe))return false;ids.push(safe);atomicWrite(this.file,{version:1,ids:ids.slice(-this.maxItems)});return true;}finally{release();}}
}

module.exports={NotificationClaims};
