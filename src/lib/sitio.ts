/** Identidad del sitio, en un solo lugar. */
export const SITIO = {
  nombre: "Gigantum.net",
  dominio: "https://gigantum.net",
  titulo: "Gigantum.net · Everything that matters, in one place",
  lema: "One river of news",
  descripcion:
    "A universal aggregator: news, sports, gaming and technology gathered and " +
    "sorted in one place, grouped by story and refreshed every couple of hours.",
  idioma: "en",
  locale: "en_US",
  pais: "US",
  zona: "America/New_York",
  /** Identificador de medición de Google Analytics (gtag.js). */
  analitica: "G-DGGMCMPQ13",
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
