#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const { CodexUsageStreamCollector, modelFromArgs } = require('../codex-usage-stream');
const { UsageStore } = require('../usage');

const userArgs=process.argv.slice(2);
let executable=process.env.AGENTPILOT_CODEX_PATH || (process.platform==='win32'?'codex.exe':'codex');
if(userArgs[0]?.startsWith('--codex-path=')) executable=userArgs.shift().slice('--codex-path='.length);
if(process.platform==='win32' && /\.(cmd|bat)$/i.test(executable)){
  process.stderr.write('AgentPilot: use the native codex.exe path on Windows; .cmd/.bat launchers are rejected to avoid shell injection.\n'); process.exit(2);
}
const args=userArgs[0]==='exec'?userArgs:['exec',...userArgs];
if(!args.includes('--json')) args.splice(1,0,'--json');
const base=process.env.AGENTPILOT_DATA_DIR || path.join(os.homedir(),'.agentpilot');
const store=new UsageStore(path.join(base,'usage.json'));
const collector=new CodexUsageStreamCollector(store,{project:path.basename(process.cwd()),model:modelFromArgs(args)});
let child;
try{child=spawn(executable,args,{cwd:process.cwd(),env:process.env,stdio:['inherit','pipe','inherit'],windowsHide:true,shell:false});}
catch(error){process.stderr.write(`AgentPilot: Codex could not start (${error.code||'process_start'}).\n`);process.exit(2);}
child.stdout.on('data',chunk=>{process.stdout.write(chunk);collector.consume(chunk);});
child.stdout.on('end',()=>collector.finish());
child.on('error',error=>{process.stderr.write(`AgentPilot: Codex could not start (${error.code||'process_start'}).\n`);process.exitCode=2;});
child.on('exit',(code,signal)=>{collector.finish();process.exitCode=Number.isInteger(code)?code:(signal?1:0);});
