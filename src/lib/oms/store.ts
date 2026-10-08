// OMS Data Store & Persistence Service
// Integrates with Prisma PostgreSQL for persistent storage and provides in-memory fallback.

import prisma from '../db';
import { isDatabaseConfigured } from '../server-db';
import type {
  OMSMasterOrder,
  OMSSuborder,
  OMSOrderEvent,
  OMSException,
  OMSSettings,
  OMSNotificationRecord,
  OMSOrderStatus,
  ActorRole,
} from './types';
import { DEFAULT_ROUTING_WEIGHTS } from './routing-engine';

// In-memory fallback stores
let MEMORY_SETTINGS: OMSSettings = {
  id: 'default',
  acceptanceDeadlineMinutes: 120,
  executionNoticeDays: 2,
  customerReviewDeadlineHours: 48,
  alert50PercentEnabled: true,
  alert75PercentEnabled: true,
  alert90PercentEnabled: true,
  alert100PercentEnabled: true,
  autoReassignOnTimeout: true,
  maxInactivityHours: 24,
  routingWeights: DEFAULT_ROUTING_WEIGHTS,
  escalationPolicy: {
    l1TimeoutMinutes: 30,
    l2TimeoutMinutes: 60,
    l3TimeoutMinutes: 120,
    l4TimeoutMinutes: 240,
  },
  businessHoursConfig: {
    startHour: 9,
    endHour: 23,
    workDays: [0, 1, 2, 3, 4, 5, 6],
  },
  deliveryProofRequired: true,
  autoClosePeriodDays: 3,
  maxRetryAttempts: 3,
  updatedAt: new Date().toISOString(),
};

let MEMORY_ORDERS: OMSMasterOrder[] = [
  {
    id: 'ord_sample_101',
    orderNumber: 'MN-884920',
    customerId: 'usr_client_1',
    customerName: 'عبدالله السعيد',
    customerPhone: '0501234567',
    customerEmail: 'abdullah@example.com',
    eventDate: '2026-11-15',
    eventTime: '08:00 م',
    cityId: 'riyadh',
    cityNameAr: 'الرياض',
    venueName: 'قاعة الأسطورة - حطين',
    totalSubtotal: 12000,
    totalTax: 1800,
    couponDiscount: 500,
    couponCode: 'MUNASABATI500',
    finalTotal: 13300,
    totalDeposit: 3990,
    paymentMethod: 'mada',
    paymentStatus: 'PAID',
    isDepositOnly: true,
    omsStatus: 'IN_PROGRESS',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    suborders: [
      {
        id: 'sub_101_1',
        orderId: 'ord_sample_101',
        vendorId: 'vendor_photo_1',
        vendorName: 'عدسات الإبداع للتصوير',
        vendorLogo: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=150',
        bookingNumber: 'BK-884920-1',
        subtotal: 7000,
        taxAmount: 1050,
        totalAmount: 8050,
        depositAmount: 2415,
        remainingAmount: 5635,
        omsStatus: 'IN_PROGRESS',
        paymentStatus: 'PAID',
        assignedRole: 'vendor',
        nextAction: 'PREPARE_DELIVERY',
        nextActionDeadline: new Date(Date.now() + 3600000 * 24).toISOString(),
        acceptanceDeadline: new Date(Date.now() - 3600000 * 3).toISOString(),
        fulfillmentDeadline: new Date(Date.now() + 3600000 * 48).toISOString(),
        isAtRisk: false,
        isDelayed: false,
        slaExtensionDays: 0,
        lastActivityAt: new Date(Date.now() - 1800000).toISOString(),
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        items: [
          {
            id: 'itm_101_1',
            suborderId: 'sub_101_1',
            serviceId: 'srv_photo_vip',
            serviceTitleAr: 'تغطية فوتوغراف وفيديو سينمائي للزفاف',
            serviceImage: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600',
            packagePrice: 7000,
            quantity: 1,
            scheduledDate: '2026-11-15',
            scheduledTime: '08:00 م',
            cityId: 'riyadh',
            cityNameAr: 'الرياض',
            basePrice: 7000,
            addonsTotal: 0,
            subtotal: 7000,
            taxAmount: 1050,
            totalAmount: 8050,
          },
        ],
      },
      {
        id: 'sub_101_2',
        orderId: 'ord_sample_101',
        vendorId: 'vendor_koshi_1',
        vendorName: 'لمسات الملوك لتنسيق الكوش',
        vendorLogo: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=150',
        bookingNumber: 'BK-884920-2',
        subtotal: 5000,
        taxAmount: 750,
        totalAmount: 5750,
        depositAmount: 1725,
        remainingAmount: 4025,
        omsStatus: 'AWAITING_ACCEPTANCE',
        paymentStatus: 'PAID',
        assignedRole: 'vendor',
        nextAction: 'VENDOR_ACCEPTANCE',
        nextActionDeadline: new Date(Date.now() + 1800000).toISOString(),
        acceptanceDeadline: new Date(Date.now() + 1800000).toISOString(),
        fulfillmentDeadline: new Date(Date.now() + 3600000 * 72).toISOString(),
        isAtRisk: true,
        isDelayed: false,
        slaExtensionDays: 0,
        lastActivityAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        items: [
          {
            id: 'itm_101_2',
            suborderId: 'sub_101_2',
            serviceId: 'srv_decor_royal',
            serviceTitleAr: 'تصميم وتنفيذ كوشة ملكية بالورد الطبيعي',
            serviceImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600',
            packagePrice: 5000,
            quantity: 1,
            scheduledDate: '2026-11-15',
            scheduledTime: '08:00 م',
            cityId: 'riyadh',
            cityNameAr: 'الرياض',
            basePrice: 5000,
            addonsTotal: 0,
            subtotal: 5000,
            taxAmount: 750,
            totalAmount: 5750,
          },
        ],
      },
    ],
  },
];

