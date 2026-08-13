import { LicitacionItem } from '../types';
import { extractFechaCierre, parseChileDate } from '../lib/dateUtils';

/**
 * 24 horas en milisegundos (86.400.000 ms)
 */
const LIMITE_24_HORAS_MS = 24 * 60 * 60 * 1000;

/**
 * Filtra oportunidades conservando las vigentes y las que vencieron hace MENOS de 24 horas.
 * Elimina automáticamente las que cerraron hace más de 24 horas.
 */
export const filtrarPorFechaCierre = <T extends Partial<LicitacionItem> | Record<string, any>>(
  listaOportunidades: T[]
): T[] => {
  if (!Array.isArray(listaOportunidades)) return [];
  const ahora = new Date().getTime();

  return listaOportunidades.filter((item) => {
    if (!item) return false;

    // Obtener campo de fecha de cierre (soporta fecha_cierre, fechaCierre y extracción profunda)
    const fechaRaw = item.fecha_cierre || item.fechaCierre || (typeof item === 'object' ? extractFechaCierre(item as any) : '');
    if (!fechaRaw || typeof fechaRaw !== 'string') return false;

    // Normalizar la fecha de cierre para que JavaScript la entienda (YYYY-MM-DD HH:mm o DD-MM-YYYY)
    const fechaLimpia = fechaRaw.replace(' hrs', '').trim();
    
    // Convertir a milisegundos con soporte para formato ISO, Date directo o parseChileDate
    let fechaCierreMs = new Date(fechaLimpia).getTime();
    if (isNaN(fechaCierreMs)) {
      try {
        const parsed = parseChileDate(fechaLimpia);
        fechaCierreMs = parsed.getTime();
      } catch {
        fechaCierreMs = NaN;
      }
    }

    // Si la fecha es inválida, se omite
    if (isNaN(fechaCierreMs)) return false;

    // Calculamos la diferencia de tiempo desde el cierre
    const tiempoTranscurridoDesdeCierre = ahora - fechaCierreMs;

    // REGLA:
    // 1. (fechaCierreMs >= ahora) -> Aún no cierra (Está vigente).
    // 2. (tiempoTranscurridoDesdeCierre <= LIMITE_24_HORAS_MS) -> Ya cerró, pero pasaron MENOS de 24 horas.
    // Si pasaron MÁS de 24 horas desde que cerró, retorna false y se elimina del listado.
    return fechaCierreMs >= ahora || tiempoTranscurridoDesdeCierre <= LIMITE_24_HORAS_MS;
  });
};

/**
 * Determina si una oportunidad individual está vigente o venció hace MENOS de 24 horas.
 */
export function isOportunidadVigenteO24h(item: LicitacionItem): boolean {
  if (!item) return false;
  if (item.estado === 'Desestimada') return false;

  const resultado = filtrarPorFechaCierre([item]);
  return resultado.length > 0;
}

/**
 * Alias estándar para el proyecto
 */
export const filterOportunidades = (oportunidades: LicitacionItem[]): LicitacionItem[] => {
  return filtrarPorFechaCierre(oportunidades);
};

export const filterOportunidadesVigentes = filterOportunidades;
export default filtrarPorFechaCierre;
