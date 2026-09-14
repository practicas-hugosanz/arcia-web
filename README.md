# La web de Arcia

Página estática: HTML escrito a mano (lo que lee Google está en el HTML, no lo
pinta JavaScript), GSAP para el scroll y three.js para la escena de la portada.

```powershell
cd web
npm install
npm run dev       # http://localhost:5173
npm run build     # deja la web en dist/
npm run preview   # sirve dist/ en http://localhost:4173
```

## Antes de publicarla

Todo se cambia en `sitio.config.ts`, y el build lo aplica a las páginas, los
datos estructurados, `robots.txt` y `sitemap.xml`:

| Qué | Dónde | Por qué importa |
|---|---|---|
| **El dominio** | `url` | Es la URL canónica de cada página: `https://arcia.com` |
| **El precio** | `precioMes` | 30 €. Vacío, la web no enseña cifra y Google no recibe oferta |
| **Los datos legales** | `aviso-legal.html` y `privacidad.html`, lo marcado entre corchetes; luego `legalCompleto: true` | La LSSI obliga a identificar al titular. Mientras falten, esas páginas van con `noindex` |
| **La descarga** | `descarga` | Ahora abre la página de la última versión en GitHub |

## Publicarla

Cualquier alojamiento estático sirve: Cloudflare Pages, Netlify o Vercel.
Carpeta `web`, orden `npm run build`, salida `dist`. `404.html` ya está en la
raíz de `dist/`, que es donde lo buscan los tres.

Después, en Google Search Console: verificar el dominio y enviar
`https://<dominio>/sitemap.xml`.

## Las imágenes

Son la app de verdad con **datos inventados**: `scripts/doble-de-tauri.js`
contesta a la interfaz con negocios, ciudades, cifras, guion y vendedor que no
salen de ninguna base real. Estas imágenes son públicas: no se capturan nunca
con datos de un usuario.

```powershell
node scripts/capturas.mjs   # compila la app y la fotografía a 3840 px (4K)
node scripts/imagenes.mjs   # AVIF y WebP hasta 3840, recortes redondeados, iconos
node scripts/og.mjs         # la tarjeta de 1200×630 para WhatsApp, LinkedIn o X
npm run build
```

`capturas.mjs` hace dos cosas para que nada salga cortado a medias:

* Busca, para cada pantalla, el alto de ventana más cercano a 900 px en el que
  el borde de abajo no parte ninguna tarjeta, fila ni texto. Si no lo encuentra
  lo dice con un `AVISO`: en Prospección pasó con cuatro escaneos, y se arregló
  con un quinto en el doble.
* Recorta las tarjetas por su caja real en la página (título de la tarjeta, o
  filas y columnas de la tabla), y guarda su radio para que `imagenes.mjs`
  redondee las esquinas en transparente.

`SOLO=leads` rehace solo esa pantalla; `SONDA=scan` lista las tarjetas de una
pantalla con su posición, para ver por qué no encuentra alto limpio.

## Medirla

Lighthouse sobre `npm run preview` (2026-09-14): rendimiento 99, accesibilidad
100, buenas prácticas 100, SEO 100. LCP 2,0 s, CLS 0.

**Chrome sin cabeza no sirve para ver la escena ni las animaciones**: no ejecuta
`requestAnimationFrame`, así que la portada sale vacía y las entradas de GSAP se
quedan a medias (se vio una franja blanca que no existe). Para capturas fiables
sin navegador real, emular `prefers-reduced-motion: reduce`: la escena se pinta
en un solo fotograma y no hay entradas animadas.
