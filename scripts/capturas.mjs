// Fotografía la app para la web: 3840 px de ancho, con datos inventados y sin
// nada cortado a medias.
//
//   node scripts/capturas.mjs
//
// 1. Compila la interfaz de la app en una carpeta temporal y le mete delante
//    `doble-de-tauri.js`, que contesta a la interfaz con datos inventados.
// 2. Abre cada pantalla en Chrome sin cabeza a 1600 px de ancho CSS —la app a
//    pantalla completa, con el panel de Prospección fijo al lado— con una
//    densidad de 2,4: la imagen sale de 3840 px, 4K.
// 3. Busca el alto de ventana más cercano a 1000 en el que el borde de abajo del
//    panel no parte ninguna tarjeta, fila ni línea de texto.
// 4. Recorta las tarjetas que usa la web por su caja real en la página, no por
//    coordenadas medidas a ojo, y guarda su radio para redondear las esquinas.
//
// Deja `fuentes/capturas/<vista>-<tema>.png`, `fuentes/recortes/<nombre>-<tema>.png`
// y `fuentes/recortes/radios.json`. Después: `node scripts/imagenes.mjs`.
//
// `SOLO=leads` rehace solo esa pantalla; `RECORTE=suweb`, solo ese recorte
// (`RECORTE=-` ninguno).

import { execSync, spawn } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(WEB, "..");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ANCHO = 1600;
const ALTO = 1000;
const DENSIDAD = 3840 / ANCHO;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const VISTAS = ["hoy", "scan", "call", "leads", "agenda", "email"];
const TEMAS = ["claro", "oscuro"];
// Cada recorte abre su pantalla de cero, pulsa lo que diga `pulsar` —por el
// texto visible, en orden— y recorta la tarjeta que lleva `titulo`, o el panel
// lateral que empieza por la tarjeta de `panel`.
const RECORTES = [
  // Más estrecha que la app entera: la web la pone en una celda de 520 px, y a
  // lo ancho de Resultados las barras salían de un dedo de alto.
  { nombre: "horas", vista: "embudo", titulo: "A qué hora cogen", ancho: 1080 },
  { nombre: "hoy", vista: "agenda", titulo: "Hoy" },
  // La ficha de un negocio con web mala: sus fallos y sus señales.
  { nombre: "suweb", vista: "leads", pulsar: ["Web mala", "Asador Casa Julián"], titulo: "Su web" },
  { nombre: "enlace", vista: "leads", pulsar: ["Peluquería Carmen Vidal", "Venta"], titulo: "Enlace para enseñársela" },
  // El panel «Pendiente» de Correos: el agente, las respuestas y las secuencias.
  { nombre: "bandeja", vista: "email", pulsar: ["Pendiente"], panel: "Bandeja del agente" },
];

const temporal = mkdtempSync(join(tmpdir(), "arcia-capturas-"));
const dist = join(temporal, "dist");
mkdirSync(join(WEB, "fuentes/capturas"), { recursive: true });
mkdirSync(join(WEB, "fuentes/recortes"), { recursive: true });

console.log("Compilando la interfaz de la app…");
execSync(`npx vite build --outDir "${dist}" --emptyOutDir`, { cwd: APP, stdio: "ignore" });
copyFileSync(join(WEB, "scripts/doble-de-tauri.js"), join(dist, "doble.js"));
const indice = join(dist, "index.html");
writeFileSync(indice, readFileSync(indice, "utf8").replace("<head>", '<head><script src="/doble.js"></script>'));

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const servidor = createServer((req, res) => {
  let f = join(dist, decodeURIComponent(req.url.split("?")[0]));
  if (!existsSync(f) || statSync(f).isDirectory()) f = indice;
  res.writeHead(200, { "content-type": TIPOS[extname(f)] ?? "application/octet-stream" });
  createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, r));
const puertoWeb = servidor.address().port;

