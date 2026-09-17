/**
 * GET /api/catalogo
 * Catálogo público: productos del proveedor + ajustes del panel admin (ocultos fuera, precios propios, etc.).
 */
import { KEYS, readJSON, syncCatalog, applyAdjustments } from "../lib/store.mjs";

export default async () => {
  try {
    let catalog = await readJSON(KEYS.catalogo);
    if (!catalog?.productos?.length) {
      // Primera vez (aún no corre la sincronización programada): descargar ahora
      catalog = (await syncCatalog({ force: true })).catalog;
    }
    const ajustes = await readJSON(KEYS.ajustes, {});
    return Response.json(applyAdjustments(catalog, ajustes), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        // La CDN de Netlify guarda la respuesta 1 minuto: los cambios del admin se ven casi al instante
        "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("catalogo:", err);
    return Response.json({ error: "catalogo_no_disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};

export const config = { path: "/api/catalogo" };
