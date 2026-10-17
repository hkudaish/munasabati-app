import type { OMSOrderStatus } from './types';

// The parent summarizes progress; every supplier keeps its independent workflow.
export function aggregateMasterOrderStatus(suborders: { omsStatus: OMSOrderStatus }[]): OMSOrderStatus {
  if (!suborders.length) return 'CREATED';
  const states = suborders.map(s => s.omsStatus);
  if (states.every(s => ['CLOSED','COMPLETED'].includes(s))) return 'COMPLETED';
  if (states.every(s => ['CANCELLED','REFUNDED','UNFULFILLABLE'].includes(s))) return 'CANCELLED';
  if (states.every(s => ['COMPLETED','CLOSED','CANCELLED','REFUNDED'].includes(s))) return 'COMPLETED';
  if (states.includes('DISPUTED')) return 'DISPUTED';
  if (states.every(s => s === 'REJECTED')) return 'REJECTED';
  if (states.some(s => ['AT_RISK','DELAYED','REJECTED','UNRESPONSIVE_VENDOR','ASSIGNMENT_FAILED','UNFULFILLABLE'].includes(s))) return 'AT_RISK';
  if (states.some(s => ['IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED','CUSTOMER_REVIEW','MODIFICATION_REQUESTED','AWAITING_CUSTOMER_INFO'].includes(s))) return 'IN_PROGRESS';
  if (states.includes('AWAITING_ACCEPTANCE')) return 'AWAITING_ACCEPTANCE';
  if (states.includes('ACCEPTED')) return 'ACCEPTED';
  if (states.includes('PENDING_PAYMENT')) return 'PENDING_PAYMENT';
  return states[0];
}