const puertoChrome = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${puertoChrome}`,
  "--hide-scrollbars",
  `--user-data-dir=${join(temporal, "perfil")}`,
  "about:blank",
]);

let ws;
const pendientes = new Map();
let id = 0;
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pendientes.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluar = async (expression) =>
  (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;

/** ¿Parte el borde de abajo de algún panel con scroll una caja visible? */
const CORTES = `(() => {
  const paneles = [...document.querySelectorAll("*")].filter((e) => {
    const s = getComputedStyle(e);
    return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2;
  });
  const cortadas = [];
  for (const panel of paneles) {
    const fondo = panel.getBoundingClientRect().bottom;
    for (const e of panel.querySelectorAll("*")) {
      const b = e.getBoundingClientRect();
      if (b.height < 8 || b.width < 24 || b.top >= fondo - 1 || b.bottom <= fondo + 1) continue;
      const s = getComputedStyle(e);
      const tieneCaja =
        !/rgba\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor) ||
        parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0 ||
        ["TR", "P", "SPAN", "H1", "H2", "H3", "H4", "BUTTON", "A", "TD", "LI", "IMG", "svg"].includes(e.tagName);
      if (tieneCaja) cortadas.push(e.tagName + " " + String(e.className).slice(0, 40));
    }
  }
  return cortadas;
})()`;

/** La caja de una tarjeta y su radio, en píxeles CSS. */
const cajaDe = (r) => `(() => {
  const tarjeta = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (parseFloat(s.borderTopLeftRadius) >= 12 && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor)) return x;
    }
    return null;
  };
  let caja, fondo, derecha;
  ${
    r.panel
      ? `// El panel lateral desde la tarjeta que empieza por ese texto hasta la
         // última, sin el hueco vacío de debajo.
         const t = [...document.querySelectorAll("p, span")].find((e) => e.offsetParent && e.textContent.trim().startsWith(${JSON.stringify(r.panel)}));
         caja = tarjeta(t);
         const tarjetas = [...caja.parentElement.children].filter((e) => e.offsetParent);
         fondo = tarjetas[tarjetas.length - 1].getBoundingClientRect().bottom;
         derecha = Math.max(...tarjetas.map((e) => e.getBoundingClientRect().right));`
      : `// Entre todos los textos iguales, el de la tarjeta más grande: «Hoy»
         // sale también en la baldosa de la cabecera, y esa no es la que se quiere.
         // Se compara el primer y el último texto del elemento y no todo su texto:
         // el título del bloque lleva el contador o el icono pegados.
         // Nunca la barra de la izquierda: «Hoy» es también una de sus secciones,
         // y la barra entera es la tarjeta más grande de todas.
         caja = [...document.querySelectorAll("h1, h2, h3, h4, p, span, dt")]
           .filter((e) => e.offsetParent)
           .filter((e) => e.textContent.trim() === ${JSON.stringify(r.titulo)} || e.firstChild?.textContent?.trim() === ${JSON.stringify(r.titulo)} || e.lastChild?.textContent?.trim() === ${JSON.stringify(r.titulo)})
           .map(tarjeta)
           // La barra es el <aside> que lleva el <nav>; la ficha es otro <aside>.
           .filter((x) => x && !x.closest("aside")?.querySelector("nav"))
           .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
         caja.scrollIntoView({ block: "center" });`
  }
  const b = caja.getBoundingClientRect();
  return { x: b.left, y: b.top, width: (derecha ?? b.right) - b.left, height: (fondo ?? b.bottom) - b.top, radio: parseFloat(getComputedStyle(caja).borderTopLeftRadius) };
})()`;

/** Pulsa el primer elemento visible con ese texto, como haría alguien. */
const pulsar = (texto) => `(() => {
  const t = ${JSON.stringify(texto)};
  const e = [...document.querySelectorAll("button, [role=tab], td, p, span, a")]
    // Un botón puede llevar algo más detrás: «Pendiente 1 interesado».
    .filter((x) => x.offsetParent && (x.textContent.trim() === t || (x.tagName === "BUTTON" && x.textContent.trim().startsWith(t))))[0];
  if (!e) return false;
  (e.closest("button, [role=tab], tr") || e).click();
  return true;
})()`;

async function abrir(vista, tema, alto, ancho = ANCHO) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: DENSIDAD, mobile: false });
  await cdp("Page.navigate", { url: `http://localhost:${puertoWeb}/?vista=${vista}&tema=${tema}` });
  await espera(4500);
}

