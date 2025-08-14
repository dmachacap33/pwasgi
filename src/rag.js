// RAG utilities: chunking, embeddings, vector search, storage
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@3.2.1/dist/transformers.min.js";
import { get, set, del, clear, keys } from "https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/idb-keyval.mjs";

const DB_EMBED_KEY = 'embeddings-v1';
let embedder = null;

export async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

export function chunkText(text, maxLen = 800, overlap = 120) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxLen, text.length);
    const slice = text.slice(i, end);
    // try to cut at sentence end
    let final = slice;
    const lastDot = slice.lastIndexOf('. ');
    if (lastDot > 200 && end < text.length) {
      final = slice.slice(0, lastDot + 1);
      i += lastDot + 1 - overlap;
    } else {
      i += maxLen - overlap;
    }
    chunks.push(final.trim());
  }
  return chunks.filter(Boolean);
}

export async function embed(texts) {
  const model = await getEmbedder();
  const out = [];
  for (const t of texts) {
    const res = await model(t, { pooling: 'mean', normalize: true });
    out.push(Array.from(res.data));
  }
  return out;
}

export function cosSim(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function addDocuments(docs) {
  // docs: array of {id, source, content}
  // Build chunks, embed, and persist
  const all = (await get(DB_EMBED_KEY)) || [];
  for (const d of docs) {
    const chunks = chunkText(d.content);
    const embs = await embed(chunks);
    const items = chunks.map((c, i) => ({
      id: `${d.id}#${i}`,
      source: d.source,
      text: c,
      embedding: embs[i],
    }));
    all.push(...items);
  }
  await set(DB_EMBED_KEY, all);
  return all.length;
}

export async function clearDatabase() {
  await del(DB_EMBED_KEY);
}

export async function search(query, topK = 5) {
  const all = (await get(DB_EMBED_KEY)) || [];
  if (!all.length) return [];
  const [qvec] = await embed([query]);
  const scored = all.map(it => ({ ...it, score: cosSim(qvec, it.embedding) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function countChunks() {
  const all = (await get(DB_EMBED_KEY)) || [];
  return all.length;
}
