#!/usr/bin/env python3
import os, json
from pathlib import Path
from typing import List
from sentence_transformers import SentenceTransformer
from pdfminer.high_level import extract_text

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "knowledge" / "pdfs"
OUT_DIR = ROOT / "knowledge" / "index"
MANIFEST = ROOT / "knowledge" / "index-manifest.json"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
SHARD_SIZE = 2000

def chunk_text(text: str, max_len=CHUNK_SIZE, overlap=CHUNK_OVERLAP) -> List[str]:
    text = text.replace('\r',' ').replace('\t',' ')
    chunks=[]; i=0; n=len(text)
    while i<n:
        end=min(i+max_len,n); slice_=text[i:end]
        last_dot=slice_.rfind('. ')
        if last_dot>200 and end<n:
            final=slice_[:last_dot+1]; i += last_dot + 1 - overlap
        else:
            final=slice_; i += max_len - overlap
        final=final.strip()
        if final: chunks.append(final)
    return chunks

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items=[]
    pdfs=sorted(PDF_DIR.glob('*.pdf'))
    for pdf in pdfs:
        print('[PDF]', pdf.name)
        try:
            txt=extract_text(str(pdf)) or ""
        except Exception as e:
            print('[WARN] error extrayendo', pdf.name, e)
            txt=""
        if not txt.strip(): 
            print('[WARN] vacío:', pdf.name); 
            continue
        for c in chunk_text(txt):
            items.append({"text": c, "source": pdf.name})
    if not items:
        dim=384
        with open(OUT_DIR / 'index-000.json', 'w', encoding='utf-8') as f:
            json.dump([{"text":"Sin datos. Agrega PDFs.","source":"empty","embedding":[0.0]*dim}], f, ensure_ascii=False)
        with open(MANIFEST, 'w', encoding='utf-8') as f:
            json.dump({"dim": dim, "shards": ["./knowledge/index/index-000.json"]}, f, ensure_ascii=False, indent=2)
        print('Índice vacío.')
        return
    model=SentenceTransformer(MODEL_NAME)
    print('[EMB] calculando embeddings…')
    texts=[it['text'] for it in items]
    embs=model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    dim=len(embs[0])
    shards=[]
    for i in range(0, len(items), SHARD_SIZE):
        shard=[]
        for j, it in enumerate(items[i:i+SHARD_SIZE]):
            shard.append({"text": it["text"], "source": it["source"], "embedding": embs[i+j].tolist()})
        name=f"index-{i//SHARD_SIZE:03d}.json"
        with open(OUT_DIR / name, 'w', encoding='utf-8') as f:
            json.dump(shard, f, ensure_ascii=False)
        shards.append(f"./knowledge/index/{name}")
        print('[SHARD]', name, len(shard))
    with open(MANIFEST,'w',encoding='utf-8') as f:
        json.dump({"dim": dim, "shards": shards}, f, ensure_ascii=False, indent=2)
    print('Listo. Chunks:', len(items), 'Shards:', len(shards), 'Dim:', dim)

if __name__ == "__main__":
    main()