try {
  let pestanas = [];
  for (let i = 0; i < 60 && !pestanas.some((p) => p.type === "page"); i++) {
    try {
      pestanas = await (await fetch(`http://127.0.0.1:${puertoChrome}/json`)).json();
    } catch {}
    await espera(250);
  }
  ws = new WebSocket(pestanas.find((p) => p.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      pendientes.get(m.id)(m.result);
      pendientes.delete(m.id);
    }
  });

  // SONDA=scan: lista las tarjetas de esa pantalla con su posición y sale.
  // Sirve para ver por qué una pantalla no encuentra alto limpio.
  if (process.env.SONDA) {
    await abrir(process.env.SONDA, "claro", ALTO);
    console.log(
      await evaluar(`[...document.querySelectorAll(".card, table, [class*=bloque]")].map((e) => {
        const b = e.getBoundingClientRect();
        const t = (e.querySelector("h1, h2, h3, h4") || e).textContent.trim().slice(0, 32);
        return Math.round(b.left) + "," + Math.round(b.top) + " → " + Math.round(b.bottom) + "  " + t;
      }).join("\\n")`),
    );
    process.exit(0);
  }

  const vistas = process.env.SOLO ? process.env.SOLO.split(",").filter((v) => VISTAS.includes(v)) : VISTAS;
  for (const vista of vistas) {
    // El alto se busca con el tema claro y se reutiliza en el oscuro: la web
    // reserva un solo hueco por pantalla y los dos temas tienen que casar.
    let altoDeLaVista = null;
    for (const tema of TEMAS) {
      await abrir(vista, tema, altoDeLaVista ?? ALTO);
      // El alto limpio más cercano a 1000: 1000, 998, 1002… hasta ±140.
      let elegido = altoDeLaVista;
      for (let d = 0; d <= 140 && elegido === null; d += 2) {
        for (const alto of d ? [ALTO - d, ALTO + d] : [ALTO]) {
          await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: alto, deviceScaleFactor: DENSIDAD, mobile: false });
          await espera(120);
          if ((await evaluar(CORTES)).length === 0) {
            elegido = alto;
            break;
          }
        }
      }
      if (elegido === null) {
        elegido = ALTO;
        await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: DENSIDAD, mobile: false });
        await espera(300);
        console.log(`  AVISO ${vista}-${tema}: ningún alto sin cortes; queda cortado`, await evaluar(CORTES));
      }
      if (altoDeLaVista !== null) {
        const cortadas = await evaluar(CORTES);
        if (cortadas.length) console.log(`  AVISO ${vista}-${tema}: con el alto del claro corta`, cortadas.slice(0, 3));
      }
      altoDeLaVista = elegido;
      await espera(500);
      const { data } = await cdp("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(WEB, `fuentes/capturas/${vista}-${tema}.png`), Buffer.from(data, "base64"));
      console.log(`  ${vista}-${tema}: 3840×${Math.round(elegido * DENSIDAD)}`);
    }
  }

  const radios = {};
  const recortes = process.env.RECORTE
    ? RECORTES.filter((r) => process.env.RECORTE.split(",").includes(r.nombre))
    : process.env.SOLO
      ? []
      : RECORTES;
  for (const r of recortes) {
    for (const tema of TEMAS) {
      await abrir(r.vista, tema, 1300, r.ancho);
      for (const texto of r.pulsar ?? []) {
        if (!(await evaluar(pulsar(texto)))) throw new Error(`${r.nombre}: no encuentro «${texto}» para pulsar`);
        await espera(1500);
      }
      const caja = await evaluar(cajaDe(r));
      if (!caja) throw new Error(`${r.nombre}: no encuentro la tarjeta`);
      await espera(500);
      const recorte = await cdp("Page.captureScreenshot", {
        format: "png",
        clip: { x: caja.x, y: caja.y, width: caja.width, height: caja.height, scale: 1 },
      });
      writeFileSync(join(WEB, `fuentes/recortes/${r.nombre}-${tema}.png`), Buffer.from(recorte.data, "base64"));
      radios[r.nombre] = Math.round(caja.radio * DENSIDAD);
      console.log(`    recorte ${r.nombre}-${tema}: ${Math.round(caja.width * DENSIDAD)}×${Math.round(caja.height * DENSIDAD)}`);
    }
  }
  // Se mezcla con lo que había: con RECORTE=hoy, los radios de los recortes que
  // no se han rehecho no pueden perderse.
  const rutaRadios = join(WEB, "fuentes/recortes/radios.json");
  const previos = existsSync(rutaRadios) ? JSON.parse(readFileSync(rutaRadios, "utf8")) : {};
  writeFileSync(rutaRadios, `${JSON.stringify({ ...previos, ...radios }, null, 2)}\n`);
  ws.close();
} finally {
  chrome.kill();
  servidor.close();
  await espera(800);
  rmSync(temporal, { recursive: true, force: true });
}
