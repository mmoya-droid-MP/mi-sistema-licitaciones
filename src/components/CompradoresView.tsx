import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Building2,
  Search,
  Upload,
  Plus,
  Trash2,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  FileSpreadsheet,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  Building
} from 'lucide-react';

export interface ContactoComprador {
  id: number;
  comprador_id: number;
  nombre: string;
  cargo?: string;
  correo?: string;
  telefono?: string;
  created_at?: string;
}

export interface CompradorItem {
  id: number;
  rut_organismo: string;
  nombre_organismo: string;
  region: string;
  ciudad: string;
  contactos?: ContactoComprador[];
  created_at?: string;
}

export const CompradoresView: React.FC = () => {
  const [buyers, setBuyers] = useState<CompradorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState<CompradorItem | null>(null);

  // Form state - Add Buyer
  const [buyerForm, setBuyerForm] = useState({
    rut_organismo: '',
    nombre_organismo: '',
    region: 'Región Metropolitana de Santiago',
    ciudad: 'Santiago'
  });

  // Form state - Add Contact
  const [contactForm, setContactForm] = useState({
    nombre: '',
    cargo: '',
    correo: '',
    telefono: ''
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Show Toast Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Buyers from Backend API
  const fetchBuyers = async (currentPage = page, query = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        q: query
      });

      const res = await fetch(`/api/compradores?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Error en servidor (${res.status})`);
      }
      const json = await res.json();

      if (json && json.success && Array.isArray(json.data)) {
        setBuyers(json.data || []);
        if (json.pagination) {
          setPage(json.pagination.page || 1);
          setTotalPages(json.pagination.totalPages || 1);
          setTotalCount(json.pagination.totalCount || 0);
        } else {
          setPage(1);
          setTotalPages(1);
          setTotalCount((json.data || []).length);
        }
      } else {
        console.error('Error cargando compradores:', json?.error);
        setBuyers([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error de red al obtener compradores:', err);
      setBuyers([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers(1, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    fetchBuyers(page, searchQuery);
  }, [page]);

  // Handle Excel/CSV Upload with Client-Side Chunking (500 rows per batch)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Leyendo archivo ${file.name}...`);
    setUploadProgress(0);

    try {
      let rawRows: any[] = [];
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        // Native CSV parsing line-by-line with delimiter auto-detection and encoding detection
        const arrayBuffer = await file.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(arrayBuffer);
        if (text.includes('')) {
          text = new TextDecoder('iso-8859-1').decode(arrayBuffer);
        }

        // Clean BOM if present
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }

        const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);

        if (lines.length >= 2) {
          // Auto-detect delimiter (, or ; or \t)
          const headerLine = lines[0];
          const countSemicolon = (headerLine.match(/;/g) || []).length;
          const countComma = (headerLine.match(/,/g) || []).length;
          const countTab = (headerLine.match(/\t/g) || []).length;

          let delimiter = ',';
          if (countSemicolon >= countComma && countSemicolon >= countTab) {
            delimiter = ';';
          } else if (countTab > countComma && countTab > countSemicolon) {
            delimiter = '\t';
          }

          const parseCsvLine = (line: string, delim: string): string[] => {
            const res: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === delim && !inQuotes) {
                res.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            res.push(current.trim());
            return res;
          };

          const headers = parseCsvLine(lines[0], delimiter).map((h) =>
            h.replace(/^"+|"+$/g, '').trim()
          );

          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i], delimiter);
            if (values.length === 0) continue;

            const rowObj: Record<string, string> = {};
            let hasData = false;

            headers.forEach((header, idx) => {
              let val = values[idx] || '';
              val = val.replace(/^"+|"+$/g, '').trim();
              if (val) hasData = true;
              rowObj[header] = val;
            });

            if (hasData) {
              rawRows.push(rowObj);
            }
          }
        }
      } else {
        // Process Excel file using XLSX library
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(worksheet);
      }

      if (!rawRows || rawRows.length === 0) {
        showToast('El archivo cargado no contiene filas de datos válidas.', 'error');
        setIsUploading(false);
        setUploadStatus(null);
        setUploadProgress(null);
        return;
      }

      const totalRows = rawRows.length;
      const batchSize = 500;
      const totalBatches = Math.ceil(totalRows / batchSize);

      let totalProcessedCompradores = 0;
      let totalContactsInserted = 0;

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const currentBatchNumber = batchIdx + 1;
        const start = batchIdx * batchSize;
        const end = Math.min(start + batchSize, totalRows);
        const batchItems = rawRows.slice(start, end);

        const pct = Math.round((currentBatchNumber / totalBatches) * 100);
        setUploadProgress(pct);
        setUploadStatus(
          `Procesando lote ${currentBatchNumber} de ${totalBatches}... (${pct}% completado)`
        );

        const res = await fetch('/api/compradores/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batchItems })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Error HTTP ${res.status} al procesar el lote ${currentBatchNumber}`);
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || `Error en servidor al procesar lote ${currentBatchNumber}`);
        }

        totalProcessedCompradores += json.totalProcessed || 0;
        totalContactsInserted += json.totalContacts || 0;
      }

      showToast(
        `Carga completada con éxito. Se procesaron ${totalProcessedCompradores} compradores y ${totalContactsInserted} contactos.`
      );
      fetchBuyers(1, searchQuery);
    } catch (err: any) {
      console.error('Error al subir archivo:', err);
      showToast(err.message || 'Error de red al procesar el archivo.', 'error');
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Add Buyer Submit
  const handleAddBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerForm.rut_organismo || !buyerForm.nombre_organismo) {
      showToast('Por favor completa el RUT y Nombre del organismo.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/compradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buyerForm)
      });

      const json = await res.json();
      if (json.success) {
        showToast('Comprador registrado exitosamente.');
        setShowAddBuyerModal(false);
        setBuyerForm({ rut_organismo: '', nombre_organismo: '', region: 'Región Metropolitana de Santiago', ciudad: 'Santiago' });
        fetchBuyers(1, searchQuery);
      } else {
        showToast(json.error || 'No se pudo crear el comprador.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Contact Submit
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddContactModal) return;
    if (!contactForm.nombre.trim()) {
      showToast('El nombre del contacto es obligatorio.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/compradores/${showAddContactModal.id}/contactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });

      const json = await res.json();
      if (json.success) {
        showToast(`Contacto ${contactForm.nombre} añadido a ${showAddContactModal.nombre_organismo}.`);
        setShowAddContactModal(null);
        setContactForm({ nombre: '', cargo: '', correo: '', telefono: '' });
        fetchBuyers(page, searchQuery);
      } else {
        showToast(json.error || 'No se pudo agregar el contacto.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Contact
  const handleDeleteContact = async (contactId: number, contactName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar al contacto "${contactName}"?`)) return;

    try {
      const res = await fetch(`/api/contactos/${contactId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Contacto eliminado correctamente.');
        fetchBuyers(page, searchQuery);
      } else {
        showToast('Error al eliminar contacto.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor.', 'error');
    }
  };

  // Handle Delete Buyer
  const handleDeleteBuyer = async (buyerId: number, buyerName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el organismo "${buyerName}" y todos sus contactos asociados?`)) return;

    try {
      const res = await fetch(`/api/compradores/${buyerId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Organismo comprador eliminado correctamente.');
        fetchBuyers(page, searchQuery);
      } else {
        showToast('Error al eliminar el comprador.', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-bounce border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 border-emerald-400'
              : 'bg-rose-600 border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-white" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Directorio de Compradores Públicos</span>
                  <span className="bg-blue-500/20 text-cyan-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    {totalCount.toLocaleString()} Organismos
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Base de datos de compradores estatales de Mercado Público y gestión de contactos clave
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition duration-200 disabled:opacity-50"
              title="Cargar archivo Excel o CSV con compradores en lotes de 500"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              )}
              <span>📥 Cargar Excel / CSV</span>
            </button>

            <button
              onClick={() => setShowAddBuyerModal(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>➕ Nuevo Comprador</span>
            </button>
          </div>
        </div>

        {/* Upload status indicator with Progress Bar */}
        {uploadStatus && (
          <div className="mt-4 bg-slate-900 border border-emerald-500/40 text-emerald-200 text-xs p-3.5 rounded-xl space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-100">{uploadStatus}</span>
              </div>
              {uploadProgress !== null && (
                <span className="font-mono font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  {uploadProgress}%
                </span>
              )}
            </div>
            {uploadProgress !== null && (
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-xs"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Onebox Smart Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscador Inteligente (Onebox): Filtra por Organización, RUT (ej. 60.511.000-7), Ciudad o Región..."
            className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-medium">Consultando directorio de compradores...</p>
          </div>
        ) : (buyers || []).length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                {searchQuery ? 'Sin resultados para la búsqueda' : 'Directorio de Compradores Vacío'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {searchQuery
                  ? `No se encontraron organismos que coincidan con "${searchQuery}". Intenta con otro término o limpia el buscador.`
                  : 'La base de datos no contiene compradores actualmente. Puedes agregar compradores manualmente o importar una lista en Excel.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowAddBuyerModal(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>➕ Agregar Primer Comprador</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>📥 Cargar Excel Masivo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Organismo / RUT</th>
                  <th className="py-3.5 px-4">Ubicación</th>
                  <th className="py-3.5 px-4">Contactos Asociados</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(buyers || []).map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-50/80 transition duration-150">
                    {/* Buyer Organismo & RUT */}
                    <td className="py-4 px-4 align-top max-w-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {buyer.nombre_organismo}
                        </div>
                        <div className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border border-slate-200">
                          <span>RUT: {buyer.rut_organismo}</span>
                        </div>
                      </div>
                    </td>

                    {/* Ubicacion */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1 text-slate-600 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{buyer.ciudad || 'Chile'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-5">
                          {buyer.region || 'Región no especificada'}
                        </div>
                      </div>
                    </td>

                    {/* Contactos Asociados */}
                    <td className="py-4 px-4 align-top">
                      {(buyer.contactos || []).length > 0 ? (
                        <div className="space-y-2">
                          {(buyer.contactos || []).map((contacto) => (
                            <div
                              key={contacto.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-start justify-between gap-2 group hover:border-blue-300 transition"
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{contacto.nombre}</span>
                                </div>
                                {contacto.cargo && (
                                  <div className="text-[11px] font-medium text-slate-500">
                                    {contacto.cargo}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                                  {contacto.correo && (
                                    <a
                                      href={`mailto:${contacto.correo}`}
                                      className="flex items-center space-x-1 text-blue-600 hover:underline"
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>{contacto.correo}</span>
                                    </a>
                                  )}
                                  {contacto.telefono && (
                                    <a
                                      href={`tel:${contacto.telefono}`}
                                      className="flex items-center space-x-1 text-slate-600 hover:text-slate-900"
                                    >
                                      <Phone className="w-3 h-3 text-emerald-500" />
                                      <span>{contacto.telefono}</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Delete Contact (-) */}
                              <button
                                onClick={() => handleDeleteContact(contacto.id, contacto.nombre)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                                title="Eliminar Contacto (-)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic bg-slate-50/60 border border-dashed border-slate-200 rounded-xl p-2 text-center">
                          Sin contactos asociados registrados
                        </div>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        {/* (+) Agregar Contacto */}
                        <button
                          onClick={() => {
                            setShowAddContactModal(buyer);
                            setContactForm({ nombre: '', cargo: '', correo: '', telefono: '' });
                          }}
                          className="flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                          title="Añadir contacto a esta organización (+)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Contacto</span>
                        </button>

                        {/* (🗑️) Eliminar Comprador */}
                        <button
                          onClick={() => handleDeleteBuyer(buyer.id, buyer.nombre_organismo)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar Comprador y sus Contactos"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-600">
            <div>
              Mostrando página <span className="font-bold text-slate-900">{page}</span> de{' '}
              <span className="font-bold text-slate-900">{totalPages}</span> ({totalCount.toLocaleString()} totales)
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center space-x-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center space-x-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Nuevo Comprador */}
      {showAddBuyerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Registrar Nuevo Comprador</span>
              </div>
              <button onClick={() => setShowAddBuyerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBuyerSubmit} className="space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block mb-1 font-bold">RUT Organismo (con puntos y guión)*</label>
                <input
                  type="text"
                  required
                  placeholder="ej. 60.511.000-7"
                  value={buyerForm.rut_organismo}
                  onChange={(e) => setBuyerForm({ ...buyerForm, rut_organismo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Nombre del Organismo Público*</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Carabineros de Chile - Dirección de Logística"
                  value={buyerForm.nombre_organismo}
                  onChange={(e) => setBuyerForm({ ...buyerForm, nombre_organismo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold">Región</label>
                  <input
                    type="text"
                    placeholder="ej. Región Metropolitana"
                    value={buyerForm.region}
                    onChange={(e) => setBuyerForm({ ...buyerForm, region: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold">Ciudad / Comuna</label>
                  <input
                    type="text"
                    placeholder="ej. Santiago"
                    value={buyerForm.ciudad}
                    onChange={(e) => setBuyerForm({ ...buyerForm, ciudad: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddBuyerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Guardar Comprador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nuevo Contacto */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>Agregar Contacto</span>
              </div>
              <button onClick={() => setShowAddContactModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 font-semibold">
              Asociando contacto a: <span className="font-bold underline">{showAddContactModal.nombre_organismo}</span> (RUT: {showAddContactModal.rut_organismo})
            </div>

            <form onSubmit={handleAddContactSubmit} className="space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block mb-1 font-bold">Nombre Completo del Contacto*</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Capitán Jorge Morales"
                  value={contactForm.nombre}
                  onChange={(e) => setContactForm({ ...contactForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Cargo o Función</label>
                <input
                  type="text"
                  placeholder="ej. Jefe de Licitaciones y Compras Públicas"
                  value={contactForm.cargo}
                  onChange={(e) => setContactForm({ ...contactForm, cargo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ej. contacto@organismo.cl"
                  value={contactForm.correo}
                  onChange={(e) => setContactForm({ ...contactForm, correo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Teléfono de Contacto</label>
                <input
                  type="text"
                  placeholder="ej. +56 2 2922 4000"
                  value={contactForm.telefono}
                  onChange={(e) => setContactForm({ ...contactForm, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Añadir Contacto (+)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
