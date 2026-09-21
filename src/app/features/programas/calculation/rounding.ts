/**
 * Redondeo centralizado del motor de cálculo.
 *
 * El motor redondea en cuatro lugares distintos —el neto, la utilidad, el total
 * y el precio por persona— y cada uno lo hace en un sentido que el Requirement 7
 * y el Requirement 8 fijan explícitamente. Concentrar las dos operaciones acá
 * evita que un `Math.ceil` se cuele donde la regla pedía `Math.round`, y deja un
 * único punto donde cambiar el criterio si alguna vez hay que hacerlo.
 *
 * Ambas funciones son puras y sin dependencias de Angular. Ver la sección
 * "Motor de cálculo" de `design.md`.
 */

/**
 * Redondea al entero más cercano. Es el redondeo del neto (Requirement 7.5) y
 * del total del programa (Requirement 8.3).
 *
 * Los empates suben: `0,5` da `1`. Sobre negativos eso significa que suben hacia
 * el cero (`-0,5` da `-0`), un detalle que el dominio no alcanza porque los
 * montos del programa nunca son negativos.
 */
export function round(value: number): number {
  return Math.round(value);
}

/**
 * Redondea hacia arriba al entero más cercano. Es el redondeo de la utilidad
 * (Requirement 8.1) y del precio por persona (Requirements 8.5, 8.6 y 8.8).
 *
 * El sentido hacia arriba no es estético: es lo que garantiza que el precio por
 * persona multiplicado por los pagantes nunca recaude menos que el monto que se
 * está repartiendo.
 */
export function ceil(value: number): number {
  return Math.ceil(value);
}
