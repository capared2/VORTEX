import { defineMiddleware } from "astro:middleware";
import { VERSION_CACHE, cacheDelEdge, contextoDe } from "./lib/cache";

/**
 * Caché de la página entera en el edge.
 *
 * Un Worker se ejecuta en **todas** las peticiones: Cloudflare no cachea por su
 * cuenta lo que devuelve. Sin esto, cada visita de un rastreador a una noticia
 * que ya había pedido mil veces volvería a descargar y parsear el archivo de su
 * tema, y a renderizar el mismo HTML.
 *
 * Guardando la respuesta en `caches.default`, una petición repetida no lee el
 * dataset, no renderiza y no gasta prácticamente CPU: se devuelve el HTML tal
 * cual salió la primera vez. Es la diferencia entre rozar el límite de 10 ms y
 * quedarse en décimas de milisegundo.
 */

/**
 * Parámetros de consulta que de verdad cambian la página.
 *
 * Es una lista blanca a propósito. Los rastreadores y las redes sociales añaden
 * `fbclid`, `utm_*` y demás: con una lista negra, cualquier parámetro inventado
 * generaría una entrada nueva y la caché no acertaría nunca.
 */
const PARAMETROS_UTILES = ["p"];

/** Rutas que no conviene cachear por URL. */
function cacheable(url: URL): boolean {
  // La búsqueda admite infinitas consultas distintas: llenaría la caché de
  // entradas de un solo uso. Sale barata igualmente, porque solo lee un fichero
  // que ya está memorizado.
  if (url.pathname.startsWith("/buscar")) return false;

  // Las imágenes ya se sirven con su propia cabecera de caché inmutable y las
  // guarda el edge por su cuenta; meterlas también aquí duplicaría el
  // almacenamiento sin ganar nada.
  if (url.pathname.startsWith("/img/")) return false;

  return true;
}

/** URL normalizada que sirve de clave: misma página, misma entrada. */
function claveDeCache(url: URL): string {
  const limpia = new URL(url.origin + url.pathname);
  for (const parametro of PARAMETROS_UTILES) {
    const valor = url.searchParams.get(parametro);
    if (valor) limpia.searchParams.set(parametro, valor);
  }
  // Cada despliegue estrena claves: el HTML de la versión anterior deja de
  // servirse solo, sin purgar nada a mano.
  limpia.searchParams.set("v", VERSION_CACHE);
  return limpia.toString();
}

/** Segundos que el edge puede guardar una respuesta sin cabecera propia. */
const TTL_ERROR = 600;

export const onRequest = defineMiddleware(async (contexto, next) => {
  const { request } = contexto;

  // HEAD también se responde desde la caché --algunos rastreadores lo usan para
  // comprobar si una noticia sigue viva--, pero no la llena: su cuerpo va vacío
  // y guardarlo dejaría la entrada inservible para los GET.
  const esHead = request.method === "HEAD";
  if (request.method !== "GET" && !esHead) return next();

  const cache = cacheDelEdge();
  const url = new URL(request.url);
  if (!cache || !cacheable(url)) return next();

  const clave = claveDeCache(url);

  try {
    const guardada = await cache.match(clave);
    if (guardada) {
      const respuesta = new Response(esHead ? null : guardada.body, guardada);
      respuesta.headers.set("X-Cache", "HIT");
      return respuesta;
    }
  } catch {
    // Si la caché falla se sirve la página como siempre.
  }

  const original = await next();
  if (esHead) return original;

  // Se reconstruye para poder tocar las cabeceras: las de la respuesta que
  // devuelve Astro pueden venir congeladas. Pasar el cuerpo tal cual mantiene
  // el streaming del HTML.
  const respuesta = new Response(original.body, original);

  // 404 no trae cabecera de caché propia, y sin ella la Cache API no guardaría
  // nada. Merece guardarse un rato: los rastreadores insisten mucho en URLs
  // muertas. Los 5xx no se guardan nunca.
  if (respuesta.status === 404 && !respuesta.headers.has("Cache-Control")) {
    respuesta.headers.set("Cache-Control", `public, max-age=60, s-maxage=${TTL_ERROR}`);
  }

  const guardable =
    (respuesta.status === 200 || respuesta.status === 404) &&
    respuesta.headers.has("Cache-Control") &&
    !respuesta.headers.has("Set-Cookie");

  if (!guardable) return respuesta;

  respuesta.headers.set("X-Cache", "MISS");

  // `clone()` antes de devolverla: un cuerpo solo se puede leer una vez.
  const copia = respuesta.clone();
  const ctx = contextoDe(contexto.locals);
  const escritura = cache.put(clave, copia).catch(() => {});
  // Sin `waitUntil` el runtime puede cancelar la escritura al devolver la
  // respuesta, y la caché no se llenaría nunca.
  if (ctx) ctx.waitUntil(escritura);

  return respuesta;
});
