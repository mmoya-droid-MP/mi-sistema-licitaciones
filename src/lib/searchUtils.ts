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
 * Normalizes text by converting to lower case and stripping diacritics/accents.
 * E.g., "gestión" -> "gestion", "Ágil" -> "agil", "GESTIÓN" -> "gestion".
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Builds the full searchable text representation of an opportunity item.
 * Includes: [Código ID] + [Nombre] + [Organismo Comprador] + [Descripción / Ficha Técnica] + [Materia] + [Región] + [Tags]
 */
export function getItemSearchableText(item: {
  codigo?: string;
  nombre?: string;
  cliente?: string;
  organismo?: string;
  descripcion?: string;
  materia?: string;
  region?: string;
  tags?: string[];
  [key: string]: any;
}): string {
  const rawParts = [
    item.codigo || item.id || item.code || item['ID COTIZACIÓN'] || item['ID COTIZACION'] || item.id_cotizacion || '',
    item.nombre || item.title || item['NOMBRE DE COTIZACIÓN'] || item['NOMBRE DE COTIZACION'] || item.nombre_de_cotizacion || '',
    item.cliente || item.organismo || item.buyer || item['ORGANIZACIÓN'] || item['ORGANIZACION'] || item.organizacion || item.razon_social || '',
    item.contactName || item['NOMBRE DEL COMPRADOR'] || item.nombre_completo || '',
    item.descripcion || '',
    item.materia || '',
    item.region || item.location || item.comuna || '',
    item.tags ? item.tags.join(' ') : ''
  ];
  return normalizeText(rawParts.join(' '));
}

/**
 * Evaluates whether an opportunity item matches a search term across its full text.
 * Performs normalized (accent-free, lower-case) matching.
 */
export function matchesDeepSearch(
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
  searchTerm: string
): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;
  const normalizedQuery = normalizeText(searchTerm.trim());
  const fullText = getItemSearchableText(item);
  return fullText.includes(normalizedQuery);
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

