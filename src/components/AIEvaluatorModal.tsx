import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  UserCheck,
  X,
  Loader2,
  Plus,
  CalendarDays,
  Download
} from 'lucide-react';
import { LicitacionItem, GeminiAnalysisResult } from '../types';
import { generateAIEvaluationPDF } from '../lib/aiEvaluationPdf';

interface AIEvaluatorModalProps {
  item: LicitacionItem;
  onClose: () => void;
  onAddPostulacion?: (item: LicitacionItem) => void;
  preloadedAnalysis?: GeminiAnalysisResult;
}

export const AIEvaluatorModal: React.FC<AIEvaluatorModalProps> = ({
  item,
  onClose,
  onAddPostulacion,
  preloadedAnalysis
}) => {
  const [loading, setLoading] = useState(!preloadedAnalysis);
  const [submitting, setSubmitting] = useState(false);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(preloadedAnalysis || null);

  useEffect(() => {
    let isMounted = true;

    if (preloadedAnalysis) {
      return; // Skip fetching if we already have the analysis
    }

    async function runAI() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licitacion: item,
            perfilEmpresa: "Empresa Chilena de Software, Consultoría TI, Inteligencia Artificial, Servicios Nube (GCP/AWS/Azure), Geolocalización (Maps/GIS) y Ciberseguridad."
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(()=>({}));
          throw new Error(errData.error || 'Error consultando servicio Gemini AI.');
        }

        if (response.headers.get('Content-Type')?.includes('text/plain')) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No stream available");
          const decoder = new TextDecoder();
          let text = '';
          
          let partialData: any = {
            porcentaje_match: 0,
            resumen_ejecutivo: "",
            requisitos_cumplidos: [],
            requisitos_faltantes: [],
            brechas_criticas: []
          };

          if (isMounted) setLoading(false); // Stop loading immediately when stream starts

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            
            // Extract values via regex to handle partial JSON seamlessly
            const matchScoreMatch = text.match(/"porcentaje_match"\s*:\s*(\d+)/);
            if (matchScoreMatch) partialData.porcentaje_match = parseInt(matchScoreMatch[1]);
            
            const resumenMatch = text.match(/"resumen_ejecutivo"\s*:\s*"([^]*?)"/);
            if (resumenMatch) partialData.resumen_ejecutivo = resumenMatch[1];
            else {
               // partial string matching for in-progress typing
               const openMatch = text.match(/"resumen_ejecutivo"\s*:\s*"([^]*)/);
               if (openMatch) partialData.resumen_ejecutivo = openMatch[1];
            }
            
            const extractArray = (key: string) => {
              const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]?`));
              if (m) {
                return m[1].split('","').map(s => s.replace(/["\n]/g, '').trim()).filter(Boolean);
              }
              // partial array parsing
              const mOpen = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([^]*)`));
              if (mOpen) {
                return mOpen[1].split('","').map(s => s.replace(/["\n]/g, '').trim()).filter(Boolean);
              }
              return [];
            };
            
            partialData.requisitos_cumplidos = extractArray("requisitos_cumplidos");
            partialData.requisitos_faltantes = extractArray("requisitos_faltantes");
            partialData.brechas_criticas = extractArray("brechas_criticas");
            
            if (isMounted) {
               setAnalysis({...partialData, matchScore: partialData.porcentaje_match});
            }
          }
        } else {
          const data = await response.json();
          if (isMounted) {
            setAnalysis({...data, matchScore: data.porcentaje_match || data.matchScore});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Error AI Analzye:", err);
          setError('Aviso: Error de conexión detectado. Cargando evaluación de respaldo.');
          setAnalysis({
            matchScore: 50,
            resumenEjecutivo: "Análisis de Inteligencia Artificial no disponible temporalmente por interrupción de conexión o servicio. Recomendamos revisar las bases directamente.",
            requisitosClave: ["Revisar las bases administrativas y técnicas adjuntas en la plataforma Mercado Público."],
            riesgosDetectados: ["Análisis de riesgo no disponible por desconexión temporal."],
            recomendacionesEstrategicas: ["Reintente la evaluación más tarde cuando la conexión se estabilice."],
            perfilesRequeridos: ["Sin información (Error de red)"],
            cartaGantt: "No disponible."
          } as any);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    runAI();

    return () => {
      isMounted = false;
    };
  }, [item]);

  const handleAddPostulacion = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        id: item.codigo || (item as any).id,
        codigo: item.codigo,
        licitacion: item,
        aiAnalysis: {
          requisitos: (analysis as any)?.requisitosClave || (analysis as any)?.requisitos || [],
          riesgos: (analysis as any)?.riesgosDetectados || (analysis as any)?.riesgos || [],
          recomendaciones: (analysis as any)?.recomendacionesEstrategicas || (analysis as any)?.recomendaciones || [],
          perfiles: (analysis as any)?.perfilesRequeridos || [],
          matchScore: analysis?.matchScore,
          resumenEjecutivo: (analysis as any)?.resumenEjecutivo,
          cartaGantt: analysis?.cartaGantt
        }
      };

      const response = await fetch('/api/postulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'No se pudo registrar la postulación en el servidor.');
      }

      setToastSuccess('Añadido a Mis Postulaciones correctamente');

      if (onAddPostulacion) {
        onAddPostulacion(item);
      }

      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err: any) {
      console.error('Error guardando postulación:', err);
      setError(err.message || 'Error al conectar con la base de datos de postulaciones.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Toast Notification Alert */}
      {toastSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-bounce border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastSuccess}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                {item.codigo}
              </span>
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Análisis Términos de Referencia TDR con Gemini AI</span>
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {item.nombre}
            </h3>
            <p className="text-xs font-semibold text-slate-500">{item.cliente}</p>
          </div>

          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-indigo-600">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-slate-800">
              Evaluando requerimientos técnicos e idoneidad con Gemini AI...
            </p>
            <p className="text-xs text-slate-400">Analizando perfil, garantías y competitividad de la propuesta.</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
            <p className="font-bold flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1 text-rose-600" /> Error de Evaluación IA
            </p>
            <p>{error}</p>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Match score card */}
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md">
              <div>
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                  Factibilidad y Compatibilidad (Match)
                </span>
                <p className="text-3xl font-extrabold text-white mt-1">
                  {analysis?.porcentaje_match || analysis?.matchScore || 0}%
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Basado en capacidades técnicas, certificaciones y experiencia del equipo.
                </p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-indigo-400 flex items-center justify-center font-extrabold text-xl text-indigo-300 bg-indigo-950/50">
                {analysis?.porcentaje_match || analysis?.matchScore || 0}%
              </div>
            </div>

            {/* Resumen Ejecutivo */}
            <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Diagnóstico Ejecutivo
              </h4>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {analysis?.resumen_ejecutivo || (analysis as any)?.resumenEjecutivo || 'No disponible'}
              </p>
            </div>

            {/* Requisitos Cumplidos & Faltantes (2 grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cumplidos */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Requisitos Cumplidos
                </h4>
                <ul className="text-xs text-emerald-950 space-y-1 list-disc pl-4">
                  {(analysis?.requisitos_cumplidos || [])?.map((req: string, i: number) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>

              {/* Faltantes */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                  Requisitos Faltantes / Brechas
                </h4>
                <ul className="text-xs text-amber-950 space-y-1 list-disc pl-4">
                  {(analysis?.requisitos_faltantes || [])?.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Brechas Críticas */}
            {analysis?.brechas_criticas && analysis?.brechas_criticas.length > 0 && (
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 space-y-2">
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
                  Brechas Críticas (Riesgo Alto)
                </h4>
                <ul className="text-xs text-rose-950 space-y-1 list-disc pl-4 font-medium">
                  {analysis?.brechas_criticas?.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Carta Gantt (Markdown) */}
            {analysis?.cartaGantt && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 overflow-x-auto">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center">
                  <CalendarDays className="w-4 h-4 mr-1.5 text-slate-600" />
                  Carta Gantt Preliminar (Markdown)
                </h4>
                <pre className="text-xs text-slate-700 font-mono whitespace-pre bg-white p-3 rounded-lg border border-slate-200 shadow-sm mt-2">
                  {analysis?.cartaGantt}
                </pre>
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2 disabled:opacity-50"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {analysis && (
              <button
                onClick={() => generateAIEvaluationPDF(item, analysis)}
                disabled={submitting || loading}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Reporte PDF</span>
              </button>
            )}

            {onAddPostulacion && (
              <button
                onClick={handleAddPostulacion}
                disabled={submitting || loading}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Añadir a Mis Postulaciones</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
