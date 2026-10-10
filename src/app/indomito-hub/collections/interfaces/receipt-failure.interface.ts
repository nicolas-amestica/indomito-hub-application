export interface ReceiptFailure {
  receiptId: string;
  deliveryId?: string;
  failureCode: string;
  deliveryAttempts: number;
}
export interface ReceiptFailurePage {
  items: ReceiptFailure[];
  nextCursor?: string;
}
export interface ReceiptFailureRetryRequest {
  commandId: string;
  deliveryId?: string;
  reason: string;
}
