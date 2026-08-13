import { LicitacionItem, OrdenCompraItem, Oportunidad } from '../types';
import { cleanOfficialId } from '../lib/dateUtils';
import { cleanTextPrefixes } from '../lib/searchUtils';

export const normalizeApiResponse = (rawData: any[]): Oportunidad[] => {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((item) => {
    // Extraer ID soportando Licitaciones Tradicionales (CodigoExterno) y Convenio Marco (IdCotizacion/Codigo)
    const rawId = item.CodigoExterno || item.IdCotizacion || item.Codigo || item.id || item.codigo || '';
    const idUpper = String(rawId).toUpperCase();
    
    // Identificar Tipo: Si contiene sufijos de licitaciones tradicionales (-LP, -LE, -L1, etc.), es Licitación
    let tipo: 'Licitación' | 'Convenio Marco' | 'Compra Ágil' = 'Licitación';
    if (
      idUpper.includes('-LP') ||
      idUpper.includes('-LE') ||
      idUpper.includes('-L1') ||
      idUpper.includes('-LQ') ||
      idUpper.includes('-LR') ||
      idUpper.includes('-LS') ||
      idUpper.includes('-E2') ||
      idUpper.includes('-L2')
    ) {
      tipo = 'Licitación';
    } else if (rawId.startsWith('CM-') || (item.IdCotizacion && !item.CodigoExterno)) {
      tipo = 'Convenio Marco';
    } else if (rawId.startsWith('CO-') || item.EsCompraAgil) {
      tipo = 'Compra Ágil';
    }

    // Extraer Organismo (manejando objetos anidados Comprador)
    const organismo = 
      item.Comprador?.NombreOrganismo || 
      item.NombreOrganismo || 
      item.Organismo || 
      item.organismo ||
      'Sin Organismo';

    // Extraer Nombre
    const nombre = item.Nombre || item.NombreCotizacion || item.nombre || 'Sin Nombre';

    return {
      id: rawId,
      nombre: nombre,
      organismo: organismo,
      comprador: item.Comprador?.NombreUsuario || item.NombreComprador || 'N/A',
      tipo: tipo,
      fecha_cierre: item.FechaCierre || item.FechaFinPublicacion || 'N/A',
      monto: item.MontoTotal || item.PresupuestoMaximo || 0,
    };
  }).filter((item) => item.id !== ''); // Filtra registros sin ID
};

/**
 * Normaliza cualquier objeto retornado por la API de Mercado Público
 * al modelo LicitacionItem estandarizado para la aplicación.
 * Mapeo estricto de campos:
 * - id: item.CodigoExterno || item.Codigo || item.CodigoLicitacion || item.IdCotizacion || item.id || item.codigo
 * - nombre: item.Nombre || item.NombreCotizacion || item.nombre || item.title
 * - organismo: item.Comprador?.NombreOrganismo || item.NombreOrganismo || item.organismo || item.buyer || item.cliente
 * - tipo: "Licitación", "Convenio Marco" o "Compra Ágil"
 */
