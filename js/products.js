/* =========================================================
   PRODUCTOS PROPIOS DE MIMADA (no están en el catálogo del proveedor)
   Salen primero en la tienda. El resto del catálogo se sincroniza solo
   con el proveedor cada hora y se administra desde /admin.
   ---------------------------------------------------------
   id        identificador único, sin espacios
   nombre    nombre visible
   marca     marca del producto
   categoria Rostro, Mejillas y contorno, Ojos y cejas, Labios, Cuidado de la piel,
             Cabello, Cuerpo, Brochas y accesorios, Eléctricos
   precio    número en pesos sin puntos (ej: 45000) o null = "Precio por WhatsApp"
   imagen    ruta de la foto
   tonos     (opcional) lista de tonos; agrega " (agotado)" al final para bloquear uno
   tonosLabel (opcional) cómo se llaman las opciones: "Tono", "Presentación"...
   etiqueta  (opcional) "Nuevo", "Oferta"...
   agotado   (opcional) true para mostrarlo sin stock
   ========================================================= */
window.MIMADA_PRODUCTS = [
  {
    id: "termo-bloomshell",
    nombre: "Termo Bloomshell",
    marca: "Bloomshell",
    categoria: "Brochas y accesorios",
    precio: 140000,
    imagen: "assets/img/productos/termo-bloom-steel-1.jpg",
    descripcion: "Termo de acero inoxidable con acabado perlado palo de rosa. Incluye pitillo metálico, charms decorativos y stickers para personalizarlo.",
    etiqueta: "Nuevo"
  }
];
