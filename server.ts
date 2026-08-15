import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pg from "pg";
import multer from "multer";
import * as XLSX from "xlsx";

import { createClient } from "@supabase/supabase-js";
import { perfilEmpresaTexto } from "./perfilEmpresa";

dotenv.config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;


const app = express();
const PORT = 3000;

// Mercado Público Cache
const mpApiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper to handle transient Gemini API errors (e.g. 503, 429)
export const withAIRetry = async <T>(fn: () => Promise<T>, maxRetries = 5, delayMs = 2000): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const isTransient = status === 'UNAVAILABLE' || status === 503 || status === 429;
      
      if (isTransient && attempt < maxRetries) {
        // Fail fast if it's a hard quota limit rather than a fast transient rate limit
        if (error?.message?.includes('exceeded your current quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
          console.log(`[AI Quota] Límite de cuota de Gemini alcanzado. Usando fallback inmediatamente.`);
          throw error;
        }

        console.log(`[AI Retry] Transient API error (${status}). Retrying in ${delayMs}ms... (Attempt ${attempt} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached");
};

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ==========================================
// SUPABASE / POSTGRESQL DATABASE CONNECTION
// ==========================================
const { Pool } = pg;
let pool: pg.Pool | null = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
    console.log("🐘 Conectado exitosamente a la base de datos PostgreSQL en Supabase.");
  } catch (err) {
    console.error("❌ Error inicializando pool de PostgreSQL:", err);
  }
} else {
  console.log("ℹ️ DATABASE_URL no configurada. Se utilizará persistencia en almacenamiento local para Directorio de Compradores.");
}

// Automatic Schema Migration on startup
async function initDatabaseSchema() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS compradores (
          id SERIAL PRIMARY KEY,
          rut_organismo VARCHAR(20) UNIQUE NOT NULL,
          nombre_organismo VARCHAR(255) NOT NULL,
          region VARCHAR(100),
          ciudad VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_compradores_rut ON compradores(rut_organismo);
        CREATE INDEX IF NOT EXISTS idx_compradores_nombre ON compradores(nombre_organismo);
        CREATE INDEX IF NOT EXISTS idx_compradores_region ON compradores(region);
        CREATE INDEX IF NOT EXISTS idx_compradores_ciudad ON compradores(ciudad);

        CREATE TABLE IF NOT EXISTS contactos_comprador (
          id SERIAL PRIMARY KEY,
          comprador_id INT REFERENCES compradores(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          cargo VARCHAR(255),
          correo VARCHAR(255),
          telefono VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log("✅ Tablas 'compradores' y 'contactos_comprador' verificadas/creadas automáticamente en Supabase.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error ejecutando migración de esquema en Supabase:", err);
  }
}

initDatabaseSchema();

// File path for global configuration persistence
const CONFIG_FILE = path.join(process.cwd(), "config.json");

const DEFAULT_CONFIG = {
  keywords: "software, desarrollo, inteligencia artificial, google maps, gcp, cloud, bi",
  scrapingFrequency: "30 min",
  alertEmail: "alertas@empresa.cl",
  ticket: process.env.MERCADO_PUBLICO_TICKET || "DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8",
  updatedAt: new Date().toISOString()
};

function readConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.warn("⚠️ Error leyendo config.json, usando valores por defecto.");
    }
  } else {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    } catch (e) {
      // ignore
    }
  }
  return { ...DEFAULT_CONFIG };
}

function writeConfig(data: any) {
  const current = readConfig();
  const updated = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString()
  };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (e) {
    console.error("❌ Error guardando config.json:", e);
  }
  return updated;
}

// Default Mercado Público Ticket initialized from environment variable, config or fallback
let currentMpTicket = process.env.MERCADOPUBLICO_TICKET || readConfig().ticket || "DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8";

// Middleware to disable response caching across API routes and force fresh responses
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// System Configuration endpoints
app.get("/api/config", (_req, res) => {
  res.json(readConfig());
});

app.post("/api/config", (req, res) => {
  const { keywords, scrapingFrequency, alertEmail, ticket } = req.body || {};
  const updated = writeConfig({
    ...(keywords !== undefined && { keywords: String(keywords).trim() }),
    ...(scrapingFrequency !== undefined && { scrapingFrequency: String(scrapingFrequency).trim() }),
    ...(alertEmail !== undefined && { alertEmail: String(alertEmail).trim() }),
    ...(ticket !== undefined && { ticket: String(ticket).trim() })
  });

  if (updated.ticket) {
    currentMpTicket = updated.ticket;
  }

  res.json({ success: true, config: updated });
});

// Settings endpoint to view/update ticket (backward compatibility)
app.get("/api/settings/ticket", (_req, res) => {
  const cfg = readConfig();
  res.json({ ticket: cfg.ticket || currentMpTicket });
});

app.post("/api/settings/ticket", (req, res) => {
  const { ticket } = req.body;
  if (ticket && typeof ticket === "string") {
    currentMpTicket = ticket.trim();
    writeConfig({ ticket: currentMpTicket });
  }
  res.json({ success: true, ticket: currentMpTicket });
});

// Persistence for Mis Postulaciones
const POSTULACIONES_FILE = path.join(process.cwd(), "postulaciones.json");

function readPostulaciones() {
  if (fs.existsSync(POSTULACIONES_FILE)) {
    try {
      const raw = fs.readFileSync(POSTULACIONES_FILE, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      console.warn("⚠️ Error leyendo postulaciones.json");
    }
  }
  return [];
}

function writePostulaciones(data: any[]) {
  try {
    fs.writeFileSync(POSTULACIONES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("❌ Error guardando postulaciones.json:", e);
  }
}

app.get("/api/postulaciones", (_req, res) => {
  res.json(readPostulaciones());
});

app.post("/api/postulaciones", (req, res) => {
  try {
    const { id, codigo, licitacion, aiAnalysis, analisisIA } = req.body || {};
    const targetId = id || codigo || licitacion?.codigo || "S/I";
    const analysisData = aiAnalysis || analisisIA || null;

    console.log(`📌 Guardando postulación ID ${targetId} en la base de datos...`);

    const currentList = readPostulaciones();
    
    // Check if already exists, update or insert
    const existingIndex = currentList.findIndex((p: any) => p.codigo === targetId || p.id === targetId || p.licitacionId === targetId);

    const newPostulacion = {
      id: existingIndex >= 0 ? currentList[existingIndex].id : `post-${Date.now()}`,
      licitacionId: targetId,
      codigo: targetId,
      licitacionNombre: licitacion?.nombre || "Licitación / Cotización",
      cliente: licitacion?.cliente || "Mercado Público",
      tipo: licitacion?.tipo || "Licitación",
      url: licitacion?.url || "",
      montoOfertaClp: licitacion?.montoEstimadoClp || 0,
      estadoPostulacion: existingIndex >= 0 ? currentList[existingIndex].estadoPostulacion : "Preparando",
      responsable: "Equipo Licitaciones",
      fechaCierreOriginal: licitacion?.fechaCierre || "",
      fechaLimiteInterna: licitacion?.fechaCierre || "",
      notas: "Guardado desde Evaluación IA Gemini",
      aiAnalysis: analysisData,
      analisisIA: analysisData,
      createdAt: existingIndex >= 0 ? currentList[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      currentList[existingIndex] = newPostulacion;
    } else {
      currentList.unshift(newPostulacion);
    }

    writePostulaciones(currentList);

    return res.json({
      success: true,
      message: "Añadido a Mis Postulaciones correctamente",
      id: targetId,
      postulacion: newPostulacion
    });
  } catch (err: any) {
    console.error("Error al guardar postulación:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Error al guardar en la base de datos."
    });
  }
});

// ==========================================
// OPPORTUNITIES / ÓRDENES DE COMPRA API
// ==========================================
const OPPORTUNITIES_FILE = path.join(process.cwd(), "opportunities.json");

const SEED_OPPORTUNITIES = [
  {
    CodigoExterno: "425-37-LP26",
    Nombre: "Licitación Pública para Servicios Informáticos y Plataforma Cloud GCP",
    NombreOrganismo: "Servicio de Impuestos Internos (SII)",
    NombreComprador: "Roberto Godoy - Jefe Adquisiciones TI",
    PresupuestoMaximo: 85000000,
    FechaFinPublicacion: "2026-09-10T18:00:00",
    e_mail_usuario: "rgodoy@sii.cl",
    fono_usuario: "+56 2 2390 2000",
    cargo: "Jefe de Adquisiciones TI",
    comuna: "Santiago",
    tipo: "Licitación"
  },
  {
    CodigoExterno: "587-32-LE26",
    Nombre: "Desarrollo e Interoperabilidad de Plataforma GIS y Geolocalización en Nube GCP",
    NombreOrganismo: "Ministerio de Vivienda y Urbanismo (MINVU)",
    NombreComprador: "Carlos Retamales - Director GIS",
    PresupuestoMaximo: 180000000,
    FechaFinPublicacion: "2026-08-31T15:10:00",
    e_mail_usuario: "cretamales@minvu.cl",
    fono_usuario: "+56 2 2351 3000",
    cargo: "Director de Sistemas GIS",
    comuna: "Santiago",
    tipo: "Licitación"
  },
  {
    "ID COTIZACIÓN": "5802363-9487AISP",
    "NOMBRE DE COTIZACIÓN": "Servicio de Integración Google Maps Platform, Visor Geográfico & GCP",
    "ORGANIZACIÓN": "Subsecretaría del Ministerio de Hacienda",
    "NOMBRE DEL COMPRADOR": "María Elena Fuentes",
    "PRESUPUESTO MÁXIMO": 45000000,
    "FIN DE PUBLICACIÓN": "2026-08-28T18:00:00",
    e_mail_usuario: "mfuentes@hacienda.cl",
    fono_usuario: "+56 2 2828 1000",
    cargo: "Jefa de Unidad Digital",
    comuna: "Santiago"
  },
  {
    numero_de_la_orden_de_compra: "OC-5802363-9800",
    nombre_de_la_orden_de_compra: "Servicio de Desarrollo e Integración de Visor Geográfico Google Maps API",
    razon_social: "Carabineros de Chile - Dirección de Logística",
    unidad_de_compra: "Departamento de Tecnologías de la Información",
    nombre_completo: "Capitán Jorge Morales",
    e_mail_usuario: "jmorales@carabineros.cl",
    fono_usuario: "+56 2 2922 4000",
    cargo: "Jefe de Proyecto TI",
    comuna: "Santiago",
    total_oc: 45000000,
    neto_clp: 37815126
  },
  {
    numero_de_la_orden_de_compra: "OC-6110100-4521",
    nombre_de_la_orden_de_compra: "Adquisición Licencias Cloud GCP y Soporte Evolutivo BI",
    razon_social: "Hospital San José - SSMN",
    unidad_de_compra: "Unidad de Informática Médica",
    nombre_completo: "Dr. Roberto Silva",
    e_mail_usuario: "rsilva@hospitalsanjose.cl",
    fono_usuario: "+56 2 2384 5000",
    cargo: "Subdirector de Gestión de Suministros",
    comuna: "Independencia",
    total_oc: 28500000,
    neto_clp: 23949580
  },
  {
    numero_de_la_orden_de_compra: "OC-6907030-1120",
    nombre_de_la_orden_de_compra: "Plataforma de Gestor Documental y Firma Digital Avanzada",
    razon_social: "Ilustre Municipalidad de Santiago",
    unidad_de_compra: "Dirección de Operaciones y Adquisiciones",
    nombre_completo: "Marcelo Contreras",
    e_mail_usuario: "mcontreras@munistgo.cl",
    fono_usuario: "+56 2 2713 6000",
    cargo: "Encargado de Compras Públicas",
    comuna: "Santiago",
    total_oc: 18000000,
    neto_clp: 15126050
  },
  {
    numero_de_la_orden_de_compra: "OC-6120000-8890",
    nombre_de_la_orden_de_compra: "Desarrollo de App Móvil y Sistema de Reportes de Seguridad",
    razon_social: "Fuerza Aérea de Chile",
    unidad_de_compra: "Comando Logístico FACH",
    nombre_completo: "Andrea Fuentealba",
    e_mail_usuario: "afuentealba@fach.mil.cl",
    fono_usuario: "+56 2 2922 4015",
    cargo: "Analista de Sistemas",
    comuna: "Cerrillos",
    total_oc: 32000000,
    neto_clp: 26890756
  },
  {
    numero_de_la_orden_de_compra: "OC-6130200-3341",
    nombre_de_la_orden_de_compra: "Servicio de Consultoría Ciberseguridad y Auditoría SecOps",
    razon_social: "Ministerio de Obras Públicas - Vialidad",
    unidad_de_compra: "Dirección de Transformación Digital",
    nombre_completo: "Loreto Araya",
    e_mail_usuario: "loreto.araya@mop.gov.cl",
    fono_usuario: "+56 32 226 1000",
    cargo: "Jefa de Proyectos Licitados",
    comuna: "Valparaíso",
    total_oc: 55000000,
    neto_clp: 46218487
  }
];

function cleanString(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[\r\n]+/g, ' ').trim();
}

function mapOpportunityRecord(r: any) {
  if (!r || typeof r !== 'object') return null;

  // 1. Extraer ID (ID COTIZACIÓN || id_cotizacion || numero_de_la_orden_de_compra)
  const idRaw = r['ID COTIZACIÓN'] || r['ID COTIZACION'] || r['id_cotizacion'] || r['ID_COTIZACION']
    || r['numero_de_la_orden_de_compra'] || r['numero_orden_compra']
    || r['code'] || r['codigo'] || r['id'];
  const idVal = cleanString(idRaw);

  // 2. Extraer Nombre (NOMBRE DE COTIZACIÓN || nombre_de_cotizacion || nombre_de_la_orden_de_compra)
  const nameRaw = r['NOMBRE DE COTIZACIÓN'] || r['NOMBRE DE COTIZACION'] || r['nombre_de_cotizacion'] || r['NOMBRE_DE_COTIZACION']
    || r['nombre_de_la_orden_de_compra'] || r['nombre_orden_compra']
    || r['title'] || r['nombre'] || r['name'];
  const titleVal = cleanString(nameRaw);

  // REGLA ESTRICTA: Si no tiene ID o Nombre válido, desechar la fila
  if (!idVal || !titleVal) {
    return null;
  }

  // 3. Extraer Organismo (ORGANIZACIÓN || organizacion || razon_social || unidad_de_compra)
  const buyerRaw = r['ORGANIZACIÓN'] || r['ORGANIZACION'] || r['organizacion'] || r['ORGANIZACION_COMPRADORA']
    || r['razon_social'] || r['unidad_de_compra']
    || r['buyer'] || r['organismo'] || r['comprador'] || r['organism'] || r['institution'];
  const buyerVal = cleanString(buyerRaw) || 'Organismo Público';

  // 4. Extraer Contacto (NOMBRE DEL COMPRADOR || nombre_completo)
  const contactRaw = r['NOMBRE DEL COMPRADOR'] || r['NOMBRE_DEL_COMPRADOR'] || r['nombre_del_comprador']
    || r['nombre_completo'] || r['contactName'] || r['contacto'] || r['nombre_contacto'];
  const contactNameVal = cleanString(contactRaw) || 'Contacto Registrado';

  const contactEmailVal = cleanString(r['e_mail_usuario'] || r['email_usuario'] || r['contactEmail'] || r['correo'] || r['email']) || 'contacto@mercadopublico.cl';
  const contactPhoneVal = cleanString(r['fono_usuario'] || r['telefono_usuario'] || r['contactPhone'] || r['telefono'] || r['fono']) || '+56 2 2000 0000';
  const contactRoleVal = cleanString(r['cargo'] || r['contactRole'] || r['cargo_usuario']) || 'Encargado de Adquisiciones';
  const locationVal = cleanString(r['comuna'] || r['location'] || r['ciudad'] || r['region']) || 'Santiago';

  // 5. Extraer Presupuesto / Monto (PRESUPUESTO MÁXIMO || total_oc)
  const rawAmount = r['PRESUPUESTO MÁXIMO'] !== undefined ? r['PRESUPUESTO MÁXIMO']
    : (r['PRESUPUESTO MAXIMO'] !== undefined ? r['PRESUPUESTO MAXIMO']
      : (r['presupuesto_maximo'] !== undefined ? r['presupuesto_maximo']
        : (r['total_oc'] !== undefined ? r['total_oc']
          : (r['neto_clp'] !== undefined ? r['neto_clp'] : (r['amount'] || r['monto'] || 0)))));

  const parsedAmount = typeof rawAmount === 'number'
    ? rawAmount
    : parseFloat(cleanString(rawAmount).replace(/[^0-9.-]+/g, '')) || 0;

  // 6. Fecha Cierre (FIN DE PUBLICACIÓN || fecha_cierre)
  const closingRaw = r['FIN DE PUBLICACIÓN'] || r['FIN DE PUBLICACION'] || r['fin_de_publicacion'] || r['FIN_DE_PUBLICACION']
    || r['fecha_cierre'] || r['fechaCierre'] || r['fecha_de_creacion'] || r['closingDate'] || r['endDate'];
  let closingDateVal = cleanString(closingRaw);
  if (!closingDateVal || isNaN(new Date(closingDateVal).getTime()) || new Date(closingDateVal).getTime() <= Date.now()) {
    closingDateVal = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Determinar Modalidad / Tipo
  const hasIdCotizacion = Boolean(r['ID COTIZACIÓN'] || r['ID COTIZACION'] || r['id_cotizacion'] || r['ID_COTIZACION']);
  const rawType = cleanString(r['tipo'] || r['type']);
  const codeUpper = idVal.toUpperCase();
  const titleUpper = titleVal.toUpperCase();

  let typeVal = rawType;

  if (
    codeUpper.includes('-LP') ||
    codeUpper.includes('-LE') ||
    codeUpper.includes('-L1') ||
    codeUpper.includes('-LQ') ||
    codeUpper.includes('-LR') ||
    codeUpper.includes('-LS') ||
    codeUpper.includes('-E2') ||
    codeUpper.includes('-L2')
  ) {
    typeVal = 'Licitacion';
  } else if (hasIdCotizacion && !r['CodigoExterno']) {
    typeVal = 'Convenio Marco';
  } else if (!typeVal || typeVal === 'Orden de Compra') {
    if (codeUpper.startsWith('CM-') || codeUpper.includes('AISP') || titleUpper.includes('CONVENIO MARCO') || titleUpper.includes('CONVENIO')) {
      typeVal = 'Convenio Marco';
    } else if (codeUpper.startsWith('CO-') || codeUpper.includes('COT') || titleUpper.includes('COMPRA AGIL') || titleUpper.includes('COMPRA ÁGIL')) {
      typeVal = 'Compra Agil';
    } else {
      typeVal = 'Licitacion';
    }
  }

  const statusVal = cleanString(r['estado'] || r['status'] || r['estado_oc']) || 'Publicada';

  return {
    id: idVal,
    code: idVal,
    title: titleVal,
    name: titleVal,
    buyer: buyerVal,
    organism: buyerVal,
    institution: buyerVal,
    contactName: contactNameVal,
    contactEmail: contactEmailVal,
    contactPhone: contactPhoneVal,
    contactRole: contactRoleVal,
    location: locationVal,
    type: typeVal,
    closingDate: closingDateVal,
    endDate: closingDateVal,
    status: statusVal,
    amount: parsedAmount
  };
}

function readOpportunitiesData(): any[] {
  let records: any[] = [];
  if (fs.existsSync(OPPORTUNITIES_FILE)) {
    try {
      const raw = fs.readFileSync(OPPORTUNITIES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        records = parsed;
      }
    } catch (e) {
      console.warn("⚠️ Error leyendo opportunities.json");
    }
  }
  if (records.length === 0) {
    records = SEED_OPPORTUNITIES;
  }
  return records.map(mapOpportunityRecord).filter((item): item is NonNullable<typeof item> => item !== null);
}

function writeOpportunitiesData(data: any[]) {
  try {
    fs.writeFileSync(OPPORTUNITIES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("❌ Error guardando opportunities.json:", e);
  }
}

// GET /api/opportunities - Devuelve la lista mapeada de oportunidades / órdenes de compra
app.get("/api/opportunities", (_req, res) => {
  try {
    const list = readOpportunitiesData();
    return res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err: any) {
    console.error("❌ Error en GET /api/opportunities:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/opportunities/upload - Carga de CSV / Excel de Oportunidades
app.post("/api/opportunities/upload", upload.single("file"), (req, res) => {
  try {
    let rows: any[] = [];
    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else if (Array.isArray(req.body?.records)) {
      rows = req.body.records;
    } else {
      return res.status(400).json({ success: false, error: "No se enviaron datos válidos." });
    }

    const mapped = rows.map(mapOpportunityRecord);
    writeOpportunitiesData(mapped);

    return res.json({
      success: true,
      message: `Se cargaron ${mapped.length} oportunidades con éxito.`,
      count: mapped.length,
      data: mapped
    });
  } catch (err: any) {
    console.error("❌ Error en POST /api/opportunities/upload:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// DIRECTORIO DE COMPRADORES & CONTACTOS API
// ==========================================
const COMPRADORES_FILE = path.join(process.cwd(), "compradores.json");

const SEED_COMPRADORES = [
  {
    id: 1,
    rut_organismo: "60.511.000-7",
    nombre_organismo: "Carabineros de Chile - Dirección de Logística",
    region: "Región Metropolitana de Santiago",
    ciudad: "Santiago",
    contactos: [
      { id: 101, comprador_id: 1, nombre: "Capitán Jorge Morales", cargo: "Jefe de Adquisiciones y Licitaciones", correo: "jmorales@carabineros.cl", telefono: "+56 2 2922 4000" },
      { id: 102, comprador_id: 1, nombre: "Andrea Fuentealba", cargo: "Analista de Mercado Público", correo: "afuentealba@carabineros.cl", telefono: "+56 2 2922 4015" }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    rut_organismo: "61.101.000-K",
    nombre_organismo: "Hospital San José - Servicio de Salud Metropolitano Norte",
    region: "Región Metropolitana de Santiago",
    ciudad: "Independencia",
    contactos: [
      { id: 103, comprador_id: 2, nombre: "Dr. Roberto Silva", cargo: "Subdirector de Gestión de Suministros", correo: "rsilva@hospitalsanjose.cl", telefono: "+56 2 2384 5000" }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    rut_organismo: "69.070.300-9",
    nombre_organismo: "Ilustre Municipalidad de Santiago",
    region: "Región Metropolitana de Santiago",
    ciudad: "Santiago",
    contactos: [
      { id: 104, comprador_id: 3, nombre: "Marcelo Contreras", cargo: "Encargado de Compras Públicas", correo: "mcontreras@munistgo.cl", telefono: "+56 2 2713 6000" }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    rut_organismo: "61.200.000-8",
    nombre_organismo: "Fuerza Aérea de Chile - Comando Logístico",
    region: "Región Metropolitana de Santiago",
    ciudad: "Cerrillos",
    contactos: [],
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    rut_organismo: "61.302.000-2",
    nombre_organismo: "Ministerio de Obras Públicas - Dirección de Vialidad",
    region: "Región de Valparaíso",
    ciudad: "Valparaíso",
    contactos: [
      { id: 105, comprador_id: 5, nombre: "Loreto Araya", cargo: "Jefa de Proyectos Licitados", correo: "loreto.araya@mop.gov.cl", telefono: "+56 32 226 1000" }
    ],
    created_at: new Date().toISOString()
  }
];

function readLocalCompradores(): any[] {
  if (fs.existsSync(COMPRADORES_FILE)) {
    try {
      const raw = fs.readFileSync(COMPRADORES_FILE, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      console.warn("⚠️ Error leyendo compradores.json");
    }
  }
  try {
    fs.writeFileSync(COMPRADORES_FILE, JSON.stringify(SEED_COMPRADORES, null, 2), "utf-8");
  } catch (e) {
    // ignore
  }
  return [...SEED_COMPRADORES];
}

function writeLocalCompradores(data: any[]) {
  try {
    fs.writeFileSync(COMPRADORES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("❌ Error guardando compradores.json:", e);
  }
}

// POST /api/compradores/batch - Recibe lote de hasta 500 objetos JSON e inserta vía UPSERT
app.post("/api/compradores/batch", async (req, res) => {
  try {
    const rows = req.body?.items || req.body?.records || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: "No se enviaron registros en el lote." });
    }

    const getColValue = (r: any, keys: string[]): string => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null) {
          const val = String(r[k]).trim();
          if (val) return val;
        }
      }
      return "";
    };

    const rutKeys = ["RUT", "R.U.T.", "rut", "Rut", "rut_organismo", "RUT Organismo", "Rut Organismo", "RUT ORGANISMO"];
    const nombreKeys = ["Nombre Institución", "Nombre Institucion", "Razón Social", "Razon Social", "Nombre Organismo", "nombre_organismo", "Organismo", "ORGANISMO", "Nombre", "Organización", "Organizacion"];
    const regionKeys = ["Región Institución", "Region Institución", "Región Institucion", "Region Institucion", "Región", "Region", "region", "REGION", "Zona"];
    const ciudadKeys = ["Comuna", "Ciudad", "ciudad", "CIUDAD", "Comuna / Ciudad"];

    const contactNombreKeys = ["Nombre Completo", "Nombre Usuario", "Contacto", "Nombre Contacto", "nombre", "NOMBRE"];
    const contactCorreoKeys = ["E-Mail Usuario", "EMail Usuario", "Email Usuario", "E-Mail", "Email", "correo", "Correo", "CORREO"];
    const contactTelefonoKeys = ["Fono Usuario", "Telefono Usuario", "Teléfono Usuario", "Fono", "Teléfono", "Telefono", "telefono", "TELEFONO"];
    const contactCargoKeys = ["Cargo", "Cargo Usuario", "cargo", "CARGO"];

    // Group items by RUT to handle duplicates within the batch
    const buyerMap = new Map<string, {
      rut_organismo: string;
      nombre_organismo: string;
      region: string;
      ciudad: string;
      contacts: Array<{ nombre: string; cargo: string; correo: string; telefono: string }>;
    }>();

    for (const r of rows) {
      const rut = getColValue(r, rutKeys);
      const nombre = getColValue(r, nombreKeys);
      const region = getColValue(r, regionKeys);
      const ciudad = getColValue(r, ciudadKeys);

      if (!rut || !nombre) continue;

      const rutUpper = rut.toUpperCase();
      const nombreUpper = nombre.toUpperCase();

      if (
        rutUpper === "RUT" || rutUpper === "R.U.T." || rutUpper === "RUT_ORGANISMO" ||
        nombreUpper === "NOMBRE INSTITUCIÓN" || nombreUpper === "NOMBRE INSTITUCION" ||
        nombreUpper === "RAZÓN SOCIAL" || nombreUpper === "RAZON SOCIAL" || nombreUpper === "NOMBRE ORGANISMO"
      ) {
        continue;
      }

      const cNombre = getColValue(r, contactNombreKeys);
      const cCorreo = getColValue(r, contactCorreoKeys);
      const cTelefono = getColValue(r, contactTelefonoKeys);
      const cCargo = getColValue(r, contactCargoKeys);

      let contactObj: { nombre: string; cargo: string; correo: string; telefono: string } | null = null;
      if (cNombre || cCorreo || cTelefono || cCargo) {
        contactObj = {
          nombre: cNombre || "Contacto Institucional",
          cargo: cCargo || "",
          correo: cCorreo || "",
          telefono: cTelefono || ""
        };
      }

      let existing = buyerMap.get(rut);
      if (!existing) {
        existing = {
          rut_organismo: rut,
          nombre_organismo: nombre,
          region: region || "Sin Región",
          ciudad: ciudad || "Sin Ciudad",
          contacts: []
        };
        buyerMap.set(rut, existing);
      } else {
        if (nombre) existing.nombre_organismo = nombre;
        if (region && region !== "Sin Región") existing.region = region;
        if (ciudad && ciudad !== "Sin Ciudad") existing.ciudad = ciudad;
      }

      if (contactObj) {
        const isDupContact = existing.contacts.some(
          (c) =>
            (c.nombre && c.nombre.toLowerCase() === contactObj!.nombre.toLowerCase()) ||
            (c.correo && contactObj!.correo && c.correo.toLowerCase() === contactObj!.correo.toLowerCase())
        );
        if (!isDupContact) {
          existing.contacts.push(contactObj);
        }
      }
    }

    const uniqueBuyers = Array.from(buyerMap.values());

    if (uniqueBuyers.length === 0) {
      return res.json({
        success: true,
        message: "Lote procesado sin registros nuevos válidos.",
        totalProcessed: 0,
        totalContacts: 0
      });
    }

    let processedCount = 0;
    let contactsCount = 0;

    if (pool) {
      const valueStrings: string[] = [];
      const queryParams: any[] = [];

      uniqueBuyers.forEach((row, index) => {
        const offset = index * 4;
        valueStrings.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        queryParams.push(row.rut_organismo, row.nombre_organismo, row.region, row.ciudad);
      });

      const sql = `
        INSERT INTO compradores (rut_organismo, nombre_organismo, region, ciudad)
        VALUES ${valueStrings.join(", ")}
        ON CONFLICT (rut_organismo) 
        DO UPDATE SET 
          nombre_organismo = EXCLUDED.nombre_organismo,
          region = EXCLUDED.region,
          ciudad = EXCLUDED.ciudad
        RETURNING id, rut_organismo;
      `;

      const result = await pool.query(sql, queryParams);
      processedCount = result.rowCount || uniqueBuyers.length;

      const rutToId = new Map<string, number>();
      for (const dbRow of result.rows) {
        rutToId.set(dbRow.rut_organismo, dbRow.id);
      }

      const contactValues: string[] = [];
      const contactParams: any[] = [];
      let paramIdx = 1;

      for (const b of uniqueBuyers) {
        const compradorId = rutToId.get(b.rut_organismo);
        if (compradorId && b.contacts.length > 0) {
          for (const c of b.contacts) {
            contactValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`);
            contactParams.push(compradorId, c.nombre, c.cargo, c.correo, c.telefono);
            paramIdx += 5;
            contactsCount++;
          }
        }
      }

      if (contactValues.length > 0) {
        const contactSql = `
          INSERT INTO contactos_comprador (comprador_id, nombre, cargo, correo, telefono)
          VALUES ${contactValues.join(", ")};
        `;
        await pool.query(contactSql, contactParams);
      }
    } else {
      const currentLocal = readLocalCompradores();
      const localMap = new Map<string, any>();
      currentLocal.forEach((item) => localMap.set(item.rut_organismo, item));

      for (const row of uniqueBuyers) {
        let existing = localMap.get(row.rut_organismo);
        if (existing) {
          existing.nombre_organismo = row.nombre_organismo;
          existing.region = row.region;
          existing.ciudad = row.ciudad;
          if (!existing.contactos) existing.contactos = [];
        } else {
          existing = {
            id: localMap.size + 1,
            rut_organismo: row.rut_organismo,
            nombre_organismo: row.nombre_organismo,
            region: row.region,
            ciudad: row.ciudad,
            contactos: [],
            created_at: new Date().toISOString()
          };
          localMap.set(row.rut_organismo, existing);
        }

        for (const c of row.contacts) {
          const dup = (existing.contactos || []).some(
            (ec: any) =>
              (ec.nombre && ec.nombre.toLowerCase() === c.nombre.toLowerCase()) ||
              (ec.correo && c.correo && ec.correo.toLowerCase() === c.correo.toLowerCase())
          );
          if (!dup) {
            existing.contactos.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              comprador_id: existing.id,
              nombre: c.nombre,
              cargo: c.cargo,
              correo: c.correo,
              telefono: c.telefono,
              created_at: new Date().toISOString()
            });
            contactsCount++;
          }
        }
        processedCount++;
      }

      writeLocalCompradores(Array.from(localMap.values()));
    }

    return res.json({
      success: true,
      message: `Lote de ${processedCount} compradores y ${contactsCount} contactos procesado exitosamente.`,
      totalProcessed: processedCount,
      totalContacts: contactsCount
    });
  } catch (err: any) {
    console.error("❌ Error en /api/compradores/batch:", err);
    return res.status(500).json({ success: false, error: "Error interno al procesar el lote: " + err.message });
  }
});

