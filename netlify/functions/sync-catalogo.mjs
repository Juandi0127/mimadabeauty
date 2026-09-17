/**
 * Función programada: cada hora descarga precios, stock y productos nuevos del proveedor.
 * (Las funciones programadas solo corren en el sitio publicado, no en previsualizaciones.)
 */
import { syncCatalog } from "../lib/store.mjs";

export default async () => {
  try {
    const result = await syncCatalog();
    console.log(result.ok ? `Catálogo sincronizado: ${result.total} productos` : `Sincronización omitida: ${result.motivo}`);
  } catch (err) {
    console.error("Error sincronizando catálogo:", err);
  }
};

export const config = { schedule: "@hourly" };
