import React, { useState, useEffect } from 'react';
import { Settings, Key, Check, RefreshCw, X } from 'lucide-react';

interface TicketSettingsModalProps {
  onClose: () => void;
}

export const TicketSettingsModal: React.FC<TicketSettingsModalProps> = ({ onClose }) => {
  const [ticket, setTicket] = useState('DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadTicket() {
      try {
        const res = await fetch('/api/settings/ticket');
        if (res.ok) {
          const data = await res.json();
          if (data.ticket) setTicket(data.ticket);
        }
      } catch {
        // ignore
      }
    }
    loadTicket();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/settings/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span>Configuración API Mercado Público</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Ticket API de Mercado Público (MERCADO_PUBLICO_TICKET)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                required
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-semibold border rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Ticket por defecto activado: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8</code>. Puedes cambiarlo si utilizas tu propio ticket de desarrollador registrado en Mercado Público.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 px-4 py-2"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <span>Guardar Ticket</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