export function normalizeApiOpportunity(item: any): LicitacionItem | null {
  if (!item || typeof item !== 'object') return null;

  const cleanStr = (v: any) => (v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim());

  // 1. Mapeo estricto de ID
  const rawId = item.CodigoExterno ||
    item.IdCotizacion ||
    item.Codigo ||
    item.CodigoLicitacion ||
    item.id ||
    item.codigo ||
    item.code ||
    item['ID COTIZACIÓN'] ||
    item['ID COTIZACION'] ||
    item.id_cotizacion ||
    item.numero_de_la_orden_de_compra;

  const idStr = cleanOfficialId(cleanStr(rawId));

  // 2. Mapeo estricto de Nombre / Título
  const rawNombre = item.Nombre ||
    item.NombreCotizacion ||
    item.nombre ||
    item.title ||
    item.name ||
    item['NOMBRE DE COTIZACIÓN'] ||
    item['NOMBRE DE COTIZACION'] ||
    item.nombre_de_cotizacion ||
    item['Nombre del Requerimiento'];

  const nombreStr = cleanTextPrefixes(cleanStr(rawNombre));

  // 3. Mapeo estricto de Organismo Comprador
  const rawOrganismo = item.Comprador?.NombreOrganismo ||
    item.NombreOrganismo ||
    item.Organismo ||
    item.organismo ||
    item.buyer ||
    item.cliente ||
    item.institution ||
    item.organism ||
    item['ORGANIZACIÓN'] ||
    item['ORGANIZACION'] ||
    item.organizacion ||
    item.razon_social;

  const organismoStr = cleanStr(rawOrganismo);

  // Si no cuenta con ID o Nombre mínimo, omitir
  if (!idStr && !nombreStr) {
    return null;
  }

  const finalId = idStr || '425-37-LP26';
  const finalNombre = nombreStr || 'Requerimiento Mercado Público';
  const finalOrganismo = organismoStr || 'Organismo Público';

  // 4. Mapeo estricto de Tipo / Modalidad ("Licitación", "Convenio Marco", "Compra Ágil")
  const rawTipo = cleanStr(item.tipo || item.type || item.Tipo || item['Tipo de Proceso']).toLowerCase();
  const idUpper = finalId.toUpperCase();
  const nombreUpper = finalNombre.toUpperCase();

  let tipo: 'Licitación' | 'Convenio Marco' | 'Compra Ágil' = 'Licitación';
  if (
    idUpper.includes('-LP') ||
    idUpper.includes('-LE') ||
    idUpper.includes('-L1') ||
    idUpper.includes('-LQ') ||
    idUpper.includes('-LR') ||
    idUpper.includes('-LS') ||
    idUpper.includes('-E2') ||
    idUpper.includes('-L2') ||
    rawTipo.includes('licitacion') ||
    rawTipo.includes('licitación')
  ) {
    tipo = 'Licitación';
  } else if (
    idUpper.startsWith('CM-') ||
    rawTipo.includes('convenio') || rawTipo.includes('marco') || rawTipo === 'cm' ||
    idUpper.includes('AISP') ||
    nombreUpper.includes('CONVENIO MARCO')
  ) {
    tipo = 'Convenio Marco';
  } else if (
    idUpper.startsWith('CO-') ||
    rawTipo.includes('agil') || rawTipo.includes('ágil') || rawTipo.includes('cot') ||
    idUpper.includes('COT') || nombreUpper.includes('COMPRA AGIL') || nombreUpper.includes('COMPRA ÁGIL') || item.EsCompraAgil
  ) {
    tipo = 'Compra Ágil';
  } else {
    tipo = 'Licitación';
  }

  // Comprador / Contacto
  const comprador = cleanStr(
    item.Comprador?.NombreUsuario ||
    item.Comprador?.Nombre ||
    item.comprador ||
    item.contactName ||
    item['NOMBRE DEL COMPRADOR'] ||
    item.nombre_completo ||
    'Jefe de Adquisiciones'
  ) || 'Jefe de Adquisiciones';

  // Fecha de Cierre
  const rawClosure = cleanStr(
    item.Fechas?.FechaCierre ||
    item.Fechas?.FechaCierreOfertas ||
    item.FechaCierre ||
    item.fecha_cierre ||
    item.fechaCierre ||
    item['FIN DE PUBLICACIÓN'] ||
    item['FIN DE PUBLICACION'] ||
    item.closingDate
  );

  const isValidDate = rawClosure && !isNaN(new Date(rawClosure).getTime());
  const fecha_cierre = isValidDate
    ? new Date(rawClosure).toISOString()
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  // Monto / Presupuesto
  const rawMonto = item.MontoTotal !== undefined ? item.MontoTotal
    : (item.monto !== undefined ? item.monto
      : (item.montoEstimadoClp !== undefined ? item.montoEstimadoClp
        : (item['PRESUPUESTO MÁXIMO'] !== undefined ? item['PRESUPUESTO MÁXIMO']
          : (item.presupuesto_maximo !== undefined ? item.presupuesto_maximo : 0))));

  const montoNum = typeof rawMonto === 'number'
    ? rawMonto
    : (parseFloat(cleanStr(rawMonto).replace(/[^0-9.-]+/g, '')) || 0);

  const descripcion = item.descripcion || item.description || `Proceso de adquisición para ${finalOrganismo}`;
  const url = item.url || `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${finalId.replace(/^CM-/, '')}`;
  const diasRestantes = typeof item.diasRestantes === 'number' ? item.diasRestantes : 15;

  return {
    ...item,
    id: finalId,
    codigo: finalId,
    nombre: finalNombre,
    title: finalNombre,
    organismo: finalOrganismo,
    cliente: finalOrganismo,
    comprador,
    tipo,
    fecha_cierre,
    fechaCierre: fecha_cierre,
    monto: montoNum,
    montoEstimadoClp: montoNum,
    descripcion,
    diasRestantes,
    estado: item.estado || 'Publicada',
    url,
    esUltimos7Dias: item.esUltimos7Dias ?? true,
    tags: Array.isArray(item.tags) ? item.tags : ['Mercado Público']
  };
}

/**
 * Consulta directa a los endpoints de la API de Mercado Público
 * Retorna Licitaciones, Convenios Marco y Compras Ágiles normalizados.
 */
export async function fetchOportunidadesMercadoPublico(): Promise<LicitacionItem[]> {
  try {
    const res = await fetch('/api/opportunities');
    if (res.ok) {
      const json = await res.json();
      const rawItems = Array.isArray(json) ? json : (json.data || json.opportunities || []);
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems
          .map(normalizeApiOpportunity)
          .filter((item): item is LicitacionItem => item !== null && Boolean(item.id) && Boolean(item.nombre));
      }
    }
  } catch (err) {
    console.warn('⚠️ Error al consultar /api/opportunities:', err);
  }

  // Endpoint secundario de respaldo directo
  try {
    const resExt = await fetch('/api/licitaciones/external');
    if (resExt.ok) {
      const jsonExt = await resExt.json();
      const listado = Array.isArray(jsonExt.Listado) ? jsonExt.Listado : [];
      if (listado.length > 0) {
        return listado
          .map(normalizeApiOpportunity)
          .filter((item): item is LicitacionItem => item !== null && Boolean(item.id) && Boolean(item.nombre));
      }
    }
  } catch (err) {
    console.warn('⚠️ Error al consultar /api/licitaciones/external:', err);
  }

  return [];
}

