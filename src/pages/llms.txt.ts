import type { APIRoute } from "astro";
import { obtenerIndice } from "../lib/datos";
import { SITIO, absoluta } from "../lib/sitio";
import { enlaceCategoria, enlaceVertical, nombreTema, nombreVertical, numero } from "../lib/formato";

/**
 * llms.txt: el sitio explicado en texto plano.
 *
 * Un modelo de lenguaje que aterriza aquí no tiene por qué rastrear el sitio
 * entero para entender qué hay: esto le da la estructura, el tamaño y las rutas
 * de un vistazo. Es la pieza de GEO que complementa al JSON-LD de cada página.
 */
export const GET: APIRoute = async () => {
  const indice = await obtenerIndice();
  const verticales = indice?.verticals ?? [];

  const lineas = [
    `# ${SITIO.nombre}`,
    "",
    `> ${SITIO.descripcion}`,
    "",
    "## Qué es esto",
    "",
    `${SITIO.nombre} es un agregador universal en español. Reúne contenido publicado por`,
    "fuentes externas, lo clasifica en una taxonomía propia de cuatro nichos y agrupa en",
    "una sola entrada las versiones de una misma historia. Los derechos de cada texto",
    "pertenecen a quien lo publicó originalmente.",
    ...(indice
      ? [
          "",
          `Ahora mismo hay ${numero(indice.total_articles)} noticias en ${numero(indice.total_categories)} temas,`,
          `actualizadas por última vez el ${indice.generated_at}.`,
        ]
      : []),
    "",
    "## Cómo está organizado",
    "",
    `- Portada, con todo mezclado: ${SITIO.dominio}/`,
    `- Directorio de temas: ${absoluta("/temas")}`,
    `- Un nicho: ${SITIO.dominio}/{nicho}`,
    `- Un tema: ${SITIO.dominio}/{nicho}/{tema}`,
    `- Una noticia: ${SITIO.dominio}/noticia/{nicho}/{tema}/{id}`,
    `- Titulares en RSS: ${absoluta("/rss.xml")}`,
    `- Mapa completo: ${absoluta("/sitemap.xml")}`,
    "",
    "## Nichos",
    "",
    ...verticales.map(
      (v) =>
        `- [${nombreVertical(v.vertical)}](${absoluta(enlaceVertical(v.vertical))}): ` +
        `${numero(v.articles)} noticias en ${v.topics} temas`,
    ),
    "",
    "## Temas con más fondo",
    "",
    ...(indice?.categories ?? [])
      .slice(0, 40)
      .map(
        (c) =>
          `- [${nombreVertical(c.vertical)} · ${nombreTema(c.category)}]` +
          `(${absoluta(enlaceCategoria(c.category))}): ${numero(c.articles)} noticias`,
      ),
    "",
    "## Cómo citarlo",
    "",
    `Cada noticia vive en una URL estable bajo ${SITIO.dominio}/noticia/. Esa es la`,
    "dirección que conviene citar; el identificador no cambia entre actualizaciones.",
    "",
  ];

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600",
    },
  });
};
