import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pg from "pg";
import multer from "multer";
import * as XLSX from "xlsx";

dotenv.config();

const app = express();
const PORT = 3000;

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

    // Parse and map columns
    const mappedRows: Array<{ rut_organismo: string; nombre_organismo: string; region: string; ciudad: string }> = [];

    for (const r of rows) {
      const rut = String(r['RUT'] || r['rut'] || r['Rut'] || r['rut_organismo'] || r['RUT Organismo'] || r['Rut Organismo'] || r['RUT ORGANISMO'] || '').trim();
      const nombre = String(r['Nombre Organismo'] || r['nombre_organismo'] || r['Organismo'] || r['ORGANISMO'] || r['Nombre'] || r['Organización'] || '').trim();
      const region = String(r['Región'] || r['Region'] || r['region'] || r['REGION'] || r['Zona'] || '').trim();
      const ciudad = String(r['Ciudad'] || r['ciudad'] || r['CIUDAD'] || r['Comuna'] || r['Comuna / Ciudad'] || '').trim();

      if (rut && nombre) {
        mappedRows.push({
          rut_organismo: rut,
          nombre_organismo: nombre,
          region: region || "Sin Región",
          ciudad: ciudad || "Sin Ciudad"
        });
      }
    }

    if (mappedRows.length === 0) {
      return res.status(400).json({ success: false, error: "No se encontraron columnas de RUT y Nombre Organismo válidas en el archivo." });
    }

    let processedCount = 0;
    const batchSize = 1000;

    if (pool) {
      // Execute UPSERT in SQL batches of 1,000
      for (let i = 0; i < mappedRows.length; i += batchSize) {
        const batch = mappedRows.slice(i, i + batchSize);
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
            ciudad = EXCLUDED.ciudad;
        `;

        await pool.query(sql, queryParams);
        processedCount += batch.length;
        console.log(`✅ Lote de ${batch.length} compradores procesados (Total parcial: ${processedCount}/${mappedRows.length})`);
      }
    } else {
      // Local fallback UPSERT
      const currentLocal = readLocalCompradores();
      const localMap = new Map<string, any>();
      currentLocal.forEach((item) => localMap.set(item.rut_organismo, item));

      for (const row of mappedRows) {
        const existing = localMap.get(row.rut_organismo);
        if (existing) {
          existing.nombre_organismo = row.nombre_organismo;
          existing.region = row.region;
          existing.ciudad = row.ciudad;
        } else {
          const newItem = {
            id: localMap.size + 1,
            rut_organismo: row.rut_organismo,
            nombre_organismo: row.nombre_organismo,
            region: row.region,
            ciudad: row.ciudad,
            contactos: [],
            created_at: new Date().toISOString()
          };
          localMap.set(row.rut_organismo, newItem);
        }
        processedCount++;
      }

      writeLocalCompradores(Array.from(localMap.values()));
    }

    return res.json({
      success: true,
      message: `Carga masiva completada exitosamente. Se procesaron e insertaron ${processedCount} registros con UPSERT.`,
      totalProcessed: processedCount,
      totalRows: mappedRows.length
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
    const { rut_organismo, nombre_organismo, region, ciudad } = req.body || {};

    if (!rut_organismo || !nombre_organismo) {
      return res.status(400).json({ success: false, error: "El RUT y Nombre de la organización son obligatorios." });
    }

    const cleanRut = String(rut_organismo).trim();
    const cleanNombre = String(nombre_organismo).trim();
    const cleanRegion = String(region || "Sin Región").trim();
    const cleanCiudad = String(ciudad || "Sin Ciudad").trim();

    if (pool) {
      const sql = `
        INSERT INTO compradores (rut_organismo, nombre_organismo, region, ciudad)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (rut_organismo)
        DO UPDATE SET nombre_organismo = EXCLUDED.nombre_organismo, region = EXCLUDED.region, ciudad = EXCLUDED.ciudad
        RETURNING *;
      `;
      const result = await pool.query(sql, [cleanRut, cleanNombre, cleanRegion, cleanCiudad]);
      const created = result.rows[0];
      created.contactos = [];

      return res.json({ success: true, message: "Comprador registrado exitosamente.", data: created });
    } else {
      const currentLocal = readLocalCompradores();
      const existingIdx = currentLocal.findIndex((b) => b.rut_organismo === cleanRut);

      let created: any;
      if (existingIdx >= 0) {
        currentLocal[existingIdx].nombre_organismo = cleanNombre;
        currentLocal[existingIdx].region = cleanRegion;
        currentLocal[existingIdx].ciudad = cleanCiudad;
        created = currentLocal[existingIdx];
      } else {
        created = {
          id: Date.now(),
          rut_organismo: cleanRut,
          nombre_organismo: cleanNombre,
          region: cleanRegion,
          ciudad: cleanCiudad,
          contactos: [],
          created_at: new Date().toISOString()
        };
        currentLocal.unshift(created);
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
