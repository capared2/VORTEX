import type { EntradaCategoria, Historia, Indice, Noticia, Tarjeta } from "./types";
import { MOSTRAR_CUERPO_COMPLETO, SITIO, absoluta } from "./sitio";
import {
  enlaceCategoria,
  enlaceNoticia,
  enlaceVertical,
  nombreCategoria,
  nombreTema,
  nombreVertical,
  recortar,
} from "./formato";

/**
 * Datos estructurados del sitio.
 *
 * Van tres públicos a la vez y no siempre quieren lo mismo:
 *
 * - **SEO**: buscadores clásicos. Necesitan `NewsArticle`, `BreadcrumbList` e
 *   `ItemList` para entender qué es cada página y cómo se relacionan.
 * - **AEO**: asistentes de voz y respuestas directas. De ahí `speakable`, que
 *   dice qué leer en alto, y descripciones que se sostienen solas.
 * - **GEO**: buscadores generativos. Citan mejor lo que pueden resumir sin
 *   rastrear: por eso el grafo lleva `about`, `mentions` con las entidades de
 *   la noticia y, cuando se publica el texto completo, también `articleBody`.
 *
 * Todo se sirve en un único `@graph` con `@id` cruzados, que es como conviene:
 * un solo bloque, sin repetir la organización en cada trozo.
 */

/** El sitio como entidad. Lo consultan buscadores y modelos de lenguaje. */
export function organizacion() {
  return {
    "@type": "Organization",
    "@id": absoluta("/#organizacion"),
    name: SITIO.nombre,
    alternateName: "Gigantum News",
    url: SITIO.dominio,
    description: SITIO.descripcion,
    slogan: SITIO.lema,
    logo: {
      "@type": "ImageObject",
      "@id": absoluta("/#logo"),
      url: absoluta("/logo.svg"),
      width: 512,
      height: 512,
    },
    image: { "@id": absoluta("/#logo") },
  };
}

export function sitioWeb() {
  return {
    "@type": "WebSite",
    "@id": absoluta("/#sitio"),
    url: SITIO.dominio,
    name: SITIO.nombre,
    description: SITIO.descripcion,
    inLanguage: SITIO.idioma,
    publisher: { "@id": absoluta("/#organizacion") },
    // Habilita la caja de búsqueda en los resultados de Google.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluta("/buscar?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function migas(pasos: { nombre: string; ruta: string }[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluta(pasos[pasos.length - 1]?.ruta ?? "/")}#migas`,
    itemListElement: pasos.map((paso, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: paso.nombre,
      item: absoluta(paso.ruta),
    })),
  };
}

/** Migas derivadas de la categoría: "Inicio › Deportes › Fútbol". */
export function migasDeCategoria(clave: string) {
  const pasos = [{ nombre: "Inicio", ruta: "/" }];
  const partes = clave.split("/");
  for (let i = 0; i < partes.length; i++) {
    const trozo = partes.slice(0, i + 1).join("/");
    pasos.push({
      nombre: i === 0 ? nombreVertical(partes[0]!) : nombreTema(trozo),
      ruta: i === 0 ? enlaceVertical(partes[0]!) : enlaceCategoria(trozo),
    });
  }
  return migas(pasos);
}

/** Las etiquetas de una noticia, como entidades que la máquina puede enlazar. */
function entidades(etiquetas: string[]) {
  return etiquetas.slice(0, 12).map((nombre) => ({ "@type": "Thing", name: nombre }));
}

export function noticiaJsonLd(noticia: Noticia, imagen: string | null) {
  const url = absoluta(enlaceNoticia(noticia.category, noticia.id));
  const descripcion = noticia.summary || noticia.standfirst || recortar(noticia.body, 200);

  return {
    "@type": "NewsArticle",
    "@id": `${url}#noticia`,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": absoluta("/#sitio") },
    // Google descarta los titulares de más de 110 caracteres.
    headline: recortar(noticia.title, 110),
    alternativeHeadline: noticia.standfirst || undefined,
    description: descripcion || undefined,
    articleSection: nombreCategoria(noticia.category),
    inLanguage: noticia.language || SITIO.idioma,
    datePublished: noticia.published_at || undefined,
    dateModified: noticia.modified_at || noticia.published_at || undefined,
    wordCount: noticia.word_count || undefined,
    keywords: noticia.tags?.length ? noticia.tags.slice(0, 15).join(", ") : undefined,
    about: { "@type": "Thing", name: nombreTema(noticia.category) },
    mentions: noticia.tags?.length ? entidades(noticia.tags) : undefined,
    image: imagen ? [absoluta(imagen)] : undefined,
    thumbnailUrl: imagen ? absoluta(imagen) : undefined,
    author: { "@id": absoluta("/#organizacion") },
    publisher: { "@id": absoluta("/#organizacion") },
    isAccessibleForFree: true,
    // Un buscador generativo cita mejor lo que puede leer sin rastrear la
    // página entera. Solo se incluye si el sitio publica el texto completo:
    // de lo contrario prometería en los datos algo que la página no enseña.
    articleBody: MOSTRAR_CUERPO_COMPLETO && noticia.body ? noticia.body : undefined,
    // Para asistentes de voz: qué leer en alto si alguien pregunta por esto.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".entradilla"],
    },
  };
}

