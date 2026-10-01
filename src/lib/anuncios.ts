/**
 * Catálogo de unidades publicitarias.
 *
 * Cada unidad se pide con la global `atOptions`, que todos los `invoke.js`
 * leen al ejecutarse. Por eso cada banner se pinta dentro de su propio iframe:
 * si compartieran página se pisarían la variable y acabarían mostrando todos
 * la misma unidad, o ninguna.
 */
export interface Unidad {
  key: string;
  ancho: number;
  alto: number;
  /** Anchura mínima de pantalla para usar esta unidad. */
  desde: number;
}

/**
 * Cada hueco declara sus variantes de mayor a menor. En el navegador se elige
 * una sola según la pantalla: cargar varias y esconder las que sobran contaría
 * impresiones que nadie ve, y eso es tráfico inválido.
 */
export const HUECOS: Record<string, Unidad[]> = {
  // Franja ancha: portadilla de sección, separadores entre bloques.
  horizontal: [
    { key: "cf9ae51bc30664c34f957d9c82e5dde7", ancho: 728, alto: 90, desde: 768 },
    { key: "0a38f90ae18a0afdf65e1d58f9921443", ancho: 320, alto: 50, desde: 0 },
  ],
  // Franja estrecha, para huecos con menos aire.
  franja: [
    { key: "9e00c9fba97d4475ae18ccda449d0f1e", ancho: 468, alto: 60, desde: 520 },
    { key: "0a38f90ae18a0afdf65e1d58f9921443", ancho: 320, alto: 50, desde: 0 },
  ],
  // Rectángulo: encaja tanto en la rejilla de tarjetas como dentro del texto.
  rectangulo: [{ key: "2bb11b4d274278260ccb9145d9d7bca1", ancho: 300, alto: 250, desde: 0 }],
  // Rascacielos de la barra lateral, que solo existe a partir de `lg`. Por
  // debajo no hay unidad y el hueco se apaga solo, que es lo que se quiere:
  // en móvil la barra pasa a ir debajo del contenido y ahí no pinta nada.
  vertical: [{ key: "a683ddcfe8cb17b875f61f32444dbea3", ancho: 160, alto: 600, desde: 1024 }],
  // El segundo de la barra, más corto: dos rascacielos iguales en la misma
  // columna cansan la vista, y este además es otra unidad distinta.
  columna: [{ key: "b6a6ee9f3acdce847dd3299bbc777a6d", ancho: 160, alto: 300, desde: 1024 }],
};

/** Unidad nativa: se integra con el contenido y solo admite una por página. */
export const NATIVO = {
  id: "container-63e25977e72ff50a8d0f08620d462edd",
  script: "https://pl31044382.profitableratecpmnetwork.com/63e25977e72ff50a8d0f08620d462edd/invoke.js",
};

/**
 * La barra social. No tiene hueco en el HTML: se inyecta una vez por página y
 * se coloca donde decide la red. Al no ocupar sitio en el documento no mueve
 * el contenido, así que se carga con el resto y no espera al scroll.
 */
export const SUELTO = "https://pl31044383.profitableratecpmnetwork.com/62/12/16/62121633365e3b385b6e23f28f0f3e36.js";

/**
 * La unidad discreta. Tampoco tiene hueco, pero esta se lleva con cuidado
 * para que no estorbe: no se pide hasta que el visitante hace algo en la
 * página (mover, tocar, pulsar una tecla) y el navegador queda libre, y a
 * cada visitante se le pide como mucho una vez cada `cadaHoras`. Así nunca se
 * lleva el primer clic de nadie, no compite con la carga y no se repite
 * página tras página.
 */
export const DISCRETO = {
  script: "https://pl31607483.profitableratecpmnetwork.com/5c/4b/6b/5c4b6b3ba9c648c31b51ffd2ef19ca92.js",
  cadaHoras: 6,
};

/**
 * Enlace directo de la red. No se dispara solo ni se cuelga de otros enlaces:
 * es un enlace normal, rotulado como patrocinado, que solo abre quien lo pulsa.
 */
export const ENLACE_PATROCINADO =
  "https://www.profitableratecpmnetwork.com/c42ufq3v?key=17d56bf790420b47d69c34b71fb3ad3b";

export const BASE_INVOKE = "https://www.highrevenueformat.com";

/** Altura que se reserva antes de cargar, para que nada salte al aparecer. */
export function altoReservado(hueco: string): number {
  const variantes = HUECOS[hueco] ?? [];
  return Math.max(...variantes.map((v) => v.alto), 0);
}
