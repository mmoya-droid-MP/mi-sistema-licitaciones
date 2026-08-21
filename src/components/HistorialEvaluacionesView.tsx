import React, { useState, useEffect, useDeferredValue } from 'react';
import { FileText, Loader2, Search, ExternalLink, CalendarDays, BarChart2 } from 'lucide-react';
import { LicitacionItem, GeminiAnalysisResult } from '../types';
import { AIEvaluatorModal } from './AIEvaluatorModal';

interface EvaluacionDB {
  id: number;
  codigo_proceso: string;
  nombre_proceso: string;
  organismo: string;
  tipo_proceso: string;
  match_score: number;
  resumen_ejecutivo: string;
  requisitos_clave: string[];
  riesgos: string[];
  created_at: string;
}

export const HistorialEvaluacionesView: React.FC = () => {
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  
  const [selectedEvaluacion, setSelectedEvaluacion] = useState<{
    item: LicitacionItem,
    analysis: GeminiAnalysisResult
  } | null>(null);

  useEffect(() => {
    fetchEvaluaciones();
  }, []);

  const fetchEvaluaciones = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/evaluaciones');
      if (!res.ok) throw new Error('Error al cargar historial de evaluaciones');
      const data = await res.json();
      setEvaluaciones(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetalle = (ev: EvaluacionDB) => {
    // Construct dummy LicitacionItem based on DB row
    const dummyItem = {
      id: ev.codigo_proceso,
      codigo: ev.codigo_proceso,
      nombre: ev.nombre_proceso,
      organismo: ev.organismo,
      cliente: ev.organismo,
      tipo: ev.tipo_proceso as any,
      comprador: "Sin información",
      fecha_cierre: ev.created_at,
      fechaCierre: ev.created_at,
      monto: 0,
      url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${ev.codigo_proceso}`
    } as unknown as LicitacionItem;
    const analysis = {

     
      matchScore: ev.match_score,
      resumenEjecutivo: ev.resumen_ejecutivo,
      requisitosClave: ev.requisitos_clave || [],
      riesgosDetectados: ev.riesgos || [],
      recomendacionesEstrategicas: ["Recomendaciones guardadas no disponibles en caché."],
      perfilesRequeridos: ["Perfil desde base de datos."],
      cartaGantt: "No disponible en vista histórica."
    };

    setSelectedEvaluacion({ item: dummyItem, analysis: analysis as unknown as GeminiAnalysisResult });
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const filteredData = evaluaciones.filter(e => 
    e.codigo_proceso.toLowerCase().includes(deferredSearch.toLowerCase()) ||
    e.nombre_proceso.toLowerCase().includes(deferredSearch.toLowerCase()) ||
    e.organismo.toLowerCase().includes(deferredSearch.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-indigo-600" />
            Historial de Evaluaciones
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Registro de todas las licitaciones evaluadas con Gemini AI.
          </p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar por código, nombre u organismo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      <div className="p-4 md:p-6 flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
            <p>Cargando historial...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-lg text-sm border border-rose-200">
            {error}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No hay evaluaciones</h3>
            <p className="text-slate-500 text-sm">
              {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'Aún no has evaluado ninguna licitación con la Inteligencia Artificial.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredData.map((ev) => (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow flex flex-col h-full relative group">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    {ev.codigo_proceso}
                  </span>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(ev.match_score)} flex items-center`}>
                    <BarChart2 className="w-3 h-3 mr-1" />
                    {ev.match_score}% Match
                  </div>
                </div>
                
                <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-2 line-clamp-2" title={ev.nombre_proceso}>
                  {ev.nombre_proceso}
                </h3>
                
                <div className="text-xs text-slate-600 mb-4 flex-1">
                  <p className="line-clamp-1 mb-1" title={ev.organismo}>
                    <span className="font-medium text-slate-700">Comprador:</span> {ev.organismo}
                  </p>
                  <p className="flex items-center text-slate-500 mt-2">
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                    Evaluado el {new Date(ev.created_at).toLocaleDateString('es-CL')}
                  </p>
                </div>
                
                <button
                  onClick={() => openDetalle(ev)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver Detalle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEvaluacion && (
        <AIEvaluatorModal
          item={selectedEvaluacion.item}
          preloadedAnalysis={selectedEvaluacion.analysis}
          onClose={() => setSelectedEvaluacion(null)}
        />
      )}
    </div>
  );
};
