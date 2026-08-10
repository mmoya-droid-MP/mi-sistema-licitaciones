import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, User, Lock, Terminal, Loader2, CheckCircle2, AlertTriangle, X, RefreshCw, Smartphone } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending2FA, setPending2FA] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
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
    setPending2FA(false);
    setLogs([
      `🚀 Iniciando conexión con Mercado Público / ClaveÚnica para RUT: ${rut}...`,
      `🌐 Abriendo navegador Puppeteer...`,
      `⏳ Aguarde la verificación de credenciales...`
    ]);

    try {
      const response = await fetch('/api/mp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password })
      });

      const data = await response.json();

      if (data.require2FA) {
        setPending2FA(true);
        setSessionId(data.sessionId || null);
        setLogs((prev) => [
          ...prev,
          `🔒 Credenciales válidas! Se requiere verificación 2FA.`,
          `👉 Por favor ingrese el código de 6 dígitos de su aplicación Authenticator.`
        ]);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.status || 'Fallo de autenticación en Puppeteer.');
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
      setError(err.message || 'Error al conectar con Mercado Público.');
      setLogs((prev) => [
        ...prev,
        `❌ Error: ${err.message || 'Fallo de conexión.'}`
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim() || twoFactorCode.trim().length < 6) {
      setError('Por favor ingrese el código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);
    setLogs((prev) => [
      ...prev,
      `🔑 Enviando código 2FA (${twoFactorCode.trim()}) al navegador activo...`
    ]);

    try {
      const response = await fetch('/api/submit-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: twoFactorCode.trim() })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.status || 'Fallo al verificar el código 2FA.');
      }

      setSuccessResult(data);
      setPending2FA(false);
      setLogs((prev) => [
        ...prev,
        `✅ ${data.status || 'Autenticación 2FA exitosa'}!`,
        `📂 Cookies guardadas correctamente.`,
        `📊 Oportunidades extraídas: ${data.count || 0} registros`
      ]);
      await checkSession();
    } catch (err: any) {
      setError(err.message || 'Error al validar el código 2FA.');
      setLogs((prev) => [
        ...prev,
        `❌ Error 2FA: ${err.message || 'Error al enviar código.'}`
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

        {/* Notice instructions */}
        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>Verificación de ClaveÚnica + 2FA</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Ingresa tus credenciales ClaveÚnica. Si tu cuenta posee 2FA activado, el bot solicitará el código de 6 dígitos de tu aplicación Authenticator.
          </p>
        </div>

        {/* 2FA Form or Main Form */}
        {pending2FA ? (
          <form onSubmit={handleSubmit2FA} className="space-y-4 bg-slate-900 p-4 rounded-xl border border-cyan-500/40">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
              <Smartphone className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Código 2FA Requerido (Google Authenticator)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Ingresa los 6 dígitos generados en tu aplicación Authenticator para completar el inicio de sesión.
            </p>
            <div>
              <label className="text-xs font-bold text-cyan-200 block mb-1">
                Código de 6 dígitos
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-cyan-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2.5 text-sm tracking-widest font-mono font-bold border rounded-xl bg-slate-950 text-cyan-300 border-cyan-500/60 focus:border-cyan-400 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setPending2FA(false); setLoading(false); }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Volver a credenciales
              </button>

              <button
                type="submit"
                disabled={loading || twoFactorCode.length < 6}
                className="flex items-center space-x-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verificando 2FA...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Verificar Código 2FA</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
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
                    <span>Conectando...</span>
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
        )}

        {/* Logs Output */}
        {logs.length > 0 && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-1 max-h-36 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
