"""
Genera la imagen de vista previa para redes (assets/img/og-mimada.jpg, 1200x630)
y los íconos de la web (icono-512.png, apple-touch-icon.png).

Uso:  python tools/generar_preview.py
Requiere: pip install pymupdf
"""
import os

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
CACAO = (0x60 / 255, 0x39 / 255, 0x2A / 255)
ROSA = (0xF9 / 255, 0xC9 / 255, 0xC1 / 255)
LOGO = os.path.join(IMG, "logo-mimada.png")


def cover(src, r):
    """Imagen recortada tipo object-fit: cover al tamaño del rectángulo."""
    img = pymupdf.Pixmap(src)
    scale = max(r.width / img.width, r.height / img.height) * 2
    tmp = pymupdf.open()
    tp = tmp.new_page(width=r.width * 2, height=r.height * 2)
    w, h = img.width * scale, img.height * scale
    x0, y0 = (tp.rect.width - w) / 2, (tp.rect.height - h) / 2
    tp.insert_image(pymupdf.Rect(x0, y0, x0 + w, y0 + h), pixmap=img)
    return tp.get_pixmap(alpha=False)


def og_image():
    doc = pymupdf.open()
    pg = doc.new_page(width=1200, height=630)
    pg.draw_rect(pg.rect, color=None, fill=CACAO)
    photos = [
        ("productos/termo-bloom-steel-1.jpg", pymupdf.Rect(650, 200, 890, 570)),
        ("productos/mimosa-xl-lip-oil.jpg", pymupdf.Rect(845, 60, 1140, 570)),
    ]
    for src, r in photos:
        pg.draw_rect(r + (-7, -7, 7, 7), color=None, fill=(0.74, 0.55, 0.50))
        pg.insert_image(r, pixmap=cover(os.path.join(IMG, src), r), keep_proportion=False)
    pg.insert_image(pymupdf.Rect(60, 140, 600, 356), filename=LOGO, keep_proportion=True)
    pg.draw_line((90, 398), (570, 398), color=ROSA, width=0.8)
    pg.insert_textbox(pymupdf.Rect(60, 418, 600, 470), "Todo lo bonito comienza aquí",
                      fontname="tiit", fontsize=34, color=ROSA, align=1)
    pg.insert_textbox(pymupdf.Rect(40, 480, 620, 510),
                      "MAQUILLAJE  ·  ENVÍOS A TODO COLOMBIA  ·  PEDIDOS POR WHATSAPP",
                      fontname="helv", fontsize=12.5, color=ROSA, align=1)
    with open(os.path.join(IMG, "og-mimada.jpg"), "wb") as f:
        f.write(pg.get_pixmap(alpha=False).tobytes("jpeg", jpg_quality=88))


def icons():
    doc = pymupdf.open()
    pg = doc.new_page(width=512, height=512)
    pg.draw_rect(pg.rect, color=None, fill=CACAO)
    pg.insert_image(pymupdf.Rect(40, 150, 472, 362), filename=LOGO, keep_proportion=True)
    pg.get_pixmap(alpha=False).save(os.path.join(IMG, "icono-512.png"))
    pg.get_pixmap(alpha=False, matrix=pymupdf.Matrix(180 / 512, 180 / 512)).save(
        os.path.join(IMG, "apple-touch-icon.png"))


if __name__ == "__main__":
    og_image()
    icons()
    for name in ("og-mimada.jpg", "icono-512.png", "apple-touch-icon.png"):
        print(name, os.path.getsize(os.path.join(IMG, name)), "bytes")
