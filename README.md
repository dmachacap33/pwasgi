# PWA RAG Chat (índice precalculado en GitHub Pages)
Sube PDFs a `knowledge/pdfs/` y deja que el Action construya el índice. La app carga los JSON y responde con WebLLM en tu navegador.

## Pasos
1) Sube este proyecto a GitHub (rama `main`).
2) Activa **Settings → Pages** con `main` y carpeta `/`.
3) Sube tus PDFs a `knowledge/pdfs/` y haz commit/push.
4) Espera a que el Action **build-index** termine.
5) Abre tu URL de Pages → chatea.

## Notas
- Nada se sube desde tu PC al abrir la app; los datos ya están publicados como JSON.
- El modelo se descarga al navegador (gratis). Si tienes WebGPU, mejor rendimiento.
- Si el repo es público, tus JSON del índice serán públicos.
