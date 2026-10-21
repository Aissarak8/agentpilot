'use strict';

const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const test=require('node:test');
const { NotificationClaims }=require('../notification-claims');

test('multiple windows claim each event notification exactly once',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-claims-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'claims.json'),one=new NotificationClaims(file),two=new NotificationClaims(file);assert.equal(one.claim('event-1'),true);assert.equal(two.claim('event-1'),false);assert.equal(two.claim('event-2'),true);assert.deepEqual(new NotificationClaims(file).read(),['event-1','event-2']);});

test('notification claims are bounded and contain only stable ids',t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-claims-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'claims.json'),claims=new NotificationClaims(file,{maxItems:2});assert.equal(claims.claim(''),false);claims.claim('one');claims.claim('two');claims.claim('three');assert.deepEqual(claims.read(),['two','three']);assert.doesNotMatch(fs.readFileSync(file,'utf8'),/prompt|source|token/i);});
