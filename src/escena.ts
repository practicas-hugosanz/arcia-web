/**
 * La escena de la portada: un pueblo visto desde arriba, hecho de puntos.
 *
 * Cada punto es un negocio. Un anillo sale del centro y recorre el pueblo, y a
 * su paso se encienden en cian y se levantan los que no tienen web. Es lo que
 * hace la app —rastrear una zona y apartar a quien le falta la web—, y el
 * anillo es el arco del nombre.
 *
 * Encima van dos cosas en HTML, porque los puntos solos no decían qué eran:
 * unas fichas que salen sobre algunos negocios cuando se encienden, con su
 * nombre y su nota, y el contador del escaneo, que sube al ritmo del anillo
 * como sube el de la app.
 *
 * Todo el pueblo va en un único `Points` con un shader propio: miles de puntos
 * en una sola llamada de dibujo. Se para cuando la portada sale de la pantalla
 * o la pestaña se oculta, y con movimiento reducido se pinta un solo fotograma
 * con el barrido ya hecho.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ColorManagement,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

// El shader escribe el color tal cual, sin pasar a sRGB al final. Con la
// gestión de color encendida, `Color("#00c7fb")` se guarda en lineal y el cian
// de la marca salía azul oscuro. Apagada, lo que entra es lo que se pinta.
ColorManagement.enabled = false;

const RADIO = 7.2;
const ALCANCE = RADIO * 1.35; // hasta dónde llega el anillo
const CICLO = 9; // segundos por barrido
const BARRIDO = 6.2; // de ellos, lo que tarda el anillo en cruzar el pueblo

/** Lo que dice el contador al acabar, como una búsqueda normal de la app. */
const FICHAS = 60;

/**
 * Los negocios de las fichas. Inventados, con la forma de los que salen de
 * verdad: oficio y nombre propio, y una nota de Google creíble.
 */
const NEGOCIOS: [string, string][] = [
  ["Peluquería Nuria Estilistas", "4,7"],
  ["Taller Hermanos Ruiz", "4,4"],
  ["Floristería La Camelia", "4,9"],
  ["Panadería Horno San José", "4,3"],
  ["Carpintería Martínez", "4,6"],
  ["Fisioterapia Movimiento", "4,9"],
  ["Autoescuela Vía Libre", "4,5"],
  ["Óptica Visión Clara", "4,8"],
  ["Tintorería Colón", "4,2"],
  ["Clínica Dental Sonríe", "4,8"],
];

/** Números al azar repetibles: el pueblo sale igual en cada visita. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pueblo = {
  geometria: BufferGeometry;
  posiciones: number[];
  distancias: number[];
  /** Índices de los negocios sin web. */
  sinWeb: number[];
  /** Distancias ordenadas, para contar cuántos ha cruzado ya el anillo. */
  todasOrdenadas: Float32Array;
  sinWebOrdenadas: Float32Array;
};

function pueblo(): Pueblo {
  const r = azar(20260914);
  const posiciones: number[] = [];
  const marcas: number[] = [];
  const aleatorio: number[] = [];
  const distancias: number[] = [];
  const sinWeb: number[] = [];
  const paso = 0.13;
  const lado = Math.ceil(RADIO / paso);

  for (let i = -lado; i <= lado; i++) {
    for (let j = -lado; j <= lado; j++) {
      // Calles: cada pocas filas y columnas no hay nada, y una avenida en
      // diagonal. Sin calles, una rejilla de puntos es un tejido, no un pueblo.
      if (i % 9 === 0 || j % 7 === 0) continue;
      if (Math.abs(i - j * 0.75 - 6) < 1.2) continue;

      const x = i * paso + (r() - 0.5) * 0.05;
      const z = j * paso + (r() - 0.5) * 0.05;
      const d = Math.hypot(x, z);
      // Borde irregular y menos densidad hacia fuera, como un casco urbano.
      const borde = RADIO * (0.78 + 0.22 * Math.sin(Math.atan2(z, x) * 3 + 1.3) * 0.5 + 0.11);
      if (d > borde) continue;
      if (r() > 1 - (d / borde) * 0.62) continue;
      // Solares vacíos.
      if (r() < 0.12) continue;

      const esSinWeb = r() < 0.19;
      if (esSinWeb) sinWeb.push(distancias.length);
      posiciones.push(x, 0, z);
      marcas.push(esSinWeb ? 1 : 0);
      aleatorio.push(r());
      distancias.push(d);
    }
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute("position", new Float32BufferAttribute(posiciones, 3));
  geometria.setAttribute("aSinWeb", new Float32BufferAttribute(marcas, 1));
  geometria.setAttribute("aAzar", new Float32BufferAttribute(aleatorio, 1));
  geometria.setAttribute("aDistancia", new Float32BufferAttribute(distancias, 1));

  return {
    geometria,
    posiciones,
    distancias,
    sinWeb,
    todasOrdenadas: Float32Array.from(distancias).sort(),
    sinWebOrdenadas: Float32Array.from(sinWeb.map((i) => distancias[i])).sort(),
  };
}

/** Cuántos valores de una lista ordenada son menores que `r`. */
function contar(ordenadas: Float32Array, r: number) {
  let bajo = 0;
  let alto = ordenadas.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (ordenadas[medio] < r) bajo = medio + 1;
    else alto = medio;
  }
  return bajo;
}

