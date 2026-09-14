/* =========================================================
   NOVEDADES — productos agregados a mano (salen primero)
   El resto del catálogo está en js/catalogo.js (generado desde el PDF)
   ---------------------------------------------------------
   id        identificador único, sin espacios
   nombre    nombre visible
   marca     marca del producto
   categoria se usa para los filtros
   precio    número en pesos sin puntos (ej: 45000) o null = "Precio por WhatsApp"
   precioAntes (opcional) precio tachado para mostrar descuento
   imagen    ruta de la foto
   tonos     lista de tonos/opciones (opcional). La clienta elige uno.
   tonosLabel (opcional) cómo se llaman las opciones: "Tono", "Presentación"...
   etiqueta  (opcional) "Nuevo", "Top", "Últimas unidades"...
   agotado   (opcional) true para mostrarlo sin stock
   ========================================================= */
window.MIMADA_PRODUCTS = [
  {
    id: "termo-bloom-steel",
    nombre: "Termo Bloom Steel",
    marca: "Bloomshell",
    categoria: "Brochas y accesorios",
    precio: null,
    imagen: "assets/img/productos/termo-bloom-steel-1.jpg",
    descripcion: "Termo de acero inoxidable con acabado perlado palo de rosa. Incluye pitillo metálico, charms decorativos y stickers para personalizarlo.",
    etiqueta: "Nuevo"
  },
  {
    id: "mimosa-xl-lip-oil",
    nombre: "Mimosa XL Lip Oil Premium",
    marca: "Bloomshell",
    categoria: "Labios",
    precio: null,
    imagen: "assets/img/productos/mimosa-xl-lip-oil.jpg",
    descripcion: "Labios con efecto glossy, jugosos y divinos. El toque final que vas a querer llevar siempre contigo.",
    etiqueta: "Nuevo"
  }
];
