import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser, rateLimit } from './auth';
import { HttpError, text } from './http';
import { requireGeo } from './geo/context';
import { priceSelection, bookingInterval, overlaps } from '@/lib/oms/pricing';
import { validateStateTransition } from '@/lib/oms/state-machine';
import { aggregateMasterOrderStatus } from '@/lib/oms/orchestrator';
import type { ActorRole, OMSSuborder } from '@/lib/oms/types';

export const orderInclude = { city: true, suborders: { include: { items: true } } } as const;
export function serializeOrder(order: any) {
  return { ...order, cityNameAr: order.city?.nameAr || '', paymentMethod: order.paymentMethod.toLowerCase(),
    suborders: order.suborders.map((s: any) => ({ ...s, paymentStatus: order.paymentStatus, status: s.status.toLowerCase(), suborderId: s.id })) };
}
export function visibleOrder(order: any, user: any) {
  if (user.role !== 'VENDOR') return serializeOrder(order);
  const suborders = order.suborders.filter((s: any) => s.vendorId === user.vendorProfile?.id);
  const sum = (field: string) => suborders.reduce((n: number, s: any) => n + s[field], 0);
  return serializeOrder({ ...order, suborders, totalSubtotal: sum('subtotal'), totalTax: sum('taxAmount'), finalTotal: sum('totalAmount'), totalDeposit: sum('depositAmount'), couponDiscount: 0, couponCode: null,
    omsStatus: aggregateMasterOrderStatus(suborders) });
}
export function orderScope(user: any): Prisma.MultiVendorOrderWhereInput {
  if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return {};
  if (user.role === 'VENDOR') return { suborders: { some: { vendorId: user.vendorProfile?.id || '__none__' } } };
  return { customerId: user.id };
}
export async function listOrders() {
  const user = await requireUser();
  const orders = await prisma.multiVendorOrder.findMany({ where: orderScope(user), include: orderInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  return orders.map(o => visibleOrder(o, user));
}

async function transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(action, { isolationLevel: 'Serializable', timeout: 20000 }); }
    catch (error: any) { if (error.code !== 'P2034' || attempt >= 2) throw error; }
  }
}

