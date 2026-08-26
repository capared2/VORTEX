import type { APIRoute } from "astro";
import { Memoria, TTL } from "../../lib/cache";

/**
 * Proxy de imágenes.
 *
 * Las fotos las alojan los sitios de los que se recogió cada noticia. Pintarlas
 * con su URL original tendría tres efectos, todos indeseables: cada `<img src>`
 * diría de dónde salió la noticia, se cargarían sus servidores, y se les
 * filtraría el referer de nuestros lectores. Aquí se sirven por nuestro propio
 * dominio: la página no nombra ni un host que no sea el suyo.
 *
 * Un proxy así no puede quedarse abierto, o cualquiera podría servir lo que
 * quisiera desde este dominio. Se cierra por tres sitios:
 *
 *  - el host tiene que estar entre los que el scraper publica en
 *    `imagenes.json`, que son los que de verdad aparecen en el dataset;
 *  - la respuesta tiene que declararse como imagen;
 *  - y no puede pasar de un tamaño razonable.
 */

const BASE = (
  import.meta.env.DATASET_BASE_URL ||
  "https://raw.githubusercontent.com/capared2/neurolink/main/data"
).replace(/\/+$/, "");

/** 8 MB: por encima de eso no es la foto de una noticia. */
const TAMANO_MAXIMO = 8 * 1024 * 1024;

const permitidos = new Memoria<string[]>(1);

async function hostsPermitidos(): Promise<string[]> {
  const guardado = permitidos.leer("hosts");
  if (guardado !== undefined) return guardado;

  try {
    const respuesta = await fetch(`${BASE}/imagenes.json`, {
      cf: { cacheTtl: TTL.lookup, cacheEverything: true },
    } as RequestInit);
    if (!respuesta.ok) return [];
    const contenido = (await respuesta.json()) as { hosts?: string[] };
    const hosts = Array.isArray(contenido.hosts) ? contenido.hosts : [];
    permitidos.guardar("hosts", hosts, TTL.lookup);
    return hosts;
  } catch {
    return [];
  }
}

/** Deshace el testigo base64url que viaja en el dataset. */
function decodificar(testigo: string): string | null {
  try {
    const relleno = "=".repeat((4 - (testigo.length % 4)) % 4);
    const binario = atob(testigo.replace(/-/g, "+").replace(/_/g, "/") + relleno);
    const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Respuesta vacía para una imagen que no se puede servir.
 *
 * El código importa: sin distinguirlos, un host fuera de la lista, una foto
 * que ya no existe y un rechazo del origen se ven exactamente igual desde
 * fuera, y no hay forma de saber si lo que falla es la configuración o la
 * red. El motivo va además en una cabecera propia.
 */
const vacia = (estado: number, motivo: string) =>
  new Response(null, {
    status: estado,
    headers: {
      // Una imagen que falla lo va a seguir haciendo: cachear el fallo evita
      // repetir la subpetición en cada visita.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Img": motivo,
    },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const testigo = params.testigo;
  if (!testigo) return vacia(404, "sin-testigo");

  const crudo = decodificar(testigo);
  if (!crudo) return vacia(400, "testigo-ilegible");

  let destino: URL;
  try {
    destino = new URL(crudo);
  } catch {
    return vacia(400, "url-invalida");
  }
  if (destino.protocol !== "https:" && destino.protocol !== "http:") {
    return vacia(400, "protocolo-no-permitido");
  }

  const hosts = await hostsPermitidos();
  if (!hosts.length) return vacia(503, "lista-de-hosts-no-disponible");
  if (!hosts.includes(destino.hostname.toLowerCase())) return vacia(403, "host-no-permitido");

  try {
    const origen = await fetch(destino.toString(), {
      // `manual` para no seguir una redirección a un host que no está en la
      // lista: sería la forma más fácil de saltársela.
      redirect: "manual",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Sin referer: los lectores de este sitio no tienen por qué aparecer
        // en las estadísticas de nadie.
        "User-Agent": "Mozilla/5.0 (compatible; GigantumImages/1.0)",
      },
      cf: { cacheTtl: TTL.imagen, cacheEverything: true },
    } as RequestInit);

    // La foto ya no existe es un caso distinto de que el origen nos rechace:
    // lo primero es normal en un archivo viejo, lo segundo hay que mirarlo.
    if (origen.status === 404 || origen.status === 410) return vacia(404, "no-existe-en-origen");
    if (!origen.ok) return vacia(502, `origen-${origen.status}`);
    if (!origen.body) return vacia(502, "origen-sin-cuerpo");

    const tipo = origen.headers.get("Content-Type") ?? "";
    if (!tipo.startsWith("image/")) return vacia(415, "no-es-una-imagen");

    const largo = Number(origen.headers.get("Content-Length") ?? 0);
    if (largo > TAMANO_MAXIMO) return vacia(413, "demasiado-grande");

    const cabeceras = new Headers({
      "Content-Type": tipo,
      "Cache-Control": `public, max-age=${TTL.imagen}, s-maxage=${TTL.imagen}, immutable`,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    if (largo) cabeceras.set("Content-Length", String(largo));

    // El cuerpo se pasa tal cual: nada de leerlo en memoria, que gastaría CPU
    // y memoria del isolate para nada.
    return new Response(request.method === "HEAD" ? null : origen.body, { headers: cabeceras });
  } catch {
    return vacia(504, "el-origen-no-responde");
  }
};

export const HEAD = GET;