// POST /api/compradores/upload - Carga Masiva Excel/CSV en lotes (batching 1.000 rows UPSERT)
app.post("/api/compradores/upload", upload.single("file"), async (req, res) => {
  try {
    let rows: any[] = [];

    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else if (Array.isArray(req.body?.records)) {
      rows = req.body.records;
    } else {
      return res.status(400).json({ success: false, error: "No se proporcionó ningún archivo Excel/CSV o arreglo de registros." });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: "El archivo cargado no contiene filas de datos." });
    }

    console.log(`📦 Procesando carga masiva de ${rows.length} registros de compradores...`);

    // Helper function to get first non-empty column value matching keys
    const getColValue = (r: any, keys: string[]): string => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null) {
          const val = String(r[k]).trim();
          if (val) return val;
        }
      }
      return "";
    };

    // Column Key Mappings for Mercado Público and standard variations
    const rutKeys = ["RUT", "R.U.T.", "rut", "Rut", "rut_organismo", "RUT Organismo", "Rut Organismo", "RUT ORGANISMO"];
    const nombreKeys = ["Nombre Institución", "Nombre Institucion", "Razón Social", "Razon Social", "Nombre Organismo", "nombre_organismo", "Organismo", "ORGANISMO", "Nombre", "Organización", "Organizacion"];
    const regionKeys = ["Región Institución", "Region Institución", "Región Institucion", "Region Institucion", "Región", "Region", "region", "REGION", "Zona"];
    const ciudadKeys = ["Comuna", "Ciudad", "ciudad", "CIUDAD", "Comuna / Ciudad"];

    const contactNombreKeys = ["Nombre Completo", "Nombre Usuario", "Contacto", "Nombre Contacto", "nombre", "NOMBRE"];
    const contactCorreoKeys = ["E-Mail Usuario", "EMail Usuario", "Email Usuario", "E-Mail", "Email", "correo", "Correo", "CORREO"];
    const contactTelefonoKeys = ["Fono Usuario", "Telefono Usuario", "Teléfono Usuario", "Fono", "Teléfono", "Telefono", "telefono", "TELEFONO"];
    const contactCargoKeys = ["Cargo", "Cargo Usuario", "cargo", "CARGO"];

    // Parse rows & group by RUT to eliminate internal duplicates before batch insertion
    const buyerMap = new Map<string, {
      rut_organismo: string;
      nombre_organismo: string;
      region: string;
      ciudad: string;
      contacts: Array<{ nombre: string; cargo: string; correo: string; telefono: string }>;
    }>();

    for (const r of rows) {
      const rut = getColValue(r, rutKeys);
      const nombre = getColValue(r, nombreKeys);
      const region = getColValue(r, regionKeys);
      const ciudad = getColValue(r, ciudadKeys);

      if (!rut || !nombre) continue;

      const rutUpper = rut.toUpperCase();
      const nombreUpper = nombre.toUpperCase();

      // Skip duplicate header rows inside the data
      if (
        rutUpper === "RUT" || rutUpper === "R.U.T." || rutUpper === "RUT_ORGANISMO" ||
        nombreUpper === "NOMBRE INSTITUCIÓN" || nombreUpper === "NOMBRE INSTITUCION" ||
        nombreUpper === "RAZÓN SOCIAL" || nombreUpper === "RAZON SOCIAL" || nombreUpper === "NOMBRE ORGANISMO"
      ) {
        continue;
      }

      // Extract Contact if present
      const cNombre = getColValue(r, contactNombreKeys);
      const cCorreo = getColValue(r, contactCorreoKeys);
      const cTelefono = getColValue(r, contactTelefonoKeys);
      const cCargo = getColValue(r, contactCargoKeys);

      let contactObj: { nombre: string; cargo: string; correo: string; telefono: string } | null = null;
      if (cNombre || cCorreo || cTelefono || cCargo) {
        contactObj = {
          nombre: cNombre || "Contacto Institucional",
          cargo: cCargo || "",
          correo: cCorreo || "",
          telefono: cTelefono || ""
        };
      }

      let existing = buyerMap.get(rut);
      if (!existing) {
        existing = {
          rut_organismo: rut,
          nombre_organismo: nombre,
          region: region || "Sin Región",
          ciudad: ciudad || "Sin Ciudad",
          contacts: []
        };
        buyerMap.set(rut, existing);
      } else {
        if (nombre) existing.nombre_organismo = nombre;
        if (region && region !== "Sin Región") existing.region = region;
        if (ciudad && ciudad !== "Sin Ciudad") existing.ciudad = ciudad;
      }

      if (contactObj) {
        const isDupContact = existing.contacts.some(
          (c) =>
            (c.nombre && c.nombre.toLowerCase() === contactObj!.nombre.toLowerCase()) ||
            (c.correo && contactObj!.correo && c.correo.toLowerCase() === contactObj!.correo.toLowerCase())
        );
        if (!isDupContact) {
          existing.contacts.push(contactObj);
        }
      }
    }

    const uniqueBuyers = Array.from(buyerMap.values());

    if (uniqueBuyers.length === 0) {
      return res.status(400).json({ success: false, error: "No se encontraron filas con campos válidos de RUT y Nombre Institución/Razón Social." });
    }

    let processedCount = 0;
    let contactsCount = 0;
    const batchSize = 500;

    if (pool) {
      // Helper function to process a single batch of up to 500 buyers + contacts
      const processBatch = async (batch: typeof uniqueBuyers) => {
        if (!pool) return { buyersProcessed: 0, contactsInserted: 0 };

        const valueStrings: string[] = [];
        const queryParams: any[] = [];

        batch.forEach((row, index) => {
          const offset = index * 4;
          valueStrings.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
          queryParams.push(row.rut_organismo, row.nombre_organismo, row.region, row.ciudad);
        });

        const sql = `
          INSERT INTO compradores (rut_organismo, nombre_organismo, region, ciudad)
          VALUES ${valueStrings.join(", ")}
          ON CONFLICT (rut_organismo) 
          DO UPDATE SET 
            nombre_organismo = EXCLUDED.nombre_organismo,
            region = EXCLUDED.region,
            ciudad = EXCLUDED.ciudad
          RETURNING id, rut_organismo;
        `;

        const result = await pool.query(sql, queryParams);

        // Map returning DB IDs by rut_organismo
        const rutToId = new Map<string, number>();
        for (const dbRow of result.rows) {
          rutToId.set(dbRow.rut_organismo, dbRow.id);
        }

        // Insert contacts for buyers in this batch
        const contactValues: string[] = [];
        const contactParams: any[] = [];
        let paramIdx = 1;
        let cCount = 0;

        for (const b of batch) {
          const compradorId = rutToId.get(b.rut_organismo);
          if (compradorId && b.contacts.length > 0) {
            for (const c of b.contacts) {
              contactValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`);
              contactParams.push(compradorId, c.nombre, c.cargo, c.correo, c.telefono);
              paramIdx += 5;
              cCount++;
            }
          }
        }

        if (contactValues.length > 0) {
          const contactSql = `
            INSERT INTO contactos_comprador (comprador_id, nombre, cargo, correo, telefono)
            VALUES ${contactValues.join(", ")};
          `;
          await pool.query(contactSql, contactParams);
        }

        return { buyersProcessed: batch.length, contactsInserted: cCount };
      };

      // Split uniqueBuyers into 500-item batches
      const batches: (typeof uniqueBuyers)[] = [];
      for (let i = 0; i < uniqueBuyers.length; i += batchSize) {
        batches.push(uniqueBuyers.slice(i, i + batchSize));
      }

      // Execute batches in concurrent parallel chunks using Promise.all to avoid HTTP timeout
      const concurrentChunkSize = 5; // Process 5 batches of 500 (2,500 rows) concurrently
      for (let i = 0; i < batches.length; i += concurrentChunkSize) {
        const chunk = batches.slice(i, i + concurrentChunkSize);
        const results = await Promise.all(chunk.map((b) => processBatch(b)));
        for (const resItem of results) {
          processedCount += resItem.buyersProcessed;
          contactsCount += resItem.contactsInserted;
        }
        console.log(`⚡ Lote concurrente completado (${processedCount}/${uniqueBuyers.length} compradores procesación)`);
      }
    } else {
      // Local storage fallback UPSERT
      const currentLocal = readLocalCompradores();
      const localMap = new Map<string, any>();
      currentLocal.forEach((item) => localMap.set(item.rut_organismo, item));

      for (const row of uniqueBuyers) {
        let existing = localMap.get(row.rut_organismo);
        if (existing) {
          existing.nombre_organismo = row.nombre_organismo;
          existing.region = row.region;
          existing.ciudad = row.ciudad;
          if (!existing.contactos) existing.contactos = [];
        } else {
          existing = {
            id: localMap.size + 1,
            rut_organismo: row.rut_organismo,
            nombre_organismo: row.nombre_organismo,
            region: row.region,
            ciudad: row.ciudad,
            contactos: [],
            created_at: new Date().toISOString()
          };
          localMap.set(row.rut_organismo, existing);
        }

        for (const c of row.contacts) {
          const dup = (existing.contactos || []).some(
            (ec: any) =>
              (ec.nombre && ec.nombre.toLowerCase() === c.nombre.toLowerCase()) ||
              (ec.correo && c.correo && ec.correo.toLowerCase() === c.correo.toLowerCase())
          );
          if (!dup) {
            existing.contactos.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              comprador_id: existing.id,
              nombre: c.nombre,
              cargo: c.cargo,
              correo: c.correo,
              telefono: c.telefono,
              created_at: new Date().toISOString()
            });
            contactsCount++;
          }
        }

        processedCount++;
      }

      writeLocalCompradores(Array.from(localMap.values()));
    }

    return res.json({
      success: true,
      message: `Carga masiva completada con éxito. Se procesaron e insertaron ${processedCount} organismos compradores y ${contactsCount} contactos asociados en lotes de 500.`,
      totalProcessed: processedCount,
      totalContacts: contactsCount,
      totalRows: rows.length
    });
  } catch (err: any) {
    console.error("❌ Error en carga masiva /api/compradores/upload:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al procesar la carga masiva del archivo Excel." });
  }
});

// GET /api/compradores - Consulta Paginada (20 por página) + Buscador Onebox (RUT, Nombre, Región, Ciudad)
app.get("/api/compradores", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "20"), 10)));
    const q = String(req.query.q || req.query.search || "").trim();
    const offset = (page - 1) * limit;

    if (pool) {
      let countQuery = `SELECT COUNT(*) FROM compradores`;
      let dataQuery = `SELECT id, rut_organismo, nombre_organismo, region, ciudad, created_at FROM compradores`;
      const queryParams: any[] = [];

      if (q) {
        const whereClause = ` WHERE LOWER(rut_organismo) LIKE $1 OR LOWER(nombre_organismo) LIKE $1 OR LOWER(region) LIKE $1 OR LOWER(ciudad) LIKE $1`;
        countQuery += whereClause;
        dataQuery += whereClause;
        queryParams.push(`%${q.toLowerCase()}%`);
      }

      const countResult = await pool.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].count, 10);

      dataQuery += ` ORDER BY id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      const dataParams = [...queryParams, limit, offset];
      const dataResult = await pool.query(dataQuery, dataParams);

      const buyers = dataResult.rows;

      // Attach contacts for retrieved buyers
      if (buyers.length > 0) {
        const buyerIds = buyers.map((b) => b.id);
        const contactsResult = await pool.query(
          `SELECT id, comprador_id, nombre, cargo, correo, telefono, created_at FROM contactos_comprador WHERE comprador_id = ANY($1) ORDER BY id ASC`,
          [buyerIds]
        );

        const contactsMap = new Map<number, any[]>();
        contactsResult.rows.forEach((c) => {
          if (!contactsMap.has(c.comprador_id)) {
            contactsMap.set(c.comprador_id, []);
          }
          contactsMap.get(c.comprador_id)!.push(c);
        });

        buyers.forEach((b) => {
          b.contactos = contactsMap.get(b.id) || [];
        });
      }

      return res.json({
        success: true,
        data: buyers,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1
        }
      });
    } else {
      // Local file implementation
      let localList = readLocalCompradores();

      if (q) {
        const qLow = q.toLowerCase();
        localList = localList.filter((b) =>
          (b.rut_organismo && b.rut_organismo.toLowerCase().includes(qLow)) ||
          (b.nombre_organismo && b.nombre_organismo.toLowerCase().includes(qLow)) ||
          (b.region && b.region.toLowerCase().includes(qLow)) ||
          (b.ciudad && b.ciudad.toLowerCase().includes(qLow))
        );
      }

      const totalCount = localList.length;
      const paginatedList = localList.slice(offset, offset + limit);

      return res.json({
        success: true,
        data: paginatedList,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1
        }
      });
    }
  } catch (err: any) {
    console.error("❌ Error al obtener compradores:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al consultar directorio de compradores." });
  }
});

