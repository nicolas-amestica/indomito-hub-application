/**
 * API pública del motor de cálculo.
 *
 * Son funciones puras, sin dependencias de Angular: reciben datos y devuelven
 * datos. Esa es la condición que las hace verificables con property-based
 * testing sin `TestBed`, y la razón por la que el cálculo del dinero vive acá y
 * no dentro de un store.
 *
 * Este archivo cubre las tasas efectivas por moneda, los dos derivados del
 * calendario y `calculateProgram`, que los consume para producir las filas de la
 * tabla de resumen y los totales del programa.
 *
 * Ver la sección "Motor de cálculo" de `design.md`.
 */

import { CHARGE_TYPE_LABELS, CREW_TYPE_LABEL } from '../constants/charge-types';
import type {
  CurrencyCode,
  EffectiveRates,
  ExchangeSnapshot,
  ProgramTotals,
  SummaryRow,
} from '../interfaces/program.interface';
import type { CalculationInput, PricingInput, ScheduleInput } from './calculation.types';
import { type ChargeableItem, baseAmount, isCrewItem } from './charge-type';
import { isPassengerIndependent } from './passenger-independent';
import { independentAmountCLP, perPassengerPrice } from './per-passenger-split';
import { ceil, round } from './rounding';
import {
  DEFAULT_TAX_SETTINGS,
  type TaxSettings,
} from '../../../core/configuration/app-configuration.service';

/** Milisegundos de un día. Exacto en UTC, donde no hay horario de verano. */
const MS_PER_DAY = 86_400_000;

/** Fecha ISO 8601 sin hora: `YYYY-MM-DD`. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Construye las tasas efectivas con las que el motor convierte cada ítem a CLP.
 *
 * La tasa efectiva de una divisa es la tasa del día más el incremento que el
 * usuario eligió para resguardar el margen (Requirement 4.6). El CLP no se
 * convierte: su tasa es exactamente 1 y ningún incremento la altera
 * (Requirement 4.7).
 *
 * @param pricing Parámetros de precio del formulario, de donde salen los dos incrementos.
 * @param snapshot Tipos de cambio del día, tal como los entregó el backend.
 * @returns Las tres tasas efectivas, en CLP por unidad de moneda.
 */
export function buildEffectiveRates(
  pricing: PricingInput,
  snapshot: ExchangeSnapshot,
): EffectiveRates {
  return {
    CLP: 1,
    USD: snapshot.usdToClp + pricing.usdIncreaseCLP,
    BRL: snapshot.brlToClp + pricing.brlIncreaseCLP,
  };
}

/**
 * Deriva los días totales del programa a partir del rango de fechas.
 *
 * Cuenta ambos extremos: un programa que empieza y termina el mismo día dura un
 * día, no cero (Requirement 3.2). Un rango invertido —fecha de término anterior
 * a la de inicio— vale 0, y el formulario acompaña ese 0 con un mensaje de
 * validación (Requirement 3.4). Un rango incompleto, que es el estado del
 * formulario recién abierto, también vale 0: no hay duración que derivar.
 *
 * La aritmética se hace en UTC a propósito. Restar fechas construidas en la zona
 * local produce diferencias de 23 o 25 horas en los días de cambio de horario, y
 * eso es un día de más o de menos en el programa según el mes en que caiga el
 * viaje.
 *
 * @param startDate Fecha de inicio en ISO 8601 (`YYYY-MM-DD`).
 * @param endDate Fecha de término en ISO 8601 (`YYYY-MM-DD`).
 * @returns Días calendario entre ambas fechas, ambos extremos incluidos, o 0 si
 *   el rango está invertido, incompleto o mal formado.
 */
export function deriveTotalDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  const start = isoDateToUtcMs(startDate);
  const end = isoDateToUtcMs(endDate);
  if (start === null || end === null) return 0;
  if (end < start) return 0;
  return (end - start) / MS_PER_DAY + 1;
}

