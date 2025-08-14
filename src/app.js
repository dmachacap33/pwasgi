// Main app: UI, parsers, WebLLM chat with RAG context
import { addDocuments, search, clearDatabase, countChunks } from "./rag.js";
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.48";

// ----------- File parsers -----------
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
import * as mammoth from "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js";

async function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsArrayBuffer(file);
  });
}

async function readFileAsText(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsText(file, 'utf-8');
  });
}

async function parseDOCX(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function parseXLSX(file) {
  const data = await readFileAsArrayBuffer(file);
  const wb = XLSX.read(data, { type: 'array' });
  let text = "";
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    text += `\n\n[Hoja: ${name}]\n`;
    for (const r of rows) {
      text += r.map(c => (c===None||c===undefined) ? "" : String(c)).join(" | ") + "\n";
    }
  }
  return text;
}

async function parseCSV(file) {
  return await readFileAsText(file);
}

async function parseTXT(file) {
  return await readFileAsText(file);
}

async function toDocs(files) {
  const docs = [];
  for (const f of files) {
    let content = "";
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext === 'docx') content = await parseDOCX(f);
    else if (ext === 'xlsx') content = await parseXLSX(f);
    else if (ext === 'csv') content = await parseCSV(f);
    else if (ext === 'txt') content = await parseTXT(f);
    else continue;
    if (content && content.trim().length) {
      docs.push({ id: crypto.randomUUID(), source: f.name, content });
    }
  }
  return docs;
}

// ----------- UI helpers -----------
const el = (id) => document.getElementById(id);
const filesList = el('filesList');
const indexStatus = el('indexStatus');
const genStatus = el('genStatus');
const chat = el('chat');
const userInput = el('userInput');

function addMsg(text, who = 'ai', src = null) {
  const div = document.createElement('div');
  div.className = 'msg ' + (who === 'user' ? 'user' : 'ai');
  div.textContent = text;
  if (src) {
    const s = document.createElement('span');
    s.className = 'src';
    s.textContent = src;
    div.appendChild(s);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function setStatus(target, text) { target.textContent = text || ''; }

// ----------- WebLLM engine -----------
let engine = null;
let modelId = 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC';
async function ensureEngine() {
  if (engine) return engine;
  setStatus(genStatus, 'Cargando modelo (1ra vez puede tardar: se descarga el modelo al navegador)…');
  try {
    engine = await CreateMLCEngine(modelId, { 
      // GPU preferida, con fallback a WASM
      initProgressCallback: (info) => setStatus(genStatus, info.text || 'Cargando modelo…')
    });
  } catch (e) {
    setStatus(genStatus, 'Error al cargar el modelo: ' + e.message);
    throw e;
  } finally {
    setTimeout(() => setStatus(genStatus, ''), 1200);
  }
  return engine;
}

// ----------- RAG prompt -----------
function buildPrompt(query, contexts) {
  const ctx = contexts.map((c, i) => `[#${i+1} | ${c.source} | score=${c.score.toFixed(3)}]\n${c.text}`).join('\n\n');
  return `Eres un asistente experto que responde en español. Usa EXCLUSIVAMENTE el contexto proporcionado (si es relevante). 
Si la respuesta no está en el contexto, di honestamente "no encuentro esa información en los documentos cargados".
Responde de forma breve, clara y práctica. Añade referencias [#n] al final de las frases que usen un fragmento.

[CONTEXTOS]\n${ctx || '(sin contextos)'}\n\n[PREGUNTA]\n${query}\n\n[RESPUESTA]`;
}

// ----------- Events -----------
const fileInput = el('fileInput');
const indexBtn = el('indexBtn');
const clearDbBtn = el('clearDbBtn');
const sendBtn = el('sendBtn');
const modelSelect = el('modelSelect');
const topK = el('topK');
const temperature = el('temperature');

let pickedFiles = [];
fileInput.addEventListener('change', () => {
  pickedFiles = Array.from(fileInput.files || []);
  filesList.innerHTML = '';
  pickedFiles.forEach(f => {
    const pill = document.createElement('span');
    pill.className = 'file-pill';
    pill.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
    filesList.appendChild(pill);
  });
});

indexBtn.addEventListener('click', async () => {
  if (!pickedFiles.length) {
    setStatus(indexStatus, 'Selecciona archivos primero.');
    return;
  }
  setStatus(indexStatus, 'Procesando e indexando…');
  try {
    const docs = await toDocs(pickedFiles);
    const totalBefore = await countChunks();
    await addDocuments(docs);
    const totalAfter = await countChunks();
    setStatus(indexStatus, `Listo. Chunks totales en tu base: ${totalAfter} (añadidos ${totalAfter - totalBefore}).`);
  } catch (e) {
    setStatus(indexStatus, 'Error: ' + e.message);
  }
});

clearDbBtn.addEventListener('click', async () => {
  await clearDatabase();
  setStatus(indexStatus, 'Base de embeddings borrada.');
});

modelSelect.addEventListener('change', async () => {
  modelId = modelSelect.value;
  engine = null;
  setStatus(genStatus, 'Modelo cambiado. Se cargará en el próximo mensaje…');
});

async function handleSend() {
  const q = userInput.value.trim();
  if (!q) return;
  addMsg(q, 'user');
  userInput.value = '';
  const k = Math.max(1, Math.min(10, parseInt(topK.value || '5', 10)));
  const temp = Math.max(0, Math.min(2, parseFloat(temperature.value || '0.3')));

  let contexts = [];
  try {
    contexts = await search(q, k);
  } catch (e) {
    console.error(e);
  }
  const prompt = buildPrompt(q, contexts);

  const eng = await ensureEngine();
  setStatus(genStatus, 'Generando…');
  const messages = [
    { role: 'system', content: 'Eres un asistente útil y preciso.'},
    { role: 'user', content: prompt }
  ];
  let acc = '';
  try {
    const stream = await eng.chat.completions.create({
      messages,
      stream: true,
      temperature: temp,
      // Optional: max_tokens: 512,
    });
    const div = document.createElement('div');
    div.className = 'msg ai';
    chat.appendChild(div);
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      acc += delta;
      div.textContent = acc;
      chat.scrollTop = chat.scrollHeight;
    }
  } catch (e) {
    addMsg('Error generando respuesta: ' + e.message, 'ai');
  } finally {
    setStatus(genStatus, '');
  }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSend();
  }
});

// PWA install
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
});