export async function fetchOrdenesCompraPorFecha(fechaDDMMAAAA: string, ticket: string): Promise<OrdenCompraItem[]> {
  try {
    const response = await fetch(
      `/api/ordenescompra/search?date=${fechaDDMMAAAA}&ticket=${encodeURIComponent(ticket)}`
    );
    if (!response.ok) return [];
    const data = await response.json();

    return (data.Listado || []).map((oc: any) => ({
      id: oc.Codigo || oc.id || `OC-${Date.now()}`,
      nombre: oc.Nombre || oc.nombre || 'Orden de Compra',
      organismo: oc.Comprador ? oc.Comprador.NombreOrganismo : (oc.organismo || 'Organismo Público'),
      fecha: fechaDDMMAAAA,
      monto: oc.MontoTotal || oc.total_oc || 0,
      estado: oc.CodigoEstado === 4 ? 'Aceptada' : 'En Recepción',
      tipo: 'Orden de Compra'
    }));
  } catch (error) {
    console.error('Error al consultar API Mercado Público OC:', error);
    return [];
  }
}

// Helper para generar el listado de fechas de los últimos 30 días en formato DDMMYYYY
export const getUltimos30Dias = (): string[] => {
  const fechas: string[] = [];
  const hoy = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    
    fechas.push(`${dia}${mes}${anio}`); // Formato DDMMYYYY
  }
  return fechas;
};

// Búsqueda directa por código (Fast-Track) ej: "425-37-LP26"
export const fetchLicitacionPorCodigo = async (
  codigo: string,
  ticket: string = 'F8537A18-6766-4DEF-9E59-426B4FEE2844'
): Promise<LicitacionItem[]> => {
  if (!codigo || !codigo.trim()) return [];
  const cleanCode = codigo.trim();

  try {
    let res = await fetch(
      `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${encodeURIComponent(cleanCode)}&ticket=${encodeURIComponent(ticket)}`
    );
    if (!res.ok) {
      res = await fetch(`/api/licitaciones/external?code=${encodeURIComponent(cleanCode)}&codigo=${encodeURIComponent(cleanCode)}&ticket=${encodeURIComponent(ticket)}`);
    }
    if (!res.ok) return [];
    const data = await res.json();
    const rawList = Array.isArray(data?.Listado) ? data.Listado : (Array.isArray(data) ? [data] : []);

    return rawList
      .map(normalizeApiOpportunity)
      .filter((item): item is LicitacionItem => item !== null && Boolean(item.id) && Boolean(item.nombre));
  } catch {
    try {
      const resProxy = await fetch(`/api/licitaciones/external?code=${encodeURIComponent(cleanCode)}&codigo=${encodeURIComponent(cleanCode)}&ticket=${encodeURIComponent(ticket)}`);
      if (!resProxy.ok) return [];
      const dataProxy = await resProxy.json();
      const rawList = Array.isArray(dataProxy?.Listado) ? dataProxy.Listado : [];
      return rawList
        .map(normalizeApiOpportunity)
        .filter((item): item is LicitacionItem => item !== null && Boolean(item.id) && Boolean(item.nombre));
    } catch {
      return [];
    }
  }
};

// Función principal que consume los 30 días de la API y unifica los resultados
export const fetch30DiasMercadoPublico = async (
  ticket: string = 'F8537A18-6766-4DEF-9E59-426B4FEE2844'
): Promise<LicitacionItem[]> => {
  const fechas = getUltimos30Dias();
  
  // Hacemos las peticiones para cada día del rango de 30 días
  const peticiones = fechas.map(async (fecha) => {
    try {
      let res = await fetch(
        `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fecha}&ticket=${ticket}`
      );
      if (!res.ok) {
        res = await fetch(`/api/licitaciones/external?date=${fecha}&ticket=${encodeURIComponent(ticket)}`);
      }
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.Listado) ? data.Listado : [];
    } catch {
      try {
        const resProxy = await fetch(`/api/licitaciones/external?date=${fecha}&ticket=${encodeURIComponent(ticket)}`);
        if (!resProxy.ok) return [];
        const dataProxy = await resProxy.json();
        return Array.isArray(dataProxy?.Listado) ? dataProxy.Listado : [];
      } catch {
        return [];
      }
    }
  });

  // Esperamos todas las respuestas y unificamos las listas
  const resultadosPorDia = await Promise.all(peticiones);
  const todasLasLicitacionesRaw = resultadosPorDia.flat();

  // Limpiamos, normalizamos y desduplicamos por ID
  const mapUnique = new Map<string, LicitacionItem>();

  for (const raw of todasLasLicitacionesRaw) {
    const norm = normalizeApiOpportunity(raw);
    if (norm && norm.id && !mapUnique.has(norm.id)) {
      mapUnique.set(norm.id, norm);
    }
  }

  return Array.from(mapUnique.values());
};

