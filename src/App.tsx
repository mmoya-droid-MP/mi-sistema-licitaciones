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
            const mappedLicitaciones: LicitacionItem[] = rawItems
              .map((opp: any): LicitacionItem | null => {
              const cleanStr = (v: any) => (v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim());

              // ID: row['ID COTIZACIÓN'] || row['id_cotizacion'] || row['numero_de_la_orden_de_compra']
              const code = cleanStr(
                opp['ID COTIZACIÓN'] || opp['ID COTIZACION'] || opp.id_cotizacion || opp.ID_COTIZACION ||
                opp.code || opp.id || opp.numero_de_la_orden_de_compra || opp.numero_orden_compra
              );

              // Nombre: row['NOMBRE DE COTIZACIÓN'] || row['nombre_de_cotizacion'] || row['nombre_de_la_orden_de_compra']
              const name = cleanStr(
                opp['NOMBRE DE COTIZACIÓN'] || opp['NOMBRE DE COTIZACION'] || opp.nombre_de_cotizacion || opp.NOMBRE_DE_COTIZACION ||
                opp.title || opp.name || opp.nombre_de_la_orden_de_compra || opp.nombre_orden_compra
              );

              // REGLA ESTRICTA: Desechar filas sin ID o Nombre válido
              if (!code || !name) {
                return null;
              }

              // Organismo: row['ORGANIZACIÓN'] || row['organizacion'] || row['razon_social'] || row['unidad_de_compra']
              const buyer = cleanStr(
                opp['ORGANIZACIÓN'] || opp['ORGANIZACION'] || opp.organizacion || opp.ORGANIZACION_COMPRADORA ||
                opp.buyer || opp.organism || opp.institution || opp.razon_social || opp.unidad_de_compra
              ) || 'Organismo Comprador';

              // Contacto: row['NOMBRE DEL COMPRADOR'] || row['nombre_completo']
              const contact = cleanStr(
                opp['NOMBRE DEL COMPRADOR'] || opp['NOMBRE_DEL_COMPRADOR'] || opp.nombre_del_comprador ||
                opp.contactName || opp.nombre_completo
              );

              // Presupuesto/Monto: row['PRESUPUESTO MÁXIMO'] || row['total_oc']
              const rawAmount = opp['PRESUPUESTO MÁXIMO'] !== undefined ? opp['PRESUPUESTO MÁXIMO']
                : (opp['PRESUPUESTO MAXIMO'] !== undefined ? opp['PRESUPUESTO MAXIMO']
                  : (opp.presupuesto_maximo !== undefined ? opp.presupuesto_maximo
                    : (opp.amount !== undefined ? opp.amount : (opp.total_oc !== undefined ? opp.total_oc : opp.neto_clp || 0))));

              const amountParsed = typeof rawAmount === 'number'
                ? rawAmount
                : parseFloat(cleanStr(rawAmount).replace(/[^0-9.-]+/g, '')) || 0;

              // Fecha Cierre: row['FIN DE PUBLICACIÓN'] || row['fecha_cierre']
              const rawClosure = cleanStr(
                opp['FIN DE PUBLICACIÓN'] || opp['FIN DE PUBLICACION'] || opp.fin_de_publicacion ||
                opp.closingDate || opp.endDate || opp.fecha_cierre || opp.fechaCierre
              );
              const isFuture = rawClosure && !isNaN(new Date(rawClosure).getTime()) && new Date(rawClosure).getTime() > Date.now();
              const validClosureDate = isFuture
                ? new Date(rawClosure).toISOString()
                : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

              const hasIdCotizacion = Boolean(opp['ID COTIZACIÓN'] || opp['ID COTIZACION'] || opp.id_cotizacion || opp.ID_COTIZACION);
              const typeRaw = cleanStr(opp.type || opp.tipo).toLowerCase();
              const codeUpper = code.toUpperCase();
              const nameUpper = name.toUpperCase();

              let inferredTipo: TipoProceso = 'Licitacion';
              if (hasIdCotizacion || typeRaw.includes('convenio') || typeRaw.includes('marco') || codeUpper.startsWith('CM-') || codeUpper.includes('AISP') || nameUpper.includes('CONVENIO MARCO')) {
                inferredTipo = 'Convenio Marco';
              } else if (typeRaw.includes('agil') || typeRaw.includes('cot') || codeUpper.includes('-COT') || nameUpper.includes('COMPRA AGIL') || nameUpper.includes('COMPRA ÁGIL')) {
                inferredTipo = 'Compra Agil';
              } else {
                inferredTipo = 'Licitacion';
              }

              const contactEmail = cleanStr(opp.contactEmail || opp.e_mail_usuario);
              const contactPhone = cleanStr(opp.contactPhone || opp.fono_usuario);
              const contactRole = cleanStr(opp.contactRole || opp.cargo);
              const location = cleanStr(opp.location || opp.comuna) || 'Región Metropolitana de Santiago';

              return {
                codigo: code,
                cliente: buyer,
                nombre: name,
                descripcion: `Organismo: ${buyer}${contact ? ' | Contacto: ' + contact : ''}${contactRole ? ' (' + contactRole + ')' : ''}${contactEmail ? ' - Email: ' + contactEmail : ''}${contactPhone ? ' - Tel: ' + contactPhone : ''}${location ? ' - Comuna: ' + location : ''}`,
                tipo: inferredTipo,
                montoEstimadoClp: amountParsed,
                fechaPublicacion: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                fechaCierre: validClosureDate,
                diasRestantes: 15,
                estado: 'Publicada',
                url: `https://www.mercadopublico.cl/BuscarLicitacion?codigo=${code}`,
                esUltimos7Dias: true,
                tags: ['Mercado Público', location].filter(Boolean) as string[],
                region: location
              };
            }).filter((item): item is LicitacionItem => item !== null);

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