'use strict';

const fs=require('fs');

const wait=milliseconds=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,milliseconds);

function acquireFileLock(file,{waitMs=1000,staleMs=30000,now=Date.now}={}){
  const lock=`${file}.lock`,deadline=now()+waitMs;
  while(now()<=deadline){
    try{fs.mkdirSync(lock);return()=>{try{fs.rmdirSync(lock);}catch{}};}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      try{if(now()-fs.statSync(lock).mtimeMs>staleMs)fs.rmdirSync(lock);}catch{}
      wait(20);
    }
  }
  return null;
}

function processAlive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}}

module.exports={acquireFileLock,processAlive};
