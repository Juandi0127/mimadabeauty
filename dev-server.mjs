// Servidor local: npm run dev  ->  http://localhost:5500   (admin: http://localhost:5500/admin/)
// Sirve los archivos estáticos y ejecuta las funciones de /api como lo haría Netlify.
// Los datos se guardan en .netlify-local/ en vez de Netlify Blobs.
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5500;
const localDir = path.join(root, ".netlify-local");

globalThis.__MIMADA_STORE__ = {
  async get(key) {
    try { return JSON.parse(await readFile(path.join(localDir, `${key}.json`), "utf8")); } catch { return null; }
  },
  async setJSON(key, value) {
    await mkdir(localDir, { recursive: true });
    await writeFile(path.join(localDir, `${key}.json`), JSON.stringify(value));
  },
};
process.env.ADMIN_PASSWORD ||= "mimada-local";

const functions = {
  "/api/catalogo": "netlify/functions/catalogo.mjs",
  "/api/admin": "netlify/functions/admin.mjs",
};
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

async function runFunction(file, req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const handler = (await import(pathToFileURL(path.join(root, file)).href)).default;
  const response = await handler(request, {});
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (functions[urlPath]) return await runFunction(functions[urlPath], req, res);

    let file = path.normalize(path.join(root, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath));
    if (!file.startsWith(root) || /[\\/](node_modules|netlify|\.netlify-local|\.git)[\\/]/.test(file)) {
      res.writeHead(403); return res.end();
    }
    const data = await readFile(file).catch(() => null);
    if (!data) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end("Error: " + err.message);
  }
}).listen(port, () => console.log(`MIMADA en http://localhost:${port}  ·  admin: http://localhost:${port}/admin/ (clave local: ${process.env.ADMIN_PASSWORD})`));
