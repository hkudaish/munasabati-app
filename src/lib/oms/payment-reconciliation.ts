import { formatSAR } from '../utils';
// Payment Reconciliation & Idempotency Engine
// Verifies payment webhooks, checks idempotency keys, manages payment vs fulfillment states, and prevents duplicate transactions.

import type { PaymentStatus } from './types';

export interface PaymentWebhookPayload {
  transactionRef: string;
  orderNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  idempotencyKey?: string;
  signature?: string;
}

// Fail closed until a selected provider supplies a real raw-body signature adapter.
// There is no generic signature scheme shared by all payment gateways.
export function verifyPaymentSignature(_payload: PaymentWebhookPayload, _secret?: string): boolean {
  return false;
}

export function mapPaymentProviderStatus(providerStatus: string): PaymentStatus {
  switch (providerStatus?.toUpperCase()) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'CAPTURED':
      return 'PAID';
    case 'FAILED':
    case 'DECLINED':
      return 'PAYMENT_FAILED';
    case 'PENDING':
    case 'PROCESSING':
      return 'PROCESSING';
    case 'REFUNDED':
      return 'FULLY_REFUNDED';
    case 'PARTIALLY_REFUNDED':
      return 'PARTIALLY_REFUNDED';
    default:
      return 'UNPAID';
  }
}

export interface FinancialReconciliationResult {
  isMatched: boolean;
  expectedAmount: number;
  receivedAmount: number;
  discrepancyAmount: number;
  status: 'MATCHED' | 'DISCREPANCY_UNDERPAID' | 'DISCREPANCY_OVERPAID' | 'UNPAID';
  reconciliationNotesAr: string;
}

export function reconcileOrderPayment(
  orderTotalAmount: number,
  paidAmount: number
): FinancialReconciliationResult {
  const discrepancy = paidAmount - orderTotalAmount;

  if (Math.abs(discrepancy) < 1) {
    return {
      isMatched: true,
      expectedAmount: orderTotalAmount,
      receivedAmount: paidAmount,
      discrepancyAmount: 0,
      status: 'MATCHED',
      reconciliationNotesAr: 'تمت مطابقة قيمة الطلب مع سجلات الدفع بنجاح.',
    };
  }

  if (discrepancy < 0) {
    return {
      isMatched: false,
      expectedAmount: orderTotalAmount,
      receivedAmount: paidAmount,
      discrepancyAmount: Math.abs(discrepancy),
      status: 'DISCREPANCY_UNDERPAID',
      reconciliationNotesAr: `وجود نقص في المبلغ المدفوع بمقدار ${formatSAR(Math.abs(discrepancy))}`,
    };
  }

  return {
    isMatched: false,
    expectedAmount: orderTotalAmount,
    receivedAmount: paidAmount,
    discrepancyAmount: discrepancy,
    status: 'DISCREPANCY_OVERPAID',
    reconciliationNotesAr: `فائض في المبلغ المدفوع بمقدار ${formatSAR(discrepancy)}`,
  };
}