let MEMORY_EVENTS: OMSOrderEvent[] = [
  {
    id: 'evt_1',
    orderId: 'ord_sample_101',
    suborderId: 'sub_101_1',
    fromState: 'CREATED',
    toState: 'PAYMENT_CONFIRMED',
    action: 'CONFIRM_PAYMENT',
    actorRole: 'SYSTEM',
    noteAr: 'تم تأكيد عملية الدفع عن طريق مدى بنجاح',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'evt_2',
    orderId: 'ord_sample_101',
    suborderId: 'sub_101_1',
    fromState: 'AWAITING_ACCEPTANCE',
    toState: 'ACCEPTED',
    action: 'ACCEPT_ORDER',
    actorRole: 'VENDOR',
    noteAr: 'تم قبول الطلب وتأكيد التوفر في موعد المناسبة',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

let MEMORY_EXCEPTIONS: OMSException[] = [
  {
    id: 'exc_101',
    orderId: 'ord_sample_101',
    suborderId: 'sub_101_2',
    issueType: 'ACCEPTANCE_TIMED_OUT',
    severity: 'HIGH',
    assignedRole: 'OPERATIONS',
    detectedAt: new Date(Date.now() - 1800000).toISOString(),
    correctiveActionAr: 'المورد (لمسات الملوك) شارف على استهلاك مهلة قبول الطلب (متبقي أقل من 30 دقيقة). يلزم التنبيه المباشر.',
    status: 'OPEN',
    resolutionDeadline: new Date(Date.now() + 1800000).toISOString(),
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

let MEMORY_NOTIFICATIONS: OMSNotificationRecord[] = [];

// Settings Operations
export async function getOMSSettings(): Promise<OMSSettings> {
  try {
    if (isDatabaseConfigured()) {
      const dbConfig = await prisma.oMSAutomationConfig.findUnique({ where: { id: 'default' } });
      if (dbConfig) {
        return {
          id: dbConfig.id,
          acceptanceDeadlineMinutes: dbConfig.acceptanceDeadlineMinutes,
          executionNoticeDays: dbConfig.executionNoticeDays,
          customerReviewDeadlineHours: dbConfig.customerReviewDeadlineHours,
          alert50PercentEnabled: dbConfig.alert50PercentEnabled,
          alert75PercentEnabled: dbConfig.alert75PercentEnabled,
          alert90PercentEnabled: dbConfig.alert90PercentEnabled,
          alert100PercentEnabled: dbConfig.alert100PercentEnabled,
          autoReassignOnTimeout: dbConfig.autoReassignOnTimeout,
          maxInactivityHours: dbConfig.maxInactivityHours,
          routingWeights: (dbConfig.routingWeights as any) || DEFAULT_ROUTING_WEIGHTS,
          escalationPolicy: (dbConfig.escalationPolicy as any) || MEMORY_SETTINGS.escalationPolicy,
          businessHoursConfig: (dbConfig.businessHoursConfig as any) || MEMORY_SETTINGS.businessHoursConfig,
          deliveryProofRequired: dbConfig.deliveryProofRequired,
          autoClosePeriodDays: dbConfig.autoClosePeriodDays,
          maxRetryAttempts: dbConfig.maxRetryAttempts,
          updatedBy: dbConfig.updatedBy || undefined,
          updatedAt: dbConfig.updatedAt.toISOString(),
        };
      }
    }
  } catch (e) {
    console.warn('DB settings fetch error, using memory fallback:', e);
  }
  return MEMORY_SETTINGS;
}

export async function saveOMSSettings(settings: OMSSettings, actorUserId?: string): Promise<OMSSettings> {
  const updated: OMSSettings = {
    ...settings,
    updatedBy: actorUserId || settings.updatedBy || 'admin',
    updatedAt: new Date().toISOString(),
  };

  try {
    if (isDatabaseConfigured()) {
      await prisma.oMSAutomationConfig.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          acceptanceDeadlineMinutes: updated.acceptanceDeadlineMinutes,
          executionNoticeDays: updated.executionNoticeDays,
          customerReviewDeadlineHours: updated.customerReviewDeadlineHours,
          alert50PercentEnabled: updated.alert50PercentEnabled,
          alert75PercentEnabled: updated.alert75PercentEnabled,
          alert90PercentEnabled: updated.alert90PercentEnabled,
          alert100PercentEnabled: updated.alert100PercentEnabled,
          autoReassignOnTimeout: updated.autoReassignOnTimeout,
          maxInactivityHours: updated.maxInactivityHours,
          routingWeights: updated.routingWeights as any,
          escalationPolicy: updated.escalationPolicy as any,
          businessHoursConfig: updated.businessHoursConfig as any,
          deliveryProofRequired: updated.deliveryProofRequired,
          autoClosePeriodDays: updated.autoClosePeriodDays,
          maxRetryAttempts: updated.maxRetryAttempts,
          updatedBy: updated.updatedBy,
        },
        update: {
          acceptanceDeadlineMinutes: updated.acceptanceDeadlineMinutes,
          executionNoticeDays: updated.executionNoticeDays,
          customerReviewDeadlineHours: updated.customerReviewDeadlineHours,
          alert50PercentEnabled: updated.alert50PercentEnabled,
          alert75PercentEnabled: updated.alert75PercentEnabled,
          alert90PercentEnabled: updated.alert90PercentEnabled,
          alert100PercentEnabled: updated.alert100PercentEnabled,
          autoReassignOnTimeout: updated.autoReassignOnTimeout,
          maxInactivityHours: updated.maxInactivityHours,
          routingWeights: updated.routingWeights as any,
          escalationPolicy: updated.escalationPolicy as any,
          businessHoursConfig: updated.businessHoursConfig as any,
          deliveryProofRequired: updated.deliveryProofRequired,
          autoClosePeriodDays: updated.autoClosePeriodDays,
          maxRetryAttempts: updated.maxRetryAttempts,
          updatedBy: updated.updatedBy,
        },
      });
    }
  } catch (e) {
    console.warn('DB settings save error, using memory fallback:', e);
  }

  MEMORY_SETTINGS = updated;
  return MEMORY_SETTINGS;
}

// Order Operations
export async function getAllOMSOrders(): Promise<OMSMasterOrder[]> {
  try {
    if (isDatabaseConfigured()) {
      const orders = await prisma.multiVendorOrder.findMany({
        include: {
          suborders: {
            include: {
              items: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (orders && orders.length > 0) {
        return orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerId: o.customerId || undefined,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerEmail: o.customerEmail || undefined,
          occasionId: o.occasionId || undefined,
          eventDate: o.eventDate,
          eventTime: o.eventTime || undefined,
          cityId: o.cityId,
          cityNameAr: o.city?.nameAr || 'الرياض',
          venueName: o.venueName || undefined,
          totalSubtotal: o.totalSubtotal,
          totalTax: o.totalTax,
          couponDiscount: o.couponDiscount,
          couponCode: o.couponCode || undefined,
          finalTotal: o.finalTotal,
          totalDeposit: o.totalDeposit,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus as any,
          isDepositOnly: o.isDepositOnly,
          omsStatus: o.omsStatus as OMSOrderStatus,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          suborders: o.suborders.map((s: any) => ({
            id: s.id,
            orderId: s.orderId,
            vendorId: s.vendorId,
            vendorName: s.vendorName,
            vendorLogo: s.vendorLogo,
            bookingNumber: s.bookingNumber,
            subtotal: s.subtotal,
            taxAmount: s.taxAmount,
            totalAmount: s.totalAmount,
            depositAmount: s.depositAmount,
            remainingAmount: s.remainingAmount,
            omsStatus: s.omsStatus as OMSOrderStatus,
            paymentStatus: 'PAID',
            assignedRole: s.assignedRole as any,
            assignedUserId: s.assignedUserId || undefined,
            nextAction: s.nextAction,
            nextActionDeadline: s.nextActionDeadline ? s.nextActionDeadline.toISOString() : undefined,
            acceptanceDeadline: s.acceptanceDeadline ? s.acceptanceDeadline.toISOString() : undefined,
            fulfillmentDeadline: s.fulfillmentDeadline ? s.fulfillmentDeadline.toISOString() : undefined,
            deliveryDeadline: s.deliveryDeadline ? s.deliveryDeadline.toISOString() : undefined,
            customerReviewDeadline: s.customerReviewDeadline ? s.customerReviewDeadline.toISOString() : undefined,
            isAtRisk: s.isAtRisk,
            isDelayed: s.isDelayed,
            delayReasonAr: s.delayReasonAr || undefined,
            cancellationReasonAr: s.cancellationReasonAr || undefined,
            disputeReasonAr: s.disputeReasonAr || undefined,
            deliverablesUrl: s.deliverablesUrl || undefined,
            proofOfDelivery: s.proofOfDelivery || undefined,
            slaExtensionDays: s.slaExtensionDays,
            slaOriginalDeadline: s.slaOriginalDeadline ? s.slaOriginalDeadline.toISOString() : undefined,
            lastActivityAt: s.lastActivityAt.toISOString(),
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            items: s.items.map((i: any) => ({
              id: i.id,
              suborderId: i.suborderId,
              serviceId: i.serviceId,
              serviceTitleAr: i.serviceTitleAr,
              serviceImage: i.serviceImage,
              packageId: i.packageId || undefined,
              packageNameAr: i.packageNameAr || undefined,
              packagePrice: i.packagePrice,
              addons: (i.addons as any) || [],
              quantity: i.quantity,
              scheduledDate: i.scheduledDate,
              scheduledTime: i.scheduledTime || undefined,
              cityId: i.cityId,
              cityNameAr: i.cityNameAr,
              venueAddress: i.venueAddress || undefined,
              notes: i.notes || undefined,
              basePrice: i.basePrice,
              addonsTotal: i.addonsTotal,
              subtotal: i.subtotal,
              taxAmount: i.taxAmount,
              totalAmount: i.totalAmount,
            })),
          })),
        }));
      }
    }
  } catch (e) {
    console.warn('DB orders fetch fallback to memory store:', e);
  }
  return MEMORY_ORDERS;
}

export async function saveOMSMasterOrder(masterOrder: OMSMasterOrder): Promise<OMSMasterOrder> {
  const existingIdx = MEMORY_ORDERS.findIndex((o) => o.id === masterOrder.id);
  if (existingIdx >= 0) {
    MEMORY_ORDERS[existingIdx] = masterOrder;
  } else {
    MEMORY_ORDERS.unshift(masterOrder);
  }
  return masterOrder;
}

export async function getOMSSuborderById(suborderId: string): Promise<{ suborder: OMSSuborder; masterOrder: OMSMasterOrder } | null> {
  const allOrders = await getAllOMSOrders();
  for (const master of allOrders) {
    const foundSub = master.suborders.find((s) => s.id === suborderId || s.bookingNumber === suborderId);
    if (foundSub) {
      return { suborder: foundSub, masterOrder: master };
    }
  }
  return null;
}

export async function recordOMSEvent(event: Partial<OMSOrderEvent>): Promise<OMSOrderEvent> {
  const fullEvent: OMSOrderEvent = {
    id: event.id || `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderId: event.orderId,
    suborderId: event.suborderId,
    fromState: event.fromState || 'CREATED',
    toState: event.toState || 'IN_PROGRESS',
    action: event.action || 'TRANSITION',
    actorId: event.actorId,
    actorRole: event.actorRole || 'SYSTEM',
    noteAr: event.noteAr,
    metadata: event.metadata,
    createdAt: new Date().toISOString(),
  };

  MEMORY_EVENTS.unshift(fullEvent);
  return fullEvent;
}

export async function getOMSEventsForSuborder(suborderId: string): Promise<OMSOrderEvent[]> {
  return MEMORY_EVENTS.filter((e) => e.suborderId === suborderId || e.orderId === suborderId);
}

// Exceptions Operations
export async function getAllOMSExceptions(): Promise<OMSException[]> {
  return MEMORY_EXCEPTIONS;
}

export async function saveOMSException(exception: Partial<OMSException>): Promise<OMSException> {
  const full: OMSException = {
    id: exception.id || `exc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderId: exception.orderId,
    suborderId: exception.suborderId,
    issueType: exception.issueType || 'UNASSIGNED',
    severity: exception.severity || 'MEDIUM',
    assignedRole: exception.assignedRole || 'OPERATIONS',
    assignedUserId: exception.assignedUserId,
    detectedAt: exception.detectedAt || new Date().toISOString(),
    correctiveActionAr: exception.correctiveActionAr || 'يتطلب التدخل والمراجعة من فريق العمليات',
    resolutionDeadline: exception.resolutionDeadline,
    status: exception.status || 'OPEN',
    createdAt: exception.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const idx = MEMORY_EXCEPTIONS.findIndex((e) => e.id === full.id);
  if (idx >= 0) {
    MEMORY_EXCEPTIONS[idx] = full;
  } else {
    MEMORY_EXCEPTIONS.unshift(full);
  }
  return full;
}
