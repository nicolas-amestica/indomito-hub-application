import type { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/auth.guard';
export const COLLECTIONS_ROUTES: Routes = [
  {
    path: 'documentos-tributarios',
    title: 'Boletas pendientes de emisión',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/tax-documents/tax-documents.page').then((m) => m.TaxDocumentsPage),
  },
  {
    path: 'comprobantes/fallos',
    title: 'Entregas fallidas de comprobantes',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/receipt-failures/receipt-failures.page').then((m) => m.ReceiptFailuresPage),
  },
  {
    path: 'tesoreria',
    title: 'Caja consolidada',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/consolidated-cash/consolidated-cash.page').then(
        (m) => m.ConsolidatedCashPage,
      ),
  },
  {
    path: 'alertas',
    title: 'Grupos con cobros pendientes',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/global-collection-alerts/global-collection-alerts.page').then(
        (m) => m.GlobalCollectionAlertsPage,
      ),
  },
  {
    path: 'intentos/:id/conciliacion',
    title: 'Conciliar intento Khipu',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/attempt-reconciliation/attempt-reconciliation.page').then(
        (m) => m.AttemptReconciliationPage,
      ),
  },
  {
    path: 'giras/:id/tesoreria',
    title: 'Tesorería de gira',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/trip-treasury/trip-treasury.page').then((m) => m.TripTreasuryPage),
  },
  {
    path: 'giras/:id/proveedores',
    title: 'Proveedores de gira',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/trip-suppliers/trip-suppliers.page').then((m) => m.TripSuppliersPage),
  },
  {
    path: 'giras/:id/devoluciones',
    title: 'Devoluciones de gira',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/trip-refunds/trip-refunds.page').then((m) => m.TripRefundsPage),
  },
  {
    path: 'giras/:id/alertas',
    title: 'Alertas de cobranza',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/collection-alerts/collection-alerts.page').then(
        (m) => m.CollectionAlertsPage,
      ),
  },
  {
    path: 'giras/:id/acceso',
    title: 'Acceso al portal de pagos',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/trip-access/trip-access.page').then((m) => m.TripAccessPage),
  },
  {
    path: 'giras/:id/abono-grupal',
    title: 'Abono grupal recibido',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/group-deposit/group-deposit.page').then((m) => m.GroupDepositPage),
  },
  {
    path: 'giras/:id/descuento-grupal',
    title: 'Descuento grupal',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/group-discount/group-discount.page').then((m) => m.GroupDiscountPage),
  },
  {
    path: 'giras/:id/anexos/nuevo',
    title: 'Anexo de nómina',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () => import('./pages/annex-form/annex-form.page').then((m) => m.AnnexFormPage),
  },
  {
    path: 'cuentas/:id',
    title: 'Cuenta de cobranza',
    data: { module: 'PAYMENT_OPERATIONS' },
    canActivate: [moduleGuard],
    loadComponent: () =>
      import('./pages/account-operations/account-operations.page').then(
        (m) => m.AccountOperationsPage,
      ),
  },
];
