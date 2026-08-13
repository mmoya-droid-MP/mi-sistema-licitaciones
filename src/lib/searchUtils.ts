import { extractFechaCierre, getItemOfficialUrl, calculateChileRemainingTime, cleanOfficialId } from './dateUtils';

/**
 * Utility functions for Deep Search, Text Normalization, and Keyword Matching
 * supporting accent/diacritic removal, case-insensitivity, and searching across
 * ID, Name, Description, and Purchasing Agency (Cliente) across all Mercado Público modules.
 */

/**
 * Sanitizes title and description text by removing redundant process-type brackets/prefixes
 * like [COMPRA ÁGIL], [COMPRA AGIL], [CONVENIO MARCO], [LICITACIÓN], [LICITACION], etc.
 * since the process type is already displayed via badges/buttons.
 */
export function cleanTextPrefixes(text: string): string {
  if (!text) return '';
  return text
    .replace(/^\[(COMPRA\s*ÁGIL|COMPRA\s*AGIL|CONVENIO\s*MARCO|LICITACIÓN|LICITACION|LE26|LP26|LR26|COT26)\]\s*/gi, '')
    .trim();
}

/**
 * Normalizes text by converting to lower case, stripping diacritics/accents,
 * and collapsing multiple spaces.
 * E.g., "gestión  425-37-LP26" -> "gestion 425-37-lp26"
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds the full searchable text representation of an opportunity item.
 * Gathers ALL fields (id, code/codigo, title/nombre, buyer/organism/organizacion, type/tipo, etc.)
 */
export function getItemSearchableText(item: any): string {
  if (!item || typeof item !== 'object') return '';

  const rawParts = [
    // 1. ID & Code / Código
    item.id,
    item.code,
    item.codigo,
    item.codigoId,
    item['ID COTIZACIÓN'],
    item['ID COTIZACION'],
    item.id_cotizacion,
    item['Código ID'],
    item['Codigo ID'],
    item.numero_de_la_orden_de_compra,

    // 2. Title & Nombre
    item.title,
    item.nombre,
    item['NOMBRE DE COTIZACIÓN'],
    item['NOMBRE DE COTIZACION'],
    item.nombre_de_cotizacion,
    item['Nombre del Requerimiento'],

    // 3. Buyer & Organism & Organización & Cliente
    item.buyer,
    item.organism,
    item.organizacion,
    item.cliente,
    item['ORGANIZACIÓN'],
    item['ORGANIZACION'],
    item.razon_social,
    item.institution,

    // 4. Type & Tipo
    item.type,
    item.tipo,
    item['Tipo de Proceso'],

    // 5. Contacto, Descripción, Materia, Región, Tags
    item.contactName,
    item['NOMBRE DEL COMPRADOR'],
    item.descripcion,
    item.description,
    item.materia,
    item.region,
    item.location,
    item.comuna,
    Array.isArray(item.tags) ? item.tags.join(' ') : item.tags
  ];

  return normalizeText(rawParts.filter(Boolean).map(String).join(' '));
}

/**
 * Normalizes any raw opportunity object (from API, DB, or JSON state)
 * into the Unified Opportunity Data Structure.
 * Mandatory fields: id, nombre, organismo, tipo, comprador, fecha_cierre, monto
 */
