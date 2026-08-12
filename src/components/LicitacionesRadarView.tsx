import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  Calendar,
  ExternalLink,
  Plus,
  Flame,
  Clock,
  LayoutGrid,
  List,
  Share2,
  Tag,
  Building2,
  Check,
  RefreshCw,
  AlertTriangle,
  Bell,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { LicitacionItem, TipoProceso, AlertaRule, SET_PALABRAS_CLAVE_MASTER } from '../types';
import { openGoogleCalendar } from '../lib/googleCalendar';
import { formatChileDateTime, calculateChileRemainingTime, getItemOfficialUrl, isItemExpired, cleanOfficialId, extractFechaCierre } from '../lib/dateUtils';
import { matchesDeepSearch, matchesAllTagsDeep, matchesFlexibleTipo, cleanTextPrefixes } from '../lib/searchUtils';
import { CreateAlertModal } from './CreateAlertModal';

interface LicitacionesRadarViewProps {
  licitaciones: LicitacionItem[];
  radarFilter7Days?: boolean;
  setRadarFilter7Days?: (val: boolean) => void;
  openAiEvaluator?: (item: LicitacionItem) => void;
  openShareModal?: (item: LicitacionItem) => void;
  onSelectLicitacionAI?: (item: LicitacionItem) => void;
  onAddPostulacion?: (item: LicitacionItem) => void;
  onShareItem?: (item: LicitacionItem) => void;
  onAddAlerta?: (alerta: AlertaRule) => void;
  initial7DaysFilter?: boolean;
  setActiveTab?: (tab: any) => void;
}

const PRESET_KEYWORDS = SET_PALABRAS_CLAVE_MASTER;

