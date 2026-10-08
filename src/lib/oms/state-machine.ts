// OMS State Machine Engine
// Enforces strict, deterministic state transitions, server-side validation rules, and next-action calculation.

import { OMSOrderStatus, ActorRole } from './types';

export interface StateTransitionRule {
  from: OMSOrderStatus;
  to: OMSOrderStatus;
  allowedRoles: ActorRole[];
  actionName: string;
  nextAction: string;
  nextAssignedRole: 'vendor' | 'operations' | 'admin' | 'customer';
  requiresNote?: boolean;
}

export const VALID_TRANSITIONS: StateTransitionRule[] = [
  // Creation & Payment
  {
    from: 'CREATED',
    to: 'PENDING_PAYMENT',
    allowedRoles: ['SYSTEM', 'CUSTOMER'],
    actionName: 'INITIATE_PAYMENT',
    nextAction: 'COMPLETE_PAYMENT',
    nextAssignedRole: 'customer',
  },
  {
    from: 'PENDING_PAYMENT',
    to: 'PAYMENT_CONFIRMED',
    allowedRoles: ['SYSTEM', 'ADMIN'],
    actionName: 'CONFIRM_PAYMENT',
    nextAction: 'ROUTE_TO_VENDOR',
    nextAssignedRole: 'operations',
  },
  {
    from: 'PAYMENT_CONFIRMED',
    to: 'AWAITING_ACCEPTANCE',
    allowedRoles: ['SYSTEM', 'OPERATIONS', 'ADMIN'],
    actionName: 'ASSIGN_VENDOR',
    nextAction: 'VENDOR_ACCEPTANCE',
    nextAssignedRole: 'vendor',
  },

  // Supplier Acceptance Workflow
  {
    from: 'AWAITING_ACCEPTANCE',
    to: 'ACCEPTED',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'ACCEPT_ORDER',
    nextAction: 'START_EXECUTION',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'AWAITING_ACCEPTANCE',
    to: 'REJECTED',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'REJECT_ORDER',
    nextAction: 'REASSIGN_VENDOR',
    nextAssignedRole: 'operations',
    requiresNote: true,
  },
  {
    from: 'AWAITING_ACCEPTANCE',
    to: 'UNRESPONSIVE_VENDOR',
    allowedRoles: ['SYSTEM', 'OPERATIONS'],
    actionName: 'FLAG_UNRESPONSIVE',
    nextAction: 'ESCALATE_OR_REASSIGN',
    nextAssignedRole: 'operations',
  },

  // Execution Phase
  {
    from: 'ACCEPTED',
    to: 'IN_PROGRESS',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'START_WORK',
    nextAction: 'PREPARE_DELIVERY',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'IN_PROGRESS',
    to: 'AWAITING_CUSTOMER_INFO',
    allowedRoles: ['VENDOR'],
    actionName: 'REQUEST_CUSTOMER_INFO',
    nextAction: 'PROVIDE_INFO',
    nextAssignedRole: 'customer',
    requiresNote: true,
  },
  {
    from: 'AWAITING_CUSTOMER_INFO',
    to: 'IN_PROGRESS',
    allowedRoles: ['CUSTOMER', 'ADMIN'],
    actionName: 'SUBMIT_INFO',
    nextAction: 'CONTINUE_WORK',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'IN_PROGRESS',
    to: 'EXTENSION_REQUESTED',
    allowedRoles: ['VENDOR'],
    actionName: 'REQUEST_SLA_EXTENSION',
    nextAction: 'REVIEW_EXTENSION',
    nextAssignedRole: 'operations',
    requiresNote: true,
  },
  {
    from: 'EXTENSION_REQUESTED',
    to: 'IN_PROGRESS',
    allowedRoles: ['OPERATIONS', 'ADMIN', 'CUSTOMER'],
    actionName: 'APPROVE_EXTENSION',
    nextAction: 'PREPARE_DELIVERY',
    nextAssignedRole: 'vendor',
  },

  // Delivery & Review Phase
  {
    from: 'IN_PROGRESS',
    to: 'READY_FOR_DELIVERY',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'MARK_READY',
    nextAction: 'DELIVER_SERVICE',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'READY_FOR_DELIVERY',
    to: 'DELIVERED',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'DELIVER',
    nextAction: 'CUSTOMER_REVIEW',
    nextAssignedRole: 'customer',
  },
  {
    from: 'DELIVERED',
    to: 'CUSTOMER_REVIEW',
    allowedRoles: ['SYSTEM', 'CUSTOMER'],
    actionName: 'START_REVIEW',
    nextAction: 'CONFIRM_ACCEPTANCE',
    nextAssignedRole: 'customer',
  },
  {
    from: 'CUSTOMER_REVIEW',
    to: 'COMPLETED',
    allowedRoles: ['CUSTOMER', 'SYSTEM', 'ADMIN'],
    actionName: 'APPROVE_DELIVERY',
    nextAction: 'CLOSE_ORDER',
    nextAssignedRole: 'operations',
  },
  {
    from: 'DELIVERED',
    to: 'COMPLETED',
    allowedRoles: ['CUSTOMER', 'SYSTEM', 'ADMIN'],
    actionName: 'DIRECT_APPROVE',
    nextAction: 'CLOSE_ORDER',
    nextAssignedRole: 'operations',
  },
  {
    from: 'COMPLETED',
    to: 'CLOSED',
    allowedRoles: ['SYSTEM', 'ADMIN'],
    actionName: 'CLOSE',
    nextAction: 'ARCHIVED',
    nextAssignedRole: 'admin',
  },

  // Modification & Dispute Phase
  {
    from: 'DELIVERED',
    to: 'MODIFICATION_REQUESTED',
    allowedRoles: ['CUSTOMER'],
    actionName: 'REQUEST_REVISION',
    nextAction: 'VENDOR_REVISE',
    nextAssignedRole: 'vendor',
    requiresNote: true,
  },
  {
    from: 'MODIFICATION_REQUESTED',
    to: 'IN_PROGRESS',
    allowedRoles: ['VENDOR', 'ADMIN'],
    actionName: 'ACCEPT_REVISION',
    nextAction: 'REVISE_WORK',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'IN_PROGRESS',
    to: 'DISPUTED',
    allowedRoles: ['CUSTOMER', 'VENDOR', 'ADMIN'],
    actionName: 'OPEN_DISPUTE',
    nextAction: 'RESOLVE_DISPUTE',
    nextAssignedRole: 'operations',
    requiresNote: true,
  },
  {
    from: 'DELIVERED',
    to: 'DISPUTED',
    allowedRoles: ['CUSTOMER', 'ADMIN'],
    actionName: 'OPEN_DISPUTE',
    nextAction: 'RESOLVE_DISPUTE',
    nextAssignedRole: 'operations',
    requiresNote: true,
  },
  {
    from: 'DISPUTED',
    to: 'IN_PROGRESS',
    allowedRoles: ['OPERATIONS', 'ADMIN'],
    actionName: 'RESOLVE_TO_CONTINUE',
    nextAction: 'RESUME_WORK',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'DISPUTED',
    to: 'COMPLETED',
    allowedRoles: ['OPERATIONS', 'ADMIN'],
    actionName: 'RESOLVE_TO_COMPLETE',
    nextAction: 'CLOSE_ORDER',
    nextAssignedRole: 'operations',
  },
  {
    from: 'DISPUTED',
    to: 'PENDING_REFUND',
    allowedRoles: ['OPERATIONS', 'ADMIN'],
    actionName: 'RESOLVE_TO_REFUND',
    nextAction: 'PROCESS_REFUND',
    nextAssignedRole: 'operations',
  },

  // Cancellation & Reassignment
  {
    from: 'AWAITING_ACCEPTANCE',
    to: 'REASSIGNMENT_REQUESTED',
    allowedRoles: ['OPERATIONS', 'ADMIN', 'SYSTEM'],
    actionName: 'REQUEST_REASSIGNMENT',
    nextAction: 'ROUTE_TO_NEW_VENDOR',
    nextAssignedRole: 'operations',
  },
  {
    from: 'UNRESPONSIVE_VENDOR',
    to: 'AWAITING_ACCEPTANCE',
    allowedRoles: ['SYSTEM', 'OPERATIONS', 'ADMIN'],
    actionName: 'AUTO_REASSIGN',
    nextAction: 'VENDOR_ACCEPTANCE',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'REJECTED',
    to: 'AWAITING_ACCEPTANCE',
    allowedRoles: ['SYSTEM', 'OPERATIONS', 'ADMIN'],
    actionName: 'REASSIGN_NEXT_VENDOR',
    nextAction: 'VENDOR_ACCEPTANCE',
    nextAssignedRole: 'vendor',
  },
  {
    from: 'IN_PROGRESS',
    to: 'CANCEL_REQUESTED',
    allowedRoles: ['CUSTOMER', 'VENDOR'],
    actionName: 'REQUEST_CANCEL',
    nextAction: 'REVIEW_CANCELLATION',
    nextAssignedRole: 'operations',
    requiresNote: true,
  },
  {
    from: 'CANCEL_REQUESTED',
    to: 'CANCELLED',
    allowedRoles: ['OPERATIONS', 'ADMIN'],
    actionName: 'APPROVE_CANCEL',
    nextAction: 'PROCESS_REFUND',
    nextAssignedRole: 'operations',
  },
  {
    from: 'PAYMENT_CONFIRMED',
    to: 'CANCELLED',
    allowedRoles: ['CUSTOMER', 'OPERATIONS', 'ADMIN'],
    actionName: 'CANCEL_UNFULFILLED',
    nextAction: 'PROCESS_REFUND',
    nextAssignedRole: 'operations',
  },
  {
    from: 'AWAITING_ACCEPTANCE',
    to: 'CANCELLED',
    allowedRoles: ['CUSTOMER', 'OPERATIONS', 'ADMIN'],
    actionName: 'CANCEL_BEFORE_ACCEPT',
    nextAction: 'PROCESS_REFUND',
    nextAssignedRole: 'operations',
  },
  {
    from: 'CANCELLED',
    to: 'PENDING_REFUND',
    allowedRoles: ['SYSTEM', 'OPERATIONS', 'ADMIN'],
    actionName: 'INITIATE_REFUND',
    nextAction: 'REFUND_CUSTOMER',
    nextAssignedRole: 'operations',
  },
  {
    from: 'PENDING_REFUND',
    to: 'REFUNDED',
    allowedRoles: ['SYSTEM', 'ADMIN'],
    actionName: 'COMPLETE_REFUND',
    nextAction: 'CLOSE_ORDER',
    nextAssignedRole: 'admin',
  },
  {
    from: 'REFUNDED',
    to: 'CLOSED',
    allowedRoles: ['SYSTEM', 'ADMIN'],
    actionName: 'CLOSE_REFUNDED',
    nextAction: 'ARCHIVED',
    nextAssignedRole: 'admin',
  },
];

