// Luma AI Order Assistant Engine
// Provides context-aware AI support for Customers, Vendors, and Operations Admins.

import type { OMSMasterOrder, OMSSuborder, OMSException } from './types';

export interface LumaAssistantResponse {
  summaryAr: string;
  suggestedActionsAr: string[];
  explanationAr?: string;
  requiresHumanAction?: boolean;
}

export function queryLumaCustomerAssistant(
  suborder: OMSSuborder,
  masterOrder: OMSMasterOrder
): LumaAssistantResponse {
  let summaryAr = `أهلاً بك! طلبك رقم (${suborder.bookingNumber}) بحالة: [${suborder.omsStatus}]. المنفذ: ${suborder.vendorName}.`;
  let explanationAr = 'طلبك يتم متابعته وتطبيقه وفق اتفاقية مستوى الخدمة وضمان المنصة.';
  const suggestedActionsAr: string[] = [];

  switch (suborder.omsStatus) {
    case 'AWAITING_ACCEPTANCE':
      explanationAr = `الطلب بانتظار تأكيد القبول النهائي من المورد (${suborder.vendorName}). ينتهي الوقت المحدد للقبول قريباً.`;
      suggestedActionsAr.push('إرسال تذكير للمورد عبر التطبيق');
      suggestedActionsAr.push('التواصل مع خدمة العملاء لطلب تسريع القبول');
      break;
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      explanationAr = `المورد (${suborder.vendorName}) يعمل حالياً على تجهيز وتنفيذ طلبك لليوم المحدد (${masterOrder.eventDate}).`;
      suggestedActionsAr.push('مراسلة المورد للاستفسار عن التفاصيل');
      suggestedActionsAr.push('استعراض تفاصيل العقد والملحقات');
      break;
    case 'READY_FOR_DELIVERY':
    case 'DELIVERED':
      explanationAr = `أكمل المورد العمل وتم رفع المخرجات. يرجى مراجعة الخدمة وتأكيد القبول.`;
      suggestedActionsAr.push('معاينة المخرجات المرفوعة');
      suggestedActionsAr.push('اعتماد استلام الخدمة');
      suggestedActionsAr.push('طلب تعديلات إضافية إذا كانت ضمن العقد');
      break;
    case 'DELAYED':
    case 'AT_RISK':
      summaryAr = `تنبيه من لُـمى: الطلب رقم (${suborder.bookingNumber}) مهدد بالتأخير. فريق العمليات يتواصل مع المورد لضمان التسليم.`;
      explanationAr = `رصدت المنصة بطئاً في الاستجابة وتم رفع درجة المتابعة لضمان عدم تأثير ذلك على مناك.`;
      suggestedActionsAr.push('طلب تدخل فوري من مشرف العمليات');
      suggestedActionsAr.push('طلب البديل الفوري المضمون');
      break;
    default:
      suggestedActionsAr.push('استعراض الجدول الزمني للطلب');
      break;
  }

  return {
    summaryAr,
    explanationAr,
    suggestedActionsAr,
  };
}

export function queryLumaVendorAssistant(
  vendorSuborders: OMSSuborder[]
): LumaAssistantResponse {
  const pendingAcceptance = vendorSuborders.filter((s) => s.omsStatus === 'AWAITING_ACCEPTANCE');
  const atRiskOrDelayed = vendorSuborders.filter((s) => s.isAtRisk || s.isDelayed);
  const inProgress = vendorSuborders.filter((s) => s.omsStatus === 'IN_PROGRESS');

  let summaryAr = `أهلاً بك في مساحة عمل المورد. لديك (${vendorSuborders.length}) طلبات نشطة.`;
  const suggestedActionsAr: string[] = [];

  if (pendingAcceptance.length > 0) {
    summaryAr += ` عاجل: لديك (${pendingAcceptance.length}) طلبات جديدة بانتظار قبولك فوراً لتجنب فقدانها.`;
    suggestedActionsAr.push(`قبول الطلب رقم (${pendingAcceptance[0].bookingNumber})`);
  }

  if (atRiskOrDelayed.length > 0) {
    summaryAr += ` تنبيه SLA: يوجد (${atRiskOrDelayed.length}) طلبات قريبة من التأخير.`;
    suggestedActionsAr.push(`تحديث نسبة التقدم للطلب (${atRiskOrDelayed[0].bookingNumber})`);
    suggestedActionsAr.push('طلب تمديد مهلة SLA مع توضيح السبب');
  }

  if (inProgress.length > 0) {
    suggestedActionsAr.push('رفع مخرجات وإثبات تسليم الخدمة');
  }

  return {
    summaryAr,
    suggestedActionsAr,
  };
}

export function queryLumaAdminAssistant(
  allSuborders: OMSSuborder[],
  exceptions: OMSException[]
): LumaAssistantResponse {
  const openExceptions = exceptions.filter((e) => e.status !== 'RESOLVED' && e.status !== 'CLOSED');
  const delayedSuborders = allSuborders.filter((s) => s.isDelayed);
  const awaitingAcceptance = allSuborders.filter((s) => s.omsStatus === 'AWAITING_ACCEPTANCE');

  let summaryAr = `تقرير لُـمى التشغيلي: يوجد (${openExceptions.length}) استثناءات مفتوحة تقتضي التدخل.`;
  const suggestedActionsAr: string[] = [];

  if (delayedSuborders.length > 0) {
    summaryAr += ` هناك (${delayedSuborders.length}) طلبات متأخرة عن مهلة SLA.`;
    suggestedActionsAr.push(`فتح قائمة الطلبات الأكثر خطورة "تتطلب تدخلاً الآن"`);
    suggestedActionsAr.push(`إعادة إسناد الطلب (${delayedSuborders[0].bookingNumber}) لمورد بديل`);
  }

  if (awaitingAcceptance.length > 0) {
    suggestedActionsAr.push(`تنبيه الموردين غير المستجيبين لعدد (${awaitingAcceptance.length}) طلبات`);
  }

  suggestedActionsAr.push('توليد تقرير بالأسباب الشائعة لتأخير الخدمات');

  return {
    summaryAr,
    suggestedActionsAr,
    requiresHumanAction: openExceptions.length > 0,
  };
}