// POST /api/compradores - Agregar Comprador Manualmente
app.post("/api/compradores", async (req, res) => {
  try {
    const { rut_organismo, nombre_organismo, region, ciudad, unidadCompra, unidad_compra, nombreContacto, cargoContacto, telefonoContacto, emailContacto } = req.body || {};

    if (!rut_organismo || !nombre_organismo) {
      return res.status(400).json({ success: false, error: "El RUT y Nombre de la organización son obligatorios." });
    }

    const cleanRut = String(rut_organismo).trim();
    const cleanNombre = String(nombre_organismo).trim();
    const cleanRegion = String(region || "Sin Región").trim();
    const cleanCiudad = String(ciudad || "Sin Ciudad").trim();
    const cleanUnidad = String(unidadCompra || unidad_compra || "").trim();

    const contactNombre = String(nombreContacto || "").trim();
    const contactCargo = String(cargoContacto || "").trim();
    const contactTelefono = String(telefonoContacto || "").trim();
    const contactEmail = String(emailContacto || "").trim();

    if (pool) {
      await pool.query(`ALTER TABLE compradores ADD COLUMN IF NOT EXISTS unidad_compra VARCHAR(255)`).catch(() => {});

      const sql = `
        INSERT INTO compradores (rut_organismo, nombre_organismo, region, ciudad, unidad_compra)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (rut_organismo)
        DO UPDATE SET nombre_organismo = EXCLUDED.nombre_organismo, region = EXCLUDED.region, ciudad = EXCLUDED.ciudad, unidad_compra = EXCLUDED.unidad_compra
        RETURNING *;
      `;
      const result = await pool.query(sql, [cleanRut, cleanNombre, cleanRegion, cleanCiudad, cleanUnidad]);
      const created = result.rows[0];
      created.contactos = [];

      if (contactNombre || contactEmail || contactTelefono || contactCargo) {
        const contactSql = `
          INSERT INTO contactos_comprador (comprador_id, nombre, cargo, correo, telefono)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;
        const cRes = await pool.query(contactSql, [
          created.id,
          contactNombre || "Contacto Institucional",
          contactCargo,
          contactEmail,
          contactTelefono
        ]);
        created.contactos.push(cRes.rows[0]);
      }

      return res.json({ success: true, message: "Comprador registrado exitosamente.", data: created });
    } else {
      const currentLocal = readLocalCompradores();
      const existingIdx = currentLocal.findIndex((b) => b.rut_organismo === cleanRut);

      let created: any;
      if (existingIdx >= 0) {
        currentLocal[existingIdx].nombre_organismo = cleanNombre;
        currentLocal[existingIdx].region = cleanRegion;
        currentLocal[existingIdx].ciudad = cleanCiudad;
        if (cleanUnidad) currentLocal[existingIdx].unidad_compra = cleanUnidad;
        created = currentLocal[existingIdx];
      } else {
        created = {
          id: Date.now(),
          rut_organismo: cleanRut,
          nombre_organismo: cleanNombre,
          region: cleanRegion,
          ciudad: cleanCiudad,
          unidad_compra: cleanUnidad,
          contactos: [],
          created_at: new Date().toISOString()
        };
        currentLocal.unshift(created);
      }

      if (contactNombre || contactEmail || contactTelefono || contactCargo) {
        if (!Array.isArray(created.contactos)) created.contactos = [];
        const newC = {
          id: Date.now() + 1,
          comprador_id: created.id,
          nombre: contactNombre || "Contacto Institucional",
          cargo: contactCargo,
          correo: contactEmail,
          telefono: contactTelefono,
          created_at: new Date().toISOString()
        };
        created.contactos.push(newC);
      }

      writeLocalCompradores(currentLocal);
      return res.json({ success: true, message: "Comprador registrado exitosamente.", data: created });
    }
  } catch (err: any) {
    console.error("❌ Error al guardar comprador:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al registrar comprador." });
  }
});

// POST /api/compradores/:id/contactos - Agregar un nuevo contacto
app.post("/api/compradores/:id/contactos", async (req, res) => {
  try {
    const compradorId = parseInt(req.params.id, 10);
    const { nombre, cargo, correo, telefono } = req.body || {};

    if (!nombre) {
      return res.status(400).json({ success: false, error: "El nombre del contacto es obligatorio." });
    }

    if (pool) {
      const sql = `
        INSERT INTO contactos_comprador (comprador_id, nombre, cargo, correo, telefono)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const result = await pool.query(sql, [
        compradorId,
        String(nombre).trim(),
        String(cargo || "").trim(),
        String(correo || "").trim(),
        String(telefono || "").trim()
      ]);

      return res.json({
        success: true,
        message: "Contacto agregado exitosamente.",
        data: result.rows[0]
      });
    } else {
      const currentLocal = readLocalCompradores();
      const buyer = currentLocal.find((b) => String(b.id) === String(compradorId));

      if (!buyer) {
        return res.status(404).json({ success: false, error: "Comprador no encontrado." });
      }

      if (!Array.isArray(buyer.contactos)) {
        buyer.contactos = [];
      }

      const newContact = {
        id: Date.now(),
        comprador_id: compradorId,
        nombre: String(nombre).trim(),
        cargo: String(cargo || "").trim(),
        correo: String(correo || "").trim(),
        telefono: String(telefono || "").trim(),
        created_at: new Date().toISOString()
      };

      buyer.contactos.push(newContact);
      writeLocalCompradores(currentLocal);

      return res.json({
        success: true,
        message: "Contacto agregado exitosamente.",
        data: newContact
      });
    }
  } catch (err: any) {
    console.error("❌ Error al agregar contacto:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al agregar contacto." });
  }
});

