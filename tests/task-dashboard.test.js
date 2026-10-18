'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const Module=require('node:module');

test('dashboard renders task status and duration without prompt content',()=>{const original=Module._load;Module._load=function(name,...args){if(name==='vscode')return{};return original.call(this,name,...args);};const {render}=require('../extension');Module._load=original;const telegram={connected:false,enabled:false,history:{counts:{},recent:[]}},analytics={totals:{records:0},byProvider:{},byModel:{},byProject:{},bySource:{},daily:{},weekly:{},records:[]};const html=render([],telegram,analytics,'nonce',[{id:'task',startedAt:'2026-01-01T00:00:00Z',project:'repo',status:'completed',durationMs:2100,errorCategory:null}]);assert.match(html,/AgentPilot-owned Codex tasks/);assert.match(html,/completed/);assert.match(html,/2s/);assert.doesNotMatch(html,/PRIVATE TASK/);});

test('cancellation notifications use the existing configurable local dispatch',()=>{const {shouldNotify}=require('../extension');const enabled={get:(key,fallback)=>key==='notifyOnCancellation'?true:fallback},disabled={get:(key,fallback)=>key==='notifyOnCancellation'?false:fallback};assert.equal(shouldNotify({kind:'interrupted',test:false},enabled),true);assert.equal(shouldNotify({kind:'interrupted',test:false},disabled),false);});
