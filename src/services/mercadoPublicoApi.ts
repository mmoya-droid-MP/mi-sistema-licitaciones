import { OrdenCompraItem } from '../types';

export async function fetchOrdenesCompraPorFecha(fechaDDMMAAAA: string, ticket: string): Promise<OrdenCompraItem[]> {
  try {
    const response = await fetch(
      `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?fecha=${fechaDDMMAAAA}&ticket=${ticket}`
    );
    const data = await response.json();

    // Mapea la respuesta real al formato de tu aplicación
    return (data.Listado || []).map((oc: any) => ({
      id: oc.Codigo,
      nombre: oc.Nombre,
      organismo: oc.Comprador ? oc.Comprador.NombreOrganismo : 'Organismo Público',
      fecha: fechaDDMMAAAA,
      monto: oc.MontoTotal || 0,
      estado: oc.CodigoEstado === 4 ? 'Aceptada' : 'En Recepción',
      tipo: 'Orden de Compra'
    }));
  } catch (error) {
    console.error('Error al consultar API Mercado Público:', error);
    return [];
  }
}
