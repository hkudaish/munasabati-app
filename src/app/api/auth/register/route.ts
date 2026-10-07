import { NextResponse } from 'next/server';
import { createUserInDB, createVendorInDB } from '@/lib/server-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userType, customerData, vendorData } = body;

    if (!userType || !['client', 'vendor'].includes(userType)) {
      return NextResponse.json(
        { error: 'نوع الحساب غير صالح. يرجى اختيار صاحب مناسبة أو مورد.' },
        { status: 400 }
      );
    }

    if (userType === 'client') {
      if (!customerData?.name || !customerData?.phone || !customerData?.cityId) {
        return NextResponse.json(
          { error: 'يرجى إكمال بيانات الاسم ورقم الجوال والمدينة' },
          { status: 400 }
        );
      }

      const user = await createUserInDB({
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        role: 'CLIENT',
        cityId: customerData.cityId,
      });

      return NextResponse.json({
        success: true,
        messageAr: 'تم إنشاء حساب صاحب المناسبة بنجاح مرحباً بك!',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: 'client',
          cityId: user.cityId,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    }

    if (userType === 'vendor') {
      if (!vendorData?.businessName || !vendorData?.categoryId || !vendorData?.cityId || !vendorData?.contactPhone) {
        return NextResponse.json(
          { error: 'يرجى إكمال بيانات المنشأة ورقم التواصل والتصنيف والمدينة' },
          { status: 400 }
        );
      }

      // First create or find user
      const user = await createUserInDB({
        name: vendorData.contactName || vendorData.businessName,
        phone: vendorData.contactPhone,
        email: vendorData.email,
        role: 'VENDOR',
        cityId: vendorData.cityId,
      });

      // Create vendor profile
      const vendor = await createVendorInDB({
        userId: user.id,
        businessName: vendorData.businessName,
        businessNameEn: vendorData.businessNameEn,
        categoryId: vendorData.categoryId,
        cityId: vendorData.cityId,
        neighborhood: vendorData.neighborhood || 'حي الملقا',
        crNumber: vendorData.crNumber,
        freelanceLicense: vendorData.freelanceLicense,
        vatNumber: vendorData.vatNumber,
        startingPrice: Number(vendorData.startingPrice) || 1000,
        contactPhone: vendorData.contactPhone,
        whatsappNumber: vendorData.whatsappNumber || vendorData.contactPhone,
        bioAr: vendorData.bioAr || 'نقدم أفضل خدمات المناسبات بأعلى معايير الجودة والاحترافية.',
        specialtiesAr: vendorData.specialtiesAr || [],
      });

      return NextResponse.json({
        success: true,
        messageAr: 'تم تسجيل المنشأة بنجاح ومرحباً بك كشريك معتمد في مناسبتي!',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: 'vendor',
          cityId: user.cityId,
          vendorId: vendor.id,
          businessName: vendor.businessName,
          crNumber: vendor.crNumber,
          freelanceLicense: vendor.freelanceLicense,
          isVerified: Boolean(vendor.crNumber || vendor.freelanceLicense),
          createdAt: user.createdAt,
        },
        vendor,
      });
    }

    return NextResponse.json({ error: 'طلب غير معروف' }, { status: 400 });
  } catch (error: any) {
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    );
  }
}
