# MIMADA Beauty — Tienda web

Tienda web de MIMADA Beauty (Barranquilla). Las clientas arman su bolsa, eligen tono, llenan sus datos y el pedido se envía listo por WhatsApp.

- **Sitio:** https://mimadabeauty.netlify.app
- **Panel de administración:** https://mimadabeauty.netlify.app/admin/
- **Repositorio:** https://github.com/Juandi0127/mimadabeauty (cada push a `main` publica en Netlify)

## Cómo funciona el catálogo

El catálogo es un **espejo del proveedor** (tienda Shopify): nombres, fotos, tonos, precios y stock se copian solos.

```
Proveedor (products.json)  ──cada hora──▶  netlify/functions/sync-catalogo.mjs  ──▶  Netlify Blobs "catalogo"
                                                                                           │
Panel /admin  ──guarda──▶  netlify/functions/admin.mjs  ──▶  Netlify Blobs "ajustes"       │
                                                                                           ▼
Tienda (js/app.js)  ◀──  GET /api/catalogo  (netlify/functions/catalogo.mjs: catálogo + ajustes)
        └─ si la API falla usa data/catalogo-respaldo.json
```

- **Precios y stock:** los del proveedor, por tono. Un tono sin stock queda bloqueado; un producto sin stock sale "Agotado".
- **Productos nuevos del proveedor:** aparecen solos en la siguiente sincronización (etiqueta "Nuevo" las primeras 3 semanas).
- **Si el proveedor falla** o devuelve menos de la mitad de productos, se conserva el último catálogo bueno.
- **Nunca se muestra** el nombre ni el enlace del proveedor en la tienda.

### Panel de administración (`/admin/`)
Ella entra con contraseña y puede, por producto: **ocultar**, **marcar agotado**, poner **precio propio** (reemplaza el del proveedor), **destacar** (sale primero) y poner una **etiqueta** ("Oferta", "Top"…). También puede forzar "Actualizar desde proveedor". Los cambios se ven en la tienda en máximo 1 minuto.

**Configuración obligatoria en Netlify:** *Site configuration → Environment variables → Add variable*
`ADMIN_PASSWORD` = la contraseña del panel (luego hacer *Deploys → Trigger deploy*).

## Ver en local

```bash
npm install
npm run dev
```

- Tienda: http://localhost:5500
- Panel: http://localhost:5500/admin/ (contraseña local: `mimada-local`)
- En local los datos se guardan en `.netlify-local/` en vez de Netlify Blobs.

## Editar la tienda

| Qué | Dónde |
| --- | --- |
| Número de WhatsApp, Instagram, formas de entrega y de pago | `js/config.js` |
| Productos propios que no vende el proveedor (ej. el termo) | `js/products.js` |
| Ocultar productos, precios propios, destacados, etiquetas | Panel `/admin/` |
| Reglas de categorías, nombres de marcas, formato de nombres | `netlify/lib/dulcinea.mjs` |
| Copia de respaldo del catálogo | `npm run respaldo` (actualiza `data/catalogo-respaldo.json`) |
| Textos de secciones (hero, pasos, preguntas) | `index.html` |
| Colores y tipografías | `css/styles.css` (variables en `:root`) |

## Publicar

Netlify publica automáticamente cada push a `main` (`netlify.toml` configura carpeta, funciones, Node 22, caché y bloquea archivos internos).
La función programada solo corre en el sitio publicado (no en previsualizaciones).

### Vista previa al compartir el link
- Imagen: `assets/img/og-mimada.jpg` (1200×630). Para regenerarla: `python tools/generar_preview.py`.
- Probar cómo se ve: https://developers.facebook.com/tools/debug/ ("Volver a extraer" limpia la caché de WhatsApp/Facebook).

### Cuando compren el dominio propio
Reemplazar `https://mimadabeauty.netlify.app` por el dominio nuevo en `index.html` (metadatos), `robots.txt` y `sitemap.xml`, y en Netlify: *Domain management → Add domain*.

## Pendiente con la clienta

- [x] Número de WhatsApp para pedidos (300 217 6637)
- [x] Logo
- [x] Formas de pago: Nequi y llave Bre-B
- [x] Precios, tonos y stock (sincronizados con el proveedor)
- [ ] Contraseña del panel admin (configurar `ADMIN_PASSWORD` en Netlify)
- [ ] Confirmar si el número Nequi y la llave se muestran en la web o solo se envían por WhatsApp
- [ ] Costo de envíos
- [ ] Dominio (ej. mimadabeauty.com)
