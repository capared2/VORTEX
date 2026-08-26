# VORTEX — el sitio de Gigantum

Frontend de [**gigantum.net**](https://gigantum.net): un agregador universal que
reúne en un solo río noticias, deportes, videojuegos y tecnología, agrupa las
distintas versiones de una misma historia y no repite ninguna.

Es un sitio Astro renderizado en servidor sobre **Cloudflare Workers**. No tiene
base de datos ni panel: lee por HTTP el dataset que publica el scraper
([capared2/neurolink](https://github.com/capared2/neurolink)), así que cuando
entran noticias nuevas aparecen solas, sin reconstruir ni desplegar nada.

## Cómo está organizado

```
/                                   el río: todo mezclado y agrupado por historia
/topics                             directorio de temas
/{seccion}                          news, sports, gaming, tech
/{seccion}/{tema}                   sports/soccer, tech/ai…
/article/{seccion}/{tema}/{id}      una noticia
/search?q=                          búsqueda sobre lo reciente
/img/{testigo}                      las fotos, servidas por este dominio
/rss.xml  /sitemap.xml  /robots.txt  /llms.txt
```

**El sitio está íntegramente en inglés**, porque la inmensa mayoría de lo que
recogen las fuentes lo está. Eso incluye las claves de la taxonomía y por tanto
las rutas: una web en inglés con URLs en español reparte mal la autoridad. Los
comentarios del código y este documento se quedan en español, que son para quien
lo mantiene y no para quien lo lee.

Las cuatro secciones cuelgan de la raíz a propósito: `gigantum.net/sports`
posiciona mejor que un prefijo intermedio, y las rutas estáticas (`/topics`,
`/search`, los sitemaps) tienen prioridad sobre la dinámica, así que no chocan.

## Tres decisiones que explican el resto del código

### 1. El sitio no dice de dónde sale nada

No aparece el nombre de ningún medio, no hay ni un enlace que salga del dominio
y ninguna ruta redirige fuera. Eso no se sostiene solo con no escribirlo en las
plantillas, porque la identidad del origen se filtra por sitios menos obvios:

- **El identificador de cada noticia** va en la URL pública. El scraper lo genera
  como un hash opaco en el que la fuente entra *dentro* del hash, no delante.
- **Las fotos** las alojan los sitios de origen. Pintarlas con su URL diría de
  dónde salió la noticia en cada `<img src>`, cargaría sus servidores y les
  filtraría el referer de nuestros lectores. Van por `/img/`, servidas desde
  este dominio.
- **Los ficheros de listados** (`latest.json`, `portada.json`) los deriva el
  scraper ya sin identidad del medio, y hay un test allí que lo comprueba.

El proxy de `/img/` no puede quedarse abierto, o cualquiera serviría lo que
quisiera desde este dominio. Se cierra por tres sitios: el host tiene que estar
entre los que el scraper publica en `imagenes.json`, la respuesta tiene que
declararse como imagen, y no puede pasar de 8 MB.

> Publicar el texto íntegro de noticias ajenas sin citar al medio es lo que más
> papeletas da para una reclamación de derechos de autor. `MOSTRAR_CUERPO_COMPLETO`
> en `src/lib/sitio.ts` pasa de texto completo a extracto sin tocar nada más.

### 2. Una historia, no cinco noticias repetidas

Cuando varios medios cuentan lo mismo, cada versión se guarda entera —con su
enfoque, su titular y su foto— y tiene su propia página. Lo que no puede pasar
es que la misma historia ocupe cinco tarjetas seguidas de la portada.

El scraper deja marcada cada tarjeta con la historia a la que pertenece, así que
aquí basta `porHistoria()` para dejar una por listado. Las demás no se pierden:
la tarjeta enseña **«N coberturas»** y la noticia abre un bloque de **«otras
versiones de esta historia»**, separado de las relacionadas del mismo tema.

### 3. Diez milisegundos de CPU

El plan gratuito de Cloudflare Workers corta cada invocación a los **10 ms de
CPU**, y un archivo de tema pesa más de un mega ya parseado. Sin cuidado, un
rastreador recorriendo una sección tumba el sitio con errores 1102. Se apilan
cuatro defensas:

| Capa | Qué evita |
| --- | --- |
| `caches.default` en el middleware | Renderizar de nuevo una página ya servida |
| Memoria del isolate (`Memoria`) | Volver a parsear el mismo JSON |
| Cache API para una noticia suelta | Parsear 1 MB para leer una de cien noticias |
| `cf.cacheTtl` en las subpeticiones | Salir a la red |

Y dos decisiones de forma: los sitemaps se sirven tal cual salen del dataset en
vez de construirse aquí, y la página de un nicho descarga solo el archivo más
reciente de cada tema en lugar de todos.

## SEO, AEO y GEO

Tres públicos que no quieren lo mismo, todo en un único `@graph` con `@id`
cruzados (`src/lib/seo.ts`):

- **SEO** — `NewsArticle`, `BreadcrumbList`, `ItemList` y `CollectionPage`;
  canónicas, `prev`/`next` en los listados, Open Graph y Twitter Card; `robots`
  sin límite de fragmento ni de imagen, que es lo que hace que el resultado
  ocupe más sitio y se lleve más clics. Los sitemaps incluyen el de Google News.
- **AEO** — `speakable`, que le dice a un asistente de voz qué leer en alto, y
  descripciones que se sostienen solas fuera de la página.
- **GEO** — `about` y `mentions` con las entidades de cada noticia, `articleBody`
  completo en los datos estructurados (cuando el sitio publica el texto entero)
  y un `llms.txt` que explica el sitio en texto plano. `robots.txt` deja pasar
  expresamente a los rastreadores de los asistentes: que citen el sitio es el
  objetivo.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run check      # tipos
npm run build      # compila el worker
npm run preview    # sirve el worker compilado, como en producción
npm run deploy     # publica en Cloudflare
```

`npm run preview` es `wrangler dev` **desde la raíz del proyecto**: el adaptador
deja en `.wrangler/deploy/config.json` la ruta al worker compilado, y pasarle un
`--config` a mano rompe la resolución de los ficheros estáticos.

### Apuntar a otro dataset

```bash
DATASET_BASE_URL=http://127.0.0.1:8899 npm run build
```

Se resuelve **en tiempo de compilación**, no de ejecución: hay que reconstruir
después de cambiarla. Por defecto lee la rama `main` del repositorio del
scraper.

## Despliegue

Cloudflare Workers, con el adaptador de Astro. El sitio no se reconstruye cuando
entran noticias: el dataset se lee por HTTP y GitHub lo sirve con `max-age=300`,
así que basta con desplegar cuando cambia el código.
