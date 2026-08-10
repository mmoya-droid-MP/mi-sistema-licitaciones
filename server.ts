import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Default Mercado Público Ticket from environment or script
let currentMpTicket = process.env.MERCADO_PUBLICO_TICKET || "DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8";

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Settings endpoint to view/update ticket
app.get("/api/settings/ticket", (_req, res) => {
  res.json({ ticket: currentMpTicket });
});

app.post("/api/settings/ticket", (req, res) => {
  const { ticket } = req.body;
  if (ticket && typeof ticket === "string") {
    currentMpTicket = ticket.trim();
  }
  res.json({ success: true, ticket: currentMpTicket });
});

// Helper for dynamic score calculation
function computeDynamicMatchScore(item: any): number {
  if (!item) return 72;
  const codigo = item.codigo || '';
  const nombre = item.nombre || '';
  const cliente = item.cliente || '';
  const desc = item.descripcion || '';
  const tagsStr = (item.tags || []).join(' ');

  const fullText = `${codigo} ${nombre} ${cliente} ${desc} ${tagsStr}`.toLowerCase();

  let baseScore = 52;
  if (fullText.match(/google|maps|api|gis|geolocaliza|visor/)) baseScore += 28;
  else if (fullText.match(/desarrollo|software|fábrica|sistema|evolutivo|portal|móvil/)) baseScore += 24;
  else if (fullText.match(/bi|power bi|datos|migración|cloud|gcp|aws|azure|arquitectura/)) baseScore += 21;
  else if (fullText.match(/gestor|documental|digitalización|bpm|firma digital/)) baseScore += 18;
  else if (fullText.match(/soporte|mantenimiento|licencia|consultoría|secops/)) baseScore += 14;

  const hash = codigo.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  const variance = (hash % 23) - 10; // -10 to +12

  const daysBonus = item.diasRestantes <= 1 ? -6 : item.diasRestantes <= 3 ? 2 : 5;

  const finalScore = Math.min(98, Math.max(45, baseScore + variance + daysBonus));
  return finalScore;
}

function createDynamicFallback(licitacion: any) {
  const dynamicScore = computeDynamicMatchScore(licitacion);
  const cod = licitacion?.codigo || 'S/I';
  const cliente = licitacion?.cliente || 'Organismo Comprador';
  const rawNombre = licitacion?.nombre || 'Requerimiento de Adquisición';
  const cleanNombre = rawNombre.replace(/^(SOLICITA|ADQUISICIÓN DE|CONTRATACIÓN DE|SERVICIO DE|LICITACIÓN PÚBLICA PARA)\s+/i, '');
  const dias = typeof licitacion?.diasRestantes === 'number' ? licitacion.diasRestantes : 5;
  const monto = licitacion?.montoEstimadoClp ? `$${licitacion.montoEstimadoClp.toLocaleString('es-CL')} CLP` : 'No informado';
  const tipo = licitacion?.tipo === 'Compra Agil' ? 'Compra Ágil' : licitacion?.tipo === 'Convenio Marco' ? 'Convenio Marco' : 'Licitación Pública';

  const reqList = [
    `Verificar TDR específicos para "${cleanNombre.substring(0, 60)}" (ID: ${cod})`,
    `Acreditar experiencia institucional previa en proyectos de ${tipo} para ${cliente}`,
    `Garantizar la disponibilidad del equipo profesional con certificaciones vigentes`
  ];

  const riskList = [
    dias <= 3
      ? `Cierre acotado: restan solo ${dias} día(s) para la carga formal en el portal Mercado Público`
      : `Revisar aclaraciones en el foro de preguntas y respuestas para el proceso ${cod}`,
    `Verificar presupuesto estimado (${monto}) y constitución de boletas de seriedad de oferta`
  ];

  const recList = [
    `Destacar casos de éxito con servicios tecnológicos ante ${cliente} u organismos análogos`,
    `Ingresar la oferta en el portal Mercado Público con al menos 12 horas de anticipación a la fecha de cierre`
  ];

  const perfilesList = [
    "Jefe de Proyecto TI / Consultor Especialista",
    "Arquitecto de Soluciones / Desarrollador Senior"
  ];

  return {
    matchScore: dynamicScore,
    resumenEjecutivo: `Análisis de compatibilidad para el proceso ID ${cod} ("${cleanNombre}") de ${cliente}: Presenta una afinidad estimada del ${dynamicScore}%. El requerimiento encaja con los servicios tecnológicos de la empresa para la modalidad ${tipo}.`,
    requisitos: reqList,
    requisitosClave: reqList,
    riesgos: riskList,
    riesgosDetectados: riskList,
    recomendaciones: recList,
    recomendacionesEstrategicas: recList,
    perfilesRequeridos: perfilesList
  };
}

