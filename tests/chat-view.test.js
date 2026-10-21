'use strict';

const assert=require('node:assert/strict');
const EventEmitter=require('events');
const test=require('node:test');
const { approvalDecision,approvalPrompt }=require('../approval-ui');
const { renderMarkdown }=require('../chat-markdown');
const { ChatViewProvider,publicState,renderChat,startupPrompt,validMessage }=require('../chat-view');

class FakeController extends EventEmitter {
  constructor(){super();this.cwd='C:\\repo';this.session=null;this.requirement='start_process_and_thread';this.sent=[];this.ensureCalls=0;}
  current(){return this.session;}
  startupRequirement(){return this.requirement;}
  async ensureClient(){this.ensureCalls++;}
  async send(text){this.sent.push(text);this.session={id:'session-1',threadId:'thread-1'};this.requirement=null;}
  state(){return{sessions:[],current:this.session,messages:[],models:[],usage:{}};}
}
function providerFixture(choice='Start'){const controller=new FakeController(),prompts=[],vscode={workspace:{isTrusted:true,workspaceFolders:[{uri:{fsPath:'C:\\repo'}}]},window:{showWarningMessage:async(message,options,button)=>{prompts.push({message,options,button});return choice;},showErrorMessage:()=>{}}},provider=new ChatViewProvider({controller,vscode,extensionUri:{},output:null});return{controller,prompts,provider};}

test('chat shell uses incremental state updates, VS Code variables, and requested controls',()=>{const html=renderChat('nonce');assert.match(html,/--vscode-sideBar-background/);assert.match(html,/data-action="rename"/);assert.match(html,/data-action="delete"/);assert.match(html,/Enter to send/);assert.match(html,/!event\.shiftKey/);assert.match(html,/stickToBottom/);assert.match(html,/post\('ready'\)/);assert.doesNotMatch(html,/PRIVATE/);});

test('public chat state renders Markdown safely without leaking raw markup',()=>{const state=publicState({sessions:[],current:null,messages:[{role:'assistant',text:'**safe** <script>PRIVATE</script>\n```js\nconst n=1;\n```'}],models:[],usage:{}});assert.match(state.messages[0].html,/<strong>safe<\/strong>/);assert.match(state.messages[0].html,/&lt;script&gt;PRIVATE&lt;\/script&gt;/);assert.doesNotMatch(state.messages[0].html,/<script>PRIVATE/);assert.match(state.messages[0].html,/<pre><code data-language="js">/);assert.doesNotMatch(renderMarkdown('[bad](javascript:alert(1))'),/href=/);});

test('approval dialog makes deny first and dismissal fails closed',()=>{const prompt=approvalPrompt({method:'item/commandExecution/requestApproval',params:{command:['npm','test']}});assert.equal(prompt.buttons[0],'Deny');assert.match(prompt.options.detail,/AgentPilot never auto-approves/);assert.equal(approvalDecision(undefined),'decline');assert.equal(approvalDecision('Deny'),'decline');assert.equal(approvalDecision('Approve once'),'accept');assert.equal(approvalDecision('Cancel turn'),'cancel');});

test('validates webview messages and keeps the conversation list collapsible',()=>{assert.equal(validMessage({action:'send',text:'hello',model:'model-a'}),true);assert.equal(validMessage({action:'privateAction'}),false);assert.equal(validMessage({action:'send',text:'x'.repeat(100001)}),false);assert.equal(validMessage({action:'switch'}),false);const html=renderChat('nonce');assert.match(html,/aria-expanded/);assert.match(html,/conversationsCollapsed/);assert.match(html,/current turn/);assert.match(html,/prompt\.focus/);});

test('confirms the initial Codex startup once and not normal follow-up turns',async()=>{const {controller,prompts,provider}=providerFixture();await provider.onMessage({action:'send',text:'first'});await provider.onMessage({action:'send',text:'follow-up'});assert.deepEqual(controller.sent,['first','follow-up']);assert.equal(prompts.length,1);assert.match(prompts[0].message,/Start an AgentPilot-owned Codex conversation/);});

test('requires fresh confirmation for a stopped process but keeps denial fail-closed',async()=>{const allowed=providerFixture();allowed.controller.session={id:'session-1',threadId:'thread-1'};allowed.controller.requirement='restart_process';await allowed.provider.onMessage({action:'send',text:'resume'});assert.equal(allowed.prompts.length,1);assert.match(allowed.prompts[0].message,/Restart the AgentPilot-owned Codex process/);assert.deepEqual(allowed.controller.sent,['resume']);const denied=providerFixture('Cancel');denied.controller.session={id:'session-1',threadId:'thread-1'};denied.controller.requirement='restart_process';await denied.provider.onMessage({action:'send',text:'do not run'});assert.deepEqual(denied.controller.sent,[]);});

test('opening the chat view does not launch Codex before confirmation',()=>{const {controller,provider}=providerFixture(),webview={options:null,html:'',onDidReceiveMessage:()=>{}};provider.resolveWebviewView({webview});assert.equal(controller.ensureCalls,0);assert.match(webview.html,/AgentPilot/);});

test('startup prompt distinguishes a new thread from a process restart',()=>{assert.match(startupPrompt('start_thread','C:\\repo').message,/new AgentPilot-owned Codex conversation/);assert.match(startupPrompt('restart_process','C:\\repo').message,/Restart/);});

test('premium chat exposes search, copy, jump, details and responsive accessible states',()=>{const html=renderChat('nonce');assert.match(html,/id="session-search"/);assert.match(html,/id="jump-latest"/);assert.match(html,/id="details-toggle"/);assert.match(html,/copy-message/);assert.match(html,/copy-code/);assert.match(html,/aria-live="assertive"/);assert.match(html,/prefers-reduced-motion/);assert.match(html,/@media\(max-width:330px\)/);assert.doesNotMatch(html,/https?:\/\//);});
