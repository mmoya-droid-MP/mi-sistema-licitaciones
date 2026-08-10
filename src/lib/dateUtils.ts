/**
 * Date, ID and Time calculation utilities for Mercado Público
 * Unified for Licitaciones, Convenio Marco, and Compra Ágil (COT)
 * Timezone enforced: America/Santiago (Chile CLT / UTC-4 or CLST / UTC-3)
 */

/**
 * Cleans and normalizes official Mercado Público IDs, stripping trailing spaces,
 * extra text, or prefixes to return exact official portal code (e.g. 587-32-LE26, CM-5802363-9800AAID, 2007-99-COT26).
 */
export function cleanOfficialId(rawId: any): string {
  if (!rawId) return 'S/I';
  let str = String(rawId).trim();
  if (!str) return 'S/I';

  // Strip common label prefixes
  str = str.replace(/^(ID|Código|Codigo|N°|Nº)\s*:?\s*/i, '');

  // Extract clean MP code regex pattern: e.g., 587-32-LE26, CM-5802363-9800AAID, 2007-99-COT26
  const mpMatch = str.match(/((?:CM-)?\d+-\d+-[A-Za-z0-9]+|CM-\d+(?:-[A-Za-z0-9]+)?)/i);
  if (mpMatch) {
    return mpMatch[1].toUpperCase();
  }

  return str.replace(/[()\[\]]/g, '').trim().toUpperCase();
}

/**
 * Extracts EXCLUSIVELY the Fecha Cierre / Fecha Finalización / Límite para Cotizar field
 * for all 3 purchase types (Licitaciones, Convenio Marco, Compra Ágil / COT).
 * Strictly avoids secondary dates like Apertura Técnica, Apertura Económica, Aclaraciones or Fecha Publicación.
 */
export function extractFechaCierre(rawItem: any): string {
  if (!rawItem) return '';

  const rawId = String(rawItem.codigo || rawItem.codigoLicitacion || rawItem.id || '').toUpperCase();
  const tipoUpper = String(rawItem.tipo || '').toUpperCase();
  const isCot = rawId.includes('-COT') || rawId.includes('COT') || tipoUpper.includes('AGIL') || tipoUpper.includes('ÁGIL') || tipoUpper.includes('COT');
  const isCM = rawId.startsWith('CM-') || tipoUpper.includes('CONVENIO') || tipoUpper.includes('MARCO');

  // 1. Explicit Compra Ágil / COT extraction
  if (isCot) {
    if (rawItem.FechaCierreRecepcionOfertas) return String(rawItem.FechaCierreRecepcionOfertas);
    if (rawItem['Fecha de cierre de recepción de ofertas']) return String(rawItem['Fecha de cierre de recepción de ofertas']);
    if (rawItem.LimiteParaCotizar) return String(rawItem.LimiteParaCotizar);
    if (rawItem['Límite para cotizar']) return String(rawItem['Límite para cotizar']);
    if (rawItem.FechaLimiteCotizar) return String(rawItem.FechaLimiteCotizar);
    if (rawItem.FechaCierreRecepcion) return String(rawItem.FechaCierreRecepcion);
    if (rawItem['Fecha Cierre Recepción Ofertas']) return String(rawItem['Fecha Cierre Recepción Ofertas']);
    if (rawItem.fecha_cierre_cotizacion) return String(rawItem.fecha_cierre_cotizacion);
    if (rawItem.fecha_limite) return String(rawItem.fecha_limite);
  }

  // 2. Convenio Marco (CM) & Solicitudes de Cotización
  if (isCM || rawItem.Cotizacion) {
    if (rawItem.FechaCierreCotizacion) return String(rawItem.FechaCierreCotizacion);
    if (rawItem['Plazo límite para la recepción de cotizaciones/ofertas']) return String(rawItem['Plazo límite para la recepción de cotizaciones/ofertas']);
    if (rawItem['Plazo limite para la recepcion de cotizaciones/ofertas']) return String(rawItem['Plazo limite para la recepcion de cotizaciones/ofertas']);
    if (rawItem.Cotizacion) {
      if (rawItem.Cotizacion.FechaCierreCotizacion) return String(rawItem.Cotizacion.FechaCierreCotizacion);
      if (rawItem.Cotizacion.FechaCierre) return String(rawItem.Cotizacion.FechaCierre);
      if (rawItem.Cotizacion.FechaFinalizacion) return String(rawItem.Cotizacion.FechaFinalizacion);
      if (rawItem.Cotizacion.FechaTermino) return String(rawItem.Cotizacion.FechaTermino);
      if (rawItem.Cotizacion.FechaCierreRecepcionOfertas) return String(rawItem.Cotizacion.FechaCierreRecepcionOfertas);
    }
    if (rawItem.fechaCierreCotizacion) return String(rawItem.fechaCierreCotizacion);
  }

  // 3. Licitaciones - Strict Priority for FechaCierreRecepcionOfertas / Fecha de Cierre / Cierre de Ofertas
  if (rawItem.FechaCierreRecepcionOfertas) return String(rawItem.FechaCierreRecepcionOfertas);
  if (rawItem['FechaCierreRecepcionOfertas']) return String(rawItem['FechaCierreRecepcionOfertas']);
  if (rawItem['Fecha de Cierre']) return String(rawItem['Fecha de Cierre']);
  if (rawItem['Fecha Cierre']) return String(rawItem['Fecha Cierre']);
  if (rawItem['Cierre de Ofertas']) return String(rawItem['Cierre de Ofertas']);
  if (rawItem.FechaCierre) return String(rawItem.FechaCierre);
  if (rawItem.FechaFinalizacion) return String(rawItem.FechaFinalizacion);
  if (rawItem.FechaTermino) return String(rawItem.FechaTermino);
  if (rawItem.fechaCierre) return String(rawItem.fechaCierre);
  if (rawItem.fechaCierreOriginal) return String(rawItem.fechaCierreOriginal);
  if (rawItem.fechaCierreChile) return String(rawItem.fechaCierreChile);

  return '';
}

