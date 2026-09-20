/**
 * Almacenamiento persistente (Netlify Blobs).
 *   "mimada"       -> catalogo (del proveedor) y ajustes (del panel admin)
 *   "mimada-fotos" -> fotos subidas desde el panel admin
 * En local, dev-server.mjs registra un reemplazo en disco en globalThis.__MIMADA_STORE_FACTORY__.
 */
import { fetchCatalog } from "./dulcinea.mjs";

export const KEYS = { catalogo: "catalogo", ajustes: "ajustes" };
export const PHOTO_STORE = "mimada-fotos";

export async function getMimadaStore(name = "mimada") {
  if (globalThis.__MIMADA_STORE_FACTORY__) return globalThis.__MIMADA_STORE_FACTORY__(name);
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name, consistency: "strong" });
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
    // Precio propio: primero el general y luego el de cada tono (más específico)
    const precioGeneral = typeof a.precio === "number" && a.precio > 0 ? a.precio : null;
    const precioPorTono = a.preciosTono || {};
    if (precioGeneral) {
      p.precio = precioGeneral;
      delete p.precioDesde;
      if (p.variantes) p.variantes = p.variantes.map((v) => ({ ...v, precio: precioGeneral }));
    }
    if (p.variantes && Object.keys(precioPorTono).length) {
      p.variantes = p.variantes.map((v) => (precioPorTono[v.nombre] > 0 ? { ...v, precio: precioPorTono[v.nombre] } : v));
    }
    if (p.variantes?.length && (precioGeneral || Object.keys(precioPorTono).length)) {
      // El precio que se muestra es el más bajo disponible ("Desde" si los tonos valen distinto)
      const disponibles = p.variantes.filter((v) => v.disponible);
      const precios = (disponibles.length ? disponibles : p.variantes).map((v) => v.precio).filter((x) => x != null);
      if (precios.length) {
        p.precio = Math.min(...precios);
        if (Math.max(...precios) !== p.precio) p.precioDesde = true;
        else delete p.precioDesde;
      }
    }
    if (a.agotado) {
      p.agotado = true;
      if (p.variantes) p.variantes = p.variantes.map((v) => ({ ...v, disponible: false }));
    }

    // Fotos: principal elegida, fotos subidas y foto por tono
    const porTono = a.fotosTono || {};
    if (p.variantes && Object.keys(porTono).length) {
      p.variantes = p.variantes.map((v) => (porTono[v.nombre] ? { ...v, imagen: porTono[v.nombre] } : v));
    }
    if (a.imagen || a.fotosExtra?.length || Object.keys(porTono).length) {
      const base = original.fotos || (original.imagen ? [original.imagen] : []);
      const todas = [...new Set([a.imagen, ...(a.fotosExtra || []), ...base, ...Object.values(porTono)].filter(Boolean))];
      p.imagen = a.imagen || original.imagen || todas[0] || "";
      if (todas.length > 1) p.fotos = [p.imagen, ...todas.filter((f) => f !== p.imagen)];
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
