/**
 * Fotos oficiales de las marcas para productos que el proveedor publica SIN foto.
 * Solo se usan mientras el proveedor no tenga foto propia del producto.
 * Clave: id del producto en el proveedor -> tienda oficial de la marca + id del producto allá.
 * Revisadas a mano (2026-09-17): cada una corresponde exactamente al mismo producto.
 */
const OLE = "https://olecapilar.com";
const ENGOL = "https://engolcollections.com";
const MAJIKAL = "https://majikalbeauty.com";

export const BRAND_PHOTOS = {
  "tratamiento-y-crema-para-peinar-pulpa-de-coco-ole": [OLE, "tratamiento-crema-para-peinar-pulpa-de-coco"],
  "tratamiento-reparador-coctel-de-frutas-ole": [OLE, "tratamiento-reparador-coctel-de-frutas"],
  "tratamiento-proteina-arroz-y-aminoacidos-ole": [OLE, "tratamiento-proteina-de-arroz-y-aminoacidos"],
  "shampoo-reparador-mix-de-frutas-ole": [OLE, "shampoo-antioxidante-mix-de-frutas"],
  "acondicionador-long-lasting-jarabe-de-mango-ole": [OLE, "acondicionador-long-lasting-jarabe-de-mango"],
  "acondicionador-jengibre-purificante-antigrasa-ole": [OLE, "acondicionador-capilar-extracto-natural-de-jengibre-purificante-anti-grasa"],
  "termoprotector-y-desenredante-acai-ole": [OLE, "termoprotector-desenredante-aceite-de-acai"],
  "polvo-capilar-proteina-de-arroz-ole": [OLE, "polvo-capilar-traslucido-matificante-proteina-de-arroz-y-colageno"],
  "shampoo-antigrasa-cebolla-y-jengibre-ole": [OLE, "shampoo-antigrasa-cebolla-jengibre"],
  "rubor-corazon-engol": [ENGOL, "rubor-corazon-cor-437"],
  "jelly-pop-majikal": [MAJIKAL, "jelly-pop"],
};
