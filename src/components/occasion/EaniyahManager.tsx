'use client';

import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  ArrowDownLeft,
  Building,
  CheckCircle2,
  Lock,
  Download,
  Share2,
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  UserCheck,
  Search,
  Filter
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import { EaniyahGift } from '@/lib/types';
import confetti from 'canvas-confetti';

interface EaniyahManagerProps {
  occasionId: string;
}

const SAUDI_BANKS = [
  'مصرف الراجحي (Al Rajhi Bank)',
  'البنك الأهلي السعودي (SNB)',
  'مصرف الإنماء (Alinma Bank)',
  'بنك الرياض (Riyad Bank)',
  'البنك العربي الوطني (anb)',
  'بنك البلاد (Bank Albilad)',
  'البنك السعودي الأول (SAB)',
];

export default function EaniyahManager({ occasionId }: EaniyahManagerProps) {
  const { eaniyahGifts, occasions, transferEaniyahPayout } = useApp();

  const currentOccasion = occasions.find((o) => o.id === occasionId);
  const gifts = eaniyahGifts.filter((g) => g.occasionId === occasionId);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [iban, setIban] = useState('SA0380000000608010167519');
  const [selectedBank, setSelectedBank] = useState(SAUDI_BANKS[0]);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const totalCollected = gifts.reduce((acc, g) => acc + g.amount, 0);
  const transferredAmount = gifts
    .filter((g) => g.status === 'transferred')
    .reduce((acc, g) => acc + g.amount, 0);
  const availableBalance = totalCollected - transferredAmount;

  const filteredGifts = gifts.filter((g) => {
    const matchesSearch =
      g.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.blessingMessage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStyle = filterStyle === 'all' || g.cardStyle === filterStyle;
    return matchesSearch && matchesStyle;
  });

  const handleRequestPayout = () => {
    if (!iban.startsWith('SA') || iban.length < 24) {
      alert('يرجى التأكد من صحة رقم الآيبان السعودي (يبدأ بـ SA ومكون من 24 خانة)');
      return;
    }

    transferEaniyahPayout(occasionId, iban, selectedBank);
    setPayoutSuccess(true);
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {
      // fallback
    }
    setTimeout(() => {
      setShowPayoutModal(false);
      setPayoutSuccess(false);
    }, 2500);
  };

  const getStyleCardBadge = (style: EaniyahGift['cardStyle']) => {
    switch (style) {
      case 'royal_gold':
        return { label: 'ذهب ملكي', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'emerald_luxury':
        return { label: 'زمرد فاخر', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'saudi_violet':
        return { label: 'خزامى نجدية', bg: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'traditional_sadu':
        return { label: 'سدو تراثي', bg: 'bg-rose-100 text-rose-900 border-rose-300' };
      default:
        return { label: 'فاخر', bg: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Collected */}
        <div className="bg-gradient-to-br from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 p-6 rounded-3xl text-white border border-saudi-gold-500/30 shadow-lg relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-saudi-gold-300 font-bold flex items-center gap-1.5">
              <Gift className="w-4 h-4" />
              <span>إجمالي العانية الرقمية</span>
            </span>
            <span className="bg-saudi-gold-500/20 text-saudi-gold-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-saudi-gold-400/30">
              {gifts.length} مساهمين
            </span>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-black font-cairo text-white">
              {formatSAR(totalCollected)}
            </span>
            <p className="text-[11px] text-gray-300 mt-1">
              مجموع التبريكات والنقوط المقدمة من ضيوف المناسبة
            </p>
          </div>
        </div>

        {/* Available Balance & Payout */}
        <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-green-600" />
              <span>الرصيد المتاح للتحويل</span>
            </span>
            <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              فوري للحساب
            </span>
          </div>

          <div>
            <span className="text-2xl font-black font-cairo text-saudi-green-950">
              {formatSAR(availableBalance)}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">جاهزة للتحويل إلى حسابك البنكي السعودي</p>
          </div>

          <button
            onClick={() => setShowPayoutModal(true)}
            disabled={availableBalance <= 0}
            className="w-full py-2.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 shadow-sm"
          >
            <Building className="w-4 h-4" />
            <span>طلب تحويل الآيبان (Payout)</span>
          </button>
        </div>

        {/* Transferred Stat */}
        <div className="bg-white p-6 rounded-3xl border border-saudi-sand-300 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-saudi-gold-600" />
              <span>مبالغ تم تحويلها</span>
            </span>
            <span className="text-[10px] text-gray-400">حسابك البنكي</span>
          </div>

          <div>
            <span className="text-2xl font-black font-cairo text-gray-800">
              {formatSAR(transferredAmount)}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {transferredAmount > 0 ? 'تمت الحوالة بنجاح' : 'لم يتم تحويل مبالغ بعد'}
            </p>
          </div>

          <div className="p-2.5 bg-saudi-sand-50 rounded-xl border border-saudi-sand-200 text-[10px] text-gray-600 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-saudi-green-800 shrink-0" />
            <span>نظام إيداع آمن متصل بسريع وبوابات الدفع الوطنية</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-saudi-sand-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="بحث باسم المهدي أو كلمة التهنئة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 border border-gray-200 rounded-2xl text-xs focus:outline-none focus:border-saudi-gold-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-gray-400 font-bold whitespace-nowrap">النوع:</span>
          {['all', 'royal_gold', 'emerald_luxury', 'saudi_violet', 'traditional_sadu'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStyle(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                filterStyle === st
                  ? 'bg-saudi-green-800 text-white'
                  : 'bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-700'
              }`}
            >
              {st === 'all'
                ? 'الكل'
                : st === 'royal_gold'
                ? 'ذهب ملكي'
                : st === 'emerald_luxury'
                ? 'زمرد'
                : st === 'saudi_violet'
                ? 'خزامى'
                : 'سدو'}
            </button>
          ))}
        </div>
      </div>

      {/* Gifts Grid Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGifts.length === 0 ? (
          <div className="col-span-2 bg-white rounded-3xl p-12 text-center border border-dashed border-gray-300 space-y-3">
            <Gift className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="text-base font-bold text-gray-700 font-cairo">لا توجد عانية مسجلة حتى الآن</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              شارك رابط الدعوة الرقمية المخصصة للمناسبة لتمكين الضيوف من إرسال العانية والتبريكات عبر Apple Pay ومدى.
            </p>
          </div>
        ) : (
          filteredGifts.map((gift) => {
            const badge = getStyleCardBadge(gift.cardStyle);
            return (
              <div
                key={gift.id}
                className="bg-white rounded-3xl p-5 border border-saudi-sand-300 shadow-sm hover:shadow-md transition space-y-4"
              >
                {/* Card Top Row */}
                <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-saudi-sand-100 text-saudi-green-900 flex items-center justify-center font-bold text-sm">
                      {gift.senderName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-cairo text-saudi-green-950 flex items-center gap-2">
                        <span>{gift.senderName}</span>
                        {gift.isPrivateAmount && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <EyeOff className="w-3 h-3" />
                            <span>مبلغ سري</span>
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(gift.createdAt).toLocaleDateString('ar-SA')}</span>
                        <span>•</span>
                        <span>{gift.paymentMethod.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-base font-black font-cairo text-saudi-green-900 block">
                      {formatSAR(gift.amount)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Blessing message */}
                <div className="bg-saudi-sand-50/70 p-3.5 rounded-2xl text-xs text-gray-700 leading-relaxed border border-saudi-sand-200">
                  "{gift.blessingMessage}"
                </div>

                {/* Card Footer status */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-gray-400 font-mono text-[10px]">{gift.transactionRef}</span>
                  <span
                    className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                      gift.status === 'transferred'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {gift.status === 'transferred' ? 'تم التحويل للآيبان' : 'في المحفظة جاهز'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* IBAN Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-saudi-sand-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-saudi-green-800" />
                <h3 className="text-base font-bold font-cairo text-saudi-green-950">تحويل العانية للآيبان</h3>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {payoutSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold font-cairo text-saudi-green-950">
                  تم اعتماد طلب التحويل بنجاح!
                </h4>
                <p className="text-xs text-gray-500">
                  سيتم إيداع مبلغ {formatSAR(availableBalance)} في حسابك البنكي خلال ساعات العمل المصرفية عبر نظام سريع.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-saudi-sand-50 rounded-2xl border border-saudi-sand-200 space-y-1">
                  <span className="text-[11px] text-gray-500 block">المبلغ المراد تحويله:</span>
                  <strong className="text-lg font-black font-cairo text-saudi-green-950">
                    {formatSAR(availableBalance)}
                  </strong>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">اختر البنك السعودي</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  >
                    {SAUDI_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">رقم الآيبان الدولي (IBAN)</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value.toUpperCase())}
                    placeholder="SA0000000000000000000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono dir-ltr text-right focus:outline-none focus:border-saudi-gold-500 font-bold"
                  />
                  <span className="text-[10px] text-gray-400">
                    ملاحظة: يجب أن يتطابق اسم صاحب الحساب مع اسم صاحب المناسبة للتحقق الأمني.
                  </span>
                </div>

                <button
                  onClick={handleRequestPayout}
                  className="w-full py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs shadow-md transition"
                >
                  تأكيد التحويل الآن
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
