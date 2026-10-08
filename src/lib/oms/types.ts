// Intelligent Order Management System (OMS) Types
// Unified data models, state enums, SLA metrics, Exception handling, Routing weights & Settings.

export type OMSOrderStatus =
  | 'CREATED'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'ROUTING_TO_SUPPLIER'
  | 'AWAITING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CUSTOMER_REVIEW'
  | 'COMPLETED'
  | 'CLOSED'
  // Exceptional / SLA States
  | 'REJECTED'
  | 'UNRESPONSIVE_VENDOR'
  | 'ASSIGNMENT_FAILED'
  | 'AWAITING_CUSTOMER_INFO'
  | 'EXTENSION_REQUESTED'
  | 'AT_RISK'
  | 'DELAYED'
  | 'PAUSED'
  | 'REASSIGNMENT_REQUESTED'
  | 'MODIFICATION_REQUESTED'
  | 'DISPUTED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'PENDING_REFUND'
  | 'REFUNDED'
  | 'UNFULFILLABLE';

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING_PAYMENT'
  | 'PROCESSING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'FULLY_REFUNDED'
  | 'DISPUTED';

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'IN_REVIEW' | 'ACTION_TAKEN' | 'RESOLVED' | 'CLOSED';
export type ActorRole = 'CUSTOMER' | 'VENDOR' | 'OPERATIONS' | 'ADMIN' | 'SYSTEM';
export type EscalationLevel = 'L1_VENDOR' | 'L2_OPERATIONS' | 'L3_MARKETPLACE_MANAGER' | 'L4_EXECUTIVE';

export interface OMSOrderItemAddon {
  addonId: string;
  titleAr: string;
  price: number;
  quantity: number;
}

export interface OMSOrderItem {
  id: string;
  suborderId: string;
  serviceId: string;
  serviceTitleAr: string;
  serviceImage: string;
  packageId?: string;
  packageNameAr?: string;
  packagePrice: number;
  addons?: OMSOrderItemAddon[];
  quantity: number;
  scheduledDate: string;
  scheduledTime?: string;
  cityId: string;
  cityNameAr: string;
  venueAddress?: string;
  notes?: string;
  basePrice: number;
  addonsTotal: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface OMSSuborder {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  bookingNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  omsStatus: OMSOrderStatus;
  paymentStatus: PaymentStatus;
  
  // Assignment & Ownership
  assignedRole: 'vendor' | 'operations' | 'admin' | 'customer';
  assignedUserId?: string;
  nextAction: string;
  nextActionDeadline?: string;
  
  // SLA Timestamps
  acceptanceDeadline?: string;
  fulfillmentDeadline?: string;
  deliveryDeadline?: string;
  customerReviewDeadline?: string;
  
  // Indicators
  isAtRisk: boolean;
  isDelayed: boolean;
  delayReasonAr?: string;
  cancellationReasonAr?: string;
  disputeReasonAr?: string;
  deliverablesUrl?: string;
  proofOfDelivery?: string;
  slaExtensionDays: number;
  slaOriginalDeadline?: string;
  lastActivityAt: string;

  createdAt: string;
  updatedAt: string;
  items: OMSOrderItem[];
}

export interface OMSMasterOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  occasionId?: string;
  eventDate: string;
  eventTime?: string;
  cityId: string;
  cityNameAr: string;
  venueName?: string;
  totalSubtotal: number;
  totalTax: number;
  couponDiscount: number;
  couponCode?: string;
  finalTotal: number;
  totalDeposit: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  isDepositOnly: boolean;
  omsStatus: OMSOrderStatus;
  createdAt: string;
  updatedAt: string;
  suborders: OMSSuborder[];
}

export interface OMSOrderEvent {
  id: string;
  orderId?: string;
  suborderId?: string;
  fromState: OMSOrderStatus;
  toState: OMSOrderStatus;
  action: string;
  actorId?: string;
  actorRole: ActorRole;
  noteAr?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OMSException {
  id: string;
  orderId?: string;
  suborderId?: string;
  issueType:
    | 'UNASSIGNED'
    | 'ACCEPTANCE_TIMED_OUT'
    | 'INACTIVE_TOO_LONG'
    | 'DELAYED'
    | 'PAYMENT_MISMATCH'
    | 'DISPUTED'
    | 'NO_DELIVERABLES'
    | 'FAILED_JOB_EVENT';
  severity: ExceptionSeverity;
  assignedRole: string;
  assignedUserId?: string;
  detectedAt: string;
  correctiveActionAr: string;
  resolutionDeadline?: string;
  status: ExceptionStatus;
  resolvedAt?: string;
  resolutionNotesAr?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OMSRoutingWeights {
  availabilityWeight: number; // e.g. 20
  coverageWeight: number;     // e.g. 15
  capacityWeight: number;     // e.g. 10
  responseTimeWeight: number; // e.g. 15
  onTimeRateWeight: number;   // e.g. 15
  ratingWeight: number;       // e.g. 15
  priceFitWeight: number;     // e.g. 10
}

export interface OMSSettings {
  id: string;
  acceptanceDeadlineMinutes: number;
  executionNoticeDays: number;
  customerReviewDeadlineHours: number;
  alert50PercentEnabled: boolean;
  alert75PercentEnabled: boolean;
  alert90PercentEnabled: boolean;
  alert100PercentEnabled: boolean;
  autoReassignOnTimeout: boolean;
  maxInactivityHours: number;
  routingWeights: OMSRoutingWeights;
  escalationPolicy: {
    l1TimeoutMinutes: number;
    l2TimeoutMinutes: number;
    l3TimeoutMinutes: number;
    l4TimeoutMinutes: number;
  };
  businessHoursConfig: {
    startHour: number;
    endHour: number;
    workDays: number[];
  };
  deliveryProofRequired: boolean;
  autoClosePeriodDays: number;
  maxRetryAttempts: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface OMSNotificationRecord {
  id: string;
  orderId?: string;
  suborderId?: string;
  recipientPhone: string;
  recipientEmail?: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  event: string;
  status: 'SENT' | 'FAILED' | 'RETRYING';
  attempts: number;
  lastAttemptAt: string;
  errorDetails?: string;
  createdAt: string;
}

export interface RoutingScoreResult {
  vendorId: string;
  vendorName: string;
  totalScore: number;
  scores: {
    availability: number;
    coverage: number;
    capacity: number;
    responseTime: number;
    onTimeRate: number;
    rating: number;
    priceFit: number;
  };
  isEligible: boolean;
  ineligibilityReasonAr?: string;
}
