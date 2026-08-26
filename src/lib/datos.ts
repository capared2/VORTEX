import type {
  ArchivoParte,
  EntradaCategoria,
  Indice,
  Lookup,
  Noticia,
  Portada,
  Tarjeta,
  Ultimas,
} from "./types";
import {
  CLAVE_DATOS,
  Memoria,
  TTL,
  cacheDelEdge,
  guardarEnCache,
  respuestaDeDatos,
  type Contexto,
} from "./cache";

/**
 * De dónde se lee el archivo.
 *
 * El dataset lo produce y versiona el repositorio del scraper
 * (capared2/neurolink); este sitio solo lo consume. GitHub lo sirve con
 * `max-age=300` y el scraper publica cada dos horas, así que las noticias
 * llegan frescas sin reconstruir ni desplegar nada.
 *
 * Se puede apuntar a otro sitio con DATASET_BASE_URL (otra rama, un fork o un
 * bucket propio).
 */
const BASE = (
  import.meta.env.DATASET_BASE_URL ||
  "https://raw.githubusercontent.com/capared2/neurolink/main/data"
).replace(/\/+$/, "");

/**
 * Ficheros pequeños y muy compartidos: index, portada, últimas y los lookup de
 * cada tema. Los piden prácticamente todas las páginas.
 */
const ligeros = new Memoria<unknown>(32);

/**
 * Archivos de noticias. Pesan hasta 1,3 MB ya parseados, así que el límite es
 * bajo a propósito: un isolate tiene 128 MB y no merece la pena arriesgarlos
 * por un histórico que casi nadie visita. Aun así cubre el caso que importa, el
 * rastreador que recorre seguidas las noticias de un mismo tema.
 */
const archivos = new Memoria<unknown>(4);

/**
 * Descarga un JSON del dataset reutilizando lo que ya se haya leído.
 *
 * `cf.cacheTtl` hace que la respuesta la sirva el edge de Cloudflare: cuando la
 * memoria del isolate falla, la subpetición casi nunca llega a salir a la red.
 */
async function leerJson<T>(ruta: string, ttl: number, memoria: Memoria<unknown>): Promise<T | null> {
  const memorizado = memoria.leer(ruta);
  if (memorizado !== undefined) return memorizado as T;

  try {
    const respuesta = await fetch(`${BASE}${ruta}`, {
      cf: { cacheTtl: ttl, cacheEverything: true },
    } as RequestInit);
    if (!respuesta.ok) return null;

    const valor = (await respuesta.json()) as T;
    memoria.guardar(ruta, valor, ttl);
    return valor;
  } catch {
    return null;
  }
}

export const obtenerIndice = () => leerJson<Indice>("/index.json", TTL.indice, ligeros);
export const obtenerPortada = () => leerJson<Portada>("/portada.json", TTL.indice, ligeros);
export const obtenerUltimas = () => leerJson<Ultimas>("/latest.json", TTL.indice, ligeros);

const obtenerParte = (categoria: string, parte: number) =>
  leerJson<ArchivoParte>(
    `/${categoria}/part-${String(parte).padStart(4, "0")}.json`,
    TTL.parte,
    archivos,
  );

/**
 * Deja una sola tarjeta por historia.
 *
 * Un listado en crudo trae una entrada por cada medio que haya contado algo,
 * así que sin esto la portada enseñaría cinco veces la misma noticia --que es
 * justo lo que un agregador tiene que evitar--. El scraper deja marcada cada
 * tarjeta con su historia, de modo que aquí basta con recorrer la lista una vez.
 */