export const LicitacionesRadarView: React.FC<LicitacionesRadarViewProps> = ({
  licitaciones,
  openAiEvaluator,
  onSelectLicitacionAI,
  onAddPostulacion,
  onShareItem,
  onAddAlerta,
  initial7DaysFilter = false,
  setActiveTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<TipoProceso | 'TODOS'>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<'ACTIVAS' | 'VENCIDAS' | 'TODAS'>('ACTIVAS');
  const [selectedRange, setSelectedRange] = useState<'30DIAS' | '7DIAS' | 'URGENTES' | 'TODOS'>(
    initial7DaysFilter ? '7DIAS' : '30DIAS'
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [alertModalItem, setAlertModalItem] = useState<LicitacionItem | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const safeLicitaciones = useMemo(() => licitaciones || [], [licitaciones]);

  // Real Counts
  const activasCount = useMemo(() => safeLicitaciones.filter((item) => item && !isItemExpired(item)).length, [safeLicitaciones]);
  const vencidasCount = useMemo(() => safeLicitaciones.filter((item) => item && isItemExpired(item)).length, [safeLicitaciones]);

  const filteredLicitaciones = useMemo(() => {
    return safeLicitaciones.filter((item) => {
      if (!item) return false;
      const expired = isItemExpired(item);

      // Status Filter: ACTIVAS, VENCIDAS, TODAS
      if (selectedStatus === 'ACTIVAS' && expired) {
        return false;
      }
      if (selectedStatus === 'VENCIDAS' && !expired) {
        return false;
      }

      // Search term
      if (searchTerm.trim() && !matchesDeepSearch(item, searchTerm)) {
        return false;
      }

      // Process Type
      if (selectedTipo !== 'TODOS' && !matchesFlexibleTipo(item.tipo, selectedTipo, item.codigo)) {
        return false;
      }

      // Date Range Filter
      if (selectedRange === '7DIAS' && !item.esUltimos7Dias) {
        return false;
      }
      if (selectedRange === 'URGENTES' && (expired || (item.diasRestantes ?? 99) > 3)) {
        return false;
      }

      // Tags filter
      if ((selectedTags || []).length > 0 && !matchesAllTagsDeep(item, selectedTags)) {
        return false;
      }

      return true;
    });
  }, [safeLicitaciones, selectedStatus, searchTerm, selectedTipo, selectedRange, selectedTags]);

  return (
    <div className="space-y-6 pb-12">
      {/* Dynamic Header Title & Count Badges */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded uppercase tracking-wider">
              Radar de Oportunidades
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs font-medium px-2.5 py-0.5 rounded border border-slate-700">
              Mercado Público Chile
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
            Procesos Importantes - {
              selectedRange === '30DIAS'
                ? 'ÚLTIMOS 30 DÍAS'
                : selectedRange === '7DIAS'
                ? 'ÚLTIMOS 7 DÍAS'
                : selectedRange === 'URGENTES'
                ? 'POR VENCER (≤3 DÍAS)'
                : 'CONSOLIDADO COMPLETO'
            }
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Monitoreo en tiempo real con verificación dinámica de vigencia y alertas de vencimiento.
          </p>
        </div>

        {/* Real Status Badges (Activas vs Vencidas) */}
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider">Activas</div>
            <div className="text-base font-black">{activasCount}</div>
          </div>

          <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-2 rounded-xl text-right font-bold">
            <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-end space-x-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>Vencidas</span>
            </div>
            <div className="text-base font-black">{vencidasCount}</div>
          </div>
        </div>
      </div>

      {/* Search Header & Filter Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
            <div className="relative w-full flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                placeholder="Buscar por código, palabra clave, tecnología o cliente..."
                onChange={(e) => {
                  const value = e.target.value;
                  if ((window as any).searchTimeout) clearTimeout((window as any).searchTimeout);
                  (window as any).searchTimeout = setTimeout(() => {
                    setSearchTerm(value);
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

            <button
              onClick={() => {
                if (setActiveTab) {
                  setActiveTab('compradores');
                }
              }}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition shrink-0 w-full sm:w-auto justify-center"
              title="Ir a Cargar Excel Masivo de Compradores"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>📊 Cargar Excel Masivo</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
                }`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
                }`}
                title="Vista Tabla"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Tab Toggle: Activas vs Vencidas */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 mr-1">Estado de Vigencia:</span>
          
          <button
            onClick={() => setSelectedStatus('ACTIVAS')}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
              selectedStatus === 'ACTIVAS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>🟢 Activas ({activasCount})</span>
          </button>

          <button
            onClick={() => setSelectedStatus('VENCIDAS')}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
              selectedStatus === 'VENCIDAS'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>🚨 Vencidas ({vencidasCount})</span>
          </button>

          <button
            onClick={() => setSelectedStatus('TODAS')}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
              selectedStatus === 'TODAS'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span>Todas ({licitaciones.length})</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Tipo selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> Tipo:
            </span>
            {(['TODOS', 'Licitacion', 'Convenio Marco', 'Compra Agil'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setSelectedTipo(tipo)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  selectedTipo === tipo
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tipo === 'TODOS'
                  ? 'Todos'
                  : tipo === 'Compra Agil'
                  ? '⚡ Compra Ágil'
                  : tipo === 'Convenio Marco'
                  ? '🤝 Convenio Marco'
                  : '📋 Licitaciones'}
              </button>
            ))}
          </div>

          {/* Date range filter buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1">Rango:</span>
            
            <button
              onClick={() => setSelectedRange('30DIAS')}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                selectedRange === '30DIAS'
                  ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Últimos 30 Días</span>
            </button>

            <button
              onClick={() => setSelectedRange('7DIAS')}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                selectedRange === '7DIAS'
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Últimos 7 Días</span>
            </button>

            <button
              onClick={() => setSelectedRange('URGENTES')}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                selectedRange === 'URGENTES'
                  ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              <span>Por Vencer (≤3 Días)</span>
            </button>
          </div>
        </div>

        {/* Preset Keywords */}
        <div className="flex items-center space-x-2 pt-1 overflow-x-auto text-xs scrollbar-none">
          <span className="text-slate-400 font-medium whitespace-nowrap">Keywords rápidas:</span>
          {PRESET_KEYWORDS.map((kw) => {
            const active = selectedTags.includes(kw);
            return (
              <button
                key={kw}
                onClick={() => toggleTag(kw)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{kw}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-slate-700">
          Mostrando <strong className="text-blue-600">{filteredLicitaciones.length}</strong> oportunidades ({selectedStatus.toLowerCase()})
        </p>

        {(selectedTipo !== 'TODOS' || selectedStatus !== 'ACTIVAS' || selectedTags.length > 0 || searchTerm) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTipo('TODOS');
              setSelectedStatus('ACTIVAS');
              setSelectedRange('30DIAS');
              setSelectedTags([]);
            }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Restablecer Filtros
          </button>
        )}
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLicitaciones.map((item) => {
            const expired = isItemExpired(item);
            const fc = extractFechaCierre(item) || item.fechaCierre;
            const timeInfo = calculateChileRemainingTime(fc);

            return (
              <div
                key={item.codigo}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden relative ${
                  expired ? 'border-red-300 bg-red-50/20' : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className={`h-1.5 ${expired ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`} />

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                        {cleanOfficialId(item.codigo)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          item.tipo === 'Compra Agil'
                            ? 'bg-purple-100 text-purple-800'
                            : item.tipo === 'Convenio Marco'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.tipo}
                      </span>
                    </div>

                    {expired ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span>🔴 VENCIDA</span>
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          timeInfo.dias <= 3
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        ⏳ {timeInfo.badgeText}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                    {cleanTextPrefixes(item.nombre)}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {cleanTextPrefixes(item.descripcion)}
                  </p>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Organismo:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {item.cliente}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Cierre CLT:</span>
                      <span className={`font-mono font-bold ${expired ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatChileDateTime(fc)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setAlertModalItem(item)}
                      className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-slate-200 transition text-xs font-bold"
                      title="Crear Alerta"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                    </button>

                    <a
                      href={getItemOfficialUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200 transition text-xs font-bold flex items-center space-x-1"
                      title="Ver Ficha Oficial"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ficha</span>
                    </a>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onSelectLicitacionAI(item)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-xs transition"
                    >
                      Evaluar IA
                    </button>
                    {!expired && (
                      <button
                        onClick={() => onAddPostulacion(item)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition"
                      >
                        + Postular
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Código ID</th>
                  <th className="py-3 px-4">Nombre Requerimiento</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">F. Cierre (Chile CLT)</th>
                  <th className="py-3 px-4 text-center">Estado / Restante</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredLicitaciones.map((item) => {
                  const expired = isItemExpired(item);
                  const fc = extractFechaCierre(item) || item.fechaCierre;
                  const timeInfo = calculateChileRemainingTime(fc);

                  return (
                    <tr key={item.codigo} className={`hover:bg-slate-50 transition ${expired ? 'bg-red-50/20' : ''}`}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {cleanOfficialId(item.codigo)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs sm:max-w-md">
                        <p className="line-clamp-2">{cleanTextPrefixes(item.nombre)}</p>
                      </td>
                      <td className="max-w-[220px] truncate pr-4 text-slate-700 font-medium">
                        {item.cliente}
                      </td>
                      <td className="w-[120px] text-left whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700">
                          {item.tipo}
                        </span>
                      </td>
                      <td className={`py-3 px-4 whitespace-nowrap font-mono font-semibold ${expired ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatChileDateTime(fc)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {expired ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                            🔴 VENCIDA (Cerrada)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
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
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg border border-slate-200 transition text-[11px]"
                          >
                            Ficha
                          </a>
                          <button
                            onClick={() => {
                              if (onSelectLicitacionAI) {
                                onSelectLicitacionAI(item);
                              } else if (openAiEvaluator) {
                                openAiEvaluator(item);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg transition text-[11px]"
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
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded-lg transition text-[11px]"
                            >
                              + Postular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
