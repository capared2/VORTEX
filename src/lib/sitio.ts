/** Identidad del sitio, en un solo lugar. */
export const SITIO = {
  nombre: "Gigantum",
  dominio: "https://gigantum.net",
  titulo: "Gigantum · Toda la actualidad en un solo sitio",
  lema: "Un solo río de noticias",
  descripcion:
    "Agregador universal: noticias, deportes, videojuegos y tecnología reunidos y " +
    "ordenados en un mismo lugar, agrupados por historia y actualizados cada pocas horas.",
  idioma: "es",
  locale: "es_ES",
  pais: "ES",
  zona: "Europe/Madrid",
} as const;

/**
 * Qué se enseña de cada noticia.
 *
 * `true` publica el texto completo. `false` deja solo la entradilla y los
 * primeros párrafos, con el resto recortado. Es un interruptor y no una
 * decisión escrita en el código porque la respuesta correcta depende de con
 * qué se quiera vivir: el texto íntegro de una noticia ajena es lo que más
 * papeletas da para una reclamación de derechos de autor.
 */
export const MOSTRAR_CUERPO_COMPLETO = true;

/** Párrafos que se enseñan cuando el cuerpo completo está desactivado. */
export const PARRAFOS_DE_MUESTRA = 3;

/** Convierte una ruta del sitio en URL absoluta, que es lo que piden los buscadores. */
export function absoluta(ruta: string): string {
  return new URL(ruta, SITIO.dominio).href;
}
