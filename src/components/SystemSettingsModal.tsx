import React, { useState, useEffect } from 'react';
import { Settings, Search, Clock, Mail, Key, Check, Loader2, X, Sliders, Database, Save } from 'lucide-react';

interface SystemSettingsModalProps {
  onClose: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ onClose }) => {
  const [keywords, setKeywords] = useState('software, desarrollo, inteligencia artificial, google maps, cloud, bi');
  const [scrapingFrequency, setScrapingFrequency] = useState('30 min');
  const [alertEmail, setAlertEmail] = useState('alertas@empresa.cl');
  const [ticket, setTicket] = useState('DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        setFetching(true);
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.keywords) setKeywords(data.keywords);
          if (data.scrapingFrequency) setScrapingFrequency(data.scrapingFrequency);
          if (data.alertEmail) setAlertEmail(data.alertEmail);
          if (data.ticket) setTicket(data.ticket);
        }
      } catch (err) {
        console.error('Error cargando configuración:', err);
      } finally {
        setFetching(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          scrapingFrequency,
          alertEmail,
          ticket
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar la configuración en el servidor.');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Configuración del Sistema
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Parámetros de búsqueda, frecuencia de bot y alertas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Cargando preferencias del sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Campo 1: Palabras clave de búsqueda */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Search className="w-4 h-4 text-blue-600" />
                  <span>Palabras clave de búsqueda</span>
                </span>
                <span className="text-[11px] font-normal text-slate-400">Ej: 'software, desarrollo'</span>
              </label>
              <textarea
                required
                rows={3}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="software, desarrollo, inteligencia artificial, google maps, cloud, bi"
                className="w-full px-3 py-2.5 text-xs font-medium border rounded-xl bg-slate-50 focus:bg-white border-slate-300 focus:border-blue-500 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Palabras o términos separados por comas que el bot utilizará para filtrar oportunas licitaciones.
              </p>
            </div>

            {/* Campo 2: Frecuencia de Scraping */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-cyan-600" />
                <span>Frecuencia de Scraping (Bot)</span>
              </label>
              <div className="relative">
                <select
                  value={scrapingFrequency}
                  onChange={(e) => setScrapingFrequency(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white border-slate-300 focus:border-blue-500 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                >
                  <option value="15 min">Cada 15 minutos (Alta Frecuencia)</option>
                  <option value="30 min">Cada 30 minutos (Recomendado)</option>
                  <option value="1 hora">Cada 1 hora</option>
                  <option value="2 horas">Cada 2 horas</option>
                  <option value="6 horas">Cada 6 horas</option>
                  <option value="12 horas">Cada 12 horas</option>
                  <option value="24 horas">Una vez al día (24 horas)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Intervalo de tiempo entre ejecuciones del bot automático de extracción.
              </p>
            </div>

            {/* Campo 3: Correo de alertas */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center space-x-1.5">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>Correo de alertas</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="alertas@empresa.cl"
                  className="w-full px-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white border-slate-300 focus:border-blue-500 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Email donde se enviarán notificaciones automáticas y hallazgos relevantes de licitaciones.
              </p>
            </div>

            {/* Campo 4: Ticket Mercado Público API */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center space-x-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                <span>Ticket API Mercado Público</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder="DA0DDB29-A6DB-4B60-A862-AFCAD7FC31F8"
                  className="w-full px-3 py-2.5 text-xs font-mono font-semibold border rounded-xl bg-slate-50 focus:bg-white border-slate-300 focus:border-blue-500 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ticket de acceso para la API oficial de Mercado Público.
              </p>
            </div>

            {/* Banner de almacenamiento */}
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs flex items-center space-x-2 text-slate-600 font-mono">
              <Database className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-[11px]">
                Persistencia guardada en servidor backend (<code className="font-bold text-slate-800">config.json</code>).
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {error}
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando...</span>
                  </>
                ) : saved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>¡Preferencias Guardadas!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-cyan-200" />
                    <span>Guardar Configuración</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
