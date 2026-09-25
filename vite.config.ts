import { defineConfig, type Plugin } from "vite";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { sitio } from "./sitio.config";

const RAIZ = __dirname;
/** Las páginas que profundizan en lo que la portada solo nombra. */
const FUNCIONES = ["como-funciona", "verificacion", "ia", "seguimiento", "tus-datos"];
/**
 * Las guías: responden a lo que se busca —«peluquerías sin página web»— con las
 * cifras de escaneos reales. Son las que tienen que salir en Google por el
 * nicho; las de funciones salen por la marca.
 */
const GUIAS = [
  "negocios-sin-pagina-web",
  "peluquerias-sin-pagina-web-alicante",
  "hamburgueserias-sin-pagina-web",
  "cafeterias-sin-pagina-web",
  "brunch-sin-pagina-web",
  "inmobiliarias-sin-pagina-web-alicante",
  "alternativas",
];
const PAGINAS = ["index", ...FUNCIONES, ...GUIAS, "aviso-legal", "privacidad", "terminos", "404"];

/**
 * Las piezas que se repiten en varias páginas: cabecera, pie, barra de
 * descarga, cierre y enlaces a las demás funciones. Con seis páginas escritas
 * a mano, copiar la cabecera en cada una era asegurarse de que un día
 * dijeran cosas distintas.
 */
const pieza = (nombre: string) => {
  const ruta = resolve(RAIZ, `partes/${nombre}.html`);
  if (!existsSync(ruta)) throw new Error(`No existe la pieza «partes/${nombre}.html»`);
  return readFileSync(ruta, "utf8");
};

type Medida = { width: number; height: number; anchos: number[] };
type Medidas = { app: Record<string, Medida>; recortes: Record<string, Medida> };

const medidas = (): Medidas => JSON.parse(readFileSync(resolve(RAIZ, "src/medidas.json"), "utf8"));

/** Quita etiquetas y deja el texto plano, para los datos estructurados. */
const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * Una captura de la app como `<picture>`: AVIF y WebP, claro y oscuro según el
 * sistema, y `width`/`height` de verdad para que no salte nada al cargar.
 */
function imagen(carpeta: string, nombre: string, medida: Medida, resto: string): string {
  const tamanos = /data-tamanos="([^"]+)"/.exec(resto)?.[1] ?? "100vw";
  const atributos = resto.replace(/\s*data-tamanos="[^"]+"/, "");
  const srcset = (tema: string, formato: string) =>
    medida.anchos.map((a) => `/img/${carpeta}/${nombre}-${tema}-${a}.${formato} ${a}w`).join(", ");
  const medio = medida.anchos[Math.min(1, medida.anchos.length - 1)];
  return [
    "<picture>",
    `<source type="image/avif" media="(prefers-color-scheme: dark)" srcset="${srcset("oscuro", "avif")}" sizes="${tamanos}">`,
    `<source type="image/webp" media="(prefers-color-scheme: dark)" srcset="${srcset("oscuro", "webp")}" sizes="${tamanos}">`,
    `<source type="image/avif" srcset="${srcset("claro", "avif")}" sizes="${tamanos}">`,
    `<img src="/img/${carpeta}/${nombre}-claro-${medio}.webp" srcset="${srcset("claro", "webp")}" sizes="${tamanos}" width="${medida.width}" height="${medida.height}" decoding="async"${atributos}>`,
    "</picture>",
  ].join("");
}

/** El SVG de Phosphor, en línea: sin peticiones y sin depender de JavaScript. */
function icono(nombre: string): string {
  const ruta = resolve(RAIZ, `node_modules/@phosphor-icons/core/assets/regular/${nombre}.svg`);
  if (!existsSync(ruta)) throw new Error(`No existe el icono de Phosphor «${nombre}»`);
  return readFileSync(ruta, "utf8")
    .trim()
    .replace("<svg ", '<svg class="i" aria-hidden="true" focusable="false" ');
}

/** El título y la descripción que ya lleva la página, para no escribirlos dos veces. */
const cabecera = (html: string) => ({
  titulo: texto(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "Arcia"),
  descripcion: /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "",
});

/**
 * El nombre con el que se enseña cada página en las migas.
 *
 * Es el del menú del pie, no el `<title>`: «Cómo funciona» y no «Cómo funciona
 * Arcia: de Google Maps a la llamada», que en una miga se lee fatal.
 */
