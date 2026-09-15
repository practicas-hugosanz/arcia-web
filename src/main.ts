import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Escena } from "./escena";

gsap.registerPlugin(ScrollTrigger);

const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);

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
  // Entrada del titular, línea a línea: lo primero que se lee es lo primero
  // que se mueve.
  gsap
    .timeline({ defaults: { ease: "power4.out" } })
    .from(".hero-titulo .linea > span", { yPercent: 110, duration: 0.9, stagger: 0.09 })
    .from(".hero-sub", { y: 16, opacity: 0, duration: 0.7 }, "-=0.55")
    .from(".hero-acciones > *", { y: 12, opacity: 0, duration: 0.6, stagger: 0.07 }, "-=0.5");

  // La escena se aleja y se apaga mientras la portada sale por arriba.
  // `fromTo` y no `to`: con `to`, GSAP toma como inicio la opacidad que haya en
  // ese momento, y si la escena no ha terminado de cargar, eso es un 0.
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

  // La ventana de la app se endereza al entrar: pasa de estar tumbada en la
  // mesa a quedarse de frente, que es cuando se lee.
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

  // Aparecer al entrar, en grupo para que lo que está junto llegue junto.
  gsap.set(".aparece", { opacity: 0, y: 28 });
  ScrollTrigger.batch(".aparece", {
    start: "top 88%",
    once: true,
    onEnter: (elementos) =>
      gsap.to(elementos, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, overwrite: true }),
  });
});

/* --- La barra de descarga en móvil -----------------------------------------
 * Aparece cuando el botón de la portada ya ha salido de la pantalla y se va
 * al llegar al cierre, que trae el suyo: nunca hay dos botones iguales a la
 * vista. Solo se ve por debajo de 768 px; lo decide el CSS. */
const barra = $("[data-barra]");
if (barra) {
  const portada = $(".hero-acciones");
  const cierre = $(".final");
  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const pasada = portada ? portada.getBoundingClientRect().bottom < 0 : true;
    const enCierre = cierre ? cierre.getBoundingClientRect().top < window.innerHeight : false;
    barra.classList.toggle("visible", pasada && !enCierre);
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