export function createUnifiedOpportunity(raw: any): any {
  if (!raw) {
    return {
      id: '425-37-LP26',
      nombre: 'Requerimiento de Servicios TI',
      organismo: 'Organismo Comprador',
      tipo: 'Licitación',
      comprador: 'Contacto No Especificado',
      fecha_cierre: new Date().toISOString(),
      monto: 0,
      codigo: '425-37-LP26',
      cliente: 'Organismo Comprador',
      montoEstimadoClp: 0,
      fechaCierre: new Date().toISOString(),
      descripcion: '',
      diasRestantes: 0,
      estado: 'Publicada',
      url: 'https://www.mercadopublico.cl',
      esUltimos7Dias: false,
      tags: []
    };
  }

  const cleanStr = (v: any) => (v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim());

  // 1. ID / Código (ej: "425-37-LP26" o "5802363-9487AISP")
  const id = cleanOfficialId(
    cleanStr(
      raw.id || raw.code || raw.codigo || raw['ID COTIZACIÓN'] || raw['ID COTIZACION'] ||
      raw.id_cotizacion || raw.ID_COTIZACION || raw.numero_de_la_orden_de_compra
    )
  ) || '425-37-LP26';

  // 2. Nombre / Título
  const nombre = cleanTextPrefixes(
    cleanStr(
      raw.nombre || raw.title || raw.name || raw['NOMBRE DE COTIZACIÓN'] ||
      raw['NOMBRE DE COTIZACION'] || raw.nombre_de_cotizacion || raw['Nombre del Requerimiento']
    )
  ) || 'Requerimiento de Servicios TI';

  // 3. Organismo / Institución
  const organismo = cleanStr(
    raw.organismo || raw.cliente || raw.buyer || raw.institution || raw.organism ||
    raw['ORGANIZACIÓN'] || raw['ORGANIZACION'] || raw.organizacion || raw.razon_social
  ) || 'Organismo Comprador';

  // 4. Tipo / Modalidad (Valores exactos: "Licitación", "Convenio Marco", "Compra Ágil")
  const rawTypeLower = cleanStr(raw.tipo || raw.type || raw['Tipo de Proceso']).toLowerCase();
  const idUpper = id.toUpperCase();
  const nameUpper = nombre.toUpperCase();

  let tipo: 'Licitación' | 'Convenio Marco' | 'Compra Ágil' = 'Licitación';
  if (
    rawTypeLower.includes('convenio') || rawTypeLower.includes('marco') || rawTypeLower === 'cm' ||
    idUpper.startsWith('CM-') || idUpper.includes('AISP') || nameUpper.includes('CONVENIO MARCO')
  ) {
    tipo = 'Convenio Marco';
  } else if (
    rawTypeLower.includes('agil') || rawTypeLower.includes('ágil') || rawTypeLower.includes('cot') ||
    idUpper.includes('COT') || nameUpper.includes('COMPRA AGIL') || nameUpper.includes('COMPRA ÁGIL')
  ) {
    tipo = 'Compra Ágil';
  } else {
    tipo = 'Licitación';
  }

  // 5. Comprador / Contacto
  const comprador = cleanStr(
    raw.comprador || raw.contactName || raw['NOMBRE DEL COMPRADOR'] ||
    raw.nombre_completo || raw.contacto || raw.email_comprador
  ) || 'Jefe de Adquisiciones';

  // 6. Fecha Cierre
  const rawClosure = cleanStr(
    raw.fecha_cierre || raw.fechaCierre || raw['FIN DE PUBLICACIÓN'] ||
    raw['FIN DE PUBLICACION'] || raw.fin_de_publicacion || raw.closingDate || raw.endDate
  );
  const isValidDate = rawClosure && !isNaN(new Date(rawClosure).getTime());
  const fecha_cierre = isValidDate
    ? new Date(rawClosure).toISOString()
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  // 7. Monto / Presupuesto
  const rawAmount = raw.monto !== undefined ? raw.monto
    : (raw.montoEstimadoClp !== undefined ? raw.montoEstimadoClp
      : (raw['PRESUPUESTO MÁXIMO'] !== undefined ? raw['PRESUPUESTO MÁXIMO']
        : (raw.presupuesto_maximo !== undefined ? raw.presupuesto_maximo : 0)));

  const montoNum = typeof rawAmount === 'number'
    ? rawAmount
    : (parseFloat(cleanStr(rawAmount).replace(/[^0-9.-]+/g, '')) || 0);

  const descripcion = raw.descripcion || `Organismo: ${organismo} | Contacto: ${comprador}`;
  const url = raw.url || `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${id.replace(/^CM-/, '')}`;
  const diasRestantes = typeof raw.diasRestantes === 'number' ? raw.diasRestantes : 15;

  return {
    ...raw,
    // Unified Required Fields
    id,
    nombre,
    organismo,
    tipo,
    comprador,
    fecha_cierre,
    monto: montoNum,

    // Backward-compatibility Aliases
    codigo: id,
    cliente: organismo,
    montoEstimadoClp: montoNum,
    fechaCierre: fecha_cierre,
    descripcion,
    diasRestantes,
    estado: raw.estado || 'Publicada',
    url,
    esUltimos7Dias: raw.esUltimos7Dias ?? true,
    tags: Array.isArray(raw.tags) ? raw.tags : ['Mercado Público']
  };
}

/**
 * Evaluates whether an opportunity item matches a search term across id, nombre, and organismo.
 * Case-insensitive (.toLowerCase()) partial matching (.includes()).
 */
