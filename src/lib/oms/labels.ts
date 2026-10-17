export const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: 'طلب جديد', AWAITING_ACCEPTANCE: 'بانتظار مراجعة المورد', ACCEPTED: 'وافق المورد — بانتظار استكمال التأكيد',
  PENDING_PAYMENT: 'بانتظار الدفع', IN_PROGRESS: 'قيد التجهيز', READY_FOR_DELIVERY: 'جاهز للتنفيذ',
  DELIVERED: 'تم التسليم', CUSTOMER_REVIEW: 'بانتظار اعتماد الاستلام', COMPLETED: 'مكتمل', CLOSED: 'مغلق',
  CANCELLED: 'ملغى', REJECTED: 'اعتذر المورد', DISPUTED: 'نزاع قيد المراجعة', AT_RISK: 'يحتاج متابعة',
  DELAYED: 'متأخر', UNRESPONSIVE_VENDOR: 'تأخر رد المورد', MODIFICATION_REQUESTED: 'طلب تعديل',
};
