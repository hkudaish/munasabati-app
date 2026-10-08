// Intelligent SLA Engine, Automated Watchdog & Multi-Level Escalation System
// Monitors order deadlines, detects stuck orders, enforces SLA threshold alerts (50%, 75%, 90%, 100%),
// creates exception records, and escalates unresolved issues across operational tiers.

import type { OMSSuborder, OMSException, OMSSettings, ExceptionSeverity } from './types';

export interface SLACalculationResult {
  acceptanceMinutesRemaining: number;
  acceptanceProgressPercent: number;
  fulfillmentHoursRemaining: number;
  fulfillmentProgressPercent: number;
  isAtRisk: boolean;
  isDelayed: boolean;
  alertLevel: 'NONE' | '50_PERCENT' | '75_PERCENT' | '90_PERCENT' | '100_PERCENT_EXPIRED';
  suggestedActionAr: string;
}

export function calculateSuborderSLA(
  suborder: OMSSuborder,
  settings: OMSSettings,
  nowDate: Date = new Date()
): SLACalculationResult {
  const now = nowDate.getTime();
  const createdAt = new Date(suborder.createdAt).getTime();

  // 1. Acceptance SLA Check (for AWAITING_ACCEPTANCE)
  let acceptanceMinutesRemaining = 9999;
  let acceptanceProgressPercent = 0;
  let alertLevel: SLACalculationResult['alertLevel'] = 'NONE';
  let suggestedActionAr = 'الطلب ينتظر الإجراء المعتاد';
  let isAtRisk = false;
  let isDelayed = false;

  if (suborder.omsStatus === 'AWAITING_ACCEPTANCE') {
    const deadline = suborder.acceptanceDeadline
      ? new Date(suborder.acceptanceDeadline).getTime()
      : createdAt + settings.acceptanceDeadlineMinutes * 60 * 1000;

    const totalAllowed = deadline - createdAt;
    const elapsed = now - createdAt;

    acceptanceMinutesRemaining = Math.max(0, Math.round((deadline - now) / 60000));
    acceptanceProgressPercent = Math.min(100, Math.max(0, Math.round((elapsed / (totalAllowed || 1)) * 100)));

    if (acceptanceProgressPercent >= 100 || now > deadline) {
      alertLevel = '100_PERCENT_EXPIRED';
      isDelayed = true;
      suggestedActionAr = 'تجاوز المورد مهلة القبول. يتطلب تصعيد أو إعادة إسناد فورية.';
    } else if (acceptanceProgressPercent >= 90) {
      alertLevel = '90_PERCENT';
      isAtRisk = true;
      suggestedActionAr = 'إنذار عاجل: متبقي أقل من 10% من مهلة قبول المورد.';
    } else if (acceptanceProgressPercent >= 75) {
      alertLevel = '75_PERCENT';
      isAtRisk = true;
      suggestedActionAr = 'تنبيه المورد: استهلاك 75% من مهلة قبول الطلب.';
    } else if (acceptanceProgressPercent >= 50) {
      alertLevel = '50_PERCENT';
      suggestedActionAr = 'تذكير داخلي بقبول الطلب.';
    }
  }

  // 2. Fulfillment SLA Check (for ACCEPTED, IN_PROGRESS, READY_FOR_DELIVERY)
  let fulfillmentHoursRemaining = 9999;
  let fulfillmentProgressPercent = 0;

  if (['ACCEPTED', 'IN_PROGRESS', 'READY_FOR_DELIVERY'].includes(suborder.omsStatus)) {
    const deadline = suborder.fulfillmentDeadline
      ? new Date(suborder.fulfillmentDeadline).getTime()
      : createdAt + 48 * 3600 * 1000; // default 48h if not set

    const totalAllowed = deadline - createdAt;
    const elapsed = now - createdAt;

    fulfillmentHoursRemaining = Math.max(0, Math.round(((deadline - now) / (3600 * 1000)) * 10) / 10);
    fulfillmentProgressPercent = Math.min(100, Math.max(0, Math.round((elapsed / (totalAllowed || 1)) * 100)));

    if (fulfillmentProgressPercent >= 100 || now > deadline) {
      alertLevel = '100_PERCENT_EXPIRED';
      isDelayed = true;
      suggestedActionAr = 'تجاوز المورد مهلة التسليم المحددة في اتفاقية مستوى الخدمة.';
    } else if (fulfillmentProgressPercent >= 90) {
      alertLevel = '90_PERCENT';
      isAtRisk = true;
      suggestedActionAr = 'إنذار عاجل لتنفيذ وتجهيز التسليم قبل انتهاء المهلة.';
    } else if (fulfillmentProgressPercent >= 75) {
      alertLevel = '75_PERCENT';
      isAtRisk = true;
      suggestedActionAr = 'تنبيه المورد بقرب موعد تسليم الخدمة.';
    }
  }

  return {
    acceptanceMinutesRemaining,
    acceptanceProgressPercent,
    fulfillmentHoursRemaining,
    fulfillmentProgressPercent,
    isAtRisk,
    isDelayed,
    alertLevel,
    suggestedActionAr,
  };
}

