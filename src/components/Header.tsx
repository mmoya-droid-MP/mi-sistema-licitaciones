import React from 'react';
import {
  LayoutDashboard,
  Search,
  Kanban,
  CalendarDays,
  Bell,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Share2,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { AlertaNotificacion } from '../types';

interface HeaderProps {
  activeTab: 'dashboard' | 'radar' | 'ordenescompra' | 'oc' | 'postulaciones' | 'calendar' | 'compradores' | 'alertas' | 'alerts' | 'historial-ia';
  setActiveTab: (tab: any) => void;
  notificaciones: AlertaNotificacion[];
  setNotificaciones?: React.Dispatch<React.SetStateAction<AlertaNotificacion[]>>;
  onMarkAllNotifsRead?: () => void;
  openSettings?: () => void;
  openReportsModal?: () => void;
  openShareModal?: () => void;
  openAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  notificaciones,
  onMarkAllNotifsRead,
  openSettings,
  openReportsModal,
  openShareModal,
  openAuthModal
}) => {
  const unreadCount = (notificaciones || []).filter((n) => n && !n.leida).length;

  const handleAlertsClick = () => {
    setActiveTab('alertas');
    if (onMarkAllNotifsRead) {
      onMarkAllNotifsRead();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between py-3 gap-3">
          {/* Brand / Logo */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-bold text-lg tracking-tight text-white">Centro de Monitoreo & Oportunidades</span>
                <span className="bg-blue-500/20 text-cyan-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Bot & Radar
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Licitaciones • Convenio Marco • Compra Ágil Chile
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex flex-wrap items-center gap-1.5 w-full xl:w-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Panel</span>
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'radar'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Buscador Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('ordenescompra')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'ordenescompra' || activeTab === 'oc'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Órdenes de Compra</span>
            </button>

            <button
              onClick={() => setActiveTab('postulaciones')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'postulaciones'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Mis Postulaciones</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Calendario & Google Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('compradores')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'compradores'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Directorio Compradores</span>
            </button>

            <button
              onClick={() => setActiveTab('historial-ia')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'historial-ia'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Historial IA</span>
            </button>

            <button
              onClick={handleAlertsClick}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'alertas'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Alertas</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-bold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile Tab bar */}
      <div className="md:hidden flex overflow-x-auto bg-slate-950 px-2 py-1.5 border-t border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'dashboard' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          Panel
        </button>
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'radar' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          Buscador
        </button>
        <button
          onClick={() => setActiveTab('postulaciones')}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'postulaciones' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          Postulaciones
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'calendar' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          Calendario
        </button>
        <button
          onClick={() => setActiveTab('historial-ia')}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'historial-ia' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          IA
        </button>
        <button
          onClick={handleAlertsClick}
          className={`flex-1 py-1.5 px-2 text-center whitespace-nowrap rounded ${
            activeTab === 'alertas' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400'
          }`}
        >
          Alertas ({unreadCount})
        </button>
      </div>
    </header>
  );
};
