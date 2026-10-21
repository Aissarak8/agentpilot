'use strict';

const APPROVAL_LABELS={
  'item/commandExecution/requestApproval':'Command execution',
  'item/fileChange/requestApproval':'File changes',
  'item/permissions/requestApproval':'Additional permissions'
};
const clean=(value,fallback,max=800)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;

function approvalPrompt(request){
  const params=request?.params&&typeof request.params==='object'?request.params:{};
  const kind=APPROVAL_LABELS[request?.method]||'Codex action';
  let requested;
  if(request?.method==='item/commandExecution/requestApproval')requested=Array.isArray(params.command)?params.command.map(part=>String(part)).join(' '):clean(params.command||params.reason,'A command');
  else if(request?.method==='item/permissions/requestApproval')requested=clean(params.reason,'Codex requested additional permissions');
  else requested=clean(params.reason,'Codex requested permission to apply file changes');
  return {message:`${kind} requires your approval`,options:{modal:true,detail:`Requested: ${requested.slice(0,800)}\n\nChoose Deny unless you understand and intend this action. Any approved permission is limited to this turn. AgentPilot never auto-approves.`},buttons:['Deny','Approve once','Cancel turn']};
}

function approvalDecision(choice){return choice==='Approve once'?'accept':choice==='Cancel turn'?'cancel':'decline';}

module.exports={approvalDecision,approvalPrompt};
