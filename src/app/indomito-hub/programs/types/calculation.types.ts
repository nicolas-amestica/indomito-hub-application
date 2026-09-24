/**
 * Tipos de entrada del motor de cálculo.
 *
 * Son las formas que el motor recibe: **solo lo que el usuario escribe**. Los
 * campos derivados (`baseAmount`, `amountCLP`, `totalDays`, `payingPassengers`)
 * no viven acá, porque el motor los produce en lugar de recibirlos. Las formas
 * completas del dominio, con sus derivados, están en
 * `../interfaces/program.interface.ts`.
 *
 * Este archivo existe antes que el motor porque los generadores de `fast-check`
 * (tarea 3.1) necesitan tipar sus salidas, y el motor (tarea 4) importa desde
 * acá en vez de redeclarar. Ver la sección "Motor de cálculo" de `design.md`.
 */

import type { ChargeType, CurrencyCode, EffectiveRates } from '../interfaces/program.interface';

/**
 * Cantidades del calendario que el cálculo necesita. `totalDays` llega ya
 * derivado del rango de fechas y vale 0 cuando el rango está invertido
 * (Requirement 3.4).
 */
export interface ScheduleInput {
  totalDays: number;
  totalNights: number;
  totalPassengers: number;
  freePassengers: number;
}

/**
 * Parámetros de precio que el usuario elige. Los dos incrementos alimentan a
 * `buildEffectiveRates`; las dos tasas, al tramo de utilidad y recargo.
 */
export interface PricingInput {
  /** Monto absoluto en CLP sumado a la tasa del USD. */
  usdIncreaseCLP: number;
  /** Monto absoluto en CLP sumado a la tasa del BRL. */
  brlIncreaseCLP: number;
  /** Porcentaje, 0 a 100. */
  utilityRate: number;
  /** Porcentaje, 0 a 100. */
  rechargeRate: number;
}

/**
 * Identidad opcional de una fila del programa.
 *
 * No es un dato del negocio: no se muestra, no se exporta y no participa de
 * ningún monto. Existe solo para que `calculateProgram` pueda darle a cada
 * `SummaryRow` una `key` estable con la que el `@for` de la tabla de resumen
 * reutilice los nodos del DOM.
 *
 * Es opcional porque la estabilidad que la tabla necesita es frente al
 * **recálculo**, y esa el motor la garantiza siempre: la posición de una fila no
 * cambia mientras el usuario escribe. Lo que la posición no sobrevive es a
 * eliminar una fila del medio de la lista, que desplaza las claves de todas las
 * siguientes. Cuando el formulario le asigna un `id` a cada fila al crearla, la
 * clave también sobrevive a eso.
 */
export interface ItemIdentity {
  /** Identificador estable de la fila, asignado por el formulario al crearla. */
  id?: string;
}

/** Tripulante tal como se ingresa. Su monto base siempre es `dailyPrice × totalDays`. */
export interface CrewInput extends ItemIdentity {
  name: string;
  /** RUT chileno, DNI argentino o CPF brasileño. */
  documentId: string;
  dailyPrice: number;
  currency: CurrencyCode;
}

/** Servicio tal como se ingresa. Su monto base depende de `chargeType`. */
export interface ServiceInput extends ItemIdentity {
  name: string;
  chargeType: ChargeType;
  unitPrice: number;
  currency: CurrencyCode;
}

/** Entrada completa del cálculo. Todo lo que el motor necesita, nada más. */
export interface CalculationInput {
  schedule: ScheduleInput;
  pricing: PricingInput;
  rates: EffectiveRates;
  crews: CrewInput[];
  services: ServiceInput[];
}