export function matchesSearchTerm(item: any, searchTerm: string): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;

  const term = searchTerm.toLowerCase().trim();

  const idVal = (item.id || item.codigo || '').toString().toLowerCase();
  const nombreVal = (item.nombre || item.title || '').toString().toLowerCase();
  const organismoVal = (item.organismo || item.cliente || item.buyer || '').toString().toLowerCase();

  return idVal.includes(term) || nombreVal.includes(term) || organismoVal.includes(term);
}

/**
 * Filters directly on the `tipo` field.
 * Handles "Todas" / "TODOS" as wildcard, matching exact values "Licitación", "Convenio Marco", "Compra Ágil".
 */
export function matchesTipoExact(itemTipo: string | undefined, selectedTipo: string): boolean {
  if (!selectedTipo || selectedTipo === 'Todas' || selectedTipo === 'TODOS' || selectedTipo === 'All') {
    return true;
  }

  const normSelected = selectedTipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normItem = (itemTipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  return normItem === normSelected || normItem.includes(normSelected);
}

/**
 * Evaluates whether an opportunity item matches a search term across ALL fields.
 * Performs normalized (accent-free, lower-case, collapsed whitespace) multi-field partial matching (.includes()).
 */
export function matchesDeepSearch(
  item: any,
  searchTerm: string
): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;

  // 1. Normalización del término de búsqueda
  const queryNorm = normalizeText(searchTerm);
  if (!queryNorm) return true;

  // 2. Extracción de texto consolidado de todos los campos
  const fullText = getItemSearchableText(item);

  // 3. Coincidencia Parcial mediante .includes()
  if (fullText.includes(queryNorm)) {
    return true;
  }

  // 4. Coincidencia flexible por palabras/tokens individuales (ej: "425-37 lp26" o "minvu 425-37")
  const tokens = queryNorm.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => fullText.includes(token));
}

/**
 * Evaluates whether an opportunity matches all selected tags/keywords deep search.
 * Accent-free and case-insensitive.
 */
export function matchesAllTagsDeep(
  item: {
    codigo?: string;
    nombre?: string;
    cliente?: string;
    organismo?: string;
    descripcion?: string;
    materia?: string;
    region?: string;
    tags?: string[];
    [key: string]: any;
  },
  selectedTags: string[]
): boolean {
  if (!selectedTags || selectedTags.length === 0) return true;
  const fullText = getItemSearchableText(item);
  return selectedTags.every((tag) => fullText.includes(normalizeText(tag)));
}

/**
 * Evaluates whether an item matches a selected process type (Tipo de Compra) flexibly.
 * Uses inclusion (.includes) and keyword/code pattern matching rather than strict string equality (===),
 * preventing "0 Activas" due to minor text differences (e.g. "Licitación Pública" vs "Licitacion", "LE", "LP", "LR").
 */
export function matchesFlexibleTipo(itemTipo: string, selectedTipo: string, itemCodigo?: string): boolean {
  if (!selectedTipo || selectedTipo === 'TODOS' || selectedTipo === 'All') return true;

  const sel = normalizeText(selectedTipo);
  const tipoNorm = normalizeText(itemTipo || '');
  const codNorm = normalizeText(itemCodigo || '');

  // Licitación pública (matches "licitacion", "le", "lp", "lr")
  if (sel.includes('licitac') || sel.includes('le') || sel.includes('lp') || sel.includes('lr') || sel.includes('publica')) {
    return (
      tipoNorm.includes('licitac') ||
      codNorm.includes('-le') ||
      codNorm.includes('-lp') ||
      codNorm.includes('-lr')
    );
  }

  // Convenio Marco (matches "convenio", "marco", "cm")
  if (sel.includes('convenio') || sel.includes('marco') || sel === 'cm') {
    return tipoNorm.includes('convenio') || tipoNorm.includes('cm') || codNorm.startsWith('cm-');
  }

  // Compra Ágil (matches "compra", "agil", "cot")
  if (sel.includes('compra') || sel.includes('agil') || sel.includes('cot')) {
    return tipoNorm.includes('compra') || tipoNorm.includes('agil') || codNorm.includes('-cot');
  }

  return tipoNorm.includes(sel) || sel.includes(tipoNorm);
}

/**
 * Safe property extractors with fallbacks for report generation and dictionary mapping.
 */
