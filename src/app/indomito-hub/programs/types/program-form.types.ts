/**
 * Tipos del formulario de programa: la forma de cada grupo de controles y los
 * valores que produce `getRawValue()`.
 *
 * Viven en su propio archivo porque los consumen tres capas distintas —el
 * builder que los construye, los paneles que reciben un grupo por input y el
 * store que lee cada sección— y ninguna de esas tres debería importar a las
 * otras solo para nombrar un tipo.
 *
 * ## Qué se declara y qué no
 *
 * Los controles declaran **solo lo que el usuario escribe**. No hay tipos para
 * `totalDays`, `payingPassengers`, `baseAmount`, `amountCLP`, las tasas efectivas
 * ni los nueve campos de `ProgramTotals`: el motor de cálculo los produce a
 * partir de estos valores, y guardarlos como controles es el patrón que el
 * diseño descarta explícitamente. Ver "Manejo de estado del formulario" en
 * `design.md`.
 *
 * ## Por qué casi todo es anulable
 *
 * Un selector sin elegir y un campo numérico vacío valen `null`, y ese `null` es
 * la razón por la que `Validators.required` tiene algo que rechazar. Declararlos
 * como `number` a secas obligaría a inventar un valor inicial —un `0` de
 * utilidad, por ejemplo— que es justo el modo de falla silencioso que el
 * Requirement 4 quiere evitar. Los campos de texto sí son no anulables: un
 * `input` vacío produce la cadena vacía, no `null`.
 *
 * La consecuencia para el store (tarea 9.3) es que `ProgramFormValue` no es
 * asignable a la entrada del motor sin proyectar: el motor recibe números y el
 * formulario entrega `number | null`. Esa proyección ocurre una vez, cuando el
 * formulario ya es válido, y es deliberada: es el punto donde se comprueba que
 * hay datos suficientes para calcular.
 */

import type { FormArray, FormControl, FormGroup } from '@angular/forms';
import type { CatalogOption, DestinationOption } from '../interfaces/catalog.interface';
import type { ChargeType, CurrencyCode } from '../interfaces/program.interface';

/**
 * Controles de los datos generales (Requirement 2.1). `plan` y `season` guardan
 * la opción completa del catálogo y no solo su `id`, porque el `CatalogRef` del
 * contrato necesita también el `display`; `destination` guarda la opción de
 * destino completa porque el cuerpo del `Budget_Pdf_Endpoint` necesita además su
 * `budgetTemplateId`.
 */
export interface GeneralsControls {
  name: FormControl<string>;
  /** Opcional por el Requirement 2.3. La cadena vacía se proyecta a `null`. */
  description: FormControl<string>;
  plan: FormControl<CatalogOption | null>;
  season: FormControl<CatalogOption | null>;
  destination: FormControl<DestinationOption | null>;
  departureCity: FormControl<string>;
}

/**
 * Controles de duración y cantidades. El programa expresa una duración, pero
 * no fechas de calendario; esas pertenecen al contrato posterior.
 */
export interface ScheduleControls {
  totalDays: FormControl<number | null>;
  totalNights: FormControl<number | null>;
  totalPassengers: FormControl<number | null>;
  freePassengers: FormControl<number | null>;
}

/**
 * Controles de los parámetros de precio (Requirement 4.1).
 *
 * El snapshot de tipo de cambio no es un control: llega del backend, vive en el
 * `ExchangeRateStore` y se adjunta al armar el `Program`. Las tasas efectivas
 * tampoco, porque son derivadas de estos incrementos más ese snapshot.
 */
export interface PricingControls {
  usdIncreaseCLP: FormControl<number | null>;
  brlIncreaseCLP: FormControl<number | null>;
  utilityRate: FormControl<number | null>;
  rechargeRate: FormControl<number | null>;
}

/**
 * Controles de una fila de tripulante (Requirement 5.2).
 *
 * `id` es la única excepción a la regla de que el formulario contiene solo lo
 * que el usuario escribe, y no la contradice: no es un dato del programa ni un
 * resultado de cálculo, sino la identidad de la fila. El motor la usa como `key`
 * estable de `SummaryRow` para que el `@for` de la tabla reutilice los nodos del
 * DOM al eliminar una fila del medio de la lista. Ver `ItemIdentity` en
 * `calculation/calculation.types.ts`.
 */
export interface CrewRowControls {
  id: FormControl<string>;
  name: FormControl<string>;
  documentId: FormControl<string>;
  dailyPrice: FormControl<number | null>;
  currency: FormControl<CurrencyCode | null>;
}

/** Controles de una fila de servicio (Requirement 6.2). `id`, igual que en la fila de tripulante. */
export interface ServiceRowControls {
  id: FormControl<string>;
  name: FormControl<string>;
  chargeType: FormControl<ChargeType | null>;
  unitPrice: FormControl<number | null>;
  currency: FormControl<CurrencyCode | null>;
}

/** Grupo de una fila de tripulante. */
export type CrewRowGroup = FormGroup<CrewRowControls>;

/** Grupo de una fila de servicio. */
export type ServiceRowGroup = FormGroup<ServiceRowControls>;

/** Lista de tripulantes. Nunca queda vacía (Requirements 5.1 y 5.7). */
export type CrewArray = FormArray<CrewRowGroup>;

/** Lista de servicios. Nunca queda vacía (Requirements 6.1 y 6.14). */
export type ServiceArray = FormArray<ServiceRowGroup>;

/**
 * Las cinco secciones del formulario. La división en secciones no es
 * cosmética: es lo que permite que el store se suscriba **por sección** y que
 * escribir en el nombre de un servicio no recalcule lo que depende de
 * `schedule` ni de `pricing`.
 */
export interface ProgramFormControls {
  generals: FormGroup<GeneralsControls>;
  schedule: FormGroup<ScheduleControls>;
  pricing: FormGroup<PricingControls>;
  crews: CrewArray;
  services: ServiceArray;
}

/** El formulario completo. */
export type ProgramFormGroup = FormGroup<ProgramFormControls>;

/** Valor de una fila de tripulante tal como lo entrega `getRawValue()`. */
export type CrewRowValue = ReturnType<CrewRowGroup['getRawValue']>;

/** Valor de una fila de servicio tal como lo entrega `getRawValue()`. */
export type ServiceRowValue = ReturnType<ServiceRowGroup['getRawValue']>;

/**
 * Valor completo del formulario tal como lo entrega `getRawValue()`. El store
 * indexa sus secciones con `keyof ProgramFormValue`.
 */
export type ProgramFormValue = ReturnType<ProgramFormGroup['getRawValue']>;
