"""
Extrae el catálogo de MIMADA Beauty desde el PDF y genera:
  - assets/img/catalogo/*.jpg   (foto de cada producto)
  - js/catalogo.js              (datos para la web)

Uso:  python tools/extraer_catalogo.py "C:/ruta/CATÁLOGO MIMADA BEAUTY.pdf"
Requiere: pip install pymupdf
"""
import json
import os
import re
import sys
import unicodedata

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img", "catalogo")
OUT_JS = os.path.join(ROOT, "js", "catalogo.js")
CONTENT = pymupdf.Rect(40, 28, 1400, 792)  # área útil de cada página (sin marco)

# ---------------------------------------------------------------- texto
WORD_FIX = {
    "LAPIZ": "Lápiz", "LÁÍZ": "Lápiz", "BETUN": "Betún", "LIQUIDO": "Líquido", "LIQ": "Líquido",
    "LÍQ": "Líquido", "TONICO": "Tónico", "JABON": "Jabón", "BALSAMO": "Bálsamo", "PLUMON": "Plumón",
    "TRASLUCIDO": "Traslúcido", "TRASL": "Traslúcido", "ACIDO": "Ácido", "HIALURONICO": "Hialurónico",
    "HIAL": "Hialurónico", "LOCION": "Loción", "ACITE": "Aceite", "MASCARAILLA": "Mascarilla",
    "PEFUME": "Perfume", "INTESIVO": "Intensivo", "RUBRO": "Rubor", "REAPIR": "Repair",
    "COFFE": "Coffee", "BR0CHAS": "Brochas", "COLAGENO": "Colágeno", "ANTIACNE": "Antiacné",
    "CALENDULA": "Caléndula", "SALICILICO": "Salicílico", "CORAZON": "Corazón", "TTO": "Tratamiento",
    "COMP.": "Compacto", "DESMAQ.": "Desmaquillante", "HIDRAT.": "Hidratante", "AJI": "Ají",
    "MASMELO": "Masmelo", "DIAG": "Diagonal", "DIFUM": "Difuminador", "DIUM": "Difuminador",
    "ALGODON": "Algodón", "CUBREPEZON": "Cubrepezón", "NECESER": "Neceser", "MULTIPROPOSITO": "Multipropósito",
    "RETRACTIL": "Retráctil", "TERMICO": "Térmico", "MINERALIZADO": "Mineralizado", "ESCUALANO": "Escualano",
    "CAFEINA": "Cafeína", "AZELAICO": "Azelaico", "MATE": "Mate",
}
KEEP_UPPER = {"OG", "AME", "MYK", "BB", "SP", "LS", "UV", "SPF", "PH", "DB01", "DB02", "DB03", "DB04",
              "DB05", "DB06", "DB07", "B1", "B20", "B56", "B58", "B61", "B66", "B70", "B71", "B72", "B73",
              "B74", "JL5", "JL7", "JL11", "JL18", "JL23", "G7", "G9", "G10", "G11", "F5", "F6", "F7", "F8",
              "AK1", "AK2", "AK23", "C", "T", "H", "LZ", "XL"}
SMALL = {"de", "del", "y", "en", "con", "sin", "a", "para", "la", "el", "e", "o", "por"}

