import React, { useState } from 'react';
import { Search, Calendar, RefreshCw, ExternalLink, BarChart2 } from 'lucide-react';
import { INITIAL_ORDENES_COMPRA } from '../data/mockData';
import { parseMercadoPublicoExcel } from '../utils/excelParser';
import { OrdenCompraItem } from '../types';

interface OrdenesCompraViewProps {
  ordenesCompra?: any[];
  openReportsModal?: (tab?: string, items?: any[]) => void;
}

export const OrdenesCompraView: React.FC<OrdenesCompraViewProps> = ({
  ordenesCompra = [],
  openReportsModal
}) => {
  const [query, setQuery] = useState('');
  const setSearchTerm = setQuery;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadedOrdenes, setLoadedOrdenes] = useState<any[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);

  const safeData = loadedOrdenes || (Array.isArray(ordenesCompra) && ordenesCompra.length > 0 ? ordenesCompra : INITIAL_ORDENES_COMPRA);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      let nuevosItems: OrdenCompraItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const items = await parseMercadoPublicoExcel(files[i]);
        nuevosItems = [...nuevosItems, ...items];
      }

      // Acumular con registros existentes y eliminar duplicados por ID (Codigo de OC)
      setLoadedOrdenes((prev) => {
        const baseList = prev || (Array.isArray(ordenesCompra) && ordenesCompra.length > 0 ? ordenesCompra : INITIAL_ORDENES_COMPRA);
        const combinados = [...baseList, ...nuevosItems];
        const unicos = Array.from(new Map(combinados.map((item) => [item.id, item])).values());
        setLoadedCount(unicos.length);
        return unicos;
      });
    } catch (error) {
      console.error('Error al procesar el archivo Excel:', error);
    } finally {
      setIsUploading(false);
      // Limpiar el input para permitir subir el mismo u otros archivos secuencialmente
      e.target.value = '';
    }
  };

  const filteredOCs = safeData.filter((oc) => {
    if (!oc) return false;
    
    const search = query.toLowerCase().trim();
    const matchesText =
      !search ||
      (oc.nombre && oc.nombre.toLowerCase().includes(search)) ||
      (oc.id && oc.id.toLowerCase().includes(search)) ||
      (oc.organismo && oc.organismo.toLowerCase().includes(search)) ||
      (oc.proveedor && oc.proveedor.toLowerCase().includes(search));

    // Validación limpia de fechas
    const ocFecha = oc.fecha ? oc.fecha.split('T')[0] : '';
    const matchesStartDate = !startDate || (ocFecha && ocFecha >= startDate);
    const matchesEndDate = !endDate || (ocFecha && ocFecha <= endDate);

    return matchesText && matchesStartDate && matchesEndDate;
  });

  const handleReset = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setLoadedOrdenes(null);
    setLoadedCount(null);
    setIsUploading(false);
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl space-y-6 border border-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          Buscador de Órdenes de Compra
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".xls,.xlsx"
              multiple
              id="upload-excel"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />

            {/* Botón Principal Dinámico */}
            <label
              htmlFor="upload-excel"
              className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isUploading
                  ? 'bg-amber-600 text-white cursor-wait opacity-80'
                  : loadedCount !== null
                  ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isUploading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Procesando y Cargando...
                </>
              ) : loadedCount !== null ? (
                <>
                  <span>✓</span>
                  {loadedCount} Registros Cargados
                </>
              ) : (
                <>
                  <span>📁</span>
                  Cargar Excel Mercado Público
                </>
              )}
            </label>

            {/* Botón Auxiliar: Subir otro archivo */}
            {loadedCount !== null && !isUploading && (
              <label
                htmlFor="upload-excel"
                className="cursor-pointer px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                + Subir otro archivo
              </label>
            )}
          </div>

          {openReportsModal && (
            <button
              onClick={() => openReportsModal('ordenescompra', filteredOCs)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              Generar Reporte
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Restablecer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 block mb-1">Palabra clave, ID o Entidad</label>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="search"
              name="search_oc_unique"
              autoComplete="new-password"
              placeholder="Buscar por código, producto u organismo..."
              onChange={(e) => {
                const value = e.target.value;
                if ((window as any).searchTimeoutOC) clearTimeout((window as any).searchTimeoutOC);
                (window as any).searchTimeoutOC = setTimeout(() => {
                  if (typeof setSearchTerm === 'function') setSearchTerm(value);
                }, 300);
              }}
              className="input-texto-blanco w-full pl-10 pr-4 py-2 rounded-lg text-sm font-medium outline-none shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Fecha Desde
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Fecha Hasta
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-400 px-1">
          <span>Se encontraron {(filteredOCs || []).length} registros</span>
        </div>

        {(filteredOCs || []).length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
            No se encontraron órdenes de compra con los términos o fechas ingresadas.
          </div>
        ) : (
          (filteredOCs || []).map((oc) => (
            <div
              key={oc.id}
              className="p-4 bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 rounded-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-800 font-mono">
                    {oc.id}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
                    {oc.estado}
                  </span>
                  <span className="text-xs text-slate-400">{oc.fecha}</span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">{oc.nombre}</h3>
                <p className="text-xs text-slate-400">{oc.organismo || oc.cliente}</p>
              </div>

              <div className="text-right flex md:flex-col justify-between items-end gap-2">
                <div>
                  <span className="text-base font-bold text-emerald-400 block">
                    {oc.monto > 0 ? `$${oc.monto.toLocaleString('es-CL')} CLP` : 'Monto no disponible'}
                  </span>
                </div>
                <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Ficha Mercado Público <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrdenesCompraView;