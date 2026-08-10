/**
 * Date and Time calculation utilities for Mercado Público
 * Timezone enforced: America/Santiago (CLT / UTC-4 or UTC-3)
 */

/**
 * Extracts EXCLUSIVELY the Fecha Cierre / Fecha Finalización field from Mercado Público or Cotización CM JSON.
 * Explicitly ignores secondary fields like FechaCreacion, FechaPublicacion, FechaInicioConsultas or FechaApertura.
 */
export function extractFechaCierre(rawItem: any): string {
  if (!rawItem) return '';

  // 1. Check if Cotizacion CM object
  if (rawItem.Cotizacion) {
    if (rawItem.Cotizacion.FechaCierre) return String(rawItem.Cotizacion.FechaCierre);
    if (rawItem.Cotizacion.FechaFinalizacion) return String(rawItem.Cotizacion.FechaFinalizacion);
    if (rawItem.Cotizacion.FechaTermino) return String(rawItem.Cotizacion.FechaTermino);
  }

  // 2. Direct Licitación fields
  if (rawItem.FechaCierre) return String(rawItem.FechaCierre);
  if (rawItem.FechaFinalizacion) return String(rawItem.FechaFinalizacion);
  if (rawItem.FechaTermino) return String(rawItem.FechaTermino);
  if (rawItem.fechaCierre) return String(rawItem.fechaCierre);

  return '';
}

/**
 * Normalizes any valid date input to a Date object in Chile time (America/Santiago).
 */
export function parseChileDate(dateInput: string | Date): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  // Handle strings like "2026-08-20T16:00:00", "2026-08-20 16:00:00", "2026-08-20 16:00"
  let cleanStr = String(dateInput).trim().replace(' ', 'T');
  if (!cleanStr.includes('T') && cleanStr.length === 10) {
    cleanStr += 'T23:59:59';
  }

  const parsed = new Date(cleanStr);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
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
 * Calculates dynamic remaining time (days and hours) in Chile Time zone (America/Santiago)
 * considering exact closing hour (e.g. 31/08/2026 15:00 hrs).
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
 * Checks if a licitación or opportunity is expired dynamically based on current date.
 * Returns true if closing date has passed, remaining days < 0, or status is Cerrada/Vencida.
 */
export function isItemExpired(item: { fechaCierre?: string; diasRestantes?: number; estado?: string }): boolean {
  if (!item) return false;
  if (item.estado === 'Cerrada' || item.estado === 'Vencida') return true;
  if (typeof item.diasRestantes === 'number' && item.diasRestantes < 0) return true;
  if (item.fechaCierre) {
    const timeInfo = calculateChileRemainingTime(item.fechaCierre);
    if (timeInfo.expirada) return true;
  }
  return false;
}

/**
 * Constructs the exact official URL for a Mercado Público opportunity.
 * Strips 'CM-' prefix from Convenio Marco IDs before building the BuscarLicitacion URL,
 * ensuring full alphanumeric suffixes (e.g. 5802363-9800AAID, 2496NNLU) are preserved.
 */
export function getItemOfficialUrl(item: { codigo: string; tipo?: string; url?: string }): string {
  if (!item || !item.codigo) return 'https://www.mercadopublico.cl';
  const rawId = item.codigo.trim();
  const cleanId = rawId.replace(/^CM-/, '');
  return `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${encodeURIComponent(cleanId)}`;
}
