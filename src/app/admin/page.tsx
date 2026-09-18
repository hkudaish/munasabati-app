'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Store,
  Settings,
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  Award,
  AlertTriangle,
  Building,
  Clock,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  Star,
  MapPin,
  FileText,
  Calendar,
  MessageSquare,
  Zap,
  CreditCard,
  Send,
  ExternalLink,
  ChevronRight,
  Package,
  ShoppingBag,
  Bell,
  RefreshCw,
  Phone,
  Power,
} from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { Vendor, ServiceItem, SmartPackage, Review, Booking } from '@/lib/types';

export default function AdminDashboardPage() {
  const {
    adminConfig,
    updateAdminConfig,
    occasionTypes,
    serviceCategories,
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    updateVendorStatus,
    services,
    addService,
    updateService,
    deleteService,
    packages,
    addPackage,
    updatePackage,
    deletePackage,
    bookings,
    releaseEscrowPayout,
    refundBooking,
    occasions,
    reviews,
    toggleReviewFeatured,
    updateReviewStatus,
    deleteReview,
    replyToReview,
    cities,
    toggleCityAvailability,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'vendors' | 'services' | 'packages' | 'bookings' | 'occasions' | 'reviews' | 'cities' | 'settings'
  >('overview');

  // Search and filters
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorCityFilter, setVendorCityFilter] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'approved' | 'featured'>('all');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'confirmed' | 'completed' | 'payout_pending'>('all');

  // Reply state in reviews
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Add Vendor Modal state
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState(serviceCategories[0]?.id || 'hospitality');
  const [newVendorCity, setNewVendorCity] = useState(cities[0]?.id || 'riyadh');
  const [newVendorCR, setNewVendorCR] = useState('');
  const [newVendorStartingPrice, setNewVendorStartingPrice] = useState('1500');

  // Add Service Modal state
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [newServiceTitle, setNewServiceTitle] = useState('');
  const [newServiceVendorId, setNewServiceVendorId] = useState(vendors[0]?.id || '');
  const [newServiceCategory, setNewServiceCategory] = useState(serviceCategories[0]?.id || 'hospitality');
  const [newServiceCity, setNewServiceCity] = useState('riyadh');
  const [newServicePrice, setNewServicePrice] = useState('2000');
  const [newServiceDesc, setNewServiceDesc] = useState('');

  // Platform Settings State
  const [platformName, setPlatformName] = useState(adminConfig.platformNameAr);
  const [tagline, setTagline] = useState(adminConfig.taglineAr);
  const [commission, setCommission] = useState(adminConfig.commissionRatePercent.toString());
  const [aiName, setAiName] = useState(adminConfig.aiAssistantNameAr);
  const [announcement, setAnnouncement] = useState(adminConfig.announcementText || '');
  const [emergencyHotline, setEmergencyHotline] = useState(adminConfig.emergencyPhone || '920012345');
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  // Escrow Payout alert state
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);

  const platformRevenue = Math.round((adminConfig.totalGMV * adminConfig.commissionRatePercent) / 100);

  // Filtered lists
  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.businessName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      (v.crNumber && v.crNumber.includes(vendorSearch));
    const matchesCity = vendorCityFilter === 'all' || v.cityId === vendorCityFilter;
    return matchesSearch && matchesCity;
  });

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.titleAr.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.vendorName.toLowerCase().includes(serviceSearch.toLowerCase());
    const matchesCat = serviceCategoryFilter === 'all' || s.categoryId === serviceCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'featured') return r.featured;
    if (reviewFilter === 'approved') return r.status === 'approved';
    return true;
  });

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'confirmed') return b.status === 'confirmed';
    if (bookingFilter === 'completed') return b.status === 'completed';
    if (bookingFilter === 'payout_pending') return !b.payoutReleased;
    return true;
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdminConfig({
      platformNameAr: platformName,
      taglineAr: tagline,
      commissionRatePercent: Number(commission) || 10,
      aiAssistantNameAr: aiName,
      announcementText: announcement,
      emergencyPhone: emergencyHotline,
    });
    setSavedSettingsSuccess(true);
    setTimeout(() => setSavedSettingsSuccess(false), 2000);
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    const catObj = serviceCategories.find((c) => c.id === newVendorCategory);
    const cityObj = cities.find((c) => c.id === newVendorCity);

    addVendor({
      businessName: newVendorName,
      businessNameEn: 'Saudi Verified Vendor',
      categoryId: newVendorCategory,
      categoryNameAr: catObj?.nameAr || 'خدمات مناسبات',
      logo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80',
      bannerImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
      rating: 5.0,
      reviewsCount: 1,
      completedBookingsCount: 0,
      verified: true,
      crNumber: newVendorCR || '1010' + Math.floor(100000 + Math.random() * 900000),
      cityId: newVendorCity,
      cityNameAr: cityObj?.nameAr || 'الرياض',
      neighborhood: cityObj?.neighborhoods[0] || 'وسط المدينة',
      serviceAreas: [cityObj?.nameAr || 'الرياض'],
      startingPrice: Number(newVendorStartingPrice) || 1500,
      instantBooking: true,
      responseTimeMinutes: 10,
      badges: ['موثق بسجل تجاري 🇸🇦', 'جديد على المنصة'],
      bioAr: 'مزود خدمة معتمد في منصة مناسبتي لتقديم أرقى خدمات الضيافة والتجهيزات.',
      portfolio: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      ],
      contactPhone: '+966500000000',
      whatsappNumber: '966500000000',
      genderSpecialty: 'both',
      cancellationPolicyAr: 'إلغاء مجاني حتى 5 أيام قبل الموعد.',
      status: 'active',
    });

    setIsAddVendorOpen(false);
    setNewVendorName('');
    setNewVendorCR('');
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    const vendorObj = vendors.find((v) => v.id === newServiceVendorId) || vendors[0];
    const catObj = serviceCategories.find((c) => c.id === newServiceCategory);
    const cityObj = cities.find((c) => c.id === newServiceCity);

    addService({
      vendorId: vendorObj.id,
      vendorName: vendorObj.businessName,
      vendorRating: vendorObj.rating,
      vendorLogo: vendorObj.logo,
      categoryId: newServiceCategory,
      categoryNameAr: catObj?.nameAr || 'خدمات',
      cityId: newServiceCity,
      cityNameAr: cityObj?.nameAr || 'الرياض',
      titleAr: newServiceTitle,
      descriptionAr: newServiceDesc || 'خدمة متكاملة مجهزة بأعلى المعايير.',
      price: Number(newServicePrice) || 2000,
      priceType: 'fixed',
      images: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      ],
      featuresAr: ['تنفيذ فوري', 'ضمان الجودة', 'فريق محترف'],
      instantBooking: true,
      genderPreference: 'unisex',
    });

    setIsAddServiceOpen(false);
    setNewServiceTitle('');
    setNewServiceDesc('');
  };

  const handleReleasePayout = (b: Booking) => {
    releaseEscrowPayout(b.id);
    setPayoutSuccessMsg(`تم تحويل مستحقات المورد (${b.vendorName}) بمبلغ ${formatSAR(b.totalAmount)} عبر سريع SARIE بنجاح!`);
    setTimeout(() => setPayoutSuccessMsg(null), 3500);
  };

  const handleSendReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    replyToReview(reviewId, replyText);
    setReplyingReviewId(null);
    setReplyText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 rounded-3xl p-6 sm:p-8 text-white border border-saudi-gold-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-500/30 text-saudi-gold-300 px-3.5 py-1 rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>لوحة القيادة والتحكم العام للمنصة (Super Admin Console)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-white">
            إدارة منظومة مناسبتـي 🇸🇦
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 font-tajawal max-w-xl">
            إدارة متكاملة لجميع أقسام المنصة: الموردين، الخدمات، الباقات، الحجوزات ومستحقات الضمان (Escrow)، التقييمات، والمدن.
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddVendorOpen(true)}
            className="px-4 py-2.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة مورد معتمد</span>
          </button>

          <button
            onClick={() => setIsAddServiceOpen(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 backdrop-blur-md transition"
          >
            <ShoppingBag className="w-4 h-4 text-saudi-gold-300" />
            <span>+ إضافة خدمة جديدة</span>
          </button>
        </div>
      </div>

      {/* Payout Success Alert */}
      {payoutSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{payoutSuccessMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>حجم التداولات الإجمالي (GMV)</span>
            <TrendingUp className="w-4 h-4 text-saudi-green-800" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-green-950 block">
            {formatSAR(adminConfig.totalGMV)}
          </span>
          <span className="text-[11px] text-green-700 font-semibold block">+24% نمو ربع سنوي</span>
        </div>

        {/* Platform Net Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>صافي عمولات المنصة ({adminConfig.commissionRatePercent}%)</span>
            <DollarSign className="w-4 h-4 text-saudi-gold-600" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-gold-700 block">
            {formatSAR(platformRevenue)}
          </span>
          <span className="text-[11px] text-gray-400 block">ضريبة 15% ZATCA محتسبة</span>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>إجمالي الحجوزات المنفذة</span>
            <CheckCircle2 className="w-4 h-4 text-saudi-green-800" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-green-950 block">
            {adminConfig.totalBookings.toLocaleString('ar-SA')} حجز
          </span>
          <span className="text-[11px] text-gray-400 block">{bookings.length} حجوزات نشطة حالياً</span>
        </div>

        {/* Customer Satisfaction & Vendors */}
        <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
            <span>الموردين والتقييم العام</span>
            <Star className="w-4 h-4 text-saudi-gold-500 fill-saudi-gold-500" />
          </div>
          <span className="text-2xl font-black font-cairo text-saudi-gold-700 block">
            ★ 4.96 / 5.0
          </span>
          <span className="text-[11px] text-saudi-green-800 font-bold block">
            {vendors.length} مورد مسجل بالمملكة
          </span>
        </div>
      </div>

      {/* Tabs Bar for All Sections */}
      <div className="border-b border-saudi-sand-300 flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-saudi-gold-600" />
          <span>المؤشرات والتحليلات</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'vendors'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Store className="w-4 h-4 text-saudi-gold-600" />
          <span>إدارة الموردين ({vendors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'services'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-saudi-gold-600" />
          <span>كتالوج الخدمات ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'packages'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4 text-saudi-gold-600" />
          <span>الباقات الذكية ({packages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'bookings'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <CreditCard className="w-4 h-4 text-saudi-gold-600" />
          <span>الحجوزات والضمان المالي ({bookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('occasions')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'occasions'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-saudi-gold-600" />
          <span>أسطول المناسبات الحية ({occasions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'reviews'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Star className="w-4 h-4 text-saudi-gold-600" />
          <span>آراء العملاء والاعتدال ({reviews.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cities')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'cities'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-saudi-gold-600" />
          <span>تغطية المدن ({cities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-saudi-green-800 text-saudi-green-950 font-black'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4 text-saudi-gold-600" />
          <span>إعدادات النظام والـ AI</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {/* 1. Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* City GMV Distribution */}
              <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-saudi-gold-600" />
                  <span>توزيع المبيعات والتداولات على مدن المملكة 🇸🇦</span>
                </h4>
                <div className="space-y-3">
                  {[
                    { city: 'الرياض', share: '46%', gmv: 2953200 },
                    { city: 'جدة ومكة المكرمة', share: '28%', gmv: 1797600 },
                    { city: 'الخبر والدمام والأحساء', share: '16%', gmv: 1027200 },
                    { city: 'أبها والجنوب (عسير)', share: '6%', gmv: 385200 },
                    { city: 'العلا والمدينة وتبوك', share: '4%', gmv: 256800 },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>{item.city}</span>
                        <span className="text-saudi-green-900 font-mono">
                          {formatSAR(item.gmv)} ({item.share})
                        </span>
                      </div>
                      <div className="w-full bg-saudi-sand-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-saudi-green-800 h-full" style={{ width: item.share }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occasion Types Demand */}
              <div className="bg-white rounded-3xl p-6 border border-saudi-sand-300 shadow-sm space-y-4">
                <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-saudi-gold-600" />
                  <span>أكثر أنواع المناسبات طلباً بالمنصة</span>
                </h4>
                <div className="space-y-3">
                  {[
                    { type: 'أعراس وحفلات زفاف كبرى', count: 1420, percentage: '34%' },
                    { type: 'عقد قران وملكة', count: 1180, percentage: '28%' },
                    { type: 'حفلات تخرج وتفوق', count: 860, percentage: '21%' },
                    { type: 'استقبال مولود جديد', count: 430, percentage: '10%' },
                    { type: 'اليوم الوطني والتأسيس والفعاليات', count: 290, percentage: '7%' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>{item.type}</span>
                        <span className="text-saudi-gold-700 font-bold">
                          {item.count} مناسبة ({item.percentage})
                        </span>
                      </div>
                      <div className="w-full bg-saudi-sand-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-saudi-gold-500 h-full" style={{ width: item.percentage }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Platform Escrow & Safety Indicator */}
            <div className="bg-saudi-sand-50 rounded-3xl p-6 border border-saudi-sand-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-saudi-green-800 text-saudi-gold-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-saudi-green-950 font-cairo">
                    نظام الضمان المالي ومكافحة الاحتيال نشط (Escrow Guarantee)
                  </h4>
                  <p className="text-xs text-gray-600 font-tajawal">
                    أموال العربون محتجزة بأمان حتى إتمام المناسبة وتأكيد العميل، متوافقة مع ضوابط البنك المركزي السعودي (SAMA).
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('bookings')}
                className="px-5 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs whitespace-nowrap transition"
              >
                مراجعة مستحقات الموردين ({bookings.length})
              </button>
            </div>
          </div>
        )}

        {/* 2. Vendors Management Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-sm space-y-4 p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 font-cairo">
                  إدارة وتوثيق الموردين المعتمدين ({filteredVendors.length})
                </h4>
                <p className="text-xs text-gray-500">
                  مراجعة واعتماد السجلات التجارية وأرقام العمل الحر، والتحكم في إتاحة الحسابات.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="ابحث باسم المنشأة أو السجل..."
                    className="w-full pr-9 pl-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>

                <select
                  value={vendorCityFilter}
                  onChange={(e) => setVendorCityFilter(e.target.value)}
                  className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs font-bold"
                >
                  <option value="all">كل المدن</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-saudi-sand-100 text-gray-600 font-bold border-b border-saudi-sand-300">
                  <tr>
                    <th className="p-3.5">اسم المنشأة</th>
                    <th className="p-3.5">المدينة والتصنيف</th>
                    <th className="p-3.5">السجل التجاري / العمل الحر</th>
                    <th className="p-3.5">التقييم</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-saudi-sand-50/60 transition">
                      <td className="p-3.5 font-bold text-gray-900 flex items-center gap-2">
                        <img src={v.logo} alt={v.businessName} className="w-8 h-8 rounded-xl object-cover" />
                        <div>
                          <span>{v.businessName}</span>
                          <span className="block text-[10px] text-gray-400 font-normal">{v.contactPhone}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-600">
                        {v.cityNameAr} • {v.categoryNameAr}
                      </td>
                      <td className="p-3.5 font-mono text-gray-700 font-semibold">
                        {v.crNumber || v.freelanceLicense || 'قيد الرفع'}
                      </td>
                      <td className="p-3.5 font-bold text-saudi-gold-700">★ {v.rating} ({v.reviewsCount})</td>
                      <td className="p-3.5">
                        {v.verified ? (
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            موثق رسمي 🇸🇦
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            قيد المراجعة
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => updateVendorStatus(v.id, v.status === 'active' ? 'suspended' : 'active', v.verified)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              v.status === 'active'
                                ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'bg-green-50 text-green-800 hover:bg-green-100'
                            }`}
                          >
                            {v.status === 'active' ? 'تعليق' : 'تفعيل'}
                          </button>

                          <button
                            onClick={() => updateVendorStatus(v.id, v.status, !v.verified)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              v.verified
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-saudi-green-800 text-white hover:bg-saudi-green-900'
                            }`}
                          >
                            {v.verified ? 'إلغاء التوثيق' : 'توثيق 🇸🇦'}
                          </button>

                          <Link
                            href={`/vendor/${v.id}`}
                            className="p-1 text-gray-400 hover:text-saudi-green-800 transition"
                            title="معاينة الملف العام"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => deleteVendor(v.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition"
                            title="حذف المورد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Services Catalog Tab */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 font-cairo">
                  كتالوج وسوق خدمات المناسبات ({filteredServices.length})
                </h4>
                <p className="text-xs text-gray-500">
                  تعديل الأسعار والمواصفات وحذف أو إضافة خدمات جديدة للسوق.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="ابحث بالخدمة أو المورد..."
                    className="w-full pr-9 pl-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>

                <select
                  value={serviceCategoryFilter}
                  onChange={(e) => setServiceCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs font-bold"
                >
                  <option value="all">كل التصنيفات</option>
                  {serviceCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setIsAddServiceOpen(true)}
                  className="px-4 py-2 bg-saudi-green-800 text-white rounded-xl text-xs font-bold hover:bg-saudi-green-900 whitespace-nowrap transition"
                >
                  + إضافة خدمة
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-saudi-sand-50/70 rounded-2xl p-4 border border-saudi-sand-200 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-bold text-xs text-saudi-green-950 font-cairo leading-snug">
                        {srv.titleAr}
                      </h5>
                      <span className="text-[10px] bg-saudi-green-100 text-saudi-green-800 font-bold px-2 py-0.5 rounded-md shrink-0">
                        {srv.categoryNameAr}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{srv.descriptionAr}</p>
                    <div className="text-[11px] text-gray-600 flex items-center gap-2">
                      <span>المزود: <strong>{srv.vendorName}</strong></span>
                      <span>•</span>
                      <span>{srv.cityNameAr}</span>
                    </div>
                  </div>

                  <div className="border-t border-saudi-sand-200 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block">السعر:</span>
                      <strong className="text-sm font-black font-cairo text-saudi-green-950">
                        {formatSAR(srv.price)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newPrice = prompt('أدخل السعر الجديد بالريال السعودي:', srv.price.toString());
                          if (newPrice && !isNaN(Number(newPrice))) {
                            updateService(srv.id, { price: Number(newPrice) });
                          }
                        }}
                        className="px-2.5 py-1 bg-white border border-gray-300 hover:border-saudi-gold-400 rounded-lg text-[11px] font-bold text-gray-700 transition"
                      >
                        تعديل السعر
                      </button>
                      <button
                        onClick={() => deleteService(srv.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition"
                        title="حذف الخدمة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Smart Packages Tab */}
        {activeTab === 'packages' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 font-cairo">
                  إدارة الباقات الذكية المتكاملة ({packages.length})
                </h4>
                <p className="text-xs text-gray-500">
                  باقات جاهزة مجمعة توفر على العملاء وقت التنسيق بنسبة خصم محددة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 shadow-sm p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-saudi-gold-100 text-saudi-gold-900 font-bold px-2.5 py-0.5 rounded-full">
                        {pkg.occasionTypeNameAr}
                      </span>
                      <span className="text-[11px] text-green-700 font-bold">
                        وفر {formatSAR(pkg.savings || (pkg.originalPrice - pkg.packagePrice))}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-saudi-green-950 font-cairo">
                      {pkg.titleAr}
                    </h5>
                    <p className="text-xs text-gray-500 line-clamp-2">{pkg.descriptionAr}</p>

                    <div className="space-y-1 bg-saudi-sand-50 p-3 rounded-xl text-xs">
                      <span className="text-[10px] font-bold text-gray-400 block">الخدمات المشمولة:</span>
                      {pkg.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-gray-700 text-[11px]">
                          <span>• {item.serviceName}</span>
                          <span className="font-mono text-gray-400">{formatSAR(item.pricePortion)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 line-through block">
                        {formatSAR(pkg.originalPrice)}
                      </span>
                      <strong className="text-base font-black font-cairo text-saudi-green-950">
                        {formatSAR(pkg.packagePrice)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newPrice = prompt('أدخل سعر الباقة الجديد بالريال:', pkg.packagePrice.toString());
                          if (newPrice && !isNaN(Number(newPrice))) {
                            updatePackage(pkg.id, { packagePrice: Number(newPrice) });
                          }
                        }}
                        className="px-3 py-1.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 rounded-xl text-xs font-bold text-saudi-green-900 transition"
                      >
                        تعديل السعر
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Bookings & Escrow Financials Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 font-cairo">
                  سجل العقود والحجوزات والضمان المالي (Escrow) ({filteredBookings.length})
                </h4>
                <p className="text-xs text-gray-500">
                  تتبع العربون والمتبقي، وإطلاق مستحقات الموردين للتحويل عبر الحسابات البنكية (سريع SARIE).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value as any)}
                  className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs font-bold"
                >
                  <option value="all">كافة الحجوزات</option>
                  <option value="confirmed">مؤكدة بالعربون</option>
                  <option value="completed">مكتملة بالكامل</option>
                  <option value="payout_pending">بانتظار صرف المستحقات</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-5 bg-white border border-saudi-sand-300 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-saudi-gold-400 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-saudi-gold-600">
                        {b.bookingNumber}
                      </span>
                      <span className="bg-saudi-green-100 text-saudi-green-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {b.status === 'confirmed' ? 'مؤكد بالعربون' : b.status === 'completed' ? 'مكتمل' : b.status}
                      </span>
                      {b.payoutReleased ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                          صُرف للمورد ({b.payoutRef})
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          محتجز في الضمان 🛡️
                        </span>
                      )}
                    </div>

                    <h5 className="text-sm font-bold text-gray-900">{b.serviceTitleAr}</h5>
                    <p className="text-xs text-gray-500">
                      العميل: <strong className="text-gray-800">{b.customerName}</strong> ({b.customerPhone}) • المورد: <strong className="text-saudi-green-900">{b.vendorName}</strong> • التاريخ: {b.date}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs self-end md:self-auto">
                    <div className="text-left">
                      <span className="text-[10px] text-gray-400 block">إجمالي العقد</span>
                      <strong className="text-sm font-black font-cairo text-saudi-green-950">
                        {formatSAR(b.totalAmount)}
                      </strong>
                    </div>

                    {!b.payoutReleased ? (
                      <button
                        onClick={() => handleReleasePayout(b)}
                        className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-saudi-gold-300" />
                        <span>تحرير المستحقات ⚡</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        تم الصرف بنجاح
                      </span>
                    )}

                    <button
                      onClick={() => refundBooking(b.id)}
                      className="text-gray-400 hover:text-red-600 p-1 text-xs font-bold"
                      title="إلغاء واسترجاع"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Occasions Fleet Monitor */}
        {activeTab === 'occasions' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div>
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                مراقبة أسطول المناسبات الحية في المملكة ({occasions.length})
              </h4>
              <p className="text-xs text-gray-500">
                متابعة حالة جاهزية المناسبات، توزيع الضيوف، والميزانيات المعتمدة لأصحاب المناسبات.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {occasions.map((occ) => (
                <div
                  key={occ.id}
                  className="bg-saudi-sand-50/60 rounded-2xl p-5 border border-saudi-sand-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-400 font-bold">#{occ.id}</span>
                    <span className="text-xs font-bold bg-saudi-green-100 text-saudi-green-800 px-2.5 py-0.5 rounded-full">
                      جاهزية: {occ.readinessPercentage}%
                    </span>
                  </div>

                  <h5 className="font-bold text-sm text-saudi-green-950 font-cairo">
                    {occ.title}
                  </h5>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>📍 {occ.cityNameAr} ({occ.neighborhood}) • 📅 {occ.date}</p>
                    <p>👥 عدد الضيوف: <strong>{occ.guestCount} ضيف</strong></p>
                    <p>💰 الميزانية المقدرة: <strong className="text-saudi-green-900">{formatSAR(occ.budget)}</strong></p>
                  </div>

                  <Link
                    href={`/occasion/${occ.id}`}
                    className="w-full py-2 bg-white border border-saudi-sand-300 hover:border-saudi-gold-400 rounded-xl text-xs font-bold text-saudi-green-900 flex items-center justify-center gap-1 transition"
                  >
                    <span>فحص مساحة العمل</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Reviews Moderation Tab */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 font-cairo">
                  إدارة واعتدال تقييمات وتجارب العملاء ({filteredReviews.length})
                </h4>
                <p className="text-xs text-gray-500">
                  تحديد التقييمات المميزة لعرضها في واجهة المنصة (Social Proof) والرد على آراء العملاء.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value as any)}
                  className="px-3 py-2 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs font-bold"
                >
                  <option value="all">كافة التقييمات</option>
                  <option value="featured">المميزة بالصفحة الرئيسية ⭐</option>
                  <option value="approved">المعتمدة فقط</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 bg-white rounded-2xl border border-saudi-sand-300 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          rev.avatarUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            rev.customerName
                          )}&background=004D3F&color=FAF6EB&bold=true`
                        }
                        alt={rev.customerName}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-gray-900">{rev.customerName}</h5>
                          <span className="text-[10px] text-gray-400">({rev.customerCityAr} - {rev.occasionTypeAr})</span>
                          {rev.featured && (
                            <span className="bg-saudi-gold-100 text-saudi-gold-900 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Star className="w-3 h-3 fill-saudi-gold-500" />
                              مميز في الواجهة
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-saudi-green-800 font-semibold">
                          تقييم المورد: <strong>{rev.vendorName}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-saudi-gold-700 bg-saudi-gold-50 px-2 py-1 rounded-lg">
                        ★ {rev.rating}
                      </span>
                      <button
                        onClick={() => toggleReviewFeatured(rev.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                          rev.featured
                            ? 'bg-saudi-gold-500 text-saudi-green-950'
                            : 'bg-saudi-sand-100 text-gray-700 hover:bg-saudi-sand-200'
                        }`}
                      >
                        {rev.featured ? 'إلغاء التمييز' : 'تمييز بالواجهة ⭐'}
                      </button>
                      <button
                        onClick={() => deleteReview(rev.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition"
                        title="حذف التقييم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 bg-saudi-sand-50 p-3 rounded-xl">
                    "{rev.commentAr}"
                  </p>

                  {/* Vendor/Admin Reply */}
                  {rev.vendorReplyAr ? (
                    <div className="text-xs bg-saudi-green-50 p-3 rounded-xl border border-saudi-green-200 text-saudi-green-950">
                      <strong>رد المورد/الإدارة:</strong> "{rev.vendorReplyAr}"
                    </div>
                  ) : replyingReviewId === rev.id ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="اكتب رد الإدارة أو المورد..."
                        className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white"
                      />
                      <button
                        onClick={() => handleSendReply(rev.id)}
                        className="px-4 py-2 bg-saudi-green-800 text-white font-bold rounded-xl text-xs"
                      >
                        إرسال الرد
                      </button>
                      <button
                        onClick={() => setReplyingReviewId(null)}
                        className="px-3 py-2 text-xs text-gray-500"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplyingReviewId(rev.id)}
                      className="text-[11px] font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>إضافة رد رسمي على التقييم</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. Cities Configuration Tab */}
        {activeTab === 'cities' && (
          <div className="bg-white rounded-3xl border border-saudi-sand-300 p-6 shadow-sm space-y-6">
            <div>
              <h4 className="text-base font-bold text-gray-900 font-cairo">
                تغطية مدن ومناطق المملكة العربية السعودية ({cities.length})
              </h4>
              <p className="text-xs text-gray-500">
                التحكم في إتاحة الحجز الفوري وإطلاق الخدمة في مدن ومحافظات المملكة.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className="p-4 bg-saudi-sand-50/60 rounded-2xl border border-saudi-sand-200 flex items-center justify-between gap-3"
                >
                  <div>
                    <h5 className="font-bold text-xs text-gray-900">{city.nameAr}</h5>
                    <span className="text-[10px] text-gray-400 block">{city.regionAr}</span>
                    <span className="text-[10px] text-saudi-green-800 font-semibold block mt-1">
                      {city.neighborhoods.length} أحياء مغطاة
                    </span>
                  </div>

                  <button
                    onClick={() => toggleCityAvailability(city.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      city.isAvailable
                        ? 'bg-saudi-green-800 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {city.isAvailable ? 'متاحة ونشطة 🇸🇦' : 'غير متاحة'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. System & AI Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-saudi-sand-300 shadow-sm space-y-6 max-w-3xl">
            <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
              <Settings className="w-5 h-5 text-saudi-green-800" />
              <span>إعدادات النظام والضريبة والذكاء الاصطناعي</span>
            </h4>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  اسم التطبيق والمنصة (Product Name)
                </label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الشعار اللفظي للمنصة (Tagline)
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  شريط الإعلانات الترويجي العام (Top Announcement Banner)
                </label>
                <input
                  type="text"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    عمولة المنصة (%)
                  </label>
                  <input
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    اسم المساعد الذكي
                  </label>
                  <input
                    type="text"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    رقم هاتف الطوارئ الموحد
                  </label>
                  <input
                    type="text"
                    value={emergencyHotline}
                    onChange={(e) => setEmergencyHotline(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                {savedSettingsSuccess ? (
                  <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    تم حفظ وتحديث إعدادات المنصة بنجاح!
                  </span>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal: Add Vendor */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-saudi-sand-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-base font-bold text-saudi-green-950 font-cairo">
                إضافة واعتماد مورد سعودي جديد 🇸🇦
              </h4>
              <button onClick={() => setIsAddVendorOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">اسم المنشأة أو مزود الخدمة</label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="مثال: قصر الدرعية للمناسبات الفاخرة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">التصنيف الرئيسي</label>
                  <select
                    value={newVendorCategory}
                    onChange={(e) => setNewVendorCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  >
                    {serviceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">المدينة</label>
                  <select
                    value={newVendorCity}
                    onChange={(e) => setNewVendorCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">رقم السجل التجاري / العمل الحر</label>
                  <input
                    type="text"
                    value={newVendorCR}
                    onChange={(e) => setNewVendorCR(e.target.value)}
                    placeholder="1010928374"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">السعر المبدئي (ر.س)</label>
                  <input
                    type="number"
                    value={newVendorStartingPrice}
                    onChange={(e) => setNewVendorStartingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-4 py-2 text-gray-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-saudi-green-800 text-white font-bold rounded-xl"
                >
                  اعتماد وحفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Service */}
      {isAddServiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-saudi-sand-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-base font-bold text-saudi-green-950 font-cairo">
                إضافة خدمة جديدة لسوق المناسبات 🛍️
              </h4>
              <button onClick={() => setIsAddServiceOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">عنوان الخدمة</label>
                <input
                  type="text"
                  value={newServiceTitle}
                  onChange={(e) => setNewServiceTitle(e.target.value)}
                  placeholder="مثال: باقة بوفيه العشاء الملكي مع صبابين القهوة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">المورد المسؤول</label>
                <select
                  value={newServiceVendorId}
                  onChange={(e) => setNewServiceVendorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.businessName} ({v.cityNameAr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">التصنيف</label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  >
                    {serviceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">السعر (ر.س)</label>
                  <input
                    type="number"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">الوصف والتفاصيل</label>
                <textarea
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="تفاصيل التجهيزات والمميزات..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddServiceOpen(false)}
                  className="px-4 py-2 text-gray-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-saudi-green-800 text-white font-bold rounded-xl"
                >
                  إضافة ونشر الخدمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
