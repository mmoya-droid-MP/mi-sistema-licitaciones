import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, User, Lock, Terminal, Loader2, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<{
    hasSession: boolean;
    lastUpdated?: string;
    status?: string;
    message?: string;
  } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/mp/session');
      if (res.ok) {
        const data = await res.json();
        setSessionStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut.trim() || !password.trim()) {
      setError('Por favor complete su RUT y Contraseña de ClaveÚnica.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);
    setLogs([
      `🚀 Iniciando conexión con Mercado Público / ClaveÚnica para RUT: ${rut}...`,
      `🌐 Abriendo navegador con Playwright...`,
      `⏳ Aguarde la pantalla de 2FA de ClaveÚnica en la terminal.`
    ]);

    try {
      const response = await fetch('/api/mp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.status || 'Fallo de autenticación o error en el bot de Playwright.');
      }

      setSuccessResult(data);
      setLogs((prev) => [
        ...prev,
        `✅ ${data.status || 'Sesión verificada con Éxito'}!`,
        `📂 Cookies guardadas en session_mp.json`,
        `📊 Oportunidades extraídas: ${data.count || 0} registros`
      ]);
      await checkSession();
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Mercado Público vía Playwright.');
      setLogs((prev) => [
        ...prev,
        `❌ Error: ${err.message || 'Fallo de conexión en Playwright.'}`
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Conectar Cuenta Mercado Público
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Autenticación Privada con ClaveÚnica + 2FA Authenticator
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current session status banner */}
        {sessionStatus && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              sessionStatus.hasSession
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              {sessionStatus.hasSession ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold">{sessionStatus.status}</p>
                {sessionStatus.lastUpdated && (
                  <p className="text-[11px] opacity-80">
                    Última actualización: {new Date(sessionStatus.lastUpdated).toLocaleString('es-CL')}
                  </p>
                )}
                {sessionStatus.message && (
                  <p className="text-[11px] opacity-80">{sessionStatus.message}</p>
                )}
              </div>
            </div>
            <button
              onClick={checkSession}
              className="p-1 hover:bg-black/5 rounded text-xs font-semibold"
              title="Actualizar estado de sesión"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Notice about 2FA terminal input */}
        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>Instrucciones de Verificación 2FA (Authenticator)</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Al presionar <strong className="text-white">Conectar</strong>, el bot de Playwright iniciará sesión con tus credenciales ClaveÚnica.
          </p>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-amber-300 font-semibold text-[11px]">
            [?] Ingresa el código de 6 dígitos de Google Authenticator:
          </div>
          <p className="text-slate-400 text-[11px]">
            Cuando el bot detecte la pantalla 2FA, pausará en la terminal donde corre Node.js y te solicitará ingresar los 6 dígitos.
          </p>
        </div>

        {/* Auth form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              RUT ClaveÚnica (Formato: 12345678-9)
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                required
                placeholder="12345678-9"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                disabled={loading}
                className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Contraseña de ClaveÚnica
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Logs Output */}
          {logs.length > 0 && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-1 max-h-36 overflow-y-auto">
              {logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2"
            >
              Cerrar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Conectando e Inspecionando...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-cyan-300" />
                  <span>Conectar Cuenta Mercado Público</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
