import type { APIRoute } from "astro";
import { TTL } from "../lib/cache";

/**
 * Los sitemaps se sirven tal cual salen del dataset.
 *
 * Los genera el scraper en la misma pasada que los índices, por dos razones:
 * quedan al día solos en cada publicación, y el sitio no gasta CPU
 * construyéndolos en cada petición. Un sitemap de 25.000 URLs armado aquí se
 * comería de largo el presupuesto de 10 ms del Worker.
 */

const BASE = (
  import.meta.env.DATASET_BASE_URL ||
  "https://raw.githubusercontent.com/capared2/neurolink/main/data"
).replace(/\/+$/, "");

/** Lista blanca: solo los nombres que el scraper llega a escribir. */
const NOMBRES = /^sitemap(-secciones|-news|-noticias-\d{4})?$/;

export const GET: APIRoute = async ({ params }) => {
  const nombre = params.sitemap;
  if (!nombre || !NOMBRES.test(nombre)) {
    return new Response("No encontrado", { status: 404 });
  }

  try {
    const respuesta = await fetch(`${BASE}/seo/${nombre}.xml`, {
      cf: { cacheTtl: TTL.indice, cacheEverything: true },
    } as RequestInit);

    if (!respuesta.ok) return new Response("No encontrado", { status: 404 });

    // El cuerpo se pasa sin leerlo: un sitemap grande son megabytes y no hay
    // ninguna razón para materializarlos en memoria.
    return new Response(respuesta.body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=3600",
      },
    });
  } catch {
    return new Response("No disponible", { status: 503 });
  }
};
