/* =========================================================
   CONFIGURACIÓN DE LA TIENDA — edita aquí sin tocar el resto
   ========================================================= */
window.MIMADA_CONFIG = {
  // Número de WhatsApp que recibe los pedidos.
  // Formato: código de país + número, sin "+", espacios ni guiones. Ej: "573001234567"
  // Si lo dejas vacío, WhatsApp abrirá el pedido para elegir el contacto manualmente.
  whatsapp: "573002176637",

  instagram: "https://www.instagram.com/mimadabeauty_/",
  instagramUser: "@mimadabeauty_",
  ciudad: "Barranquilla",

  // Formas de entrega que aparecen en el formulario del pedido
  entregas: [
    { id: "nacional", label: "Envío nacional", detalle: "Transportadora a todo Colombia · el valor depende de tu ciudad", pideDireccion: true },
    { id: "domicilio", label: "Domicilio en Barranquilla", detalle: "Te confirmamos el valor por WhatsApp", pideDireccion: true },
    { id: "recoger", label: "Acordar punto de entrega", detalle: "Coordinamos contigo por WhatsApp", pideDireccion: false }
  ],

  // Formas de pago que aparecen en el formulario del pedido
  pagos: [
    { id: "nequi", label: "Nequi", detalle: "Te enviamos el número por WhatsApp al confirmar tu pedido" },
    { id: "llave", label: "Llave Bre-B", detalle: "Pago inmediato desde cualquier banco; te compartimos la llave por WhatsApp" }
  ]
};
