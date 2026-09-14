// Fotografía la app para la web: 3840 px de ancho, con datos inventados y sin
// nada cortado a medias.
//
//   node scripts/capturas.mjs
//
// 1. Compila la interfaz de la app en una carpeta temporal y le mete delante
//    `doble-de-tauri.js`, que contesta a la interfaz con datos inventados.
// 2. Abre cada pantalla en Chrome sin cabeza a 1440 px de ancho CSS con una
//    densidad de 8/3: la imagen sale de 3840 px, 4K.
// 3. Busca el alto de ventana más cercano a 900 en el que el borde de abajo del
//    panel no parte ninguna tarjeta, fila ni línea de texto.
// 4. Recorta las tarjetas que usa la web por su caja real en la página, no por
//    coordenadas medidas a ojo, y guarda su radio para redondear las esquinas.
//
// Deja `fuentes/capturas/<vista>-<tema>.png`, `fuentes/recortes/<nombre>-<tema>.png`
// y `fuentes/recortes/radios.json`. Después: `node scripts/imagenes.mjs`.

import { execSync, spawn } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(WEB, "..");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ANCHO = 1440;
const DENSIDAD = 3840 / ANCHO;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const VISTAS = ["scan", "call", "leads", "agenda"];
const TEMAS = ["claro", "oscuro"];
const RECORTES = [
  { nombre: "horas", vista: "scan", titulo: "A qué hora cogen" },
  { nombre: "hoy", vista: "agenda", titulo: "Hoy" },
  // Cinco filas y hasta la columna de estado: la tabla entera, puesta en la
  // mitad de la pantalla, no se leía.
  { nombre: "pendiente", vista: "leads", tabla: 5, hastaColumna: "Seguimiento" },
  // Después de la tabla y no antes: con la ficha abierta, Leads esconde la
  // columna «Seguimiento» y el recorte de arriba ya no tendría dónde acabar.
  { nombre: "webmuestra", vista: "leads", abrirFicha: true, titulo: "Web de muestra" },
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
    r.tabla
      ? `const tabla = document.querySelector("table");
         caja = tarjeta(tabla);
         caja.scrollIntoView({ block: "start" });
         fondo = tabla.querySelectorAll("tbody tr")[${r.tabla - 1}].getBoundingClientRect().bottom;
         ${
           r.hastaColumna
             ? `derecha = [...tabla.querySelectorAll("th")].find((th) => th.textContent.trim() === ${JSON.stringify(r.hastaColumna)}).getBoundingClientRect().left;`
             : ""
         }`
      : `// Entre todos los textos iguales, el de la tarjeta más grande: «Hoy»
         // sale también en la baldosa de la cabecera, y esa no es la que se quiere.
         // Se compara el primer texto del elemento y no todo su texto: el título
         // del bloque lleva el contador pegado («Hoy2») y no casaba nunca.
         caja = [...document.querySelectorAll("h1, h2, h3, h4, p, span")]
           .filter((e) => e.textContent.trim() === ${JSON.stringify(r.titulo)} || e.firstChild?.textContent?.trim() === ${JSON.stringify(r.titulo)})
           .map(tarjeta)
           .filter(Boolean)
           .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
         caja.scrollIntoView({ block: "center" });`
  }
  const b = caja.getBoundingClientRect();
  return { x: b.left, y: b.top, width: (derecha ?? b.right) - b.left, height: (fondo ?? b.bottom) - b.top, radio: parseFloat(getComputedStyle(caja).borderTopLeftRadius) };
})()`;

async function abrir(vista, tema, alto) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: alto, deviceScaleFactor: DENSIDAD, mobile: false });
  await cdp("Page.navigate", { url: `http://localhost:${puertoWeb}/?vista=${vista}&tema=${tema}&escaneo=hecho` });
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

  // SONDA=scan: lista las tarjetas de esa pantalla con su posición a 900 px de
  // alto y sale. Sirve para ver por qué una pantalla no encuentra alto limpio.
  if (process.env.SONDA) {
    await abrir(process.env.SONDA, "claro", 900);
    console.log(
      await evaluar(`[...document.querySelectorAll(".card, table, [class*=bloque]")].map((e) => {
        const b = e.getBoundingClientRect();
        const t = (e.querySelector("h1, h2, h3, h4") || e).textContent.trim().slice(0, 32);
        return Math.round(b.left) + "," + Math.round(b.top) + " → " + Math.round(b.bottom) + "  " + t;
      }).join("\\n")`),
    );
    process.exit(0);
  }

  const radios = {};
  for (const vista of (process.env.SOLO ?? VISTAS.join(",")).split(",")) {
    // El alto se busca con el tema claro y se reutiliza en el oscuro: la web
    // reserva un solo hueco por pantalla y los dos temas tienen que casar.
    let altoDeLaVista = null;
    for (const tema of TEMAS) {
      await abrir(vista, tema, altoDeLaVista ?? 900);
      // El alto limpio más cercano a 900: 900, 898, 902, 896… hasta ±140.
      let elegido = altoDeLaVista;
      for (let d = 0; d <= 140 && elegido === null; d += 2) {
        for (const alto of d ? [900 - d, 900 + d] : [900]) {
          await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: alto, deviceScaleFactor: DENSIDAD, mobile: false });
          await espera(120);
          if ((await evaluar(CORTES)).length === 0) {
            elegido = alto;
            break;
          }
        }
      }
      if (elegido === null) {
        elegido = 900;
        await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: 900, deviceScaleFactor: DENSIDAD, mobile: false });
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

      for (const r of RECORTES.filter((x) => x.vista === vista)) {
        await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: 1200, deviceScaleFactor: DENSIDAD, mobile: false });
        await espera(400);
        if (r.abrirFicha) {
          await evaluar(`document.querySelector("main tbody tr td:nth-child(2)").click()`);
          await espera(1800);
          const { data: ficha } = await cdp("Page.captureScreenshot", { format: "png" });
          // Solo para revisarla: la web no la usa entera.
          writeFileSync(join(WEB, `fuentes/capturas/ficha-${tema}.png`), Buffer.from(ficha, "base64"));
        }
        const caja = await evaluar(cajaDe(r));
        await espera(400);
        const recorte = await cdp("Page.captureScreenshot", {
          format: "png",
          clip: { x: caja.x, y: caja.y, width: caja.width, height: caja.height, scale: 1 },
        });
        writeFileSync(join(WEB, `fuentes/recortes/${r.nombre}-${tema}.png`), Buffer.from(recorte.data, "base64"));
        radios[r.nombre] = Math.round(caja.radio * DENSIDAD);
        console.log(`    recorte ${r.nombre}-${tema}: ${Math.round(caja.width * DENSIDAD)}×${Math.round(caja.height * DENSIDAD)}`);
      }
    }
  }
  // Se mezcla con lo que había: con SOLO=leads, los radios de los recortes que
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
