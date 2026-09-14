// Fotografía scripts/og.html a 1200×630 y deja public/og.png.
//   node scripts/og.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = mkdtempSync(join(tmpdir(), "arcia-og-"));
const puerto = 9900 + Math.floor(Math.random() * 90);

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${puerto}`,
  "--allow-file-access-from-files",
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
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      pendientes.get(m.id)(m.result);
      pendientes.delete(m.id);
    }
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pendientes.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: pathToFileURL(join(WEB, "scripts/og.html")).href });
  await espera(2500);
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(WEB, "public/og.png"), Buffer.from(data, "base64"));
  console.log("public/og.png listo");
  ws.close();
} finally {
  chrome.kill();
  await espera(500);
  rmSync(perfil, { recursive: true, force: true });
}