export function getItemCodigo(item: any): string {
  if (!item) return 'S/I';
  const raw = item.codigoId || item.codigo || item['ID COTIZACIÓN'] || item['ID COTIZACION'] || item.id_cotizacion || item['Código ID'] || item['Codigo ID'] || item.codigoLicitacion || item.id || 'S/I';
  return cleanOfficialId(raw);
}

export function getItemNombre(item: any): string {
  if (!item) return 'Sin Título';
  return item.nombre || item['NOMBRE DE COTIZACIÓN'] || item['NOMBRE DE COTIZACION'] || item.nombre_de_cotizacion || item['Nombre del Requerimiento'] || item.licitacionNombre || item.title || 'Sin Título';
}

export function getItemOrganismo(item: any): string {
  if (!item) return 'N/A';
  return item.organismo || item.cliente || item['ORGANIZACIÓN'] || item['ORGANIZACION'] || item.organizacion || item.razon_social || item['Organismo Comprador'] || item.organismoComprador || 'N/A';
}

export function getItemDescripcion(item: any): string {
  if (!item) return '';
  return item.descripcion || item['Descripción Completa'] || item.description || item.detalles || '';
}

export function getItemTipo(item: any): string {
  if (!item) return 'Licitación';
  if (item['ID COTIZACIÓN'] || item['ID COTIZACION'] || item.id_cotizacion) return 'Convenio Marco';
  return item.tipo || item['Tipo de Proceso'] || item.tipoProceso || 'Licitación';
}

export function getItemFechaCierre(item: any): string {
  if (!item) return new Date().toISOString();
  const extracted = extractFechaCierre(item);
  if (extracted) return extracted;
  return item.fechaCierre || item['FIN DE PUBLICACIÓN'] || item['FIN DE PUBLICACION'] || item.fin_de_publicacion || item['Fecha Cierre (Chile CLT)'] || item['Fecha Cierre'] || item.fechaCierreOriginal || new Date().toISOString();
}

export function getItemMonto(item: any): number {
  if (!item) return 0;
  if (typeof item.montoEstimadoClp === 'number') return item.montoEstimadoClp;
  if (typeof item.montoOfertaClp === 'number') return item.montoOfertaClp;
  if (typeof item['PRESUPUESTO MÁXIMO'] === 'number') return item['PRESUPUESTO MÁXIMO'];
  if (typeof item['PRESUPUESTO MAXIMO'] === 'number') return item['PRESUPUESTO MAXIMO'];
  if (typeof item.presupuesto_maximo === 'number') return item.presupuesto_maximo;
  if (typeof item['Monto Estimado CLP'] === 'number') return item['Monto Estimado CLP'];
  return 0;
}

export function getItemDiasRestantes(item: any): number {
  if (!item) return 0;
  if (typeof item.diasRestantes === 'number') return item.diasRestantes;
  const fc = getItemFechaCierre(item);
  if (!fc) return 0;
  const rem = calculateChileRemainingTime(fc);
  return rem.dias;
}

export function getItemTags(item: any): string[] {
  if (!item) return [];
  if (Array.isArray(item.tags)) return item.tags;
  if (typeof item.tags === 'string') return item.tags.split(',').map((t: string) => t.trim());
  if (typeof item['Etiquetas / Palabras Clave'] === 'string') {
    return item['Etiquetas / Palabras Clave'].split(',').map((t: string) => t.trim());
  }
  return [];
}

export function getItemUrl(item: any): string {
  if (!item) return 'https://www.mercadopublico.cl';
  const codigo = getItemCodigo(item);
  const tipo = getItemTipo(item);
  return getItemOfficialUrl({ codigo, tipo, url: item.url });
}

export function getItemEstado(item: any): string {
  if (!item) return 'Publicada';
  return item.estado || item['Estado Proceso'] || item.estadoPostulacion || 'Publicada';
}

/**
 * Global Regex pattern for extracting full Mercado Público process IDs.
 * Supports Convenio Marco IDs with CM- prefix and full alphanumeric suffixes (e.g. 2496NNLU, 9800AAID).
 */
export const idPattern = /(?:CM-)?\d+-\d+[A-Za-z0-9]*/gi;

/**
 * Extracts all valid Mercado Público IDs from arbitrary input text.
 */
export function parseMercadoPublicoIds(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(?:CM-)?\d+-\d+[A-Za-z0-9]*/gi);
  return matches ? Array.from(new Set(matches)) : [];
}