export async function createOrder(input: Record<string, any>) {
  const user = await requireUser();
  await rateLimit(`commerce-create:${user.id}`, 60);
  const info = input.customerInfo || {};
  const requestKey = text(input.idempotencyKey, 128, true);
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(requestKey)) throw new HttpError(400, 'مفتاح إعادة المحاولة غير صالح');
  const items = input.items || input.cartGroups?.flatMap((g: any) => g.items);
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new HttpError(400, 'أضف من خدمة واحدة إلى 50 خدمة');
  if (items.some(i => !i || typeof i !== 'object' || Array.isArray(i) || (i.addons !== undefined && (!Array.isArray(i.addons) || i.addons.length > 30)))) throw new HttpError(400, 'عناصر الطلب أو الإضافات غير صالحة');
  const cityId = text(info.cityId, 100, true);
  const eventDate = text(info.eventDate, 10, true), eventTime = text(info.eventTime, 5, true);
  let interval;
  try { interval = bookingInterval(eventDate, eventTime, 1); } catch (e: any) { throw new HttpError(400, e.message); }
  if (interval.start <= Date.now()) throw new HttpError(400, 'موعد المناسبة يجب أن يكون في المستقبل');
  const customerName = text(info.customerName, 160, true), customerPhone = text(info.customerPhone, 25, true);
  if (!/^\+?\d{9,15}$/.test(customerPhone)) throw new HttpError(400, 'رقم الجوال غير صالح');
  const customerEmail = text(info.customerEmail, 254);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
  const occasionId = text(info.occasionId, 100), venueName = text(info.venueName, 500, true);
  const paymentMethod = text(info.paymentMethod || 'mada', 30).toUpperCase();
  if (!['MADA','APPLE_PAY','STC_PAY','TAMARA','CREDIT_CARD','BANK_TRANSFER'].includes(paymentMethod)) throw new HttpError(400, 'طريقة الدفع غير صالحة');
  // Coupons require a separate reservation/redemption workflow. Never trust a browser discount.
  if (info.couponCode) throw new HttpError(400, 'الخصومات غير مفعلة حالياً؛ أزل الكوبون لإرسال الطلب');
  const canonical = { customerName, customerPhone, customerEmail, cityId, eventDate, eventTime, occasionId, venueName, paymentMethod,
    isDepositOnly: info.isDepositOnly !== false, items: items.map((i: any) => ({ serviceId: text(i.serviceId, 100, true), packageId: text(i.packageId || i.selectedPackage?.id, 100) || null, quantity: i.quantity,
      addons: i.addons ?? [], notes: text(i.notes, 2000) })) };
  const requestHash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  const key = `commerce:${user.id}:${requestKey}`;
  return transaction(async tx => {
    // Serialize identical keys, including concurrent browser retries.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    const existing = await tx.idempotencyRecord.findUnique({ where: { key } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new HttpError(409, 'استُخدم مفتاح الطلب لبيانات مختلفة');
      const id = (existing.responseData as any).orderId;
      return serializeOrder(await tx.multiVendorOrder.findFirstOrThrow({ where: { id, customerId: user.id }, include: orderInclude }));
    }
    await requireGeo('feature:commerce', cityId, tx);
    if (occasionId && !await tx.occasion.findFirst({ where: { id: occasionId, userId: user.id } })) throw new HttpError(404, 'المناسبة غير موجودة');
    const groups = new Map<string, { vendor: any; items: any[] }>();
    for (const selection of canonical.items) {
      const service = await tx.serviceItem.findUnique({ where: { id: selection.serviceId }, include: { subcategory: true, artist: true, packages: true, addons: true, availability: true, vendor: { include: { user: true, availability: true } } } });
      if (!service || !service.isPublished || service.subcategory?.isActive === false || service.artist?.enabled === false || service.vendor.status !== 'ACTIVE' || service.vendor.user?.isActive === false) throw new HttpError(409, 'إحدى الخدمات غير متاحة');
      const configured = await tx.$queryRaw<any[]>`SELECT "id" FROM "ServiceDefinition" WHERE "kind"='OFFERING' AND "body"->>'serviceId'=${service.id} LIMIT 1`;
      if (configured.length) throw new HttpError(409, 'هذه الخدمة تستخدم إعدادات الحجز التفصيلية؛ افتح صفحة الخدمة ثم إدارة الحجز');
      if (service.cityId !== cityId && !service.vendor.serviceAreas.includes(cityId)) throw new HttpError(409, 'الخدمة لا تغطي المدينة المحددة');
      await requireGeo('item:' + service.id, cityId, tx);
      for (const availability of [service.availability, service.vendor.availability]) {
        if (!availability) continue;
        const day = new Date(eventDate + 'T12:00:00Z').getUTCDay();
        const days = (new Date(eventDate + 'T00:00:00+03:00').getTime() - new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date()) + 'T00:00:00+03:00').getTime()) / 86400000;
        if (availability.blackoutDates.includes(eventDate) || !availability.workingDays.includes(day) || days < availability.minNoticeDays || days > availability.maxAdvanceDays) throw new HttpError(409, 'الخدمة غير متاحة في التاريخ المحدد');
      }
      if (service.addons.some(a => (selection.addons || []).some((i: any) => i.addonId === a.id) && ['PER_HOUR','PER_PERSON'].includes(a.pricingType))) throw new HttpError(400, 'إضافات الساعة أو الشخص تتطلب عرض سعر مخصصاً');
      let priced;
      try { priced = priceSelection(service, selection); } catch (e: any) { throw new HttpError(400, e.message); }
      if (service.priceType === 'PER_PERSON' && !selection.packageId) throw new HttpError(400, 'الخدمة حسب الشخص تتطلب باقة بسعر محدد');
      const group = groups.get(service.vendorId) || { vendor: service.vendor, items: [] };
      group.items.push({ id: randomUUID(), serviceId: service.id, serviceTitleAr: [service.titleAr, service.artist?.nameAr].filter(Boolean).join(' — '), serviceImage: service.images[0] || '', ...priced,
        scheduledDate: eventDate, scheduledTime: eventTime, cityId, cityNameAr: '', venueAddress: venueName, notes: selection.notes });
      groups.set(service.vendorId, group);
    }
    const config = await tx.oMSAutomationConfig.findUnique({ where: { id: 'default' } });
    const deadline = new Date(Date.now() + (config?.acceptanceDeadlineMinutes ?? 120) * 60000);
    const suborders = Array.from(groups.values()).map(({ vendor, items }) => {
      const subtotal = items.reduce((n, i) => n + i.subtotal, 0), taxAmount = items.reduce((n, i) => n + i.taxAmount, 0), totalAmount = subtotal + taxAmount;
      return { id: randomUUID(), vendorId: vendor.id, vendorName: vendor.businessName, vendorLogo: vendor.logo,
        bookingNumber: `BK-${randomUUID()}`, subtotal, taxAmount, totalAmount, depositAmount: Math.round(totalAmount * 0.3), remainingAmount: totalAmount,
        status: 'PENDING' as const, omsStatus: 'AWAITING_ACCEPTANCE' as const, assignedRole: 'vendor', nextAction: 'VENDOR_ACCEPTANCE', acceptanceDeadline: deadline, nextActionDeadline: deadline,
        items: { create: items } };
    });
    const totalSubtotal = suborders.reduce((n, s) => n + s.subtotal, 0), totalTax = suborders.reduce((n, s) => n + s.taxAmount, 0);
    if (totalSubtotal + totalTax > 2_000_000_000) throw new HttpError(400, 'قيمة الطلب تتجاوز الحد المسموح');
    const order = await tx.multiVendorOrder.create({ data: {
      id: randomUUID(), orderNumber: `MN-${randomUUID()}`, customerId: user.id, customerName, customerPhone, customerEmail: customerEmail || null,
      occasionId: occasionId || null, eventDate, eventTime, cityId, venueName, paymentMethod: paymentMethod as any,
      isDepositOnly: canonical.isDepositOnly, totalSubtotal, totalTax, finalTotal: totalSubtotal + totalTax, totalDeposit: suborders.reduce((n, s) => n + s.depositAmount, 0),
      paymentStatus: 'UNPAID', status: 'requested', omsStatus: 'AWAITING_ACCEPTANCE', suborders: { create: suborders }
    }, include: orderInclude });
    for (const sub of order.suborders) {
      await tx.oMSOrderEvent.create({ data: { orderId: order.id, suborderId: sub.id, fromState: 'CREATED', toState: 'AWAITING_ACCEPTANCE', action: 'CREATE_ORDER', actorId: user.id, actorRole: 'CUSTOMER' } });
      const vendor = groups.get(sub.vendorId)!.vendor;
      // IN_APP means a durable inbox entry; no external delivery is claimed.
      await tx.oMSNotificationLog.create({ data: { orderId: order.id, suborderId: sub.id, recipientPhone: vendor.contactPhone, channel: 'IN_APP', event: 'ROUTED_TO_VENDOR', status: 'SENT' } });
    }
    await tx.idempotencyRecord.create({ data: { key, endpoint: '/api/oms/orders', requestHash, responseData: { orderId: order.id }, statusCode: 200 } });
    return serializeOrder(order);
  });
}