const vertice = /* glsl */ `
  attribute float aSinWeb;
  attribute float aAzar;
  attribute float aDistancia;
  uniform float uTiempo;
  uniform float uBarrido;
  uniform float uVisible;
  uniform float uPixel;
  uniform float uTamano;
  varying float vEncendido;
  varying float vAnillo;

  void main() {
    vec3 p = position;
    float detras = uBarrido - aDistancia;
    float anillo = exp(-pow((aDistancia - uBarrido) * 2.6, 2.0));
    float encendido = aSinWeb * smoothstep(0.0, 0.7, detras) * uVisible;

    p.y += encendido * (0.22 + 0.07 * sin(uTiempo * 1.7 + aAzar * 6.2831));
    p.y += anillo * 0.1;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * uPixel * (1.0 + encendido * 1.5 + anillo * 0.7) * (7.0 / -mv.z);

    vEncendido = encendido;
    vAnillo = anillo;
  }
`;

const fragmento = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uMarca;
  uniform float uAlfaBase;
  varying float vEncendido;
  varying float vAnillo;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float suave = smoothstep(0.5, 0.32, d);
    float mezcla = clamp(vEncendido + vAnillo * 0.55, 0.0, 1.0);
    vec3 color = mix(uBase, uMarca, mezcla);
    float alfa = suave * mix(uAlfaBase, 1.0, clamp(vEncendido + vAnillo * 0.8, 0.0, 1.0));
    gl_FragColor = vec4(color, alfa);
  }
