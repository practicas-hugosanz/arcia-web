// Prepara todas las imágenes de la web a partir de las capturas de la app y de
// los logotipos del propio repositorio.
//
//   node scripts/capturas.mjs   # antes, si cambia la app: saca las capturas
//   node scripts/imagenes.mjs
//
// Lee `fuentes/capturas/<vista>-<tema>.png` (3840 px) y
// `fuentes/recortes/<nombre>-<tema>.png`, y escribe en `public/`:
//   img/app/<vista>-<tema>-<ancho>.{avif,webp}    capturas enteras
//   img/app/<recorte>-<tema>-<ancho>.{avif,webp}  tarjetas sueltas, con las
//                                                 esquinas redondeadas en
//                                                 transparente
//   img/arcia-logo*.{png,webp}, favicon, iconos del manifiesto, fuentes
// y `src/medidas.json`, del que el plugin saca width/height de cada imagen
// para que el navegador reserve el hueco y no salte nada al cargar (CLS).

import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(WEB, "..");
const CAPTURAS = resolve(WEB, "fuentes/capturas");
const RECORTES = resolve(WEB, "fuentes/recortes");
const SALIDA = resolve(WEB, "public");
mkdirSync(resolve(SALIDA, "img/app"), { recursive: true });
mkdirSync(resolve(SALIDA, "fonts"), { recursive: true });
mkdirSync(resolve(WEB, "src"), { recursive: true });

const VISTAS = ["scan", "call", "leads", "agenda"];
const TEMAS = ["claro", "oscuro"];
// Hasta 4K: el navegador elige por `sizes` y la densidad de la pantalla, así
// que un móvil no se baja nunca la de 3840.
const ANCHOS = [960, 1600, 2400, 3840];
const NOMBRES_RECORTE = ["horas", "hoy", "pendiente", "webmuestra"];

const medidas = { app: {}, recortes: {} };

async function escribir(imagen, base, ancho) {
  const redimensionada = imagen.clone().resize({ width: ancho, withoutEnlargement: true });
  await Promise.all([
    redimensionada.clone().avif({ quality: 62, effort: 5 }).toFile(`${base}-${ancho}.avif`),
    redimensionada.clone().webp({ quality: 84, effort: 5 }).toFile(`${base}-${ancho}.webp`),
  ]);
}

for (const vista of VISTAS) {
  for (const tema of TEMAS) {
    const img = sharp(resolve(CAPTURAS, `${vista}-${tema}.png`));
    const { width, height } = await img.metadata();
    const anchos = ANCHOS.filter((a) => a <= width);
    medidas.app[`${vista}-${tema}`] = { width, height, anchos };
    for (const ancho of anchos) await escribir(img, resolve(SALIDA, `img/app/${vista}-${tema}`), ancho);
  }
  // El plugin pide una sola medida por vista: la del tema claro. Si el oscuro
  // saliese de otro alto, el hueco reservado no casaría: se avisa.
  const [claro, oscuro] = [medidas.app[`${vista}-claro`], medidas.app[`${vista}-oscuro`]];
  if (claro.height !== oscuro.height) console.log(`AVISO ${vista}: claro ${claro.height} px y oscuro ${oscuro.height} px de alto`);
  medidas.app[vista] = claro;
}

const radios = existsSync(resolve(RECORTES, "radios.json")) ? JSON.parse(readFileSync(resolve(RECORTES, "radios.json"), "utf8")) : {};
for (const nombre of NOMBRES_RECORTE) {
  for (const tema of TEMAS) {
    const origen = sharp(resolve(RECORTES, `${nombre}-${tema}.png`));
    const { width, height } = await origen.metadata();
    const radio = radios[nombre] ?? 0;
    // Las esquinas de la tarjeta, en transparente: recortar a rectángulo dejaba
    // el fondo del panel asomando en las cuatro esquinas.
    const mascara = Buffer.from(
      `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radio}" ry="${radio}"/></svg>`,
    );
    const redondeada = await origen.composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer();
    const anchos = [Math.round(width / 2), width];
    medidas.recortes[nombre] = { width, height, anchos };
    for (const ancho of anchos) await escribir(sharp(redondeada), resolve(SALIDA, `img/app/${nombre}-${tema}`), ancho);
  }
}

// Logotipos: el PNG grande para los datos estructurados y la tarjeta social,
// y WebP a 2x para la cabecera (se pinta a 132×44).
for (const nombre of ["arcia-logo", "arcia-logo-oscuro"]) {
  const origen = resolve(APP, `src/assets/${nombre}.png`);
  await sharp(origen).resize({ width: 264 }).webp({ quality: 90 }).toFile(resolve(SALIDA, `img/${nombre}.webp`));
  copyFileSync(origen, resolve(SALIDA, `img/${nombre}.png`));
}

// Iconos. La A suelta para la pestaña (cae sobre el gris del navegador, claro
// u oscuro, y el cian se ve en los dos); el cuadrado con suelo propio para el
// móvil y el manifiesto, que lo ponen sobre fondos ajenos.
const a = resolve(APP, "src/assets/arcia-a.png");
const marca = resolve(APP, "src/assets/arcia-marca.png");
const png32 = await sharp(a).resize(32, 32).png().toBuffer();
writeFileSync(resolve(SALIDA, "favicon-32.png"), png32);
await sharp(marca).resize(180, 180).png().toFile(resolve(SALIDA, "apple-touch-icon.png"));
await sharp(marca).resize(192, 192).png().toFile(resolve(SALIDA, "icono-192.png"));
await sharp(marca).resize(512, 512).png().toFile(resolve(SALIDA, "icono-512.png"));

// favicon.ico con el PNG de 32 px dentro. Algunos lectores de feeds y
// buscadores lo piden en la raíz aunque la página declare otro.
const cabecera = Buffer.alloc(22);
cabecera.writeUInt16LE(0, 0);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(1, 4);
cabecera.writeUInt8(32, 6);
cabecera.writeUInt8(32, 7);
cabecera.writeUInt8(0, 8);
cabecera.writeUInt8(0, 9);
cabecera.writeUInt16LE(1, 10);
cabecera.writeUInt16LE(32, 12);
cabecera.writeUInt32LE(png32.length, 14);
cabecera.writeUInt32LE(22, 18);
writeFileSync(resolve(SALIDA, "favicon.ico"), Buffer.concat([cabecera, png32]));

// Las mismas fuentes que la app, con nombres estables.
copyFileSync(resolve(APP, "src/assets/fonts/poppins-regular-JJFECG.woff2"), resolve(SALIDA, "fonts/poppins-400.woff2"));
copyFileSync(resolve(APP, "src/assets/fonts/poppins-semibold-Z1XLFQ.woff2"), resolve(SALIDA, "fonts/poppins-600.woff2"));
copyFileSync(resolve(APP, "src/assets/fonts/instrument-sans-VYC4K7BH.woff2"), resolve(SALIDA, "fonts/instrument-sans.woff2"));

writeFileSync(resolve(WEB, "src/medidas.json"), `${JSON.stringify(medidas, null, 2)}\n`);
console.log("Imágenes listas:", VISTAS.length, "vistas,", NOMBRES_RECORTE.length, "recortes");
