import { SITIO } from "./sitio";

const FECHA = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: SITIO.zona,
});

const FECHA_HORA = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SITIO.zona,
});

export function fecha(iso: string | null, conHora = false): string {
  if (!iso) return "";
  const valor = new Date(iso);
  if (Number.isNaN(valor.getTime())) return "";
  return (conHora ? FECHA_HORA : FECHA).format(valor);
}

/** "3h ago", "yesterday"… para las tarjetas del río. */
export function haceCuanto(iso: string | null): string {
  if (!iso) return "";
  const valor = new Date(iso).getTime();
  if (Number.isNaN(valor)) return "";

  const minutos = Math.round((Date.now() - valor) / 60000);
  if (minutos < 1) return "just now";
  if (minutos < 60) return `${minutos}m ago`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas}h ago`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return "yesterday";
  if (dias < 30) return `${dias} days ago`;
  return fecha(iso);
}

/** "Tuesday, August 25, 2026" para la cabecera. */
export function fechaLarga(valor: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: SITIO.zona,
  }).format(valor);
}

export function numero(valor: number): string {
  return new Intl.NumberFormat("en-US").format(valor);
}

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

export const VERTICALES: Record<string, string> = {
  news: "News",
  sports: "Sports",
  gaming: "Gaming",
  tech: "Tech",
};

/**
 * Nombres de tema que no salen bien de capitalizar el slug.
 *
 * El dataset ya trae `topic_name` para cada noticia, así que esto solo hace
 * falta cuando se parte de la clave a secas: navegación, migas y sitemaps.
 */
const NOMBRES: Record<string, string> = {
  soccer: "Soccer",
  basketball: "Basketball",
  nfl: "NFL",
  baseball: "Baseball",
  tennis: "Tennis",
  motorsport: "Motorsport",
  golf: "Golf",
  cycling: "Cycling",
  combat: "Combat sports",
  cricket: "Cricket",
  rugby: "Rugby",
  olympics: "Olympics",
  more: "More sport",
  games: "Video games",
  esports: "Esports",
  streaming: "Streaming",
  ai: "Artificial intelligence",
  gadgets: "Gadgets",
  companies: "Companies",
  science: "Science & space",
  software: "Software & security",
  crypto: "Crypto",
  world: "World",
  politics: "Politics",
  business: "Business",
  society: "Society",
  health: "Health",
  culture: "Culture",
};

const MINUSCULAS = new Set(["and", "of", "the", "in", "on", "for", "to", "a", "an"]);

function titulo(texto: string): string {
  if (NOMBRES[texto]) return NOMBRES[texto]!;
  if (VERTICALES[texto]) return VERTICALES[texto]!;
  return texto
    .split("-")
    .map((palabra, indice) =>
      indice > 0 && MINUSCULAS.has(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
    )
    .join(" ");
}

/** "deportes/futbol" → "Deportes · Fútbol" */
export function nombreCategoria(clave: string): string {
  return clave.split("/").map(titulo).join(" · ");
}

/** Último tramo de la categoría, para etiquetas cortas. */
export function nombreTema(clave: string): string {
  const partes = clave.split("/");
  return titulo(partes[partes.length - 1]!);
}

export function nombreVertical(clave: string): string {
  return VERTICALES[clave] ?? titulo(clave);
}

// ---------------------------------------------------------------------------
// Enlaces
//
// Todos son rutas de este sitio. No hay ni un enlace que salga fuera: ni a los
// medios de origen ni a ningún otro dominio.
// ---------------------------------------------------------------------------

export function enlaceNoticia(categoria: string, id: string): string {
  return `/article/${categoria}/${id}`;
}

export function enlaceVertical(vertical: string, pagina = 1): string {
  return pagina > 1 ? `/${vertical}?p=${pagina}` : `/${vertical}`;
}

export function enlaceCategoria(clave: string, pagina = 1): string {
  return pagina > 1 ? `/${clave}?p=${pagina}` : `/${clave}`;
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * El color de un tema, como variable CSS.
 *
 * Devuelve `var()` encadenados en vez de un hexadecimal porque el tema oscuro
 * tiene que poder aclararlos: con un color fijo desde aquí, lo que se ve bien
 * sobre blanco se apaga sobre negro. La cadena además degrada sola --tema,
 * nicho, marca--, así que un tema nuevo sale con el color de su nicho hasta
 * que alguien le dé el suyo.
 */
export function colorCategoria(clave: string): string {
  const [vertical, tema] = clave.split("/");
  return `var(--c-${tema ?? vertical}, var(--v-${vertical}, var(--color-marca)))`;
}

export function colorVertical(vertical: string): string {
  return `var(--v-${vertical}, var(--color-marca))`;
}

/** Recorta un texto sin partir una palabra por la mitad. */
export function recortar(texto: string, largo: number): string {
  if (!texto || texto.length <= largo) return texto ?? "";
  const cortado = texto.slice(0, largo);
  const espacio = cortado.lastIndexOf(" ");
  return `${(espacio > largo * 0.6 ? cortado.slice(0, espacio) : cortado).trimEnd()}…`;
}

/**
 * La imagen de una noticia, como ruta de este sitio.
 *
 * En `latest.json` y `portada.json` el scraper ya la deja resuelta, pero el
 * archivo completo de una noticia guarda la URL original: si se pintara tal
 * cual, cada `<img src>` diría de dónde salió la noticia, cargaría los
 * servidores del medio y le filtraría el referer de nuestros lectores. Aquí se
 * convierte al mismo testigo que resuelve `/img/`.
 */
export function rutaImagen(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/img/")) return url;
  try {
    const bytes = new TextEncoder().encode(url);
    let binario = "";
    for (const byte of bytes) binario += String.fromCharCode(byte);
    const testigo = btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `/img/${testigo}`;
  } catch {
    return null;
  }
}

/**
 * Marca el número de página en un título o una descripción.
 *
 * Sin esto, `/sports`, `/sports?p=2` y `/sports?p=9` se declaran con el mismo
 * `<title>` y la misma descripción palabra por palabra. Cada una es canónica
 * de sí misma --que es lo correcto-- así que el buscador acaba con nueve
 * páginas indexadas que dicen lo mismo, y se queda con una.
 */
export function conPagina(texto: string, pagina: number): string {
  return pagina > 1 ? `${texto} · Page ${pagina}` : texto;
}
