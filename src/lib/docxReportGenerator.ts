import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  HeadingLevel,
  AlignmentType,
  ShadingType
} from 'docx';
import { Postulacion } from '../types';
import { formatChileDateTime, calculateChileRemainingTime } from './dateUtils';
import {
  cleanTextPrefixes,
  getItemCodigo,
  getItemNombre,
  getItemOrganismo,
  getItemDescripcion,
  getItemTipo,
  getItemFechaCierre,
  getItemDiasRestantes,
  getItemMonto
} from './searchUtils';
import { classifyItemByAxis } from './pdfReportGenerator';

export async function generateWordReport(
  items: any[],
  postulaciones: Postulacion[],
  mesNombre: string = 'Agosto 2026'
) {
  const totalMonto = items.reduce((acc, curr) => acc + getItemMonto(curr), 0);
  const urgentes = items.filter((i) => {
    const d = getItemDiasRestantes(i);
    return d <= 3 && d >= 0;
  }).length;

  const axis1Items = items.filter((i) => classifyItemByAxis(i) === '1.1');
  const axis2Items = items.filter((i) => classifyItemByAxis(i) === '1.2');
  const axis3Items = items.filter((i) => classifyItemByAxis(i) === '1.3');
  const axis4Items = items.filter((i) => classifyItemByAxis(i) === '1.4');

  // Helper to build a table for an axis
  const buildAxisTable = (axisItems: any[]) => {
    const tableHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Código ID', bold: true, color: 'FFFFFF', size: 18 })] })],
          shading: { fill: '1F497D', type: ShadingType.CLEAR },
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Organismo Comprador', bold: true, color: 'FFFFFF', size: 18 })] })],
          shading: { fill: '1F497D', type: ShadingType.CLEAR },
          width: { size: 22, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Requerimiento & Descripción', bold: true, color: 'FFFFFF', size: 18 })] })],
          shading: { fill: '1F497D', type: ShadingType.CLEAR },
          width: { size: 35, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Tipo', bold: true, color: 'FFFFFF', size: 18 })] })],
          shading: { fill: '1F497D', type: ShadingType.CLEAR },
          width: { size: 12, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'F. Cierre', bold: true, color: 'FFFFFF', size: 18 })] })],
          shading: { fill: '1F497D', type: ShadingType.CLEAR },
          width: { size: 16, type: WidthType.PERCENTAGE }
        })
      ]
    });

    const dataRows = axisItems.map((item, idx) => {
      const codigo = getItemCodigo(item);
      const organismo = getItemOrganismo(item);
      const rawNombre = getItemNombre(item);
      const rawDesc = getItemDescripcion(item);
      const rawTipo = getItemTipo(item);
      const fechaCierre = getItemFechaCierre(item);

      const timeInfo = calculateChileRemainingTime(fechaCierre);
      const bgColor = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
      let tipoLabel: string = rawTipo;
      if (rawTipo === 'Compra Agil') tipoLabel = 'Compra Ágil';
      if (rawTipo === 'Convenio Marco') tipoLabel = 'Conv. Marco';

      const cleanNombre = cleanTextPrefixes(rawNombre);
      const cleanDesc = cleanTextPrefixes(rawDesc);

      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: codigo, bold: true, size: 16 })] })],
            shading: { fill: bgColor, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: organismo, size: 16 })] })],
            shading: { fill: bgColor, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: cleanNombre, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: cleanDesc.substring(0, 120) + '...', size: 14, color: '475569' })] })
            ],
            shading: { fill: bgColor, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: tipoLabel, size: 16 })] })],
            shading: { fill: bgColor, type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: formatChileDateTime(fechaCierre), size: 15 })] }),
              new Paragraph({ children: [new TextRun({ text: timeInfo.badgeText, bold: true, color: timeInfo.dias <= 3 ? 'C00000' : '008000', size: 15 })] })
            ],
            shading: { fill: bgColor, type: ShadingType.CLEAR }
          })
        ]
      });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [tableHeaderRow, ...dataRows]
    });
  };

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header / Title
          new Paragraph({
            text: 'INFORME EJECUTIVO DE OPORTUNIDADES - Mercado Público Chile',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `Consolidado de Oportunidades Licitatorias • Período ${mesNombre} (30 Días)`,
                bold: true,
                color: '1F497D',
                size: 22
              })
            ]
          }),

          // RESUMEN DE PROSPECCIÓN Y BÚSQUEDA TÉCNICA
          new Paragraph({
            text: 'RESUMEN DE PROSPECCIÓN Y BÚSQUEDA TÉCNICA',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 }
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: '• Total Oportunidades Analizadas (30 Días): ', bold: true, size: 20 }),
              new TextRun({ text: `${items.length} procesos activos `, size: 20, color: '1F497D', bold: true }),
              new TextRun({ text: `con un monto global estimado de $${totalMonto.toLocaleString('es-CL')} CLP.`, size: 20 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: '• Ejes Prioritarios Identificados: ', bold: true, size: 20 }),
              new TextRun({ text: `Google Maps & API (${axis1Items.length}), Migración/Datos/BI (${axis2Items.length}), Desarrollo/Evolutivo (${axis3Items.length}), Gestor Documental (${axis4Items.length}).`, size: 20 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: '• Hallazgos Clave: ', bold: true, size: 20 }),
              new TextRun({ text: `Existen `, size: 20 }),
              new TextRun({ text: `${urgentes} oportunidades urgentes con cierre ≤ 3 días`, bold: true, color: 'C00000', size: 20 }),
              new TextRun({ text: ` y `, size: 20 }),
              new TextRun({ text: `${postulaciones.length} postulaciones activas en el tablero Kanban.`, bold: true, size: 20 })
            ]
          }),

          // SECCIONES DE TABLAS POR EJES
          new Paragraph({
            text: '1.1 Google Maps & API de Google',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 }
          }),
          buildAxisTable(axis1Items),

          new Paragraph({
            text: '1.2 Migración de Datos, Arquitectura Tecnológica y BI',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 }
          }),
          buildAxisTable(axis2Items),

          new Paragraph({
            text: '1.3 Desarrollo de Software, Mantención y Evolución de Sistemas',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 }
          }),
          buildAxisTable(axis3Items),

          new Paragraph({
            text: '1.4 Gestor Documental, Digitalización y Procesamiento de Datos',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 }
          }),
          buildAxisTable(axis4Items),

          // CONCLUSIONES Y RECOMENDACIONES ESTRATÉGICAS
          new Paragraph({
            text: 'CONCLUSIONES Y RECOMENDACIONES ESTRATÉGICAS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 120 }
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Priorización de Postulación Temprana: ', bold: true }),
              new TextRun({ text: 'Ingresar cotizaciones en el portal Compra Ágil dentro de las primeras 24 horas del llamado.' })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: 'Acreditación Técnica y Certificaciones: ', bold: true }),
              new TextRun({ text: 'Verificar la inclusión de acreditaciones de Google Maps Platform Partner y arquitecturas Nube GCP/AWS/Azure.' })
            ]
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'Sincronización Automatizada: ', bold: true }),
              new TextRun({ text: 'Utilizar el Bot de Mercado Público para sincronizar hitos clave y preguntas con Google Calendar.' })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Informe_Ejecutivo_MercadoPublico_${mesNombre.replace(/\s+/g, '_')}.docx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
