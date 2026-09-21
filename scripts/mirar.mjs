// Fotografía la web en Chrome sin cabeza y, si se pide, mide cosas en la página.
//
//   node scripts/mirar.mjs <prefijo> [ancho] [alto] [claro|oscuro] [paradas] [url]
//
//   paradas   «0,1300,6000» (alturas de scroll) o «secciones» (una por sección)
//   url       por defecto http://localhost:4173/ (npm run preview)
//
// Variables:
//   EVAL=<js>     expresión que se evalúa en cada parada y se imprime
//   MUESTRAS=<n>  antes de las paradas, evalúa EVAL cada 500 ms n veces
//   REDUCIDO=1    emula prefers-reduced-motion: la escena se pinta en un solo
//                 fotograma y no hay entradas animadas
//   DPR=<n>       densidad de pantalla (para ver qué tamaño de imagen se baja)
//   UA=<cadena>   se hace pasar por ese navegador, con pantalla táctil: es la
//                 única forma de ver lo que la página cambia según el sistema
//
// Dos trampas que costaron capturas falsas:
//   - Sin foco emulado y la pestaña al frente, Chrome sin cabeza cree la página
//     oculta y no corre requestAnimationFrame: la escena 3D no se ve y las
//     entradas de GSAP se quedan a medias (llegó a salir una franja blanca que
//     no existía). Aquí ya se emulan las dos cosas.
//   - Bajar de golpe no dispara ScrollTrigger como un scroll de verdad: se baja
//     a saltos.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [prefijo, ancho = "1440", alto = "900", tema = "claro", paradas = "0", url = "http://localhost:4173/"] =
  process.argv.slice(2);
if (!prefijo) {
  console.log("Uso: node scripts/mirar.mjs <prefijo> [ancho] [alto] [claro|oscuro] [paradas] [url]");
  process.exit(1);
}
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const puerto = 9500 + Math.floor(Math.random() * 400);
const perfil = mkdtempSync(join(tmpdir(), "arcia-mirar-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${puerto}`,
  `--window-size=${ancho},${alto}`,
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--hide-scrollbars",
  `--user-data-dir=${perfil}`,
  "about:blank",
]);

try {
  let pestanas = [];
  for (let i = 0; i < 60 && !pestanas.some((p) => p.type === "page"); i++) {
    try {
      pestanas = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
    } catch {}
    await espera(250);
  }
  const ws = new WebSocket(pestanas.find((p) => p.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pendientes = new Map();
  const consola = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      pendientes.get(m.id)(m.result ?? m.error);
      pendientes.delete(m.id);
    }
    if (m.method === "Runtime.consoleAPICalled") consola.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Runtime.exceptionThrown") consola.push("EXCEPCIÓN " + m.params.exceptionDetails.exception?.description);
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pendientes.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluar = async (expression) =>
    (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;

  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: Number(ancho),
    height: Number(alto),
    deviceScaleFactor: Number(process.env.DPR || 1),
    mobile: Number(ancho) < 768,
  });
  await cdp("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: tema === "oscuro" ? "dark" : "light" },
      ...(process.env.REDUCIDO ? [{ name: "prefers-reduced-motion", value: "reduce" }] : []),
    ],
  });
  // Lo que la página cambia según el sistema —los botones de descarga, que en
  // un teléfono anuncian la tienda— no se puede ver solo estrechando la
  // ventana: hay que decir que somos un móvil. `maxTouchPoints` va aparte del
  // user agent y es lo que delata a un iPad, que dice ser un Mac.
  if (process.env.UA) {
    await cdp("Emulation.setUserAgentOverride", { userAgent: process.env.UA });
    await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  }
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
  await cdp("Page.navigate", { url });

  if (process.env.MUESTRAS && process.env.EVAL) {
    const t0 = Date.now();
    for (let k = 0; k < Number(process.env.MUESTRAS); k++) {
      await espera(500);
      console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(await evaluar(process.env.EVAL)));
    }
  }
  await espera(3500);

  const lista =
    paradas === "secciones"
      ? await evaluar(`[...document.querySelectorAll("main > section, main > .pin-spacer > section, footer")].map((s) => Math.round(s.getBoundingClientRect().top + scrollY))`)
      : paradas.split(",").map(Number);
  console.log("alto total", await evaluar("document.documentElement.scrollHeight"), "paradas", lista.join(","));

  for (const [i, y] of lista.entries()) {
    const desde = await evaluar("scrollY");
    for (let k = 1; k <= 12; k++) {
      await evaluar(`window.scrollTo(0, ${Math.round(desde + ((y - desde) * k) / 12)})`);
      await espera(40);
    }
    await espera(1400);
    if (process.env.EVAL) console.log(`parada ${i} (y=${y}):`, JSON.stringify(await evaluar(process.env.EVAL)));
    const { data } = await cdp("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${prefijo}-${i}.png`, Buffer.from(data, "base64"));
  }
  console.log("desborde horizontal", await evaluar("document.documentElement.scrollWidth - innerWidth"));
  console.log(consola.length ? "CONSOLA:\n" + consola.join("\n") : "consola limpia");
  ws.close();
} finally {
  chrome.kill();
  await espera(500);
  rmSync(perfil, { recursive: true, force: true });
}
