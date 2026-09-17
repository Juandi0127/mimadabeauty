/**
 * Sincronización con el catálogo del proveedor (tienda Shopify).
 * Descarga productos + colecciones públicas y los convierte al formato de la web de MIMADA.
 * Se usa desde las funciones de Netlify y desde el servidor local (dev-server.mjs).
 */

const BASE = "https://somosdulcineacol.com";
const UA = "MimadaBeautyCatalogSync/1.0";
const PAGE_LIMIT = 250;
const NEW_DAYS = 21;

// Colecciones del proveedor -> categoría en MIMADA (en orden de prioridad)
const CATEGORY_COLLECTIONS = [
  ["electricos", "Eléctricos"],
  ["capilar", "Cabello"],
  ["corporal", "Cuerpo"],
  ["cuidado", "Cuidado de la piel"],
  ["maquillaje", "Maquillaje"], // se subdivide por palabras clave
  ["complementos", "Brochas y accesorios"],
];

/* ------------------------------------------------------------------ red */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      await sleep(1200 * (i + 1));
    }
  }
  throw new Error(`No se pudo leer ${path}: ${lastErr?.message}`);
}

async function getAllPages(path, key) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await getJSON(`${path}${sep}limit=${PAGE_LIMIT}&page=${page}`);
    const items = data[key] || [];
    out.push(...items);
    if (items.length < PAGE_LIMIT) break;
  }
  return out;
}

/* ------------------------------------------------------------- formato */

const stripAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const key = (s) => stripAccents(s).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const WORD_FIX = {
  LAPIZ: "Lápiz", BETUN: "Betún", LIQUIDO: "Líquido", LIQ: "Líquido", TONICO: "Tónico", JABON: "Jabón",
  BALSAMO: "Bálsamo", PLUMON: "Plumón", TRASLUCIDO: "Traslúcido", ACIDO: "Ácido", HIALURONICO: "Hialurónico",
  LOCION: "Loción", PESTANA: "Pestaña", PESTANAS: "Pestañas", PESTANINA: "Pestañina", ALGODON: "Algodón",
  AJI: "Ají", CORAZON: "Corazón", TERMICO: "Térmico", RETRACTIL: "Retráctil", CALENDULA: "Caléndula",
  SALICILICO: "Salicílico", COLAGENO: "Colágeno", ANTIACNE: "Antiacné", CAFEINA: "Cafeína", MAGICO: "Mágico",
  ELECTRICO: "Eléctrico", TTO: "Tratamiento", NINO: "Niño", NINA: "Niña", ACEITE: "Aceite", MASCARA: "Máscara",
  CEPILLO: "Cepillo", PEQUENO: "Pequeño", PEQUENA: "Pequeña", MUNECA: "Muñeca", ACRILICO: "Acrílico",
};
const KEEP_UPPER = new Set(["OG", "AME", "MYK", "BB", "CC", "SPF", "UV", "LZ", "WE", "XL", "PH", "LED", "USB", "SP"]);
const SMALL = new Set(["de", "del", "y", "en", "con", "sin", "a", "para", "la", "el", "e", "o", "por", "x"]);

function prettyWord(word, first) {
  const plain = stripAccents(word).toUpperCase();
  if (WORD_FIX[plain] && word.toUpperCase() === word) return WORD_FIX[plain];
  if (KEEP_UPPER.has(plain)) return plain;
  if (/^[A-Z]{1,3}\d+[A-Z]?$/.test(plain)) return word.toUpperCase(); // códigos: B70, JL5, DB01
  const unit = plain.match(/^(\d+(?:[.,]\d+)?)(ML|G|GR|HRS|H|OZ|CM)$/);
  if (unit) return `${unit[1]} ${{ ML: "ml", G: "g", GR: "g", HRS: "h", H: "h", OZ: "oz", CM: "cm" }[unit[2]]}`;
  if (/^X\d+$/.test(plain)) return plain.toLowerCase();
  if (plain === "1ST") return "1st";
  const low = word.toLowerCase();
  if (!first && SMALL.has(low)) return low;
  return low.charAt(0).toUpperCase() + low.slice(1);
}

function pretty(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  return words.map((w, i) => prettyWord(w, i === 0)).join(" ").replace(/\s+/g, " ").trim();
}

