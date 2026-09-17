/**
 * Descarga el catálogo del proveedor y lo guarda como copia de respaldo en data/catalogo-respaldo.json.
 * La web usa este archivo solo si la función /api/catalogo no responde.
 *
 * Uso:  npm run respaldo
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchCatalog } from "../netlify/lib/dulcinea.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "data", "catalogo-respaldo.json");

const t0 = Date.now();
const catalog = await fetchCatalog();
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(catalog));

const productos = catalog.productos;
const count = (fn) => productos.filter(fn).length;
const byCat = {};
for (const p of productos) byCat[p.categoria] = (byCat[p.categoria] || 0) + 1;

console.log(`Productos: ${productos.length} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Por categoría:`, byCat);
console.log(`Agotados: ${count((p) => p.agotado)} · Con tonos: ${count((p) => p.variantes)} · Sin precio: ${count((p) => p.precio == null)} · Sin marca: ${count((p) => !p.marca)} · Sin foto: ${count((p) => !p.imagen)} · Nuevos: ${count((p) => p.etiqueta === "Nuevo")}`);
console.log(`Marcas (${new Set(productos.map((p) => p.marca)).size}):`, [...new Set(productos.map((p) => p.marca))].sort().join(" | "));
console.log(`Archivo: ${out} (${(JSON.stringify(catalog).length / 1024).toFixed(0)} KB)`);
