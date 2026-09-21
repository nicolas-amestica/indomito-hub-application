/**
 * Origen del valor de noches durante la sesión de edición.
 *
 * Es estado de interacción y no un dato del programa, por eso vive como signal
 * del store y nunca como control del formulario.
 */
export type NightsSource = 'preloaded' | 'user';

/** Calcula la precarga de noches para una duración derivada. */
export function preloadedNights(totalDays: number): number {
  return Math.max(1, totalDays - 1);
}
