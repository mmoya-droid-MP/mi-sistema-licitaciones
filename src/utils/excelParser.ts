import * as XLSX from 'xlsx';
import { OrdenCompraItem } from '../types';

export function parseMercadoPublicoExcel(file: File): Promise<OrdenCompraItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsedItems: OrdenCompraItem[] = rawRows.map((row) => ({
          id: String(row['Codigo de OC'] || row['Codigo'] || row['ID'] || '').trim(),
          nombre: String(row['Nombre de la Orden de Compra'] || row['Nombre'] || '').trim(),
          organismo: String(row['Comprador'] || row['Organismo'] || '').trim(),
          proveedor: String(row['Proveedor'] || '').trim(),
          fecha: row['Fecha'] ? String(row['Fecha']).split(' ')[0] : '',
          monto: Number(row['MontoOC_BRUTO']) || Number(row['Monto']) || 0,
          estado: String(row['Estado'] || '').includes('Aceptada')
            ? 'Aceptada'
            : String(row['Estado'] || '').includes('Enviada')
            ? 'Enviada a proveedor'
            : 'En Recepción',
          tipo: String(row['TipoOrden'] || 'Orden de Compra') as any
        }));

        resolve(parsedItems);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
