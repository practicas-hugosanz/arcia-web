import { defineConfig, type Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sitio } from "./sitio.config";

const RAIZ = __dirname;
const PAGINAS = ["index", "aviso-legal", "privacidad", "404"];

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

function datosEstructurados(html: string): string {
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
    screenshot: `${sitio.url}/img/app/call-claro-1400.webp`,
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

  const grafo = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${sitio.url}/#organizacion`,
        name: "Arcia",
        url: `${sitio.url}/`,
        logo: `${sitio.url}/img/arcia-logo.png`,
        email: sitio.correo,
      },
      {
        "@type": "WebSite",
        "@id": `${sitio.url}/#web`,
        name: "Arcia",
        url: `${sitio.url}/`,
        inLanguage: "es-ES",
        publisher: { "@id": `${sitio.url}/#organizacion` },
      },
      aplicacion,
      ...(preguntas.length ? [{ "@type": "FAQPage", "@id": `${sitio.url}/#preguntas`, mainEntity: preguntas }] : []),
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(grafo)}</script>`;
}

function arcia(): Plugin {
  // La ruta base con la que se sirve la web: «/» en un dominio propio,
  // «/arcia-web/» en GitHub Pages. Vite ya se la pone a las hojas de estilo,
  // las fuentes y las imágenes; los enlaces entre páginas no los toca, y sin
  // esto el logotipo y el pie mandaban a la raíz de github.io.
  let base = "/";
  return {
    name: "arcia",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const m = medidas();
        let salida = html
          .replace(/href="\/(aviso-legal|privacidad)?"/g, (_, pagina) => `href="${base}${pagina ?? ""}"`)
          // Bloques que solo existen con precio, o solo sin él.
          .replace(/<!--si-precio-->([\s\S]*?)<!--\/si-precio-->/g, (_, dentro) => (sitio.precioMes ? dentro : ""))
          .replace(/<!--sin-precio-->([\s\S]*?)<!--\/sin-precio-->/g, (_, dentro) => (sitio.precioMes ? "" : dentro))
          .replace(/<!--robots-legal-->/g, sitio.legalCompleto ? "" : '<meta name="robots" content="noindex, follow">')
          .replace(/%URL%/g, sitio.url)
          .replace(/%DESCARGA%/g, sitio.descarga)
          .replace(/%CORREO%/g, sitio.correo)
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
          salida = salida.replace("<!--datos-estructurados-->", datosEstructurados(salida));
        }
        return salida;
      },
    },
    generateBundle() {
      const legales = sitio.legalCompleto ? ["aviso-legal", "privacidad"] : [];
      const hoy = new Date().toISOString().slice(0, 10);
      const urls = ["", ...legales].map(
        (p) => `  <url><loc>${sitio.url}/${p}</loc><lastmod>${hoy}</lastmod></url>`,
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