/**
 * Normalizes any valid date input to a Date object in Chile time (America/Santiago).
 * Explicitly parses dates in CLT/CLST regardless of input origin (API or scraped HTML).
 */
export function parseChileDate(dateInput: string | Date): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const rawStr = String(dateInput).trim();
  if (!rawStr) return new Date();

  // Try parsing Spanish/Chilean date format DD/MM/YYYY or DD-MM-YYYY [HH:mm[:ss]]
  const ddmmyyyyRegex = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const match = rawStr.match(ddmmyyyyRegex);

  let year: number, month: number, day: number, hour = 23, minute = 59, second = 59;

  if (match) {
    day = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1; // 0-indexed month
    year = parseInt(match[3], 10);
    if (match[4] !== undefined) hour = parseInt(match[4], 10);
    if (match[5] !== undefined) minute = parseInt(match[5], 10);
    if (match[6] !== undefined) second = parseInt(match[6], 10);
  } else {
    // Standard ISO string or YYYY-MM-DD
    let cleanStr = rawStr.replace(' ', 'T');
    if (!cleanStr.includes('T') && cleanStr.length === 10) {
      cleanStr += 'T23:59:59';
    }
    const temp = new Date(cleanStr);
    if (isNaN(temp.getTime())) {
      return new Date();
    }
    year = temp.getFullYear();
    month = temp.getMonth();
    day = temp.getDate();
    hour = temp.getHours();
    minute = temp.getMinutes();
    second = temp.getSeconds();
  }

  // Construct target timestamp normalized to America/Santiago timezone
  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    // Compute exact timestamp in America/Santiago
    const utcEquivalent = new Date(Date.UTC(year, month, day, hour, minute, second));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(utcEquivalent);
    let pY = 0, pM = 0, pD = 0, pH = 0, pMin = 0, pS = 0;
    for (const p of parts) {
      if (p.type === 'year') pY = parseInt(p.value, 10);
      if (p.type === 'month') pM = parseInt(p.value, 10) - 1;
      if (p.type === 'day') pD = parseInt(p.value, 10);
      if (p.type === 'hour') pH = parseInt(p.value === '24' ? '0' : p.value, 10);
      if (p.type === 'minute') pMin = parseInt(p.value, 10);
      if (p.type === 'second') pS = parseInt(p.value, 10);
    }
    const formattedAsUtc = new Date(Date.UTC(pY, pM, pD, pH, pMin, pS));
    const offsetMs = utcEquivalent.getTime() - formattedAsUtc.getTime();
    return new Date(utcEquivalent.getTime() + offsetMs);
  } catch (e) {
    return new Date(year, month, day, hour, minute, second);
  }
}

