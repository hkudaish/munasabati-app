import { NextResponse } from 'next/server';
import { findUserInDB } from '@/lib/server-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, requestedRole } = body;

    if (!identifier) {
      return NextResponse.json(
        { error: 'يرجى إدخال رقم الجوال أو البريد الإلكتروني' },
        { status: 400 }
      );
    }

    // Try finding user in PostgreSQL
    const dbUser = await findUserInDB(identifier);

    if (dbUser) {
      const roleMapped = dbUser.role === 'ADMIN' ? 'admin' : dbUser.role === 'VENDOR' ? 'vendor' : 'client';
      return NextResponse.json({
        success: true,
        user: {
          id: dbUser.id,
          name: dbUser.name,
          phone: dbUser.phone,
          email: dbUser.email,
          role: roleMapped,
          cityId: dbUser.cityId,
          avatar: dbUser.avatar,
          vendorId: dbUser.vendorProfile?.id,
          businessName: dbUser.vendorProfile?.businessName,
          hasAdminAccess: dbUser.role === 'ADMIN',
        },
      });
    }

    // Demo/Simulated accounts fallback so testing is effortless
    if (identifier.includes('admin') || requestedRole === 'admin') {
      return NextResponse.json({
        success: true,
        user: {
          id: 'admin-super-1',
          name: 'إدارة المنصة المركزية',
          phone: '0599999999',
          email: 'admin@munasabati.sa',
          role: 'admin',
          hasAdminAccess: true,
          cityId: 'riyadh',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        },
      });
    }

    if (requestedRole === 'vendor' || identifier.includes('vendor')) {
      return NextResponse.json({
        success: true,
        user: {
          id: 'vendor-user-1',
          name: 'عبدالله السبيعي (عدسة الفخامة)',
          phone: identifier.startsWith('05') ? identifier : '0551234567',
          email: 'vendor@luxurylens.sa',
          role: 'vendor',
          vendorId: 'vendor-1',
          businessName: 'عدسة الفخامة للإنتاج والتصوير السينمائي',
          crNumber: '1010892341',
          isVerified: true,
          cityId: 'riyadh',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        },
      });
    }

    // Default client account
    return NextResponse.json({
      success: true,
      user: {
        id: 'client-user-' + Date.now().toString().slice(-4),
        name: 'سارة العتيبي (صاحبة المناسبة)',
        phone: identifier.startsWith('05') ? identifier : '0501234567',
        email: 'sara.otb@gmail.com',
        role: 'client',
        cityId: 'riyadh',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      },
    });
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
