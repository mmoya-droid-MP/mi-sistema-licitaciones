import { LicitacionItem } from '../types';
import { extractFechaCierre, parseChileDate } from '../lib/dateUtils';

/**
 * 24 horas en milisegundos
 */
const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

/**
 * Determina si una oportunidad individual está vigente o venció hace MENOS de 24 horas.
 * Descarta únicamente las que superen las 24 horas de vencidas.
 */
export function isOportunidadVigenteO24h(item: LicitacionItem): boolean {
  if (!item) return false;

  // Si está desestimada explícitamente, se descarta
  if (item.estado === 'Desestimada') return false;

  const fechaStr = item.fecha_cierre || item.fechaCierre || extractFechaCierre(item);
  if (!fechaStr) {
    // Si no contiene fecha de cierre explícita, se conserva por defecto
    return true;
  }

  try {
    const fechaCierre = parseChileDate(fechaStr);
    const fechaCierreTime = fechaCierre.getTime();

    // Si la fecha es inválida, se conserva
    if (isNaN(fechaCierreTime)) return true;

    const ahora = Date.now();

    // Si la fecha de cierre es futura (aún vigente), se conserva
    if (fechaCierreTime >= ahora) {
      return true;
    }

    // Si ya venció, verificar si venció hace MENOS de 24 horas
    const tiempoVencidoMs = ahora - fechaCierreTime;
    return tiempoVencidoMs < VEINTICUATRO_HORAS_MS;
  } catch {
    return true;
  }
}

/**
 * Filtra un array de oportunidades/licitaciones conservando:
 * 1. Oportunidades activas / vigentes.
 * 2. Oportunidades que vencieron hace MENOS de 24 horas (margen de gracia).
 * Elimina aquellas que vencieron hace más de 24 horas.
 */
export function filterOportunidades(oportunidades: LicitacionItem[]): LicitacionItem[] {
  if (!Array.isArray(oportunidades)) return [];
  return oportunidades.filter(isOportunidadVigenteO24h);
}

// Alias de exportación para compatibilidad
export const filterOportunidadesVigentes = filterOportunidades;
export default filterOportunidades;
