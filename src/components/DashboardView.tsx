import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  Briefcase,
  TrendingUp,
  Calendar,
  ExternalLink,
  ChevronRight,
  Plus,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Share2,
  CheckCircle2,
  Zap,
  Table,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Bell,
  AlertTriangle
} from 'lucide-react';
import { LicitacionItem, Postulacion, AlertaRule, OrdenCompraItem } from '../types';
import { openGoogleCalendar } from '../lib/googleCalendar';
import { formatChileDateTime, calculateChileRemainingTime, getItemOfficialUrl, isItemExpired, cleanOfficialId, extractFechaCierre } from '../lib/dateUtils';
import { matchesDeepSearch, matchesFlexibleTipo, cleanTextPrefixes } from '../lib/searchUtils';
import { CreateAlertModal } from './CreateAlertModal';

interface DashboardViewProps {
  licitaciones: LicitacionItem[];
  postulaciones: Postulacion[];
  ordenesCompra?: OrdenCompraItem[];
  setActiveTab?: (tab: any) => void;
  setRadarFilter7Days?: (val: boolean) => void;
  onSelectLicitacionAI?: (item: LicitacionItem) => void;
  onAddPostulacion?: (item: LicitacionItem) => void;
  onNavigateToRadar?: (filter7Days?: boolean) => void;
  openReportsModal?: () => void;
  openShareModal?: () => void;
  openAuthModal?: () => void;
  onAddAlerta?: (alerta: AlertaRule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  licitaciones,
  postulaciones,
  setActiveTab,
  onSelectLicitacionAI,
  onAddPostulacion,
  onNavigateToRadar,
  openReportsModal,
  onAddAlerta
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [tableTipo, setTableTipo] = useState<string>('TODOS');
  const [tableStatus, setTableStatus] = useState<'ACTIVAS' | 'VENCIDAS' | 'TODAS'>('ACTIVAS');
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [alertModalItem, setAlertModalItem] = useState<LicitacionItem | null>(null);

  const safeLicitaciones = useMemo(() => licitaciones || [], [licitaciones]);
  const safePostulaciones = useMemo(() => postulaciones || [], [postulaciones]);

  // Compute Stats dynamically with isItemExpired
  const activas = useMemo(() => safeLicitaciones.filter((item) => item && !isItemExpired(item)), [safeLicitaciones]);
  const vencidas = useMemo(() => safeLicitaciones.filter((item) => item && isItemExpired(item)), [safeLicitaciones]);

  const ultimos7Dias = useMemo(() => activas.filter((item) => item?.esUltimos7Dias), [activas]);
  const urgentes = useMemo(() => activas.filter((item) => (item?.diasRestantes ?? 99) <= 3 && (item?.diasRestantes ?? -1) >= 0), [activas]);
  const postulacionesEnCurso = useMemo(() => safePostulaciones.filter((p) => p && p.estadoPostulacion !== 'Adjudicada' && p.estadoPostulacion !== 'Desestimada'), [safePostulaciones]);

  const montoTotalLicitado = useMemo(() => activas.reduce((acc, curr) => acc + (curr?.montoEstimadoClp || 0), 0), [activas]);

  // Filter table items by tableStatus
  const filteredTableItems = useMemo(() => {
    return safeLicitaciones.filter((item) => {
      if (!item) return false;
      const expired = isItemExpired(item);
      if (tableStatus === 'ACTIVAS' && expired) return false;
      if (tableStatus === 'VENCIDAS' && !expired) return false;

      if (tableSearch.trim() && !matchesDeepSearch(item, tableSearch)) {
        return false;
      }
      if (tableTipo !== 'TODOS' && !matchesFlexibleTipo(item.tipo, tableTipo, item.codigo)) {
        return false;
      }
      return true;
    });
  }, [safeLicitaciones, tableStatus, tableSearch, tableTipo]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Welcome */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-blue-900/40 overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-cyan-300 text-xs font-semibold px-3 py-1 rounded-full border border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sincronización Inteligente Mercado Público Chile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Centro de Monitoreo & Oportunidades Licitatorias
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Detección automatizada de Licitaciones, Convenio Marco y Compra Ágil.
              Los procesos de los <strong className="text-amber-300">últimos 30 días</strong> se destacan como alta prioridad con verificación dinámica de fechas de cierre.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openReportsModal}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg transition transform active:scale-95"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Exportar Reportes</span>
            </button>

            <button
              onClick={() => {
                if (setActiveTab) {
                  setActiveTab('compradores');
                } else if (onNavigateToRadar) {
                  onNavigateToRadar(false);
                }
              }}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg transition transform active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Cargar CSV / Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Activas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Oportunidades Activas
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{activas.length}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200">
              🟢 Vigentes
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Excluye licitaciones vencidas o cerradas</p>
        </div>

        {/* Stat 2: Vencidas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Oportunidades Vencidas
            </span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-600">{vencidas.length}</span>
            <span className="text-xs font-bold text-rose-700 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-md">
              🚨 Expiradas
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Fecha de cierre cumplida (&lt; 0 días)</p>
        </div>

        {/* Stat 3: Por Vencer (≤3 Días) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Por Vencer (≤3 Días)
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-amber-600">{urgentes.length}</span>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              Cierre Inminente
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Requieren propuesta inmediata</p>
        </div>

        {/* Stat 4: Monto Estimado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monto Estimado Licitado
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">
              ${(montoTotalLicitado / 1000000).toFixed(0)}M
            </span>
            <span className="text-xs text-slate-500">CLP Aprox.</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{postulacionesEnCurso.length} postulaciones en cartera</p>
        </div>
      </div>

      {/* Vista de Tabla Interactiva / Lista de Oportunidades Extraídas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">
                  Oportunidades Extraídas (Vista de Tabla)
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {activas.length} Activas
                </span>
                {vencidas.length > 0 && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    🚨 {vencidas.length} Vencidas
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Listado consolidado de oportunidades con filtro dinámico por estado de vigencia
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              {isTableExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Contraer Tabla</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Expandir Tabla</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isTableExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Table Filters bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative w-full max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Buscar por ID, nombre u organismo..."
                  onChange={(e) => {
                    const value = e.target.value;
                    if ((window as any).searchTimeout) clearTimeout((window as any).searchTimeout);
                    (window as any).searchTimeout = setTimeout(() => {
                      setTableSearch(value);
                    }, 300);
                  }}
                  style={{
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    caretColor: '#0f172a',
                    WebkitTextFillColor: '#0f172a',
                    opacity: 1
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1 bg-white border border-slate-300 p-1 rounded-lg">
                  <button
                    onClick={() => setTableStatus('ACTIVAS')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                      tableStatus === 'ACTIVAS' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Activas ({activas.length})
                  </button>
                  <button
                    onClick={() => setTableStatus('VENCIDAS')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                      tableStatus === 'VENCIDAS' ? 'bg-red-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Vencidas ({vencidas.length})
                  </button>
                  <button
                    onClick={() => setTableStatus('TODAS')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                      tableStatus === 'TODAS' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Todas ({licitaciones.length})
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={tableTipo}
                    onChange={(e) => setTableTipo(e.target.value)}
                    className="text-xs font-semibold border border-slate-300 rounded-lg bg-white px-3 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TODOS">Todos los Tipos</option>
                    <option value="Licitacion Publica">Licitación Pública</option>
                    <option value="Convenio Marco">Convenio Marco</option>
                    <option value="Compra Agil">Compra Ágil</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table View */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">ID (Código)</th>
                    <th className="py-3 px-4">Nombre</th>
                    <th className="py-3 px-4">Organismo</th>
                    <th className="py-3 px-4">Tipo de Compra</th>
                    <th className="py-3 px-4">F. Cierre (Chile CLT)</th>
                    <th className="py-3 px-4 text-center">Estado / Restante</th>
                    <th className="py-3 px-4 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredTableItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                        No se encontraron oportunidades en este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredTableItems.map((item) => {
                      const expired = isItemExpired(item);
                      const fc = extractFechaCierre(item) || item.fechaCierre;
                      const timeInfo = calculateChileRemainingTime(fc);
                      return (
                        <tr
                          key={item.codigo}
                          className={`hover:bg-slate-100/90 transition-colors duration-200 ${expired ? 'bg-red-50/20' : ''}`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {cleanOfficialId(item.codigo)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs sm:max-w-md">
                            <p className="line-clamp-2" title={cleanTextPrefixes(item.nombre)}>
                              {cleanTextPrefixes(item.nombre)}
                            </p>
                          </td>
                          <td className="max-w-[220px] truncate pr-4 text-slate-700 font-medium">
                            {item.cliente}
                          </td>
                          <td className="w-[120px] text-left whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md ${
                                item.tipo === 'Compra Agil'
                                  ? 'bg-purple-100 text-purple-800'
                                  : item.tipo === 'Convenio Marco'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {item.tipo}
                            </span>
                          </td>
                          <td className={`py-3 px-4 whitespace-nowrap font-mono font-semibold text-xs ${expired ? 'text-red-600' : 'text-slate-800'}`}>
                            {formatChileDateTime(fc)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {expired ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full font-bold text-xs bg-red-500/10 text-red-600 border border-red-500/20">
                                🔴 VENCIDA (Cerrada)
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full font-bold text-xs ${
                                  timeInfo.dias <= 3
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                ⏳ {timeInfo.badgeText}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <a
                                href={getItemOfficialUrl(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg border border-slate-200 transition text-[11px]"
                              >
                                <span>Ficha</span>
                              </a>

                              <button
                                onClick={() => onSelectLicitacionAI?.(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg font-bold text-[11px] transition shadow-xs"
                              >
                                Evaluar IA
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAlertModalItem(item);
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition-colors"
                              >
                                🔔 Alerta
                              </button>

                              {!expired && (
                                <button
                                  onClick={() => onAddPostulacion?.(item)}
                                  className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1 rounded-lg font-bold text-[11px] transition"
                                >
                                  + Postular
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Section: PROCESOS DESTACADOS ÚLTIMOS 7 DÍAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">
              Procesos Importantes - ÚLTIMOS 7 DÍAS
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Prioridad
            </span>
          </div>

          <button
            onClick={() => onNavigateToRadar(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>Ver todos en Radar ({ultimos7Dias.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ultimos7Dias.slice(0, 6).map((item) => {
            const fc = extractFechaCierre(item) || item.fechaCierre;
            const timeInfo = calculateChileRemainingTime(fc);
            return (
              <div
                key={item.codigo}
                className="bg-white rounded-2xl border border-amber-200/80 shadow-sm hover:shadow-md hover:border-amber-400 transition flex flex-col justify-between overflow-hidden relative"
              >
                <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                        {cleanOfficialId(item.codigo)}
                      </span>
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
                        {item.tipo}
                      </span>
                    </div>

                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2 py-0.5 rounded-full">
                      ⏳ {timeInfo.badgeText}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                    {cleanTextPrefixes(item.nombre)}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {cleanTextPrefixes(item.descripcion)}
                  </p>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
                    <span>Organismo:</span>
                    <strong className="text-slate-800 truncate max-w-[180px]">{item.cliente}</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={getItemOfficialUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-700 font-bold hover:underline flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver Ficha</span>
                  </a>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onSelectLicitacionAI?.(item)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1 rounded-lg"
                    >
                      Evaluar IA
                    </button>
                    <button
                      onClick={() => onAddPostulacion?.(item)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-2.5 py-1 rounded-lg"
                    >
                      + Postular
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Alert Modal */}
      {alertModalItem && onAddAlerta && (
        <CreateAlertModal
          licitacion={alertModalItem}
          onClose={() => setAlertModalItem(null)}
          onSave={onAddAlerta}
        />
      )}
    </div>
  );
};
