import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LicitacionItem, GeminiAnalysisResult } from '../types';

export function generateAIEvaluationPDF(item: LicitacionItem, analysis: GeminiAnalysisResult) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const codigo = item.id || item.codigo || item.CodigoExterno || 'Sin-Codigo';
  
  // Corporate Colors
  const primaryColor = [79, 70, 229]; // Indigo-600 #4f46e5
  const darkGray = [50, 50, 50];
  
  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 24, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('EVALUACIÓN DE LICITACIÓN CON INTELIGENCIA ARTIFICIAL', 14, 15);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`GeoSolve SpA | Fecha: ${new Date().toLocaleDateString('es-CL')} | Código: ${codigo}`, 196, 15, { align: 'right' });
  
  let currentY = 35;
  
  // Helper for Section Titles
  const addSectionTitle = (title: string, y: number) => {
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, 14, y);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y + 2, 196, y + 2);
    return y + 8;
  };

  const addTextLines = (text: string, y: number, fontSize = 10, isBold = false) => {
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, 182);
    
    // Check page break
    if (y + (lines.length * 5) > 280) {
      doc.addPage();
      y = 20;
    }
    
    doc.text(lines, 14, y);
    return y + (lines.length * (fontSize * 0.5));
  };

  const addList = (items: string[], y: number) => {
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    items.forEach(listItem => {
      const lines = doc.splitTextToSize(`• ${listItem}`, 182);
      if (y + (lines.length * 5) > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 14, y);
      y += (lines.length * 5) + 2;
    });
    return y + 4;
  };

  // Intro
  currentY = addTextLines(`Licitación: ${item.nombre || item.Nombre}`, currentY, 11, true);
  currentY = addTextLines(`Organismo: ${item.organismo || item.cliente || item.Comprador?.NombreOrganismo || 'N/A'}`, currentY + 2);
  currentY += 6;

  // Section 1: Match Score y Resumen Ejecutivo
  currentY = addSectionTitle('1. MATCH SCORE Y RESUMEN EJECUTIVO', currentY);
  
  // Match Score
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (analysis.matchScore >= 75) {
    doc.setTextColor(16, 185, 129); // emerald-500
  } else if (analysis.matchScore >= 50) {
    doc.setTextColor(245, 158, 11); // amber-500
  } else {
    doc.setTextColor(239, 68, 68); // rose-500
  }
  doc.text(`Match Score: ${analysis.matchScore}%`, 14, currentY);
  currentY += 6;
  
  currentY = addTextLines(analysis.resumenEjecutivo, currentY);
  currentY += 6;

  // Section 2: Requisitos Clave y Riesgos / Barreras
  currentY = addSectionTitle('2. REQUISITOS TÉCNICOS Y RIESGOS DETECTADOS', currentY);
  
  currentY = addTextLines('Requisitos Clave TDR:', currentY, 10, true);
  currentY += 2;
  currentY = addList(analysis.requisitosClave, currentY);
  
  currentY = addTextLines('Riesgos / Barreras Detectadas:', currentY, 10, true);
  currentY += 2;
  currentY = addList(analysis.riesgosDetectados, currentY);

  // Section 3: Recomendaciones y Perfiles
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }
  currentY = addSectionTitle('3. RECOMENDACIONES GANADORAS Y PERFILES', currentY);
  
  currentY = addTextLines('Estrategia de Postulación:', currentY, 10, true);
  currentY += 2;
  currentY = addList(analysis.recomendacionesEstrategicas, currentY);
  
  currentY = addTextLines('Perfiles / Roles Requeridos:', currentY, 10, true);
  currentY += 2;
  currentY = addList(analysis.perfilesRequeridos, currentY);

  if (analysis.cartaGantt && analysis.cartaGantt !== "No disponible." && analysis.cartaGantt !== "No disponible en vista histórica.") {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    currentY = addSectionTitle('4. CARTA GANTT REFERENCIAL', currentY);
    currentY = addTextLines(analysis.cartaGantt, currentY);
  }

  // Footer page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `GeoSolve SpA | Análisis de Licitación Generado por IA | Página ${i} de ${pageCount}`,
      14,
      287
    );
  }

  doc.save(`Evaluacion_IA_${codigo}.pdf`);
}
