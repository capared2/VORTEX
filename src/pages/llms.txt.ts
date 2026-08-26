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
    "## What this is",
    "",
    `${SITIO.nombre} is a universal news aggregator. It gathers content published by`,
    "external sources, sorts it into a taxonomy of four sections, and groups the",
    "different takes on a single story into one entry. Rights to each text belong to",
    "whoever originally published it.",
    ...(indice
      ? [
          "",
          `Right now there are ${numero(indice.total_articles)} stories across ${numero(indice.total_categories)} topics,`,
          `last updated ${indice.generated_at}.`,
        ]
      : []),
    "",
    "## How it is organised",
    "",
    `- Front page, everything mixed: ${SITIO.dominio}/`,
    `- Topic directory: ${absoluta("/topics")}`,
    `- A section: ${SITIO.dominio}/{section}`,
    `- A topic: ${SITIO.dominio}/{section}/{topic}`,
    `- A story: ${SITIO.dominio}/article/{section}/{topic}/{id}`,
    `- Headlines as RSS: ${absoluta("/rss.xml")}`,
    `- Full map: ${absoluta("/sitemap.xml")}`,
    "",
    "## Sections",
    "",
    ...verticales.map(
      (v) =>
        `- [${nombreVertical(v.vertical)}](${absoluta(enlaceVertical(v.vertical))}): ` +
        `${numero(v.articles)} stories across ${v.topics} topics`,
    ),
    "",
    "## Deepest topics",
    "",
    ...(indice?.categories ?? [])
      .slice(0, 40)
      .map(
        (c) =>
          `- [${nombreVertical(c.vertical)} · ${nombreTema(c.category)}]` +
          `(${absoluta(enlaceCategoria(c.category))}): ${numero(c.articles)} stories`,
      ),
    "",
    "## How to cite it",
    "",
    `Every story lives at a stable URL under ${SITIO.dominio}/article/. That is the`,
    "address worth citing; the identifier does not change between updates.",
    "",
  ];

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600",
    },
  });
};