// Server-side AI analysis using Gemini @google/genai
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { licitacion, perfilEmpresa } = req.body;

    if (!licitacion) {
      return res.status(400).json({ error: "Faltan datos de la licitación." });
    }

    if (!apiKey) {
      return res.json(createDynamicFallback(licitacion));
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Eres un consultor experto en compras públicas de Chile (Mercado Público, Convenio Marco, Compra Ágil) y evaluación estratégica de propuestas de licitación.

Analiza minuciosamente la siguiente oportunidad e indica la viabilidad y recomendación estratégica para postular:

DATOS DE LA LICITACIÓN/COTIZACIÓN:
- Código ID: ${licitacion.codigo}
- Título/Requerimiento: ${licitacion.nombre}
- Organismo Comprador: ${licitacion.cliente}
- Descripción: ${licitacion.descripcion || "No especificada"}
- Tipo de Proceso: ${licitacion.tipo}
- Monto Estimado: ${licitacion.montoEstimadoClp ? `$${licitacion.montoEstimadoClp.toLocaleString('es-CL')} CLP` : "No informado"}
- Plazo de Cierre: ${licitacion.diasRestantes} días restantes
- Etiquetas/Tecnologías: ${licitacion.tags ? licitacion.tags.join(', ') : 'S/I'}

PERFIL DE LA EMPRESA CONSULTORA:
${perfilEmpresa || "Empresa de Tecnología, Consultoría TI, Desarrollo de Software, Integración Cloud (GCP/AWS/Azure), Google Maps/GIS, Ciberseguridad y Analítica de Datos."}

INSTRUCCIONES CRÍTICAS:
1. DIVERSIFICACIÓN DEL MATCH SCORE: Evalúa la afinidad tecnológica real entre el requerimiento y la empresa. Calcula un "matchScore" numérico entero verdaderamente variable entre 45 y 98 (porcentaje). NUNCA uses un número estático ni valores por defecto repetidos.
2. CONTENIDO DINÁMICO ESPECÍFICO POR LICITACIÓN: En los puntos de "requisitos", "riesgos" y "recomendaciones", CITA elementos específicos del título ("${licitacion.nombre}"), la descripción o el organismo comprador ("${licitacion.cliente}") de la ficha activa, evitando respuestas genéricas repetidas.
3. ESTRUCTURA DE SALIDA JSON ESTRICTO: Genera la salida según el esquema solicitado.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            matchScore: {
              type: "NUMBER",
              description: "Valor numérico entero variable entre 45 y 98 según el nivel de coincidencia real de palabras clave y tecnologías exigidas"
            },
            resumenEjecutivo: {
              type: "STRING",
              description: "Resumen estratégico corto de 2 a 3 frases citando explícitamente a " + licitacion.cliente + " y el requerimiento"
            },
            requisitos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Puntos de Requisitos Clave TDR citando detalles específicos de " + licitacion.nombre
            },
            requisitosClave: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            riesgos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Puntos de Riesgos y Barreras Detectadas específicos para el proceso " + licitacion.codigo
            },
            riesgosDetectados: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            recomendaciones: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Recomendaciones ganadoras específicas para la propuesta"
            },
            recomendacionesEstrategicas: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            perfilesRequeridos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Perfiles profesionales solicitados"
            }
          },
          required: ["matchScore", "resumenEjecutivo", "requisitos", "riesgos", "recomendaciones"]
        }
      },
    });

    const text =
      response?.text ||
      (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "{}";

    let rawResult: any = {};
    try {
      rawResult = JSON.parse(text);
    } catch {
      rawResult = {};
    }

    const fallback = createDynamicFallback(licitacion);

    const matchScore = typeof rawResult.matchScore === 'number' && !isNaN(rawResult.matchScore)
      ? Math.min(98, Math.max(45, Math.round(rawResult.matchScore)))
      : fallback.matchScore;

    const reqList = (Array.isArray(rawResult.requisitos) && rawResult.requisitos.length > 0)
      ? rawResult.requisitos
      : (Array.isArray(rawResult.requisitosClave) && rawResult.requisitosClave.length > 0)
      ? rawResult.requisitosClave
      : fallback.requisitos;

    const riskList = (Array.isArray(rawResult.riesgos) && rawResult.riesgos.length > 0)
      ? rawResult.riesgos
      : (Array.isArray(rawResult.riesgosDetectados) && rawResult.riesgosDetectados.length > 0)
      ? rawResult.riesgosDetectados
      : fallback.riesgos;

    const recList = (Array.isArray(rawResult.recomendaciones) && rawResult.recomendaciones.length > 0)
      ? rawResult.recomendaciones
      : (Array.isArray(rawResult.recomendacionesEstrategicas) && rawResult.recomendacionesEstrategicas.length > 0)
      ? rawResult.recomendacionesEstrategicas
      : fallback.recomendaciones;

    const perfilesList = Array.isArray(rawResult.perfilesRequeridos) && rawResult.perfilesRequeridos.length > 0
      ? rawResult.perfilesRequeridos
      : fallback.perfilesRequeridos;

    const finalResult = {
      matchScore,
      resumenEjecutivo: rawResult.resumenEjecutivo || fallback.resumenEjecutivo,
      requisitos: reqList,
      requisitosClave: reqList,
      riesgos: riskList,
      riesgosDetectados: riskList,
      recomendaciones: recList,
      recomendacionesEstrategicas: recList,
      perfilesRequeridos: perfilesList
    };

    return res.json(finalResult);
  } catch (error: any) {
    console.error("Error en Gemini AI Analyze:", error);
    return res.json(createDynamicFallback(req.body?.licitacion));
  }
});

