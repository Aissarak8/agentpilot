'use strict';

const crypto=require('crypto');
const fs=require('fs');
const { atomicWrite }=require('./delivery-queue');
const { acquireFileLock }=require('./file-lock');

const CATEGORIES={
  debugging:[/\b(debug|troubleshoot)\w*\b/i,/\b(bug|error|exception|crash|regression|root cause)\b/i,/\b(fix|resolve|investigate)\b(?:\s+[a-z0-9_.-]+){0,6}\s+\b(bug|error|exception|crash|regression)\b/i],
  code_generation:[/\b(implement|build|create|add|generate|scaffold)\b/i,/\b(feature|function|class|api|component)\b/i],
  refactoring:[/\b(refactor|restructure|cleanup|clean up|extract|rename|simplif)\w*\b/i],
  code_review:[/\b(review|audit|inspect)\w*\b/i,/\b(code review|review (a |the )?(pull request|pr|diff)|security audit)\b/i],
  test_generation:[/\b(test|tests|testing|coverage|spec|fixture|mock)\b/i,/\b(generate|write|add|create)\s+(unit |integration |regression )?tests?\b/i],
  architecture_planning:[/\b(architect|architecture|design|plan|strategy|trade[ -]?off|system design)\b/i],
  documentation:[/\b(document|documentation|readme|guide|docs|comment|changelog)\b/i],
  simple_scripting:[/\b(script|automation|automate|one[- ]?liner|batch|powershell|bash)\b/i,/\b(create|write|make|run)\s+(a\s+)?(simple\s+)?(powershell|bash|batch|shell|python|node)?\s*script\b/i]
};
const LABELS={debugging:'Debugging',code_generation:'Code generation',refactoring:'Refactoring',code_review:'Code review',test_generation:'Test generation',architecture_planning:'Architecture and planning',documentation:'Documentation',simple_scripting:'Simple scripting',unknown:'Unknown'};
const OUTCOMES=new Set(['successful','partial','failed','not_rated']);
const clean=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';

function classifyTask(text){
  const value=clean(text,100000);if(!value)return{category:'unknown',label:LABELS.unknown,confidence:'insufficient',evidence:[]};
  const matches=[];for(const [category,patterns] of Object.entries(CATEGORIES)){const evidence=patterns.filter(pattern=>pattern.test(value)).map(pattern=>pattern.source);if(evidence.length)matches.push({category,count:evidence.length,evidence});}
  matches.sort((a,b)=>b.count-a.count||Object.keys(CATEGORIES).indexOf(a.category)-Object.keys(CATEGORIES).indexOf(b.category));
  if(!matches.length||matches.length>1&&matches[0].count===matches[1].count)return{category:'unknown',label:LABELS.unknown,confidence:'insufficient',evidence:matches.slice(0,3).map(item=>LABELS[item.category])};
  const winner=matches[0];return{category:winner.category,label:LABELS[winner.category],confidence:winner.count>1?'strong':'limited',evidence:[`Matched explicit ${LABELS[winner.category].toLowerCase()} terms.`]};
}

function estimateComplexity(text){const value=clean(text,100000);if(!value)return{level:'unknown',reasons:['No task characteristics were provided.']};const high=[/\b(architecture|migration|distributed|concurren|security|performance|multi[- ]?(file|service)|end[- ]to[- ]end|complex)\w*\b/i,/\b(across|entire|whole)\s+(repository|codebase|project)\b/i],low=[/\b(simple|small|quick|one[- ]?liner|single file|typo)\b/i];if(high.some(rule=>rule.test(value)))return{level:'high',reasons:['The task explicitly mentions broad, complex, or high-risk characteristics.']};if(low.some(rule=>rule.test(value)))return{level:'low',reasons:['The task explicitly describes a small or simple scope.']};return{level:'medium',reasons:['No explicit low- or high-complexity characteristic dominated.']};}

function normalizeModels(models){return(Array.isArray(models)?models:[]).filter(model=>model&&typeof model.id==='string'&&!model.hidden).map(model=>({id:clean(model.id),displayName:clean(model.displayName||model.id),description:clean(model.description,500),isDefault:model.isDefault===true,defaultReasoningEffort:clean(model.defaultReasoningEffort),reasoningEfforts:Array.isArray(model.supportedReasoningEfforts)?model.supportedReasoningEfforts.map(value=>clean(value.reasoningEffort||value)).filter(Boolean):[],speedTiers:[...(Array.isArray(model.additionalSpeedTiers)?model.additionalSpeedTiers:[]),...(Array.isArray(model.serviceTiers)?model.serviceTiers.flatMap(value=>[value?.name,value?.description]):[])].map(value=>clean(value)).filter(Boolean)}));}

