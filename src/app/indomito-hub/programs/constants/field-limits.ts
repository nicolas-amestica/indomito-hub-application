/**
 * Límites numéricos de los campos del programa. Única fuente de rangos para
 * esta feature: de aquí se derivan los validadores del formulario y los
 * atributos de los controles de PrimeNG. Ver la tabla "Límites de los campos
 * numéricos" de `requirements.md`.
 *
 * Su gemelo en Go vive en `libs/domain/program/limits.go` (tarea 12.5) y
 * declara los mismos valores. Una divergencia entre ambos es un defecto.
 */
export const FIELD_LIMITS = {
  /** Derivado del rango de fechas. Requirement 3.6. */
  totalDays: { min: 1, max: 100, step: 1 },
  /** Requirement 3.6. */
  totalNights: { min: 0, max: 100, step: 1 },
  /** Requirement 3.6. */
  totalPassengers: { min: 1, max: 100, step: 1 },
  /** Siempre menor que `totalPassengers`. Requirement 3.7. */
  freePassengers: { min: 0, max: 99, step: 1 },
  /** Monto absoluto en CLP. Requirement 4.2. */
  usdIncreaseCLP: { min: 0, max: 200, step: 5 },
  /** Monto absoluto en CLP. Requirement 4.3. */
  brlIncreaseCLP: { min: 0, max: 40, step: 5 },
  /** Porcentaje. Requirement 4.4. */
  utilityRate: { min: 0, max: 100, step: 1 },
  /** Porcentaje. Requirement 4.4. */
  rechargeRate: { min: 0, max: 100, step: 1 },
  /**
   * Precio unitario de tripulantes (`dailyPrice`) y servicios (`unitPrice`).
   * Entero obligatorio cuando la moneda del ítem es CLP; esa restricción la
   * aplica el validador (tarea 8.5), no este objeto.
   */
  itemPrice: { min: 0.01, max: 99_999_999 },
  /**
   * Tope de filas de la lista de tripulantes. Requirement 6.18.
   *
   * No es un rango de campo sino un largo máximo de `FormArray`, así que no
   * tiene `min` ni `step`: lo aplica el builder del formulario al agregar una
   * fila, no `numericRangeValidator`.
   */
  maxCrews: 20,
  /** Tope de filas de la lista de servicios. Requirement 6.18. */
  maxServices: 100,
  /** Largo mínimo del nombre del programa sobre el valor recortado. Requirement 2.5. */
  nameMinLength: 3,
} as const;
