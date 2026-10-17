import { requireGeo,assertNotPreview } from '@/lib/server/geo/context';
import { HttpError } from '@/lib/server/http';
import { guardService } from '@/lib/server/features';
import { NextResponse } from 'next/server';
import { getAllOMSOrders, saveOMSMasterOrder, getOMSSettings } from '@/lib/oms/store';
import { buildMultiVendorMasterOrder } from '@/lib/oms/orchestrator';
import { recordOMSEvent } from '@/lib/oms/store';
import { generateNotificationText, sendOMSNotification } from '@/lib/oms/notifications';

async function GETHandler() {
  try {
    const orders = await getAllOMSOrders();
    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في استرجاع قائمة الطلبات' },
      { status: error instanceof HttpError ? error.status : 500 }
    );
  }
}

async function POSTHandler(req: Request) {
  try {
    const body = await req.json();
    const { cartGroups, customerInfo, idempotencyKey } = body;

    if (!cartGroups || !Array.isArray(cartGroups) || cartGroups.length === 0) {
      return NextResponse.json(
        { success: false, errorAr: 'السلة فارغة، يرجى إضافة خدمات قبل الشراء' },
        { status: 400 }
      );
    }

    if (!customerInfo || !customerInfo.customerName || !customerInfo.customerPhone) {
      return NextResponse.json(
        { success: false, errorAr: 'بيانات العميل والتواصل مطلوبة بشكل كامل' },
        { status: 400 }
      );
    }

    await assertNotPreview(req);
    await requireGeo('feature:commerce', customerInfo.cityId);
    for(const group of cartGroups)if(!Array.isArray(group.items)||!group.items.length)throw new HttpError(400,'عناصر الطلب مطلوبة');
    for (const group of cartGroups) for (const item of group.items) {
      if (item.cityId && item.cityId !== customerInfo.cityId) throw new HttpError(400,'مدينة الخدمة لا تطابق مدينة الطلب');
      await requireGeo('item:'+item.serviceId, customerInfo.cityId);
    }
    const settings = await getOMSSettings();
    const masterOrder = buildMultiVendorMasterOrder(
      cartGroups,
      customerInfo,
      settings.acceptanceDeadlineMinutes
    );

    await saveOMSMasterOrder(masterOrder);

    // Record Event & Trigger Notifications for each suborder
    for (const sub of masterOrder.suborders) {
      await recordOMSEvent({
        orderId: masterOrder.id,
        suborderId: sub.id,
        fromState: 'CREATED',
        toState: 'AWAITING_ACCEPTANCE',
        action: 'CREATE_MASTER_ORDER',
        actorRole: 'CUSTOMER',
        noteAr: `تم إنشاء الطلب بنجاح وتوجيهه إلى المورد (${sub.vendorName})`,
      });

      const notifText = generateNotificationText('ROUTED_TO_VENDOR', sub.bookingNumber, sub.vendorName);
      await sendOMSNotification({
        orderId: masterOrder.id,
        suborderId: sub.id,
        recipientPhone: sub.vendorId, // Vendor phone or ID
        channel: 'IN_APP',
        event: 'ROUTED_TO_VENDOR',
        titleAr: notifText.titleAr,
        messageAr: notifText.messageAr,
      });
    }

    return NextResponse.json({
      success: true,
      masterOrder,
      messageAr: 'تم تسجيل الطلب وتوزيع الخدمات على الموردين المعنيين بنجاح',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في إنشاء الطلب' },
      { status: error instanceof HttpError ? error.status : 500 }
    );
  }
}

export const GET = guardService(GETHandler, 'commerce');

export const POST = guardService(POSTHandler, 'commerce');