export function validateStateTransition(
  currentState: OMSOrderStatus,
  targetState: OMSOrderStatus,
  role: ActorRole,
  noteAr?: string
): { isValid: boolean; errorAr?: string; rule?: StateTransitionRule } {
  const matchingRule = VALID_TRANSITIONS.find(
    (r) => r.from === currentState && r.to === targetState
  );

  if (!matchingRule) {
    return {
      isValid: false,
      errorAr: `انتقال غير مسموح به من الحالة [${currentState}] إلى الحالة [${targetState}]`,
    };
  }

  if (!matchingRule.allowedRoles.includes(role)) {
    return {
      isValid: false,
      errorAr: `دور المستخدم [${role}] غير مصرح له بتنفيذ الإجراء [${matchingRule.actionName}]`,
    };
  }

  if (matchingRule.requiresNote && (!noteAr || noteAr.trim().length === 0)) {
    return {
      isValid: false,
      errorAr: `يتطلب هذا الإجراء توضيح السبب في ملاحظة بدقة`,
    };
  }

  return { isValid: true, rule: matchingRule };
}

export function getAvailableTransitions(
  currentState: OMSOrderStatus,
  role: ActorRole
): StateTransitionRule[] {
  return VALID_TRANSITIONS.filter(
    (r) => r.from === currentState && r.allowedRoles.includes(role)
  );
}
