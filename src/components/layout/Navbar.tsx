'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/store';
import {
  Sparkles,
  MapPin,
  Calendar,
  PlusCircle,
  ShoppingBag,
  Store,
  ShieldCheck,
  QrCode,
  Layers,
  ChevronDown,
  Menu,
  X,
  FileText,
  Lightbulb,
  Music,
  ArrowLeftRight,
  User,
  LogOut,
  UserPlus,
  LogIn,
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  Settings,
  CreditCard,
} from 'lucide-react';

function NavbarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const {
    adminConfig,
    currentRole,
    currentUser,
    switchRole,
    openOnboarding,
    logoutUser,
    cities,
    selectedCity,
    setSelectedCity,
    occasions,
    activeOccasion,
    setActiveOccasionId,
    setIsAIOpen,
    cart,
    comparisonVendorIds,
  } = useApp();

  const [isOccasionDropdownOpen, setIsOccasionDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeCityObj = cities.find((c) => c.id === selectedCity) || cities[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-saudi-sand-200 shadow-sm">
      {/* Top Banner for Role Switcher & City & User Auth */}
      <div className="bg-saudi-green-900 text-white text-xs py-1.5 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* City & Location Selector */}
          <div className="relative flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-saudi-gold-400" />
            <span className="text-gray-300 hidden sm:inline">المدينة:</span>
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="font-bold text-saudi-gold-300 hover:text-white flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded transition"
            >
              <span>{activeCityObj.nameAr}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isCityDropdownOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-44 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-fadeIn"
                onClick={() => setIsCityDropdownOpen(false)}
              >
                {cities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => setSelectedCity(city.id)}
                    className={`w-full text-right px-3 py-1.5 text-xs hover:bg-saudi-green-50 flex items-center justify-between ${
                      selectedCity === city.id ? 'font-bold text-saudi-green-800 bg-saudi-green-50' : ''
                    }`}
                  >
                    <span>{city.nameAr}</span>
                    <span className="text-[10px] text-gray-400">{city.regionAr}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Switcher & Account Access */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Visual Segmented Role Switcher matching reference image */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-gray-300 text-[11px] sm:text-xs font-medium hidden md:inline">عرض بصفتك:</span>
              <div className="bg-saudi-green-950/90 p-0.5 rounded-lg border border-saudi-gold-500/30 flex items-center gap-0.5 sm:gap-1 shadow-inner">
                {/* 1. Customer Option */}
                <button
                  onClick={() => {
                    switchRole('client');
                    if (pathname === '/vendor' || pathname === '/admin') {
                      router.push('/');
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                    currentRole === 'client'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="تصفح المنصة كصاحب مناسبة"
                >
                  <span>صاحب المناسبة</span>
                </button>

                {/* 2. Supplier Option */}
                <button
                  onClick={() => {
                    const res = switchRole('vendor');
                    if (res.allowed && pathname === '/admin') {
                      router.push('/vendor');
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                    currentRole === 'vendor'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="الدخول لبوابة الموردين والشركاء"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>بوابة الموردين</span>
                </button>

                {/* 3. Admin Option (elevated gold badge if active or admin) */}
                <button
                  onClick={() => {
                    const res = switchRole('admin');
                    if (res.allowed && pathname === '/vendor') {
                      router.push('/admin');
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                    currentRole === 'admin'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="لوحة الإدارة المركزية (للمشرفين)"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>لوحة الإدارة</span>
                </button>
              </div>
            </div>

            {/* User Profile or Register/Login Button */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2 sm:px-2.5 py-1 rounded-lg text-white text-xs transition border border-white/10"
                >
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                    alt={currentUser.name}
                    className="w-4 h-4 rounded-full object-cover border border-saudi-gold-400"
                  />
                  <span className="font-bold max-w-[85px] sm:max-w-[120px] truncate">{currentUser.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                    currentUser.role === 'admin'
                      ? 'bg-purple-900/60 text-purple-200'
                      : currentUser.role === 'vendor'
                      ? 'bg-saudi-gold-500/30 text-saudi-gold-300'
                      : 'bg-emerald-800 text-emerald-200'
                  }`}>
                    {currentUser.role === 'admin' ? 'إدارة' : currentUser.role === 'vendor' ? 'مورد' : 'عميل'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-300" />
                </button>

                {isUserDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-1.5 w-60 bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-fadeIn"
                    onClick={() => setIsUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-bold text-gray-900 text-xs">{currentUser.name}</p>
                      <p className="text-[11px] text-gray-500">{currentUser.phone || currentUser.email}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-saudi-sand-100 text-saudi-green-900">
                          {currentUser.role === 'admin'
                            ? '🛡️ مشرف النظام العام'
                            : currentUser.role === 'vendor'
                            ? '🏪 حساب مورد معتمد'
                            : '👤 حساب صاحب المناسبة'}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 text-xs">
                      {currentUser.role !== 'vendor' && (
                        <button
                          onClick={() => openOnboarding('vendor')}
                          className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-saudi-gold-800 font-bold flex items-center gap-2"
                        >
                          <Store className="w-4 h-4 text-saudi-gold-600" />
                          <span>ترقية الحساب أو تسجيل منشأة كمورد</span>
                        </button>
                      )}

                      {currentUser.role === 'vendor' && (
                        <Link
                          href="/vendor"
                          className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-gray-800 font-semibold flex items-center gap-2"
                        >
                          <Store className="w-4 h-4 text-saudi-green-800" />
                          <span>بوابة المورد وإدارة الخدمات</span>
                        </Link>
                      )}

                      <button
                        onClick={() => openOnboarding()}
                        className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-gray-800 font-semibold flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4 text-gray-600" />
                        <span>تبديل الحساب أو إنشاء حساب جديد</span>
                      </button>

                      <button
                        onClick={logoutUser}
                        className="w-full text-right px-4 py-2 hover:bg-red-50 text-red-700 font-semibold flex items-center gap-2 border-t border-gray-100 mt-1"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openOnboarding()}
                  className="bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black px-2.5 sm:px-3 py-1 rounded-md text-[11px] transition shadow-sm flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3 text-saudi-green-950" />
                  <span>إنشاء حساب</span>
                </button>
                <button
                  onClick={() => openOnboarding()}
                  className="text-gray-300 hover:text-white px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  <span className="hidden sm:inline">تسجيل الدخول</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Right: Logo & Slogan */}
          <div className="flex items-center gap-5 lg:gap-7">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saudi-green-800 to-saudi-green-950 flex items-center justify-center text-saudi-gold-400 shadow-md group-hover:scale-105 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-saudi-green-900 font-cairo">
                  {adminConfig.platformNameAr}
                </span>
                <span className="text-[10px] -mt-1 text-saudi-gold-600 font-medium">
                  {adminConfig.taglineAr}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links — Context Filtered by Active Role */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-gray-700">
              {/* 1. When Active Role is Client (Customer) */}
              {currentRole === 'client' && (
                <>
                  <Link
                    href="/"
                    className={`px-3 py-2 rounded-lg transition ${
                      pathname === '/' ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    الرئيسية
                  </Link>
                  <Link
                    href="/marketplace"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/marketplace') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-saudi-gold-600" />
                    <span>سوق الخدمات</span>
                  </Link>
                  <Link
                    href="/packages"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/packages') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-saudi-gold-600" />
                    <span>الباقات الذكية</span>
                  </Link>
                  <Link
                    href="/calculator"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/calculator') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-saudi-gold-600" />
                    <span>حاسبة التكاليف</span>
                  </Link>
                  <Link
                    href="/rfq"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/rfq') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-saudi-gold-600" />
                    <span>عروض الأسعار</span>
                  </Link>
                  <Link
                    href="/bookings"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/bookings') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                    <span>حجوزاتي وفواتيري</span>
                  </Link>
                  <Link
                    href="/zaffah"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/zaffah') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Music className="w-4 h-4 text-saudi-gold-600" />
                    <span>الزفات والفنون</span>
                  </Link>
                  <Link
                    href="/inspiration"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/inspiration') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 text-saudi-gold-600" />
                    <span>إلهام</span>
                  </Link>
                  <Link
                    href="/scan"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/scan') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-saudi-green-700" />
                    <span>ماسح الدخول</span>
                  </Link>
                </>
              )}

              {/* 2. When Active Role is Vendor (Supplier) */}
              {currentRole === 'vendor' && (
                <>
                  <Link
                    href="/vendor"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/vendor' ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-saudi-green-800" />
                    <span>بوابة الموردين</span>
                  </Link>
                  <Link
                    href="/vendor"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4 text-saudi-gold-600" />
                    <span>طلبات الحجز المباشرة</span>
                  </Link>
                  <Link
                    href="/vendor"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4 text-saudi-gold-600" />
                    <span>طلبات عروض الأسعار (RFQ)</span>
                  </Link>
                  <Link
                    href="/vendor"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <Layers className="w-4 h-4 text-saudi-gold-600" />
                    <span>خدماتي وباقاتي</span>
                  </Link>
                  <Link
                    href="/vendor"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                    <span>التوثيق والتراخيص</span>
                  </Link>
                  <Link
                    href="/marketplace"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1 text-gray-500"
                  >
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                    <span>استعراض السوق كعميل</span>
                  </Link>
                </>
              )}

              {/* 3. When Active Role is Admin */}
              {currentRole === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/admin' && (!currentTab || currentTab === 'overview')
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-gold-600" />
                    <span>لوحة الإدارة المركزية</span>
                  </Link>
                  <Link
                    href="/admin/oms"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/admin/oms'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-saudi-gold-600" />
                    <span>إدارة الطلبات (OMS)</span>
                  </Link>
                  <Link
                    href="/admin?tab=vendors"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'vendors'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-saudi-gold-600" />
                    <span>الموردين والاعتماد</span>
                  </Link>
                  <Link
                    href="/admin?tab=bookings"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'bookings'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-saudi-gold-600" />
                    <span>الحجوزات والمالية</span>
                  </Link>
                  <Link
                    href="/admin?tab=services"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'services'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-saudi-gold-600" />
                    <span>إعدادات الكتالوج</span>
                  </Link>
                  <Link
                    href="/"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1 text-gray-500"
                  >
                    <span>معاينة الواجهة كعميل</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Left: Role-Specific Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 1. Customer Actions */}
            {currentRole === 'client' && (
              <>
                {/* Active Occasion Workspace Selector Button */}
                {occasions.length > 0 && (
                  <div className="relative hidden xl:block">
                    <button
                      onClick={() => setIsOccasionDropdownOpen(!isOccasionDropdownOpen)}
                      className="flex items-center gap-2 bg-saudi-sand-100 border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-xl text-right transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-saudi-green-800 text-saudi-gold-300 flex items-center justify-center text-xs font-bold">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 line-clamp-1 max-w-[130px]">
                          {activeOccasion?.title}
                        </span>
                        <span className="text-[10px] text-saudi-green-700 font-semibold">
                          جاهزية: {activeOccasion?.readinessPercentage}%
                        </span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>

                    {isOccasionDropdownOpen && (
                      <div
                        className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-fadeIn"
                        onClick={() => setIsOccasionDropdownOpen(false)}
                      >
                        <div className="text-[11px] font-bold text-gray-400 px-3 py-1 border-b border-gray-100">
                          مناسباتك الحالية ({occasions.length})
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 my-1">
                          {occasions.map((occ) => (
                            <button
                              key={occ.id}
                              onClick={() => {
                                setActiveOccasionId(occ.id);
                                router.push(`/occasion/${occ.id}`);
                              }}
                              className={`w-full text-right p-2.5 rounded-xl text-xs hover:bg-saudi-sand-50 transition flex items-center justify-between ${
                                occ.id === activeOccasion?.id ? 'bg-saudi-green-50 border border-saudi-green-200' : ''
                              }`}
                            >
                              <div>
                                <p className="font-bold text-gray-900">{occ.title}</p>
                                <p className="text-[10px] text-gray-500">{occ.cityNameAr} • {occ.date}</p>
                              </div>
                              <span className="text-[11px] font-bold text-saudi-green-800 bg-saudi-green-100 px-2 py-0.5 rounded-full">
                                {occ.readinessPercentage}%
                              </span>
                            </button>
                          ))}
                        </div>
                        <Link
                          href="/plan"
                          className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-saudi-green-800 text-white font-bold rounded-xl text-xs hover:bg-saudi-green-900 transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-saudi-gold-300" />
                          <span>إنشاء مناسبة جديدة</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Compare Bar Button if active */}
                {comparisonVendorIds.length > 0 && (
                  <Link
                    href="/compare"
                    className="flex items-center gap-1.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border border-saudi-sand-300 transition"
                    title="مقارنة الموردين"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-saudi-gold-600" />
                    <span className="hidden sm:inline">مقارنة</span>
                    <span className="bg-saudi-gold-500 text-saudi-green-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {comparisonVendorIds.length}
                    </span>
                  </Link>
                )}

                {/* Shopping Cart Button */}
                <Link
                  href="/cart"
                  className="relative flex items-center gap-1.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border border-saudi-sand-300 transition"
                  title="سلة الحجوزات"
                >
                  <ShoppingBag className="w-4 h-4 text-saudi-green-800" />
                  <span className="hidden sm:inline">السلة</span>
                  {cart.length > 0 && (
                    <span className="bg-saudi-green-800 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
                </Link>

                {/* AI Assistant Button (لُـمى) */}
                <button
                  onClick={() => setIsAIOpen(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-saudi-gold-500/20 hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  <Sparkles className="w-4 h-4 text-saudi-green-950 animate-spin-slow" />
                  <span className="hidden sm:inline">{adminConfig.aiAssistantNameAr} (الذكاء الاصطناعي)</span>
                  <span className="sm:hidden">لُـمى</span>
                </button>

                {/* Create Occasion Direct CTA */}
                <Link
                  href="/plan"
                  className="hidden md:flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  <PlusCircle className="w-4 h-4 text-saudi-gold-400" />
                  <span>+ أنشئ مناسبتك</span>
                </Link>
              </>
            )}

            {/* 2. Supplier Actions */}
            {currentRole === 'vendor' && (
              <>
                <Link
                  href="/vendor"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 px-3 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ إضافة خدمة جديدة</span>
                </Link>

                <button
                  onClick={() => setIsAIOpen(true)}
                  className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-saudi-gold-400" />
                  <span>مستشار المورد الذكي</span>
                </button>
              </>
            )}

            {/* 3. Admin Actions */}
            {currentRole === 'admin' && (
              <>
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
                >
                  <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
                  <span>لوحة التحكم الكاملة</span>
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:text-saudi-green-800 rounded-lg"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3 animate-fadeIn">
          {/* User profile section in mobile */}
          {currentUser ? (
            <div className="p-3 bg-saudi-sand-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border"
                />
                <div>
                  <p className="font-bold text-xs text-gray-900">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {currentUser.role === 'admin' ? 'مشرف المنصة' : currentUser.role === 'vendor' ? 'مورد معتمد' : 'صاحب مناسبة'}
                  </p>
                </div>
              </div>
              <button
                onClick={logoutUser}
                className="text-[11px] text-red-600 font-bold p-1 hover:bg-white rounded"
              >
                خروج
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                openOnboarding();
              }}
              className="w-full py-2.5 bg-saudi-gold-500 text-saudi-green-950 font-black rounded-xl text-xs shadow"
            >
              تسجيل حساب جديد أو تسجيل الدخول
            </button>
          )}

          {/* Links depending on role */}
          {currentRole === 'client' && (
            <>
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                الرئيسية
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                سوق الخدمات والتجهيزات
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between py-2 text-sm font-bold text-saudi-green-900"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-saudi-gold-600" />
                  <span>سلة الحجوزات</span>
                </span>
                {cart.length > 0 && (
                  <span className="bg-saudi-green-800 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </Link>
              <Link
                href="/packages"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                الباقات الذكية الجاهزة
              </Link>
              <Link
                href="/calculator"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                حاسبة تكاليف وميزانية المناسبات
              </Link>
              <Link
                href="/bookings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                حجوزاتي وفواتيري الضريبية
              </Link>
              <Link
                href="/rfq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                طلب ومقارنة عروض الأسعار (RFQ)
              </Link>
              <Link
                href="/plan"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center py-2.5 bg-saudi-green-800 text-white rounded-xl font-bold text-sm"
              >
                + إنشاء مناسبة جديدة
              </Link>
            </>
          )}

          {currentRole === 'vendor' && (
            <>
              <Link
                href="/vendor"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-saudi-green-800"
              >
                لوحة تحكم بوابة الموردين
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-700"
              >
                تصفح سوق المناسبات كعميل
              </Link>
            </>
          )}

          {currentRole === 'admin' && (
            <>
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && (!currentTab || currentTab === 'overview')
                    ? 'text-saudi-green-800'
                    : 'text-gray-700'
                }`}
              >
                لوحة الإدارة المركزية
              </Link>
              <Link
                href="/admin/oms"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin/oms' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                إدارة الطلبات (OMS)
              </Link>
              <Link
                href="/admin?tab=vendors"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'vendors' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                الموردين والاعتماد
              </Link>
              <Link
                href="/admin?tab=bookings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'bookings' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                الحجوزات والمالية
              </Link>
              <Link
                href="/admin?tab=services"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'services' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                إعدادات الكتالوج
              </Link>
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-500"
              >
                معاينة الواجهة كعميل
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-saudi-sand-200 h-16" />}>
      <NavbarContent />
    </Suspense>
  );
}
