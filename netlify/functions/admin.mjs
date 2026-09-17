/**
 * /api/admin — panel de administración (requiere la contraseña de la variable ADMIN_PASSWORD).
 *   GET                      -> catálogo original + ajustes guardados
 *   PUT  { ajustes }         -> guarda ajustes (ocultar, agotado, precio propio, destacado, etiqueta)
 *   POST ?accion=sincronizar -> descarga ya mismo el catálogo del proveedor
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { KEYS, readJSON, writeJSON, syncCatalog } from "../lib/store.mjs";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
const digest = (s) => createHash("sha256").update(String(s)).digest();

function checkPassword(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return "sin-configurar";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return given && timingSafeEqual(digest(given), digest(expected)) ? "ok" : "no";
}

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
    if (Object.keys(a).length) productos[id] = a;
  }
  return { productos, actualizado: new Date().toISOString() };
}

export default async (req) => {
  const auth = checkPassword(req);
  if (auth === "sin-configurar") return json({ error: "Falta configurar la variable ADMIN_PASSWORD en Netlify." }, 503);
  if (auth !== "ok") {
    await new Promise((r) => setTimeout(r, 800)); // frena intentos de adivinar la contraseña
    return json({ error: "Contraseña incorrecta." }, 401);
  }

  try {
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

    if (req.method === "POST" && new URL(req.url).searchParams.get("accion") === "sincronizar") {
      const result = await syncCatalog({ force: true });
      return json({ ok: result.ok, total: result.total, actualizado: result.catalogo?.actualizado, motivo: result.motivo });
    }

    return json({ error: "Acción no permitida." }, 405);
  } catch (err) {
    console.error("admin:", err);
    return json({ error: "Error del servidor: " + err.message }, 500);
  }
};

export const config = { path: "/api/admin" };
