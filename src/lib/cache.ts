/**
 * Capas de caché que evitan repetir trabajo entre peticiones.
 *
 * El dataset vive en otro repositorio y se lee por HTTP, así que sin caché cada
 * visita pagaría una descarga y un `JSON.parse` de los mismos ficheros. Un
 * archivo de tema llega a 1,3 MB: parsearlo ronda los 4 ms de CPU, y Cloudflare
 * Workers corta la invocación a los 10 ms. De ahí los errores 1102
 * (`exceededCpu`) bajo tráfico de rastreadores, que piden las mismas URLs una y
 * otra vez.
 *
 * Se apilan tres capas, de la más barata a la más cara:
 *
 *  1. **Memoria del isolate**: guarda el objeto *ya parseado*. Es la única capa
 *     que ahorra CPU de parseo, y la que más rinde con rastreadores, que
 *     recorren muchas noticias del mismo tema seguidas.
 *  2. **Cache API del edge** (`caches.default`): sobrevive al isolate y evita
 *     la subpetición, aunque haya que volver a parsear.
 *  3. **Caché de subpeticiones** (`cf.cacheTtl`): si aun así hay que salir a la
 *     red, la respuesta se sirve desde el edge.
 */

declare const __VERSION_CACHE__: string;

/** Sello de la compilación, inyectado por Vite. En `astro dev` no existe. */
export const VERSION_CACHE =
  typeof __VERSION_CACHE__ === "string" ? __VERSION_CACHE__ : "dev";

/** Segundos que vive cada cosa. El scraper publica cada dos horas. */
export const TTL = {
  /** Índice, portada y últimas cambian en cada publicación del scraper. */
  indice: 300,
  /** El mapa id → parte solo crece: puede envejecer más. */
  lookup: 900,
  /** Los archivos históricos casi nunca cambian una vez cerrados. */
  parte: 900,
  /** Una noticia publicada ya no cambia. */
  articulo: 21600,
  /** Página HTML completa de una noticia. */
  paginaNoticia: 86400,
  /** Listados: entran noticias nuevas, conviene refrescar antes. */
  paginaListado: 900,
  /** Las imágenes que pasan por el proxy no cambian nunca. */
  imagen: 604800,
} as const;

// ---------------------------------------------------------------------------
// 1. Memoria del isolate
// ---------------------------------------------------------------------------

interface Guardado<T> {
  valor: T;
  expira: number;
}

/**
 * Caché LRU con caducidad, viva mientras dure el isolate.
 *
 * `Map` conserva el orden de inserción, así que reinsertar al leer basta para
 * que el elemento desalojado sea siempre el menos usado.
 */
export class Memoria<T> {
  private readonly entradas = new Map<string, Guardado<T>>();

  constructor(private readonly limite: number) {}

  leer(clave: string): T | undefined {
    const guardado = this.entradas.get(clave);
    if (!guardado) return undefined;

    if (guardado.expira <= Date.now()) {
      this.entradas.delete(clave);
      return undefined;
    }

    this.entradas.delete(clave);
    this.entradas.set(clave, guardado);
    return guardado.valor;
  }

  guardar(clave: string, valor: T, ttl: number): void {
    if (this.entradas.size >= this.limite) {
      const masAntigua = this.entradas.keys().next().value;
      if (masAntigua !== undefined) this.entradas.delete(masAntigua);
    }
    this.entradas.set(clave, { valor, expira: Date.now() + ttl * 1000 });
  }
}

// ---------------------------------------------------------------------------
// 2. Cache API del edge
// ---------------------------------------------------------------------------

/**
 * `caches.default` solo existe en el runtime de Workers.
 *
 * En `astro dev` (Node) no está, y en algunas versiones de Node hay un `caches`
 * global sin `default`: por eso se comprueba la propiedad y no solo el objeto.
 * Sin caché el sitio sigue funcionando, más lento.
 */
export function cacheDelEdge(): Cache | undefined {
  const global = globalThis as { caches?: { default?: Cache } };
  return global.caches?.default;
}

/**
 * Prefijo de las claves derivadas.
 *
 * La Cache API exige una URL https. Este host no se resuelve nunca: solo da un
 * espacio de nombres propio, separado del de las páginas del sitio.
 */
export const CLAVE_DATOS = "https://datos-internos.gigantum.net";

/** Lo que hace falta de `ExecutionContext` para escribir sin bloquear. */
export interface Contexto {
  waitUntil(promesa: Promise<unknown>): void;
}

/**
 * Saca el `ExecutionContext` de Cloudflare de `Astro.locals`.
 *
 * El adaptador lo expone como `locals.cfContext`; `locals.runtime` sigue
 * existiendo, pero sus propiedades lanzan un error al leerlas para avisar del
 * cambio. De ahí el try/catch. Sin runtime de Cloudflare devuelve `undefined` y
 * las escrituras se hacen sin `waitUntil`.
 */
export function contextoDe(locals: unknown): Contexto | undefined {
  try {
    const posible = (locals as { cfContext?: unknown }).cfContext;
    return typeof (posible as Contexto | undefined)?.waitUntil === "function"
      ? (posible as Contexto)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Escribe en la Cache API sin retrasar la respuesta.
 *
 * Un fallo aquí es irrelevante --se recalculará en la siguiente petición--, así
 * que nunca debe tumbar la página.
 */
export function guardarEnCache(
  cache: Cache,
  clave: string,
  respuesta: Response,
  ctx?: Contexto,
): void {
  const escritura = cache.put(clave, respuesta).catch(() => {});
  // Sin `waitUntil`, el runtime puede cancelar la escritura al devolver la
  // respuesta y la caché no se llenaría nunca.
  if (ctx) ctx.waitUntil(escritura);
}

/** Respuesta lista para guardar un objeto derivado en la Cache API. */
export function respuestaDeDatos(valor: unknown, ttl: number): Response {
  return new Response(JSON.stringify(valor), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  });
}
