const {test}=require('node:test');const assert=require('node:assert/strict');
// VS Code module is mocked so utilities can be tested without VS Code host.
const Module=require('node:module');const original=Module._load;
Module._load=function(name,...args){if(name==='vscode')return {};return original.call(this,name,...args)};
const {escapeHtml,readEvents}=require('../extension.js');Module._load=original;
test('escapes HTML',()=>assert.equal(escapeHtml('<script>'), '&lt;script&gt;'));
test('empty event history',()=>assert.deepEqual(readEvents('/not/a/file'),[]));