export function porHistoria<T extends { id: string; story?: string }>(articulos: T[]): T[] {
  const vistas = new Set<string>();
  return articulos.filter((articulo) => {
    const clave = articulo.story ?? articulo.id;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/** Ordena de más reciente a más antigua. */
function porFecha<T extends { published_at: string | null }>(articulos: T[]): T[] {
  return [...articulos].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}

export interface Pagina {
  articulos: Noticia[];
  total: number;
  pagina: number;
  paginas: number;
}

/**
 * Una página de noticias de un tema.
 *
 * Los archivos se recorren del más reciente al más antiguo y solo se descargan
 * los que cubren la página pedida, de modo que el coste no depende del tamaño
 * total del histórico.
 */
export async function obtenerPaginaTema(
  categoria: EntradaCategoria,
  pagina: number,
  porPagina: number,
): Promise<Pagina> {
  const ficheros = [...categoria.files].reverse();
  const paginas = Math.max(1, Math.ceil(categoria.articles / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);

  const desde = (actual - 1) * porPagina;
  const hasta = desde + porPagina;

  const articulos: Noticia[] = [];
  let recorridos = 0;
  let inicioDelPrimero: number | null = null;

  for (const fichero of ficheros) {
    const fin = recorridos + fichero.count;
    const intersecta = fin > desde && recorridos < hasta;

    if (intersecta) {
      if (inicioDelPrimero === null) inicioDelPrimero = recorridos;
      const numero = Number(fichero.file.match(/part-(\d+)\.json$/)?.[1] ?? 1);
      const parte = await obtenerParte(categoria.category, numero);
      if (parte) articulos.push(...porFecha(parte.articles));
    }

    recorridos = fin;
    if (recorridos >= hasta) break;
  }

  const corte = desde - (inicioDelPrimero ?? 0);
  return {
    articulos: articulos.slice(corte, corte + porPagina),
    total: categoria.articles,
    pagina: actual,
    paginas,
  };
}

/**
 * Una página de un nicho entero, reuniendo lo de todos sus temas.
 *
 * Aquí es fácil pasarse de CPU: «noticias» puede tener quince temas, y bajarse
 * un archivo de cada uno son varios megabytes de JSON con un presupuesto de
 * 10 ms por invocación. Por eso se descarga solo el archivo más reciente de
 * cada tema --que es donde están sus noticias nuevas, lo único que puede entrar
 * en las primeras páginas--, empezando por los temas con más fondo, y se para
 * pronto: al menos MIN_TEMAS para que el nicho se vea como un agregado de
 * verdad, y como mucho MAX_FICHEROS.
 */
const MARGEN = 3;
const MIN_TEMAS = 3;
const MAX_FICHEROS = 5;

export async function obtenerPaginaVertical(
  temas: EntradaCategoria[],
  pagina: number,
  porPagina: number,
): Promise<Pagina> {
  const total = temas.reduce((suma, c) => suma + c.articles, 0);
  // Lo que se pide, acotado al fondo del nicho. Todavía no es la página que se
  // va a servir: cuántas hay de verdad no se sabe hasta ver qué se ha reunido.
  const pedida = Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(total / porPagina)));

  const necesarias = pedida * porPagina * MARGEN;
  const minimo = Math.min(temas.length, MIN_TEMAS);

  const candidatos = [...temas]
    .sort((a, b) => b.articles - a.articles)
    .map((c) => ({ categoria: c.category, fichero: c.files.at(-1) }))
    .filter((c): c is { categoria: string; fichero: { file: string; count: number } } =>
      c.fichero !== undefined,
    );

  const elegidos: typeof candidatos = [];
  let reunidas = 0;
  for (const candidato of candidatos) {
    if (elegidos.length >= MAX_FICHEROS) break;
    if (elegidos.length >= minimo && reunidas >= necesarias) break;
    elegidos.push(candidato);
    reunidas += candidato.fichero.count;
  }

  const lotes = await Promise.all(
    elegidos.map(({ categoria, fichero }) =>
      obtenerParte(categoria, Number(fichero.file.match(/part-(\d+)\.json$/)?.[1] ?? 1)),
    ),
  );

  const articulos = porFecha(lotes.flatMap((parte) => parte?.articles ?? []));

  // Cuántas páginas se pueden servir de verdad, que no son las que da el fondo
  // del nicho: aquí solo se descarga el archivo más reciente de unos pocos
  // temas. Sin acotar a esto, `/news?p=30` devolvía un listado vacío con un
  // 200, su propia canónica y `robots: index` --una página sin nada dentro
  // invitada a indexarse, y hay 250 así por nicho--. Se sirve la última con
  // contenido y la canónica apunta a ella, que es lo que ya hacía un tema.
  const paginas = Math.max(1, Math.ceil(articulos.length / porPagina));
  const actual = Math.min(pedida, paginas);
  const desde = (actual - 1) * porPagina;

  return {
    articulos: articulos.slice(desde, desde + porPagina),
    total,
    pagina: actual,
    paginas,
  };
}

/**
 * Una noticia concreta, resolviendo antes en qué archivo vive.
 *
 * El archivo que la contiene puede pesar más de un mega y llevarse casi 4 ms de
 * CPU en parsearse, para quedarse con una sola noticia de las cien que trae.
 * Por eso, una vez encontrada, se guarda suelta en la Cache API: la siguiente
 * visita lee unos pocos kilobytes en lugar del archivo entero, aunque el
 * isolate ya se haya reciclado.
 */
export async function obtenerNoticia(
  categoria: string,
  id: string,
  ctx?: Contexto,
): Promise<Noticia | null> {
  const cache = cacheDelEdge();
  const clave = `${CLAVE_DATOS}/articulo/${categoria}/${id}`;

  if (cache) {
    try {
      const guardada = await cache.match(clave);
      if (guardada) return (await guardada.json()) as Noticia;
    } catch {
      // Caché corrupta o ilegible: se resuelve por el camino largo.
    }
  }

  const lookup = await leerJson<Lookup>(`/${categoria}/lookup.json`, TTL.lookup, ligeros);
  const numero = lookup?.parts?.[id];
  if (!numero) return null;

  const parte = await obtenerParte(categoria, numero);
  const noticia = parte?.articles.find((articulo) => articulo.id === id) ?? null;

  if (noticia && cache) {
    guardarEnCache(cache, clave, respuestaDeDatos(noticia, TTL.articulo), ctx);
  }

  return noticia;
}

export interface ContextoDeNoticia {
  versiones: Tarjeta[];
  relacionadas: Tarjeta[];
}

/**
 * Lo que rodea a una noticia, en dos listas que no significan lo mismo.
 *
 * **Versiones** son la misma historia contada por otro sitio: otro enfoque,
 * otro titular, otra foto. No sobran ni son un duplicado que haya que tirar
 * --son justo lo que aporta un agregador--, pero tampoco pueden ir mezcladas
 * con las demás, o parecerían noticias distintas repetidas.
 *
 * **Relacionadas** es lo demás del mismo tema.
 */
export async function obtenerContexto(actual: Noticia, limite = 6): Promise<ContextoDeNoticia> {
  const [portada, ultimas] = await Promise.all([obtenerPortada(), obtenerUltimas()]);
  const tarjetas = ultimas?.articles ?? [];
  const porId = new Map(tarjetas.map((a) => [a.id, a]));

  const historia = portada?.stories.find(
    (h) => h.id === actual.id || h.also.some((otra) => otra.id === actual.id),
  );

  const versiones = historia
    ? [historia, ...historia.also]
        .filter((otra) => otra.id !== actual.id)
        .map((otra) => porId.get(otra.id))
        .filter((a): a is Tarjeta => a !== undefined)
    : [];

  const yaPuestas = new Set([actual.id, ...versiones.map((v) => v.id)]);

  const relacionadas = porHistoria(
    tarjetas.filter((a) => a.category === actual.category && !yaPuestas.has(a.id)),
  ).slice(0, limite);

  return { versiones: versiones.slice(0, limite), relacionadas };
}
