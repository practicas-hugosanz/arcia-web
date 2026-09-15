import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Escena } from "./escena";
import { montarSimulacion } from "./simulacion";

gsap.registerPlugin(ScrollTrigger);

const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

/* --- La escena 3D ---------------------------------------------------------
 * Se carga después de pintar la página: three.js es lo más pesado de la web y
 * el titular no puede esperarle. Quien pide ahorrar datos no la descarga. */
let escena: Escena | null = null;
const lienzo = $<HTMLCanvasElement>("[data-escena]");
const ahorro = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
if (lienzo && !ahorro) {
  const cargar = () =>
    import("./escena").then(({ montar }) => {
      escena = montar(lienzo, reducido);
      if (escena) lienzo.closest(".hero-escena")?.classList.add("lista");
    });
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => void cargar(), { timeout: 1200 });
  else setTimeout(() => void cargar(), 300);
}

/* --- La cabecera se aparta al bajar y vuelve al subir ---------------------- */
const nav = $("[data-nav]");
if (nav) {
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const abajo = self.scroll() > 12;
      nav.classList.toggle("con-fondo", abajo);
      nav.classList.toggle("oculta", self.direction === 1 && self.scroll() > 240);
    },
  });
}

const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: no-preference)", () => {
  // Lo de la portada solo donde hay portada: en las páginas de funciones GSAP
  // avisaba en la consola de cada selector que no encontraba.
  if ($(".hero")) {
    // Entrada del titular, línea a línea: lo primero que se lee es lo primero
    // que se mueve.
    gsap
      .timeline({ defaults: { ease: "power4.out" } })
      .from(".hero-titulo .linea > span", { yPercent: 110, duration: 0.9, stagger: 0.09 })
      .from(".hero-sub", { y: 16, opacity: 0, duration: 0.7 }, "-=0.55")
      .from(".hero-acciones > *", { y: 12, opacity: 0, duration: 0.6, stagger: 0.07 }, "-=0.5");

    // La escena se aleja y se apaga mientras la portada sale por arriba.
    // `fromTo` y no `to`: con `to`, GSAP toma como inicio la opacidad que haya
    // en ese momento, y si la escena no ha terminado de cargar, eso es un 0.
    gsap.fromTo(".hero-escena", { opacity: 1 }, {
      opacity: 0.2,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (s) => escena?.progreso(s.progress),
      },
    });
  }

  // La ventana de la app se endereza al entrar: pasa de estar tumbada en la
  // mesa a quedarse de frente, que es cuando se lee.
  if ($(".escaparate-ventana")) {
    gsap.fromTo(
      ".escaparate-ventana",
      { rotateX: 16, scale: 0.9, yPercent: 4 },
      {
        rotateX: 0,
        scale: 1,
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: ".escaparate-escena", start: "top 95%", end: "top 25%", scrub: true },
      },
    );
  }

  // Aparecer al entrar, en grupo para que lo que está junto llegue junto.
  if ($(".aparece")) {
    gsap.set(".aparece", { opacity: 0, y: 28 });
    ScrollTrigger.batch(".aparece", {
      start: "top 88%",
      once: true,
      onEnter: (elementos) =>
        gsap.to(elementos, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, overwrite: true }),
    });
  }
});

/* --- Cómo funciona: los pasos fijados y la pantalla que cambia ------------
 * Solo en escritorio y con movimiento: en móvil, o con movimiento reducido,
 * cada paso lleva su propia captura debajo y no se fija nada. Vive en la
 * página /como-funciona desde que la portada se quedó en cinco secciones. */
mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
  const seccion = $("[data-pasos]");
  if (!seccion) return;
  const pasos = $$(".paso", seccion);
  const vistas = $$(".visor-vista", seccion);
  const n = pasos.length;
  seccion.classList.add("fijada");

  let actual = -1;
  const activar = (i: number) => {
    if (i === actual) return;
    actual = i;
    pasos.forEach((p, k) => p.classList.toggle("activo", k === i));
    vistas.forEach((v, k) => {
      v.classList.toggle("activo", k === i);
      v.classList.toggle("pasada", k < i);
    });
  };
  activar(0);

  const disparador = ScrollTrigger.create({
    trigger: seccion,
    start: "top top",
    end: () => `+=${window.innerHeight * (n - 1) * 0.85}`,
    pin: true,
    invalidateOnRefresh: true,
    onUpdate(s) {
      const posicion = s.progress * n;
      const i = Math.min(n - 1, Math.floor(posicion));
      activar(i);
      pasos.forEach((p, k) => p.style.setProperty("--avance", String(Math.min(Math.max(posicion - k, 0), 1))));
    },
  });

  return () => {
    disparador.kill();
    seccion.classList.remove("fijada");
    pasos.forEach((p) => {
      p.classList.remove("activo");
      p.style.removeProperty("--avance");
    });
    vistas.forEach((v) => v.classList.remove("activo", "pasada"));
  };
});

/* --- La simulación de Prospección ------------------------------------------
 * Con movimiento reducido se queda en el estado final que ya trae el HTML. */
const simulacion = $("[data-sim]");
if (simulacion && !reducido) montarSimulacion(simulacion);

/* --- La barra de descarga en móvil -----------------------------------------
 * Aparece cuando el primer botón de descarga de la página (`data-cta`) ya ha
 * salido de la pantalla y se va al llegar al cierre, que trae el suyo: nunca
 * hay dos botones iguales a la vista. Solo se ve por debajo de 768 px; lo
 * decide el CSS. */
const barra = $("[data-barra]");
if (barra) {
  const primero = $("[data-cta]");
  const cierre = $(".final");
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const pasado = primero ? primero.getBoundingClientRect().bottom < 0 : true;
    const enCierre = cierre ? cierre.getBoundingClientRect().top < window.innerHeight : false;
    barra.classList.toggle("visible", pasado && !enCierre);
  };
  const pedir = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(actualizar);
  };
  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", pedir);
  actualizar();
}
