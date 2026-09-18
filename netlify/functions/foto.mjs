/**
 * GET /api/foto/:key — sirve las fotos subidas desde el panel admin.
 * Las fotos nunca cambian (cada subida tiene un nombre nuevo), así que se guardan en caché un año.
 */
import { getMimadaStore, PHOTO_STORE } from "../lib/store.mjs";

export default async (req, context) => {
  const key = context?.params?.key || new URL(req.url).pathname.split("/").pop();
  if (!/^f-[a-z0-9-]{6,60}$/.test(key || "")) return new Response("No encontrado", { status: 404 });
  try {
    const store = await getMimadaStore(PHOTO_STORE);
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result?.data) return new Response("No encontrado", { status: 404 });
    return new Response(result.data, {
      headers: {
        "Content-Type": result.metadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("foto:", err);
    return new Response("Error", { status: 500 });
  }
};

export const config = { path: "/api/foto/:key" };
