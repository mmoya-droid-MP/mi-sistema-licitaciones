import React, { useState } from 'react';
import { Building2, Building, UserCheck, X, Loader2 } from 'lucide-react';

export interface CreateBuyerFormData {
  rut_organismo: string;
  nombre_organismo: string;
  unidadCompra: string;
  region: string;
  ciudad: string;
  nombreContacto: string;
  cargoContacto: string;
  telefonoContacto: string;
  emailContacto: string;
}

interface CreateBuyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: CreateBuyerFormData) => Promise<void> | void;
  submitting?: boolean;
}

export const CreateBuyerModal: React.FC<CreateBuyerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  submitting = false
}) => {
  const [formData, setFormData] = useState<CreateBuyerFormData>({
    rut_organismo: '',
    nombre_organismo: '',
    unidadCompra: '',
    region: 'Región Metropolitana de Santiago',
    ciudad: 'Santiago',
    nombreContacto: '',
    cargoContacto: '',
    telefonoContacto: '',
    emailContacto: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative my-8 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Registrar Nuevo Comprador</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs font-medium text-slate-700">
          {/* Sección 1: Datos del Organismo */}
          <div className="space-y-3.5">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs uppercase tracking-wider bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-100">
              <Building className="w-4 h-4 text-blue-600" />
              <span>1. Datos de la Institución / Organismo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-bold text-slate-700">RUT Organismo (con puntos y guión)*</label>
                <input
                  type="text"
                  required
                  placeholder="ej. 60.511.000-7"
                  value={formData.rut_organismo}
                  onChange={(e) => setFormData({ ...formData, rut_organismo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700">Unidad de Compra</label>
                <input
                  type="text"
                  placeholder="ej. Departamento de Adquisiciones"
                  value={formData.unidadCompra}
                  onChange={(e) => setFormData({ ...formData, unidadCompra: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">Nombre del Organismo Público*</label>
              <input
                type="text"
                required
                placeholder="ej. Carabineros de Chile - Dirección de Logística"
                value={formData.nombre_organismo}
                onChange={(e) => setFormData({ ...formData, nombre_organismo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-bold text-slate-700">Región</label>
                <input
                  type="text"
                  placeholder="ej. Región Metropolitana de Santiago"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700">Ciudad / Comuna</label>
                <input
                  type="text"
                  placeholder="ej. Santiago"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Datos de Contacto */}
          <div className="space-y-3.5 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>2. Datos de Contacto (Mercado Público)</span>
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">Nombre Completo del Contacto</label>
              <input
                type="text"
                placeholder="ej. Capitán Jorge Morales"
                value={formData.nombreContacto}
                onChange={(e) => setFormData({ ...formData, nombreContacto: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-bold text-slate-700">Cargo del Usuario</label>
                <input
                  type="text"
                  placeholder="ej. Jefe de Licitaciones"
                  value={formData.cargoContacto}
                  onChange={(e) => setFormData({ ...formData, cargoContacto: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700">Teléfono del Usuario</label>
                <input
                  type="text"
                  placeholder="ej. +56 2 2922 4000"
                  value={formData.telefonoContacto}
                  onChange={(e) => setFormData({ ...formData, telefonoContacto: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">Correo Electrónico</label>
              <input
                type="email"
                placeholder="ej. jmorales@carabineros.cl"
                value={formData.emailContacto}
                onChange={(e) => setFormData({ ...formData, emailContacto: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center space-x-1.5 transition"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Guardar Comprador</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
