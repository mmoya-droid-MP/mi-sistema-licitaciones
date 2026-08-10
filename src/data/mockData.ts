import { LicitacionItem, Postulacion, AlertaRule, AlertaNotificacion, SET_PALABRAS_CLAVE_MASTER, OrdenCompraItem } from '../types';
import { cleanTextPrefixes } from '../lib/searchUtils';

const SEED_LICITACIONES: LicitacionItem[] = [
  {
    codigo: "587-32-LE26",
    cliente: "MINISTERIO DE VIVIENDA Y URBANISMO (MINVU)",
    nombre: cleanTextPrefixes("Desarrollo e Interoperabilidad de Plataforma GIS y Geolocalización en Nube GCP"),
    descripcion: cleanTextPrefixes("(Contratar la compra de uso de software para la renovación de una 01 licencia Google Maps API, desarrollo de APIs, integración con GeoServer y créditos cloud en Nube GCP)."),
    tipo: "Licitacion",
    montoEstimadoClp: 180000000,
    fechaPublicacion: "2026-08-05T10:00:00",
    fechaCierre: "2026-08-14T15:00:00",
    fechaPreguntas: "2026-08-08T18:00:00",
    fechaRespuestas: "2026-08-10T17:00:00",
    fechaAdjudicacion: "2026-08-25T16:00:00",
    diasRestantes: 7,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=587-32-LE26",
    prioritario: true,
    esUltimos7Dias: true,
    tags: ["google maps", "geolocalizacion", "gcp", "apis", "desarrollo", "software"],
    materia: "Servicios de Tecnologías de la Información",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: false,
  },
  {
    codigo: "CM-5802363-9800AAID",
    cliente: "CARABINEROS DE CHILE - COMISARÍA VIRTUAL",
    nombre: cleanTextPrefixes("[CONVENIO MARCO] Licenciamiento Google Maps API, Créditos Cloud y Soporte Visores Territoriales"),
    descripcion: cleanTextPrefixes("Cotización Convenio Marco CM-5802363 para provisión de créditos Google Maps Platform API (Geocoding, Places, Directions), desarrollo de software, soporte especializado e integración con sistema de cuadrantes y Comisaría Virtual."),
    tipo: "Convenio Marco",
    montoEstimadoClp: 95000000,
    fechaPublicacion: "2026-08-06T11:00:00",
    fechaCierre: "2026-08-20T16:00:00",
    fechaPreguntas: "2026-08-10T17:00:00",
    fechaRespuestas: "2026-08-12T17:00:00",
    diasRestantes: 13,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=5802363-9800AAID",
    prioritario: true,
    esUltimos7Dias: true,
    tags: ["google maps", "comisaria virtual", "visor territorial", "api", "software", "desarrollo", "geolocalizacion"],
    materia: "Geolocalización y Licenciamiento API",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: true,
  },
  {
    codigo: "CM-5802363-0012",
    cliente: "GOBIERNO REGIONAL DE VALPARAÍSO",
    nombre: cleanTextPrefixes("[CONVENIO MARCO] Desarrollo a Medida, Mantención Evolutiva y Arquitectura Cloud Gemini AI"),
    descripcion: cleanTextPrefixes("Grandes compras de Convenio Marco TI (CM-5802363) para desarrollo evolutivo de software, arquitectura cloud con modelos IA Gemini y SecOps para plataformas ciudadanas."),
    tipo: "Convenio Marco",
    montoEstimadoClp: 65000000,
    fechaPublicacion: "2026-08-04T11:00:00",
    fechaCierre: "2026-08-11T16:00:00",
    fechaPreguntas: "2026-08-06T17:00:00",
    fechaRespuestas: "2026-08-08T12:00:00",
    diasRestantes: 4,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=5802363-0012",
    prioritario: true,
    esUltimos7Dias: true,
    tags: ["desarrollo", "convenio marco", "ia", "cloud", "gemini", "secops"],
    materia: "Convenio Marco Desarrollo de Software TI",
    region: "Región de Valparaíso",
    fechaActualizada: false,
  },
  {
    codigo: "CM-5802363-0089",
    cliente: "MINISTERIO DE OBRAS PÚBLICAS (MOP)",
    nombre: cleanTextPrefixes("[CONVENIO MARCO] Sistema de Gestión Documental, BPM y Firma Digital Avanzada"),
    descripcion: cleanTextPrefixes("Cotización de Convenio Marco CM-5802363 para implementación de gestor documental corporativo, automatización de flujos de trabajo BPM y firma digital."),
    tipo: "Convenio Marco",
    montoEstimadoClp: 110000000,
    fechaPublicacion: "2026-08-03T09:00:00",
    fechaCierre: "2026-08-16T18:00:00",
    diasRestantes: 9,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=5802363-0089",
    prioritario: false,
    esUltimos7Dias: true,
    tags: ["gestor documental", "firma digital", "bpm", "convenio marco", "digitalizacion"],
    materia: "Convenio Marco Gestión Documental",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: false,
  },
  {
    codigo: "5455-94-COT26",
    cliente: "UNIVERSIDAD DE CHILE - UCHILE Vicerrectoría de Extensión",
    nombre: cleanTextPrefixes("[COMPRA ÁGIL] Licencias de Software para Desarrollo y Automatización de Procesos AI Workspace"),
    descripcion: cleanTextPrefixes("Adquisición de licencias y créditos para automatización inteligente, asistentes de inteligencia artificial, modelos de lenguaje y APIs de integración."),
    tipo: "Compra Agil",
    montoEstimadoClp: 12500000,
    fechaPublicacion: "2026-08-06T09:30:00",
    fechaCierre: "2026-08-08T17:10:00",
    fechaPreguntas: "2026-08-07T12:00:00",
    fechaRespuestas: "2026-08-07T16:00:00",
    fechaAdjudicacion: "2026-08-12T12:00:00",
    diasRestantes: 1,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=5455-94-COT26",
    prioritario: true,
    esUltimos7Dias: true,
    tags: ["compra agil", "licencias", "desarrollo", "ia", "workspace"],
    materia: "Licenciamiento de Software",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: true,
  },
  {
    codigo: "1250-45-LR26",
    cliente: "SERVICIO DE IMPUESTOS INTERNOS (SII)",
    nombre: cleanTextPrefixes("Servicio de Gobernanza de Datos, Migración PowerBI a Qlik Sense y Modelos AI-First"),
    descripcion: cleanTextPrefixes("Contratación de servicios de analítica de datos, migración de reportes de Power BI a Qlik Sense, tuberías ETL y gobernanza de datos institucional."),
    tipo: "Licitacion",
    montoEstimadoClp: 320000000,
    fechaPublicacion: "2026-08-02T14:20:00",
    fechaCierre: "2026-08-18T18:00:00",
    fechaPreguntas: "2026-08-09T18:00:00",
    fechaRespuestas: "2026-08-12T17:00:00",
    diasRestantes: 11,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=1250-45-LR26",
    prioritario: false,
    esUltimos7Dias: true,
    tags: ["datos", "bi", "powerbi", "qlik sense", "etl", "analitica"],
    materia: "Inteligencia de Negocios y Datos",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: false,
  },
  {
    codigo: "3201-18-COT26",
    cliente: "MUNICIPALIDAD DE CONCEPCIÓN",
    nombre: cleanTextPrefixes("[COMPRA ÁGIL] Desarrollo e Rediseño Portal Web e Intranet Accesible con Mapa Interactivo"),
    descripcion: cleanTextPrefixes("Cotización rápida para implementación de módulo web institucional responsive, reCAPTCHA v3 e integración de mapas interactivos de atención ciudadana."),
    tipo: "Compra Agil",
    montoEstimadoClp: 8500000,
    fechaPublicacion: "2026-08-07T08:00:00",
    fechaCierre: "2026-08-09T14:00:00",
    diasRestantes: 2,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=3201-18-COT26",
    prioritario: false,
    esUltimos7Dias: true,
    tags: ["compra agil", "web", "desarrollo", "mapas", "portal web"],
    materia: "Desarrollo Web",
    region: "Región del Biobío",
    fechaActualizada: true,
  },
  {
    codigo: "6540-12-LE26",
    cliente: "FONDO NACIONAL DE SALUD (FONASA)",
    nombre: cleanTextPrefixes("Modernización y Mantención Evolutiva de Aplicaciones Core, Microservicios y Cloud"),
    descripcion: cleanTextPrefixes("Servicio de ingeniería y fábrica de software para modernización de arquitectura, soporte 24/7 y mantención evolutiva de plataformas digitales de salud."),
    tipo: "Licitacion",
    montoEstimadoClp: 540000000,
    fechaPublicacion: "2026-08-01T12:00:00",
    fechaCierre: "2026-08-22T17:00:00",
    fechaPreguntas: "2026-08-10T17:00:00",
    fechaRespuestas: "2026-08-14T17:00:00",
    diasRestantes: 15,
    estado: "Publicada",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=6540-12-LE26",
    prioritario: false,
    esUltimos7Dias: true,
    tags: ["desarrollo", "mantencion", "cloud", "microservicios", "ingenieria"],
    materia: "Desarrollo de Software",
    region: "Región Metropolitana de Santiago",
    fechaActualizada: false,
  }
];

