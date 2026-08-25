import { SITIO } from "./sitio";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: SITIO.zona,
});

const FECHA_HORA = new Intl.DateTimeFormat("es-ES", {
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

/** "hace 3 h", "ayer"… para las tarjetas del río. */
export function haceCuanto(iso: string | null): string {
  if (!iso) return "";
  const valor = new Date(iso).getTime();
  if (Number.isNaN(valor)) return "";

  const minutos = Math.round((Date.now() - valor) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  return fecha(iso);
}

/** "jueves, 25 de agosto de 2026" con una sola mayúscula inicial. */
export function fechaLarga(valor: Date): string {
  const texto = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SITIO.zona,
  }).format(valor);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function numero(valor: number): string {
  return new Intl.NumberFormat("es-ES").format(valor);
}

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

export const VERTICALES: Record<string, string> = {
  noticias: "Noticias",
  deportes: "Deportes",
  gamer: "Gamer",
  tecnologia: "Tecnología",
};

/**
 * Nombres de tema que no salen bien de capitalizar el slug.
 *
 * El dataset ya trae `topic_name` para cada noticia, así que esto solo hace
 * falta cuando se parte de la clave a secas: navegación, migas y sitemaps.
 */
const NOMBRES: Record<string, string> = {
  futbol: "Fútbol",
  baloncesto: "Baloncesto",
  nfl: "NFL",
  beisbol: "Béisbol",
  tenis: "Tenis",
  motor: "Motor",
  golf: "Golf",
  ciclismo: "Ciclismo",
  combate: "Deportes de combate",
  cricket: "Cricket",
  rugby: "Rugby",
  olimpismo: "Olimpismo",
  otros: "Más deporte",
  juegos: "Videojuegos",
  esports: "eSports",
  streaming: "Streaming",
  ia: "Inteligencia artificial",
  gadgets: "Gadgets",
  empresas: "Empresas",
  ciencia: "Ciencia y espacio",
  software: "Software y seguridad",
  cripto: "Cripto",
  mundo: "Mundo",
  politica: "Política",
  economia: "Economía",
  sociedad: "Sociedad",
  salud: "Salud",
  cultura: "Cultura",
};

const MINUSCULAS = new Set(["y", "de", "del", "la", "el", "en", "los", "las", "a"]);

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
  return `/noticia/${categoria}/${id}`;
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
 * Un acento por nicho. Es lo que hace que un río en el que se mezcla todo
 * siga siendo legible: el color dice de qué va la noticia antes de leerla.
 */
const COLORES: Record<string, string> = {
  noticias: "#2f6df6",
  deportes: "#12a150",
  gamer: "#8b5cf6",
  tecnologia: "#0e9bb8",
};

export function colorVertical(vertical: string): string {
  return COLORES[vertical] ?? "var(--color-marca)";
}

export function colorCategoria(clave: string): string {
  return colorVertical(clave.split("/")[0]!);
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
