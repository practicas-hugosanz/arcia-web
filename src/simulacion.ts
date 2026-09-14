/**
 * La simulación de Prospección.
 *
 * Una búsqueda de principio a fin, guionizada: se escribe el oficio y la
 * ciudad, se pulsa Buscar y el escaneo pasa por las mismas fases, con los
 * mismos mensajes, que la pantalla de la app (`PHASE_LABELS` de ScanView y los
 * `message` de pipeline.rs), hasta el resultado con sus baldosas. Los datos son
 * inventados y cuadran entre sí: 60 fichas = 24 sin web + 33 con web + 2 de otro
 * municipio + 1 vacía, y 24 candidatos = 16 sin web + 6 con web + 2 pendientes.
 *
 * El HTML ya trae el estado final: sin JavaScript, o con movimiento reducido,
 * se ve el resultado y no se anima nada. Con movimiento, se reinicia al montar
 * y arranca la primera vez que la simulación entra en pantalla.
 */

type Estado = "sinweb" | "tieneweb" | "pendiente" | "esperando";

const CHIP: Record<Estado, string> = {
  sinweb: "Sin web",
  tieneweb: "Tiene web",
  pendiente: "Pendiente",
  esperando: "Verificando…",
};

const FICHAS = 60;
const CANDIDATOS = 24;

class Cancelada extends Error {}

