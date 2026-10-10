export interface AttemptReconciliationRequest {
  commandId: string;
  paymentId?: string;
  reason: string;
}
export interface AttemptReconciliationState {
  attemptId: string;
  paymentId: string;
  status: 'PENDING' | 'CONFIRMED' | 'REVIEW_REQUIRED' | 'UNPAID_FINAL' | 'REVERSED';
  providerStatus?: string;
  providerDetail?: string;
  amount: number;
}
export interface AccountAttemptSummary {
  id: string;
  installmentId: string;
  amount: number;
  status: string;
}
export interface AccountAttemptPage {
  items: AccountAttemptSummary[];
  nextCursor?: string;
}
