'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { Booking } from '@/lib/types';
import { formatSaudiRiyal, formatDateArabic } from '@/lib/utils';
import { 
  Calendar, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Star, 
  ChevronLeft, 
  Sparkles, 
  ArrowRight, 
  Filter, 
  Receipt, 
  ShieldCheck, 
  Printer,
  X
} from 'lucide-react';
import { ZatcaInvoiceModal } from '@/components/payments/ZatcaInvoiceModal';
import { VendorReviewModal } from '@/components/marketplace/VendorReviewModal';
import SaudiPaymentModal from '@/components/payments/SaudiPaymentModal';

export default function BookingsPage() {
  const { bookings, payRemainingBooking } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<Booking | null>(null);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);
  const [selectedBookingForRemainingPayment, setSelectedBookingForRemainingPayment] = useState<Booking | null>(null);

  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === 'active') return booking.status !== 'completed' && booking.status !== 'cancelled';
    if (activeTab === 'completed') return booking.status === 'completed';
    return true;
  });

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            مؤكد
          </span>
        );
      case 'in_preparation':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5" />
            قيد التجهيز
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            منفذ ومكتمل
          </span>
        );
      case 'deposit_required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5" />
            بانتظار سداد العربون
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800 mb-2">
              <Receipt className="w-3.5 h-3.5" />
              <span>إدارة الحجوزات والفواتير المعتمدة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              حجوزاتي وفواتيري
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              متابعة حالة حجوزات الموردين، استكمال الدفعات، وطباعة الفواتير الضريبية الإلكترونية ZATCA.
            </p>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            حجز خدمة جديدة
          </Link>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 text-sm font-bold pb-2">
          {[
            { id: 'all', label: `جميع الحجوزات (${bookings.length})` },
            { id: 'active', label: 'الحجوزات النشطة والقادمة' },
            { id: 'completed', label: 'الحجوزات المكتملة والسابقة' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-4 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 space-y-3">
              <Receipt className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
              <h3 className="text-base font-bold text-neutral-700 dark:text-neutral-300">
                لا توجد حجوزات في هذا القسم
              </h3>
              <p className="text-xs text-neutral-400">
                تصفح سوق الموردين واحجز الخدمات المناسبة لفعاليتك القادمة.
              </p>
              <Link
                href="/marketplace"
                className="inline-block mt-2 text-xs font-bold text-emerald-600 hover:underline"
              >
                تصفح سوق الخدمات الآن ←
              </Link>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-emerald-500/40 transition-all space-y-4"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={booking.vendorLogo || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=100&auto=format&fit=crop&q=80'}
                      alt={booking.vendorName}
                      className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                          {booking.serviceTitleAr}
                        </h3>
                        {getStatusBadge(booking.status)}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        المورد: <strong>{booking.vendorName}</strong> | رقم الحجز:{' '}
                        <span className="font-mono">{booking.bookingNumber}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[11px] text-neutral-400 block">الإجمالي شامل الضريبة</span>
                    <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {formatSaudiRiyal(booking.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs py-1">
                  <div>
                    <span className="text-neutral-400 block mb-1">تاريخ المناسبة:</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {formatDateArabic(booking.date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">المناسبة والمدينة:</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {booking.occasionTitle} ({booking.cityAr})
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">المدفوع حالياً:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {booking.isFullyPaid
                        ? formatSaudiRiyal(booking.totalAmount)
                        : formatSaudiRiyal(booking.depositAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block mb-1">المتبقي:</span>
                    <span
                      className={`font-mono font-bold ${
                        booking.isFullyPaid ? 'text-neutral-400' : 'text-amber-600'
                      }`}
                    >
                      {booking.isFullyPaid ? '0 ر.س (مسدد)' : formatSaudiRiyal(booking.remainingAmount)}
                    </span>
                  </div>
                </div>

                {/* Deliverables / Scope */}
                {booking.deliverablesAr && booking.deliverablesAr.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-xs">
                    <span className="text-neutral-400 block mb-1 font-semibold">مشتملات الخدمة:</span>
                    <div className="flex flex-wrap gap-2">
                      {booking.deliverablesAr.map((d, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700"
                        >
                          ✓ {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedBookingForInvoice(booking)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      عرض الفاتورة الضريبية ZATCA
                    </button>

                    {booking.status === 'completed' && (
                      <button
                        onClick={() => setSelectedBookingForReview(booking)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold transition-colors border border-amber-200/60 dark:border-amber-900/40"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        تقييم الخدمة
                      </button>
                    )}
                  </div>

                  {!booking.isFullyPaid && (
                    <button
                      onClick={() => setSelectedBookingForRemainingPayment(booking)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      سداد المبلغ المتبقي ({formatSaudiRiyal(booking.remainingAmount)})
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ZATCA Invoice Modal */}
      {selectedBookingForInvoice && (
        <ZatcaInvoiceModal
          booking={selectedBookingForInvoice}
          isOpen={!!selectedBookingForInvoice}
          onClose={() => setSelectedBookingForInvoice(null)}
        />
      )}

      {/* Vendor Review Modal */}
      {selectedBookingForReview && (
        <VendorReviewModal
          booking={selectedBookingForReview}
          isOpen={!!selectedBookingForReview}
          onClose={() => setSelectedBookingForReview(null)}
        />
      )}

      {/* Remaining Payment Modal */}
      {selectedBookingForRemainingPayment && (
        <SaudiPaymentModal
          bookingTitle={`سداد متبقي: ${selectedBookingForRemainingPayment.serviceTitleAr}`}
          vendorName={selectedBookingForRemainingPayment.vendorName}
          date={selectedBookingForRemainingPayment.date}
          totalAmount={selectedBookingForRemainingPayment.remainingAmount}
          depositAmount={selectedBookingForRemainingPayment.remainingAmount}
          onClose={() => setSelectedBookingForRemainingPayment(null)}
          onPaymentSuccess={(method) => {
            payRemainingBooking(selectedBookingForRemainingPayment.id, method);
            setSelectedBookingForRemainingPayment(null);
          }}
        />
      )}
    </div>
  );
}
