import { NextResponse } from 'next/server';
import { getOMSSuborderById, saveOMSMasterOrder, recordOMSEvent } from '@/lib/oms/store';
import { validateStateTransition } from '@/lib/oms/state-machine';
import { aggregateMasterOrderStatus } from '@/lib/oms/orchestrator';
import { generateNotificationText, sendOMSNotification } from '@/lib/oms/notifications';
import type { OMSOrderStatus, ActorRole } from '@/lib/oms/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { suborderId, targetState, role, noteAr, deliverablesUrl, proofOfDelivery, actorUserId } = body;

    if (!suborderId || !targetState || !role) {
      return NextResponse.json(
        { success: false, errorAr: 'معرف الطلب والحالة المستهدفة ودور المستخدم مطلوبون' },
        { status: 400 }
      );
    }

    const targetSuborderData = await getOMSSuborderById(suborderId);
    if (!targetSuborderData) {
      return NextResponse.json(
        { success: false, errorAr: 'الطلب الفرعي المحدد غير موجود' },
        { status: 404 }
      );
    }

    const { suborder, masterOrder } = targetSuborderData;
    const currentState = suborder.omsStatus as OMSOrderStatus;
    const actorRole = role as ActorRole;

    // Validate Transition via State Machine Engine
    const validation = validateStateTransition(currentState, targetState as OMSOrderStatus, actorRole, noteAr);
    if (!validation.isValid || !validation.rule) {
      return NextResponse.json(
        { success: false, errorAr: validation.errorAr || 'انتقال حالة غير مسموح به' },
        { status: 422 }
      );
    }

    // Update Suborder fields
    suborder.omsStatus = targetState as OMSOrderStatus;
    suborder.assignedRole = validation.rule.nextAssignedRole;
    suborder.nextAction = validation.rule.nextAction;
    suborder.lastActivityAt = new Date().toISOString();
    suborder.updatedAt = new Date().toISOString();

    if (deliverablesUrl) suborder.deliverablesUrl = deliverablesUrl;
    if (proofOfDelivery) suborder.proofOfDelivery = proofOfDelivery;

    // Recalculate Master Order Status
    masterOrder.omsStatus = aggregateMasterOrderStatus(masterOrder.suborders);
    masterOrder.updatedAt = new Date().toISOString();

    await saveOMSMasterOrder(masterOrder);

    // Record Audit Event
    await recordOMSEvent({
      orderId: masterOrder.id,
      suborderId: suborder.id,
      fromState: currentState,
      toState: targetState as OMSOrderStatus,
      action: validation.rule.actionName,
      actorId: actorUserId,
      actorRole,
      noteAr: noteAr || `تم تحديث الحالة إلى [${targetState}] بواسطة [${role}]`,
    });

    // Send Proactive Notification
    let eventName = 'ORDER_UPDATED';
    if (targetState === 'ACCEPTED') eventName = 'VENDOR_ACCEPTED';
    if (targetState === 'REJECTED') eventName = 'VENDOR_REJECTED';
    if (targetState === 'READY_FOR_DELIVERY') eventName = 'READY_FOR_DELIVERY';
    if (targetState === 'DELIVERED') eventName = 'DELIVERED';
    if (targetState === 'DISPUTED') eventName = 'DISPUTE_OPENED';

    const notifText = generateNotificationText(eventName, suborder.bookingNumber, suborder.vendorName);
    await sendOMSNotification({
      orderId: masterOrder.id,
      suborderId: suborder.id,
      recipientPhone: masterOrder.customerPhone,
      recipientEmail: masterOrder.customerEmail,
      channel: 'IN_APP',
      event: eventName,
      titleAr: notifText.titleAr,
      messageAr: notifText.messageAr,
    });

    return NextResponse.json({
      success: true,
      suborder,
      masterOrder,
      messageAr: `تم تحديث حالة الطلب بنجاح إلى (${targetState})`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في تحديث حالة الطلب' },
      { status: 500 }
    );
  }
}
