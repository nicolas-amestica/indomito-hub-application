export interface GroupDiscountDraftRequest {
  id: string;
  accountIds: string[];
  basisPoints: number;
  reason: string;
}
export interface GroupDiscountApprovalRequest {
  commandId: string;
  reason: string;
}
export interface GroupDiscountState {
  id: string;
  tripId: string;
  status: 'PREPARING' | 'DRAFT' | 'VALIDATING' | 'APPLYING' | 'REJECTED' | 'APPLIED';
  basisPoints: number;
  expected: number;
  prepared: number;
  applied: number;
  amount: number;
}
