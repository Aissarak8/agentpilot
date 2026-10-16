const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { DEFAULT_AUMID, showWindowsToast, toastArgs } = require('../windows-notifications');

function childResult({ code=0, stderr='' }={}) {
  const child=new EventEmitter(); child.stderr=new PassThrough(); child.kill=()=>{};
  process.nextTick(()=>{if(stderr)child.stderr.write(stderr);child.stderr.end();child.emit('close',code);});
  return child;
}

test('builds encoded PowerShell arguments with the registered VS Code identity', () => {
  const args=toastArgs('toast.ps1','AgentPilot','private message');
  assert.equal(args[5],'toast.ps1'); assert.equal(Buffer.from(args[6],'base64').toString(),'AgentPilot'); assert.equal(Buffer.from(args[7],'base64').toString(),'private message'); assert.equal(args[8],DEFAULT_AUMID);
});

test('reports native toast and balloon fallback success', async () => {
  const direct=await showWindowsToast({platform:'win32',scriptPath:'x',message:'m',spawnImpl:()=>childResult()});
  const fallback=await showWindowsToast({platform:'win32',scriptPath:'x',message:'m',spawnImpl:()=>childResult({stderr:'AGENTPILOT_SUCCESS category=balloon_fallback'})});
  assert.deepEqual(direct,{ok:true,category:'sent'}); assert.deepEqual(fallback,{ok:true,category:'balloon_fallback'});
});

test('returns sanitized PowerShell diagnostics without raw stderr', async () => {
  const result=await showWindowsToast({platform:'win32',scriptPath:'x',message:'PRIVATE',spawnImpl:()=>childResult({code:1,stderr:'PRIVATE AGENTPILOT_ERROR category=identity_denied stage=show hresult=0x80070005'})});
  assert.deepEqual(result,{ok:false,category:'identity_denied',exitCode:1,hresult:'0X80070005'}); assert.doesNotMatch(JSON.stringify(result),/PRIVATE|stage/);
});

test('does not start PowerShell on unsupported platforms', async () => {
  let calls=0; const result=await showWindowsToast({platform:'linux',scriptPath:'x',message:'m',spawnImpl:()=>{calls++;}});
  assert.equal(result.category,'unsupported_platform'); assert.equal(calls,0);
});

test('classifies process start failures', async () => {
  const result=await showWindowsToast({platform:'win32',scriptPath:'x',message:'m',spawnImpl:()=>{throw new Error('PRIVATE');}});
  assert.deepEqual(result,{ok:false,category:'process_start'});
});