BRANDS = {
    "OG": "OG", "AME": "AME", "MYK": "MYK", "L.A GIRL": "L.A. Girl", "L.A": "L.A. Girl",
    "L.A COLORS": "L.A. Colors", "LA COLORS": "L.A. Colors", "L. A COLORS": "L.A. Colors",
    "L´ORÉAL": "L'Oréal", "ANIK": "Ani-K", "ANI-K": "Ani-K", "BLOOMSHELL": "Bloomshell",
    "BLOOSMHELL": "Bloomshell", "BLOOMSHEL": "Bloomshell", "ATENEA": "Atenea", "ATENNEA": "Atenea",
    "RUBYROSE": "Ruby Rose", "MAYBELLINE": "Maybelline", "ESSENCE": "Essence", "MILANI": "Milani",
    "VOGUE": "Vogue", "TRENDY": "Trendy", "SAMY": "Samy", "ENGOL": "Engol", "MONTOC": "Montoc",
    "MAJIKAL": "Majikal", "SAGUI": "Sagui", "LULA": "Lula", "PURPURE": "Purpure", "KALOE": "Kaloe",
    "ANA MARIA": "Ana María", "ANA M": "Ana María", "DOLCE BELLA": "Dolce Bella", "DOLCE B": "Dolce Bella",
    "MARILYN": "Marilyn", "MARYLIN": "Marilyn", "MARLYN": "Marilyn", "GOVA": "Gova Beauty",
    "GOVA BEAUTY": "Gova Beauty", "HI ZIS": "Hi Zis", "ELAYA": "Elaya", "ENCHANTE": "Enchante",
    "RAQUEL": "Raquel", "TONOS": "Tonos", "BIOAQUA": "Bioaqua", "MARUDERM": "Maruderm",
    "MARUDER": "Maruderm", "MAHU": "Mahu", "GIRLY": "Girly", "NUDE": "Nude", "REVUELE": "Revuele",
    "NABA": "Naba", "KAVILA": "Kavila", "TRUE LOVER": "True Lover", "BEAUTY GLAZED": "Beauty Glazed",
    "ALMA BEAUTY": "Alma Beauty", "SOLEVA": "Soleva", "KISS BEAUTY": "Kiss Beauty",
    "MISS BEAUTY": "Miss Beauty", "BONARA": "Bonara", "BONARA BEAUTY": "Bonara", "CLICK": "Click Hair",
    "CLICK HAIR": "Click Hair", "VIDAN": "Vidan", "MISS C": "Miss C", "WE": "WE", "MIISS": "Miis",
    "MIIS": "Miis", "MII´S COSMETICS": "Mii's Cosmetics", "ILOVE PINCH": "I Love Pinch",
    "PROSA": "Prosa", "MELU": "Melu", "NATURA": "Natura", "SHIELD COSMETICS": "Shield Cosmetics",
    "GODOY BEAUTY": "Godoy Beauty", "BEAUTY CREATIONS": "Beauty Creations",
    "KEYDI DE LA ROSA": "Keydi de la Rosa", "DAZLEE": "Dazlee", "ANYELUZ": "Anyeluz", "KUWAI": "Kuwai",
    "BURBAY": "Burbay", "KARITÉ": "Karité", "GARNIER": "Garnier", "MAX FACTOR": "Max Factor",
    "MASTERLY": "Masterly", "TINCKE": "Tincke", "PRO NOVA": "Pro Nova", "LA VALDIRI": "La Valdiri",
    "BY LA VALDIRI": "La Valdiri", "L.A GIRL ": "L.A. Girl", "SOL DE JANEIRO": "Sol de Janeiro",
    "PRO": "SP Pro", "SP PRO": "SP Pro", "MARILYN ": "Marilyn", "BARBIE": "Barbie", "GIRL": "Girl",
    "ELVIVE": "L'Oréal Elvive", "LZ": "LZ", "RITUAL B": "Ritual Botánico", "MISS": "Miss",
    "OIL": "Bio-Oil", "MIISS": "Mii's Cosmetics", "MIIS": "Mii's Cosmetics", "DELCORA": "Del Cora",
}
# nombre manual para páginas-colección sin título: {número_de_página_pdf: "Nombre"}
PAGE_NAMES = {295: "LÍNEA CORPORAL AROMAS DULCES"}
NOT_PRODUCT_TITLES = {"base-polvo-rubor"}
HEADING_BRANDS = {"lz": "LZ", "click-hair": "Click Hair", "ritual": "Ritual Botánico",
                  "ritual-botanico": "Ritual Botánico"}
# Marcas que suelen ir al final del nombre sin guion (ej: "CORRECTOR MILANI")
TAIL_BRANDS = sorted([b for b in BRANDS if len(b) > 2 and b not in {"PRO", "GIRL", "MISS", "LZ", "WE"}],
                     key=len, reverse=True)


def pretty_word(w, first):
    up = w.upper()
    if up in WORD_FIX:
        return WORD_FIX[up]
    if up in KEEP_UPPER:
        return up
    m = re.fullmatch(r"(\d+)\s*(ML|G|GR|HRS)", up)
    if m:
        unit = {"ML": "ml", "G": "g", "GR": "g", "HRS": "h"}[m.group(2)]
        return f"{m.group(1)} {unit}"
    if re.fullmatch(r"X\d+", up):
        return up.lower()
    if up == "1ST":
        return "1st"
    low = w.lower()
    if not first and low in SMALL:
        return low
    return low[:1].upper() + low[1:]


