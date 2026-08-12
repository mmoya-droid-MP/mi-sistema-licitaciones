import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  ExternalLink,
  Building2,
  CheckCircle2,
  FileCheck2,
  Search,
  Filter
} from 'lucide-react';
import { LicitacionItem, Postulacion, OrdenCompraItem } from '../types';
import { openGoogleCalendar, downloadICSFile } from '../lib/googleCalendar';
import { formatChileDateTime, calculateChileRemainingTime, getItemOfficialUrl, cleanOfficialId, extractFechaCierre } from '../lib/dateUtils';
import { matchesDeepSearch, cleanTextPrefixes } from '../lib/searchUtils';

interface CalendarViewProps {
  licitaciones?: LicitacionItem[];
  postulaciones: Postulacion[];
  ordenesCompra?: OrdenCompraItem[];
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  licitaciones,
  postulaciones,
  ordenesCompra = []
}) => {
  // Navigation State: Year & Month (Default: August 2026)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 1)); // August 2026
  const [filterMode, setFilterMode] = useState<'all' | 'postulaciones' | 'ordenes'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth(); // 0-11

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 1)); // August 2026 as simulated current period
  };

  // Calendar Math
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const firstDayOffset = useMemo(() => {
    const day = new Date(selectedYear, selectedMonth, 1).getDay();
    // Monday as first day: Sun (0) -> 6, Mon (1) -> 0, Tue (2) -> 1 ...
    return (day + 6) % 7;
  }, [selectedYear, selectedMonth]);

  // Group events by day of selected month
  const eventsByDay = useMemo(() => {
    const map: Record<number, { title: string; code: string; type: string; dateStr: string; item: any; updated?: boolean; isOC?: boolean }[]> = {};

    const safeLicitaciones = licitaciones || [];
    const safePostulaciones = postulaciones || [];
    const safeOrdenes = ordenesCompra || [];

    if (filterMode === 'ordenes') {
      safeOrdenes.forEach((oc) => {
        try {
          const dateStr = oc.fechaEnvio || oc.fechaCreacion;
          const d = new Date(dateStr);
          if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
            const day = d.getDate();
            if (!map[day]) map[day] = [];

            if (searchQuery.trim() && !matchesDeepSearch(oc, searchQuery)) {
              return;
            }

            map[day].push({
              title: `${oc.cliente}: ${oc.nombre}`,
              code: oc.codigo,
              type: 'Orden de Compra',
              dateStr: `$${(oc.montoClp / 1000000).toFixed(1)}M CLP`,
              item: oc,
              isOC: true
            });
          }
        } catch {
          // ignore
        }
      });
    } else {
      const itemsToProcess = filterMode === 'postulaciones'
        ? safeLicitaciones.filter((l) => safePostulaciones.some((p) => p && p.codigoLicitacion === l.codigo))
        : safeLicitaciones;

      itemsToProcess.forEach((item) => {
        try {
          if (!item) return;
          const fc = extractFechaCierre(item) || item.fechaCierre;
          const d = new Date(fc);
          if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
            const day = d.getDate();
            if (!map[day]) map[day] = [];

            if (searchQuery.trim() && !matchesDeepSearch(item, searchQuery)) {
              return;
            }

            map[day].push({
              title: item.nombre,
              code: cleanOfficialId(item.codigo),
              type: item.tipo,
              dateStr: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
              item: item,
              updated: item.fechaActualizada,
              isOC: false
            });
          }
        } catch {
          // ignore
        }
      });
    }

    return map;
  }, [licitaciones, postulaciones, ordenesCompra, filterMode, selectedYear, selectedMonth, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <CalendarDays className="w-6 h-6 text-blue-600" />
              <span>Navegación en Calendario por Bloques de 30 Días</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Programación de cierres de licitación, cotizaciones y emisión de Órdenes de Compra (OC) sincronizadas con Google Calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'all' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-600'
              }`}
            >
              Todas las Oportunidades ({(licitaciones || []).length})
            </button>
            <button
              onClick={() => setFilterMode('postulaciones')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'postulaciones' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-600'
              }`}
            >
              Mis Postulaciones ({postulaciones.length})
            </button>
            <button
              onClick={() => setFilterMode('ordenes')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterMode === 'ordenes' ? 'bg-emerald-600 text-white font-bold shadow' : 'text-slate-600'
              }`}
            >
              Órdenes de Compra ({ordenesCompra.length})
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Control Bar & Month Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition shadow-2xs"
                title="Bloque de 30 Días Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-xs font-bold text-blue-700 hover:bg-white rounded-lg transition"
              >
                Hoy
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition shadow-2xs"
                title="Siguiente Bloque de 30 Días"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <span className="text-xl font-black text-slate-900 tracking-tight">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>

            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              Sincronización Google Calendar
            </span>
          </div>

          {/* Quick Search inside Calendar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por ID, cliente o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center space-x-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-1.5" /> Licitación / Cierre
          </span>
          <span className="flex items-center font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mr-1.5" /> Órdenes de Compra (OC)
          </span>
          <span className="flex items-center font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" /> Fecha Actualizada
          </span>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center font-bold text-xs text-slate-600 py-2 border-b border-slate-200 uppercase tracking-wider">
          <div>Lunes</div>
          <div>Martes</div>
          <div>Miércoles</div>
          <div>Jueves</div>
          <div>Viernes</div>
          <div>Sábado</div>
          <div>Domingo</div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Offset empty cells */}
          {Array.from({ length: firstDayOffset }).map((_, idx) => (
            <div key={`offset-${idx}`} className="min-h-[105px] bg-slate-50/40 rounded-xl border border-dashed border-slate-200/60" />
          ))}

          {/* Days of Month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayEvents = eventsByDay[dayNum] || [];
            const isToday = dayNum === 7 && selectedMonth === 7 && selectedYear === 2026;

            return (
              <div
                key={`day-${dayNum}`}
                className={`min-h-[105px] p-2 rounded-xl border flex flex-col justify-between text-xs transition ${
                  isToday
                    ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/30'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className={isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' : ''}>
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.2 rounded-full">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 my-1 overflow-y-auto max-h-[75px] scrollbar-none">
                  {dayEvents.map((ev, evIdx) => (
                    <div
                      key={evIdx}
                      onClick={() => !ev.isOC && openGoogleCalendar(ev.item)}
                      className={`p-1.5 rounded border text-[10px] cursor-pointer font-semibold transition hover:scale-102 ${
                        ev.isOC
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : ev.updated
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-blue-50 border-blue-200 text-blue-900 shadow-2xs'
                      }`}
                      title={ev.isOC ? `Orden de Compra: ${ev.title}` : `Agregar a Google Calendar: ${ev.title}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold truncate">{ev.code}</span>
                        <span className="text-[9px] font-bold">{ev.dateStr}</span>
                      </div>
                      <p className="line-clamp-1 font-normal text-slate-700 mt-0.5">{ev.title}</p>
                    </div>
                  ))}
                </div>

                <div className="text-[9px] text-slate-400 font-medium text-right">
                  {isToday ? 'Hoy' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span>Próximos Hitos del Mes de {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
        </h3>

        <div className="divide-y divide-slate-100">
          {licitaciones
            .filter((item) => {
              const fc = extractFechaCierre(item) || item.fechaCierre;
              const d = new Date(fc);
              return !isNaN(d.getTime()) && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
            })
            .map((item) => {
              const fc = extractFechaCierre(item) || item.fechaCierre;
              const timeInfo = calculateChileRemainingTime(fc);
              return (
                <div
                  key={item.codigo}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 px-3 rounded-xl transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                        {cleanOfficialId(item.codigo)}
                      </span>
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        Cierre: {formatChileDateTime(fc)}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          timeInfo.expirada
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        ⏳ {timeInfo.badgeText}
                      </span>
                    </div>

                    <h4 className="font-semibold text-slate-900 text-sm">{cleanTextPrefixes(item.nombre)}</h4>
                    <p className="text-xs text-slate-500">{item.cliente}</p>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => downloadICSFile(item)}
                      className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition"
                      title="Descargar archivo .ics"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Descargar .ics</span>
                    </button>

                    <button
                      onClick={() => openGoogleCalendar(item)}
                      className="flex items-center space-x-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Google Calendar</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
