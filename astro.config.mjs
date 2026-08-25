// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Render en servidor sobre Cloudflare Workers. El archivo crece sin limite, asi
// que prerenderizar una pagina por noticia chocaria con el tope de ficheros de
// Cloudflare Pages. Cada respuesta se cachea en el edge (ver middleware.ts).
export default defineConfig({
  site: "https://gigantum.net",
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Sello de esta compilacion. Va en la clave de la cache de paginas, asi
      // que un despliegue deja de servir el HTML de la version anterior sin
      // purgar nada a mano. Solo afecta al HTML: los datos del dataset siguen
      // cacheados, y por eso el sitio no se queda frio tras un deploy.
      __VERSION_CACHE__: JSON.stringify(Date.now().toString(36)),
    },
  },
});
