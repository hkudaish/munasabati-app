'use client';

import React, { useState } from 'react';
import { 
  X, 
  Wallet, 
  ArrowDownToLine, 
  Building2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { formatSaudiRiyal } from '@/lib/utils';

interface VendorWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName?: string;
}

export const VendorWalletModal: React.FC<VendorWalletModalProps> = ({
  isOpen,
  onClose,
  vendorName = 'أطايب الضيافة النجدية',
}) => {
  const [iban, setIban] = useState('SA0380000000608010167519');
  const [bankName, setBankName] = useState('مصرف الراجحي (Al Rajhi Bank)');
  const [withdrawAmount, setWithdrawAmount] = useState('18450');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const totalEarnings = 48500;
  const platformFee = 4850;
  const availableBalance = 18450;
  const pendingEscrow = 15200;

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequesting(true);

    setTimeout(() => {
      setIsRequesting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white text-base">
                محفظة المستحقات والتحويل البنكي
              </h3>
              <p className="text-xs text-neutral-400">{vendorName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-neutral-900 dark:text-white">
              تم إرسال طلب التحويل البنكي بنجاح!
            </h4>
            <p className="text-xs text-neutral-500">
              سيتم إيداع مبلغ {formatSaudiRiyal(Number(withdrawAmount))} في حسابك البنكي خلال 24 ساعة عمل عبر نظام سريع.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Balance Cards Matrix */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block mb-1">
                  الرصيد المتاح للسحب
                </span>
                <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatSaudiRiyal(availableBalance)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  مبالغ قيد الضمان (Escrow)
                </span>
                <span className="font-mono text-xl font-bold text-neutral-700 dark:text-neutral-300">
                  {formatSaudiRiyal(pendingEscrow)}
                </span>
              </div>
            </div>

            {/* Financial Ledger Summary */}
            <div className="space-y-2 text-xs p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-800">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>إجمالي مبيعات الحجوزات:</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(totalEarnings)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>عمولة المنصة التشغيلية (10%):</span>
                <span className="font-mono text-rose-500">-{formatSaudiRiyal(platformFee)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>المبالغ المحولة مسبقاً لحسابك:</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatSaudiRiyal(10000)}</span>
              </div>
            </div>

            {/* Payout Request Form */}
            <form onSubmit={handleRequestPayout} className="space-y-4">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                طلب تحويل الرصيد المتاح إلى الحساب البنكي:
              </h4>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  البنك السعودي
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                >
                  <option value="مصرف الراجحي (Al Rajhi Bank)">مصرف الراجحي (Al Rajhi Bank)</option>
                  <option value="البنك الأهلي السعودي (SNB)">البنك الأهلي السعودي (SNB)</option>
                  <option value="بنك الرياض (Riyad Bank)">بنك الرياض (Riyad Bank)</option>
                  <option value="مصرف الإنماء (Alinma Bank)">مصرف الإنماء (Alinma Bank)</option>
                  <option value="البنك السعودي الأول (SAB)">البنك السعودي الأول (SAB)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  رقم الآيبان (IBAN)
                </label>
                <input
                  type="text"
                  required
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-900 dark:text-white dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  المبلغ المطلوب سحبه (ر.س)
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  max={availableBalance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>التحويلات البنكية تتم فورياً عبر نظام المدفوعات الفورية السعودي (سريع SARIE).</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isRequesting}
                  className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{isRequesting ? 'جاري تنفيذ طلب التحويل...' : 'تأكيد طلب التحويل البنكي'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-200"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
