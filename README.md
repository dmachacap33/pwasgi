# PWA RAG Chat (100% en el navegador)

Chat con tus documentos (Word, Excel, CSV, TXT) sin backend, gratis y listo para GitHub Pages. 
- **RAG**: indexa tus archivos en el navegador (embeddings con Transformers.js).
- **Chat IA**: genera respuestas en el navegador (WebLLM + WebGPU/WASM).
- **PWA**: instalable, offline-first.

> ⚠️ **Modelos**: la primera carga descargará el modelo de chat al navegador (cientos de MB). Necesitas un navegador moderno (Chrome/Edge/Arc/Brave) con WebGPU para mejor velocidad.

## Estructura
```
/assets
/src
  app.js         # UI + chat + RAG
  rag.js         # embeddings, vector-store (IndexedDB), búsqueda
  ui.css         # estilos
index.html
manifest.webmanifest
service-worker.js
```

## Cómo probar en local
1. Descarga este repositorio (o el ZIP) y descomprímelo.
2. Usa un servidor estático local (ejemplo con Python):
   ```bash
   cd pwa-rag-chat
   python -m http.server 8080
   ```
3. Abre en el navegador: http://localhost:8080  
   *Si ves problemas con el service worker en local, recarga con `Ctrl+Shift+R`.*

## Subir a GitHub Pages (Gratis)
1. Crea un **repositorio** nuevo en GitHub (por ejemplo `pwa-rag-chat`).
2. Sube todos los archivos y carpetas de este proyecto a la rama `main`.
3. En **Settings → Pages**, elige **Source: Deploy from a branch** y selecciona `main` y `/ (root)`.
4. Espera a que aparezca la URL de GitHub Pages (por ejemplo `https://usuario.github.io/pwa-rag-chat/`).
5. Abre esa URL. La PWA se instalará y funcionará como app.

> Si la ruta base no es `/`, GitHub Pages servirá la app bajo `/pwa-rag-chat/`. El SW en este ejemplo usa `/service-worker.js`. Si la raíz no coincide, puedes cambiar la línea de registro del SW en `index.html` a:
> ```js
> navigator.serviceWorker.register('./service-worker.js')
> ```

## Cargar tu documentación (“entrenar”)
1. En la sección **1) Carga…**, selecciona tus `.docx`, `.xlsx`, `.csv` o `.txt`.
2. Presiona **Indexar**. El texto se trocea y se calculan embeddings localmente.
3. La base de embeddings se guarda en **IndexedDB** dentro de tu navegador.
4. Opcional: **Borrar Base** reinicia la base y permite reindexar.

## Chatear con tus documentos
1. En **2) Chat…**, escribe una pregunta.
2. La app recupera los fragmentos más relevantes y construye el prompt para el LLM.
3. El modelo (TinyLlama por defecto) genera la respuesta **en tu navegador**.
4. Puedes cambiar el modelo o la temperatura desde el panel superior.

## Modelos y rendimiento
- **Chat (WebLLM)**: por defecto `TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC` (ligero). También puedes probar `Phi-2-q4f32_1-MLC` si tu equipo es potente.
- **Embeddings**: `Xenova/all-MiniLM-L6-v2` (rápido y de buena calidad).

> Si tu dispositivo **no** tiene WebGPU, WebLLM cae a WASM (más lento). Puedes abrir DevTools (F12) y ver la consola durante la descarga/carga del modelo para diagnosticar.

## Notas
- Todo se ejecuta en el cliente. No hay coste ni necesidad de claves API.
- Los archivos **no** se suben a ningún servidor.
- Puedes ampliar parsers (por ejemplo PDF) añadiendo `pdfjs-dist` y un parser propio en `app.js`.
- La base en IndexedDB es local al navegador/perfil/host. Si cambias de equipo o URL, tendrás que re-indexar.

## Licencia
MIT
