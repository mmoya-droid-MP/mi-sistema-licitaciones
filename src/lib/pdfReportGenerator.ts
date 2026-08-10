import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LicitacionItem, Postulacion } from '../types';
import {
  cleanTextPrefixes,
  getItemCodigo,
  getItemNombre,
  getItemOrganismo,
  getItemDescripcion,
  getItemTipo,
  getItemFechaCierre,
  getItemDiasRestantes,
  getItemTags,
  getItemUrl
} from './searchUtils';

export function classifyItemByAxis(item: any): '1.1' | '1.2' | '1.3' | '1.4' {
  const codigo = getItemCodigo(item);
  const nombre = getItemNombre(item);
  const descripcion = getItemDescripcion(item);
  const tags = getItemTags(item);

  const text = (
    codigo +
    ' ' +
    nombre +
    ' ' +
    descripcion +
    ' ' +
    tags.join(' ')
  ).toLowerCase();

  if (text.match(/google|maps|geolocalizaci|gis|visor territorial|visor geografico|comisaria virtual/)) {
    return '1.1';
  }
  if (text.match(/gestor documental|gestion documental|bpm|firma digital|digitalizacion/)) {
    return '1.4';
  }
  if (text.match(/bi|power bi|qlik|etl|gobernanza|migracion|datos|dashboard|gcp|aws|azure|cloud|nube|saas|secops|workspace/)) {
    return '1.2';
  }
  return '1.3';
}

export function generateMonthlyPDFReport(
  items: any[],
  postulaciones: Postulacion[],
  mesNombre: string = 'Agosto 2026'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Corporate Colors
  const blueCorporate = [31, 73, 125]; // #1F497D
  const darkGray = [50, 50, 50];
  const accentUrgent = [192, 0, 0];

  // Header Banner
  doc.setFillColor(blueCorporate[0], blueCorporate[1], blueCorporate[2]);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORME EJECUTIVO DE OPORTUNIDADES - Mercado Público Chile', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${mesNombre} | Generado: ${new Date().toLocaleDateString('es-CL')}`, 196, 15, { align: 'right' });

  let currentY = 32;

  // 1. RESUMEN DE PROSPECCIÓN Y BÚSQUEDA TÉCNICA
  doc.setTextColor(blueCorporate[0], blueCorporate[1], blueCorporate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RESUMEN DE PROSPECCIÓN Y BÚSQUEDA TÉCNICA', 14, currentY);
  currentY += 6;

  // Box container
  doc.setFillColor(248, 250, 252);
  doc.rect(14, currentY, 182, 32, 'F');
  doc.setDrawColor(210, 220, 230);
  doc.rect(14, currentY, 182, 32, 'S');

  const axis1Count = items.filter((i) => classifyItemByAxis(i) === '1.1').length;
  const axis2Count = items.filter((i) => classifyItemByAxis(i) === '1.2').length;
  const axis3Count = items.filter((i) => classifyItemByAxis(i) === '1.3').length;
  const axis4Count = items.filter((i) => classifyItemByAxis(i) === '1.4').length;
  const urgentesCount = items.filter((i) => {
    const d = getItemDiasRestantes(i);
    return d <= 3 && d >= 0;
  }).length;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

  doc.text(`• Total Oportunidades Analizadas (30 Días): ${items.length} registros`, 18, currentY + 7);
  doc.text(`• Ejes Prioritarios: Maps & GIS (${axis1Count}), Datos/Cloud/BI (${axis2Count}), Dev Software (${axis3Count}), Gestor Doc. (${axis4Count})`, 18, currentY + 14);
  doc.text(`• Hallazgos Clave: Se identifican ${urgentesCount} oportunidades urgentes con cierre ≤3 días y ${postulaciones.length} postulaciones activas.`, 18, currentY + 21);
  doc.text(`• Filtro de Coincidencia: Aplicado al 100% con el Diccionario Maestro de Términos Mercado Público Chile.`, 18, currentY + 27);

  currentY += 38;

  const renderAxisTable = (
    axisKey: '1.1' | '1.2' | '1.3' | '1.4',
    title: string
  ) => {
    const axisItems = items.filter((i) => classifyItemByAxis(i) === axisKey);
    if (axisItems.length === 0) return;

    // Check page space
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(blueCorporate[0], blueCorporate[1], blueCorporate[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, 14, currentY);
    currentY += 4;

    const tableRows = axisItems.map((op) => {
      const codigo = getItemCodigo(op);
      const organismo = getItemOrganismo(op);
      const rawNombre = getItemNombre(op);
      const rawDesc = getItemDescripcion(op);
      const rawTipo = getItemTipo(op);
      const diasRestantes = getItemDiasRestantes(op);
      const rawFecha = getItemFechaCierre(op);

      const cleanNombre = cleanTextPrefixes(rawNombre);
      const cleanDesc = cleanTextPrefixes(rawDesc);
      const diasStr = diasRestantes <= 3 ? `⚠️ ${diasRestantes}d` : `${diasRestantes}d`;
      const tipoStr = rawTipo === 'Compra Agil' ? 'Compra Ágil' : rawTipo === 'Convenio Marco' ? 'Conv. Marco' : 'Licitación';

      let dateFormatted = rawFecha;
      try {
        dateFormatted = new Date(rawFecha).toLocaleDateString('es-CL');
      } catch {
        // Fallback
      }

      return [
        codigo,
        organismo,
        `${cleanNombre}\n${cleanDesc.substring(0, 90)}${cleanDesc.length > 90 ? '...' : ''}`,
        tipoStr,
        dateFormatted,
        diasStr
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Código ID', 'Organismo Comprador', 'Requerimiento & Descripción', 'Tipo', 'F. Cierre', 'Plazo']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: blueCorporate as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: darkGray as [number, number, number],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 38 },
        2: { cellWidth: 68 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 18, fontStyle: 'bold' }
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 5) {
          const text = String(data.cell.raw);
          if (text.includes('⚠️')) {
            data.cell.styles.textColor = accentUrgent as [number, number, number];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  };

  // Render 4 Sections by Axis
  renderAxisTable('1.1', '1.1 Google Maps & API de Google');
  renderAxisTable('1.2', '1.2 Migración de Datos, Arquitectura Tecnológica y BI');
  renderAxisTable('1.3', '1.3 Desarrollo de Software, Mantención y Evolución de Sistemas');
  renderAxisTable('1.4', '1.4 Gestor Documental, Digitalización y Procesamiento de Datos');

  // CONCLUSIONES Y RECOMENDACIONES ESTRATÉGICAS
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setTextColor(blueCorporate[0], blueCorporate[1], blueCorporate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CONCLUSIONES Y RECOMENDACIONES ESTRATÉGICAS', 14, currentY);
  currentY += 6;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, 182, 28, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, currentY, 182, 28, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

  doc.text('1. Priorizar postulación inmediata a requerimientos de Compra Ágil con plazo <= 3 días para asegurar rápida adjudicación.', 18, currentY + 7);
  doc.text('2. Preparar acreditaciones técnicas de licenciamiento Google Maps Platform y certificaciones en arquitecturas Cloud (GCP/AWS).', 18, currentY + 14);
  doc.text('3. Mantener monitoreo automatizado con alertas activas y sincronización a Google Calendar para prevenir vencimientos.', 18, currentY + 21);

  // Footer page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Mercado Público Bot - Centro de Monitoreo & Oportunidades Chile | Página ${i} de ${pageCount}`,
      14,
      287
    );
  }

  doc.save(`Informe_Ejecutivo_MercadoPublico_${mesNombre.replace(/\s+/g, '_')}.pdf`);
}