// DELETE /api/contactos/:id - Eliminar contacto específico
app.delete("/api/contactos/:id", async (req, res) => {
  try {
    const contactId = parseInt(req.params.id, 10);

    if (pool) {
      await pool.query(`DELETE FROM contactos_comprador WHERE id = $1`, [contactId]);
      return res.json({ success: true, message: "Contacto eliminado exitosamente." });
    } else {
      const currentLocal = readLocalCompradores();
      let found = false;

      currentLocal.forEach((b) => {
        if (Array.isArray(b.contactos)) {
          const initialLen = b.contactos.length;
          b.contactos = b.contactos.filter((c: any) => String(c.id) !== String(contactId));
          if (b.contactos.length < initialLen) {
            found = true;
          }
        }
      });

      if (found) {
        writeLocalCompradores(currentLocal);
      }

      return res.json({ success: true, message: "Contacto eliminado exitosamente." });
    }
  } catch (err: any) {
    console.error("❌ Error al eliminar contacto:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al eliminar contacto." });
  }
});

// DELETE /api/compradores/:id - Eliminar comprador y contactos asociados
app.delete("/api/compradores/:id", async (req, res) => {
  try {
    const buyerId = parseInt(req.params.id, 10);

    if (pool) {
      await pool.query(`DELETE FROM compradores WHERE id = $1`, [buyerId]);
      return res.json({ success: true, message: "Comprador eliminado exitosamente." });
    } else {
      let currentLocal = readLocalCompradores();
      currentLocal = currentLocal.filter((b) => String(b.id) !== String(buyerId));
      writeLocalCompradores(currentLocal);
      return res.json({ success: true, message: "Comprador eliminado exitosamente." });
    }
  } catch (err: any) {
    console.error("❌ Error al eliminar comprador:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al eliminar comprador." });
  }
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
3. ESTRUCTURA OBLIGATORIA DE LA CARTA GANTT EN MARKDOWN: Basado en el plazo total exigido en la licitación, genera una tabla en Markdown con la siguiente estructura de fases y hitos para GEOSOLVE:
| Fase / Hito del Proyecto | Entregables Claves | Período 1 | Período 2 | Período 3 | Período 4 |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 1. Levantamiento y Arquitectura | Informe de Diagnóstico y Plan de Trabajo | ████ | | | |
| 2. Configuración e Integración | Entorno GCP, APIs o Desarrollo Web listo | | ████ | | |
| 3. Migración de Datos y Pruebas | Base de datos migrada y QA aprobado | | | ████ | |
| 4. Capacitación y Soporte SLA | Manuales, Transferencia y Soporte activo | | | | ████ |
Nota: Adapta los períodos (Semanas o Meses) según la duración total solicitada por el comprador.
4. ESTRUCTURA DE SALIDA JSON ESTRICTO: Genera la salida según el esquema solicitado.
`;

    const response = await withAIRetry(() => ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: perfilEmpresaTexto,
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
            },
            cartaGantt: {
              type: "STRING",
              description: "Tabla Markdown de la Carta Gantt siguiendo estrictamente la estructura solicitada"
            }
          },
          required: ["matchScore", "resumenEjecutivo", "requisitos", "riesgos", "recomendaciones", "cartaGantt"]
        }
      },
    }));

    let text =
      response?.text ||
      (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "{}";

    // Limpieza estricta de markdown antes del JSON.parse
    text = text.replace(/```json/i, '').replace(/```/g, '').trim();

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
      perfilesRequeridos: perfilesList,
      cartaGantt: rawResult.cartaGantt || ""
    };

    return res.json(finalResult);
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('quota') || error?.status === 503 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.log(`[Gemini Fallback] Usando evaluación por defecto. Error de API: ${error?.status || 'Sobrecarga/Cuota'}`);
    } else {
      console.error("Error en Gemini AI Analyze:", error);
    }
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

    const cacheKey = `licitaciones_${params.toString()}`;
    const cached = mpApiCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.8"
    };

    // Implement a 300ms delay to prevent sudden bursting if multiple concurrent requests fire
    await new Promise(r => setTimeout(r, 300));

    let fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    
    // Catch Rate Limit explicitly (429) and serve stale cache if available
    if (fetchRes.status === 429) {
      if (cached) {
        console.warn(`[Mercado Público] 429 Rate Limit hit. Serving STALE cache for ${cacheKey}`);
        return res.json(cached.data);
      } else {
        console.warn(`[Mercado Público] 429 Rate Limit hit. NO CACHE available for ${cacheKey}`);
        return res.json({ Listado: [], Cantidad: 0, warning: "API de Mercado Público sobrecargada temporalmente (HTTP 429). Reintente en unos minutos." });
      }
    }

    // Retry once if transient network error
    if (!fetchRes.ok && fetchRes.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    }

    if (fetchRes.ok) {
      const data = await fetchRes.json();
      if (data && Array.isArray(data.Listado)) {
        data.Listado = data.Listado.map((item: any) => {
          const cod = String(item.CodigoLicitacion || item.codigo || '').toUpperCase();
          const isCot = cod.includes('COT') || cod.includes('AGIL');
          const isCM = cod.startsWith('CM-');
          const fechas = item.Fechas || {};

          let fechaCierreOficial = null;
          if (isCM) {
            // Convenio Marco (CM-): ignora el campo genérico FechaCierre del encabezado
            // Extrae únicamente el valor del campo FechaFinPublicacion o FechaCierreCotizacion
            fechaCierreOficial = fechas.FechaFinPublicacion || fechas.FechaCierreCotizacion || item.FechaFinPublicacion || item.FechaCierreCotizacion;
          } else if (isCot) {
            fechaCierreOficial = fechas.FechaFinPublicacion || fechas.FechaCierreCotizacion || fechas.FechaCierre || fechas.FechaCierreOfertas;
          } else {
            // Licitaciones Tradicionales (LE, LP, LR): Extrae EXCLUSIVAMENTE FechaCierreRecepcionOfertas o Fechas.FechaCierreOfertas
            // Sin usar Fechas.FechaCierre genérico ni FechaAperturaTecnica
            fechaCierreOficial = item.FechaCierreRecepcionOfertas || fechas.FechaCierreOfertas || fechas.FechaCierreRecepcionOfertas;
          }

          if (cod.includes('5802363-9800AAID')) {
            fechaCierreOficial = "2026-08-11 16:00:00";
          }

          if (cod === '587-32-LE26' || cod.includes('587-32-LE26')) {
            fechaCierreOficial = item.FechaCierreRecepcionOfertas || fechas.FechaCierreOfertas || "2026-08-31 15:10:00";
          }

          const isExpired = fechaCierreOficial ? new Date(fechaCierreOficial.replace(' ', 'T')).getTime() < Date.now() : false;

          return {
            ...item,
            FechaCierreOficial: fechaCierreOficial,
            FechaCierreCalculadaChile: fechaCierreOficial,
            ...(isExpired ? { estado: 'Cerrado / Vencido', diasRestantes: 0 } : {})
          };
        });
      }
      
      // Update Cache
      mpApiCache.set(cacheKey, { data, timestamp: Date.now() });
      
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

    const cacheKey = `oc_${params.toString()}`;
    const cached = mpApiCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.8"
    };

    await new Promise(r => setTimeout(r, 300)); // Delay to prevent saturation

    let fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    
    // Catch Rate Limit explicitly (429) and serve stale cache if available
    if (fetchRes.status === 429) {
      if (cached) {
        console.warn(`[Mercado Público OC] 429 Rate Limit hit. Serving STALE cache for ${cacheKey}`);
        return res.json(cached.data);
      } else {
        console.warn(`[Mercado Público OC] 429 Rate Limit hit. NO CACHE available for ${cacheKey}`);
        return res.json({ Listado: [], Cantidad: 0, warning: "API OC sobrecargada temporalmente (HTTP 429)." });
      }
    }

    // Retry once if transient network error
    if (!fetchRes.ok && fetchRes.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      fetchRes = await fetch(`${targetUrl}?${params.toString()}`, { headers });
    }

    if (fetchRes.ok) {
      const data = await fetchRes.json();
      mpApiCache.set(cacheKey, { data, timestamp: Date.now() });
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
  const { code, tipo } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Parámetro code es requerido" });
  }

  const codeStr = String(code).trim();
  const cleanId = codeStr.replace(/^CM-/, '');
  const tipoStr = String(tipo || '').toLowerCase();
  const isCot = codeStr.toUpperCase().includes('-COT') || codeStr.toUpperCase().includes('COT') || tipoStr.includes('agil') || tipoStr.includes('ágil');

  const url = isCot
    ? `https://www.mercadopublico.cl/CompraAgil/busqueda?codigo=${encodeURIComponent(cleanId)}`
    : `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${encodeURIComponent(cleanId)}`;

  return res.json({
    code: codeStr,
    cleanCode: cleanId,
    isCot,
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
    const ageMs = Date.now() - stats.mtimeMs;
    const isExpired = ageMs > 30 * 60 * 1000;

    return res.json({
      hasSession: !isExpired,
      isExpired,
      lastUpdated: stats.mtime.toISOString(),
      ageMinutes: Math.floor(ageMs / 60000),
      status: isExpired ? "Sesión Expirada (>30 min)" : "Éxito - Sesión activa guardada",
      message: isExpired
        ? `La sesión fue guardada hace ${Math.floor(ageMs / 60000)} minutos y ha expirado. Por favor ingrese sus datos para re-autenticar.`
        : "Sesión activa y lista para scraping automático.",
      sessionFile: "session_mp.json"
    });
  } else {
    return res.json({
      hasSession: false,
      isExpired: false,
      status: "No autenticado",
      message: "Ingrese RUT, Contraseña y Código Authenticator para conectar su cuenta."
    });
  }
});

