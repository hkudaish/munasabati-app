'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    adminConfig,
    currentRole,
    setCurrentRole,
    cities,
    selectedCity,
    setSelectedCity,
    occasions,
    activeOccasion,
    setActiveOccasionId,
    setIsAIOpen,
  } = useApp();

  const [isOccasionDropdownOpen, setIsOccasionDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeCityObj = cities.find((c) => c.id === selectedCity) || cities[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-saudi-sand-200 shadow-sm">
      {/* Top Banner for Role Switcher & City & Hotline */}
      <div className="bg-saudi-green-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* City & Location Selector */}
          <div className="relative flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-saudi-gold-400" />
            <span className="text-gray-300">المدينة الحالية:</span>
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

          {/* Persona / Role Switcher for seamless demo */}
          <div className="flex items-center gap-2">
            <span className="text-gray-300 hidden sm:inline">عرض بصفتك:</span>
            <div className="bg-saudi-green-950/80 p-0.5 rounded-lg border border-saudi-gold-500/30 flex items-center gap-1">
              <button
                onClick={() => {
                  setCurrentRole('client');
                  router.push('/');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                  currentRole === 'client'
                    ? 'bg-saudi-gold-500 text-saudi-green-950 shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                صاحب المناسبة
              </button>
              <button
                onClick={() => {
                  setCurrentRole('vendor');
                  router.push('/vendor');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                  currentRole === 'vendor'
                    ? 'bg-saudi-gold-500 text-saudi-green-950 shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Store className="w-3 h-3" />
                <span>بوابة الموردين</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRole('admin');
                  router.push('/admin');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                  currentRole === 'admin'
                    ? 'bg-saudi-gold-500 text-saudi-green-950 shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>لوحة الإدارة</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Right: Logo & Slogan */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
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

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-gray-700">
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
                href="/rfq"
                className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                  pathname.startsWith('/rfq') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4 text-saudi-gold-600" />
                <span>عروض الأسعار (RFQ)</span>
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
            </nav>
          </div>

          {/* Left: Active Occasion Switcher + AI Button + Create Occasion */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Occasion Workspace Selector Button */}
            {occasions.length > 0 && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setIsOccasionDropdownOpen(!isOccasionDropdownOpen)}
                  className="flex items-center gap-2 bg-saudi-sand-100 border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-xl text-right transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-saudi-green-800 text-saudi-gold-300 flex items-center justify-center text-xs font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900 line-clamp-1 max-w-[140px]">
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

            {/* AI Assistant Button (لُـمى) */}
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-saudi-gold-500/20 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              <Sparkles className="w-4 h-4 text-saudi-green-950 animate-spin-slow" />
              <span>{adminConfig.aiAssistantNameAr} (الذكاء الاصطناعي)</span>
            </button>

            {/* Create Occasion Direct CTA */}
            <Link
              href="/plan"
              className="hidden sm:flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4 text-saudi-gold-400" />
              <span>+ أنشئ مناسبتك</span>
            </Link>

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
            href="/packages"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
          >
            الباقات الذكية الجاهزة
          </Link>
          <Link
            href="/rfq"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
          >
            طلب ومقارنة عروض الأسعار (RFQ)
          </Link>
          <Link
            href="/inspiration"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
          >
            إلهام وأفكار المناسبات
          </Link>
          {activeOccasion && (
            <Link
              href={`/occasion/${activeOccasion.id}`}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block p-3 bg-saudi-sand-100 rounded-xl text-sm font-bold text-saudi-green-900 border border-saudi-sand-300"
            >
              مساحة العمل: {activeOccasion.title} ({activeOccasion.readinessPercentage}%)
            </Link>
          )}
          <Link
            href="/plan"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-center py-2.5 bg-saudi-green-800 text-white rounded-xl font-bold text-sm"
          >
            + إنشاء مناسبة جديدة
          </Link>
        </div>
      )}
    </header>
  );
}