/**
 * Deriva los pasajeros que pagan el programa.
 *
 * Es la diferencia entre pasajeros y liberados, con piso en 1
 * (Requirement 3.9). El piso no es cosmético: los pagantes son el divisor del
 * precio por persona, así que un 0 propagaría un infinito a la tabla de resumen.
 * El formulario impide de todas formas que los liberados igualen al total
 * (Requirement 3.8); este piso es lo que hace que el motor tampoco dependa de
 * esa validación.
 *
 * @param totalPassengers Pasajeros del programa, liberados incluidos.
 * @param freePassengers Pasajeros liberados.
 * @returns Pasajeros pagantes, nunca menor que 1.
 */
export function derivePayingPassengers(totalPassengers: number, freePassengers: number): number {
  return Math.max(1, totalPassengers - freePassengers);
}

/**
 * Resultado completo del cálculo.
 *
 * Incluye las filas para no recorrer dos veces las listas: la tabla de resumen y
 * los totales salen del mismo recorrido.
 */
export interface CalculationResult {
  /** Una fila por tripulante y una por servicio, en el orden en que se ingresaron. */
  rows: SummaryRow[];
  totals: ProgramTotals;
  /**
   * Neto **sin redondear**, en CLP.
   *
   * No vive en `ProgramTotals` porque ese contrato es el de la pantalla y el de
   * la exportación, donde todo monto en CLP es entero. Este número no se muestra:
   * es un insumo del propio motor, y por eso viaja aparte.
   *
   * Se conserva por dos razones, ambas del diseño:
   *
   * 1. Es la base de la utilidad (Requirement 8.1). Redondear antes propaga el
   *    error a la baja en programas con muchos ítems.
   * 2. Es el denominador de la partición pasajero-independiente
   *    (Requirement 8.7), que la tarea 6.2 implementa sobre este valor.
   */
  netRaw: number;
}

/**
 * Calcula el programa completo: las filas de la tabla de resumen y los totales.
 *
 * Recorre tripulantes y servicios una sola vez. De ese recorrido salen las filas
 * y los tres subtotales por moneda; de los subtotales sale el neto, y del neto la
 * utilidad, el recargo y el total.
 *
 * El orden de las operaciones no es intercambiable y está fijado por los
 * Requirements 7 y 8:
 *
 * ```text
 * amountCLP(item)   = baseAmount(item) × tasa efectiva de su moneda   (7.1)
 * subtotal(moneda)  = Σ baseAmount(item) de esa moneda, en esa moneda (7.2 a 7.4)
 * netRaw            = Σ subtotal(moneda) × tasa efectiva              sin redondear
 * netCLP            = round(netRaw)                                   (7.5)
 * utilityCLP        = ceil(netRaw × utilityRate / 100)                 (8.1)
 * netWithUtilityCLP = netCLP + utilityCLP                              (8.2)
 * totalCLP          = round(netWithUtilityCLP × (1 + rechargeRate/100))(8.3)
 * rechargeCLP       = totalCLP − netWithUtilityCLP                     (8.4)
 * ```
 *
 * Tres decisiones que el diseño hereda del legacy a propósito, porque cambiarlas
 * alteraría los montos de cotizaciones ya emitidas:
 *
 * - **La utilidad se calcula sobre `netRaw` y se suma a `netCLP`.** Mezclar la
 *   base sin redondear con la redondeada es discutible, pero la diferencia es de
 *   un peso y replicarlo garantiza que un programa recotizado dé el mismo número.
 * - **El recargo es compuesto**: se aplica sobre neto más utilidad, no sobre el
 *   neto.
 * - **`rechargeCLP` se obtiene por diferencia y no multiplicando el porcentaje.**
 *   Eso hace que `netCLP + utilityCLP + rechargeCLP` iguale exactamente a
 *   `totalCLP` por construcción, sin residuo de redondeo.
 *
 * El neto se compone en el orden CLP, USD, BRL, y cada subtotal se acumula de
 * forma independiente del orden de los ítems. Ver `sumAscending`.
 *
 * @param input Calendario, parámetros de precio, tasas efectivas y las dos listas.
 * @returns Las filas de la tabla, los totales del programa y el neto sin redondear.
 */
