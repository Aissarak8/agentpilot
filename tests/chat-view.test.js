'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const { renderChat }=require('../chat-view');

test('renders responsive chat state with escaped content and controls',()=>{const html=renderChat({sessions:[{id:'s1',title:'Conversation 1',status:'running'}],current:{id:'s1',status:'running',project:'repo',model:'model-a'},messages:[{role:'assistant',text:'<script>PRIVATE</script>',streaming:true}],models:[{id:'model-a',displayName:'Model A'}],usage:{totalTokens:12,inputTokens:10,outputTokens:2,cachedInputTokens:4}},'nonce');assert.match(html,/Codex/);assert.match(html,/Stop/);assert.match(html,/Model A/);assert.match(html,/Tokens: 12/);assert.doesNotMatch(html,/<script>PRIVATE/);assert.match(html,/&lt;script&gt;PRIVATE/);});

test('explains metadata-only history restoration',()=>{const html=renderChat({sessions:[],current:null,messages:[],models:[],usage:{}},'nonce');assert.match(html,/kept in memory only/);assert.match(html,/prior text is not restored/);});
