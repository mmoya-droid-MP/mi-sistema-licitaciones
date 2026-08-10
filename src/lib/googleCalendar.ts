import { LicitacionItem, Postulacion } from '../types';
import { getItemOfficialUrl } from './dateUtils';
import { cleanTextPrefixes } from './searchUtils';

export function createGoogleCalendarUrl(
  titulo: string,
  fechaCierre: string,
  cliente: string,
  codigo: string,
  url: string,
  detallesExtra: string = ''
): string {
  // Parse closing date
  let dtClose: Date;
  try {
    dtClose = new Date(fechaCierre);
    if (isNaN(dtClose.getTime())) {
      dtClose = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // fallback +2 days
    }
  } catch {
    dtClose = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  }

  // Event duration: 1 hour before closing
  const dtStart = new Date(dtClose.getTime() - 60 * 60 * 1000);

  const formatGCalDate = (d: Date) => {
    // Format to standard ISO for GCal: YYYYMMDDTHHmmssZ
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const cleanTitulo = cleanTextPrefixes(titulo);
  const eventTitle = `🚨 CIERRE LICITACIÓN: ${codigo} - ${cleanTitulo}`;
  const fechaStart = formatGCalDate(dtStart);
  const fechaEnd = formatGCalDate(dtClose);
  const detalles = `Organismo Comprador: ${cliente}\nCódigo Mercado Público: ${codigo}\nFicha Directa: ${url}\n${detallesExtra ? '\nNotas de Postulación:\n' + detallesExtra : ''}\nSincronizado desde Mercado Público Bot.`;
  const urlFicha = url || `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${encodeURIComponent(codigo)}`;

  const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${fechaStart}/${fechaEnd}&details=${encodeURIComponent(detalles)}&location=${encodeURIComponent(urlFicha)}`;
  return googleCalUrl;
}

export function openGoogleCalendar(item: LicitacionItem | Postulacion) {
  let url = '';
  if ('licitacionNombre' in item) {
    // Postulacion
    const officialUrl = getItemOfficialUrl({ codigo: item.codigoLicitacion, tipo: item.tipo, url: item.url });
    url = createGoogleCalendarUrl(
      item.licitacionNombre,
      item.fechaCierreOriginal,
      item.cliente,
      item.codigoLicitacion,
      officialUrl,
      item.notas
    );
  } else {
    // LicitacionItem
    const officialUrl = getItemOfficialUrl(item);
    url = createGoogleCalendarUrl(
      item.nombre,
      item.fechaCierre,
      item.cliente,
      item.codigo,
      officialUrl,
      item.descripcion
    );
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function downloadICSFile(item: LicitacionItem | Postulacion) {
  const codigo = 'codigo' in item ? item.codigo : item.codigoLicitacion;
  const titulo = 'nombre' in item ? item.nombre : item.licitacionNombre;
  const cliente = item.cliente;
  const fechaCierre = 'fechaCierre' in item ? item.fechaCierre : item.fechaCierreOriginal;
  const url = 'codigo' in item ? getItemOfficialUrl(item) : getItemOfficialUrl({ codigo: item.codigoLicitacion, tipo: item.tipo, url: item.url });

  const downloadUrl = `/api/calendar/ics?codigo=${encodeURIComponent(codigo)}&titulo=${encodeURIComponent(titulo)}&cliente=${encodeURIComponent(cliente)}&fechaCierre=${encodeURIComponent(fechaCierre)}&url=${encodeURIComponent(url)}`;
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `MercadoPublico_${codigo}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