// Helper to generate a full dynamic catalog of 520 realistic Mercado Público records covering 30 days
function generateFull500PlusCatalog(): LicitacionItem[] {
  const organismos = [
    "MINISTERIO DE VIVIENDA Y URBANISMO (MINVU)",
    "CARABINEROS DE CHILE - COMISARÍA VIRTUAL",
    "GOBIERNO REGIONAL DE VALPARAÍSO",
    "MINISTERIO DE OBRAS PÚBLICAS (MOP)",
    "UNIVERSIDAD DE CHILE - UCHILE",
    "SERVICIO DE IMPUESTOS INTERNOS (SII)",
    "MUNICIPALIDAD DE CONCEPCIÓN",
    "FONDO NACIONAL DE SALUD (FONASA)",
    "SUBSECRETARÍA DE TELECOMUNICACIONES (SUBTEL)",
    "DIRECCIÓN GENERAL DE OBRAS PORTUARIAS",
    "HOSPITAL CLÍNICO SAN BORJA ARRIARÁN",
    "POLICÍA DE INVESTIGACIONES DE CHILE (PDI)",
    "MUNICIPALIDAD DE SANTIAGO",
    "MUNICIPALIDAD DE ANTOFAGASTA",
    "GOBIERNO REGIONAL DEL BIOBÍO",
    "SERVICIO NACIONAL DE PREVENCIÓN Y RESPUESTA ANTE DESASTRES (SENAPRED)",
    "SUBSECRETARÍA DE PREVENCIÓN DEL DELITO",
    "MINISTERIO DE EDUCACIÓN (MINEDUC)",
    "INSTITUTO DE PREVISIÓN SOCIAL (IPS)",
    "SERVIU REGIÓN METROPOLITANA",
    "ARMADA DE CHILE - DIRECCIÓN DE TECNOLOGÍAS",
    "FACULTAD DE CIENCIAS FÍSICAS Y MATEMÁTICAS UCHILE",
    "MUNICIPALIDAD DE TEMUCO",
    "MUNICIPALIDAD DE LA SERENA"
  ];

  const regiones = [
    "Región Metropolitana de Santiago",
    "Región de Valparaíso",
    "Región del Biobío",
    "Región de Antofagasta",
    "Región de La Araucanía",
    "Región de Coquimbo",
    "Región del Maule"
  ];

  const templates = [
    {
      baseNombre: "Licenciamiento Google Maps API, Visores Territoriales y Créditos Nube GCP",
      baseDesc: "Servicios de suscripción e integración de Google Maps Platform API, desarrollo de componentes GIS, geocoding y soporte cloud GCP.",
      materia: "Geolocalización y Tecnologías Nube",
      tags: ["google maps", "maps api", "geolocalizacion", "gis", "gcp", "cloud"]
    },
    {
      baseNombre: "Desarrollo de Software, Mantención Evolutiva y Soporte de Sistemas",
      baseDesc: "Servicio de desarrollo a medida, soporte de sistemas corporativos, fábrica de software y mantención evolutiva de plataformas Web.",
      materia: "Desarrollo de Software TI",
      tags: ["desarrollo", "software", "mantencion evolutiva", "soporte de sistemas", "api"]
    },
    {
      baseNombre: "Plataforma de Inteligencia Artificial Gemini, SecOps y Modelos LLM Workspace",
      baseDesc: "Contratación de servicios de ingeniería en Inteligencia Artificial, integración de modelos Gemini, SecOps y Workspace.",
      materia: "Inteligencia Artificial y Cloud",
      tags: ["gemini", "ia", "cloud", "secops", "workspace", "saas"]
    },
    {
      baseNombre: "Sistema de Gestión Documental, BPM y Firma Digital Avanzada",
      baseDesc: "Implementación e integración de plataforma de gestor documental, flujos BPM, digitalización y firma digital avanzada.",
      materia: "Gestión Documental",
      tags: ["gestor documental", "gestion documental", "bpm", "firma digital", "digitalizacion"]
    },
    {
      baseNombre: "Gobernanza de Datos, Analítica BI y Migración Power BI a Qlik Sense",
      baseDesc: "Servicios de consultoría en datos, construcción de dashboards, tuberías ETL y migración de reportería de Power BI a Qlik Sense.",
      materia: "Inteligencia de Negocios y Analítica",
      tags: ["bi", "power bi", "qlik", "qlik sense", "etl", "datos", "dashboard"]
    },
    {
      baseNombre: "Servicios de Infraestructura Cloud AWS, Azure y Google Cloud (GCP)",
      baseDesc: "Provisión de créditos nube, migración de servidores, servicios administrados SaaS y soporte de ciberseguridad.",
      materia: "Infraestructura Nube",
      tags: ["gcp", "google cloud", "aws", "azure", "cloud", "nube", "saas"]
    },
    {
      baseNombre: "Implementación de Visor Territorial Geográfico y Módulo Comisaría Virtual",
      baseDesc: "Desarrollo e integración de mapas de calor, visores geográficos territoriales, créditos Google y geolocalización.",
      materia: "Visores Territoriales y GIS",
      tags: ["visor territorial", "visor geografico", "comisaria virtual", "gis", "geolocalizacion"]
    }
  ];

  const items: LicitacionItem[] = [...SEED_LICITACIONES];

  // Base date fixed around current date: 2026-08-08
  const baseTimestamp = new Date("2026-08-08T12:00:00").getTime();

  for (let i = 1; i <= 512; i++) {
    const tplIndex = i % templates.length;
    const tpl = templates[tplIndex];
    const cliente = organismos[i % organismos.length];
    const region = regiones[i % regiones.length];

    let tipo: "Licitacion" | "Convenio Marco" | "Compra Agil" = "Licitacion";
    let codigo = "";
    if (i % 3 === 0) {
      tipo = "Convenio Marco";
      codigo = `CM-5802363-${1000 + i}`;
    } else if (i % 3 === 1) {
      tipo = "Compra Agil";
      codigo = `${2000 + i}-99-COT26`;
    } else {
      tipo = "Licitacion";
      const suffix = i % 2 === 0 ? "LE26" : (i % 4 === 0 ? "LP26" : "LR26");
      codigo = `${3000 + i}-${(i % 50) + 10}-${suffix}`;
    }

    // Days until closing distributed between 1 and 30 days
    const diasRestantes = (i % 30) + 1;
    const isUltimos7 = diasRestantes <= 7;
    const fechaCierreObj = new Date(baseTimestamp + diasRestantes * 24 * 60 * 60 * 1000);
    const fechaPubObj = new Date(baseTimestamp - (Math.floor(i / 15) + 1) * 24 * 60 * 60 * 1000);

    const fechaCierreStr = fechaCierreObj.toISOString().slice(0, 19);
    const fechaPubStr = fechaPubObj.toISOString().slice(0, 19);

    const cleanCode = codigo.replace(/^CM-/, '');
    const url = `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${cleanCode}`;

    const nombreLimpio = cleanTextPrefixes(`${tpl.baseNombre} - ${cliente.split(' ')[0]}`);
    const descLimpia = cleanTextPrefixes(`${tpl.baseDesc} Requerimiento oficial del organismo ${cliente} para ejecución regional.`);

    items.push({
      codigo,
      cliente,
      nombre: nombreLimpio,
      descripcion: descLimpia,
      tipo,
      montoEstimadoClp: 5000000 + (i * 1250000) % 250000000,
      fechaPublicacion: fechaPubStr,
      fechaCierre: fechaCierreStr,
      fechaPreguntas: fechaPubStr,
      fechaRespuestas: fechaPubStr,
      diasRestantes,
      estado: "Publicada",
      url,
      prioritario: i % 7 === 0,
      esUltimos7Dias: isUltimos7,
      tags: tpl.tags,
      materia: tpl.materia,
      region,
      fechaActualizada: i % 5 === 0
    });
  }

  return items;
}

