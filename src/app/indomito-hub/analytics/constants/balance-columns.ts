import type { balanceTableRow } from '../fn/balance-table';
/** Columnas de pantalla y Excel con la misma unidad. */
export const BALANCE_COLUMNS: {
  field: keyof ReturnType<typeof balanceTableRow>;
  label: string;
  unit: string;
}[] = [
  { field: 'id', label: 'Viaje', unit: '' },
  { field: 'institution', label: 'Institución', unit: '' },
  { field: 'course', label: 'Curso', unit: '' },
  { field: 'destination', label: 'Destino', unit: '' },
  { field: 'departure', label: 'Salida', unit: '' },
  { field: 'total', label: 'Viajeros', unit: 'personas' },
  { field: 'paying', label: 'Pagantes', unit: 'personas' },
  { field: 'free', label: 'Liberados', unit: 'personas' },
  { field: 'sale', label: 'Venta contractual', unit: 'CLP brutos' },
  { field: 'collected', label: 'Cobrado aplicado', unit: 'CLP' },
  { field: 'pending', label: 'Pendiente por cobrar', unit: 'CLP' },
  { field: 'deposit', label: 'Abonos pendientes', unit: 'CLP' },
  { field: 'overdue', label: 'Cuotas vencidas', unit: 'CLP' },
  { field: 'baseline', label: 'Presupuesto original', unit: 'CLP netos' },
  { field: 'cost', label: 'Costo actualizado', unit: 'CLP netos' },
  { field: 'committed', label: 'Comprometido', unit: 'CLP operativos' },
  { field: 'paid', label: 'Pagado neto a proveedores', unit: 'CLP' },
  { field: 'supplierPending', label: 'Pendiente proveedores', unit: 'CLP' },
  { field: 'result', label: 'Resultado estimado', unit: 'CLP netos' },
  { field: 'margin', label: 'Margen sobre venta neta', unit: '%' },
  { field: 'variance', label: 'Desviación de costo', unit: 'CLP netos' },
  { field: 'coverage', label: 'Cobertura', unit: '' },
  { field: 'version', label: 'Versión', unit: '' },
];
