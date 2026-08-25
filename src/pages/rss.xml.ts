import type { APIRoute } from "astro";
import { obtenerPortada, obtenerUltimas } from "../lib/datos";
import { SITIO, absoluta } from "../lib/sitio";
import { enlaceNoticia, nombreCategoria } from "../lib/formato";

/** Escapa lo que va dentro de un nodo XML. Un `&` suelto invalida el feed entero. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function comoRfc822(iso: string | null): string {
  if (!iso) return "";
  const valor = new Date(iso);
  return Number.isNaN(valor.getTime()) ? "" : valor.toUTCString();
}

export const GET: APIRoute = async () => {
  // La portada primero: son historias ya agrupadas, así que el feed no repite
  // la misma noticia cinco veces. Si no está, se cae a lo último sin agrupar.
  const [portada, ultimas] = await Promise.all([obtenerPortada(), obtenerUltimas()]);
  const articulos = (portada?.stories ?? ultimas?.articles ?? []).slice(0, 60);

  const elementos = articulos
    .map((articulo) => {
      const url = absoluta(enlaceNoticia(articulo.category, articulo.id));
      const descripcion = articulo.standfirst || articulo.summary || "";
      const fecha = comoRfc822(articulo.published_at);
      return [
        "    <item>",
        `      <title>${escapar(articulo.title)}</title>`,
        `      <link>${escapar(url)}</link>`,
        `      <guid isPermaLink="true">${escapar(url)}</guid>`,
        descripcion ? `      <description>${escapar(descripcion)}</description>` : "",
        `      <category>${escapar(nombreCategoria(articulo.category))}</category>`,
        fecha ? `      <pubDate>${fecha}</pubDate>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const cuerpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapar(SITIO.nombre)}</title>
    <link>${SITIO.dominio}</link>
    <description>${escapar(SITIO.descripcion)}</description>
    <language>${SITIO.idioma}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${absoluta("/rss.xml")}" rel="self" type="application/rss+xml" />
${elementos}
  </channel>
</rss>
`;

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900",
    },
  });
};