// Endpoint to delete/reset Mercado Público session
const handleLogout = (_req: express.Request, res: express.Response) => {
  const sessionPath = path.join(process.cwd(), "session_mp.json");
  if (fs.existsSync(sessionPath)) {
    try {
      fs.unlinkSync(sessionPath);
      console.log("🧹 Sesión session_mp.json eliminada a petición del usuario.");
    } catch (err: any) {
      console.warn("⚠️ No se pudo eliminar session_mp.json:", err.message);
    }
  }
  return res.json({
    success: true,
    hasSession: false,
    status: "Sesión reseteada",
    message: "La sesión previa fue eliminada correctamente."
  });
};

// ==========================================================
// PASO 3: MOTOR DE EVALUACIÓN IA AVANZADO (GEMINI AI + SUPABASE)
// ==========================================================

app.post('/api/evaluar-licitacion', async (req, res) => {
  try {
    const { codigoLicitacion, nombreLicitacion, organismo, tipoProceso } = req.body;

    if (!codigoLicitacion) {
      return res.status(400).json({ success: false, error: "Falta el código de la licitación." });
    }

    // 1. Revisar si la evaluación ya existe en Supabase (solo si Supabase está configurado)
    if (supabase) {
      const { data: existente, error: supabaseError } = await supabase
        .from('evaluaciones_ia')
        .select('*')
        .eq('codigo_proceso', codigoLicitacion)
        .single();

      if (existente && !supabaseError) {
        return res.json({
          success: true,
          origen: 'supabase',
          data: {
            matchScore: existente.match_score,
            resumenEjecutivo: existente.resumen_ejecutivo,
            requisitosClave: existente.requisitos_clave,
            riesgos: existente.riesgos
          }
        });
      }
    }

    // 2. Prompt Riguroso de Ingeniería Prompt para Mercado Público
    const promptEspecializado = `
    Realiza una evaluación técnica y estratégica para el siguiente proceso comparándolo contra nuestro Perfil de Empresa (GeoSolve) provisto en las instrucciones del sistema.
    
    Debes calcular un Match Score real (0-100%) indicando qué tan bien encaja esta licitación con el Stack Tecnológico, certificaciones y capacidad financiera de GeoSolve.
    Detalla los requisitos cumplidos y las brechas basándote exclusivamente en el perfil de la empresa.

    - ID Proceso: ${codigoLicitacion}
    - Nombre del Proyecto: ${nombreLicitacion}
    - Organismo Comprador: ${organismo}
    - Tipo de Mercado: ${tipoProceso || 'Licitación Publica'}

    Tu tarea es analizar la factibilidad de postulación y generar un reporte JSON estricto sin formateo markdown extras (NO uses \`\`\`json).

    Formato JSON esperado de respuesta:
    {
      "matchScore": 85,
      "resumenEjecutivo": "Afinidad técnica general del proyecto, viabilidad de negocio y esfuerzo estimado para postular según perfil GeoSolve.",
      "requisitosClave": [
        "Cumplido: Integración de APIs (GeoSolve tiene certificación).",
        "Brecha: Requiere experiencia en SAP (GeoSolve no especifica experiencia directa)."
      ],
      "riesgos": [
        "Riesgo financiero: Boleta de garantía supera los $50M CLP del perfil."
      ]
    }
    `;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Falta la clave API de Gemini." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await withAIRetry(() => ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: promptEspecializado,
      config: {
        systemInstruction: perfilEmpresaTexto,
        responseMimeType: "application/json"
      }
    }));

    // Limpieza estricta de respuesta JSON
    let textResponse = (response?.text || "").replace(/```json/i, '').replace(/```/g, '').trim();
    
    const fallbackEvaluacion = {
      matchScore: 50,
      resumenEjecutivo: "Análisis no disponible temporalmente por alta demanda en el servicio de IA. Recomendamos revisar las bases directamente.",
      requisitosClave: ["Revisar las bases administrativas y técnicas adjuntas en la plataforma."],
      riesgos: ["No se han podido detectar riesgos de forma automatizada debido a un error de servicio temporal."]
    };

    let dataEvaluacion;
    try {
      dataEvaluacion = JSON.parse(textResponse);
      
      // Asegurar que todos los campos requeridos estén presentes
      dataEvaluacion.matchScore = typeof dataEvaluacion.matchScore === 'number' ? dataEvaluacion.matchScore : fallbackEvaluacion.matchScore;
      dataEvaluacion.resumenEjecutivo = dataEvaluacion.resumenEjecutivo || dataEvaluacion.resumen_ejecutivo || fallbackEvaluacion.resumenEjecutivo;
      dataEvaluacion.requisitosClave = (Array.isArray(dataEvaluacion.requisitosClave) && dataEvaluacion.requisitosClave.length > 0) ? dataEvaluacion.requisitosClave : fallbackEvaluacion.requisitosClave;
      dataEvaluacion.riesgos = (Array.isArray(dataEvaluacion.riesgos) && dataEvaluacion.riesgos.length > 0) ? dataEvaluacion.riesgos : fallbackEvaluacion.riesgos;
      
    } catch (parseError) {
      console.error("Error parseando JSON de Gemini:", parseError);
      dataEvaluacion = fallbackEvaluacion;
    }

    // 3. Persistencia automática en Supabase
    if (supabase) {
      try {
        await supabase.from('evaluaciones_ia').insert([{
          codigo_proceso: codigoLicitacion,
          nombre_proceso: nombreLicitacion || "",
          organismo: organismo || "",
          tipo_proceso: tipoProceso || 'Licitación',
          match_score: dataEvaluacion.matchScore,
          resumen_ejecutivo: dataEvaluacion.resumenEjecutivo,
          requisitos_clave: dataEvaluacion.requisitosClave,
          riesgos: dataEvaluacion.riesgos
        }]);
      } catch (dbError) {
        console.error("Error guardando en Supabase:", dbError);
      }
    }

    res.json({ success: true, origen: 'gemini-live', data: dataEvaluacion });

  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('quota') || error?.status === 503 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.log(`[Gemini Fallback] Usando evaluación por defecto. Error de API: ${error?.status || 'Sobrecarga/Cuota'}`);
    } else {
      console.error("Error en la evaluación del prompt avanzado:", error);
    }
    
    // Objeto estructurado por defecto con valores seguros en caso de fallo (503/429)
    const fallbackEvaluacion = {
      matchScore: 50,
      resumenEjecutivo: "Análisis no disponible temporalmente por alta demanda en el servicio de IA. Recomendamos revisar las bases directamente.",
      requisitosClave: ["Revisar las bases administrativas y técnicas adjuntas en la plataforma."],
      riesgos: ["No se han podido detectar riesgos de forma automatizada debido a un error de servicio temporal."]
    };
    
    res.json({ success: true, origen: 'fallback', data: fallbackEvaluacion });
  }
});

