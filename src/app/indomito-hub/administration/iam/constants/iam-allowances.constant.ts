import type { IamAllowanceOption } from '../interfaces/iam-form.interface';

export const IAM_ALLOWANCE_OPTIONS: readonly IamAllowanceOption[] = [
  { code: 'c', label: 'Crear' },
  { code: 'r', label: 'Leer' },
  { code: 'u', label: 'Editar' },
  { code: 'd', label: 'Eliminar' },
];
