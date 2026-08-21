import React, { useState, useMemo, useDeferredValue } from 'react';
import { Oportunidad } from '../types';
import { getItemOfficialUrl, cleanOfficialId } from '../lib/dateUtils';
import { Buscador } from './Buscador';

interface Props {
  oportunidades?: Oportunidad[];
  items?: Oportunidad[];
  onEvaluarIA?: (item: Oportunidad) => void;
  onSelectLicitacionAI?: (item: Oportunidad) => void;
  onIaReview?: (item: Oportunidad) => void;
  onAsignarAlerta?: (item: Oportunidad) => void;
  onAddAlert?: (item: Oportunidad) => void;
  onAddAlerta?: (item: any) => void;
  onAddPostulacion?: (item: Oportunidad) => void;
}

const MemoizedList = React.memo(({ filteredData, searchTerm, handleEvaluar, handleAlerta, onAddPostulacion }: any) => {
  return (
    <div style={{ fontSize: '13px' }}>
      {(filteredData || []).length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px', backgroundColor: '#0f172a' }}>
          {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'No se encontraron oportunidades registradas.'}
        </div>
      ) : (
        (filteredData || []).map((item: any) => (
          <div
            key={item.id || Math.random()}
            className="grid grid-cols-[140px_220px_220px_130px_auto] items-center gap-2"
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #1e293b',
              backgroundColor: '#0f172a',
            }}
          >
            {/* 1. ID */}
            <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cleanOfficialId(item.id)}
            </div>

            {/* 2. NOMBRE */}
            <div style={{ color: '#f1f5f9', paddingRight: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nombre}>
              {item.nombre}
            </div>

            {/* 3. ORGANISMO */}
            <div className="max-w-[220px] truncate pr-4 text-slate-300" title={item.organismo}>
              {item.organismo}
            </div>

            {/* 4. TIPO DE COMPRA */}
            <div className="w-[120px] text-left">
              <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700">
                {item.tipo}
              </span>
            </div>

            {/* 5. ACCIONES CON EL BOTÓN DE ALERTA OBLIGATORIO */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              {/* Botón IA */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEvaluar(item);
                }}
                style={{
                  padding: '5px 9px',
                  backgroundColor: '#9333ea',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                ✨ IA
              </button>

              {/* Botón Alerta */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAlerta(item);
                }}
                style={{
                  padding: '5px 9px',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                🔔 Alerta
              </button>

              {/* Botón Postular / Ficha */}
              <a
                href={getItemOfficialUrl({ codigo: item.codigo || item.id, tipo: item.tipo, url: item.url })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAddPostulacion) {
                    onAddPostulacion(item);
                  }
                }}
                style={{
                  padding: '5px 9px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Postular ↗
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
});

export const OportunidadesTabla: React.FC<Props> = ({
  oportunidades,
  items,
  onEvaluarIA,
  onSelectLicitacionAI,
  onIaReview,
  onAsignarAlerta,
  onAddAlert,
  onAddAlerta,
  onAddPostulacion,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);

  const rawList = oportunidades || items || [];

  const dataList: Oportunidad[] = useMemo(() => {
    return rawList.map((it: any) => ({
      id: it.id || it.codigo || '',
      nombre: it.nombre || it.licitacionNombre || '',
      organismo: it.organismo || it.cliente || '',
      tipo: it.tipo || 'Licitación',
      diasRestantes: it.diasRestantes,
      url: it.url,
      ...it,
    }));
  }, [rawList]);

  const filteredData = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    if (!term) return dataList;
    return dataList.filter(
      (item) =>
        (item.id && item.id.toLowerCase().includes(term)) ||
        (item.nombre && item.nombre.toLowerCase().includes(term)) ||
        (item.organismo && item.organismo.toLowerCase().includes(term))
    );
  }, [dataList, deferredSearch]);

  const handleEvaluar = (item: Oportunidad) => {
    if (onEvaluarIA) {
      onEvaluarIA(item);
    } else if (onSelectLicitacionAI) {
      onSelectLicitacionAI(item);
    } else if (onIaReview) {
      onIaReview(item);
    } else {
      alert(`Evaluando con IA: ${item.nombre || item.id}`);
    }
  };

  const handleAlerta = (item: Oportunidad) => {
    if (onAsignarAlerta) {
      onAsignarAlerta(item);
    } else if (onAddAlert) {
      onAddAlert(item);
    } else if (onAddAlerta) {
      onAddAlerta({
        id: `alert-${Date.now()}`,
        nombre: `Alerta para ${item.nombre || item.id}`,
        palabrasClave: [item.id || ''],
        organismos: [item.organismo || ''],
        tipos: [item.tipo || 'Licitacion'],
        notificarEmail: true,
        notificarApp: true,
        activa: true,
        creadaEn: new Date().toISOString(),
      });
    } else {
      alert(`🔔 Alerta creada para ID: ${item.id}`);
    }
  };

  return (
    <div style={{ width: '100%', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', color: '#ffffff' }}>
      {/* BUSCADOR ULTRA RÁPIDO SIN LATENCIA CON DEBOUNCE LOCAL */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="relative w-full max-w-md">
          <Buscador
            onSearchChange={setSearchTerm}
            placeholder="Buscar por código (ej: 425-37-LP26), nombre u organismo..."
            className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs placeholder-slate-400"
          />
        </div>
        <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
          {(filteredData || []).length} de {(dataList || []).length}
        </span>
      </div>

      {/* CONTENEDOR GRID DE ANCHOS ESTRICTOS (ELIMINA EL ESPACIO SOBRANTE) */}
      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #1e293b', borderRadius: '8px' }}>
        {/* ENCABEZADO */}
        <div
          className="grid grid-cols-[140px_220px_220px_130px_auto] items-center gap-2"
          style={{
            backgroundColor: '#1e293b',
            padding: '10px 12px',
            borderBottom: '1px solid #334155',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#94a3b8',
          }}
        >
          <div>ID (CÓDIGO)</div>
          <div>NOMBRE</div>
          <div>ORGANISMO</div>
          <div style={{ textAlign: 'center' }}>TIPO</div>
          <div style={{ textAlign: 'right' }}>ACCIONES</div>
        </div>

        {/* FILAS DE DATOS */}
        <MemoizedList
          filteredData={filteredData}
          searchTerm={searchTerm}
          handleEvaluar={handleEvaluar}
          handleAlerta={handleAlerta}
          onAddPostulacion={onAddPostulacion}
        />
      </div>
    </div>
  );
};

export default OportunidadesTabla;