const MIGAS: Record<string, string> = {
  "como-funciona": "Cómo funciona",
  verificacion: "Verificación",
  ia: "IA",
  seguimiento: "Llamadas y seguimiento",
  "tus-datos": "Tus datos",
  "negocios-sin-pagina-web": "Negocios sin página web",
  "peluquerias-sin-pagina-web-alicante": "Peluquerías sin web en Alicante",
  "hamburgueserias-sin-pagina-web": "Hamburgueserías sin web",
  "cafeterias-sin-pagina-web": "Cafeterías sin web",
  "brunch-sin-pagina-web": "Brunch sin web",
  "inmobiliarias-sin-pagina-web-alicante": "Inmobiliarias sin web en Alicante",
  alternativas: "Alternativas",
  "aviso-legal": "Aviso legal",
  privacidad: "Privacidad",
  terminos: "Términos y condiciones",
};

function datosEstructurados(html: string, pagina: string): string {
  const preguntas = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="faq-respuesta">([\s\S]*?)<\/div>/g)].map(
    ([, pregunta, respuesta]) => ({
      "@type": "Question",
      name: texto(pregunta),
      acceptedAnswer: { "@type": "Answer", text: texto(respuesta) },
    }),
  );

  const aplicacion: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": `${sitio.url}/#app`,
    name: "Arcia",
    description:
      "Aplicación de escritorio para encontrar negocios locales sin página web en Google Maps, comprobar que no la tienen y llamarlos con un guion preparado.",
    url: `${sitio.url}/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows 10, Windows 11",
    inLanguage: "es-ES",
    downloadUrl: sitio.descarga,
    installUrl: `${sitio.url}/`,
    softwareRequirements: "Windows 10 o superior, 64 bits",
    screenshot: ["scan", "leads", "call", "agenda"].map((p) => `${sitio.url}/img/app/${p}-claro-1400.webp`),
    // Lo que hace, con las palabras con las que se busca. Cada línea sale de
    // una página del sitio: nada aquí que no esté contado y sea verdad.
    featureList: [
      "Busca negocios en Google Maps por oficio y municipio, en cualquiera de los 8.132 de España",
      "Comprueba si cada negocio tiene web antes de darlo por bueno, y deja aparte lo que no puede asegurar",
      "Modo llamada con el guion delante y un resultado por tecla",
      "Agenda de seguimientos y citas en tu calendario",
      "Correos en tanda desde tu propia cuenta",
      "IA opcional con tu clave: web de muestra, guion y correos",
      "Los leads se guardan en tu ordenador, no en un servidor nuestro",
    ],
    keywords: "prospección B2B, negocios sin web, clientes sin página web, Google Maps, llamadas en frío, leads locales",
    publisher: { "@id": `${sitio.url}/#organizacion` },
  };
  if (sitio.precioMes) {
    const precio = sitio.precioMes.replace(",", ".");
    aplicacion.offers = {
      "@type": "Offer",
      price: precio,
      priceCurrency: "EUR",
      category: "subscription",
      url: `${sitio.url}/#precio`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: precio,
        priceCurrency: "EUR",
        valueAddedTaxIncluded: true,
        unitCode: "MON",
      },
    };
  }

  const { titulo, descripcion } = cabecera(html);
  const direccion = pagina ? `${sitio.url}/${pagina}` : `${sitio.url}/`;
  // El aviso legal y la privacidad no van «de» la aplicación: son del titular.
  // Declararlas como páginas sobre el producto, con su precio y todo, es
  // decirle a Google que ahí se vende algo, y ahí no se vende nada.
  const legal = pagina === "aviso-legal" || pagina === "privacidad" || pagina === "terminos";

  // La Organization y el WebSite van en **todas** las páginas, no solo en la
  // portada. Son lo que le dice a Google que «Arcia» es una cosa concreta con
  // su nombre, su logotipo y sus perfiles, y repetirlo en cada página es lo
  // que sostiene la búsqueda por la marca a secas.
  const grafo = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${sitio.url}/#organizacion`,
        name: "Arcia",
        alternateName: "Arcia App",
        description:
          "Arcia hace prospección B2B local: encuentra en Google Maps los negocios sin web de una zona, comprueba que de verdad no la tienen y prepara la llamada.",
        url: `${sitio.url}/`,
        logo: `${sitio.url}/img/arcia-logo.png`,
        email: sitio.correo,
        // `sameAs` es lo que ata la web a los perfiles de fuera: sin él, la
        // cuenta de TikTok y esta página son dos cosas sueltas para Google.
        ...(sitio.tiktok ? { sameAs: [sitio.tiktok] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${sitio.url}/#web`,
        name: "Arcia",
        url: `${sitio.url}/`,
        inLanguage: "es-ES",
        publisher: { "@id": `${sitio.url}/#organizacion` },
      },
      {
        "@type": "WebPage",
        "@id": `${direccion}#pagina`,
        url: direccion,
        name: titulo,
        ...(descripcion ? { description: descripcion } : {}),
        isPartOf: { "@id": `${sitio.url}/#web` },
        ...(legal ? {} : { about: { "@id": `${sitio.url}/#app` } }),
        inLanguage: "es-ES",
        ...(pagina && MIGAS[pagina] ? { breadcrumb: { "@id": `${direccion}#migas` } } : {}),
      },
      // Las migas solo en las de dentro: en la portada serían un solo escalón.
      ...(pagina && MIGAS[pagina]
        ? [
            {
              "@type": "BreadcrumbList",
              "@id": `${direccion}#migas`,
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Arcia", item: `${sitio.url}/` },
                { "@type": "ListItem", position: 2, name: MIGAS[pagina] },
              ],
            },
          ]
        : []),
      // Las guías son artículos con fecha y autor: es lo que Google enseña en
      // el resultado («hace 3 días») y lo que le dice que la cifra es de hoy.
      ...(GUIAS.includes(pagina)
        ? [
            {
              "@type": "Article",
              "@id": `${direccion}#articulo`,
              headline: titulo,
              ...(descripcion ? { description: descripcion } : {}),
              mainEntityOfPage: { "@id": `${direccion}#pagina` },
              datePublished: "2026-09-24",
              dateModified: tocada(pagina),
              inLanguage: "es-ES",
              author: { "@id": `${sitio.url}/#organizacion` },
              publisher: { "@id": `${sitio.url}/#organizacion` },
              image: `${sitio.url}/og.png`,
            },
          ]
        : []),
      ...(legal ? [] : [aplicacion]),
      ...(preguntas.length ? [{ "@type": "FAQPage", "@id": `${sitio.url}/#preguntas`, mainEntity: preguntas }] : []),
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(grafo)}</script>`;
}

/**
 * Cuándo se tocó por última vez la página, de verdad.
 *
 * Antes todas llevaban la fecha del despliegue, así que cada publicación decía
 * que las ocho habían cambiado hoy —incluida la privacidad, que lleva sin
 * tocarse desde que se escribió—. Google se fía del `lastmod` mientras le
 * cuadra y lo ignora en cuanto le mienten, y ese es justo el aviso que
 * interesa que crea: «esta ha cambiado, vuelve a mirarla».
 *
 * Sale del último commit que tocó el fichero. Si no hay historia —una copia
 * descargada en zip, o un `checkout` sin profundidad— se cae a la fecha del
 * fichero, que sigue siendo mejor que la de hoy para todas.
 */
const tocada = (pagina: string): string => {
  const fichero = `${pagina || "index"}.html`;
  try {
    const fecha = execFileSync("git", ["log", "-1", "--format=%cs", "--", fichero], {
      cwd: RAIZ,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  } catch {}
  return new Date(statSync(resolve(RAIZ, fichero)).mtime).toISOString().slice(0, 10);
};

function arcia(): Plugin {
  // La ruta base con la que se sirve la web: «/» en arcia.es, y `BASE` la
  // cambia para servirla en un subdirectorio. Vite ya se la pone a las hojas de
  // estilo, las fuentes y las imágenes; los enlaces entre páginas no los toca,
  // y sin esto el logotipo y el pie mandaban a la raíz del dominio.
  let base = "/";
  return {
    name: "arcia",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        // «/ia.html» → «ia»; la portada, cadena vacía. De aquí salen la URL de
        // la página en los datos estructurados y sus migas.
        const archivo = ctx.path.replace(/^\//, "").replace(/\.html$/, "");
        const pagina = archivo === "index" ? "" : archivo;
        const m = medidas();
        let salida = html
          // Las piezas primero: traen sus propios iconos, enlaces y %CORREO%,
          // y así pasan por el resto de sustituciones como el HTML de la página.
          .replace(/^[ \t]*<!--parte:([\w-]+)-->[ \t]*\r?\n?/gm, (_, nombre) => pieza(nombre))
          // En la lista de guías no sale la que se está leyendo. Las funciones
          // lo hacen por CSS; aquí son siete y crecerán, así que se quita.
          .replace(/[ \t]*<li data-guia="([\w-]+)">[\s\S]*?<\/li>\r?\n?/g, (li, guia) => (guia === pagina ? "" : li))
          // Cualquier enlace a una página propia —«/», «/ia», «/#precio»—, no
          // solo a las legales. Los recursos (/src/…, /favicon.ico) no casan:
          // llevan barra o punto.
          .replace(/href="\/([\w-]*)(#[\w-]+)?"/g, (_, pagina, ancla) => `href="${base}${pagina}${ancla ?? ""}"`)
          // Bloques que solo existen con precio, o solo sin él.
          .replace(/<!--si-precio-->([\s\S]*?)<!--\/si-precio-->/g, (_, dentro) => (sitio.precioMes ? dentro : ""))
          .replace(/<!--sin-precio-->([\s\S]*?)<!--\/sin-precio-->/g, (_, dentro) => (sitio.precioMes ? "" : dentro))
          .replace(/<!--si-tiktok-->([\s\S]*?)<!--\/si-tiktok-->/g, (_, dentro) => (sitio.tiktok ? dentro : ""))
          // Todo enlace a la descarga queda marcado para que `main.ts` lo
          // encuentre: en un teléfono no hay nada que bajarse y ahí el botón
          // dice que la app está en camino a su tienda. Se marca aquí y no a
          // mano en los once sitios donde aparece, que es donde se olvida.
          .replace(/<a ([^>]*)href="%DESCARGA%"/g, '<a data-descarga $1href="%DESCARGA%"')
          .replace(/<!--robots-legal-->/g, sitio.legalCompleto ? "" : '<meta name="robots" content="noindex, follow">')
          .replace(/%URL%/g, sitio.url)
          .replace(/%DESCARGA%/g, sitio.descarga)
          .replace(/%CORREO%/g, sitio.correo)
          .replace(/%TIKTOK%/g, sitio.tiktok)
          .replace(/%PRECIO%/g, sitio.precioMes)
          .replace(/%PRECIO_SIN_IVA%/g, sitio.precioSinIva)
          .replace(/%IVA%/g, sitio.iva)
          .replace(/%ANIO%/g, String(new Date().getFullYear()))
          .replace(/<i data-i="([\w-]+)"><\/i>/g, (_, nombre) => icono(nombre))
          .replace(/<img data-captura="([\w-]+)"([^>]*)>/g, (_, nombre, resto) => {
            const medida = m.app[nombre];
            if (!medida) throw new Error(`Falta la captura «${nombre}»: ejecuta scripts/imagenes.mjs`);
            return imagen("app", nombre, medida, resto);
          })
          .replace(/<img data-recorte="([\w-]+)"([^>]*)>/g, (_, nombre, resto) => {
            const medida = m.recortes[nombre];
            if (!medida) throw new Error(`Falta el recorte «${nombre}»: ejecuta scripts/imagenes.mjs`);
            return imagen("app", nombre, medida, resto);
          });
        if (salida.includes("<!--datos-estructurados-->")) {
          salida = salida.replace("<!--datos-estructurados-->", datosEstructurados(salida, pagina));
        }
        return salida;
      },
    },
    generateBundle() {
      const legales = sitio.legalCompleto ? ["aviso-legal", "privacidad", "terminos"] : [];
      const urls = ["", ...FUNCIONES, ...GUIAS, ...legales].map(
        (p) => `  <url><loc>${sitio.url}/${p}</loc><lastmod>${tocada(p)}</lastmod></url>`,
      );
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${sitio.url}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [arcia()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      input: Object.fromEntries(PAGINAS.map((p) => [p, resolve(RAIZ, `${p}.html`)])),
    },
  },
});
