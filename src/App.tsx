import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LicitacionesRadarView } from './components/LicitacionesRadarView';
import { PostulacionesPipelineView } from './components/PostulacionesPipelineView';
import { CalendarView } from './components/CalendarView';
import { AlertsView } from './components/AlertsView';
import { CompradoresView } from './components/CompradoresView';
import { AIEvaluatorModal } from './components/AIEvaluatorModal';
import { ShareModal } from './components/ShareModal';
import { ReportsModal } from './components/ReportsModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { AuthModal } from './components/AuthModal';
import { OrdenesCompraView } from './components/OrdenesCompraView';
import {
  INITIAL_LICITACIONES,
  INITIAL_POSTULACIONES,
  INITIAL_ALERTAS,
  INITIAL_NOTIFICACIONES,
  INITIAL_ORDENES_COMPRA
} from './data/mockData';
import { LicitacionItem, Postulacion, AlertaRule, AlertaNotificacion, OrdenCompraItem, TipoProceso } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'radar' | 'ordenescompra' | 'oc' | 'postulaciones' | 'calendar' | 'compradores' | 'alertas' | 'alerts'>('dashboard');

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

  // Consultar la API /api/opportunities al montar el componente y fusionar con INITIAL_LICITACIONES
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const res = await fetch('/api/opportunities');
        if (res.ok) {
          const json = await res.json();
          const rawItems = Array.isArray(json) ? json : (json.data || json.opportunities || []);
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            const mappedLicitaciones: LicitacionItem[] = rawItems.map((opp: any) => {
              const code = opp.code || opp.id || 'S/I';
              const name = opp.title || opp.name || 'Orden de Compra Mercado Público';
              const typeRaw = String(opp.type || opp.tipo || '').toLowerCase();
              const codeUpper = String(code).toUpperCase();
              const nameUpper = String(name).toUpperCase();

              let inferredTipo: TipoProceso = 'Licitacion';
              if (typeRaw.includes('convenio') || typeRaw.includes('marco') || codeUpper.startsWith('CM-') || nameUpper.includes('CONVENIO MARCO')) {
                inferredTipo = 'Convenio Marco';
              } else if (typeRaw.includes('agil') || typeRaw.includes('cot') || codeUpper.includes('-COT') || nameUpper.includes('COMPRA AGIL') || nameUpper.includes('COMPRA ÁGIL')) {
                inferredTipo = 'Compra Agil';
              } else {
                inferredTipo = 'Licitacion';
              }

              const rawClosure = opp.closingDate || opp.endDate;
              const isFuture = rawClosure && new Date(rawClosure).getTime() > Date.now();
              const validClosureDate = isFuture
                ? rawClosure
                : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

              return {
                codigo: code,
                cliente: opp.buyer || opp.organism || opp.institution || 'Organismo Comprador',
                nombre: name,
                descripcion: `Organismo: ${opp.organism || opp.buyer || ''} | Unidad: ${opp.institution || ''} | Contacto: ${opp.contactName || ''} (${opp.contactRole || ''}) - Email: ${opp.contactEmail || ''} - Tel: ${opp.contactPhone || ''} - Comuna: ${opp.location || ''}`,
                tipo: inferredTipo,
                montoEstimadoClp: opp.amount || 0,
                fechaPublicacion: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                fechaCierre: validClosureDate,
                diasRestantes: 15,
                estado: 'Publicada',
                url: `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${code}`,
                esUltimos7Dias: true,
                tags: ['Mercado Público', opp.location].filter(Boolean) as string[],
                region: opp.location || 'Región Metropolitana de Santiago'
              };
            });

            // Combinar con INITIAL_LICITACIONES manteniendo las 3 modalidades completas
            setLicitaciones((prev) => {
              const catalogMap = new Map<string, LicitacionItem>();
              // Cargar catálogo inicial dinámico
              INITIAL_LICITACIONES.forEach((item) => catalogMap.set(item.codigo, item));
              // Anteponer o sobreescribir con las oportunidades de la API
              mappedLicitaciones.forEach((item) => catalogMap.set(item.codigo, item));
              return Array.from(catalogMap.values());
            });
          }
        }
      } catch (err) {
        console.warn("Error cargando oportunidades desde /api/opportunities:", err);
      }
    };

    fetchOpportunities();
  }, []);

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
        openSettings={() => setShowSettingsModal(true)}
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
            setActiveTab={setActiveTab}
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

        {activeTab === 'compradores' && (
          <CompradoresView />
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
              notas: 'Añadido desde Evaluación IA Gemini',
              checklist: [],
              historial: [],
              updatedAt: new Date().toISOString()
            };
            setPostulaciones((prev) => [newPostulacion, ...prev]);
            setActiveTab('postulaciones');
          }}
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
        <SystemSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}