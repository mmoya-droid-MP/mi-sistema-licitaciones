import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  FileCode,
  Sparkles
} from 'lucide-react';
import { LicitacionItem, Postulacion, OrdenCompraItem } from '../types';
import { generateMonthlyPDFReport } from '../lib/pdfReportGenerator';
import { exportLicitacionesToExcel } from '../lib/excelExport';
import { generateWordReport } from '../lib/docxReportGenerator';

interface ReportsModalProps {
  licitaciones?: LicitacionItem[];
  postulaciones?: Postulacion[];
  ordenesCompra?: OrdenCompraItem[];
  data?: any[];
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  licitaciones = [],
  postulaciones = [],
  ordenesCompra = [],
  data,
  onClose
}) => {
  const [mes, setMes] = useState('Agosto 2026');
  const dateStr = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');

  // Detecta dinámicamente si los datos vienen de Órdenes de Compra o Licitaciones
  const itemsToAnalyze = data && data.length > 0 
    ? data 
    : (ordenesCompra && ordenesCompra.length > 0 ? ordenesCompra : licitaciones);

  const total30Dias = itemsToAnalyze.length;

  const handleDownloadPDF = () => {
    generateMonthlyPDFReport(itemsToAnalyze, postulaciones, mes);
    onClose();
  };

  const handleExportExcel = () => {
    exportLicitacionesToExcel(itemsToAnalyze, 'Reporte_MercadoPublico');
    onClose();
  };

  const handleExportWordDoc = async () => {
    await generateWordReport(itemsToAnalyze, postulaciones, mes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Generador de Reportes e Informes Consolidados</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Seleccionar Período de Reporte
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 border rounded-xl bg-slate-50"
            >
              <option value="Agosto 2026">Agosto 2026 (Mes Actual)</option>
              <option value="Julio 2026">Julio 2026</option>
              <option value="Junio 2026">Junio 2026</option>
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border text-xs space-y-2 text-slate-700">
            <div className="flex justify-between">
              <span>Módulos Incluidos:</span>
              <span className="font-bold text-slate-900">LE/LP, CM-5802363, COT26</span>
            </div>
            <div className="flex justify-between">
              <span>Total Oportunidades Extraídas:</span>
              <strong className="text-slate-900">{total30Dias}</strong>
            </div>
            <div className="flex justify-between">
              <span>Ejes Temáticos Clave:</span>
              <span className="text-blue-700 font-semibold">Google Maps, Desarrollo/IA, BI/Datos, Gestor Doc.</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleExportExcel}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs p-3 rounded-xl transition shadow"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Exportar Excel (`Reporte_MercadoPublico_${dateStr}.xlsx`)</span>
            </button>

            <button
              onClick={handleExportWordDoc}
              className="w-full flex items-center justify-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs p-3 rounded-xl transition shadow"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Generar Informe Ejecutivo Word (`Informe_Oportunidades_${dateStr}.docx`)</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs p-3 rounded-xl transition"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Descargar Reporte PDF Ejecutivo (`Reporte_MercadoPublico_${dateStr}.pdf`)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

