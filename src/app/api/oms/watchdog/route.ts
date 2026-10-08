import { NextResponse } from 'next/server';
import { getAllOMSOrders, getAllOMSExceptions, getOMSSettings, saveOMSException, saveOMSMasterOrder } from '@/lib/oms/store';
import { runOMSWatchdogScan } from '@/lib/oms/sla-watchdog';

export async function POST() {
  try {
    const orders = await getAllOMSOrders();
    const existingExceptions = await getAllOMSExceptions();
    const settings = await getOMSSettings();

    // Flatten all suborders from master orders
    const allSuborders = orders.flatMap((o) => o.suborders);

    const { detectedExceptions, updatedSuborders } = runOMSWatchdogScan(
      allSuborders,
      existingExceptions,
      settings
    );

    // Save newly created exceptions
    for (const exc of detectedExceptions) {
      await saveOMSException(exc);
    }

    // Save updated suborders status (e.g. risk/delayed flags)
    for (const sub of updatedSuborders) {
      const parentOrder = orders.find((o) => o.suborders.some((s) => s.id === sub.id));
      if (parentOrder) {
        const subIdx = parentOrder.suborders.findIndex((s) => s.id === sub.id);
        if (subIdx >= 0) {
          parentOrder.suborders[subIdx] = sub;
          await saveOMSMasterOrder(parentOrder);
        }
      }
    }

    return NextResponse.json({
      success: true,
      scannedOrdersCount: allSuborders.length,
      newExceptionsCount: detectedExceptions.length,
      detectedExceptions,
      messageAr: `تم تنفيذ مسح المراقبة الذاتية (Watchdog). تم رصد ${detectedExceptions.length} استثناءات جديدة.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في تشغيل خدمة المراقبة الذاتية' },
      { status: 500 }
    );
  }
}
