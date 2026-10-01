/*
 * Service worker de Gigantum.net.
 *
 * Hace una sola cosa: si se abre el sitio sin conexión --lo normal en una
 * aplicación instalada, que se abre desde la pantalla de inicio en el metro--
 * enseña una página propia en vez del dinosaurio del navegador.
 *
 * No guarda páginas ni datos a propósito. El HTML ya lo cachea el edge de
 * Cloudflare y se renueva solo; una segunda caché aquí serviría noticias
 * viejas y habría que pensar cuándo tirarla. Tampoco toca las peticiones que
 * no son de navegación (imágenes, anuncios, analítica): pasan como si no
 * estuviera.
 */
const CACHE = "gigantum-offline-v1";
// Sin `.html`: Cloudflare sirve los HTML estáticos sin extensión y redirige
// la otra forma. Una respuesta redirigida no vale para contestar a una
// navegación, así que se guarda ya la definitiva.
const SIN_CONEXION = "/offline";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(SIN_CONEXION, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // La precarga de navegación pide la página en paralelo con el arranque
      // del worker, así que tenerlo delante no la retrasa.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const claves = await caches.keys();
      await Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;

  evento.respondWith(
    (async () => {
      try {
        const precargada = await evento.preloadResponse;
        if (precargada) return precargada;
        return await fetch(evento.request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(SIN_CONEXION)) ?? Response.error();
      }
    })(),
  );
});