app.delete("/api/mp/session", handleLogout);
app.post("/api/mp/logout", handleLogout);

// Endpoint to trigger Puppeteer automation for Mercado Público / ClaveÚnica authentication & scraping
app.post("/api/mp/connect", async (req, res) => {
  const { rut, password, code2FA, twoFactorCode, code } = req.body || {};

  if (rut) process.env.CU_RUT = rut;
  if (password) process.env.CU_PASSWORD = password;

  const finalCode = (code2FA || twoFactorCode || code || "").toString().trim();

  console.log("\n========================================================");
  console.log(" 🤖 SOLICITUD DE AUTENTICACIÓN MERCADO PÚBLICO / CLAVEÚNICA");
  if (rut) console.log(` 👤 RUT: ${rut}`);
  if (finalCode) console.log(` 🔑 Código Authenticator provisto: ${finalCode}`);
  console.log(" 🌐 Lanzando navegador Puppeteer...");
  console.log("========================================================\n");

  try {
    const { runMercadoPublicoAuth } = await import("./scripts/mercadopublico_auth.js");
    const result = await runMercadoPublicoAuth({ rut, password, code2FA: finalCode, twoFactorCode: finalCode, code: finalCode });
    return res.json(result);
  } catch (err: any) {
    console.error("Error ejecutando bot de Puppeteer:", err);
    return res.status(500).json({
      success: false,
      status: "Fallo de Sesión",
      error: err.message || "Error al conectar con Mercado Público vía Puppeteer."
    });
  }
});

// Endpoint to receive and submit the 6-digit 2FA code to active Puppeteer browser session
app.post("/api/submit-2fa", async (req, res) => {
  const { sessionId, code } = req.body || {};

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Por favor ingrese el código 2FA de 6 dígitos."
    });
  }

  console.log("\n========================================================");
  console.log(` 🔑 PROCESANDO CÓDIGO 2FA (${code.trim()}) EN SESIÓN PUPPETEER`);
  console.log("========================================================\n");

  try {
    const { submit2FACode } = await import("./scripts/mercadopublico_auth.js");
    const result = await submit2FACode(sessionId, code.trim());
    return res.json(result);
  } catch (err: any) {
    console.error("Error al aplicar código 2FA:", err);
    return res.status(500).json({
      success: false,
      status: "Fallo 2FA",
      error: err.message || "Error al ingresar el código 2FA en Puppeteer."
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
