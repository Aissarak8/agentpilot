'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const { approvalDecision,approvalPrompt }=require('../approval-ui');
const { renderMarkdown }=require('../chat-markdown');
const { publicState,renderChat }=require('../chat-view');

test('chat shell uses incremental state updates, VS Code variables, and requested controls',()=>{const html=renderChat('nonce');assert.match(html,/--vscode-sideBar-background/);assert.match(html,/data-action="rename"/);assert.match(html,/data-action="delete"/);assert.match(html,/Enter to send/);assert.match(html,/!event\.shiftKey/);assert.match(html,/stickToBottom/);assert.match(html,/post\('ready'\)/);assert.doesNotMatch(html,/PRIVATE/);});

test('public chat state renders Markdown safely without leaking raw markup',()=>{const state=publicState({sessions:[],current:null,messages:[{role:'assistant',text:'**safe** <script>PRIVATE</script>\n```js\nconst n=1;\n```'}],models:[],usage:{}});assert.match(state.messages[0].html,/<strong>safe<\/strong>/);assert.match(state.messages[0].html,/&lt;script&gt;PRIVATE&lt;\/script&gt;/);assert.doesNotMatch(state.messages[0].html,/<script>PRIVATE/);assert.match(state.messages[0].html,/<pre><code data-language="js">/);assert.doesNotMatch(renderMarkdown('[bad](javascript:alert(1))'),/href=/);});

test('approval dialog makes deny first and dismissal fails closed',()=>{const prompt=approvalPrompt({method:'item/commandExecution/requestApproval',params:{command:['npm','test']}});assert.equal(prompt.buttons[0],'Deny');assert.match(prompt.options.detail,/AgentPilot never auto-approves/);assert.equal(approvalDecision(undefined),'decline');assert.equal(approvalDecision('Deny'),'decline');assert.equal(approvalDecision('Approve once'),'accept');assert.equal(approvalDecision('Cancel turn'),'cancel');});
