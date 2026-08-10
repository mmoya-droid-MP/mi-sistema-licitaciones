import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  UserCheck,
  X,
  Loader2,
  Plus
} from 'lucide-react';
import { LicitacionItem, GeminiAnalysisResult } from '../types';

interface AIEvaluatorModalProps {
  item: LicitacionItem;
  onClose: () => void;
  onAddPostulacion?: (item: LicitacionItem) => void;
}

export const AIEvaluatorModal: React.FC<AIEvaluatorModalProps> = ({
  item,
  onClose,
  onAddPostulacion
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(null);

  useEffect(() => {
    let isMounted = true;

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
          const errData = await response.json();
          throw new Error(errData.error || 'Error consultando servicio Gemini AI.');
        }

        const data = await response.json();
        if (isMounted) {
          setAnalysis(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error analizando licitación con IA.');
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
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
                  Nivel de Afinidad Estimado (Match Score)
                </span>
                <p className="text-3xl font-extrabold text-white mt-1">
                  {analysis.matchScore}%
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Basado en capacidades técnicas, stack tecnológico y experiencia del equipo.
                </p>
              </div>

              <div className="w-16 h-16 rounded-full border-4 border-indigo-400 flex items-center justify-center font-extrabold text-xl text-indigo-300 bg-indigo-950/50">
                {analysis.matchScore}%
              </div>
            </div>

            {/* Resumen Ejecutivo */}
            <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Resumen Ejecutivo
              </h4>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {analysis.resumenEjecutivo}
              </p>
            </div>

            {/* Requisitos Clave & Riesgos (2 grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Requisitos */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Requisitos Clave TDR
                </h4>
                <ul className="text-xs text-emerald-950 space-y-1 list-disc pl-4">
                  {(analysis?.requisitosClave || (analysis as any)?.requisitos || []).map((req: string, i: number) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>

              {/* Riesgos */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                  Riesgos y Barreras Detectadas
                </h4>
                <ul className="text-xs text-amber-950 space-y-1 list-disc pl-4">
                  {(analysis?.riesgosDetectados || (analysis as any)?.riesgos || []).map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recomendaciones Estratégicas */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-2">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center">
                <Lightbulb className="w-4 h-4 mr-1.5 text-blue-600" />
                Recomendaciones Ganadoras para la Propuesta
              </h4>
              <ul className="text-xs text-blue-950 space-y-1 list-disc pl-4">
                {(analysis?.recomendacionesEstrategicas || (analysis as any)?.recomendaciones || []).map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Perfiles Requeridos */}
            {analysis?.perfilesRequeridos && analysis.perfilesRequeridos.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center">
                  <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-500" /> Perfiles y Capacidades Requeridas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.perfilesRequeridos.map((p, i) => (
                    <span key={i} className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2"
          >
            Cerrar
          </button>

          <button
            onClick={() => {
              onAddPostulacion(item);
              onClose();
            }}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir a Mis Postulaciones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
