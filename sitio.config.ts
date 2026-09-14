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
  /** Dominio definitivo, sin barra final. */
  url: "https://arcia.com",

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