`;

export type Escena = {
  /** 0 arriba del todo, 1 cuando la portada ya ha salido por arriba. */
  progreso(p: number): void;
  destruir(): void;
};

type Ficha = { el: HTMLElement; indice: number; nombre: string; nota: string };

export function montar(lienzo: HTMLCanvasElement, reducido: boolean): Escena | null {
  let render: WebGLRenderer;
  try {
    render = new WebGLRenderer({ canvas: lienzo, antialias: false, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  const oscuro = window.matchMedia("(prefers-color-scheme: dark)");
  const contenedor = lienzo.parentElement!;
  const capa = contenedor.querySelector<HTMLElement>("[data-escena-capa]");
  const contadorLeidas = contenedor.querySelector<HTMLElement>("[data-escaneo-leidas]");
  const contadorSinWeb = contenedor.querySelector<HTMLElement>("[data-escaneo-sinweb]");

  const escena = new Scene();
  const camara = new PerspectiveCamera(38, 1, 0.1, 100);
  const desde = new Vector3(0, 12.5, 15.5);
  const hasta = new Vector3(0, 7.5, 9);
  camara.position.copy(desde);
  camara.lookAt(0, 0, 0);

  const grupo = new Group();
  escena.add(grupo);

  const datos = pueblo();
  const material = new ShaderMaterial({
    vertexShader: vertice,
    fragmentShader: fragmento,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTiempo: { value: 0 },
      uBarrido: { value: reducido ? ALCANCE : 0 },
      uVisible: { value: 1 },
      uPixel: { value: 1 },
      // A la distancia de la cámara (unas 16 unidades) sale un punto de unos
      // 3,5 px, y los encendidos rondan los 9. Con 2,2 salía de 1 px y no se
      // veía el pueblo.
      uTamano: { value: 8 },
      uBase: { value: new Color() },
      uMarca: { value: new Color("#00c7fb") },
      uAlfaBase: { value: 0.5 },
    },
  });
  const puntos = new Points(datos.geometria, material);
  grupo.add(puntos);

  const materialAnillo = new MeshBasicMaterial({ color: "#00c7fb", transparent: true, opacity: 0, depthWrite: false });
  const anillo = new Mesh(new RingGeometry(0.985, 1, 160), materialAnillo);
  anillo.rotation.x = -Math.PI / 2;
  anillo.position.y = 0.02;
  grupo.add(anillo);

  let ancho = 0;
  let alto = 0;

  /* --- Las fichas ---------------------------------------------------------- */

  const proyectado = new Vector3();
  /** Dónde cae en pantalla el negocio `i`, en píxeles del contenedor. */
  const aPantalla = (i: number) => {
    proyectado
      .set(datos.posiciones[i * 3], 0.3, datos.posiciones[i * 3 + 2])
      .applyMatrix4(grupo.matrixWorld)
      .project(camara);
    return { x: ((proyectado.x + 1) / 2) * ancho, y: ((1 - proyectado.y) / 2) * alto, delante: proyectado.z < 1 };
  };

  // La zona donde una ficha se puede leer entera. Se mide sobre el punto, y la
  // tarjeta sale centrada encima de él, así que los márgenes guardan media
  // tarjeta a cada lado. En escritorio, lejos del difuminado que deja leer el
  // titular y por encima del contador; en móvil, por debajo del contador, que
  // va arriba.
  // Entre 1024 y 1280 px el titular ocupa más de media pantalla: ahí la zona
  // empieza más a la derecha o la primera ficha tapaba «clientes».
  const base = () =>
    ancho >= 1280
      ? { x0: ancho * 0.63, x1: ancho * 0.88, y0: alto * 0.22, y1: alto * 0.74 }
      : ancho >= 1024
        ? { x0: ancho * 0.74, x1: ancho * 0.88, y0: alto * 0.3, y1: alto * 0.74 }
        : { x0: ancho * 0.32, x1: ancho * 0.68, y0: alto * 0.4, y1: alto * 0.78 };

  // El pueblo gira despacio, y en lo que tarda el anillo en llegar a un
  // negocio su punto se mueve decenas de píxeles. Si se exigía la misma zona
  // al elegir y al enseñar, las fichas de los bordes salían de ella antes de
  // encenderse: en la primera pasada solo se veían 2 de 4 (medido). Por eso se
  // elige con margen hacia dentro y se enseña con holgura hacia fuera, salvo
  // por la izquierda, que es donde está el titular.
  const MARGEN = 70;
  const HOLGURA = 90;
  const zonaParaElegir = () => {
    const z = base();
    // En móvil la zona mide unos 140 px de ancho: el margen no puede comérsela.
    const m = Math.min(MARGEN, (z.x1 - z.x0) / 4);
    return { x0: z.x0 + m, x1: z.x1 - m, y0: z.y0 + m * 0.5, y1: z.y1 - m * 0.5 };
  };
  const zona = () => {
    const z = base();
    return {
      x0: z.x0,
      x1: Math.min(z.x1 + HOLGURA, ancho - 110),
      y0: Math.max(z.y0 - HOLGURA, 80),
      y1: Math.min(z.y1 + HOLGURA, alto - 30),
    };
  };
  const dentro = (p: { x: number; y: number }, z: { x0: number; x1: number; y0: number; y1: number }) =>
    p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1;

  let fichas: Ficha[] = [];
  let tanda = 0;

  /**
   * Elige sobre qué negocios salen fichas en este barrido: repartidos por la
   * distancia al centro, para que se enciendan uno detrás de otro, y separados
   * en pantalla para que no se pisen.
   */
  const elegir = () => {
    if (!capa || !ancho) return;
    // La cámara solo recalcula su matriz al dibujar. Sin esto, en la primera
    // pasada —antes del primer dibujado— todos los negocios se proyectaban
    // fuera de la pantalla y no salía ninguna ficha hasta la segunda vuelta.
    camara.updateMatrixWorld();
    grupo.updateMatrixWorld();
    const z = zonaParaElegir();
    const cuantas = ancho >= 1024 ? 4 : 2;
    const candidatos = datos.sinWeb
      .map((i) => ({ i, d: datos.distancias[i], p: aPantalla(i) }))
      .filter((c) => c.p.delante && dentro(c.p, z) && c.d > 0.8)
      .sort((a, b) => a.d - b.d);

    // Dos fichas se pisan si están cerca en horizontal Y en vertical: una
    // encima de otra caben. Exigir distancia en línea recta dejaba en móvil y a
    // 1024 px una sola ficha, porque la zona es estrecha.
    const libre = (c: (typeof candidatos)[number], elegidos: typeof candidatos) =>
      // 96 y no 78: una ficha mide unos 58 px de alto, y con el giro del
      // pueblo dos que empezaban separadas acababan tocándose.
      elegidos.every((e) => Math.abs(e.p.x - c.p.x) > 210 || Math.abs(e.p.y - c.p.y) > 96);

    const elegidos: typeof candidatos = [];
    for (let k = 0; k < cuantas && candidatos.length; k++) {
      // Primero, uno de su tramo de distancia, para que se enciendan uno
      // detrás de otro; si ahí no cabe ninguno, cualquiera que no se pise.
      const desdeAqui = Math.floor((candidatos.length * k) / cuantas);
      const hastaAqui = Math.floor((candidatos.length * (k + 1)) / cuantas);
      const tramo = candidatos.slice(desdeAqui, hastaAqui).filter((c) => libre(c, elegidos));
      const elegido =
        tramo[Math.floor(tramo.length / 2)] ?? candidatos.find((c) => !elegidos.includes(c) && libre(c, elegidos));
      if (elegido) elegidos.push(elegido);
    }
    elegidos.sort((a, b) => a.d - b.d);

    capa.replaceChildren();
    fichas = elegidos.map((c, k) => {
      const [nombre, nota] = NEGOCIOS[(tanda + k) % NEGOCIOS.length];
      const el = document.createElement("div");
      el.className = "ficha";
      el.innerHTML = `<div class="ficha-tarjeta"><p class="ficha-nombre"></p><p class="ficha-meta"><span class="ficha-sinweb">Sin web</span><span class="ficha-nota"></span></p></div>`;
      el.querySelector(".ficha-nombre")!.textContent = nombre;
      el.querySelector(".ficha-nota")!.textContent = `${nota} en Google`;
      capa.append(el);
      return { el, indice: c.i, nombre, nota };
    });
    tanda += elegidos.length;
  };

  const colocarFichas = (barrido: number, visible: number) => {
    const z = zona();
    for (const f of fichas) {
      const p = aPantalla(f.indice);
      const encendida = barrido > datos.distancias[f.indice] + 0.35 && visible > 0.6 && p.delante && dentro(p, z);
      f.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      f.el.classList.toggle("visible", encendida);
    }
  };

  /* --- El contador ---------------------------------------------------------- */

  let ultimoLeidas = -1;
  let ultimoSinWeb = -1;
  const contarEscaneo = (barrido: number) => {
    const total = datos.distancias.length;
    const leidas = Math.round((contar(datos.todasOrdenadas, barrido) / total) * FICHAS);
    const sinWeb = Math.round((contar(datos.sinWebOrdenadas, barrido) / total) * FICHAS);
    // Solo se toca el DOM cuando cambia la cifra, no en cada fotograma.
    if (contadorLeidas && leidas !== ultimoLeidas) contadorLeidas.textContent = String((ultimoLeidas = leidas));
    if (contadorSinWeb && sinWeb !== ultimoSinWeb) contadorSinWeb.textContent = String((ultimoSinWeb = sinWeb));
  };

  /* --- Colores, tamaño y puntero ------------------------------------------- */

  // Los colores salen de la paleta de la página, así que siguen al tema del
  // sistema sin duplicar valores aquí.
  const colores = () => {
    const css = getComputedStyle(document.documentElement);
    material.uniforms.uBase.value.set(css.getPropertyValue("--escena-punto").trim() || "#9c9a96");
    material.uniforms.uAlfaBase.value = oscuro.matches ? 0.42 : 0.55;
    material.blending = oscuro.matches ? AdditiveBlending : NormalBlending;
    material.needsUpdate = true;
    if (reducido) dibujar(0);
  };

  // En escritorio el pueblo va a la derecha: el titular vive a la izquierda.
  // En móvil, centrado y por encima del texto.
  const encajar = () => {
    ancho = lienzo.clientWidth;
    alto = lienzo.clientHeight;
    if (!ancho || !alto) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    render.setPixelRatio(dpr);
    render.setSize(ancho, alto, false);
    material.uniforms.uPixel.value = dpr;
    camara.aspect = ancho / alto;
    if (ancho >= 1024) camara.setViewOffset(ancho, alto, -ancho * 0.27, alto * 0.03, ancho, alto);
    else camara.clearViewOffset();
    camara.updateProjectionMatrix();
    if (reducido) {
      elegir();
      dibujar(0);
    }
  };

  let puntero = { x: 0, y: 0 };
  const suave = { x: 0, y: 0 };
  const alMover = (e: PointerEvent) => {
    puntero = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
  };

  /* --- El fotograma --------------------------------------------------------- */

  let avance = 0;
  let faseAnterior = Infinity;
  function dibujar(t: number) {
    let barrido = ALCANCE;
    let visible = 1;
    if (!reducido) {
      const fase = t % CICLO;
      const nuevaVuelta = fase < faseAnterior;
      faseAnterior = fase;

      barrido = Math.min(fase / BARRIDO, 1) * ALCANCE;
      // Al final de cada ciclo se apagan despacio antes del siguiente barrido.
      visible = fase > CICLO - 0.9 ? (CICLO - fase) / 0.9 : 1;
      material.uniforms.uTiempo.value = t;
      material.uniforms.uBarrido.value = barrido;
      material.uniforms.uVisible.value = visible;
      anillo.scale.setScalar(Math.max(barrido, 0.001));
      materialAnillo.opacity = fase < BARRIDO ? 0.55 * (1 - barrido / ALCANCE) : 0;

      suave.x += (puntero.x - suave.x) * 0.04;
      suave.y += (puntero.y - suave.y) * 0.04;
      grupo.rotation.y = t * 0.035 + suave.x * 0.18;
      grupo.rotation.x = suave.y * 0.05;

      // Empieza un barrido nuevo: fichas nuevas, sobre otros negocios. Se
      // eligen con la cámara ya colocada para este fotograma.
      if (nuevaVuelta) {
        camara.position.lerpVectors(desde, hasta, avance);
        camara.lookAt(0, 0, 0);
        elegir();
      }
    }
    camara.position.lerpVectors(desde, hasta, avance);
    camara.lookAt(0, 0, 0);
    grupo.updateMatrixWorld();
    render.render(escena, camara);
    colocarFichas(barrido, visible);
    contarEscaneo(barrido);
  }

  let enPantalla = true;
  let pedido = 0;
  const inicio = performance.now();
  const bucle = () => {
    pedido = 0;
    if (!enPantalla || document.hidden) return;
    dibujar((performance.now() - inicio) / 1000);
    pedido = requestAnimationFrame(bucle);
  };
  const arrancar = () => {
    if (!reducido && !pedido && enPantalla && !document.hidden) pedido = requestAnimationFrame(bucle);
  };

  const observador = new IntersectionObserver(([entrada]) => {
    enPantalla = entrada.isIntersecting;
    arrancar();
  });
  observador.observe(lienzo);
  const tamano = new ResizeObserver(encajar);
  tamano.observe(lienzo);
  document.addEventListener("visibilitychange", arrancar);
  oscuro.addEventListener("change", colores);
  if (!reducido) window.addEventListener("pointermove", alMover, { passive: true });

  encajar();
  colores();
  arrancar();

  return {
    progreso(p) {
      avance = Math.min(Math.max(p, 0), 1);
      if (reducido) dibujar(0);
    },
    destruir() {
      cancelAnimationFrame(pedido);
      observador.disconnect();
      tamano.disconnect();
      document.removeEventListener("visibilitychange", arrancar);
      oscuro.removeEventListener("change", colores);
      window.removeEventListener("pointermove", alMover);
      capa?.replaceChildren();
      datos.geometria.dispose();
      material.dispose();
      anillo.geometry.dispose();
      materialAnillo.dispose();
      render.dispose();
    },
  };
}
