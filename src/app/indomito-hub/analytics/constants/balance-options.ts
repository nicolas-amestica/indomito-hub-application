export const BALANCE_SECTIONS = [
  { label: 'Resumen', value: 'summary' },
  { label: 'Presupuesto', value: 'budget' },
  { label: 'Simulación', value: 'simulation' },
  { label: 'Cobranza', value: 'collections' },
  { label: 'Caja y proveedores', value: 'cash' },
];
export const CHARGE_OPTIONS = [
  { label: 'Valor fijo', value: 'fixed' },
  { label: 'Por persona', value: 'per_passenger' },
  { label: 'Por persona y noche', value: 'per_passenger_night' },
  { label: 'Por día', value: 'per_day' },
  { label: 'Por persona y día', value: 'per_passenger_day' },
  { label: 'Tripulación por día', value: 'crew' },
];
export const BASIS_OPTIONS = [
  { label: 'Todos los viajeros', value: 'total' },
  { label: 'Solo pagantes', value: 'paying' },
  { label: 'Solo liberados', value: 'free' },
  { label: 'Participantes de la actividad', value: 'participants' },
  { label: 'Unidades contratadas', value: 'units' },
];
export const LINE_STATES = [
  { label: 'Estimado', value: 'estimated' },
  { label: 'Cotizado', value: 'quoted' },
  { label: 'Comprometido', value: 'committed' },
  { label: 'Confirmado', value: 'confirmed' },
];
export const INITIAL_CATEGORIES = [
  'Transporte',
  'Alojamiento',
  'Alimentación',
  'Excursiones y entradas',
  'Coordinación y tripulación',
  'Seguros',
  'Comisiones de pago',
  'Otros costos',
  'Contingencias',
];

export const BALANCE_ACTION_LABELS: Record<string, string> = {
  SAVE: 'Guardar presupuesto',
  SCENARIO: 'Guardar escenario',
  APPROVE: 'Aprobar línea base',
  PROMOTE: 'Adoptar escenario',
};
export const BALANCE_SOURCE_LABELS = {
  manual: 'Ingreso manual',
  contract: 'Cotización del contrato aprobado',
  quotation: 'Cotización',
};
