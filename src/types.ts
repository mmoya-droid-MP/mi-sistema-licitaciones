export type TipoProceso = 'Licitación' | 'Convenio Marco' | 'Compra Ágil' | 'Licitacion' | 'Compra Agil' | 'Orden de Compra';

export const SET_PALABRAS_CLAVE_MASTER = [
  // 1. Google Maps, GIS y Geolocalización
  "google maps", "maps api", "geolocalizacion", "gis", "visor territorial", 
  "visor geografico", "creditos google", "comisaria virtual",

  // 2. Infraestructura Cloud y Servicios Nube
  "gcp", "google cloud", "aws", "azure", "cloud", "nube", "saas", 
  "secops", "workspace",

  // 3. Desarrollo de Software e Inteligencia Artificial
  "desarrollo", "software", "mantencion evolutiva", "soporte de sistemas", 
  "gemini", "ia", "ai", "microservicios", "ui/ux", "api", "licencia de software", "selico",

  // 4. Datos, BI, ETL y Analítica
  "bi", "power bi", "qlik", "qlik sense", "etl", "gobernanza de datos", 
  "migracion de datos", "datos", "dashboard", "ai-first",

  // 5. Gestión Documental, Process & Firma
  "gestor documental", "gestion documental", "bpm", "firma digital", "digitalizacion"
] as const;

export const SET_PALABRAS_CLAVE = SET_PALABRAS_CLAVE_MASTER;

export interface LicitacionItem {
  // Required Unified Properties
  id: string;               // e.g. "425-37-LP26" or "5802363-9487AISP"
  nombre: string;           // Requirement title
  organismo: string;        // Institution name
  tipo: TipoProceso;        // "Licitación" | "Convenio Marco" | "Compra Ágil"
  comprador: string;        // Buyer contact name
  fecha_cierre: string;     // Closing date
  monto: number | string;   // Amount

  // Backward compatibility aliases
  codigo: string;           // Alias for id
  cliente: string;          // Alias for organismo
  montoEstimadoClp?: number;// Alias for monto
  fechaCierre: string;      // Alias for fecha_cierre
  descripcion?: string;
  fechaPublicacion?: string;
  fechaPreguntas?: string;
  fechaRespuestas?: string;
  fechaAdjudicacion?: string;
  diasRestantes?: number;
  estado?: string;
  url?: string;
  prioritario?: boolean;
  esUltimos7Dias?: boolean;
  tags?: string[];
  materia?: string;
  region?: string;
  fechaActualizada?: boolean;
  FechaCierreRecepcionOfertas?: string;
  FechaCierreOficial?: string;
  FechaFinPublicacion?: string;
  FechaCierreCotizacion?: string;
  [key: string]: any;
}

export type EstadoPostulacion = 'Interes' | 'TDR' | 'Preparando' | 'Enviada' | 'Adjudicada' | 'Desestimada';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface HistorialCambio {
  id: string;
  fecha: string;
  titulo: string;
  detalle: string;
}

export interface Postulacion {
  id: string;
  codigoLicitacion: string;
  licitacionNombre: string;
  cliente: string;
  tipo: TipoProceso;
  url: string;
  montoOfertaClp?: number;
  estadoPostulacion: EstadoPostulacion;
  responsable: string;
  fechaCierreOriginal: string;
  fechaLimiteInterna: string;
  notas: string;
  checklist: ChecklistItem[];
  historial: HistorialCambio[];
  updatedAt: string;
}

export interface AlertaRule {
  id: string;
  nombre: string;
  palabrasClave: string[];
  organismos: string[];
  tipos: TipoProceso[];
  montoMinimoClp?: number;
  diasCierreMaximo?: number;
  notificarEmail: boolean;
  notificarApp: boolean;
  activa: boolean;
  creadaEn: string;
}

export interface AlertaNotificacion {
  id: string;
  alertaId?: string;
  codigoLicitacion: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: 'NUEVA_LICITACION' | 'CAMBIO_FECHA' | 'CIERRE_PROXIMO' | 'ALERTA_MATCH';
}

export interface GeminiAnalysisResult {
  matchScore: number; // 0 to 100
  resumenEjecutivo: string;
  requisitosClave: string[];
  riesgosDetectados: string[];
  recomendacionesEstrategicas: string[];
  perfilesRequeridos: string[];
}

export interface Oportunidad {
  id: string;
  nombre: string;
  organismo: string;
  comprador: string;
  tipo: 'Licitación' | 'Convenio Marco' | 'Compra Ágil';
  fecha_cierre: string;
  monto: string | number;
  codigo?: string;
  url?: string;
  diasRestantes?: number;
  [key: string]: any;
}

export type EstadoOrdenCompra = 'Aceptada' | 'Enviada' | 'En Proceso' | 'Cancelada' | 'En Recepción' | 'Enviada a proveedor';

export interface OrdenCompraItem {
  id: string;
  codigo?: string;
  nombre: string;
  organismo?: string;
  cliente?: string;
  rutCliente?: string;
  proveedor?: string;
  monto: number;
  montoClp?: number;
  fecha: string;
  fechaCreacion?: string;
  fechaEnvio?: string;
  estado: EstadoOrdenCompra;
  descripcion?: string;
  tipo?: TipoProceso;
  items?: { id: string; especificacion: string; cantidad: number; precioUnitarioClp: number }[];
  url?: string;
  tags?: string[];
}