def pretty(text):
    words = re.split(r"(\s+|/|\|)", text.strip())
    out, first = [], True
    for w in words:
        if not w or w.isspace() or w in "/|":
            out.append(w)
            continue
        out.append(pretty_word(w, first))
        first = False
    s = "".join(out)
    s = re.sub(r"\s+", " ", s).strip(" -–:")
    return s


def split_brand(title):
    t = re.sub(r"\s+", " ", title).strip()
    m = re.match(r"^(.*\S)\s*[–-]\s+(.+)$|^(.*\S)\s+[–-]\s*(.+)$", t)
    if m:
        name, brand = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
        return name.strip(), brand.strip()
    up = t.upper()
    for b in TAIL_BRANDS:
        if up.endswith(" " + b) and len(up) > len(b) + 3:
            return t[: -len(b)].strip(), b
    return t, ""


def pretty_brand(b):
    key = b.upper().strip()
    return BRANDS.get(key, pretty(b)) if b else ""


def slug(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- categorías
def category(page, name):
    n = slug(name)
    rules = [
        (r"^(blender|borla|brocha|kit-brochas|kit-blender)", "Brochas y accesorios"),
        (r"^(fijador|polvo|primer|base|corrector|matificante)", "Rostro"),
        (r"^(rubor|bronzer|contorno|iluminador|stick-rubor|stick-contorno|stick-iluminador)", "Mejillas y contorno"),
        (r"^(lapiz-ojos|pestanina|lapiz-cejas|betun|gel-de-cejas|gel-cejas|sombra|delineador|plumon)", "Ojos y cejas"),
        (r"^(labial|gloss|lip|lapiz-labios|tinta-labios)", "Labios"),
        (r"^(cera-capilar|plancha|cepillo-secador|cepillo-termico|pinza-rizadora)", "Cabello"),
        (r"^(shimmer-corporal|body)", "Cuerpo"),
    ]
    for pat, cat in rules:
        if re.search(pat, n):
            return cat
    ranges = [
        (2, 9, "Cabello"), (10, 22, "Ojos y cejas"), (23, 57, "Rostro"), (58, 83, "Ojos y cejas"),
        (84, 84, "Rostro"), (85, 129, "Mejillas y contorno"), (130, 135, "Rostro"),
        (136, 192, "Cuidado de la piel"), (193, 236, "Labios"), (237, 288, "Brochas y accesorios"),
        (289, 296, "Cuerpo"), (297, 306, "Brochas y accesorios"),
    ]
    for a, b, cat in ranges:
        if a <= page <= b:
            return cat
    return "Otros"


# ---------------------------------------------------------------- extracción
def lines_of(page):
    out = []
    for blk in page.get_text("dict")["blocks"]:
        if blk["type"] != 0:
            continue
        for ln in blk["lines"]:
            text = "".join(s["text"] for s in ln["spans"]).strip()
            if not text:
                continue
            sp = max(ln["spans"], key=lambda s: len(s["text"].strip()))
            if sp["font"] == "Helvetica" or text in {"0", "."}:
                continue
            out.append({"text": text, "rect": pymupdf.Rect(ln["bbox"]), "size": sp["size"], "font": sp["font"]})
    return out


def classify(ln):
    t = ln["text"]
    if ln["font"].lower().startswith("sacramento"):
        return "heading"
    if ln["size"] < 20:
        return "ignore"
    if t.lower().startswith("agotado"):
        return "soldout"
    if t.rstrip().endswith(":") or re.fullmatch(r"(GRANDE|MINI|MEDIANO|PEQUEÑO|JUMBO)(\s+\S+)?", t.strip(), re.I):
        return "variant"
    if re.match(r"^marca\s+\w+", t, re.I):
        return "brandnote"
    letters = [c for c in t if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.7:
        return "title"
    return "note"


def save_clip(page, rect, path, width):
    clip = rect & CONTENT & page.rect
    if clip.is_empty or clip.width < 20 or clip.height < 20:
        return False
    zoom = min(2.2, width / clip.width)
    pix = page.get_pixmap(clip=clip, matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    with open(path, "wb") as f:
        f.write(pix.tobytes("jpeg", jpg_quality=72))
    return True


def main(pdf_path):
    os.makedirs(IMG_DIR, exist_ok=True)
    for old in os.listdir(IMG_DIR):
        if old.endswith(".jpg"):
            os.remove(os.path.join(IMG_DIR, old))

    doc = pymupdf.open(pdf_path)
    products, collage_pages, seen = [], [], set()

    for pno in range(1, doc.page_count):  # la página 0 es la portada
        page = doc[pno]
        pagenum = pno + 1
        imgs = [pymupdf.Rect(i["bbox"]) & page.rect for i in page.get_image_info()]
        imgs = [r for r in imgs if r.width > 60 and r.height > 60 and (r & CONTENT).get_area() > 0.5 * r.get_area()]
        lines = lines_of(page)
        for ln in lines:
            ln["kind"] = classify(ln)
        titles = [ln for ln in lines if ln["kind"] == "title"]
        headings = [ln for ln in lines if ln["kind"] == "heading"]

        # Emparejar cada título con la foto que tiene encima
        for t in titles:
            cx = (t["rect"].x0 + t["rect"].x1) / 2
            best, best_score = None, None
            for r in imgs:
                if not (r.x0 - 10 <= cx <= r.x1 + 10):
                    continue
                if not (r.y0 < t["rect"].y0 and t["rect"].y0 - 160 <= r.y1 <= t["rect"].y1 + 40):
                    continue
                score = abs(r.y1 - t["rect"].y0) + abs((r.x0 + r.x1) / 2 - cx) * 0.5
                if best_score is None or score < best_score:
                    best, best_score = r, score
            t["img"] = best

        n_variants = sum(1 for ln in lines if ln["kind"] == "variant")
        is_collage = (
            not titles
            or any(t["img"] is None for t in titles)
            or (bool(headings) and n_variants > len(titles))
            or len(imgs) > 2 * len(titles)
        )
        # Encabezado decorativo (ej. "Click hair") = marca de los productos sin marca
        heading_brand = ""
        if headings:
            h = re.sub(r"^(productos|cuidado capilar)\s+", "", " ".join(x["text"] for x in headings).strip(), flags=re.I)
            heading_brand = HEADING_BRANDS.get(slug(h), "")

        if is_collage:
            if not imgs:
                continue
            collage_pages.append(pagenum)
            union = pymupdf.Rect(imgs[0])
            for r in imgs[1:]:
                union |= r
            brandnote = next((re.sub(r"^marca\s+", "", ln["text"], flags=re.I) for ln in lines if ln["kind"] == "brandnote"), "")
            notes = [ln["text"] for ln in lines if ln["kind"] == "note"]
            variant_lines = [ln for ln in lines if ln["kind"] == "variant"]
            # Títulos con guion que en realidad describen usos, no marcas (ej. "BASE – POLVO –RUBOR")
            dashed = [t for t in titles if re.search(r"\s[–-]|[–-]\s", t["text"])
                      and slug(t["text"]) not in NOT_PRODUCT_TITLES]
            groups = []
            if not headings and len(dashed) >= 2:
                # Varios productos distintos en la misma página: uno por título con marca
                center = lambda r: ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
                buckets = {id(d): [] for d in dashed}
                for ln in [t for t in titles if t not in dashed] + variant_lines:
                    cx, cy = center(ln["rect"])
                    d = min(dashed, key=lambda d: (center(d["rect"])[0] - cx) ** 2 + (center(d["rect"])[1] - cy) ** 2)
                    buckets[id(d)].append(ln["text"])
                for d in dashed:
                    name, brand = split_brand(d["text"])
                    groups.append({"title": d["text"], "name": name, "brand": brand, "rect": union,
                                   "variants": buckets[id(d)], "notes": [], "soldout": False, "width": 900})
            else:
                if headings:
                    raw_name = " ".join(h["text"] for h in headings)
                    extra = [t["text"] for t in titles]
                    m = re.match(r"^marca\s+(.+)$", raw_name.strip(), re.I)
                    if m:  # "Marca delcora" -> línea corporal de esa marca
                        brandnote = m.group(1)
                        raw_name = "LÍNEA CORPORAL"
                else:
                    main_t = dashed[0] if dashed else (titles[0] if titles else None)
                    raw_name = main_t["text"] if main_t else PAGE_NAMES.get(pagenum, "Colección")
                    extra = [t["text"] for t in titles if t is not main_t]
                name, brand = split_brand(raw_name)
                if not brand and brandnote:
                    brand = brandnote
                groups = [{"title": raw_name, "name": name, "brand": brand, "rect": union,
                           "variants": extra + [ln["text"] for ln in variant_lines], "notes": notes,
                           "soldout": False, "width": 900}]
        else:
            groups = []
            for t in titles:
                name, brand = split_brand(t["text"])
                groups.append({"title": t["text"], "name": name, "brand": brand, "rect": t["img"],
                               "anchor": t, "variants": [], "notes": [], "soldout": False, "width": 560,
                               "heading_brand": heading_brand})
            variant_lines = [ln for ln in lines if ln["kind"] == "variant"]
            # Asignar variantes, notas y "Agotado" al título más cercano por encima
            for ln in lines:
                if ln["kind"] not in {"variant", "note", "soldout"}:
                    continue
                cx = (ln["rect"].x0 + ln["rect"].x1) / 2
                cands = [g for g in groups
                         if g["anchor"]["rect"].y0 <= ln["rect"].y0 + 5
                         and g["rect"].x0 - 20 <= cx <= g["rect"].x1 + 20]
                if not cands:
                    continue
                g = max(cands, key=lambda g: g["anchor"]["rect"].y0)
                if ln["kind"] == "variant":
                    g["variants"].append(ln["text"])
                elif ln["kind"] == "note":
                    g["notes"].append(ln["text"])
                else:
                    same_row = [v for v in variant_lines if abs(v["rect"].y0 - ln["rect"].y0) < 12
                                and g["rect"].x0 - 20 <= (v["rect"].x0 + v["rect"].x1) / 2 <= g["rect"].x1 + 20]
                    if same_row:
                        g.setdefault("soldout_variants", []).append(same_row[0]["text"])
                    else:
                        g["soldout"] = True

        for i, g in enumerate(groups, 1):
            nombre = pretty(g["name"]) or "Producto"
            marca = pretty_brand(g["brand"]) or g.get("heading_brand", "")
            if is_collage and not marca:
                marca = heading_brand
            base_id = slug(f"{nombre}-{marca}") or f"producto-p{pagenum}-{i}"
            pid = base_id
            n = 2
            while pid in seen:
                pid = f"{base_id}-{n}"
                n += 1
            seen.add(pid)

            filename = f"p{pagenum:03d}-{i}-{slug(nombre)[:40]}.jpg"
            if not save_clip(page, g["rect"], os.path.join(IMG_DIR, filename), g["width"]):
                continue

            soldout_v = {slug(v) for v in g.get("soldout_variants", [])}
            variants = []
            for v in g["variants"]:
                label = pretty(v.replace(":", " "))
                if not label:
                    continue
                if slug(v) in soldout_v:
                    label += " (agotado)"
                if label not in variants:
                    variants.append(label)

            item = {
                "id": pid,
                "nombre": nombre,
                "marca": marca,
                "categoria": category(pagenum, g["name"] if not is_collage else g["title"]),
                "precio": None,
                "imagen": f"assets/img/catalogo/{filename}",
            }
            notes = " ".join(n.strip() for n in g["notes"]).strip()
            if notes:
                item["descripcion"] = notes[:1].upper() + notes[1:]
            if variants:
                item["tonos"] = variants
                item["tonosLabel"] = "Opción"
            if g["soldout"]:
                item["agotado"] = True
            if is_collage:
                item["collage"] = True  # foto de página completa: se muestra sin recortar
            item["pagina"] = pagenum - 1
            products.append(item)

    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("/* Generado automáticamente desde el PDF del catálogo con tools/extraer_catalogo.py.\n")
        f.write("   Para cambiar precios o datos puntuales, edítalos aquí directamente. */\n")
        f.write("window.MIMADA_CATALOGO = ")
        json.dump(products, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    # Reporte
    from collections import Counter
    print("productos:", len(products))
    print("por categoria:", dict(Counter(p["categoria"] for p in products)))
    print("marcas:", len({p["marca"] for p in products if p["marca"]}))
    print("sin marca:", sum(1 for p in products if not p["marca"]))
    print("agotados:", sum(1 for p in products if p.get("agotado")))
    print("con opciones:", sum(1 for p in products if p.get("tonos")))
    print("paginas collage:", collage_pages)
    size = sum(os.path.getsize(os.path.join(IMG_DIR, x)) for x in os.listdir(IMG_DIR))
    print(f"peso imagenes: {size/1e6:.1f} MB")
    print("marcas lista:", sorted({p["marca"] for p in products if p["marca"]}))


if __name__ == "__main__":
    main(sys.argv[1])