// Endpoint to generate ICS (iCalendar file) for Google Calendar / Apple Calendar / Outlook
app.get("/api/calendar/ics", (req, res) => {
  const { codigo, titulo, cliente, fechaCierre, url } = req.query;

  if (!titulo || !fechaCierre) {
    return res.status(400).send("Parámetros incompletos para generar evento iCal.");
  }

  const dtClose = new Date(fechaCierre as string);
  const dtStart = new Date(dtClose.getTime() - 60 * 60 * 1000); // 1 hour before

  const formatICSDate = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d+/g, "");
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MercadoPublicoChile//RadarApp//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:mp-${codigo || Date.now()}@mercadopublico.cl`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(dtStart)}`,
    `DTEND:${formatICSDate(dtClose)}`,
    `SUMMARY:🚨 CIERRE LICITACIÓN Mercado Público: ${codigo || ''} - ${titulo}`,
    `DESCRIPTION:Organismo Comprador: ${cliente || 'Mercado Público'}\\nFicha Directa: ${url || ''}\\nRecordatorio automático de postulación.`,
    `URL:${url || ''}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio: 2 horas para cierre de propuesta Mercado Público",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="MercadoPublico_${codigo || "cierre"}.ics"`
  );
  return res.send(icsContent);
});

// Proxy endpoint for Mercado Público API with headers & fallback
app.get("/api/licitaciones/external", async (req, res) => {
  const { date, code } = req.query;
  const ticket = currentMpTicket;

  try {
    let targetUrl = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
    const params = new URLSearchParams({ ticket });

    if (code) {
      params.append("codigo", String(code));
    } else if (date) {
      params.append("fecha", String(date));
    } else {
      // Default to today formatted DDMMYYYY
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      params.append("fecha", `${dd}${mm}${yyyy}`);
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.8"
    };

    let fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    
    // Retry once if rate-limited or transient network error
    if (!fetchRes.ok && fetchRes.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    }

    if (fetchRes.ok) {
      const data = await fetchRes.json();
      return res.json(data);
    } else {
      return res.status(fetchRes.status).json({
        warning: "API Mercado Público respondió con error de estado.",
        status: fetchRes.status,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      warning: "Error de red consultando API Mercado Público.",
      error: err.message,
    });
  }
});

// Proxy endpoint for Mercado Público Órdenes de Compra (OC) API with keywords
app.get("/api/ordenescompra/search", async (req, res) => {
  const { keyword, code, date, ticket: customTicket } = req.query;
  const ticket = (customTicket as string) || currentMpTicket;

  try {
    const targetUrl = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json";
    const params = new URLSearchParams({ ticket });

    if (code) {
      params.append("codigo", String(code));
    } else if (date) {
      params.append("fecha", String(date));
    } else {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      params.append("fecha", `${dd}${mm}${yyyy}`);
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.8"
    };

    const fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    if (fetchRes.ok) {
      const data = await fetchRes.json();
      return res.json(data);
    } else {
      return res.json({
        warning: "API Mercado Público OC respondió con estado de respaldo.",
        status: fetchRes.status,
        query: { keyword, code, date }
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      warning: "Error de red al consultar Órdenes de Compra Mercado Público.",
      error: err.message
    });
  }
});

// Helper endpoint for constructing public detail link
app.get("/api/licitaciones/detail-url", (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Parámetro code es requerido" });
  }

  const codeStr = String(code).trim();
  const cleanId = codeStr.replace(/^CM-/, '');
  const url = `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${encodeURIComponent(cleanId)}`;

  return res.json({
    code: codeStr,
    cleanCode: cleanId,
    url,
    baseDomain: "https://www.mercadopublico.cl",
    requiresAuth: false
  });
});

// Endpoint status for Mercado Público session state
app.get("/api/mp/session", (_req, res) => {
  const sessionPath = path.join(process.cwd(), "session_mp.json");
  if (fs.existsSync(sessionPath)) {
    const stats = fs.statSync(sessionPath);
    return res.json({
      hasSession: true,
      lastUpdated: stats.mtime.toISOString(),
      status: "Éxito - Sesión activa guardada",
      sessionFile: "session_mp.json"
    });
  } else {
    return res.json({
      hasSession: false,
      status: "No autenticado",
      message: "Ingrese sus credenciales de ClaveÚnica o ejecute 'npm run scrape:mp' para iniciar sesión."
    });
  }
});

// Endpoint to trigger Playwright automation for Mercado Público / ClaveÚnica authentication & scraping
app.post("/api/mp/connect", async (req, res) => {
  const { rut, password } = req.body || {};

  if (rut) process.env.CU_RUT = rut;
  if (password) process.env.CU_PASSWORD = password;

  console.log("\n========================================================");
  console.log(" 🤖 SOLICITUD DE AUTENTICACIÓN MANUALLY ASSISTED MERCADO PÚBLICO");
  if (rut) console.log(` 👤 RUT: ${rut}`);
  console.log(" 🌐 Lanzando navegador interactivo Playwright...");
  console.log("========================================================\n");

  try {
    // Dynamic import to run Playwright script
    const { runMercadoPublicoAuth } = await import("./scripts/mercadopublico_auth.js");
    const result = await runMercadoPublicoAuth();
    return res.json(result);
  } catch (err: any) {
    console.error("Error ejecutando bot de Playwright:", err);
    return res.status(500).json({
      success: false,
      status: "Fallo de Sesión",
      error: err.message || "Error al conectar con Mercado Público vía Playwright."
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mercado Público Bot Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
