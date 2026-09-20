/**
 * /api/admin — panel de administración (requiere la contraseña de la variable ADMIN_PASSWORD).
 *   GET                      -> catálogo original + ajustes guardados
 *   PUT  { ajustes }         -> guarda ajustes (ocultar, agotado, precio propio, destacado, etiqueta, fotos)
 *   POST ?accion=sincronizar -> descarga ya mismo el catálogo del proveedor
 *   POST ?accion=foto { data: "data:image/jpeg;base64,..." } -> guarda una foto y devuelve su URL
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { KEYS, PHOTO_STORE, getMimadaStore, readJSON, writeJSON, syncCatalog } from "../lib/store.mjs";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
const digest = (s) => createHash("sha256").update(String(s)).digest();
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function checkPassword(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return "sin-configurar";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return given && timingSafeEqual(digest(given), digest(expected)) ? "ok" : "no";
}

// Solo se aceptan fotos del proveedor/marcas (https) o subidas al panel (/api/foto/...)
const validPhoto = (u) => typeof u === "string" && u.length < 1000 && (/^https:\/\/[^\s"'<>]+$/.test(u) || /^\/api\/foto\/f-[a-z0-9-]+$/.test(u));

function sanitize(input) {
  const productos = {};
  for (const [id, raw] of Object.entries(input?.productos || {})) {
    if (!/^[a-z0-9-]{1,200}$/i.test(id) || typeof raw !== "object" || !raw) continue;
    const a = {};
    if (raw.oculto === true) a.oculto = true;
    if (raw.agotado === true) a.agotado = true;
    if (raw.destacado === true) a.destacado = true;
    const precio = Math.round(Number(raw.precio));
    if (Number.isFinite(precio) && precio > 0 && precio < 100000000) a.precio = precio;
    const etiqueta = String(raw.etiqueta || "").trim().slice(0, 30);
    if (etiqueta) a.etiqueta = etiqueta;
    if (validPhoto(raw.imagen)) a.imagen = raw.imagen;
    const extra = (Array.isArray(raw.fotosExtra) ? raw.fotosExtra : []).filter(validPhoto).slice(0, 12);
    if (extra.length) a.fotosExtra = [...new Set(extra)];
    const porTono = {};
    for (const [tono, url] of Object.entries(raw.fotosTono || {}).slice(0, 150)) {
      if (tono.length <= 100 && validPhoto(url)) porTono[tono] = url;
    }
    if (Object.keys(porTono).length) a.fotosTono = porTono;
    // Precio propio de cada tono o presentación (ej. Mini y Grande valen distinto)
    const preciosTono = {};
    for (const [tono, valor] of Object.entries(raw.preciosTono || {}).slice(0, 150)) {
      const n = Math.round(Number(valor));
      if (tono.length <= 100 && Number.isFinite(n) && n > 0 && n < 100000000) preciosTono[tono] = n;
    }
    if (Object.keys(preciosTono).length) a.preciosTono = preciosTono;
    if (Object.keys(a).length) productos[id] = a;
  }
  return { productos, actualizado: new Date().toISOString() };
}

async function savePhoto(req) {
  const body = await req.json().catch(() => null);
  const match = String(body?.data || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return json({ error: "Formato de foto no válido (usa JPG, PNG o WEBP)." }, 400);
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return json({ error: "La foto pesa demasiado (máximo 3 MB)." }, 413);
  const key = `f-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;
  const store = await getMimadaStore(PHOTO_STORE);
  await store.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    metadata: { contentType: match[1], subida: new Date().toISOString() },
  });
  return json({ ok: true, url: `/api/foto/${key}` });
}

export default async (req) => {
  const auth = checkPassword(req);
  if (auth === "sin-configurar") return json({ error: "Falta configurar la variable ADMIN_PASSWORD en Netlify." }, 503);
  if (auth !== "ok") {
    await new Promise((r) => setTimeout(r, 800)); // frena intentos de adivinar la contraseña
    return json({ error: "Contraseña incorrecta." }, 401);
  }

  try {
    const accion = new URL(req.url).searchParams.get("accion");

    if (req.method === "GET") {
      let catalog = await readJSON(KEYS.catalogo);
      if (!catalog?.productos?.length) catalog = (await syncCatalog({ force: true })).catalog;
      const ajustes = await readJSON(KEYS.ajustes, { productos: {} });
      return json({ actualizado: catalog.actualizado, productos: catalog.productos, ajustes });
    }

    if (req.method === "PUT") {
      const body = await req.json().catch(() => null);
      if (!body?.ajustes) return json({ error: "Datos inválidos." }, 400);
      const ajustes = sanitize(body.ajustes);
      await writeJSON(KEYS.ajustes, ajustes);
      return json({ ok: true, ajustes });
    }

    if (req.method === "POST" && accion === "sincronizar") {
      const result = await syncCatalog({ force: true });
      return json({ ok: result.ok, total: result.total, actualizado: result.catalogo?.actualizado, motivo: result.motivo });
    }

    if (req.method === "POST" && accion === "foto") return await savePhoto(req);

    return json({ error: "Acción no permitida." }, 405);
  } catch (err) {
    console.error("admin:", err);
    return json({ error: "Error del servidor: " + err.message }, 500);
  }
};

export const config = { path: "/api/admin" };
