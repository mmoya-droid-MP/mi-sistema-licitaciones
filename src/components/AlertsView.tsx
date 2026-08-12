import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Smartphone,
  Sparkles,
  Zap,
  Clock,
  X
} from 'lucide-react';
import { AlertaRule, AlertaNotificacion, TipoProceso } from '../types';

interface AlertsViewProps {
  alertas: AlertaRule[];
  setAlertas?: React.Dispatch<React.SetStateAction<AlertaRule[]>>;
  notificaciones?: AlertaNotificacion[];
  onAddAlerta?: (alerta: AlertaRule) => void;
  onDeleteAlerta?: (id: string) => void;
  onToggleAlerta?: (id: string) => void;
  onMarkNotifRead?: (id: string) => void;
  onMarkAllNotifsRead?: () => void;
  onClearNotifs?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alertas,
  notificaciones,
  onAddAlerta,
  onDeleteAlerta,
  onToggleAlerta,
  onMarkNotifRead,
  onMarkAllNotifsRead,
  onClearNotifs
}) => {
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [palabras, setPalabras] = useState('');
  const [monto, setMonto] = useState('');
  const [tiposSelected, setTiposSelected] = useState<TipoProceso[]>(['Licitacion', 'Compra Agil']);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const newRule: AlertaRule = {
      id: `alerta-${Date.now()}`,
      nombre: nombre.trim(),
      palabrasClave: palabras.split(',').map((p) => p.trim()).filter(Boolean),
      organismos: [],
      tipos: tiposSelected,
      montoMinimoClp: monto ? Number(monto) : undefined,
      notificarEmail: true,
      notificarApp: true,
      activa: true,
      creadaEn: new Date().toISOString().split('T')[0]
    };

    onAddAlerta(newRule);
    setShowModal(false);
    setNombre('');
    setPalabras('');
    setMonto('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Alertas Personalizadas & Centro de Notificaciones</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configura notificaciones automáticas para oportunidades prioritarias, cambios en fechas clave y convocatorias de Compra Ágil.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Alerta Personalizada</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center justify-between">
            <span>Reglas de Alerta Activas</span>
            <span className="text-xs text-slate-500 font-normal">{(alertas || []).length} configuradas</span>
          </h3>

          <div className="space-y-3">
            {(alertas || []).length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                No tienes reglas de alertas creadas. Haz clic en "Nueva Alerta Personalizada" para monitorear licitaciones por palabra clave o monto.
              </div>
            ) : (
              (alertas || []).map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs transition flex flex-col justify-between space-y-3 ${
                    rule.activa ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-sm">{rule.nombre}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rule.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {rule.activa ? 'Activa' : 'Pausada'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Creada el {rule.creadaEn}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onToggleAlerta(rule.id)}
                        className={`text-xs px-3 py-1 rounded-lg font-bold transition ${
                          rule.activa ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rule.activa ? 'Pausar' : 'Activar'}
                      </button>

                      <button
                        onClick={() => onDeleteAlerta(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Eliminar regla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Palabras Clave Monitoreadas:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {rule.palabrasClave.map((kw) => (
                        <span key={kw} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-medium border border-blue-100">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-3">
                      <span>Tipos: <strong>{rule.tipos.join(', ')}</strong></span>
                      {rule.montoMinimoClp && (
                        <span>Monto Min: <strong>${(rule.montoMinimoClp / 1000000).toFixed(1)}M CLP</strong></span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="flex items-center text-slate-500">
                        <Mail className="w-3 h-3 mr-1 text-blue-500" /> Correo
                      </span>
                      <span className="flex items-center text-slate-500">
                        <Smartphone className="w-3 h-3 mr-1 text-emerald-500" /> App
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications History Column */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Historial de Alertas Received</span>
            </h3>

            {notificaciones.length > 0 && (
              <div className="flex items-center space-x-2">
                {onMarkAllNotifsRead && (
                  <button
                    onClick={onMarkAllNotifsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded"
                  >
                    Marcar Leídas
                  </button>
                )}
                <button
                  onClick={onClearNotifs}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {(notificaciones || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Sin notificaciones pendientes.
              </p>
            ) : (
              (notificaciones || []).map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkNotifRead(n.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1 ${
                    n.leida
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-amber-50/70 border-amber-300 text-slate-900 ring-1 ring-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{n.titulo}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(n.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-snug">{n.mensaje}</p>
                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    Código: {n.codigoLicitacion}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <span>Crear Regla de Alerta</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block">Nombre de la Alerta</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Licitaciones de Software & GCP"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-xl mt-1 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block">
                  Palabras Clave (separadas por coma)
                </label>
                <input
                  type="text"
                  placeholder="ej. gcp, software, geolocalizacion, api"
                  value={palabras}
                  onChange={(e) => setPalabras(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-xl mt-1 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block">Monto Mínimo CLP (opcional)</label>
                <input
                  type="number"
                  placeholder="ej. 10000000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-xl mt-1 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs font-semibold text-slate-600 px-4 py-2"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition"
                >
                  Guardar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
