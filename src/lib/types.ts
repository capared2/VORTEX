export interface Imagen {
  url: string;
  caption?: string;
}

/** Registro completo, tal y como lo guarda el scraper. */
export interface Noticia {
  id: string;
  url: string;
  category: string;
  vertical: string;
  topic: string;
  topic_name: string;
  section: string;
  title: string;
  standfirst: string;
  summary: string;
  /** Texto completo. Los párrafos van separados por un salto doble. */
  body: string;
  word_count: number;
  authors: string[];
  tags: string[];
  published_at: string | null;
  modified_at: string | null;
  language: string;
  country: string;
  images: Imagen[];
  videos: string[];
  is_premium: boolean;
  scraped_at: string;
}

/**
 * Versión ligera que viaja en latest.json y portada.json.
 *
 * El scraper la deriva sin la identidad del medio a propósito, así que aquí no
 * hay ningún campo del que pudiera salir: es lo que hace imposible enseñarla
 * por accidente en un listado.
 */
export interface Tarjeta {
  id: string;
  category: string;
  vertical: string;
  topic: string;
  topic_name: string;
  title: string;
  standfirst: string;
  summary: string;
  published_at: string | null;
  language: string;
  word_count: number;
  is_premium: boolean;
  /** Ruta del propio sitio (`/img/…`), nunca una URL externa. */
  image: string | null;
  /**
   * La historia a la que pertenece. Varias tarjetas la comparten cuando
   * cuentan lo mismo; es un hash del titular, no dice de dónde salió ninguna.
   */
  story?: string;
}

/** Una historia de portada: la noticia principal y cuántas coberturas tiene. */
export interface Historia extends Tarjeta {
  story: string;
  /** Cuántos medios distintos cuentan esta misma historia. */
  coverage: number;
  also: {
    id: string;
    category: string;
    title: string;
    published_at: string | null;
  }[];
}

export interface ArchivoParte {
  category: string;
  part: number;
  count: number;
  updated_at: string;
  articles: Noticia[];
}

export interface EntradaCategoria {
  category: string;
  vertical: string;
  name: string;
  articles: number;
  files: { file: string; count: number }[];
}

export interface EntradaVertical {
  vertical: string;
  name: string;
  articles: number;
  topics: number;
}

export interface Indice {
  generated_at: string;
  total_articles: number;
  total_categories: number;
  verticals: EntradaVertical[];
  categories: EntradaCategoria[];
}

export interface Portada {
  generated_at: string;
  count: number;
  stories: Historia[];
}

export interface Ultimas {
  generated_at: string;
  count: number;
  articles: Tarjeta[];
}

export interface Lookup {
  category: string;
  count: number;
  parts: Record<string, number>;
}
