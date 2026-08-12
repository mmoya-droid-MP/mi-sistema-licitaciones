import React, { useState } from 'react';
import {
  Kanban,
  Plus,
  Calendar,
  CheckSquare,
  Square,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronRight,
  Clock,
  UserCheck,
  DollarSign,
  FileText,
  AlertCircle,
  X,
  History
} from 'lucide-react';
import { Postulacion, EstadoPostulacion } from '../types';
import { openGoogleCalendar } from '../lib/googleCalendar';

interface PostulacionesPipelineViewProps {
  postulaciones: Postulacion[];
  setPostulaciones?: React.Dispatch<React.SetStateAction<Postulacion[]>>;
  onUpdatePostulacion?: (post: Postulacion) => void;
  onDeletePostulacion?: (id: string) => void;
}

const STAGES: { id: EstadoPostulacion; title: string; color: string; bg: string }[] = [
  { id: 'Interes', title: '1. Guardadas / Interés', color: 'border-slate-400', bg: 'bg-slate-100 text-slate-800' },
  { id: 'TDR', title: '2. Revisión TDR', color: 'border-blue-400', bg: 'bg-blue-100 text-blue-800' },
  { id: 'Preparando', title: '3. Preparando Oferta', color: 'border-amber-500', bg: 'bg-amber-100 text-amber-900' },
  { id: 'Enviada', title: '4. Oferta Enviada', color: 'border-purple-500', bg: 'bg-purple-100 text-purple-800' },
  { id: 'Adjudicada', title: '5. Adjudicada 🎉', color: 'border-emerald-500', bg: 'bg-emerald-100 text-emerald-800' },
  { id: 'Desestimada', title: 'Desestimada', color: 'border-rose-300', bg: 'bg-rose-100 text-rose-800' }
];

