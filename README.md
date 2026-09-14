# MIMADA Beauty — Tienda web

Web estática (HTML + CSS + JS, sin dependencias). Las clientas arman su bolsa, llenan sus datos y el pedido se envía listo por WhatsApp.

## Ver en local

```bash
node dev-server.js
```

Abrir http://localhost:5500

## Editar la tienda

| Qué | Dónde |
| --- | --- |
| Número de WhatsApp, Instagram, formas de entrega y de pago | `js/config.js` |
| Novedades agregadas a mano (salen primero) | `js/products.js` |
| Catálogo completo (~880 productos, generado desde el PDF) | `js/catalogo.js` |
| Volver a generar el catálogo cuando llegue un PDF nuevo | `python tools/extraer_catalogo.py "ruta/al/CATÁLOGO.pdf"` (requiere `pip install pymupdf`; sobrescribe `js/catalogo.js` y `assets/img/catalogo/`) |
| Fotos de productos | `assets/img/productos/` |
| Textos de secciones (hero, pasos, preguntas) | `index.html` |
| Colores y tipografías | `css/styles.css` (variables en `:root`) |

- `precio: null` muestra "Precio por WhatsApp".
- Las categorías del filtro se crean solas a partir de los productos.
- Fotos recomendadas: verticales 4:5, mínimo 900 px de ancho.

## Publicar

Publicada en Netlify: **https://mimadabeauty.netlify.app** (`netlify.toml` ya configura la carpeta, caché y bloquea `/tools/`).
Se puede arrastrar la carpeta completa a Netlify Drop o conectar el repositorio; no hay paso de build.

### Vista previa al compartir el link
- Imagen: `assets/img/og-mimada.jpg` (1200×630). Para regenerarla: `python tools/generar_preview.py`.
- Probar cómo se ve: https://developers.facebook.com/tools/debug/ (botón "Volver a extraer" para limpiar la caché de WhatsApp/Facebook).

### Cuando compren el dominio propio
Reemplazar `https://mimadabeauty.netlify.app` por el dominio nuevo en:
1. `index.html` (bloque de metadatos: canonical, og:url, og:image, twitter:image)
2. `robots.txt`
3. `sitemap.xml`

Luego en Netlify: *Domain management → Add domain* y marcarlo como principal.

## Pendiente con la clienta

- [x] Número de WhatsApp para pedidos (300 217 6637)
- [x] Logo
- [x] Catálogo completo con fotos (PDF de 306 páginas)
- [ ] Precios de cada producto (el PDF no los trae: aparecen "30ML:", "GRANDE:" en blanco)
- [ ] Nombres de tonos disponibles por producto
- [ ] Marca de ~100 productos que en el PDF no la indican
- [x] Formas de pago: Nequi y llave Bre-B
- [ ] Confirmar si el número Nequi y la llave se muestran en la web o solo se envían por WhatsApp
- [ ] Costo de envíos
- [ ] Dominio (ej. mimadabeauty.com)