const BRAND_NAMES = {
  "OG": "OG", "AME": "AME", "MYK": "MYK", "WE": "WE", "LZ": "LZ", "ANIK": "Ani-K", "ANI K": "Ani-K",
  "L A GIRL": "L.A. Girl", "LA GIRL": "L.A. Girl", "L A COLORS": "L.A. Colors", "LA COLORS": "L.A. Colors",
  "LOREAL": "L'Oréal", "L OREAL": "L'Oréal", "RUBY ROSE": "Ruby Rose", "RUBYROSE": "Ruby Rose",
  "ANA MARIA": "Ana María", "HI ZIS": "Hi Zis", "ELF": "e.l.f.", "OLE": "Olé", "MAHU": "Mahu",
  "ILOVE PINCH": "I Love Pinch", "MIISS": "Miiss Cosmetics", "MIISS COSMETICS": "Miiss Cosmetics",
  "SP PRO": "SP Pro", "KEYDI DE LA ROSA": "Keydi de la Rosa", "KEIDY DE LA ROSA": "Keydi de la Rosa",
  "RITUAL BOTANICO": "Ritual Botánico", "BRUJERIA CAPILAR": "Brujería Capilar", "MAX FACTOR": "Max Factor",
  "DOLCE BELLA": "Dolce Bella", "TRUE LOVER": "True Lover", "KISS BEAUTY": "Kiss Beauty",
  "GOVA BEAUTY": "Gova Beauty", "GOVA": "Gova Beauty", "BEAUTY GLAZED": "Beauty Glazed",
  "ALMA BEAUTY": "Alma Beauty", "SFR COLOR": "SFR Color", "KLEANCOLOR": "KleanColor", "PIGO": "PIGO",
  "NABA": "NABA", "VIDAN DREAMS": "Vidan", "ECHANTE": "Enchante", "BLOOMSHEL": "Bloomshell",
  "MARU DERM": "Maruderm", "MARUDERM": "Maruderm", "MARYLIN": "Marilyn", "MARLYN": "Marilyn",
  "MISS COSMETICS": "Miiss Cosmetics", "MIIS COSMETICS": "Miiss Cosmetics", "KARITE": "Karité",
  "DELCORA": "Del Cora", "DEL CORA": "Del Cora", "BONARA BEAUTY": "Bonara", "BONARA": "Bonara",
};

function prettyBrand(raw) {
  const k = key(raw);
  if (!k) return "";
  return BRAND_NAMES[k] || pretty(raw);
}

/** "BASE FIT ME - MAYBELLINE" -> { name: "BASE FIT ME", brand: "MAYBELLINE" } */
function splitTitle(title) {
  const t = String(title || "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.*\S)\s*[–-]\s+(.+)$/) || t.match(/^(.*\S)\s+[–-]\s*(.+)$/);
  if (m && m[2].split(" ").length <= 4) return { name: m[1], brand: m[2] };
  return { name: t, brand: "" };
}

function cleanDescription(html) {
  const text = String(html || "")
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /dulcinea/i.test(text)) return "";
  if (text.length <= 200) return text;
  return text.slice(0, 200).replace(/\s+\S*$/, "") + "…";
}

function imageUrl(src, width = 600) {
  if (!src) return "";
  try {
    const u = new URL(src);
    u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return src;
  }
}

/* ---------------------------------------------------------- categorías */

function makeupCategory(title) {
  const t = key(title);
  if (/^(RUBOR|BLUSH|BRONZER|CONTORNO|ILUMINADOR|STICK (RUBOR|CONTORNO|ILUMINADOR)|PALETA (RUBOR|CONTORNO)|SHIMMER|BODY GLOW|MULTI STICK)/.test(t)) return "Mejillas y contorno";
  if (/^(LABIAL|GLOSS|LIP|LAPIZ LABIO|TINTA (LABIO|EN CREMA|GEL|SERUM|GLOW|JUICY)|BALSAMO|BRILLO|EXFOLIANTE LABIO|VOLUMINIZADOR BLOOM|BUTTER BALM|CLICK GLOSS|CLIC LABIAL|JELLY|KIT LABIAL|KIT GLOSS)/.test(t) || /\bLABIO/.test(t)) return "Labios";
  if (/^(SOMBRA|PIGMENTO|GLITTER|DELINEADOR|LAPIZ (OJO|CEJA|NEGRO|BLANCO|RETRACTIL|CRAYON)|PLUMON|PESTANINA|BETUN|GEL (DE )?CEJA|TRIO CEJA|KIT CEJA|SERUM CEJA|ESTILIZADOR|PEGANTE|PESTANA|KHOL|KOHL|PRIMER OJO|ESCUDO|BROW|ACEITE PESTANA|MASCARA)/.test(t) || /\b(CEJA|CEJAS|PESTANA|PESTANAS)\b/.test(t)) return "Ojos y cejas";
  return "Rostro";
}

