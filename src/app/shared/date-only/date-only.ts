/** Fecha civil sin hora ni zona horaria, serializada para la API. */
export type DateOnly = `${number}-${number}-${number}`;

export function isDateOnly(value: string): value is DateOnly {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dateOnlyToLocalDate(value: string | null | undefined): Date | null {
  if (!value || !isDateOnly(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function localDateToDateOnly(value: Date | null | undefined): DateOnly | '' {
  if (!value || Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as DateOnly;
}

export function todayDateOnly(): DateOnly {
  return localDateToDateOnly(new Date()) as DateOnly;
}
