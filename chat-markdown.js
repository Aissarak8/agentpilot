'use strict';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function inline(value){
  let text=escapeHtml(value),codes=[];
  text=text.replace(/`([^`\n]+)`/g,(_,code)=>{codes.push(`<code>${code}</code>`);return `\u0000${codes.length-1}\u0000`;});
  text=text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi,'<a href="$2">$1</a>');
  text=text.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
  text=text.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/g,(_,index)=>codes[Number(index)]||'');
}

function renderMarkdown(value){
  const source=String(value??'').replace(/\r\n?/g,'\n'),blocks=[];
  const protectedText=source.replace(/```([^\n]*)\n?([\s\S]*?)```/g,(_,language,code)=>{const label=String(language||'').trim().replace(/[^a-zA-Z0-9_+.-]/g,'').slice(0,32);blocks.push(`<pre><code${label?` data-language="${label}"`:''}>${escapeHtml(code.replace(/\n$/,''))}</code></pre>`);return `\u0001${blocks.length-1}\u0001`;});
  const lines=protectedText.split('\n'),out=[];let list=null;
  const closeList=()=>{if(list){out.push(`</${list}>`);list=null;}};
  for(const raw of lines){
    const marker=raw.match(/^\u0001(\d+)\u0001$/);if(marker){closeList();out.push(blocks[Number(marker[1])]||'');continue;}
    const bullet=raw.match(/^\s*[-*]\s+(.+)$/),numbered=raw.match(/^\s*\d+[.)]\s+(.+)$/);
    if(bullet||numbered){const type=bullet?'ul':'ol';if(list!==type){closeList();out.push(`<${type}>`);list=type;}out.push(`<li>${inline((bullet||numbered)[1])}</li>`);continue;}
    closeList();if(!raw.trim()){out.push('');continue;}
    const heading=raw.match(/^(#{1,3})\s+(.+)$/);if(heading){const level=heading[1].length;out.push(`<h${level}>${inline(heading[2])}</h${level}>`);continue;}
    const quote=raw.match(/^>\s?(.*)$/);out.push(quote?`<blockquote>${inline(quote[1])}</blockquote>`:`<p>${inline(raw)}</p>`);
  }
  closeList();return out.join('\n');
}

module.exports={escapeHtml,renderMarkdown};