export function montarSimulacion(raiz: HTMLElement) {
  const uno = <T extends HTMLElement = HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const todos = (sel: string) => [...raiz.querySelectorAll<HTMLElement>(sel)];

  const pasos = todos(".sim-paso");
  const campoQue = uno('[data-sim-campo="que"]');
  const campoDonde = uno('[data-sim-campo="donde"]');
  const textoQue = campoQue.querySelector<HTMLElement>(".sim-texto")!;
  const textoDonde = campoDonde.querySelector<HTMLElement>(".sim-texto")!;
  const boton = uno("[data-sim-boton]");
  const avance = uno("[data-sim-avance]");
  const resultado = uno("[data-sim-resultado]");
  const eyebrow = uno("[data-sim-eyebrow]");
  const fase = uno("[data-sim-fase]");
  const porcentaje = uno("[data-sim-porcentaje]");
  const barra = uno("[data-sim-barra]");
  const mensaje = uno("[data-sim-mensaje]");
  const quedan = uno("[data-sim-quedan]");
  const filas = todos(".sim-fila");
  const finales = filas.map((f) => f.dataset.estado as Estado);
  const cifras = todos("[data-cifra]");
  const repetir = raiz.closest("section")?.querySelector<HTMLButtonElement>("[data-sim-repetir]") ?? null;

  // Cada reproducción tiene su turno. Al repetir a medias, las esperas de la
  // anterior se encuentran con que ya no es su turno y la cortan en seco, sin
  // dejar dos guiones escribiendo en los mismos campos.
  let turno = 0;
  const espera = (ms: number, mio: number) =>
    new Promise<void>((bien, mal) => setTimeout(() => (mio === turno ? bien() : mal(new Cancelada())), ms));

  const marcarPaso = (n: number) =>
    pasos.forEach((p, i) => {
      p.classList.toggle("activo", i === n);
      p.classList.toggle("hecho", i < n);
    });

  const ponerAvance = (pct: number) => {
    porcentaje.textContent = String(Math.round(pct));
    barra.style.transform = `scaleX(${pct / 100})`;
  };

  const ponerChip = (fila: HTMLElement, estado: Estado) => {
    fila.dataset.estado = estado;
    fila.querySelector(".sim-chip")!.textContent = CHIP[estado];
  };

  async function escribir(el: HTMLElement, texto: string, mio: number) {
    for (let i = 1; i <= texto.length; i++) {
      el.textContent = texto.slice(0, i);
      await espera(80 + Math.random() * 70, mio);
    }
  }

  /** Lleva un valor de `desde` a `hasta` en `ms`, a saltos de unos 60 ms. */
  async function recorrer(desde: number, hasta: number, ms: number, mio: number, cada: (v: number) => void) {
    const saltos = Math.max(1, Math.round(ms / 60));
    for (let k = 1; k <= saltos; k++) {
      cada(desde + ((hasta - desde) * k) / saltos);
      await espera(ms / saltos, mio);
    }
  }

  function reiniciar() {
    raiz.classList.add("animada");
    marcarPaso(-1);
    textoQue.textContent = "";
    textoDonde.textContent = "";
    campoQue.classList.remove("enfocado");
    campoDonde.classList.remove("enfocado");
    boton.classList.remove("listo", "pulsado", "cancelar");
    avance.classList.remove("oculto");
    resultado.classList.add("oculto");
    eyebrow.textContent = "Escaneo";
    fase.textContent = "Esperando una búsqueda";
    ponerAvance(0);
    mensaje.textContent = "Escribe qué negocio buscas y dónde.";
    quedan.textContent = "";
    filas.forEach((f) => {
      f.classList.add("fuera");
      f.classList.remove("mirando");
      ponerChip(f, "esperando");
    });
    cifras.forEach((c) => (c.textContent = "0"));
  }

  async function reproducir() {
    const mio = ++turno;
    reiniciar();
    if (repetir) repetir.hidden = true;

    try {
      await espera(600, mio);

      // 1. Qué y dónde.
      marcarPaso(0);
      campoQue.classList.add("enfocado");
      await espera(450, mio);
      await escribir(textoQue, "Peluquería", mio);
      await espera(350, mio);
      campoQue.classList.remove("enfocado");
      campoDonde.classList.add("enfocado");
      await espera(250, mio);
      await escribir(textoDonde, "Madrid", mio);
      await espera(300, mio);
      campoDonde.classList.remove("enfocado");
      boton.classList.add("listo");
      await espera(700, mio);
      boton.classList.add("pulsado");
      await espera(170, mio);
      boton.classList.remove("pulsado");
      boton.classList.add("cancelar");

      // 2. Google Maps.
      marcarPaso(1);
      eyebrow.textContent = "Escaneando";
      fase.textContent = "Preparando";
      mensaje.textContent = "Buscando «Peluquería» en Madrid…";
      quedan.textContent = "calculando el tiempo…";
      await recorrer(0, 3, 600, mio, ponerAvance);
      fase.textContent = "Extrayendo de Google Maps";
      await recorrer(0, FICHAS, 2900, mio, (v) => {
        const n = Math.round(v);
        mensaje.textContent = `Localizando negocios en Maps (${n}/${FICHAS})…`;
        ponerAvance(3 + (v / FICHAS) * 32);
        if (n >= 20) quedan.textContent = "quedan ~1 min";
      });

      // 3. Lo que no sirve.
      marcarPaso(2);
      fase.textContent = "Filtrando fichas sin web";
      mensaje.textContent = "24 negocios sin web en su ficha (33 tienen web, 2 de otro municipio, 1 con la ficha vacía)";
      await recorrer(35, 40, 500, mio, ponerAvance);
      await espera(1900, mio);

      // 4. Uno a uno.
      marcarPaso(3);
      fase.textContent = "Verificando en el buscador";
      for (const fila of filas) {
        fila.classList.remove("fuera");
        await espera(80, mio);
      }
      // Las filas son una muestra de los 24: cada una representa su tanda, y
      // el mensaje cuenta la tanda entera como lo cuenta la app.
      const tanda = Math.ceil(CANDIDATOS / filas.length);
      for (const [i, fila] of filas.entries()) {
        const desde = i * tanda + 1;
        const hasta = Math.min(CANDIDATOS, (i + 1) * tanda);
        const nombre = fila.querySelector(".sim-fila-nombre")!.textContent;
        mensaje.textContent = `Verificando webs (${desde}-${hasta} de ${CANDIDATOS}): ${nombre} y ${hasta - desde} más`;
        fila.classList.add("mirando");
        await recorrer(40 + (i / filas.length) * 58, 40 + ((i + 1) / filas.length) * 58, 720, mio, ponerAvance);
        fila.classList.remove("mirando");
        ponerChip(fila, finales[i]);
        quedan.textContent = `quedan ~${Math.max(5, (filas.length - i - 1) * 6)} s`;
      }

      // 5. El resultado.
      marcarPaso(4);
      eyebrow.textContent = "Escaneo";
      fase.textContent = "Completado";
      ponerAvance(100);
      mensaje.textContent = "Proceso completado: 16 leads válidos de 24 candidatos";
      quedan.textContent = "";
      boton.classList.remove("cancelar");
      await espera(1500, mio);
      avance.classList.add("oculto");
      resultado.classList.remove("oculto");
      await espera(300, mio);
      await recorrer(0, 1, 900, mio, (t) =>
        cifras.forEach((c) => (c.textContent = String(Math.round(Number(c.dataset.cifra) * t)))),
      );
      if (repetir) repetir.hidden = false;
    } catch (error) {
      if (!(error instanceof Cancelada)) throw error;
    }
  }

  reiniciar();
  // La primera vez, cuando se ve casi entera: arrancar con media simulación
  // por debajo del borde es perderse la parte de escribir.
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      void reproducir();
    },
    { threshold: 0.45 },
  );
  observador.observe(raiz);
  repetir?.addEventListener("click", () => void reproducir());
}
