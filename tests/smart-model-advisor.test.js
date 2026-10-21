'use strict';

const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const test=require('node:test');
const { AdvisorFeedbackStore,classifyTask,estimateComplexity,normalizeModels,recommend }=require('../smart-model-advisor');

const models=[
  {id:'quality-model',displayName:'Quality Model',description:'A frontier model for complex work.',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'high'}]},
  {id:'fast-model',displayName:'Fast Model',description:'Fast and affordable coding model.',additionalSpeedTiers:['fast']},
  {id:'hidden-model',displayName:'Hidden',description:'Most capable.',hidden:true},
  {id:'unknown-model',displayName:'Unknown Model'}
];

test('classifies explicit task categories and returns unknown for insufficient or tied evidence',()=>{
  assert.equal(classifyTask('Debug this crash and find the root cause').category,'debugging');
  assert.equal(classifyTask('Implement a new API feature').category,'code_generation');
  assert.equal(classifyTask('Refactor and simplify this module').category,'refactoring');
  assert.equal(classifyTask('Review this code diff').category,'code_review');
  assert.equal(classifyTask('Generate unit tests').category,'test_generation');
  assert.equal(classifyTask('Plan the system architecture').category,'architecture_planning');
  assert.equal(classifyTask('Write README documentation').category,'documentation');
  assert.equal(classifyTask('Create a simple PowerShell script').category,'simple_scripting');
  assert.equal(classifyTask('Hello there').category,'unknown');
  assert.equal(classifyTask('Debug and refactor').category,'unknown');
  assert.equal(estimateComplexity('Review security across the entire codebase').level,'high');
});

test('filters model availability and preserves only explicit comparison metadata',()=>{
  const available=normalizeModels(models);assert.deepEqual(available.map(model=>model.id),['quality-model','fast-model','unknown-model']);
  assert.equal(available[2].description,'');assert.equal(available[2].defaultReasoningEffort,'');
});

test('changes explainable recommendations by priority without inventing unsupported models',()=>{
  const quality=recommend({task:'Plan a complex architecture migration',priority:'quality',models}),speed=recommend({task:'Write a simple script',priority:'speed',models}),cost=recommend({task:'Create a script',priority:'cost',models});
  assert.equal(quality.recommendedModelId,'quality-model');assert.equal(speed.recommendedModelId,'fast-model');assert.equal(cost.recommendedModelId,'fast-model');
  for(const result of [quality,speed,cost]){assert.ok(result.candidates.every(item=>models.some(model=>model.id===item.id&&!model.hidden)));assert.ok(result.candidates.every(item=>item.reasons.length));assert.ok(result.limitations.length);}
});

test('returns a labeled neutral recommendation when metadata cannot distinguish models',()=>{
  const result=recommend({task:'Hello there',priority:'quality',models:[{id:'a',displayName:'A',isDefault:true},{id:'b',displayName:'B'}]});
  assert.equal(result.neutral,true);assert.equal(result.recommendedModelId,'a');assert.match(result.summary,/does not distinguish/i);
});

test('uses usage and subjective feedback only as disclosed context',()=>{
  const feedback=Array.from({length:3},(_,index)=>({id:String(index),model:'quality-model',category:'debugging',outcome:'successful'}));
  const result=recommend({task:'Debug this crash and root cause',priority:'quality',models,feedback,usageRecords:[{provider:'codex',model:'quality-model',totalTokens:12}]});
  const row=result.candidates.find(item=>item.id==='quality-model');assert.match(row.reasons.join(' '),/subjective feedback/i);assert.match(row.reasons.join(' '),/not a quality score/i);
});

test('feedback storage is bounded, local, and never contains task or conversation text',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentpilot-advisor-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'feedback.json'),store=new AdvisorFeedbackStore(file,{maxItems:2});
  assert.equal(store.add({model:'a',category:'debugging',outcome:'successful',task:'PRIVATE TASK'}).stored,true);assert.equal(store.add({model:'a',category:'debugging',outcome:'partial'}).stored,true);assert.equal(store.add({model:'b',category:'documentation',outcome:'failed'}).stored,true);
  const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/PRIVATE TASK|task|prompt|conversation/i);assert.equal(new AdvisorFeedbackStore(file,{maxItems:2}).items.length,2);assert.equal(store.add({model:'a',category:'debugging',outcome:'invalid'}).stored,false);
});
