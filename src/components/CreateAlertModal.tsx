import React, { useState } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { LicitacionItem, AlertaRule, TipoProceso } from '../types';

interface CreateAlertModalProps {
  item?: LicitacionItem;
  licitacion?: LicitacionItem;
  onClose: () => void;
  onAddAlerta?: (alerta: AlertaRule) => void;
  onSave?: (alerta: AlertaRule) => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  item,
  licitacion,
  onClose,
  onAddAlerta,
  onSave
}) => {
  const rawObj = licitacion || item || {};
  const targetItem = {
    codigo: (rawObj as any).codigo || (rawObj as any).id || 'S/I',
    cliente: (rawObj as any).cliente || (rawObj as any).organismo || 'General',
    nombre: (rawObj as any).nombre || (rawObj as any).licitacionNombre || 'Alerta Personalizada',
    montoEstimadoClp: (rawObj as any).montoEstimadoClp || (rawObj as any).monto || 0,
    tipo: ((rawObj as any).tipo || 'Licitacion') as TipoProceso,
    tags: (rawObj as any).tags || []
  };

  const saveFn = onAddAlerta || onSave || (() => {});

  const [nombre, setNombre] = useState(`Alerta: ${targetItem.codigo} - ${targetItem.cliente}`);
  const [palabras, setPalabras] = useState(
    [targetItem.codigo, ...(targetItem.tags || [])].filter(Boolean).join(', ')
  );
  const [monto, setMonto] = useState(targetItem.montoEstimadoClp ? String(targetItem.montoEstimadoClp) : '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRule: AlertaRule = {
      id: `alerta-${Date.now()}`,
      nombre: nombre.trim() || `Alerta ${targetItem.codigo}`,
      palabrasClave: palabras
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      organismos: [targetItem.cliente],
      tipos: [targetItem.tipo],
      montoMinimoClp: monto ? Number(monto) : undefined,
      notificarEmail: true,
      notificarApp: true,
      activa: true,
      creadaEn: new Date().toISOString().split('T')[0]
    };

    saveFn(newRule);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <span>Crear Alerta Personalizada</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="p-6 text-center space-y-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm">¡Regla de Alerta Creada Con Éxito!</h4>
            <p className="text-xs text-emerald-700">
              Recibirás notificaciones cuando existan actualizaciones o nuevas convocatorias asociadas.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-mono font-bold text-slate-900">{targetItem.codigo}</div>
              <div className="font-semibold text-slate-700">{targetItem.cliente}</div>
              <div className="text-slate-500 line-clamp-1">{targetItem.nombre}</div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Nombre de la Regla</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Palabras Clave Precargadas (separadas por coma)
              </label>
              <input
                type="text"
                value={palabras}
                onChange={(e) => setPalabras(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Monto Mínimo CLP (opcional)</label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition shadow-xs"
              >
                Guardar Alerta 🔔
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