export function calculateProgram(
  input: CalculationInput,
  taxes: TaxSettings = DEFAULT_TAX_SETTINGS,
): CalculationResult {
  const { schedule, pricing, rates, crews, services } = input;

  const rows: SummaryRow[] = [];
  // Los montos base se juntan por moneda para convertirlos una sola vez, al
  // final. Convertir cada ítem y sumar los resultados daría el mismo número en
  // aritmética exacta, pero deja el neto expresado como una suma de productos
  // que ya no coincide, hasta el último bit, con los subtotales que la tabla
  // muestra en el pie (Requirement 7.2 a 7.4).
  const baseByCurrency: Record<CurrencyCode, number[]> = { CLP: [], USD: [], BRL: [] };
  const crewAmountsCLP: number[] = [];
  const serviceAmountsCLP: number[] = [];

  for (const [index, crew] of crews.entries()) {
    const row = buildRow(crew, index, schedule, rates);
    rows.push(row);
    baseByCurrency[row.currency].push(row.baseAmount);
    crewAmountsCLP.push(row.amountCLP);
  }

  for (const [index, service] of services.entries()) {
    const row = buildRow(service, index, schedule, rates);
    rows.push(row);
    baseByCurrency[row.currency].push(row.baseAmount);
    serviceAmountsCLP.push(row.amountCLP);
  }

  const subtotalCLP = sumAscending(baseByCurrency.CLP);
  const subtotalUSD = sumAscending(baseByCurrency.USD);
  const subtotalBRL = sumAscending(baseByCurrency.BRL);

  const netRaw = subtotalCLP * rates.CLP + subtotalUSD * rates.USD + subtotalBRL * rates.BRL;
  const netCLP = round(netRaw);
  const vatFactor = taxes.vatRate / 100;
  const vatCLP = round((sumAscending(serviceAmountsCLP) * vatFactor) / (1 + vatFactor));
  const crewWithholdingCLP = round(
    sumAscending(crewAmountsCLP) * (taxes.crewWithholdingRate / 100),
  );

  const utilityCLP = ceil((netRaw * pricing.utilityRate) / 100);
  const netWithUtilityCLP = netCLP + utilityCLP;
  const totalCLP = round(netWithUtilityCLP * (1 + pricing.rechargeRate / 100));
  const rechargeCLP = totalCLP - netWithUtilityCLP;
  const splitContext = {
    totalPassengers: schedule.totalPassengers,
    freePassengers: schedule.freePassengers,
    payingPassengers: derivePayingPassengers(schedule.totalPassengers, schedule.freePassengers),
    independentCLP: independentAmountCLP(rows),
    netRaw,
  };

  return {
    rows,
    netRaw,
    totals: {
      subtotalCLP,
      subtotalUSD,
      subtotalBRL,
      netCLP,
      vatCLP,
      crewWithholdingCLP,
      vatRate: taxes.vatRate,
      crewWithholdingRate: taxes.crewWithholdingRate,
      utilityCLP,
      netWithUtilityCLP,
      netWithUtilityPerPassengerCLP: perPassengerPrice(netWithUtilityCLP, splitContext),
      rechargeCLP,
      totalCLP,
      totalPerPassengerCLP: perPassengerPrice(totalCLP, splitContext),
    },
  };
}

/**
 * Construye la fila de resumen de un ítem, con su monto base y su monto en CLP.
 *
 * La fila se arma durante el recorrido del cálculo y no en un segundo pase sobre
 * las listas: el monto base ya está calculado acá, y volver a pedirlo después
 * duplicaría el trabajo y abriría la puerta a que la tabla muestre un número
 * distinto del que entró al neto.
 *
 * @param item Tripulante o servicio tal como el usuario lo ingresó.
 * @param index Posición del ítem **en su propia lista**, para la clave de la fila.
 * @param schedule Cantidades del calendario ya derivadas.
 * @param rates Tasas efectivas por moneda.
 */
