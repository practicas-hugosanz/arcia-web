// Un Tauri de mentira para fotografiar la app fuera de Tauri.
//
// Lo carga `capturas.mjs` antes que la interfaz. Contesta a los comandos que
// piden las pantallas con datos INVENTADOS: negocios, ciudades, cifras, el
// guion, los correos y el vendedor. Ninguno sale de una base real ni del guion
// de nadie, y así tiene que seguir: estas capturas son públicas.
//
// Rehecho el 17/11/2026 para la app 1.14 (Hoy, Correos, Resultados, la ficha
// con su web, sus señales y su muestra). Los comandos que no conoce los apunta
// en `window.__faltan` y lanzan: un `null` a un comando desconocido tumba React
// entero y la captura sale en blanco.
(function () {
  const q = new URLSearchParams(location.search);

  // La hora, fija: un martes a media mañana. Con la de verdad, una captura
  // hecha por la noche enseñaba «Cerrado, hoy ya no abre» en cada negocio.
  const FIJA = new Date(2026, 10, 17, 11, 15, 0).getTime();
  const arranque = Date.now();
  const DateReal = Date;
  class DateFija extends DateReal {
    constructor(...a) {
      if (a.length === 0) super(FIJA + (DateReal.now() - arranque));
      else super(...a);
    }
    static now() {
      return FIJA + (DateReal.now() - arranque);
    }
  }
  window.Date = DateFija;
  try {
    localStorage.setItem(
      "arcia.personalizacion",
      JSON.stringify({
        tema: q.get("tema") || "claro",
        inicio: q.get("vista") || "scan",
        hoyEstrenado: true,
        objetivoDiario: 25,
        carrilPlegado: false,
        densidad: "comoda",
        avisarAlTerminar: true,
        tutorialHecho: true,
      }),
    );
    localStorage.setItem("arcia.presupuestoNoPreguntar", "1");
  } catch (e) {}

  const ahora = new Date();
  const mezcla = q.has("mezcla");
  const hoy = ahora.toISOString().slice(0, 10);
  const dia = (d) => new Date(ahora.getTime() + d * 86400000).toISOString().slice(0, 10);
  const coma = (n) => String(n).replace(".", ",");

  // nombre, oficio, ciudad, código postal, prefijo, nota, reseñas, estado, dueño
  const negocios = [
    ["Peluquería Carmen Vidal", "Peluquería", "Madrid", "28012", "910", 4.8, 214, "interesado", "Carmen"],
    ["Taller Mecánico Ortega", "Taller mecánico", "Zaragoza", "50004", "976", 4.5, 97, "nuevo", null],
    ["Floristería Las Dalias", "Floristería", "Valencia", "46003", "960", 4.9, 63, "cita", "Lucía"],
    ["Asador Casa Julián", "Restaurante", "Burgos", "09003", "947", 4.3, 421, "no_contesta", null],
    ["Clínica Dental Sonrisa Alta", "Dentista", "Madrid", "28045", "910", 4.7, 188, "contactado", null],
    ["Carpintería Hermanos Gil", "Carpintería", "Valladolid", "47002", "983", 4.6, 31, "nuevo", "Andrés"],
    ["Autoescuela Semáforo Verde", "Autoescuela", "Sevilla", "41003", "954", 4.4, 152, "vendido", null],
    ["Panadería La Espiga", "Panadería", "Salamanca", "37002", "923", 4.5, 118, "rechazado", null],
    ["Fisioterapia Núcleo", "Fisioterapeuta", "Bilbao", "48005", "944", 4.9, 76, "nuevo", "Iker"],
  ];
  const calles = ["Calle del Olmo", "Avenida de la Estación", "Calle Mayor", "Plaza del Carmen", "Calle Real", "Paseo de la Ribera", "Calle San Roque", "Calle Nueva", "Calle del Puerto"];
  const plano = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

  // Dos con web, y mala: es lo que enseña la ficha con sus fallos y señales.
  const conWeb = {
    3: {
      calidad: "mala",
      fallos: [
        { codigo: "sin_movil", texto: "No está adaptada al móvil", peso: "fuerte" },
        { codigo: "pie_viejo", texto: "El pie dice © 2017: parece que no se toca desde entonces", peso: "leve" },
      ],
      senales: { anuncios_google: true, anuncios_meta: false, agencia: null, schema: false, blog: true, blog_ultima: "2021-03", blog_abandonado: true, plataforma: "WordPress", contacto: { correos: ["reservas@asadorcasajulian.test"], whatsapp: null, dueno: null } },
    },
    4: {
      calidad: "mejorable",
      fallos: [{ codigo: "sin_citas", texto: "No deja pedir cita desde la web", peso: "fuerte" }],
      senales: { anuncios_google: false, anuncios_meta: true, agencia: null, schema: true, blog: false, blog_ultima: null, blog_abandonado: false, plataforma: "Wix", contacto: { correos: [], whatsapp: "34600004031", dueno: { nombre: "Elena Ruiz", cargo: "Directora" } } },
    },
  };

  const guion = (name, city, rating, reviews) =>
    "## Apertura\nHola, buenos días. ¿Hablo con el responsable de " + name + "? Soy Álvaro, te robo un minuto." +
    "\n\n## Gancho\nOs he encontrado en Google: tenéis un " + coma(rating) + " con " + reviews + " reseñas, pero no aparece ninguna web vuestra." +
    "\n\n## Propuesta\nPreparo webs para negocios de " + city + ". Te enseño una hecha con vuestras fotos y vuestro horario, sin compromiso." +
    "\n\n## Cierre\n¿Te viene bien que te la enseñe el martes a media mañana?";

  const leads = negocios.map(([name, category, city, cp, prefijo, rating, reviews, status, owner], i) => {
    const web = conWeb[i];
    return {
      id: i + 1,
      name,
      owner_name: owner,
      category,
      rating,
      reviews_count: reviews,
      // Prefijo de su provincia y un bloque 00 que no se reparte a negocios.
      phone: "+34 " + prefijo + "00" + String(1203 + i * 457).padStart(4, "0"),
      email: i % 2 ? "hola@" + plano(name).slice(0, 18) + ".test" : null,
      address: calles[i] + " " + (i * 7 + 4) + ", " + cp + " " + city,
      city,
      maps_url: null,
      website: web ? "https://" + plano(name).slice(0, 16) + ".test/" : null,
      has_website: !!web,
      hours_date: hoy,
      hours_ranges: "09:30-14:00,17:00-20:30",
      hours_weekly: null,
      // El pendiente en la sexta fila: el recorte de la tabla que usa la web
      // enseña cinco, y la que tiene que salir es la de «Pendiente» sola.
      verification_status: web ? "has_web" : i === 5 ? "pending" : "verified_no_web",
      verification_evidence: null,
      generated_speech: guion(name, city, rating, reviews),
      status,
      next_action: i === 0 ? "Llamar por la tarde" : null,
      next_action_at: i < 3 ? hoy + "T10:00:00" : null,
      call_attempts: i % 3,
      last_contacted_at: null,
      do_not_call: false,
      dnc_at: null,
      dnc_reason: null,
      source: "maps",
      phone_digits: null,
      web_found_on_call: false,
      notes: null,
      source_query: category + " · " + city,
      deal_value: status === "vendido" ? 650 : null,
      sold_at: status === "vendido" ? dia(-3) : null,
      email_sent_at: i === 1 ? dia(-2) + " 10:12:00" : null,
      email_status: i === 1 ? "enviado" : null,
      email_error: null,
      email_count: i === 1 ? 1 : 0,
      photos: null,
      seen_at: i < 3 ? null : hoy,
      replied_at: null,
      seq_state: i === 1 ? "activa" : null,
      seq_step: i === 1 ? 1 : null,
      seq_next_at: i === 1 ? dia(1) : null,
      seq_stop_reason: null,
      recontact_at: null,
      verified_at: dia(-5),
      web_calidad: web ? web.calidad : null,
      web_fallos: web ? JSON.stringify(web.fallos) : null,
      web_revisada_at: web ? dia(-5) + " 18:00:00" : null,
      web_senales: web ? JSON.stringify(web.senales) : null,
      muestra_url: i === 0 ? "https://peluqueria-carmen-vidal.estudionorte.workers.dev/" : null,
      muestra_carpeta: i === 0 ? "C:/Webs/Peluqueria Carmen Vidal" : null,
      muestra_at: i === 0 ? dia(-1) + " 12:00:00" : null,
      ficha_libre: i === 2 || i === 5,
      created_at: dia(-6),
      updated_at: hoy,
    };
  });

  const ajustes = {
    mapsProvider: "direct", serpapiKey: "", googleCseKey: "", googleCseCx: "", outscraperKey: "", lang: "es", country: "es",
    descartarFichasVacias: true, verificationMode: "probe_then_rendered", probeTlds: ["es", "com"], probeMaxCandidates: 12, probeRequireCity: false,
    searchEngine: "duck_duck_go", verifyResultsCount: 10, strictDomainMatch: true, buildersCountAsWebsite: true, extraIgnoredDomains: [],
    bloquearAnuncios: true, requestDelayMs: 800, requestTimeoutSecs: 25, userAgent: "", proxyUrl: "", proxyUrls: [], backupDir: "",
    speechSections: [
      { id: "apertura", title: "Apertura", body: "Hola, ¿hablo con el responsable de {nombre}? Soy {tu_nombre}." },
      { id: "gancho", title: "Gancho", body: "Tenéis un {rating} en Google con {reseñas} reseñas y no aparece ninguna web vuestra." },
      { id: "cierre", title: "Cierre", body: "¿Te viene bien que te la enseñe el martes a media mañana?" },
    ],
    sellerName: "Álvaro", sellerZone: "Madrid", sellerBrand: "Estudio Norte", sellerWeb: "", sellerPitch: "",
    referenceBusiness: "Floristería Las Dalias", exampleUrl: "", priceRange: "entre 400 y 700 €",
    whatsappCountryCode: "34", whatsappConfirmation: "Hola, soy {tu_nombre}: te confirmo la visita el [día] a las [hora].", whatsappReminder: "Hola, te recuerdo la visita de mañana.",
    iaActiva: true, iaProveedor: "anthropic", iaModelo: "", iaDefectoAlDia: [], iaDatosAceptado: true, iaModelosAceptados: [],
    avisarFallosDeGoogle: true, compartirAprendizaje: true,
    emailProvider: "gmail", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecurity: "tls", smtpUser: "alvaro@estudionorte.test", emailFrom: "", emailFromName: "Álvaro",
    emailSubject: "Una pregunta sobre {nombre}", emailSubjectB: "Una idea para {nombre}", emailBody: "Hola:\n\nOs he encontrado en Google y he visto que no tenéis web...\n\nÁlvaro",
    emailSubjectWeb: "Vuestra web desde el móvil", emailBodyWeb: "Hola:\n\nHe abierto vuestra web en el móvil...\n\nÁlvaro",
    emailDelaySecs: 45, emailDailyLimit: 80, emailHuntPages: 3, emailWarmup: true, extraMailboxes: [],
    sequenceSteps: [
      { dia: 0, tipo: "correo", asunto: "", cuerpo: "" },
      { dia: 3, tipo: "llamada", asunto: "", cuerpo: "Llamar: ¿le llegó el correo?" },
      { dia: 7, tipo: "correo", asunto: "", cuerpo: "Hola:\n\nTe escribí hace unos días...\n\nÁlvaro" },
    ],
    recontactMonthsRejected: 6, recontactMonthsSequence: 3, staleVerificationMonths: 9,
    fallbackRating: "buena nota", fallbackReviews: "muchas", fallbackCategory: "negocio", fallbackCity: "tu zona", fallbackAddress: "tu zona",
    guionWebMalaPuesto: true,
    presupuestoEmisor: "Estudio Norte", presupuestoNif: "", presupuestoDireccion: "", presupuestoTelefono: "", presupuestoCorreo: "", presupuestoIban: "",
    presupuestoIva: 21.0, presupuestoValidezDias: 30, presupuestoIrpf: 0.0, presupuestoCondiciones: "", presupuestoTarifas: [],
    presupuestoProductos: ["web", "carta", "reservas", "citas", "google"], presupuestoAsunto: "Presupuesto {numero} para {nombre}", presupuestoCuerpo: "Hola:\n\nTe mando el presupuesto.\n\nÁlvaro",
    dataforseoLogin: "", dataforseoPassword: "", cloudflareToken: "x",
  };

  const correo = (id, n, asunto, origen) => ({
    id, leadId: n + 1, negocio: negocios[n][0], para: "hola@" + plano(negocios[n][0]).slice(0, 18) + ".test",
    asunto, cuerpo: "Hola:\n\nOs he encontrado en Google...\n\nÁlvaro", creadoAt: hoy + " 09:00:00", origen,
  });
  const trabajado = (muestra, cita) => ({ reviewsCount: 90, rating: 4.6, phone: "600000000", email: null, verificationStatus: "verified_no_web", webCalidad: null, webSenales: null, fichaLibre: null, muestra, cita, venta: false });

  const respuestas = {
    terms_status: { version: "1.9", fecha: "2026-11-05 10:00", equipo: "4KXM-92TB-7Q", huella: "x" },
    license_status: { activada: true, modoDesarrollo: false, nombre: "Álvaro", email: "alvaro@estudionorte.test", id: "AR-0001", caduca: null, diasRestantes: null, suscripcion: true, equipo: "4KXM-92TB-7Q", motivo: null },
    bases_listar: { activa: "personal", bases: [{ id: "personal", nombre: "Personal", equipo: null }] },
    equipo_estado: null,
    get_stats: { total: 512, verifiedNoWeb: 187, hasWeb: 300, pending: 25, nuevos: 3, byStatus: [], byCategory: [], avgRating: 4.5 },
    get_pulse: {
      toCall: 83, dueToday: 3, toEmail: 27, emailsToday: 9, unverified: 25, appointmentsWeek: 6, callsWeek: 71,
      lastScan: { category: "Floristería", location: "Valencia", validLeads: 14 },
    },
    get_hoy: {
      hayLeads: true, seguimientos: 3, interesados: 2, porAprobar: 4, porEscribir: 27, porLlamar: 83,
      correosHoy: 9, llamadasHoy: 11, citasHoy: 1, topeCorreos: 40,
      semana: [-6, -5, -4, -3, -2, -1, 0].map((d, i) => ({ dia: dia(d), correos: [12, 0, 8, 15, 22, 9, 9][i], llamadas: [6, 0, 9, 14, 7, 12, 11][i] })),
    },
    get_agenda: {
      overdue: [Object.assign({}, leads[0], { next_action_at: dia(-1) + "T17:00:00" })],
      today: leads.slice(1, 3),
      upcoming: [Object.assign({}, leads[3], { next_action_at: dia(2) + "T17:00:00" }), Object.assign({}, leads[4], { next_action_at: dia(4) + "T10:30:00" })],
    },
    get_leads: { leads, total: leads.length },
    get_lead: leads[0],
    get_filter_options: { categories: [...new Set(negocios.map((n) => n[1]))], cities: [...new Set(negocios.map((n) => n[2]))] },
    emails_sent_today: 9,
    email_quota_today: { tope: 40, enviados: 9, configurado: 80 },
    ui_ready: null,
    log_front: null,
    get_scan_runs: [
      { id: 4, category: "Floristería", location: "Valencia", limitRequested: 60, found: 60, validLeads: 14, status: "completed", startedAt: dia(-1) + " 18:10:00", finishedAt: dia(-1) + " 18:16:00" },
      { id: 3, category: "Taller mecánico", location: "Zaragoza", limitRequested: 60, found: 60, validLeads: 27, status: "completed", startedAt: dia(-2) + " 10:02:00", finishedAt: dia(-2) + " 10:10:00" },
      { id: 2, category: "Peluquería", location: "Madrid", limitRequested: 60, found: 38, validLeads: 0, status: "interrupted", startedAt: dia(-3) + " 17:30:00", finishedAt: null },
      { id: 1, category: "Panadería", location: "Salamanca", limitRequested: 60, found: 41, validLeads: 11, status: "completed", startedAt: dia(-4) + " 09:15:00", finishedAt: dia(-4) + " 09:21:00" },
      { id: 0, category: "Fisioterapeuta", location: "Bilbao", limitRequested: 60, found: 60, validLeads: 9, status: "completed", startedAt: dia(-5) + " 11:40:00", finishedAt: dia(-5) + " 11:47:00" },
    ],
    get_zone_yield: [
      { category: "Taller mecánico", location: "Zaragoza", found: 60, candidates: 27, runs: 1, lastScanAt: dia(-2) + " 10:10:00", topado: true, archivado: false },
      { category: "Floristería", location: "Valencia", found: 60, candidates: 14, runs: 1, lastScanAt: dia(-1) + " 18:16:00", topado: true, archivado: false },
      { category: "Panadería", location: "Salamanca", found: 41, candidates: 11, runs: 1, lastScanAt: dia(-4) + " 09:21:00", topado: false, archivado: false },
    ],
    get_conversion: [
      { niche: "Taller mecánico", city: "Zaragoza", leads: 27, called: 21, interested: 6, appointments: 4, rejected: 7, sales: 2, revenue: 1180 },
      { niche: "Floristería", city: "Valencia", leads: 14, called: 10, interested: 3, appointments: 2, rejected: 4, sales: 1, revenue: 540 },
    ],
    get_hourly_performance: [
      { hour: 9, attempts: 11, answered: 4, appointments: 0, avgDuration: 49 },
      { hour: 10, attempts: 18, answered: 11, appointments: 3, avgDuration: 102 },
      { hour: 11, attempts: 15, answered: 8, appointments: 2, avgDuration: 87 },
      { hour: 12, attempts: 13, answered: 6, appointments: 1, avgDuration: 58 },
      { hour: 13, attempts: 9, answered: 2, appointments: 0, avgDuration: 31 },
      { hour: 17, attempts: 12, answered: 8, appointments: 2, avgDuration: 141 },
      { hour: 18, attempts: 10, answered: 5, appointments: 1, avgDuration: 96 },
    ],
    get_probe_accuracy: { called: 34, webFoundOnCall: 2 },
    get_speech_performance: [
      { version: "1add17f2", leads: 64, called: 41, appointments: 7, sales: 2, filtered: 12 },
      { version: "b418514f", leads: 52, called: 33, appointments: 3, sales: 0, filtered: 15 },
    ],
    get_embudo: {
      tramos: [
        { nombre: "Encontrados", cuantos: 512, paso: null, delTotal: 100 },
        { nombre: "Aptos (sin web)", cuantos: 187, paso: 36.5, delTotal: 36.5 },
        { nombre: "Contactables", cuantos: 151, paso: 80.7, delTotal: 29.5 },
        { nombre: "Citas", cuantos: 14, paso: 9.3, delTotal: 2.7 },
        { nombre: "Presupuestos", cuantos: 8, paso: 57.1, delTotal: 1.6 },
        { nombre: "Ventas", cuantos: 5, paso: 62.5, delTotal: 1 },
      ],
      queSeVende: [],
      porNicho: [
        { clave: "Peluquería · Madrid", encontrados: 96, aptos: 51, contactables: 33, citas: 6, ventas: 3, euros: 2400, citasPorCien: 18.2 },
        { clave: "Floristería · Valencia", encontrados: 74, aptos: 40, contactables: 26, citas: 4, ventas: 1, euros: 790, citasPorCien: 15.4 },
        { clave: "Taller mecánico · Zaragoza", encontrados: 61, aptos: 28, contactables: 19, citas: 2, ventas: 1, euros: 850, citasPorCien: 10.5 },
      ],
      porCiudad: [
        { clave: "Madrid", encontrados: 168, aptos: 78, contactables: 52, citas: 8, ventas: 3, euros: 2400, citasPorCien: 15.4 },
        { clave: "Valencia", encontrados: 121, aptos: 55, contactables: 34, citas: 4, ventas: 1, euros: 790, citasPorCien: 11.8 },
      ],
      citas30: 9, ventas30: 3, euros30: 2250, eurosTotal: 4040, ticketMedio: 808, sinMarcar: false, citasFuera: 0, ventasFuera: 0,
      asuntos: [
        { asunto: "Una pregunta sobre {nombre}", nicho: "Peluquería", enviados: 80, contestan: 9, interesados: 3, bajas: 1 },
        { asunto: "Una idea para {nombre}", nicho: "Peluquería", enviados: 75, contestan: 4, interesados: 1, bajas: 2 },
        { asunto: "Una pregunta sobre {nombre}", nicho: "Floristería", enviados: 60, contestan: 5, interesados: 2, bajas: 0 },
        { asunto: "Una idea para {nombre}", nicho: "Floristería", enviados: 58, contestan: 2, interesados: 0, bajas: 1 },
      ],
      trabajados: [
        ...Array.from({ length: 18 }, (_, i) => trabajado("antes", i < 7)),
        ...Array.from({ length: 22 }, (_, i) => trabajado(null, i < 3)),
      ],
    },
    get_pending_queue: [],
    get_settings: ajustes,
    email_password_saved: true,
    email_modo: { conectado: true },
    estado_buzon: { listo: true, comprobado: true, problemas: [], freno: null },
    get_template_variables: [{ name: "nombre", description: "Nombre del negocio" }, { name: "tu_nombre", description: "Tu nombre" }],
    get_mecanismos: [],
    count_pending_hunt: 0,
    ia_estado: {
      activa: true, proveedor: "anthropic", modeloEfectivo: "claude-sonnet-5", modeloPorDefecto: "claude-sonnet-5",
      entrenaClausula: "", entrenaSalida: "", hayClave: true, clavePrestada: false, dondeSacarLaClave: "", modeloEntrena: false,
    },
    ia_cupo_webs: { hechas: 1, aviso: null, quedan: null, proveedor: "Anthropic" },
    estado_agente: { activo: true, conFiltro: true, pendientes: 4 },
    bandeja: [
      correo(1, 1, "Una pregunta sobre Taller Mecánico Ortega", "ia"),
      correo(2, 5, "Una idea para Carpintería Hermanos Gil", "ia"),
      correo(3, 8, "Una pregunta sobre Fisioterapia Núcleo", "plantilla"),
      correo(4, 3, "Vuestra web desde el móvil", "ia"),
    ],
    list_replies: [
      { id: 1, leadId: 1, leadName: negocios[0][0], address: "hola@peluqueriacarmen.test", receivedAt: dia(-1) + " 11:20:00", clase: "interesado", frase: "Sí, me interesa, ¿cuándo puedes pasar?", leadStatus: "interesado", deshecha: false, ignorada: null },
      { id: 2, leadId: 8, leadName: negocios[7][0], address: "hola@panaderialaespiga.test", receivedAt: dia(-2) + " 16:05:00", clase: "no_interesa", frase: "Gracias, de momento no.", leadStatus: "rechazado", deshecha: false, ignorada: null },
    ],
    sequence_summary: { activas: 12, paraHoy: 3, terminadas: 5, contestaron: 2, paradas: 1, buzon: null },
    prever_secuencia: { empezadas: 1, desdeElSegundo: 0, saltadas: [] },
    saltos_de_la_tanda: [],
    get_lead_sequence: null,
    muestra_lista: true,
    publicar_muestra: null,
    retirar_muestra: null,
    estado_segundo_plano: { alCerrar: true, conWindows: false },
    fijar_cerrar_al_reloj: null,
    fijar_arranque_con_windows: null,
    gasto_dataforseo: { dolares: 0, busquedas: 0 },
    get_call_history: [],
    get_lead_photos: [],
    is_scanning: false,
    count_pending_verification: 0,
    mark_lead_seen: null,
    listar_presupuestos: [],
    revisando_webs: false,
    equipo_reservas: {},
    license_payment_link: null,
    cupo_maps_hoy: { usadas: 120, tope: 400, pausaHasta: null },
    auto_enrich_reviews: { missing: 0, updated: 0, queriesChecked: 0, cardsSeen: 0, cardsWithCounter: 0, skipped: true },
  };
  respuestas.log_call = { lead: leads[0], attemptId: 1 };

  // La lista de Leads, con el filtro que pide la pestaña: «Sin web» no enseña
  // los que tienen web, y «Web mala» o «Mejorable» solo los suyos.
  const filtrar = (f) => {
    let lista = leads;
    // `?mezcla`: verificados y pendientes juntos, para el recorte de los tres
    // estados de la página de verificación.
    if (mezcla) lista = lista.filter((l) => !l.has_website);
    else if (f.verificationStatus === "web_mala") lista = lista.filter((l) => l.web_calidad === "mala");
    else if (f.verificationStatus === "web_mejorable") lista = lista.filter((l) => l.web_calidad === "mejorable");
    else if (f.verificationStatus) lista = lista.filter((l) => l.verification_status === f.verificationStatus);
    if (f.onlyWithoutWebsite) lista = lista.filter((l) => !l.has_website);
    return { leads: lista, total: lista.length };
  };

  window.__faltan = [];
  let n = 1;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    transformCallback: () => n++,
    unregisterCallback: () => {},
    convertFileSrc: (p) => p,
    invoke: async (cmd, args) => {
      if (cmd === "get_leads") {
        window.__filtros = (window.__filtros || []).concat([args && args.filter]);
        return filtrar((args && args.filter) || {});
      }
      if (cmd === "is_hunting_emails") return null;
      if (cmd === "is_sending_email") return false;
      if (cmd.startsWith("plugin:event|")) return n++;
      if (cmd.startsWith("plugin:window|")) return false;
      if (cmd === "plugin:app|version") return "1.14.16";
      if (cmd.startsWith("plugin:")) return null;
      if (cmd in respuestas) return JSON.parse(JSON.stringify(respuestas[cmd]));
      if (cmd.startsWith("count_")) return 0;
      window.__faltan.push(cmd);
      throw "sin datos de prueba para " + cmd;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
})();