export function runOMSWatchdogScan(
  suborders: OMSSuborder[],
  existingExceptions: OMSException[],
  settings: OMSSettings,
  nowDate: Date = new Date()
): { detectedExceptions: Partial<OMSException>[]; updatedSuborders: OMSSuborder[] } {
  const detectedExceptions: Partial<OMSException>[] = [];
  const updatedSuborders: OMSSuborder[] = [];
  const now = nowDate.getTime();

  for (const suborder of suborders) {
    const slaResult = calculateSuborderSLA(suborder, settings, nowDate);
    let needsUpdate = false;
    let updatedSub = { ...suborder };

    // Update risk / delay status on suborder
    if (updatedSub.isAtRisk !== slaResult.isAtRisk || updatedSub.isDelayed !== slaResult.isDelayed) {
      updatedSub.isAtRisk = slaResult.isAtRisk;
      updatedSub.isDelayed = slaResult.isDelayed;
      needsUpdate = true;
    }

    const openException = existingExceptions.find(
      (e) => e.suborderId === suborder.id && e.status !== 'CLOSED' && e.status !== 'RESOLVED'
    );

    // Rule 1: Exceeded Acceptance Deadline (AWAITING_ACCEPTANCE)
    if (suborder.omsStatus === 'AWAITING_ACCEPTANCE' && slaResult.alertLevel === '100_PERCENT_EXPIRED') {
      if (!openException) {
        detectedExceptions.push({
          orderId: suborder.orderId,
          suborderId: suborder.id,
          issueType: 'ACCEPTANCE_TIMED_OUT',
          severity: 'HIGH',
          assignedRole: 'OPERATIONS',
          correctiveActionAr: `تجاوز المورد (${suborder.vendorName}) مهلة القبول (${settings.acceptanceDeadlineMinutes} دقيقة). المطلوب التدخل أو إعادة التوجيه.`,
          status: 'OPEN',
          resolutionDeadline: new Date(now + 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // Rule 2: Exceeded Fulfillment Deadline (IN_PROGRESS / READY_FOR_DELIVERY)
    if (['IN_PROGRESS', 'READY_FOR_DELIVERY'].includes(suborder.omsStatus) && slaResult.alertLevel === '100_PERCENT_EXPIRED') {
      if (!openException) {
        detectedExceptions.push({
          orderId: suborder.orderId,
          suborderId: suborder.id,
          issueType: 'DELAYED',
          severity: 'CRITICAL',
          assignedRole: 'OPERATIONS',
          correctiveActionAr: `تأخر تنفيذ الخدمة من المورد (${suborder.vendorName}) عن الموعد المحدد. المطلوب التواصل الفوري وتأكيد خطة التسليم.`,
          status: 'OPEN',
          resolutionDeadline: new Date(now + 30 * 60 * 1000).toISOString(),
        });
      }
    }

    // Rule 3: Abnormal Inactivity (> maxInactivityHours)
    const lastActivity = new Date(suborder.lastActivityAt || suborder.updatedAt).getTime();
    const inactivityHours = (now - lastActivity) / (3600 * 1000);
    if (!['COMPLETED', 'CLOSED', 'CANCELLED', 'REFUNDED'].includes(suborder.omsStatus) && inactivityHours > settings.maxInactivityHours) {
      if (!openException) {
        detectedExceptions.push({
          orderId: suborder.orderId,
          suborderId: suborder.id,
          issueType: 'INACTIVE_TOO_LONG',
          severity: 'MEDIUM',
          assignedRole: 'OPERATIONS',
          correctiveActionAr: `لم يسجل الطلب أي نشاط منذ أكثر من ${Math.round(inactivityHours)} ساعة. ينبغي التحقق من حالة التنفيذ.`,
          status: 'OPEN',
          resolutionDeadline: new Date(now + 120 * 60 * 1000).toISOString(),
        });
      }
    }

    // Rule 4: Open Dispute Notification
    if (suborder.omsStatus === 'DISPUTED') {
      if (!openException) {
        detectedExceptions.push({
          orderId: suborder.orderId,
          suborderId: suborder.id,
          issueType: 'DISPUTED',
          severity: 'HIGH',
          assignedRole: 'OPERATIONS',
          correctiveActionAr: `تم فتح نزاع من العميل على الطلب رقم (${suborder.bookingNumber}). يلزم مراجعة الشكوى والمخرجات وتوفير حل عادل.`,
          status: 'OPEN',
          resolutionDeadline: new Date(now + 24 * 3600 * 1000).toISOString(),
        });
      }
    }

    if (needsUpdate) {
      updatedSuborders.push(updatedSub);
    }
  }

  return { detectedExceptions, updatedSuborders };
}

export function determineEscalationLevel(
  exception: OMSException,
  settings: OMSSettings,
  nowDate: Date = new Date()
): { level: 'L1_VENDOR' | 'L2_OPERATIONS' | 'L3_MARKETPLACE_MANAGER' | 'L4_EXECUTIVE'; actionRequiredAr: string } {
  const detectedAt = new Date(exception.detectedAt).getTime();
  const elapsedMins = (nowDate.getTime() - detectedAt) / (60 * 1000);

  const policy = settings.escalationPolicy || {
    l1TimeoutMinutes: 30,
    l2TimeoutMinutes: 60,
    l3TimeoutMinutes: 120,
    l4TimeoutMinutes: 240,
  };

  if (elapsedMins >= policy.l3TimeoutMinutes || exception.severity === 'CRITICAL') {
    return {
      level: 'L4_EXECUTIVE',
      actionRequiredAr: 'تصعيد إلى الإدارة التنفيذية: الطلب متأخر بدرجة حرجة أو لم يعالج لفترة طويلة.',
    };
  } else if (elapsedMins >= policy.l2TimeoutMinutes || exception.severity === 'HIGH') {
    return {
      level: 'L3_MARKETPLACE_MANAGER',
      actionRequiredAr: 'تصعيد إلى مدير السوق: يتطلب اتخاذ قرار استبدال المورد أو الاسترجاع المالي.',
    };
  } else if (elapsedMins >= policy.l1TimeoutMinutes) {
    return {
      level: 'L2_OPERATIONS',
      actionRequiredAr: 'تصعيد إلى فريق العمليات: متابعة المورد بشكل مباشر وإلزامية التحديث.',
    };
  }

  return {
    level: 'L1_VENDOR',
    actionRequiredAr: 'تنبيه المورد بالمشكلة ومطالبته بالحل الفوري.',
  };
}