/** Una lista ordenada de noticias: así se entienden portadas y secciones. */
export function listado(articulos: (Tarjeta | Noticia | Historia)[], nombre: string) {
  const listados = articulos.slice(0, 30);
  return {
    "@type": "ItemList",
    name: nombre,
    numberOfItems: listados.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: listados.map((a, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      url: absoluta(enlaceNoticia(a.category, a.id)),
      name: a.title,
    })),
  };
}

/** Envuelve los bloques en un solo @graph, que es como conviene servirlos. */
export function grafo(bloques: object[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": bloques });
}

// --- Grafos listos para cada tipo de página --------------------------------

export function grafoPortada(historias: Historia[], indice: Indice | null) {
  return [
    organizacion(),
    sitioWeb(),
    {
      "@type": "CollectionPage",
      "@id": absoluta("/#portada"),
      url: SITIO.dominio,
      name: SITIO.titulo,
      description: SITIO.descripcion,
      inLanguage: SITIO.idioma,
      isPartOf: { "@id": absoluta("/#sitio") },
      dateModified: indice?.generated_at,
      about: (indice?.verticals ?? []).map((v) => ({
        "@type": "Thing",
        name: nombreVertical(v.vertical),
      })),
      mainEntity: listado(historias, "Lo último, de todos los nichos"),
    },
  ];
}

export function grafoVertical(
  vertical: string,
  articulos: Noticia[],
  temas: EntradaCategoria[],
  pagina: number,
) {
  const nombre = nombreVertical(vertical);
  const url = absoluta(enlaceVertical(vertical, pagina));
  return [
    organizacion(),
    sitioWeb(),
    migas([{ nombre: "Inicio", ruta: "/" }, { nombre, ruta: enlaceVertical(vertical) }]),
    {
      "@type": "CollectionPage",
      "@id": `${url}#coleccion`,
      url,
      name: `${nombre}: últimas noticias`,
      description: `Todo lo de ${nombre.toLowerCase()} reunido y ordenado en ${SITIO.nombre}.`,
      inLanguage: SITIO.idioma,
      isPartOf: { "@id": absoluta("/#sitio") },
      about: { "@type": "Thing", name: nombre },
      hasPart: temas.slice(0, 30).map((t) => ({
        "@type": "CollectionPage",
        url: absoluta(enlaceCategoria(t.category)),
        name: nombreTema(t.category),
      })),
      mainEntity: listado(articulos, `Noticias de ${nombre}`),
    },
  ];
}

export function grafoTema(clave: string, articulos: Noticia[], pagina: number) {
  const nombre = nombreTema(clave);
  const url = absoluta(enlaceCategoria(clave, pagina));
  return [
    organizacion(),
    sitioWeb(),
    migasDeCategoria(clave),
    {
      "@type": "CollectionPage",
      "@id": `${url}#coleccion`,
      url,
      name: `${nombre}: últimas noticias`,
      description: `Noticias de ${nombre.toLowerCase()} reunidas en ${SITIO.nombre}.`,
      inLanguage: SITIO.idioma,
      isPartOf: { "@id": absoluta("/#sitio") },
      about: { "@type": "Thing", name: nombre },
      mainEntity: listado(articulos, `Noticias de ${nombre}`),
    },
  ];
}

export function grafoTemas(indice: Indice | null) {
  return [
    organizacion(),
    sitioWeb(),
    migas([{ nombre: "Inicio", ruta: "/" }, { nombre: "Temas", ruta: "/temas" }]),
    {
      "@type": "CollectionPage",
      "@id": absoluta("/temas#coleccion"),
      url: absoluta("/temas"),
      name: "Todos los temas",
      description: `Los ${indice?.total_categories ?? 0} temas en los que se organiza ${SITIO.nombre}.`,
      inLanguage: SITIO.idioma,
      isPartOf: { "@id": absoluta("/#sitio") },
      hasPart: (indice?.categories ?? []).slice(0, 80).map((c) => ({
        "@type": "CollectionPage",
        url: absoluta(enlaceCategoria(c.category)),
        name: nombreCategoria(c.category),
      })),
    },
  ];
}

export function grafoNoticia(noticia: Noticia, imagen: string | null) {
  const pasos = [{ nombre: "Inicio", ruta: "/" }];
  const partes = noticia.category.split("/");
  pasos.push({ nombre: nombreVertical(partes[0]!), ruta: enlaceVertical(partes[0]!) });
  if (partes.length > 1) {
    pasos.push({ nombre: nombreTema(noticia.category), ruta: enlaceCategoria(noticia.category) });
  }
  pasos.push({
    nombre: recortar(noticia.title, 60),
    ruta: enlaceNoticia(noticia.category, noticia.id),
  });

  return [organizacion(), sitioWeb(), migas(pasos), noticiaJsonLd(noticia, imagen)];
}