function recommend({task='',priority='quality',models=[],usageRecords=[],feedback=[]}={}){
  const safePriority=['speed','quality','cost'].includes(priority)?priority:'quality',classification=classifyTask(task),complexity=estimateComplexity(task),available=normalizeModels(models);
  if(!available.length)return{classification,complexity,priority:safePriority,neutral:true,recommendedModelId:null,candidates:[],summary:'No visible models were returned by the authenticated Codex model catalog.',limitations:['AgentPilot only recommends models returned by model/list.']};
  const rows=available.map(model=>{let score=0;const reasons=[],description=model.description.toLowerCase(),speed=model.speedTiers.join(' ').toLowerCase();
    if(safePriority==='speed'&&(description.includes('fast')||speed.includes('fast'))){score+=2;reasons.push('The Codex catalog explicitly describes a fast model or speed tier.');}
    if(safePriority==='cost'&&/(affordable|low.cost|econom)/.test(description)){score+=2;reasons.push('The Codex catalog explicitly describes the model as affordable.');}
    if(safePriority==='quality'&&/(most capable|frontier|complex|demanding)/.test(description)){score+=2;reasons.push('The Codex catalog explicitly describes capability for complex or frontier work.');}
    if(complexity.level==='high'&&/(complex|capable|frontier|long-running)/.test(description)){score+=1;reasons.push('Its provider description aligns with the task’s explicit high complexity.');}
    if(complexity.level==='low'&&safePriority==='speed'&&model.defaultReasoningEffort==='low'){score+=1;reasons.push('The catalog reports low as its default reasoning effort.');}
    const samples=feedback.filter(item=>item.model===model.id&&item.category===classification.category&&item.outcome!=='not_rated'),positive=samples.filter(item=>item.outcome==='successful').length;
    if(samples.length>=3){reasons.push(`Local subjective feedback: ${positive}/${samples.length} successful for this category; shown as context, not objective quality.`);}
    const usage=usageRecords.filter(item=>item.provider==='codex'&&item.model===model.id),tokens=usage.reduce((sum,item)=>sum+Number(item.totalTokens||0),0);if(usage.length)reasons.push(`Local usage context: ${usage.length} verified record(s), ${tokens.toLocaleString()} tokens; token volume is not a quality score.`);
    if(!reasons.length)reasons.push('No priority-specific comparison evidence is present in the verified catalog metadata.');
    return{...model,score,reasons,feedbackSamples:samples.length,usageSamples:usage.length};});
  rows.sort((a,b)=>b.score-a.score||Number(b.isDefault)-Number(a.isDefault)||a.displayName.localeCompare(b.displayName));const best=rows[0].score,tied=rows.filter(row=>row.score===best),neutral=best<=0||tied.length>1,recommended=neutral?(available.find(model=>model.isDefault)||null):rows[0];
  return{classification,complexity,priority:safePriority,neutral,recommendedModelId:recommended?.id||null,candidates:rows,summary:neutral?(recommended?`Evidence does not distinguish one model reliably. The catalog default, ${recommended.displayName}, is shown as a neutral starting point.`:'Evidence does not distinguish one model reliably. Choose from the available catalog.'):`${rows[0].displayName} best matches the selected priority using the verified catalog evidence shown below.`,limitations:['Catalog descriptions are provider metadata, not independent benchmarks.','Token use and completed events are not treated as quality evidence.',safePriority==='cost'?'No verified API-equivalent price comparison is available for these models unless explicit pricing metadata is supplied.':'Latency and quality are not inferred from incomparable historical tasks.']};
}

class AdvisorFeedbackStore{
  constructor(file,{maxItems=500}={}){this.file=file;this.maxItems=maxItems;this.items=this.read();}
  read(){try{if(fs.statSync(this.file).size>1024*1024)return[];const value=JSON.parse(fs.readFileSync(this.file,'utf8'));return(Array.isArray(value.items)?value.items:[]).filter(item=>item&&typeof item.id==='string'&&OUTCOMES.has(item.outcome)).slice(-this.maxItems);}catch{return[];}}
  add({model,category,outcome}){if(!OUTCOMES.has(outcome)||!clean(model)||!LABELS[category])return{stored:false,reason:'invalid'};const release=acquireFileLock(this.file);if(!release)return{stored:false,reason:'busy'};try{this.items=this.read();const item={id:`feedback-${crypto.randomUUID()}`,model:clean(model),category,timestamp:new Date().toISOString(),outcome};this.items.push(item);this.items=this.items.slice(-this.maxItems);atomicWrite(this.file,{version:1,items:this.items});return{stored:true,item};}finally{release();}}
}

module.exports={AdvisorFeedbackStore,CATEGORIES,LABELS,classifyTask,estimateComplexity,normalizeModels,recommend};
