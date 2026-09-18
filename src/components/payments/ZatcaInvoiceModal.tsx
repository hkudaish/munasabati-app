'use client';

import React, { useRef } from 'react';
import { Booking } from '@/lib/types';
import { formatSaudiRiyal, formatDateArabic } from '@/lib/utils';
import { 
  X, 
  Printer, 
  Download, 
  QrCode, 
  CheckCircle2, 
  Building2, 
  FileText, 
  Calendar, 
  ShieldCheck 
} from 'lucide-react';

interface ZatcaInvoiceModalProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
}

export const ZatcaInvoiceModal: React.FC<ZatcaInvoiceModalProps> = ({
  booking,
  isOpen,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Invoice calculations
  const totalAmount = booking.totalAmount;
  const baseAmount = Math.round((totalAmount / 1.15) * 100) / 100;
  const vatAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  const depositPaid = booking.depositPaid ? booking.depositAmount : 0;
  const remainingDue = booking.isFullyPaid ? 0 : booking.remainingAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header Actions (Not printed) */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white text-base">
                فاتورة ضريبية مبسطة (ZATCA)
              </h3>
              <p className="text-xs text-neutral-500">متوافقة مع متطلبات الفوترة الإلكترونية بالمملكة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة / حفظ PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div ref={printRef} className="p-8 space-y-6 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b-2 border-neutral-200 dark:border-neutral-800 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  مناسبتـي
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                  Munasabati
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                شركة مناسبتي لتقنية المعلومات والاحتفالات
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                السجل التجاري: <span className="font-mono font-medium">1010789456</span> | الرقم الضريبي:{' '}
                <span className="font-mono font-medium">310245678900003</span>
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                الرياض، المملكة العربية السعودية
              </p>
            </div>

            {/* ZATCA QR Code Box */}
            <div className="text-center p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
              <div className="w-24 h-24 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-xl flex items-center justify-center p-2 mx-auto mb-1">
                {/* Simulated ZATCA Base64 TLV QR */}
                <div className="grid grid-cols-4 gap-1 w-full h-full p-1 border border-dashed border-neutral-400 rounded">
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div></div>
                  <div className="bg-current rounded-sm"></div>
                  <div></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div></div>
                  <div className="bg-current rounded-sm"></div>
                  <div></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div></div>
                  <div className="bg-current rounded-sm"></div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 block">
                ZATCA E-Invoice
              </span>
            </div>
          </div>

          {/* Invoice Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-xs">
            <div>
              <span className="text-neutral-400 block mb-1">رقم الفاتورة:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-white">
                INV-{booking.bookingNumber}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">تاريخ الإصدار:</span>
              <span className="font-medium text-neutral-900 dark:text-white">
                {booking.createdAt ? booking.createdAt.split('T')[0] : '2026-09-17'}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">طريقة الدفع:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {booking.paymentMethod === 'apple_pay'
                  ? 'Apple Pay'
                  : booking.paymentMethod === 'stc_pay'
                  ? 'STC Pay'
                  : booking.paymentMethod === 'tabby'
                  ? 'تابي (Tabby)'
                  : booking.paymentMethod === 'tamara'
                  ? 'تمارا (Tamara)'
                  : 'مدى (Mada)'}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">حالة السداد:</span>
              <span
                className={`font-bold inline-flex items-center gap-1 ${
                  booking.isFullyPaid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {booking.isFullyPaid ? 'مسددة بالكامل' : 'عربون مسدد (30%)'}
              </span>
            </div>
          </div>

          {/* Customer & Vendor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                بيانات العميل (المستفيد)
              </h4>
              <p className="font-bold text-sm text-neutral-900 dark:text-white">
                {booking.customerName}
              </p>
              <p className="text-xs text-neutral-500 font-mono mt-1">
                {booking.customerPhone}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                المناسبة: {booking.occasionTitle} ({booking.cityAr})
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                بيانات مزود الخدمة (المورد)
              </h4>
              <p className="font-bold text-sm text-neutral-900 dark:text-white">
                {booking.vendorName}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                تاريخ تنفيذ الخدمة: {formatDateArabic(booking.date)}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                المدينة: {booking.cityAr}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="text-xs font-bold text-neutral-400 mb-2">تفاصيل البنود والخدمات:</h4>
            <div className="overflow-hidden border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-300 font-bold">
                  <tr>
                    <th className="p-3">الوصف</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3">المبلغ الخاضع للضريبة</th>
                    <th className="p-3">نسبة الضريبة</th>
                    <th className="p-3">الإجمالي شامل الضريبة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  <tr>
                    <td className="p-3">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {booking.serviceTitleAr}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        حجز خدمة معتمدة عبر منصة مناسبتـي
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">1</td>
                    <td className="p-3 font-mono font-medium">{formatSaudiRiyal(baseAmount)}</td>
                    <td className="p-3 font-mono">15%</td>
                    <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatSaudiRiyal(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Calculations Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>المبلغ غير شامل الضريبة:</span>
                <span className="font-mono font-medium">{formatSaudiRiyal(baseAmount)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-mono font-medium">{formatSaudiRiyal(vatAmount)}</span>
              </div>
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-2 flex justify-between font-bold text-sm text-neutral-900 dark:text-white">
                <span>الإجمالي شامل الضريبة:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatSaudiRiyal(totalAmount)}
                </span>
              </div>
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-2 space-y-1">
                <div className="flex justify-between text-neutral-500">
                  <span>المدفوع (عربون/سداد):</span>
                  <span className="font-mono text-emerald-600">
                    {booking.isFullyPaid ? formatSaudiRiyal(totalAmount) : formatSaudiRiyal(depositPaid)}
                  </span>
                </div>
                {!booking.isFullyPaid && (
                  <div className="flex justify-between text-amber-600 font-bold">
                    <span>المتبقي عند التنفيذ:</span>
                    <span className="font-mono">{formatSaudiRiyal(remainingDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-center space-y-1 text-[11px] text-neutral-400">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              فاتورة إلكترونية معتمدة تصدر آلياً من منصة مناسبتـي
            </div>
            <p>
              تخضع هذه الفاتورة للائحة الفوترة الإلكترونية الصادرة عن هيئة الزكاة والضريبة والجمارك (ZATCA).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