export const INITIAL_LICITACIONES: LicitacionItem[] = generateFull500PlusCatalog();

export const INITIAL_POSTULACIONES: Postulacion[] = [
  {
    id: "post-1",
    codigoLicitacion: "587-32-LE26",
    licitacionNombre: "Desarrollo e Interoperabilidad de Plataforma GIS y Geolocalización en Nube GCP",
    cliente: "MINISTERIO DE TRANSPORTE Y TELECOMUNICACIONES",
    tipo: "Licitacion",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=587-32-LE26",
    montoOfertaClp: 175000000,
    estadoPostulacion: "Preparando",
    responsable: "Mauricio Moya",
    fechaCierreOriginal: "2026-08-14T15:00:00",
    fechaLimiteInterna: "2026-08-13T12:00:00",
    notas: "Tenemos ventajas competitivas con Google Maps Platform y arquitectura GCP en proyectos similares previos. Adjuntar certificaciones GCP Cloud Architect.",
    checklist: [
      { id: "c1", label: "Formulario A: Identificación de la empresa", completed: true },
      { id: "c2", label: "Garantía de seriedad de la oferta (Validez 60 días)", completed: true },
      { id: "c3", label: "Propuesta Técnica con diagrama de arquitectura GCP", completed: false },
      { id: "c4", label: "Propuesta Económica desglosada por horas/perfiles", completed: false },
      { id: "c5", label: "Certificados de experiencia en proyectos GIS/Maps", completed: true }
    ],
    historial: [
      { id: "h1", fecha: "2026-08-05 11:30", titulo: "Postulación Creada", detalle: "Se agrega la licitación a la cartera con estado Interés." },
      { id: "h2", fecha: "2026-08-06 09:15", titulo: "Revisión TDR Aprobada", detalle: "El equipo técnico validó los requerimientos de APIs y Nube GCP." },
      { id: "h3", fecha: "2026-08-07 14:00", titulo: "Paso a Preparando Oferta", detalle: "Asignado responsable técnico y económico." }
    ],
    updatedAt: "2026-08-07T14:00:00"
  },
  {
    id: "post-2",
    codigoLicitacion: "5455-94-COT26",
    licitacionNombre: "Licencias de Software para Desarrollo y Automatización de Procesos AI Workspace",
    cliente: "UNIVERSIDAD DE CHILE - UCHILE Vicerrectoría de Extensión",
    tipo: "Compra Agil",
    url: "https://www.mercadopublico.cl/BuscarLicitacion?codigo=5455-94-COT26",
    montoOfertaClp: 11900000,
    estadoPostulacion: "Enviada",
    responsable: "Andrea Torres",
    fechaCierreOriginal: "2026-08-08T17:10:00",
    fechaLimiteInterna: "2026-08-08T10:00:00",
    notas: "Cotización ingresada directamente en el portal de Compra Ágil con entrega inmediata de créditos de licenciamiento.",
    checklist: [
      { id: "c1", label: "Cotización formal PDF sellada", completed: true },
      { id: "c2", label: "Comprobante de Partner Autorizado", completed: true },
      { id: "c3", label: "Ficha técnica de productos AI Workspace", completed: true }
    ],
    historial: [
      { id: "h1", fecha: "2026-08-06 14:00", titulo: "Cotización Enviada", detalle: "Oferta ingresada con éxito en el sistema de Compra Ágil." }
    ],
    updatedAt: "2026-08-06T14:00:00"
  }
];

