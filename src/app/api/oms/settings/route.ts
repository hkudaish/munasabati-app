import { NextResponse } from 'next/server';
import { getOMSSettings, saveOMSSettings } from '@/lib/oms/store';

export async function GET() {
  try {
    const settings = await getOMSSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في استرجاع إعدادات الأتمتة' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings, actorUserId } = body;

    if (!settings) {
      return NextResponse.json(
        { success: false, errorAr: 'الإعدادات الجديدة مطلوبة' },
        { status: 400 }
      );
    }

    const saved = await saveOMSSettings(settings, actorUserId);
    return NextResponse.json({
      success: true,
      settings: saved,
      messageAr: 'تم حفظ وتفعيل إعدادات الأتمتة وقواعد التشغيل بنجاح دون الحاجة لإعادة التثبيت',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, errorAr: error?.message || 'فشل في حفظ إعدادات الأتمتة' },
      { status: 500 }
    );
  }
}
