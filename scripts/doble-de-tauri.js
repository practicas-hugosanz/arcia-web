// Un Tauri de mentira para fotografiar la app fuera de Tauri.
//
// Lo carga `capturas.mjs` antes que la interfaz. Contesta a los comandos que
// piden las pantallas de Prospección, Llamar, Leads y Agenda con datos
// INVENTADOS: negocios, ciudades, cifras, el guion y el vendedor. Ninguno sale
// de una base real ni del guion de nadie, y así tiene que seguir: estas
// capturas son públicas.
(function () {
  const q = new URLSearchParams(location.search);
  try {
    const previo = JSON.parse(localStorage.getItem("arcia.personalizacion") || "{}");
    localStorage.setItem(
      "arcia.personalizacion",
      JSON.stringify({ ...previo, tema: q.get("tema") || "claro", inicio: q.get("vista") || "scan", carrilPlegado: false, tutorialHecho: true }),
    );
  } catch (e) {}

  const hoy = new Date().toISOString().slice(0, 10);
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

  const leads = negocios.map(([name, category, city, cp, prefijo, rating, reviews, status, owner], i) => ({
    id: i + 1,
    name,
    owner_name: owner,
    category,
    rating,
    reviews_count: reviews,
    // Prefijo de su provincia y un bloque 00 que no se reparte a negocios.
    phone: "+34 " + prefijo + "00" + String(1203 + i * 457).padStart(4, "0"),
    email: i % 2 ? "hola@" + name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 14) + ".es" : null,
    address: calles[i] + " " + (i * 7 + 4) + ", " + cp + " " + city,
    city,
    maps_url: null,
    website: null,
    has_website: false,
    hours_date: hoy,
    hours_ranges: "09:30-14:00,17:00-20:30",
    hours_weekly: null,
    // El pendiente en la cuarta fila: el recorte de la tabla que usa la web
    // enseña cinco, y es la fila que tiene que salir.
    verification_status: i === 3 ? "pending" : "verified_no_web",
    verification_evidence: null,
    generated_speech:
      "## Apertura\nHola, buenos días. ¿Hablo con el responsable de " + name + "? Soy Álvaro, te robo un minuto." +
      "\n\n## Gancho\nOs he encontrado en Google: tenéis un " + coma(rating) + " con " + reviews + " reseñas, pero no aparece ninguna web vuestra." +
      "\n\n## Propuesta\nPreparo webs para negocios de " + city + ". Te enseño una hecha con vuestras fotos y vuestro horario, sin compromiso." +
      "\n\n## Cierre\n¿Te viene bien que te la enseñe el martes a media mañana?",
    status,
    next_action: null,
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
    deal_value: null,
    sold_at: null,
    email_sent_at: null,
    email_status: null,
    email_error: null,
    email_count: 0,
    photos: null,
    seen_at: i < 3 ? null : hoy,
    created_at: hoy,
    updated_at: hoy,
  }));

  const respuestas = {
    license_status: { activada: true, modoDesarrollo: true, nombre: "", email: "", id: "", caduca: null, diasRestantes: null, suscripcion: false, equipo: "4KXM-92TB-7Q", motivo: null },
    get_stats: { total: 512, verifiedNoWeb: 96, hasWeb: 391, pending: 25, nuevos: 3, byStatus: [], byCategory: [], avgRating: 4.5 },
    get_pulse: {
      toCall: 83, dueToday: 3, toEmail: 27, emailsToday: 9, unverified: 25, appointmentsWeek: 6, callsWeek: 71,
      lastScan: { category: "Floristería", location: "Valencia", validLeads: 14 },
    },
    get_agenda: { overdue: leads.slice(0, 1), today: leads.slice(1, 3), upcoming: leads.slice(3, 5) },
    get_leads: { leads, total: leads.length },
    get_filter_options: { categories: [...new Set(negocios.map((n) => n[1]))], cities: [...new Set(negocios.map((n) => n[2]))] },
    emails_sent_today: 9,
    ui_ready: null,
    log_front: null,
    get_scan_runs: [
      { id: 4, category: "Floristería", location: "Valencia", limitRequested: 60, found: 60, validLeads: 14, status: "completed", startedAt: "2026-09-12 18:10:00", finishedAt: "2026-09-12 18:16:00" },
      { id: 3, category: "Taller mecánico", location: "Zaragoza", limitRequested: 60, found: 60, validLeads: 27, status: "completed", startedAt: "2026-09-11 10:02:00", finishedAt: "2026-09-11 10:10:00" },
      { id: 2, category: "Peluquería", location: "Madrid", limitRequested: 60, found: 38, validLeads: 0, status: "interrupted", startedAt: "2026-09-10 17:30:00", finishedAt: null },
      { id: 1, category: "Panadería", location: "Salamanca", limitRequested: 60, found: 41, validLeads: 11, status: "completed", startedAt: "2026-09-09 09:15:00", finishedAt: "2026-09-09 09:21:00" },
      // El quinto no es de relleno: con cuatro, las dos columnas del tablero
      // no tenían ningún alto de ventana con hueco a la vez y la captura de
      // Prospección salía con una tarjeta partida por abajo.
      { id: 0, category: "Fisioterapeuta", location: "Bilbao", limitRequested: 60, found: 60, validLeads: 9, status: "completed", startedAt: "2026-09-08 11:40:00", finishedAt: "2026-09-08 11:47:00" },
    ],
    get_zone_yield: [
      { category: "Taller mecánico", location: "Zaragoza", found: 60, candidates: 27, runs: 1, lastScanAt: "2026-09-11 10:10:00", topado: true, archivado: false },
      { category: "Floristería", location: "Valencia", found: 60, candidates: 14, runs: 1, lastScanAt: "2026-09-12 18:16:00", topado: true, archivado: false },
      { category: "Panadería", location: "Salamanca", found: 41, candidates: 11, runs: 1, lastScanAt: "2026-09-09 09:21:00", topado: false, archivado: false },
    ],
    get_conversion: [
      { niche: "Taller mecánico", city: "Zaragoza", leads: 27, called: 21, interested: 6, appointments: 4, rejected: 7, sales: 2, revenue: 1180 },
      { niche: "Floristería", city: "Valencia", leads: 14, called: 10, interested: 3, appointments: 2, rejected: 4, sales: 1, revenue: 540 },
    ],
    get_hourly_performance: [
      { hour: 10, attempts: 18, answered: 11, appointments: 3, avgDuration: 102 },
      { hour: 12, attempts: 13, answered: 6, appointments: 1, avgDuration: 58 },
      { hour: 17, attempts: 12, answered: 8, appointments: 2, avgDuration: 141 },
    ],
    get_probe_accuracy: { called: 34, webFoundOnCall: 2 },
    // Dos versiones del guion, para que la comparación de «Qué guion cierra»
    // tenga algo que comparar. Inventadas, como todo lo de aquí.
    get_speech_performance: [
      { version: "1add17f2", leads: 64, called: 41, appointments: 7, sales: 2, filtered: 12 },
      { version: "b418514f", leads: 52, called: 33, appointments: 3, sales: 0, filtered: 15 },
    ],
    get_embudo: {
      tramos: [
        { nombre: "Encontrados", cuantos: 512, paso: null, delTotal: 100 },
        { nombre: "Sin web", cuantos: 187, paso: 36.5, delTotal: 36.5 },
        { nombre: "Con correo", cuantos: 96, paso: 51.3, delTotal: 18.8 },
        { nombre: "Citas", cuantos: 14, paso: 14.6, delTotal: 2.7 },
        { nombre: "Ventas", cuantos: 5, paso: 35.7, delTotal: 1 },
      ],
      porNicho: [
        { clave: "Peluquería · Madrid", encontrados: 96, aptos: 51, contactables: 33, citas: 6, ventas: 3, euros: 2400, citasPorCien: 18.2 },
        { clave: "Floristería · Valencia", encontrados: 74, aptos: 40, contactables: 26, citas: 4, ventas: 1, euros: 790, citasPorCien: 15.4 },
        { clave: "Taller mecánico · Zaragoza", encontrados: 61, aptos: 28, contactables: 19, citas: 2, ventas: 1, euros: 850, citasPorCien: 10.5 },
      ],
      porCiudad: [
        { clave: "Madrid", encontrados: 168, aptos: 78, contactables: 52, citas: 8, ventas: 3, euros: 2400, citasPorCien: 15.4 },
        { clave: "Valencia", encontrados: 121, aptos: 55, contactables: 34, citas: 4, ventas: 1, euros: 790, citasPorCien: 11.8 },
      ],
      citas30: 9,
      ventas30: 3,
      euros30: 2250,
      eurosTotal: 4040,
      ticketMedio: 808,
      sinMarcar: false,
    },
    get_pending_queue: [],
    get_settings: {
      mapsProvider: "scraping", serpapiKey: "", googleCseKey: "", googleCseCx: "", outscraperKey: "", lang: "es", country: "es",
      descartarFichasVacias: true, verificationMode: "probe_then_rendered", probeTlds: ["es", "com"], probeMaxCandidates: 12, probeRequireCity: false,
      searchEngine: "duckduckgo", verifyResultsCount: 10, strictDomainMatch: true, buildersCountAsWebsite: false, extraIgnoredDomains: [],
      bloquearAnuncios: true, requestDelayMs: 800, requestTimeoutSecs: 25, userAgent: "", proxyUrl: "", proxyUrls: [], backupDir: "",
      speechSections: [
        { id: "apertura", title: "Apertura", body: "Hola, ¿hablo con el responsable de {nombre}? Soy {tu_nombre}." },
        { id: "gancho", title: "Gancho", body: "Tenéis un {rating} en Google con {reseñas} reseñas y no aparece ninguna web vuestra." },
      ],
      sellerName: "Álvaro", sellerZone: "Madrid", sellerBrand: "Estudio Norte", referenceBusiness: "Floristería Las Dalias", exampleUrl: "", priceRange: "",
      whatsappCountryCode: "34", whatsappConfirmation: "Hola {nombre}, te confirmo la visita el {dia} a las {hora}.", whatsappReminder: "Hola {nombre}, te recuerdo la visita de mañana.",
      iaActiva: false, iaProveedor: "anthropic", iaModelo: "", iaDatosAceptado: false,
      emailProvider: "gmail", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecurity: "tls", smtpUser: "", emailFrom: "", emailFromName: "Álvaro",
      emailSubject: "Una pregunta sobre {nombre}", emailBody: "Hola,\n\nOs he encontrado en Google...", emailDelaySecs: 45, emailDailyLimit: 80, emailHuntPages: 3,
      fallbackRating: "buena nota", fallbackReviews: "muchas", fallbackCategory: "negocio", fallbackCity: "tu zona", fallbackAddress: "",
    },
    email_password_saved: true,
    get_template_variables: [{ name: "nombre", description: "Nombre del negocio" }, { name: "tu_nombre", description: "Tu nombre" }],
    get_mecanismos: [],
    ia_estado: { clavePuesta: false, modelos: [] },
    count_pending_hunt: 0,
    // La IA encendida y con clave: es lo que hace que la ficha enseñe el
    // bloque «Web de muestra» que fotografía la sección de IA de la web.
    ia_estado: {
      activa: true, proveedor: "anthropic", modeloEfectivo: "claude-sonnet-5", modeloPorDefecto: "claude-sonnet-5",
      entrenaClausula: "", entrenaSalida: "", hayClave: true, clavePrestada: false, dondeSacarLaClave: "", modeloEntrena: false,
    },
    ia_cupo_webs: { hechas: 0, aviso: null, quedan: null, proveedor: "Anthropic" },
    get_call_history: [],
    get_lead_photos: [],
  };
  respuestas.log_call = { lead: leads[0], attemptId: 1 };

  let n = 1;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    transformCallback: () => n++,
    unregisterCallback: () => {},
    convertFileSrc: (p) => p,
    invoke: async (cmd) => {
      if (cmd === "is_hunting_emails") return null;
      if (cmd === "is_sending_email") return false;
      if (cmd.startsWith("plugin:event|")) return n++;
      if (cmd.startsWith("plugin:window|")) return false;
      if (cmd === "plugin:app|version") return "1.6.53";
      if (cmd in respuestas) return respuestas[cmd];
      if (cmd.startsWith("count_")) return 0;
      // Lanzar y no devolver null: un null a un comando desconocido tumba
      // React entero y la captura sale en blanco.
      throw "sin datos de prueba para " + cmd;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
})();
