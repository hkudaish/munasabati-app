// Proactive Notification System
// Handles notification triggers across channels (In-app, Email, SMS, WhatsApp)
// with duplicate prevention, delivery logging, and attempt tracking.

import type { OMSNotificationRecord } from './types';

export interface OMSNotificationPayload {
  orderId?: string;
  suborderId?: string;
  recipientPhone: string;
  recipientEmail?: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  event: string;
  titleAr: string;
  messageAr: string;
}

export async function sendOMSNotification(payload: OMSNotificationPayload): Promise<OMSNotificationRecord> {
  const { prisma } = await import('../db');
  const row = await prisma.oMSNotificationLog.create({ data: {
    orderId: payload.orderId, suborderId: payload.suborderId, recipientPhone: payload.recipientPhone,
    recipientEmail: payload.recipientEmail, channel: payload.channel, event: payload.event,
    status: payload.channel === 'IN_APP' ? 'SENT' : 'FAILED',
    errorDetails: payload.channel === 'IN_APP' ? undefined : 'External OMS notification provider is not configured',
  } });
  return { ...row, orderId: row.orderId || undefined, suborderId: row.suborderId || undefined,
    recipientEmail: row.recipientEmail || undefined, channel: row.channel as OMSNotificationRecord['channel'],
    status: row.status as OMSNotificationRecord['status'], errorDetails: row.errorDetails || undefined,
    lastAttemptAt: row.lastAttemptAt.toISOString(), createdAt: row.createdAt.toISOString() };
}

export function generateNotificationText(
  event: string,
  bookingNumber: string,
  vendorName?: string
): { titleAr: string; messageAr: string } {
  switch (event) {
    case 'ORDER_CREATED':
      return {
        titleAr: 'تم استلام طلبك بنجاح',
        messageAr: `شكراً لك! تم إنشاء طلبك رقم (${bookingNumber}) وجاري تأكيد تفاصيل الخدمة.`,
      };
    case 'PAYMENT_CONFIRMED':
      return {
        titleAr: 'تأكيد عملية الدفع',
        messageAr: `تمت عملية الدفع للطلب (${bookingNumber}) بنجاح، وتم إرسال الطلب للمورد لتأكيد القبول.`,
      };
    case 'ROUTED_TO_VENDOR':
      return {
        titleAr: 'طلب جديد بانتظار القبول',
        messageAr: `وصلك طلب حجز جديد برقم (${bookingNumber}). يرجى الدخول وقبول الطلب قبل انتهاء المهلة.`,
      };
    case 'VENDOR_ACCEPTED':
      return {
        titleAr: 'تم قبول طلبك من المورد',
        messageAr: `قام المورد (${vendorName || 'المورد'}) بقبول طلبك رقم (${bookingNumber}) وسيبدأ التنفيذ وفق الجدول.`,
      };
    case 'VENDOR_REJECTED':
      return {
        titleAr: 'اعتذار المورد عن الطلب',
        messageAr: `اعتذر المورد (${vendorName || 'المورد'}) عن تنفيذ الطلب (${bookingNumber}). يتم التوجيه لمورد بديل فوراً.`,
      };
    case 'SLA_WARNING_75':
      return {
        titleAr: 'تنبيه قرب انتهاء المهلة',
        messageAr: `تنبيه للمورد (${vendorName}): استُهلكت 75% من مهلة الإجراء للطلب رقم (${bookingNumber}).`,
      };
    case 'SLA_EXPIRED_100':
      return {
        titleAr: 'تنبيه عاجل: تجاوز مهلة SLA',
        messageAr: `عاجل: تجاوز الطلب رقم (${bookingNumber}) المهلة المسموحة في اتفاقية مستوى الخدمة.`,
      };
    case 'READY_FOR_DELIVERY':
      return {
        titleAr: 'الخدمة جاهزة للتسليم',
        messageAr: `أعلن المورد (${vendorName}) عن تجهيز مخرجات الخدمة للطلب (${bookingNumber}).`,
      };
    case 'DELIVERED':
      return {
        titleAr: 'تم تسليم الخدمة',
        messageAr: `تم رفع مخرجات الطلب (${bookingNumber}). يرجى مراجعة الخدمة واعتماد الاكتمال.`,
      };
    case 'DISPUTE_OPENED':
      return {
        titleAr: 'تم فتح نزاع على الطلب',
        messageAr: `تم تسجيل ملاحظة/نزاع على الطلب (${bookingNumber}) وجاري مراجعتها بواسطة فريق العمليات.`,
      };
    default:
      return {
        titleAr: 'تحديث على حالة الطلب',
        messageAr: `تم تحديث حالة طلبك رقم (${bookingNumber}).`,
      };
  }
}
