import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

const FIELD_LABELS: Record<string, string> = {
  programId: 'Programa guardado',
  period: 'Período',
  'representatives[].name': 'Nombre del representante de Giras Indómito',
  'representatives[].dni': 'RUT del representante de Giras Indómito',
  'institution.name': 'Establecimiento',
  'institution.course': 'Curso',
  'institution.address': 'Dirección de salida',
  'clientRepresentatives[].name': 'Nombre del representante del cliente',
  'clientRepresentatives[].dni': 'RUT del representante del cliente',
  'clientRepresentatives[].course': 'Curso del representante del cliente',
  'trip.city': 'Ciudad de firma',
  'trip.contractDate': 'Fecha del contrato',
  'trip.destination': 'Destino',
  'trip.travelRange': 'Fecha de salida y retorno',
  'trip.days': 'Días',
  'trip.nights': 'Noches',
  'trip.departurePoint': 'Punto de salida',
  'plan.name': 'Nombre del programa',
  'plan.servicesIncluded[].description': 'Descripción del servicio incluido',
  'payments.freePassengers': 'Pasajeros liberados',
  'payments.pricePerPerson': 'Precio por persona',
  'payments.downPayment': 'Abono inicial',
  'payments.daysBeforePayment': 'Días límite de pago',
  'payments.maxExchangeRate': 'Tipo de cambio máximo',
  'payments.installments.quantity': 'Cantidad de cuotas',
  'payments.installments.startMonth': 'Mes de inicio de cuotas',
  'payments.bankAccount.accountNumber': 'Número de cuenta bancaria',
  'payments.bankAccount.accountHolder': 'Titular de la cuenta bancaria',
  'payments.bankAccount.holderDNI': 'RUT del titular de la cuenta bancaria',
  'payments.bankAccount.bank': 'Banco y tipo de cuenta',
  'payments.bankAccount.email': 'Correo para comprobantes',
  'passengers[].names': 'Nombres del pasajero',
  'passengers[].lastNames': 'Apellidos del pasajero',
  'passengers[].dni': 'RUT del pasajero',
  'passengers[].birthDate': 'Fecha de nacimiento del pasajero',
  'passengers[].nationality': 'Nacionalidad del pasajero',
  'passengers[].sex': 'Sexo del pasajero',
};

/** Devuelve etiquetas visibles para todos los controles inválidos del formulario. */
export function getInvalidContractFields(control: AbstractControl): string[] {
  const invalid = new Set<string>();
  visit(control, [], invalid);
  return [...invalid];
}

function visit(control: AbstractControl, path: string[], invalid: Set<string>): void {
  if (control.disabled) return;
  if (control instanceof FormGroup) {
    for (const [key, child] of Object.entries(control.controls))
      visit(child, [...path, key], invalid);
    return;
  }
  if (control instanceof FormArray) {
    control.controls.forEach((child, index) => visit(child, [...path, String(index)], invalid));
    return;
  }
  if (!control.invalid) return;
  const normalized = path.join('.').replace(/\.\d+(?=\.|$)/g, '[]');
  invalid.add(FIELD_LABELS[normalized] ?? path.at(-1) ?? 'Campo obligatorio');
}
