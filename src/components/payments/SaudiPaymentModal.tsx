'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  CreditCard,
  Printer,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { PaymentMethod, Booking } from '@/lib/types';
import { formatSAR, calculateVAT } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface SaudiPaymentModalProps {
  bookingTitle: string;
  vendorName: string;
  date: string;
  totalAmount: number;
  depositAmount?: number;
  onClose: () => void;
  onPaymentSuccess: (method: PaymentMethod, isDeposit: boolean, transactionRef: string) => void;
}

export default function SaudiPaymentModal({
  bookingTitle,
  vendorName,
  date,
  totalAmount,
  depositAmount = Math.round(totalAmount * 0.3),
  onClose,
  onPaymentSuccess,
}: SaudiPaymentModalProps) {
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('mada');

  const [cardNumber, setCardNumber] = useState('5888 4000 1234 5678');
  const [cardHolder, setCardHolder] = useState('سارة عبدالله العتيبي');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('982');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');

  const amountToPay = paymentType === 'deposit' ? depositAmount : totalAmount;
  const { subtotal, vat, total } = calculateVAT(amountToPay / 1.15); // extract 15% VAT

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      const ref = `TXN-SA-${Math.floor(10000000 + Math.random() * 90000000)}`;
      setTransactionRef(ref);
      setIsProcessing(false);
      setIsSuccess(true);

      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // fallback
      }

      onPaymentSuccess(selectedMethod, paymentType === 'deposit', ref);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-slideUp flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-saudi-green-950 to-saudi-green-900 text-white p-5 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-saudi-gold-500 text-saudi-green-950 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-cairo text-white">
                بوابة الدفع الآمنة (Saudi Secure Pay)
              </h3>
              <span className="text-[10px] text-saudi-gold-300">
                مشفرة ومتوافقة مع هيئة الزكاة والضريبة والجمارك (ZATCA) 🇸🇦
              </span>
            </div>
          </div>
          {!isSuccess && (
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-saudi-sand-50/50 flex-1">
          {isSuccess ? (
            /* Success View & Invoice */
            <div className="text-center space-y-4 py-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-black font-cairo text-saudi-green-950">
                  تم تأكيد الدفع والحجز بنجاح! 🎉
                </h4>
                <p className="text-xs text-gray-500">
                  رقم العملية المرجعي: <span className="font-mono font-bold text-gray-800">{transactionRef}</span>
                </p>
              </div>

              {/* Tax Invoice Summary Card */}
              <div className="bg-white rounded-2xl p-4 border border-saudi-sand-300 shadow-sm text-right space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <span className="font-bold text-gray-900 block">{bookingTitle}</span>
                    <span className="text-[10px] text-gray-400">المزود: {vendorName}</span>
                  </div>
                  <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    مؤكد ومضمون
                  </span>
                </div>

                <div className="space-y-1.5 text-gray-600">
                  <div className="flex justify-between">
                    <span>نوع السداد:</span>
                    <span className="font-bold text-gray-900">
                      {paymentType === 'deposit' ? 'عربون تأكيد الحجز' : 'سداد كامل المبلغ'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>المبلغ غير شامل الضريبة:</span>
                    <span>{formatSAR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span>{formatSAR(vat)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-saudi-green-950 pt-2 border-t border-gray-100">
                    <span>المبلغ المسدد إجمالاً:</span>
                    <span>{formatSAR(amountToPay)}</span>
                  </div>
                  {paymentType === 'deposit' && (
                    <div className="flex justify-between text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-2">
                      <span>المتبقي عند إتمام المناسبة:</span>
                      <span className="font-bold">{formatSAR(totalAmount - depositAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  العودة لمساحة المناسبة
                </button>
              </div>
            </div>
          ) : (
            /* Payment Form */
            <form onSubmit={handlePay} className="space-y-4">
              {/* Order Summary banner */}
              <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">تفاصيل الحجز:</span>
                  <span className="font-bold text-gray-900">{bookingTitle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">المزود المعتمد:</span>
                  <span className="font-bold text-saudi-green-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {vendorName}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-800">إجمالي قيمة الخدمة:</span>
                  <span className="font-black text-sm text-saudi-green-950">{formatSAR(totalAmount)}</span>
                </div>
              </div>

              {/* Payment Type Selection: Deposit vs Full */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">اختر خطة السداد:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType('deposit')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      paymentType === 'deposit'
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">دفع العربون فقط (30%)</span>
                    <span className="text-base font-black font-cairo text-saudi-green-950 block mt-1">
                      {formatSAR(depositAmount)}
                    </span>
                    <span className="text-[10px] text-gray-500">والمتبقي قبل الحفل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    className={`p-3 rounded-2xl border text-right transition ${
                      paymentType === 'full'
                        ? 'border-saudi-green-800 bg-saudi-green-50 text-saudi-green-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">سداد المبلغ بالكامل</span>
                    <span className="text-base font-black font-cairo text-saudi-green-950 block mt-1">
                      {formatSAR(totalAmount)}
                    </span>
                    <span className="text-[10px] text-gray-500">خصم وحجز مؤكد 100%</span>
                  </button>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">طريقة الدفع:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('mada')}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                      selectedMethod === 'mada'
                        ? 'border-saudi-green-800 bg-saudi-green-50 font-bold text-saudi-green-950'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold">بطاقة مدى Mada</span>
                    <span className="text-[9px] text-gray-400">بطاقات البنوك السعودية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('apple_pay')}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                      selectedMethod === 'apple_pay'
                        ? 'border-saudi-green-800 bg-black text-white font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold">Apple Pay</span>
                    <span className="text-[9px] text-gray-400">دفع بضغطة واحدة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stc_pay')}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                      selectedMethod === 'stc_pay'
                        ? 'border-saudi-green-800 bg-purple-50 text-purple-950 font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-bold">STC Pay</span>
                    <span className="text-[9px] text-gray-400">المحفظة الرقمية</span>
                  </button>
                </div>
              </div>

              {/* Card Inputs */}
              {(selectedMethod === 'mada' || selectedMethod === 'visa_mastercard') && (
                <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-gray-200">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">رقم بطاقة مدى / الائتمان</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono text-left dir-ltr focus:outline-none focus:border-saudi-gold-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">تاريخ الانتهاء</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono text-left dir-ltr focus:outline-none focus:border-saudi-gold-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">رمز الأمان (CVV)</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono text-left dir-ltr focus:outline-none focus:border-saudi-gold-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-saudi-green-900/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>جاري معالجة الدفع الآمن مع البنك...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-saudi-gold-300" />
                      <span>سداد {formatSAR(amountToPay)} وتأكيد الحجز فوراً</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
