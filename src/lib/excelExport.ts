import * as XLSX from 'xlsx';
import { formatChileDateTime, calculateChileRemainingTime, getItemOfficialUrl } from './dateUtils';
import {
  cleanTextPrefixes,
  getItemCodigo,
  getItemNombre,
  getItemOrganismo,
  getItemDescripcion,
  getItemTipo,
  getItemFechaCierre,
  getItemMonto,
  getItemTags,
  getItemEstado,
  getItemUrl
} from './searchUtils';

export function exportLicitacionesToExcel(
  licitaciones: any[],
  filenamePrefix = 'Reporte_MercadoPublico'
) {
  const dateStr = new Date().toISOString().split('T')[0];

  const data = licitaciones.map((item) => {
    const rawTipo = getItemTipo(item);
    const codigo = getItemCodigo(item);
    const organismo = getItemOrganismo(item);
    const rawNombre = getItemNombre(item);
    const rawDesc = getItemDescripcion(item);
    const fechaCierre = getItemFechaCierre(item);
    const monto = getItemMonto(item);
    const tags = getItemTags(item);
    const estado = getItemEstado(item);
    const url = getItemUrl(item);

    const timeInfo = calculateChileRemainingTime(fechaCierre);
    let tipoDesc: string = rawTipo;
    if (rawTipo === 'Compra Agil') tipoDesc = 'Compra Ágil (COT)';
    if (rawTipo === 'Convenio Marco') tipoDesc = 'Convenio Marco (CM)';
    if (rawTipo === 'Licitacion') tipoDesc = 'Licitación Pública (LE/LP)';

    return {
      'Tipo de Proceso': tipoDesc,
      'Código ID': codigo,
      'Organismo Comprador': organismo,
      'Nombre del Requerimiento': cleanTextPrefixes(rawNombre),
      'Descripción Completa': cleanTextPrefixes(rawDesc),
      'Fecha Cierre (Chile CLT)': formatChileDateTime(fechaCierre),
      'Tiempo Restante (Chile CLT)': timeInfo.badgeText,
      'Monto Estimado CLP': monto > 0
        ? `$${monto.toLocaleString('es-CL')}`
        : 'No Informado',
      'Etiquetas / Palabras Clave': tags ? tags.join(', ') : '',
      'Estado Proceso': estado || 'Publicada',
      'Ficha Mercado Público': url || getItemOfficialUrl({ codigo, tipo: rawTipo })
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Column widths adjustment for clean rendering in Microsoft Excel
  worksheet['!cols'] = [
    { wch: 26 }, // Tipo de Proceso
    { wch: 22 }, // Código ID
    { wch: 38 }, // Organismo Comprador
    { wch: 55 }, // Nombre
    { wch: 65 }, // Descripción Completa
    { wch: 24 }, // Fecha Cierre
    { wch: 28 }, // Tiempo Restante
    { wch: 20 }, // Monto
    { wch: 35 }, // Tags
    { wch: 15 }, // Estado
    { wch: 70 }  // URL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Oportunidades Mercado Público');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