function buildRow(
  item: ChargeableItem,
  index: number,
  schedule: ScheduleInput,
  rates: EffectiveRates,
): SummaryRow {
  const effectiveRate = rates[item.currency];
  const base = baseAmount(item, schedule);

  // Lo que distingue a un tripulante de un servicio en la tabla: no elige tipo
  // de cobro, tiene etiqueta propia (Requirement 9.5) y su precio unitario es el
  // precio diario.
  const shape = isCrewItem(item)
    ? {
        kind: 'crew' as const,
        chargeType: null,
        typeLabel: CREW_TYPE_LABEL,
        unitPrice: item.dailyPrice,
      }
    : {
        kind: 'service' as const,
        chargeType: item.chargeType,
        typeLabel: CHARGE_TYPE_LABELS[item.chargeType],
        unitPrice: item.unitPrice,
      };

  return {
    key: rowKey(shape.kind, item, index),
    name: item.name,
    ...shape,
    currency: item.currency,
    effectiveRate,
    baseAmount: base,
    // Requirement 7.1. Sin redondear: el redondeo del dinero ocurre una sola vez,
    // sobre el neto.
    amountCLP: base * effectiveRate,
    passengerIndependent: isPassengerIndependent(item),
  };
}

/**
 * Clave de una fila para el `track` del `@for` de la tabla de resumen.
 *
 * Es estable frente al recálculo, que es lo que la tabla necesita: no depende de
 * ningún valor que el usuario esté escribiendo, así que escribir en el nombre de
 * un servicio no recrea las 120 filas del DOM. Una clave derivada del contenido
 * tendría el defecto exactamente inverso.
 *
 * Cuando el ítem trae `id`, la clave también es estable frente a eliminar una
 * fila del medio de la lista. Sin `id` cae en la posición dentro de su lista,
 * que es lo único que el motor conoce: eliminar la tercera de diez desplaza las
 * claves de las siete siguientes y Angular las reconstruye una vez. El prefijo
 * evita que un tripulante y un servicio de la misma posición colisionen.
 */
function rowKey(kind: SummaryRow['kind'], item: ChargeableItem, index: number): string {
  return `${kind}:${item.id ?? `#${index}`}`;
}

/**
 * Suma una lista de montos de forma independiente del orden en que llegaron.
 *
 * La suma de punto flotante no es asociativa: `0,1 + 0,2 + 0,3` y
 * `0,3 + 0,2 + 0,1` difieren en el último bit. Con eso, permutar los servicios
 * del programa podría mover el neto un peso, y el neto de un programa no puede
 * depender del orden en que se tipearon sus filas (Requirement 7.5).
 *
 * Ordenar los montos antes de sumarlos convierte la suma en una función del
 * conjunto de valores y no de la secuencia: dos permutaciones de la misma lista
 * producen el mismo arreglo ordenado y, por lo tanto, exactamente el mismo
 * número. De paso, sumar de menor a mayor es lo que menos error acumula, porque
 * evita que un monto chico se pierda contra un acumulador grande.
 *
 * El costo es despreciable: el programa admite como máximo 120 filas.
 */
function sumAscending(values: number[]): number {
  return [...values].sort((first, second) => first - second).reduce((sum, value) => sum + value, 0);
}

/**
 * Convierte una fecha ISO 8601 sin hora a milisegundos UTC.
 *
 * Devuelve `null` para lo que no sea una fecha real: cadena vacía, formato
 * distinto, mes 13 o el 29 de febrero de un año común. Se comprueban los
 * componentes de vuelta porque `Date.UTC` no rechaza un día fuera de rango, lo
 * desborda al mes siguiente, y un rango calculado sobre una fecha desbordada
 * daría un total de días plausible pero equivocado.
 */
function isoDateToUtcMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);

  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? ms : null;
}
