import React, { useState } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LicitacionesRadarView } from './components/LicitacionesRadarView';
import { PostulacionesPipelineView } from './components/PostulacionesPipelineView';
import { CalendarView } from './components/CalendarView';
import { AlertsView } from './components/AlertsView';
import { AIEvaluatorModal } from './components/AIEvaluatorModal';
import { ShareModal } from './components/ShareModal';
import { ReportsModal } from './components/ReportsModal';
import { TicketSettingsModal } from './components/TicketSettingsModal';
import { AuthModal } from './components/AuthModal';
import { OrdenesCompraView } from './components/OrdenesCompraView';
import {
  INITIAL_LICITACIONES,
  INITIAL_POSTULACIONES,
  INITIAL_ALERTAS,
  INITIAL_NOTIFICACIONES,
  INITIAL_ORDENES_COMPRA
} from './data/mockData';
import { LicitacionItem, Postulacion, AlertaRule, AlertaNotificacion, OrdenCompraItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'radar' | 'ordenescompra' | 'oc' | 'postulaciones' | 'calendar' | 'alertas' | 'alerts'>('dashboard');

  const [licitaciones, setLicitaciones] = useState<LicitacionItem[]>(INITIAL_LICITACIONES);
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>(INITIAL_POSTULACIONES);
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompraItem[]>(INITIAL_ORDENES_COMPRA);
  const [alertas, setAlertas] = useState<AlertaRule[]>(INITIAL_ALERTAS);
  const [notificaciones, setNotificaciones] = useState<AlertaNotificacion[]>(INITIAL_NOTIFICACIONES);

  // Modals state
  const [aiEvaluatorItem, setAiEvaluatorItem] = useState<LicitacionItem | null>(null);
  const [shareItem, setShareItem] = useState<LicitacionItem | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportData, setReportData] = useState<any[] | undefined>(undefined);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [radarFilter7Days, setRadarFilter7Days] = useState(false);

  const handleOpenReportsModal = (type?: string, data?: any[]) => {
    setReportData(data);
    setShowReportsModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificaciones={notificaciones}
        setNotificaciones={setNotificaciones}
        openAuthModal={() => setShowAuthModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            licitaciones={licitaciones}
            postulaciones={postulaciones}
            ordenesCompra={ordenesCompra}
            setActiveTab={setActiveTab}
            setRadarFilter7Days={setRadarFilter7Days}
            onSelectLicitacionAI={(item) => setAiEvaluatorItem(item)}
            onAddPostulacion={(item) => {
              const newPostulacion: Postulacion = {
                id: `post-${Date.now()}`,
                codigoLicitacion: item.codigo,
                licitacionNombre: item.nombre,
                cliente: item.cliente,
                tipo: item.tipo,
                url: item.url,
                montoOfertaClp: item.montoEstimadoClp,
                estadoPostulacion: 'Preparando',
                responsable: 'Equipo Licitaciones',
                fechaCierreOriginal: item.fechaCierre,
                fechaLimiteInterna: item.fechaCierre,
                notas: 'Postulación creada desde Dashboard',
                checklist: [],
                historial: [],
                updatedAt: new Date().toISOString()
              };
              setPostulaciones((prev) => [newPostulacion, ...prev]);
              setActiveTab('postulaciones');
            }}
            onNavigateToRadar={(filter7Days) => {
              if (filter7Days !== undefined) setRadarFilter7Days(filter7Days);
              setActiveTab('radar');
            }}
            openReportsModal={() => handleOpenReportsModal('dashboard')}
            openShareModal={() => setShowShareModal(true)}
            openAuthModal={() => setShowAuthModal(true)}
            onAddAlerta={(alerta) => setAlertas((prev) => [alerta, ...prev])}
          />
        )}

        {activeTab === 'radar' && (
          <LicitacionesRadarView
            licitaciones={licitaciones}
            radarFilter7Days={radarFilter7Days}
            setRadarFilter7Days={setRadarFilter7Days}
            openAiEvaluator={(item) => setAiEvaluatorItem(item)}
            onSelectLicitacionAI={(item) => setAiEvaluatorItem(item)}
            onAddPostulacion={(item) => {
              const newPostulacion: Postulacion = {
                id: `post-${Date.now()}`,
                codigoLicitacion: item.codigo,
                licitacionNombre: item.nombre,
                cliente: item.cliente,
                tipo: item.tipo,
                url: item.url,
                montoOfertaClp: item.montoEstimadoClp,
                estadoPostulacion: 'Preparando',
                responsable: 'Equipo Licitaciones',
                fechaCierreOriginal: item.fechaCierre,
                fechaLimiteInterna: item.fechaCierre,
                notas: 'Postulación creada desde Radar',
                checklist: [],
                historial: [],
                updatedAt: new Date().toISOString()
              };
              setPostulaciones((prev) => [newPostulacion, ...prev]);
              setActiveTab('postulaciones');
            }}
            openShareModal={(item) => {
              setShareItem(item);
              setShowShareModal(true);
            }}
            onAddAlerta={(alerta) => setAlertas((prev) => [alerta, ...prev])}
          />
        )}

        {(activeTab === 'ordenescompra' || activeTab === 'oc') && (
          <OrdenesCompraView
            ordenesCompra={ordenesCompra && ordenesCompra.length > 0 ? ordenesCompra : INITIAL_ORDENES_COMPRA}
            openReportsModal={(type, data) => handleOpenReportsModal('ordenescompra', data || ordenesCompra)}
          />
        )}

        {activeTab === 'postulaciones' && (
          <PostulacionesPipelineView
            postulaciones={postulaciones}
            setPostulaciones={setPostulaciones}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView postulaciones={postulaciones} />
        )}

        {(activeTab === 'alerts' || activeTab === 'alertas') && (
          <AlertsView
            alertas={alertas}
            setAlertas={setAlertas}
          />
        )}
      </main>

      {/* Modales globales */}
      {aiEvaluatorItem && (
        <AIEvaluatorModal
          item={aiEvaluatorItem}
          onClose={() => setAiEvaluatorItem(null)}
        />
      )}

      {showShareModal && shareItem && (
        <ShareModal
          item={shareItem}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showReportsModal && (
        <ReportsModal
          licitaciones={licitaciones}
          postulaciones={postulaciones}
          ordenesCompra={ordenesCompra}
          data={reportData}
          onClose={() => {
            setShowReportsModal(false);
            setReportData(undefined);
          }}
        />
      )}

      {showSettingsModal && (
        <TicketSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}