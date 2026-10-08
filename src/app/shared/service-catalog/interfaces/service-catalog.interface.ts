export type ServiceCatalogChargeType =
  'fixed' | 'per_passenger' | 'per_passenger_night' | 'per_day' | 'per_passenger_day';
export type ServiceCatalogCurrency = 'CLP' | 'USD' | 'BRL';

export interface ServiceCatalogItem {
  readonly id: string;
  readonly scope: 'CTZ';
  readonly glosa: string;
  readonly description?: string;
  readonly price: number;
  readonly currency: ServiceCatalogCurrency;
  readonly chargeType: ServiceCatalogChargeType;
  readonly active: boolean;
  readonly default: boolean;
  readonly updatedAt?: string;
}

export type ServiceCatalogInput = Omit<ServiceCatalogItem, 'id' | 'scope' | 'updatedAt'>;

export interface ServiceCatalogList {
  readonly items: ServiceCatalogItem[];
}
