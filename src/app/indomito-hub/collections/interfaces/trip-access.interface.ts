export interface TripAccessView {
  tripId: string;
  tripCode?: string;
  version: number;
  status: 'ACTIVE' | 'REVOKED';
  updatedAt?: string;
}
export interface TripAccessRequest {
  commandId: string;
  reason: string;
  version: number;
}