export const INITIAL_ALERTAS: AlertaRule[] = [
  {
    id: "alerta-1",
    nombre: "Licencias & Cloud GCP / AWS / Azure",
    palabrasClave: ["gcp", "aws", "azure", "cloud", "nube", "workspace"],
    organismos: [],
    tipos: ["Licitacion", "Convenio Marco", "Compra Agil"],
    montoMinimoClp: 5000000,
    diasCierreMaximo: 10,
    notificarEmail: true,
    notificarApp: true,
    activa: true,
    creadaEn: "2026-08-01"
  },
  {
    id: "alerta-2",
    nombre: "Desarrollo Software & GIS / Geolocalización",
    palabrasClave: ["desarrollo", "software", "api", "geolocalizacion", "gis", "maps"],
    organismos: ["MINISTERIO DE TRANSPORTE Y TELECOMUNICACIONES", "GOBIERNO REGIONAL DE VALPARAÍSO"],
    tipos: ["Licitacion", "Compra Agil"],
    montoMinimoClp: 20000000,
    diasCierreMaximo: 15,
    notificarEmail: true,
    notificarApp: true,
    activa: true,
    creadaEn: "2026-08-03"
  }
];

export const INITIAL_NOTIFICACIONES: AlertaNotificacion[] = [
  {
    id: "notif-1",
    codigoLicitacion: "5455-94-COT26",
    titulo: "🚨 Cambio de Fecha de Cierre",
    mensaje: "La cotización UCHILE 5455-94-COT26 actualizó su fecha de cierre a 08/08/2026 17:10 (se sincronizó con Google Calendar).",
    fecha: "2026-08-07T16:30:00",
    leida: false,
    tipo: "CAMBIO_FECHA"
  },
  {
    id: "notif-2",
    codigoLicitacion: "587-32-LE26",
    titulo: "✨ Alta Coincidencia de Alerta (Match 95%)",
    mensaje: "Licitación prioritaria detectada: Desarrollo e Interoperabilidad GIS en GCP.",
    fecha: "2026-08-05T10:15:00",
    leida: true,
    tipo: "ALERTA_MATCH"
  }
];