/**
 * Formats a date into Chile Standard Format: YYYY-MM-DD HH:mm hrs
 * Uses 'America/Santiago' timezone.
 */
export function formatChileDateTime(dateInput: string | Date): string {
  if (!dateInput) return 'Fecha no especificada';
  try {
    const d = parseChileDate(dateInput);
    
    // Format using Intl.DateTimeFormat in America/Santiago timezone
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    let year = '', month = '', day = '', hour = '', minute = '';

    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
    }

    if (hour === '24') hour = '00';

    return `${year}-${month}-${day} ${hour}:${minute} hrs`;
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Calculates dynamic remaining time (days and hours) normalized in Chile Timezone (America/Santiago).
 * Compares closure date explicitly against current Chile time.
 */
export function calculateChileRemainingTime(fechaCierreInput: string | Date) {
  const targetDate = parseChileDate(fechaCierreInput);
  const now = new Date();

  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      dias: 0,
      horas: 0,
      totalHoras: 0,
      expirada: true,
      label: 'Cerrada',
      badgeText: 'Proceso Cerrado (00:00 hrs)',
      formattedDate: formatChileDateTime(fechaCierreInput)
    };
  }

  const totalHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const dias = Math.floor(totalHoras / 24);
  const horas = totalHoras % 24;

  let label = '';
  if (dias > 0) {
    label = `${dias}d ${horas}h restantes`;
  } else if (horas > 0) {
    label = `${horas}h restantes`;
  } else {
    const minutos = Math.floor((diffMs / (1000 * 60)) % 60);
    label = `${minutos} min restantes`;
  }

  const badgeText = dias > 0 
    ? `${dias} días y ${horas} hrs restantes` 
    : `${horas} hrs restantes`;

  return {
    dias,
    horas,
    totalHoras,
    expirada: false,
    label,
    badgeText,
    formattedDate: formatChileDateTime(fechaCierreInput)
  };
}

/**
 * Checks if a licitación or opportunity is expired dynamically based on current Chile date.
 */
export function isItemExpired(item: { fechaCierre?: string; diasRestantes?: number; estado?: string }): boolean {
  if (!item) return false;
  if (item.estado === 'Cerrada' || item.estado === 'Vencida') return true;
  if (typeof item.diasRestantes === 'number' && item.diasRestantes < 0) return true;
  const fc = extractFechaCierre(item) || item.fechaCierre;
  if (fc) {
    const timeInfo = calculateChileRemainingTime(fc);
    if (timeInfo.expirada) return true;
  }
  return false;
}

/**
 * Constructs the official URL for a Mercado Público opportunity according to purchase type:
 * - Compra Ágil (IDs with -COT / COT / 'Compra Ágil'): Points directly to https://www.mercadopublico.cl/CompraAgil/busqueda?codigo={cleanId}
 * - Licitaciones / Convenio Marco: Points to https://www.mercadopublico.cl/BuscarLicitacion?codigo={cleanId}
 * Preserves exact official ID (e.g. 2007-99-COT26).
 */
export function getItemOfficialUrl(item: { codigo?: string; codigoLicitacion?: string; id?: string; tipo?: string; url?: string }): string {
  if (!item) return 'https://www.mercadopublico.cl';

  const rawId = (item.codigo || item.codigoLicitacion || item.id || '').trim();
  if (!rawId) return 'https://www.mercadopublico.cl';

  const officialCode = cleanOfficialId(rawId);
  if (officialCode === 'S/I') return 'https://www.mercadopublico.cl';

  const cleanId = officialCode.replace(/^CM-/, '');
  const tipoUpper = (item.tipo || '').toUpperCase();
  const isCot = officialCode.includes('-COT') || officialCode.includes('COT') || tipoUpper.includes('AGIL') || tipoUpper.includes('ÁGIL') || tipoUpper.includes('COT');

  // Compra Ágil direct URL
  if (isCot) {
    return `https://www.mercadopublico.cl/CompraAgil/busqueda?codigo=${encodeURIComponent(cleanId)}`;
  }

  // If item has a custom direct Convenio Marco URL, preserve it
  if (item.url && item.url.startsWith('http') && !item.url.includes('BuscarLicitacion') && !item.url.includes('DetailsAcquisition')) {
    return item.url;
  }

  // Standard Licitación / Convenio Marco URL
  return `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${encodeURIComponent(cleanId)}`;
}

