/**
 * Contrato de datos del programa. Es la evolución del contrato propuesto en
 * `requirements.md`, con los agregados que introdujo el diseño (`SummaryRow`,
 * `ScenarioShape`, `EffectiveRates`, `BudgetRequest`). Ver el "Contrato de datos
 * propuesto" de `requirements.md` y la sección de interfaces de `design.md`.
 */

import type { DestinationOption } from './catalog.interface';

/** Tipo de cobro de un servicio. Define el multiplicador del precio unitario. */
export type ChargeType =
  | 'fixed' // Valor único: precio fijo, independiente de pasajeros y días
  | 'per_passenger' // Valor una vez por pasajero
  | 'per_passenger_night' // Valor por pasajero por noche
  | 'per_day' // Valor por día, independiente de la cantidad de pasajeros
  | 'per_passenger_day'; // Valor por pasajero por día

/** Monedas soportadas por el cálculo del programa. */
export type CurrencyCode = 'CLP' | 'USD' | 'BRL';

/** Proveedor que originó las tasas antes de cualquier lectura desde caché. */
export type ExchangeRateSource = 'banco-central' | 'currency-api' | 'unknown';

/** Referencia a una entidad de catálogo. */
export interface CatalogRef {
  id: string;
  display: string;
}

/** Datos generales del programa. */
export interface ProgramGeneral {
  name: string;
  description: string | null;
  plan: CatalogRef;
  season: CatalogRef;
  destination: CatalogRef;
  departureCity: string;
}

/** Duración y cantidades del programa. */
export interface ProgramSchedule {
  /** Duración editable del programa; no representa fechas contractuales. */
  totalDays: number;
  /** Precargado como `totalDays − 1`, sobrescribible por el usuario. */
  totalNights: number;
  totalPassengers: number;
  freePassengers: number;
  /** Derivado: `max(1, totalPassengers - freePassengers)`. */
  payingPassengers: number;
}

/** Parámetros de precio y resguardo de tipo de cambio. */
export interface ProgramPricing {
  /** Monto absoluto en CLP sumado a la tasa del USD. */
  usdIncreaseCLP: number;
  /** Monto absoluto en CLP sumado a la tasa del BRL. */
  brlIncreaseCLP: number;
  /** Porcentaje, 0 a 100. */
  utilityRate: number;
  /** Porcentaje, 0 a 100. */
  rechargeRate: number;
  exchange: ExchangeSnapshot;
}

/**
 * Tipos de cambio con los que se calcula el programa. No se persiste, porque el
 * programa no se persiste: se obtiene al abrir el formulario y vive en memoria.
 */
export interface ExchangeSnapshot {
  /** ISO 8601, fecha informada por la fuente de tasas. */
  date: string;
  usdToClp: number;
  brlToClp: number;
  source: ExchangeRateSource;
  /** Verdadero cuando los valores provienen del último snapshot conocido y no de la fuente externa. */
  isFallback: boolean;
}

/** Procedencia persistible de las tasas, sin conservar valores reutilizables. */
export type ExchangeRateOrigin = Pick<ExchangeSnapshot, 'date' | 'source' | 'isFallback'>;

/** Tasas efectivas por moneda. Derivadas del snapshot y los incrementos (tasa del día + incremento). */
export interface EffectiveRates {
  CLP: 1;
  USD: number;
  BRL: number;
}

/** Tripulante del programa. Su costo siempre es `dailyPrice × totalDays`. */
export interface CrewMember {
  name: string;
  /** RUT chileno, DNI argentino o CPF brasileño. */
  documentId: string;
  dailyPrice: number;
  currency: CurrencyCode;
  /** Derivado: `dailyPrice × totalDays`, en su moneda. */
  baseAmount: number;
  /** Derivado: `baseAmount × tasa efectiva`. */
  amountCLP: number;
}

/** Servicio contratado del programa. */
export interface ProgramService {
  name: string;
  chargeType: ChargeType;
  unitPrice: number;
  currency: CurrencyCode;
  /** Derivado según `chargeType`, en su moneda. */
  baseAmount: number;
  /** Derivado: `baseAmount × tasa efectiva`. */
  amountCLP: number;
}

/** Totales calculados del programa, todos en CLP salvo los subtotales en divisa. */
export interface ProgramTotals {
  /** Suma de ítems en CLP. */
  subtotalCLP: number;
  /** Suma de ítems en USD, expresada en USD. */
  subtotalUSD: number;
  /** Suma de ítems en BRL, expresada en BRL. */
  subtotalBRL: number;
  /** Neto: todo convertido a CLP. */
  netCLP: number;
  /** IVA incluido en el total de servicios, extraído con tasa 19%. */
  vatCLP: number;
  /** Retención de honorarios incluida en el total bruto de tripulación. */
  crewWithholdingCLP: number;
  vatRate: number;
  crewWithholdingRate: number;
  utilityCLP: number;
  netWithUtilityCLP: number;
  netWithUtilityPerPassengerCLP: number;
  rechargeCLP: number;
  totalCLP: number;
  totalPerPassengerCLP: number;
}

/**
 * Programa completo. Es el objeto que el formulario construye para la
 * previsualización, la exportación y el contenido del favorito. No se envía a
 * ningún endpoint de persistencia, porque no existe.
 */
export interface Program {
  generals: ProgramGeneral;
  schedule: ProgramSchedule;
  pricing: ProgramPricing;
  crews: CrewMember[];
  services: ProgramService[];
  totals: ProgramTotals;
}

/** Fila de la Summary_Table. Se construye durante el cálculo, no después. */
export interface SummaryRow {
  /** Clave estable para `track` de `@for`. No se persiste. */
  key: string;
  name: string;
  kind: 'crew' | 'service';
  /** `null` para tripulantes. */
  chargeType: ChargeType | null;
  typeLabel: string;
  currency: CurrencyCode;
  effectiveRate: number;
  unitPrice: number;
  baseAmount: number;
  amountCLP: number;
  /** Verdadero para tripulantes y para servicios `fixed` y `per_day`. */
  passengerIndependent: boolean;
}

/** Cantidades de un escenario, antes de calcular su precio. Salida de `deriveScenarios`. */
export interface ScenarioShape {
  /** Pasajeros del programa + desplazamiento, acotado a mínimo 1. */
  totalPassengers: number;
  /** Derivado de la proporción de liberados del programa. */
  freePassengers: number;
  /** Derivado: `totalPassengers − freePassengers`, mínimo 1. */
  payingPassengers: number;
}

/** Escenario del presupuesto, ya con su precio. Se envía al Budget_Pdf_Endpoint. */
export interface BudgetScenario extends ScenarioShape {
  /** Calculado por el Calculation_Engine. */
  pricePerPassengerCLP: number;
}

/** Cuerpo de `POST /programas:presupuesto` (Requirement 13.10). */
export interface BudgetRequest {
  programName: string;
  destination: DestinationOption;
  departureCity: string;
  totalDays: number;
  totalNights: number;
  serviceNames: string[];
  scenarios: BudgetScenario[];
}
