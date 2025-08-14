import { loadPrebuiltIndex, searchPrebuilt } from './rag.js';
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.48";
const el=id=>document.getElementById(id);
const chat=el('chat'), genStatus=el('genStatus'), indexInfo=el('indexInfo');
const userInput=el('userInput'), modelSelect=el('modelSelect'), topK=el('topK'), temperature=el('temperature'), sendBtn=el('sendBtn');
function addMsg(text, who='ai', src=null){ const d=document.createElement('div'); d.className='msg '+(who==='user'?'user':'ai'); d.textContent=text; if(src){const s=document.createElement('span'); s.className='src'; s.textContent=src; d.appendChild(s);} chat.appendChild(d); chat.scrollTop=chat.scrollHeight; }
function setStatus(t,txt){ t.textContent=txt||''; }
async function initIndex(){ try{ const info=await loadPrebuiltIndex('./knowledge/index-manifest.json',(i,n)=>setStatus(indexInfo,`Cargando índice… (${i}/${n})`)); setStatus(indexInfo,`Índice cargado. Fragmentos: ${info.count} · Dimensión: ${info.dim}`);}catch(e){ setStatus(indexInfo,'Error cargando el índice: '+e.message);} }
let engine=null; let modelId='TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC';
async function ensureEngine(){ if(engine) return engine; setStatus(genStatus,'Cargando modelo en el navegador…'); engine=await CreateMLCEngine(modelId,{initProgressCallback:(i)=>setStatus(genStatus, i.text||'Cargando…')}); setTimeout(()=>setStatus(genStatus,''),1000); return engine; }
function buildPrompt(q,ctxs){ const ctx=ctxs.map((c,i)=>`[#${i+1} | ${c.source} | score=${c.score.toFixed(3)}]\n${c.text}`).join('\n\n'); return `Eres un asistente experto que responde en español. Usa EXCLUSIVAMENTE el contexto proporcionado (si es relevante).
Si la respuesta no está en el contexto, di: "no encuentro esa información en los documentos".
Responde breve, claro y práctico. Añade referencias [#n] al final de las frases que usen un fragmento.

[CONTEXTOS]\n${ctx||'(sin contextos)'}\n\n[PREGUNTA]\n${q}\n\n[RESPUESTA]`; }
async function handleSend(){ const q=userInput.value.trim(); if(!q) return; addMsg(q,'user'); userInput.value=''; const k=Math.max(1,Math.min(20,parseInt(topK.value||'6',10))); const temp=Math.max(0,Math.min(2,parseFloat(temperature.value||'0.2'))); let contexts=[]; try{contexts=await searchPrebuilt(q,k);}catch(e){console.error(e);} const prompt=buildPrompt(q,contexts); const eng=await ensureEngine(); setStatus(genStatus,'Generando…'); try{ const stream=await eng.chat.completions.create({messages:[{role:'system',content:'Eres un asistente útil y preciso.'},{role:'user',content:prompt}],stream:true,temperature:temp}); const d=document.createElement('div'); d.className='msg ai'; chat.appendChild(d); for await (const chunk of stream){ const delta=chunk?.choices?.[0]?.delta?.content||''; d.textContent+=delta; chat.scrollTop=chat.scrollHeight; } }catch(e){ addMsg('Error generando respuesta: '+e.message,'ai'); } finally{ setStatus(genStatus,''); } }
modelSelect.addEventListener('change',()=>{modelId=modelSelect.value; engine=null; setStatus(genStatus,'Modelo cambiado, se cargará al enviar…');});
sendBtn.addEventListener('click',handleSend);
userInput.addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); handleSend(); }});
let deferredPrompt=null; const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.style.display='inline-block';});
installBtn.addEventListener('click',async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.style.display='none'; });
initIndex();
