import React, { useState } from 'react';
import {
  Share2,
  Mail,
  MessageSquare,
  Copy,
  Check,
  FileText,
  X,
  ExternalLink
} from 'lucide-react';
import { LicitacionItem } from '../types';
import { generateMonthlyPDFReport } from '../lib/pdfReportGenerator';
import { getItemOfficialUrl } from '../lib/dateUtils';
import { cleanTextPrefixes } from '../lib/searchUtils';

interface ShareModalProps {
  item?: LicitacionItem;
  allItems?: LicitacionItem[];
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  item,
  allItems = [],
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const targets = item ? [item] : allItems.slice(0, 5);

  const formatText = () => {
    if (item) {
      return (
        `🚨 OPORTUNIDAD MERCADO PÚBLICO: ${item.codigo}\n` +
        `📌 ${cleanTextPrefixes(item.nombre)}\n` +
        `🏢 Responsable: ${item.cliente}\n` +
        `📅 Cierre: ${new Date(item.fechaCierre).toLocaleDateString('es-CL')} (Quedan ${item.diasRestantes} días)\n` +
        `🔗 Ver Ficha Directa: ${getItemOfficialUrl(item)}`
      );
    } else {
      return (
        `📋 RESUMEN DE LICITACIONES DESTACADAS MERCADO PÚBLICO:\n\n` +
        targets
          .map(
            (t) =>
              `• [${t.codigo}] ${cleanTextPrefixes(t.nombre)}\n  Cliente: ${t.cliente} | Cierre: ${new Date(t.fechaCierre).toLocaleDateString('es-CL')}\n  Enlace: ${getItemOfficialUrl(t)}`
          )
          .join('\n\n')
      );
    }
  };

  const textToShare = formatText();

  const handleCopy = () => {
    navigator.clipboard.writeText(textToShare);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMailto = () => {
    const subject = encodeURIComponent(
      item
        ? `Licitación Mercado Público: ${item.codigo} - ${item.nombre}`
        : `Resumen Licitaciones Mercado Público Chile`
    );
    const body = encodeURIComponent(textToShare);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(textToShare);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handlePDF = () => {
    generateMonthlyPDFReport(allItems, [], 'Agosto 2026');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-cyan-600" />
            <span>Compartir Licitación o Reporte</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border text-xs text-slate-700 max-h-40 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
          {textToShare}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleMailto}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs p-3 rounded-xl transition"
          >
            <Mail className="w-4 h-4" />
            <span>Enviar por Correo</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs p-3 rounded-xl transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Compartir WhatsApp</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs p-3 rounded-xl transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
          </button>

          <button
            onClick={handlePDF}
            className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs p-3 rounded-xl transition"
          >
            <FileText className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
