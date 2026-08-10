import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, User, Lock, Terminal, Loader2, CheckCircle2, AlertTriangle, X, RefreshCw, Smartphone, LogOut } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending2FA, setPending2FA] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<{
    hasSession: boolean;
    isExpired?: boolean;
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

  const handleResetSession = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/mp/session', { method: 'DELETE' });
      setSessionStatus({
        hasSession: false,
        isExpired: false,
        status: 'Sesión reseteada',
        message: 'Sesión previa eliminada. Puede ingresar sus 3 campos para volver a conectar.'
      });
      setSuccessResult(null);
      setPending2FA(false);
      setLogs((prev) => [
        ...prev,
        `🧹 Sesión eliminada (session_mp.json). Formulario habilitado para nueva autenticación.`
      ]);
    } catch {
      setError('No se pudo resetear la sesión');
    } finally {
      setLoading(false);
    }
  };

  // Enviar credenciales completas (RUT + Contraseña + Código Authenticator)
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

    // Borrar explícitamente sesión y cookies previas en cada intento
    try {
      await fetch('/api/mp/session', { method: 'DELETE' });
    } catch {
      // ignore
    }
    
    const initialLogs = [
      `🧹 Eliminadas cookies y sesiones almacenadas previas.`,
      `🚀 Enviando credenciales para RUT: ${rut}...`,
      `🌐 Abriendo navegador Puppeteer e ingresando datos en ClaveÚnica...`
    ];

    if (twoFactorCode.trim()) {
      initialLogs.push(`🔑 Código Authenticator (${twoFactorCode.trim()}) provisto.`);
    }

    setLogs(initialLogs);

    try {
      const response = await fetch('/api/mp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut,
          password,
          code2FA: twoFactorCode.trim(),
          twoFactorCode: twoFactorCode.trim()
        })
      });

      const data = await response.json();

      if (data.require2FA) {
        setPending2FA(true);
        setSessionId(data.sessionId || null);
        setLogs((prev) => [
          ...prev,
          `🔒 Formulario 2FA activo en ClaveÚnica.`,
          `👉 Por favor ingrese el código de 6 dígitos de su Authenticator para continuar.`
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
        `📂 Nueva sesión activa guardada.`,
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

  // Validar 2FA cuando se requiere de manera interactiva posterior
  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim() || twoFactorCode.trim().length < 6) {
      setError('Por favor ingrese el código de 6 dígitos de su Authenticator.');
      return;
    }

    setLoading(true);
    setError(null);
    setLogs((prev) => [
      ...prev,
      `🔑 Enviando código Authenticator (${twoFactorCode.trim()}) a Puppeteer...`
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
        `📂 Nueva sesión guardada en session_mp.json.`,
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

  const isSessionActive = sessionStatus?.hasSession && !sessionStatus?.isExpired;
  const isSessionExpired = sessionStatus?.isExpired;

  const bannerBg = isSessionActive
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : isSessionExpired
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-slate-100 border-slate-200 text-slate-800';

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
                Autenticación Directa con ClaveÚnica + Authenticator
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current session status banner */}
        {sessionStatus && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${bannerBg}`}>
            <div className="flex items-center space-x-2">
              {isSessionActive ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : isSessionExpired ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
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
            <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
              <button
                type="button"
                onClick={checkSession}
                disabled={loading}
                className="p-1.5 hover:bg-black/5 rounded text-xs font-semibold"
                title="Actualizar estado de sesión"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {(sessionStatus.hasSession || sessionStatus.lastUpdated || sessionStatus.status?.includes('Éxito')) && (
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={loading}
                  className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition"
                  title="Cerrar sesión y borrar cookies"
                >
                  <LogOut className="w-3 h-3 text-rose-600" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notice instructions */}
        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>Inicio de Sesión Mercado Público</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Ingresa tu RUT, Contraseña y el Código Authenticator de 6 dígitos. El bot eliminará cookies guardadas, ingresará las credenciales y completará la verificación 2FA automáticamente.
          </p>
        </div>

        {/* Formulario */}
        {pending2FA ? (
          <form onSubmit={handleSubmit2FA} className="space-y-4 bg-slate-900 p-5 rounded-xl border border-cyan-500/50 shadow-lg">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
              <Smartphone className="w-5 h-5 text-cyan-400 animate-pulse flex-shrink-0" />
              <span>Ingrese el código de 6 dígitos de su Authenticator</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              El portal ClaveÚnica requiere el token de verificación. Abre tu aplicación Authenticator e ingresa los 6 dígitos.
            </p>
            <div>
              <label className="text-xs font-bold text-cyan-200 block mb-1">
                Código Authenticator (6 dígitos)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3.5 text-cyan-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-3 text-base tracking-widest font-mono font-bold border rounded-xl bg-slate-950 text-white border-cyan-500/70 focus:border-cyan-400 focus:outline-none shadow-inner placeholder:text-slate-400 [caret-color:white]"
                  style={{ color: '#ffffff', caretColor: '#ffffff', WebkitTextFillColor: '#ffffff' }}
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
                ← Volver
              </button>

              <button
                type="submit"
                disabled={loading || twoFactorCode.length < 6}
                className="flex items-center space-x-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Validando 2FA...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Validar 2FA</span>
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
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:outline-none"
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
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold border rounded-xl bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Código Authenticator (6 dígitos)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-3 text-cyan-400" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold tracking-wider border rounded-xl bg-slate-900 text-white border-slate-700 focus:border-cyan-500 focus:outline-none placeholder:text-slate-400 [caret-color:white]"
                  style={{ color: '#ffffff', caretColor: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ingresa el código actual de tu app Authenticator para que el bot complete el 2FA automáticamente.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-3 border-t">
              <button
                type="button"
                onClick={handleResetSession}
                disabled={loading}
                className="flex items-center space-x-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-lg transition"
                title="Elimina cookies y resetea el estado"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión / Resetear</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-2"
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
