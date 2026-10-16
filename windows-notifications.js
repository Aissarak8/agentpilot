'use strict';

const { spawn } = require('child_process');

const DEFAULT_AUMID = 'Microsoft.VisualStudioCode';

function toastArgs(scriptPath, title, message, appId=DEFAULT_AUMID) {
  const encode=value=>Buffer.from(String(value),'utf8').toString('base64');
  return ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',scriptPath,encode(title),encode(message),appId];
}

function showWindowsToast({ scriptPath, title='AgentPilot', message, appId=DEFAULT_AUMID, platform=process.platform, spawnImpl=spawn, timeoutMs=15000 } = {}) {
  if(platform!=='win32')return Promise.resolve({ok:false,category:'unsupported_platform'});
  return new Promise(resolve=>{
    let settled=false, stderr='', timer;
    const finish=result=>{if(!settled){settled=true;clearTimeout(timer);resolve(result);}};
    let child;
    try { child=spawnImpl('powershell.exe',toastArgs(scriptPath,title,message,appId),{windowsHide:true,stdio:['ignore','ignore','pipe']}); }
    catch { return finish({ok:false,category:'process_start'}); }
    child.stderr?.on('data',chunk=>{if(stderr.length<8192)stderr+=String(chunk).slice(0,8192-stderr.length);});
    child.on('error',()=>finish({ok:false,category:'process_start'}));
    child.on('close',code=>{
      if(code===0){const category=/AGENTPILOT_SUCCESS category=([a-z_]+)/.exec(stderr)?.[1]||'sent';return finish({ok:true,category});}
      const category=/AGENTPILOT_ERROR category=([a-z_]+)/.exec(stderr)?.[1]||'powershell_failed';
      const hresult=/hresult=(0x[0-9a-f]+)/i.exec(stderr)?.[1]?.toUpperCase();
      finish({ok:false,category,exitCode:Number.isInteger(code)?code:null,hresult});
    });
    timer=setTimeout(()=>{try{child.kill();}catch{}finish({ok:false,category:'timeout'});},timeoutMs);
  });
}

module.exports={ DEFAULT_AUMID, showWindowsToast, toastArgs };
