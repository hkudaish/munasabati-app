'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import {
  Sparkles,
  Store,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  UserCheck,
  FileText,
  MapPin,
  Phone,
  Mail,
  Lock,
  Building2,
  DollarSign,
  TrendingUp,
  Heart,
  ChevronLeft,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function UserOnboardingModal() {
  const router = useRouter();
  const {
    cities,
    serviceCategories,
    occasionTypes,
    isOnboardingOpen,
    setIsOnboardingOpen,
    onboardingInitialRole,
    setOnboardingInitialRole,
    registerCustomer,
    registerVendor,
    loginUser,
    permissionNotice,
    clearPermissionNotice,
    switchRole,
  } = useApp();

  // Active step: 'select_role' | 'customer_form' | 'vendor_form' | 'login' | 'success'
  const [step, setStep] = useState<'select_role' | 'customer_form' | 'vendor_form' | 'login' | 'success'>('select_role');
  const [selectedRoleForOnboarding, setSelectedRoleForOnboarding] = useState<'client' | 'vendor'>('client');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ name: string; role: 'client' | 'vendor' | 'admin'; redirectPath: string } | null>(null);

  // Customer Form Data
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    cityId: 'riyadh',
    upcomingOccasionType: 'wedding',
    occasionDate: '',
    password: '',
    acceptTerms: true,
  });

  // Vendor Form Data
  const [vendorData, setVendorData] = useState({
    businessName: '',
    businessNameEn: '',
    categoryId: 'photography',
    cityId: 'riyadh',
    neighborhood: 'الملقا',
    crNumber: '',
    freelanceLicense: '',
    vatNumber: '',
    contactName: '',
    contactPhone: '',
    whatsappNumber: '',
    startingPrice: '2500',
    bioAr: '',
    password: '',
    acceptTerms: true,
  });

  // Login Form Data
  const [loginIdentifier, setLoginIdentifier] = useState('');

  // Sync initial role when modal opens
  useEffect(() => {
    if (isOnboardingOpen) {
      setErrorMessage('');
      if (onboardingInitialRole === 'vendor') {
        setSelectedRoleForOnboarding('vendor');
        setStep('vendor_form');
      } else if (onboardingInitialRole === 'client') {
        setSelectedRoleForOnboarding('client');
        setStep('customer_form');
      } else {
        setStep('select_role');
      }
    }
  }, [isOnboardingOpen, onboardingInitialRole]);

  if (!isOnboardingOpen && !permissionNotice?.open) return null;

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0d5c3a', '#c2933d', '#f59e0b', '#10b981'],
      });
    } catch (e) {
      // safe fallback
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!customerData.name.trim() || !customerData.phone.trim()) {
      setErrorMessage('يرجى كتابة الاسم ورقم الجوال بشكل صحيح.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerCustomer({
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      cityId: customerData.cityId,
      upcomingOccasionType: customerData.upcomingOccasionType,
      occasionDate: customerData.occasionDate,
      password: customerData.password,
    });

    setIsSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.error || 'حدث خطأ أثناء التسجيل');
      return;
    }

    triggerConfetti();
    setSuccessInfo({
      name: res.user?.name || customerData.name,
      role: 'client',
      redirectPath: '/',
    });
    setStep('success');
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!vendorData.businessName.trim() || !vendorData.contactPhone.trim()) {
      setErrorMessage('يرجى إدخال اسم المنشأة ورقم التواصل.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerVendor({
      businessName: vendorData.businessName,
      businessNameEn: vendorData.businessNameEn,
      categoryId: vendorData.categoryId,
      cityId: vendorData.cityId,
      neighborhood: vendorData.neighborhood,
      crNumber: vendorData.crNumber,
      freelanceLicense: vendorData.freelanceLicense,
      vatNumber: vendorData.vatNumber,
      contactName: vendorData.contactName || vendorData.businessName,
      contactPhone: vendorData.contactPhone,
      whatsappNumber: vendorData.whatsappNumber || vendorData.contactPhone,
      startingPrice: Number(vendorData.startingPrice) || 1500,
      bioAr: vendorData.bioAr,
      password: vendorData.password,
    });

    setIsSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.error || 'حدث خطأ أثناء تسجيل المورد');
      return;
    }

    triggerConfetti();
    setSuccessInfo({
      name: res.user?.businessName || vendorData.businessName,
      role: 'vendor',
      redirectPath: '/vendor',
    });
    setStep('success');
  };

  const handleLoginSubmit = async (identifier: string, requestedRole?: 'client' | 'vendor' | 'admin') => {
    setErrorMessage('');
    setIsSubmitting(true);
    const res = await loginUser(identifier, requestedRole);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'فشل تسجيل الدخول');
      return;
    }

    triggerConfetti();
    const dest = res.user?.role === 'admin' ? '/admin' : res.user?.role === 'vendor' ? '/vendor' : '/';
    setSuccessInfo({
      name: res.user?.name || 'مرحباً بك',
      role: res.user?.role || 'client',
      redirectPath: dest,
    });
    setStep('success');
  };

  const handleFinishSuccess = () => {
    const dest = successInfo?.redirectPath || '/';
    setIsOnboardingOpen(false);
    clearPermissionNotice();
    router.push(dest);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-saudi-sand-300 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 text-white p-5 sm:p-6 relative">
          <button
            onClick={() => {
              setIsOnboardingOpen(false);
              clearPermissionNotice();
            }}
            className="absolute left-4 top-4 p-2 text-gray-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-saudi-gold-400 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>منصة مناسبتـي الرقمية 🇸🇦</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-cairo text-white">
            {step === 'select_role' && 'اختر نوع الحساب للانطلاق'}
            {step === 'customer_form' && 'إنشاء حساب صاحب المناسبة 🎉'}
            {step === 'vendor_form' && 'تسجيل منشأة أو مورد جديد 🏪'}
            {step === 'login' && 'تسجيل الدخول إلى حسابك 🔐'}
            {step === 'success' && 'أهلاً وسهلاً بك في مناسبتـي! 🌟'}
          </h2>

          <p className="text-xs sm:text-sm text-gray-300 mt-1">
            {step === 'select_role' && 'سواء كنت تخطط لاحتفال فاخر أو تقدم خدمات احترافية، نوفر لك تجربة مخصصة بالكامل.'}
            {step === 'customer_form' && 'احجز أفضل الموردين والقاعات ونظّم ميزانيتك وبطاقات دعواتك في مكان واحد.'}
            {step === 'vendor_form' && 'انضم إلى شبكة الموردين المعتمدين في المملكة واستقبل طلبات الحجز وعروض الأسعار.'}
            {step === 'login' && 'سجّل الدخول للوصول إلى حجوزاتك، عروضك، ومساحة العمل الخاصة بك.'}
            {step === 'success' && 'تم تجهيز مساحة عملك بنجاح وتطبيق الصلاحيات الملائمة.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Permission Notice Banner if triggered from guarded route */}
          {permissionNotice?.open && step === 'select_role' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold">{permissionNotice.messageAr}</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  يرجى تحديد هويتك أدناه أو تسجيل الدخول بالحساب المناسب لمتابعة التصفح.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-3.5 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Select Role */}
          {step === 'select_role' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Customer Option Card */}
                <div
                  onClick={() => {
                    setSelectedRoleForOnboarding('client');
                    setStep('customer_form');
                  }}
                  className="group relative cursor-pointer rounded-2xl border-2 border-saudi-sand-300 hover:border-saudi-green-800 bg-gradient-to-b from-white to-saudi-sand-50/50 p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-saudi-green-100 text-saudi-green-900 flex items-center justify-center shadow-inner group-hover:scale-110 transition">
                        <Calendar className="w-6 h-6 text-saudi-green-800" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-saudi-green-50 text-saudi-green-800 border border-saudi-green-200">
                        صاحب المناسبة
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black font-cairo text-gray-900 group-hover:text-saudi-green-900 transition">
                        صاحب المناسبة (عميل)
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        أبحث عن خدمات وموردين وباقات لتنظيم مناسبتي الخاصة أو العائلية.
                      </p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-saudi-sand-200 text-xs text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>استعراض وحجز أكثر من 10 تصنيفات معتمدة</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>مخطط الطاولات والميزانية والبطاقات بالـ QR</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>عانية ونقوط رقمية فورية عبر Apple Pay ومدى</span>
                      </li>
                    </ul>
                  </div>

                  <button className="mt-5 w-full py-2.5 px-4 rounded-xl bg-saudi-green-800 group-hover:bg-saudi-green-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <span>متابعة كصاحب مناسبة</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* 2. Supplier Option Card */}
                <div
                  onClick={() => {
                    setSelectedRoleForOnboarding('vendor');
                    setStep('vendor_form');
                  }}
                  className="group relative cursor-pointer rounded-2xl border-2 border-saudi-sand-300 hover:border-saudi-gold-600 bg-gradient-to-b from-white to-amber-50/30 p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-saudi-gold-100 text-saudi-gold-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition">
                        <Store className="w-6 h-6 text-saudi-gold-700" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-saudi-gold-50 text-saudi-gold-800 border border-saudi-gold-200">
                        مورد / مزود خدمة
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black font-cairo text-gray-900 group-hover:text-saudi-gold-700 transition">
                        مورد / مزود خدمة
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        أقدم خدمات أو منتجات احتفالية وأرغب في عرضها واستقبال الحجوزات.
                      </p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-saudi-sand-200 text-xs text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>ظهور في سوق المناسبات عبر 10 مدن رئيسية</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>استقبال الحجوزات المباشرة وعروض الأسعار (RFQ)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>ضمان التحصيل المالي وفواتير ضريبية معتمدة 15%</span>
                      </li>
                    </ul>
                  </div>

                  <button className="mt-5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <span>متابعة كمورد معتمد</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Quick Switch & Demo Access */}
              <div className="pt-4 border-t border-saudi-sand-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>لديك حساب بالفعل على المنصة؟</span>
                  <button
                    onClick={() => setStep('login')}
                    className="font-bold text-saudi-green-800 hover:underline flex items-center gap-1"
                  >
                    <span>تسجيل الدخول</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Instant Demo Role Switchers for testing */}
                <div className="bg-saudi-sand-100/70 p-3 rounded-2xl">
                  <p className="text-[11px] font-bold text-gray-500 mb-2">⚡ تجربة فورية بنقرة واحدة (للاختبار والمراجعة):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleLoginSubmit('0501234567', 'client')}
                      className="text-[11px] font-bold py-1.5 px-2 bg-white rounded-xl border border-gray-200 hover:border-saudi-green-700 hover:bg-saudi-green-50 text-gray-800 transition flex items-center justify-center gap-1"
                    >
                      <span>👤 صاحب مناسبة (سارة)</span>
                    </button>
                    <button
                      onClick={() => handleLoginSubmit('0551234567', 'vendor')}
                      className="text-[11px] font-bold py-1.5 px-2 bg-white rounded-xl border border-gray-200 hover:border-saudi-gold-600 hover:bg-amber-50 text-gray-800 transition flex items-center justify-center gap-1"
                    >
                      <span>🏪 مورد معتمد (عدسة الفخامة)</span>
                    </button>
                    <button
                      onClick={() => handleLoginSubmit('0599999999', 'admin')}
                      className="text-[11px] font-bold py-1.5 px-2 bg-white rounded-xl border border-gray-200 hover:border-saudi-gold-600 hover:bg-amber-50 text-gray-800 transition flex items-center justify-center gap-1"
                    >
                      <span>🛡️ إدارة المنصة (Admin)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2A: Customer Registration Form */}
          {step === 'customer_form' && (
            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة لاختيار نوع الحساب</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    placeholder="مثال: سارة عبدالعزيز العتيبي"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال السعودي *</label>
                  <input
                    type="tel"
                    required
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    placeholder="sara@example.com"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المدينة *</label>
                  <select
                    value={customerData.cityId}
                    onChange={(e) => setCustomerData({ ...customerData, cityId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  >
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.nameAr} ({city.regionAr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">نوع المناسبة القادمة</label>
                  <select
                    value={customerData.upcomingOccasionType}
                    onChange={(e) => setCustomerData({ ...customerData, upcomingOccasionType: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  >
                    {occasionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ المناسبة التقريبي</label>
                  <input
                    type="date"
                    value={customerData.occasionDate}
                    onChange={(e) => setCustomerData({ ...customerData, occasionDate: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">تعيين كلمة المرور</label>
                  <input
                    type="password"
                    value={customerData.password}
                    onChange={(e) => setCustomerData({ ...customerData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>جاري إنشاء الحساب...</span>
                  ) : (
                    <>
                      <span>إنشاء الحساب وبدء التخطيط 🚀</span>
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2B: Supplier Registration Form */}
          {step === 'vendor_form' && (
            <form onSubmit={handleVendorSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة لاختيار نوع الحساب</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم المنشأة أو العلامة التجارية *</label>
                  <input
                    type="text"
                    required
                    value={vendorData.businessName}
                    onChange={(e) => setVendorData({ ...vendorData, businessName: e.target.value })}
                    placeholder="مثال: لافندر لتنسيق الكوش والزهور"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الاسم التجاري بالإنجليزية</label>
                  <input
                    type="text"
                    value={vendorData.businessNameEn}
                    onChange={(e) => setVendorData({ ...vendorData, businessNameEn: e.target.value })}
                    placeholder="Lavender Events"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">تصنيف الخدمة الأساسي *</label>
                  <select
                    value={vendorData.categoryId}
                    onChange={(e) => setVendorData({ ...vendorData, categoryId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 bg-white"
                  >
                    {serviceCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المدينة الرئيسية *</label>
                  <select
                    value={vendorData.cityId}
                    onChange={(e) => setVendorData({ ...vendorData, cityId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 bg-white"
                  >
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الحي / المنطقة</label>
                  <input
                    type="text"
                    value={vendorData.neighborhood}
                    onChange={(e) => setVendorData({ ...vendorData, neighborhood: e.target.value })}
                    placeholder="مثال: حطين / النرجس"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">السجل التجاري أو وثيقة العمل الحر</label>
                  <input
                    type="text"
                    value={vendorData.crNumber}
                    onChange={(e) => setVendorData({ ...vendorData, crNumber: e.target.value })}
                    placeholder="1010XXXXXX أو FL-XXXXX"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم المسؤول / مدير الحساب</label>
                  <input
                    type="text"
                    value={vendorData.contactName}
                    onChange={(e) => setVendorData({ ...vendorData, contactName: e.target.value })}
                    placeholder="اسم ممثل المنشأة"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال للتواصل *</label>
                  <input
                    type="tel"
                    required
                    value={vendorData.contactPhone}
                    onChange={(e) => setVendorData({ ...vendorData, contactPhone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الواتساب لاستقبال الحجوزات</label>
                  <input
                    type="tel"
                    value={vendorData.whatsappNumber}
                    onChange={(e) => setVendorData({ ...vendorData, whatsappNumber: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">متوسط السعر المبدئي (ر.س)</label>
                  <input
                    type="number"
                    value={vendorData.startingPrice}
                    onChange={(e) => setVendorData({ ...vendorData, startingPrice: e.target.value })}
                    placeholder="1500"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">نبذة تعريفية بالخدمات والمنتجات</label>
                  <textarea
                    rows={2}
                    value={vendorData.bioAr}
                    onChange={(e) => setVendorData({ ...vendorData, bioAr: e.target.value })}
                    placeholder="اكتب نبذة مختصرة عن خبرتكم في تنظيم وتجهيز المناسبات..."
                    className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>جاري تسجيل المورد وتفعيل البوابة...</span>
                  ) : (
                    <>
                      <span>إتمام تسجيل المنشأة وتفعيل بوابة الموردين 🏪</span>
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2C: Login Form */}
          {step === 'login' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة لاختيار نوع الحساب</span>
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!loginIdentifier.trim()) {
                    setErrorMessage('يرجى إدخال رقم الجوال أو البريد الإلكتروني');
                    return;
                  }
                  handleLoginSubmit(loginIdentifier);
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال أو البريد الإلكتروني</label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="05XXXXXXXX أو البريد الإلكتروني"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-sm shadow-md transition"
                >
                  {isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </button>
              </form>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-500 mb-2">أو الدخول المباشر للحسابات التجريبية:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleLoginSubmit('0501234567', 'client')}
                    className="text-xs font-bold p-2.5 bg-saudi-sand-50 rounded-xl border border-saudi-sand-300 hover:border-saudi-green-800 text-saudi-green-900 text-center transition"
                  >
                    صاحب مناسبة
                  </button>
                  <button
                    onClick={() => handleLoginSubmit('0551234567', 'vendor')}
                    className="text-xs font-bold p-2.5 bg-saudi-sand-50 rounded-xl border border-saudi-sand-300 hover:border-saudi-gold-600 text-saudi-gold-800 text-center transition"
                  >
                    مورد معتمد
                  </button>
                  <button
                    onClick={() => handleLoginSubmit('0599999999', 'admin')}
                    className="text-xs font-bold p-2.5 bg-saudi-sand-50 rounded-xl border border-saudi-sand-300 hover:border-saudi-green-800 text-gray-900 text-center transition"
                  >
                    مشرف المنصة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Success Confirmation */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black font-cairo text-gray-900">
                  مرحباً بك، {successInfo?.name}! 🎉
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-md mx-auto">
                  {successInfo?.role === 'vendor'
                    ? 'تم تفعيل حساب المورد وحفظ هويتك في قاعدة البيانات بنجاح. تم توجيهك إلى بوابة الموردين لإدارة الخدمات والطلبات.'
                    : successInfo?.role === 'admin'
                    ? 'تم تسجيل الدخول بصلاحيات الإدارة والتحكم الكاملة.'
                    : 'تم تسجيلك بنجاح كصاحب مناسبة. يمكنك الآن اكتشاف الموردين، طلب عروض الأسعار، وتخطيط مناسبتك بكل يسر.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleFinishSuccess}
                  className="px-8 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-sm shadow-lg transition"
                >
                  الانتقال إلى لوحة التحكم الآن ←
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
