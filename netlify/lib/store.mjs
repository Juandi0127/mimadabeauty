/**
 * Almacenamiento persistente (Netlify Blobs).
 * En local, dev-server.mjs registra un reemplazo en disco en globalThis.__MIMADA_STORE__.
 */
import { fetchCatalog } from "./dulcinea.mjs";

export const KEYS = { catalogo: "catalogo", ajustes: "ajustes" };

export async function getMimadaStore() {
  if (globalThis.__MIMADA_STORE__) return globalThis.__MIMADA_STORE__;
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "mimada", consistency: "strong" });
}

export async function readJSON(key, fallback = null) {
  const store = await getMimadaStore();
  const value = await store.get(key, { type: "json" });
  return value ?? fallback;
}

export async function writeJSON(key, value) {
  const store = await getMimadaStore();
  await store.setJSON(key, value);
}

/**
 * Descarga el catálogo del proveedor y lo guarda.
 * Si la descarga trae muchos menos productos que la última vez (caída o cambio del proveedor),
 * conserva el catálogo anterior para no dejar la tienda vacía.
 */
export async function syncCatalog({ force = false } = {}) {
  const previous = await readJSON(KEYS.catalogo);
  const fresh = await fetchCatalog();
  const prevCount = previous?.productos?.length || 0;
  const newCount = fresh.productos.length;
  if (!force && prevCount && newCount < prevCount * 0.5) {
    return { ok: false, motivo: `Se recibieron ${newCount} productos (antes ${prevCount}); se conserva el catálogo anterior.`, catalogo: previous };
  }
  await writeJSON(KEYS.catalogo, fresh);
  return { ok: true, total: newCount, catalogo: fresh };
}

/** Aplica los ajustes del panel admin al catálogo. `incluirOcultos` solo para el admin. */
export function applyAdjustments(catalog, ajustes, { incluirOcultos = false } = {}) {
  const cambios = ajustes?.productos || {};
  const productos = [];
  for (const original of catalog?.productos || []) {
    const a = cambios[original.id];
    if (!a) { productos.push(original); continue; }
    if (a.oculto && !incluirOcultos) continue;
    const p = { ...original };
    if (typeof a.precio === "number" && a.precio > 0) {
      p.precio = a.precio;
      delete p.precioDesde;
      if (p.variantes) p.variantes = p.variantes.map((v) => ({ ...v, precio: a.precio }));
    }
    if (a.agotado) {
      p.agotado = true;
      if (p.variantes) p.variantes = p.variantes.map((v) => ({ ...v, disponible: false }));
    }
    if (a.etiqueta) p.etiqueta = a.etiqueta;
    if (a.destacado) p.destacado = true;
    if (a.oculto) p.oculto = true;
    productos.push(p);
  }
  // Destacados primero, conservando el orden del resto
  const destacados = productos.filter((p) => p.destacado && !p.agotado);
  const resto = productos.filter((p) => !(p.destacado && !p.agotado));
  return { ...catalog, productos: [...destacados, ...resto] };
}