export const PostulacionesPipelineView: React.FC<PostulacionesPipelineViewProps> = ({
  postulaciones,
  onUpdatePostulacion,
  onDeletePostulacion
}) => {
  const [selectedPost, setSelectedPost] = useState<Postulacion | null>(null);

  const safePostulaciones = postulaciones || [];

  // Toggle checklist item
  const toggleChecklist = (post: Postulacion, checkId: string) => {
    const updatedChecklist = (post.checklist || []).map((c) =>
      c.id === checkId ? { ...c, completed: !c.completed } : c
    );
    const updatedPost = { ...post, checklist: updatedChecklist, updatedAt: new Date().toISOString() };
    if (onUpdatePostulacion) onUpdatePostulacion(updatedPost);
    if (selectedPost && selectedPost.id === post.id) {
      setSelectedPost(updatedPost);
    }
  };

  // Change stage
  const moveStage = (post: Postulacion, nextStage: EstadoPostulacion) => {
    const newHistorial = [
      ...(post.historial || []),
      {
        id: `h-${Date.now()}`,
        fecha: new Date().toLocaleString('es-CL'),
        titulo: `Cambio de Estado a ${nextStage}`,
        detalle: `Postulación movida a ${nextStage}.`
      }
    ];
    const updatedPost = {
      ...post,
      estadoPostulacion: nextStage,
      historial: newHistorial,
      updatedAt: new Date().toISOString()
    };
    if (onUpdatePostulacion) onUpdatePostulacion(updatedPost);
    if (selectedPost && selectedPost.id === post.id) {
      setSelectedPost(updatedPost);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Kanban className="w-6 h-6 text-blue-600" />
            <span>Gestión de Postulaciones & Pipeline</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seguimiento de ofertas, checklists de garantías/documentos y alertas de cierre.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-bold border border-blue-200">
            Total en Cartera: {(safePostulaciones || []).length}
          </span>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {STAGES.filter(s => s.id !== 'Desestimada').map((stage) => {
          const stagePosts = (safePostulaciones || []).filter((p) => p && p.estadoPostulacion === stage.id);

          return (
            <div
              key={stage.id}
              className="bg-slate-50/80 rounded-2xl border border-slate-200 p-3.5 flex flex-col min-w-[260px] h-full"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${stage.bg}`}>
                  {stage.title}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border">
                  {(stagePosts || []).length}
                </span>
              </div>

              {/* Cards in Column */}
              <div className="space-y-3 flex-1">
                {(stagePosts || []).length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400">
                    Arrastra o asigna licitaciones aquí
                  </div>
                ) : (
                  stagePosts.map((post) => {
                    const completedCount = (post.checklist || []).filter((c) => c?.completed).length;
                    const totalCheck = (post.checklist || []).length;

                    return (
                      <div
                        key={post.id}
                        className={`bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition space-y-3 relative group ${stage.color}`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {post.codigoLicitacion}
                          </span>

                          <button
                            onClick={() => setSelectedPost(post)}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Ver / Editar
                          </button>
                        </div>

                        {/* Title */}
                        <h4 className="font-semibold text-slate-900 text-xs line-clamp-2 leading-snug">
                          {post.licitacionNombre}
                        </h4>

                        <p className="text-[11px] font-bold text-slate-500 truncate">
                          {post.cliente}
                        </p>

                        {/* Checklist progress */}
                        {totalCheck > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                              <span>Checklist Documentos</span>
                              <span>{completedCount}/{totalCheck}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${(completedCount / totalCheck) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <button
                            onClick={() => openGoogleCalendar(post)}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-semibold"
                            title="Sincronizar fecha límite con Google Calendar"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>GCal Sync</span>
                          </button>

                          <span className="font-bold text-slate-700">
                            {post.montoOfertaClp
                              ? `$${(post.montoOfertaClp / 1000000).toFixed(1)}M`
                              : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail / Edit Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                    {selectedPost.codigoLicitacion}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                    {selectedPost.estadoPostulacion}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {selectedPost.licitacionNombre}
                </h3>
                <p className="text-xs font-semibold text-slate-500">{selectedPost.cliente}</p>
              </div>

              <button
                onClick={() => setSelectedPost(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick State Changer */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cambiar Estado de la Postulación
              </label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => moveStage(selectedPost, s.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                      selectedPost.estadoPostulacion === s.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Form info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
              <div>
                <label className="text-xs font-bold text-slate-500 block">Responsable Interno</label>
                <input
                  type="text"
                  value={selectedPost.responsable}
                  onChange={(e) => {
                    const updated = { ...selectedPost, responsable: e.target.value };
                    setSelectedPost(updated);
                    onUpdatePostulacion(updated);
                  }}
                  className="w-full text-xs font-semibold text-slate-900 bg-white border rounded p-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block">Monto Oferta CLP</label>
                <input
                  type="number"
                  value={selectedPost.montoOfertaClp || ''}
                  onChange={(e) => {
                    const updated = { ...selectedPost, montoOfertaClp: Number(e.target.value) };
                    setSelectedPost(updated);
                    onUpdatePostulacion(updated);
                  }}
                  className="w-full text-xs font-semibold text-slate-900 bg-white border rounded p-2 mt-1"
                />
              </div>
            </div>

            {/* Checklist documents */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span>Checklist de Documentos Requeridos</span>
                <span className="text-xs font-normal text-slate-500">
                  {(selectedPost.checklist || []).filter((c) => c?.completed).length}/{(selectedPost.checklist || []).length} listos
                </span>
              </h4>

              <div className="space-y-2">
                {(selectedPost.checklist || []).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => toggleChecklist(selectedPost, c.id)}
                    className="flex items-center space-x-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer border text-xs"
                  >
                    {c.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span className={c.completed ? 'line-through text-slate-400 font-medium' : 'text-slate-800 font-semibold'}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Notas de Estrategia y Observaciones</label>
              <textarea
                rows={3}
                value={selectedPost.notas || ''}
                onChange={(e) => {
                  const updated = { ...selectedPost, notas: e.target.value };
                  setSelectedPost(updated);
                  if (onUpdatePostulacion) onUpdatePostulacion(updated);
                }}
                className="w-full text-xs p-3 border rounded-xl bg-slate-50 focus:bg-white"
                placeholder="Ingresa detalles sobre precios, competidores, anexos..."
              />
            </div>

            {/* Historial */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1">
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>Historial de Actualizaciones de la Postulación</span>
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs">
                {(selectedPost.historial || []).map((h) => (
                  <div key={h.id} className="p-2 bg-slate-100 rounded text-slate-700">
                    <span className="font-bold text-slate-900">{h.fecha}: </span>
                    <strong className="text-blue-700">{h.titulo}</strong> - {h.detalle}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={() => {
                  onDeletePostulacion(selectedPost.id);
                  setSelectedPost(null);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center space-x-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Postulación</span>
              </button>

              <button
                onClick={() => openGoogleCalendar(selectedPost)}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                <Calendar className="w-4 h-4" />
                <span>Sincronizar con Google Calendar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
