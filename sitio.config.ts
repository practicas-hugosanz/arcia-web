/**
 * Lo que cambia de la web sin tocar el HTML.
 *
 * El plugin de `vite.config.ts` sustituye estos valores en todas las páginas,
 * en los datos estructurados, en `robots.txt` y en `sitemap.xml`. Cambiar el
 * dominio aquí lo cambia en todos esos sitios a la vez, que es justo lo que
 * hay que hacer bien para el SEO: una URL canónica distinta en un solo sitio
 * reparte la página entre dos direcciones.
 */
export const sitio = {
  /**
   * Dirección de la web, sin barra final.
   *
   * `SITIO_URL` la cambia al compilar, por si alguna vez hay que servirla en
   * otra dirección —una copia de prueba, o github.io mientras el DNS propaga—
   * para que la canónica, el sitemap y los datos estructurados apunten a donde
   * de verdad está servida.
   *
   * Sin `www`: el dominio se sirve desnudo y `www.arcia.es` redirige a él. Las
   * dos direcciones sirviendo la misma página son dos webs para Google.
   */
  url: process.env.SITIO_URL ?? "https://arcia.es",

  /**
   * Descarga directa del instalador de la última versión.
   *
   * GitHub redirige `releases/latest/download/<nombre>` al fichero con ese
   * nombre de la release más reciente. Por eso cada versión sube, además del
   * instalador con su número, una copia llamada `Arcia_x64-setup.exe`
   * (DISTRIBUCION.md, «Al publicar cada versión»). Si una versión se publica
   * sin ella, este enlace da 404.
   */
  descarga: "https://github.com/practicas-hugosanz/arcia-releases/releases/latest/download/Arcia_x64-setup.exe",

  correo: "arciaapp@gmail.com",

  /**
   * Perfil de TikTok, con la URL entera.
   *
   * Vacío, el pie no enseña el enlace y los datos estructurados no declaran
   * ningún perfil: `sameAs` con una cuenta que no existe es peor que nada,
   * porque es lo que Google usa para atar la web a la cuenta.
   */
  tiktok: "https://www.tiktok.com/@arciaapp",

  /**
   * Cuota mensual en euros con IVA, como se escribe en España («30» o «29,90»).
   *
   * Vacía, la web no enseña ninguna cifra y los datos estructurados no llevan
   * oferta: mejor sin precio que con uno inventado.
   */
  precioMes: "30",
  /** El desglose que se enseña debajo: 24,79 € + 21 % de IVA = 30 €. */
  precioSinIva: "24,79",
  iva: "5,21",

  /**
   * Si el aviso legal y la privacidad ya llevan los datos del titular.
   *
   * Mientras sea `false` esas páginas van con `noindex` y fuera del sitemap:
   * una página legal con huecos entre corchetes no debería salir en Google.
   */
  legalCompleto: true,
};