export const INITIAL_ORDENES_COMPRA: OrdenCompraItem[] = [
  {
    id: '931-144-AG26',
    nombre: 'COMPRA ÁGIL: 931-75-COT26 Rack y soporte para discos pesas PCH Req.127',
    organismo: 'INSTITUTO NACIONAL DE DEPORTES DE CHILE',
    fecha: '2026-08-07',
    monto: 2070000,
    estado: 'Enviada a proveedor',
    tipo: 'Orden de Compra'
  },
  {
    id: '3447-2294-SE26',
    nombre: 'Software de Operación y Gestión Administrativa para el Juzgado de Policía Local, Inspección Municipal y Oficina de Información de Reclamos y Sugerencias, con Servicio de Soporte y Mantención ID 3447-73-LP25',
    organismo: 'MUNICIPALIDAD DE ALTO HOSPICIO',
    fecha: '2026-08-07',
    monto: 4194750,
    estado: 'Enviada a proveedor',
    tipo: 'Orden de Compra'
  },
  {
    id: '1618-221-SE26',
    nombre: 'Servicios de Soporte julio 2026',
    organismo: 'DIRECCION DE PRESUPUESTOS MINISTERIO DE HACIENDA',
    fecha: '2026-08-07',
    monto: 48205161,
    estado: 'Enviada a proveedor',
    tipo: 'Orden de Compra'
  },
  {
    id: '5418-175-SE26',
    nombre: 'SERVICIO STREAMING Y SOPORTE AUDIOVISUAL',
    organismo: 'GOBIERNO REGIONAL DE LOS RIOS',
    fecha: '2026-08-07',
    monto: 3400000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  },
  {
    id: '1057402-8407-SE26',
    nombre: '(5076) SERVICIO SOPORTE INFORMATICO PARA TECNOLOGIA DE LA INFORMACION Y COMUNICACIONES DEL HCM AGOSTO 2026',
    organismo: 'HOSPITAL CLINICO DE MAGALLANES DR. LAUTARO NAVARRO AVARIA',
    fecha: '2026-08-07',
    monto: 14200000,
    estado: 'Enviada a proveedor',
    tipo: 'Orden de Compra'
  },
  {
    id: '2989-451-SE26',
    nombre: 'INSTALACIÓN SOPORTE TV Y PIZARRA CESFAM',
    organismo: 'I MUNICIPALIDAD DE LOS MUERMOS',
    fecha: '2026-08-07',
    monto: 890000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  },
  {
    id: '867990-430-AG26',
    nombre: 'CC:102 - CDP 92292. ADQUISICIÓN SMART TV + SOPORTES. ID: 867990-382-COT26',
    organismo: 'UNIVERSIDAD DE SANTIAGO DE CHILE',
    fecha: '2026-08-07',
    monto: 2100000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  },
  {
    id: '1031847-16-SE26',
    nombre: 'TIC - SOPORTE - ARRIENDO IMPRESORAS JULIO',
    organismo: 'SERVICIO DE SALUD NUBLE',
    fecha: '2026-08-07',
    monto: 5600000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  },
  {
    id: '1238177-131-AG26',
    nombre: 'SERVICIO SOPORTE TI: 1238177-92-COT26',
    organismo: 'ASOCIACION DE MUNICIPIOS METROPOLITANOS PARA LA SE',
    fecha: '2026-08-07',
    monto: 4300000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  },
  {
    id: '1057508-2148-SE26',
    nombre: 'TIC - SOPORTE - ARRIENDO EQUIPOS COMP (25)',
    organismo: 'SERVICIO DE SALUD NUBLE',
    fecha: '2026-08-07',
    monto: 9800000,
    estado: 'Aceptada',
    tipo: 'Orden de Compra'
  }
];