/* ---------------------------------------------------------- transformar */

export function transform(products, collectionIndex, brandCollections, now = Date.now()) {
  const brandKeys = brandCollections
    .map((c) => ({ k: key(c.title), name: prettyBrand(c.title) }))
    .filter((b) => b.k.length >= 2)
    .sort((a, b) => b.k.length - a.k.length);

  const out = [];
  for (const p of products) {
    const { name, brand } = splitTitle(p.title);
    let marca = prettyBrand(brand);
    if (!marca) {
      const tk = ` ${key(p.title)} `;
      const hit = brandKeys.find((b) => tk.includes(` ${b.k} `));
      if (hit) marca = hit.name;
    }

    let categoria = "";
    for (const [handle, label] of CATEGORY_COLLECTIONS) {
      if (collectionIndex[handle]?.has(p.id)) {
        categoria = label === "Maquillaje" ? makeupCategory(name) : label;
        break;
      }
    }
    if (!categoria) categoria = makeupCategory(name);

    const variants = (p.variants || []).map((v) => {
      const price = Number(v.price);
      return {
        nombre: v.title === "Default Title" ? "" : pretty(v.title),
        precio: price > 0 ? Math.round(price) : null,
        disponible: Boolean(v.available),
        imagen: v.featured_image?.src ? imageUrl(v.featured_image.src) : undefined,
      };
    });
    const available = variants.filter((v) => v.disponible);
    const pricePool = (available.length ? available : variants).map((v) => v.precio).filter((x) => x != null);
    const precio = pricePool.length ? Math.min(...pricePool) : null;
    const precioMax = pricePool.length ? Math.max(...pricePool) : null;

    const item = {
      id: p.handle,
      nombre: pretty(name),
      marca,
      categoria,
      precio,
      imagen: imageUrl(p.images?.[0]?.src),
    };
    if (precioMax != null && precioMax !== precio) item.precioDesde = true;
    const desc = cleanDescription(p.body_html);
    if (desc) item.descripcion = desc;

    const realVariants = variants.filter((v) => v.nombre);
    if (realVariants.length) {
      const optName = p.options?.[0]?.name || "Tono";
      // El proveedor llama "TONOS" a todo; si las opciones son tamaños, mostrar "Presentación"
      const sizeLike = realVariants.every((v) => /^(mini|mediano|mediana|grande|jumbo|pequeñ[oa]|peq|gra|litro|\d+(?:[.,]\d+)?\s?(ml|g|gr|oz|l)|x\s?\d+)\b/i.test(stripAccents(v.nombre).replace("n", "n")));
      item.opcion = sizeLike ? "Presentación" : /^tonos?$/i.test(optName) ? "Tono" : pretty(optName);
      item.variantes = realVariants.map((v) => {
        const o = { nombre: v.nombre, precio: v.precio, disponible: v.disponible };
        if (v.imagen) o.imagen = v.imagen;
        return o;
      });
    }
    if (!available.length) item.agotado = true;
    const created = Date.parse(p.created_at);
    if (!Number.isNaN(created) && now - created < NEW_DAYS * 86400000) item.etiqueta = "Nuevo";
    item._creado = Number.isNaN(created) ? 0 : created;
    out.push(item);
  }

  // Disponibles primero, luego lo más reciente
  out.sort((a, b) => (a.agotado ? 1 : 0) - (b.agotado ? 1 : 0) || b._creado - a._creado);
  out.forEach((p) => delete p._creado);
  return out;
}

/** Descarga todo del proveedor y devuelve el catálogo listo para la web. */
export async function fetchCatalog() {
  const products = await getAllPages("/products.json", "products");
  const collections = (await getJSON("/collections.json?limit=250")).collections || [];

  const collectionIndex = {};
  for (const [handle] of CATEGORY_COLLECTIONS) {
    const col = collections.find((c) => c.handle === handle);
    if (!col || !col.products_count) continue;
    const items = await getAllPages(`/collections/${handle}/products.json`, "products");
    collectionIndex[handle] = new Set(items.map((i) => i.id));
  }

  const categoryHandles = new Set([...CATEGORY_COLLECTIONS.map(([h]) => h), "frontpage", "favoritos", "favoritos-dulcinea", "must-have", "recien-llegados"]);
  const brandCollections = collections.filter((c) => !categoryHandles.has(c.handle));

  return {
    actualizado: new Date().toISOString(),
    productos: transform(products, collectionIndex, brandCollections),
  };
}