export async function transitionOrder(input: Record<string, any>) {
  const user = await requireUser();
  await rateLimit(`commerce-transition:${user.id}`, 120);
  const suborderId = text(input.suborderId, 100, true), targetState = text(input.targetState, 60, true), noteAr = text(input.noteAr, 2000);
  return transaction(async tx => {
    const initial = await tx.suborder.findFirst({ where: { OR: [{ id: suborderId }, { bookingNumber: suborderId }], order: orderScope(user) }, include: {items:{include:{service:true}}} });
    if (!initial) throw new HttpError(404, 'الطلب غير موجود');
    // Lock the vendor across dates so overnight bookings cannot race each other.
    const resourceKeys=Array.from(new Set(['vendor:'+initial.vendorId,...initial.items.filter(i=>i.service.artistId).map(i=>'artist:'+i.service.artistId)])).sort();
    for(const resource of resourceKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${resource}))::text`;
    const sub = await tx.suborder.findUniqueOrThrow({ where: { id: initial.id }, include: { vendor: true, items: { include: { service: { include: { packages: true } } } }, order: { include: orderInclude } } });
    const admin = ['ADMIN','SUPER_ADMIN'].includes(user.role);
    if (user.role === 'VENDOR' && sub.vendorId !== user.vendorProfile?.id) throw new HttpError(404, 'الطلب غير موجود');
    const role: ActorRole = admin ? 'ADMIN' : user.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    // Payment and refund results can only come from a verified gateway adapter.
    if (['PAYMENT_CONFIRMED','PENDING_REFUND','REFUNDED'].includes(targetState)) throw new HttpError(409, 'تتطلب هذه العملية تكامل دفع مؤكداً');
    if (targetState === 'CANCELLED' && sub.order.paymentStatus === 'PAID') throw new HttpError(409, 'إلغاء الطلب المدفوع يتطلب مسار الاسترداد');
    const validation = validateStateTransition(sub.omsStatus, targetState as any, role, noteAr);
    if (!validation.isValid || !validation.rule) throw new HttpError(422, validation.errorAr || 'انتقال غير مسموح');
    if (['IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED','COMPLETED','CLOSED'].includes(targetState) && sub.order.paymentStatus !== 'PAID') throw new HttpError(409, 'لم يتم تأكيد الدفع بعد');
    if (targetState === 'ACCEPTED') {
      if (sub.vendor.status !== 'ACTIVE') throw new HttpError(409, 'حساب المورد غير نشط');
      for (const item of sub.items) {
        await requireGeo('item:' + item.serviceId, item.cityId, tx);
        if (bookingInterval(item.scheduledDate, item.scheduledTime || '', item.service.executionDurationHours).start <= Date.now()) throw new HttpError(409, 'انتهى موعد تنفيذ الطلب');
      }
      const vendorReservations = await tx.$queryRaw<any[]>`SELECT * FROM "ServiceReservation" WHERE "resourceKey" IN (${Prisma.join(resourceKeys)}) AND "active"=true`;
      for (const item of sub.items) {
        const current=bookingInterval(item.scheduledDate,item.scheduledTime||'',Math.max(item.service.executionDurationHours,item.service.packages.find(p=>p.id===item.packageId)?.durationHours??0));
        if(vendorReservations.some(r=>overlaps(current,{start:+new Date(r.startAt),end:+new Date(r.endAt)}))) throw new HttpError(409,'يوجد حجز مؤكد متعارض في التقويم الموحد');
      }
      const booked = await tx.orderItem.findMany({ where: { suborder: { vendorId: sub.vendorId, id: { not: sub.id }, omsStatus: { in: ['ACCEPTED','IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED','CUSTOMER_REVIEW','PAUSED','AWAITING_CUSTOMER_INFO','EXTENSION_REQUESTED','MODIFICATION_REQUESTED','DISPUTED','CANCEL_REQUESTED'] } } }, include: { service: { include: { packages: true } } } });
      const intervalFor = (item: typeof sub.items[number]) => bookingInterval(item.scheduledDate, item.scheduledTime || '', Math.max(item.service.executionDurationHours, item.service.packages.find(p => p.id === item.packageId)?.durationHours ?? 0));
      for (const item of sub.items) for (const other of booked) {
        // Old bookings lacking a machine-readable time conservatively block the date.
        try {
          if (overlaps(intervalFor(item), intervalFor(other))) throw new HttpError(409, 'يوجد حجز متعارض لدى المورد');
        } catch (e) { if (e instanceof HttpError) throw e; if (item.scheduledDate === other.scheduledDate) throw new HttpError(409, 'يلزم مراجعة موعد الحجز السابق قبل التأكيد'); }
      }
    }
    const rule = validation.rule;
    const proofOfDelivery = text(input.proofOfDelivery, 2000), deliverablesUrl = text(input.deliverablesUrl, 2000);
    if (deliverablesUrl) { try { if (new URL(deliverablesUrl).protocol !== 'https:') throw Error(); } catch { throw new HttpError(400, 'رابط التسليم يجب أن يبدأ بـ https'); } }
    const config = await tx.oMSAutomationConfig.findUnique({ where: { id: 'default' } });
    if (targetState === 'DELIVERED' && (config?.deliveryProofRequired ?? true) && !proofOfDelivery && !sub.proofOfDelivery && !deliverablesUrl && !sub.deliverablesUrl) throw new HttpError(400, 'أرفق إثبات التسليم');
    const status = targetState === 'CANCELLED' ? 'CANCELLED' : targetState === 'DISPUTED' ? 'DISPUTED' : ['COMPLETED','CLOSED'].includes(targetState) ? 'COMPLETED' : targetState === 'IN_PROGRESS' ? 'IN_PREPARATION' : targetState === 'ACCEPTED' ? 'PENDING' : sub.status;
    await tx.suborder.update({ where: { id: sub.id }, data: { omsStatus: targetState as any, status, assignedRole: rule.nextAssignedRole, nextAction: targetState === 'ACCEPTED' && sub.order.paymentStatus !== 'PAID' ? 'AWAIT_PAYMENT_SETUP' : rule.nextAction,
      nextActionDeadline: targetState === 'ACCEPTED' ? null : sub.nextActionDeadline, lastActivityAt: new Date(), ...(proofOfDelivery ? { proofOfDelivery } : {}), ...(deliverablesUrl ? { deliverablesUrl } : {}) } });
    const states = sub.order.suborders.map(s => ({ ...s, omsStatus: s.id === sub.id ? targetState : s.omsStatus }));
    const omsStatus = aggregateMasterOrderStatus(states as unknown as OMSSuborder[]);
    await tx.multiVendorOrder.update({ where: { id: sub.orderId }, data: { omsStatus, status: omsStatus === 'COMPLETED' ? 'completed' : omsStatus === 'CANCELLED' ? 'cancelled' : omsStatus === 'IN_PROGRESS' ? 'in_preparation' : 'requested' } });
    await tx.oMSOrderEvent.create({ data: { orderId: sub.orderId, suborderId: sub.id, fromState: sub.omsStatus, toState: targetState as any, action: rule.actionName, actorId: user.id, actorRole: role, noteAr } });
    await tx.oMSNotificationLog.create({ data: { orderId: sub.orderId, suborderId: sub.id, recipientPhone: sub.order.customerPhone, recipientEmail: sub.order.customerEmail, channel: 'IN_APP', event: 'ORDER_UPDATED', status: 'SENT' } });
    const order = visibleOrder(await tx.multiVendorOrder.findUniqueOrThrow({ where: { id: sub.orderId }, include: orderInclude }), user);
    return { masterOrder: order, suborder: order.suborders.find((s: any) => s.id === sub.id) };
  });
}
