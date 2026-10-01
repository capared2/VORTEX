import type { APIRoute } from "astro";
import { SITIO } from "../lib/sitio";
import { enlaceVertical, nombreVertical } from "../lib/formato";

/**
 * Manifiesto de la aplicación web.
 *
 * Es lo que hace que el sitio se pueda instalar: Android ofrece añadirlo a la
 * pantalla de inicio y al abrirlo desde ahí no aparece la barra del navegador,
 * solo la del sitio. Se genera aquí y no como fichero suelto para que el
 * nombre y la descripción salgan de SITIO, como en el resto.
 *
 * Los iconos están en `public/icons`. Hay dos juegos porque cumplen papeles
 * distintos: los `any` llevan las esquinas redondeadas ya dibujadas, y el
 * `maskable` llena el cuadrado entero con el ancla en la zona segura, para que
 * Android lo recorte con la forma que use cada fabricante sin comerse nada.
 */
export const GET: APIRoute = () => {
  const manifiesto = {
    id: "/",
    name: SITIO.nombre,
    short_name: "Gigantum",
    description: SITIO.descripcion,
    lang: SITIO.idioma,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // El color del lienzo mientras arranca y el de la cabecera, para que la
    // pantalla de carga y la barra de estado empalmen con la primera página.
    background_color: "#f6f7fa",
    theme_color: "#ffffff",
    categories: ["news", "sports", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos al mantener pulsado el icono en la pantalla de inicio.
    shortcuts: [
      ...["news", "sports", "tech", "gaming"].map((clave) => ({
        name: nombreVertical(clave),
        url: enlaceVertical(clave),
      })),
      { name: "Search", url: "/search" },
    ],
  };

  return new Response(JSON.stringify(manifiesto), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
};
