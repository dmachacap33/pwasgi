import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@3.2.1/dist/transformers.min.js";
let QUERY_EMBEDDER=null; let PREBUILT_INDEX=[];
export async function loadPrebuiltIndex(manifestUrl='./knowledge/index-manifest.json', onProgress=()=>{}){
  const res=await fetch(manifestUrl);
  if(!res.ok) throw new Error('No se pudo cargar el manifest del índice');
  const manifest=await res.json();
  const shards=manifest.shards||[]; PREBUILT_INDEX=[]; let loaded=0;
  for(const path of shards){
    const r=await fetch(path); const data=await r.json();
    for(const item of data){
      PREBUILT_INDEX.push({text:item.text, source:item.source, embedding:new Float32Array(item.embedding)});
    }
    loaded++; onProgress(loaded, shards.length);
  }
  return { count: PREBUILT_INDEX.length, dim: manifest.dim || (PREBUILT_INDEX[0]?.embedding?.length||0) };
}
export async function getQueryEmbedder(){
  if(!QUERY_EMBEDDER){ QUERY_EMBEDDER=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2'); }
  return QUERY_EMBEDDER;
}
export function cosSim(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
export async function searchPrebuilt(query, topK=6){
  if(!PREBUILT_INDEX.length) return [];
  const embedder=await getQueryEmbedder();
  const out=await embedder(query,{pooling:'mean',normalize:true});
  const q=Array.from(out.data);
  const scored=PREBUILT_INDEX.map(it=>({...it, score: cosSim(q, it.embedding)}));
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0, topK).map((x,i)=>({id:i, source:x.source, text:x.text, score:x.score}));
}
