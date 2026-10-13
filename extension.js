const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
let panel; let watcher; let poller;
function readEvents(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).slice(-300);
    return raw.map(line => { try {return JSON.parse(line)} catch {return null} }).filter(x => x && typeof x === 'object');
  } catch {return []}
}
function escapeHtml(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function html(events) {
  const rows = events.slice(-60).reverse().map(e=>`<tr><td>${escapeHtml(e.time||'')}</td><td>${escapeHtml(e.agent||'')}</td><td>${escapeHtml(e.kind||'')}</td><td>${escapeHtml(e.project||'')}</td></tr>`).join('');
  const counts = ['claude','codex'].map(a=>`${a}: ${events.filter(e=>e.agent===a).length}`).join(' | ');
  return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font-family:var(--vscode-font-family);padding:18px}h1{margin-top:0}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid var(--vscode-panel-border);text-align:left}.stats{padding:12px;background:var(--vscode-editor-inactiveSelectionBackground);border-radius:8px}</style></head><body><h1>AgentPilot · Local Dashboard</h1><div class="stats">Events: ${events.length} | ${counts}</div><p>V1 displays hook events only. Token usage, costs, and recommendations are not yet implemented.</p><table><thead><tr><th>Time</th><th>Agent</th><th>Event</th><th>Project</th></tr></thead><tbody>${rows||'<tr><td colspan="4">No events yet. Run Test Notification.</td></tr>'}</tbody></table></body></html>`;
}
function postTelegram(token, chatId, message) {
  return new Promise((resolve,reject)=>{
    if(!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)) return reject(new Error('Invalid bot token format'));
    const body = JSON.stringify({chat_id:chatId,text:message});
    const req=https.request({hostname:'api.telegram.org',port:443,path:`/bot${token}/sendMessage`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:8000},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>res.statusCode===200?resolve():reject(new Error(`Telegram API HTTP ${res.statusCode}`)))});
    req.on('timeout',()=>req.destroy(new Error('Telegram timeout')));req.on('error',reject);req.end(body);
  });
}
function activate(context) {
  const base=path.join(require('os').homedir(),'.agentpilot');fs.mkdirSync(base,{recursive:true});
  const file=path.join(base,'events.jsonl');if(!fs.existsSync(file))fs.writeFileSync(file,'');
  let previous=readEvents(file).length;
  const config=()=>vscode.workspace.getConfiguration('agentpilot');
  async function handleNew() {
    const list=readEvents(file);
    if (list.length < previous) {previous=0;}
    const fresh=list.slice(previous);previous=list.length;
    for(const e of fresh) {
      if(config().get('enableDesktop',true)) vscode.window.showInformationMessage(`AgentPilot: ${e.agent||'Agent'} · ${e.kind||'event'}`);
      if(config().get('enableTelegram',false)) {
        const token=process.env.AGENTPILOT_TELEGRAM_TOKEN || config().get('telegramBotToken','');
        const chat=process.env.AGENTPILOT_TELEGRAM_CHAT_ID || config().get('telegramChatId','');
        if(token && chat) try {await postTelegram(token,chat,`AgentPilot: ${e.agent||'Agent'} · ${e.kind||'event'}\n${e.project||''}`)} catch(err){vscode.window.showWarningMessage(`AgentPilot Telegram failed: ${err.message}`)}
      }
    }
    if(panel) panel.webview.html=html(list);
  }
  watcher=fs.watch(base,(event,name)=>{if(name==='events.jsonl')handleNew().catch(()=>{})});
  poller=setInterval(()=>handleNew().catch(()=>{}),2500);
  context.subscriptions.push(vscode.commands.registerCommand('agentpilot.openDashboard',()=>{panel=vscode.window.createWebviewPanel('agentpilot','AgentPilot Dashboard',vscode.ViewColumn.One,{});panel.webview.html=html(readEvents(file));panel.onDidDispose(()=>panel=undefined)}));
  context.subscriptions.push(vscode.commands.registerCommand('agentpilot.testNotification',()=>{fs.appendFileSync(file,JSON.stringify({time:new Date().toISOString(),agent:'test',kind:'completed',project:'demo'})+'\n');handleNew()}));
  context.subscriptions.push({dispose(){watcher?.close();clearInterval(poller)}});
}
function deactivate(){watcher?.close();clearInterval(poller)}
module.exports={activate,deactivate,readEvents,escapeHtml};
