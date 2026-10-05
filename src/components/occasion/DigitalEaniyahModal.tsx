'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Gift, 
  CreditCard, 
  CheckCircle2, 
  Share2, 
  Lock, 
  EyeOff, 
  Heart, 
  Copy, 
  Check, 
  X,
  Smartphone
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { EaniyahGift } from '@/lib/types';
import { formatSAR } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface DigitalEaniyahModalProps {
  isOpen: boolean;
  onClose: () => void;
  occasionId: string;
  occasionTitle: string;
  recipientDefaultTitle?: string;
  initialSenderName?: string;
  initialSenderPhone?: string;
}

const PRESET_AMOUNTS = [100, 300, 500, 1000, 2000];

const CARD_STYLES: { id: EaniyahGift['cardStyle']; labelAr: string; gradient: string; border: string; textAccent: string }[] = [
  {
    id: 'royal_gold',
    labelAr: 'الذهب الملكي',
    gradient: 'from-[#2A200B] via-[#453412] to-[#1A1406]',
    border: 'border-saudi-gold-400',
    textAccent: 'text-saudi-gold-300',
  },
  {
    id: 'emerald_luxury',
    labelAr: 'الزمرد الفاخر',
    gradient: 'from-[#00332A] via-[#004D3F] to-[#001F19]',
    border: 'border-emerald-400/50',
    textAccent: 'text-emerald-300',
  },
  {
    id: 'saudi_violet',
    labelAr: 'الخزامى النجدية',
    gradient: 'from-[#2D124D] via-[#4A1E7F] to-[#1D0933]',
    border: 'border-purple-300/50',
    textAccent: 'text-purple-200',
  },
  {
    id: 'traditional_sadu',
    labelAr: 'السدو التراثي',
    gradient: 'from-[#4A0E17] via-[#631420] to-[#2B070D]',
    border: 'border-rose-400/40',
    textAccent: 'text-rose-200',
  },
];

const PRESET_MESSAGES = [
  'ألف مبروك وبالتوفيق والبركة، جعلها الله بداية للأفراح والدرجات العلا 🤍',
  'بارك الله لكما وبارك عليكما وجمع بينكما في خير، تمنياتنا لكم بحياة سعيدة مباركة ✨',
  'ألف مبروك التخرج المشرف، فخورين بإنجازك ومنها للأعلى يا رب 🎓',
  'مبارك ما جاكم ويتربى بعزكم ودلالكم، جعله الله من حفظة كتابه الكريم 👶🌸',
];

export default function DigitalEaniyahModal({
  isOpen,
  onClose,
  occasionId,
  occasionTitle,
  recipientDefaultTitle = 'أصحاب الحفل الكرام',
  initialSenderName = '',
  initialSenderPhone = '',
}: DigitalEaniyahModalProps) {
  const { sendEaniyahGift } = useApp();

  const [amount, setAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(initialSenderName || '');
  const [senderPhone, setSenderPhone] = useState<string>(initialSenderPhone || '');
  const [blessingMessage, setBlessingMessage] = useState<string>(PRESET_MESSAGES[0]);
  const [isPrivateAmount, setIsPrivateAmount] = useState<boolean>(false);
  const [cardStyle, setCardStyle] = useState<EaniyahGift['cardStyle']>('royal_gold');
  const [paymentMethod, setPaymentMethod] = useState<'apple_pay' | 'mada' | 'stc_pay'>('apple_pay');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedGift, setCompletedGift] = useState<EaniyahGift | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) || 0 : amount;

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomChange = (val: string) => {
    setCustomAmount(val);
  };

  const handleConfirmGift = () => {
    if (!senderName.trim()) {
      alert('يرجى كتابة اسمك الكريم ليظهر في بطاقة الإهداء');
      return;
    }
    if (currentAmount < 50) {
      alert('الحد الأدنى للعانية هو 50 ر.س');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const created = sendEaniyahGift({
        occasionId,
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim() || undefined,
        amount: currentAmount,
        blessingMessage: blessingMessage.trim() || 'ألف مبروك ودامت أفراحكم 🤍',
        recipientTitle: recipientDefaultTitle,
        paymentMethod,
        isPrivateAmount,
        cardStyle,
      });

      setIsProcessing(false);
      setCompletedGift(created);

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {
        // fallback
      }
    }, 1200);
  };

  const activeCardInfo = CARD_STYLES.find((c) => c.id === cardStyle) || CARD_STYLES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-saudi-sand-300 overflow-hidden my-6">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-saudi-green-950 via-saudi-green-900 to-saudi-green-800 text-white p-5 px-6 flex items-center justify-between border-b border-saudi-gold-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/20 text-saudi-gold-300 flex items-center justify-center border border-saudi-gold-400/40">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-cairo">العانية الرقمية والرفد 🎁</h3>
              <p className="text-[11px] text-gray-300">أهْدِ تبريكاتك وعانيتك مباشرة وبأمان</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {completedGift ? (
            /* Celebration Success State */
            <div className="text-center space-y-6 animate-fadeIn py-2">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-saudi-gold-600 block">تم الدفع والإهداء بنجاح</span>
                <h4 className="text-xl font-black font-cairo text-saudi-green-950">
                  بيض الله وجهك يا {completedGift.senderName} 🤍
                </h4>
                <p className="text-xs text-gray-500">
                  تم إيداع العانية في محفظة أصحاب المناسبة وإرسال بطاقة تبريكاتك الفاخرة فورياً.
                </p>
              </div>

              {/* Digital Card Preview Voucher */}
              <div className={`p-6 rounded-3xl bg-gradient-to-br ${activeCardInfo.gradient} border ${activeCardInfo.border} text-white shadow-xl space-y-4 text-right relative overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-1.5 text-xs text-saudi-gold-300 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>بطاقة عانية مباركة</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">{completedGift.transactionRef}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-gray-300 block">مقدمة إلى:</span>
                  <h5 className="text-base font-black font-cairo text-white">{completedGift.recipientTitle}</h5>
                  <p className="text-[11px] text-saudi-gold-200">{occasionTitle}</p>
                </div>

                <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10 text-xs italic text-gray-100 leading-relaxed">
                  "{completedGift.blessingMessage}"
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/15">
                  <div>
                    <span className="text-[10px] text-gray-300 block">المهدي:</span>
                    <strong className="text-xs text-white font-bold">{completedGift.senderName}</strong>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-gray-300 block">قيمة العانية:</span>
                    <strong className="text-base font-black font-cairo text-saudi-gold-300">
                      {completedGift.isPrivateAmount ? 'عانية شرف (خاص)' : formatSAR(completedGift.amount)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    const text = `ألف مبروك! أهديتكم عانية بقيمة ${completedGift.isPrivateAmount ? 'شرف' : formatSAR(completedGift.amount)} لمناسبة ${occasionTitle} ✨🤍\n"${completedGift.blessingMessage}"\nمرسلة عبر منصة مناسبتـي 🇸🇦`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full py-3 bg-[#25D366] hover:bg-[#1EBE5B] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة بطاقة التبريكات في واتساب</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <div className="space-y-5">
              
              {/* Amount Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                  <span>حدد مبلغ العانية (ريال سعودي)</span>
                  <span className="text-[11px] text-saudi-gold-600 font-normal">عطاءٌ يجود به الكرام</span>
                </label>

                {/* Preset Chips */}
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold font-cairo transition ${
                        amount === amt && !customAmount
                          ? 'bg-saudi-green-800 text-white shadow-md'
                          : 'bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Input */}
                <div className="relative mt-2">
                  <input
                    type="number"
                    min="50"
                    step="50"
                    placeholder="أو أدخل مبلغاً مخصصاً (مثال: 1500)"
                    value={customAmount}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-saudi-gold-500 font-bold"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">ر.س</span>
                </div>
              </div>

              {/* Sender Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسمك الكريم (للبطاقة) *</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="مثال: فهد بن عبدالله الدوسري"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال (لإشعار السداد)</label>
                  <input
                    type="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs dir-ltr text-right focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>
              </div>

              {/* Blessing Message */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">كلمة التهنئة والتبريكات</label>
                <textarea
                  rows={2}
                  value={blessingMessage}
                  onChange={(e) => setBlessingMessage(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500 leading-relaxed"
                />

                {/* Quick Blessing chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {PRESET_MESSAGES.map((msg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBlessingMessage(msg)}
                      className="px-2.5 py-1 bg-saudi-sand-50 hover:bg-saudi-sand-100 text-[10px] text-gray-600 rounded-lg whitespace-nowrap border border-saudi-sand-200 transition"
                    >
                      {msg.slice(0, 28)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Style Theme Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">طابع ولون بطاقة الإهداء</label>
                <div className="grid grid-cols-4 gap-2">
                  {CARD_STYLES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCardStyle(c.id)}
                      className={`p-2 rounded-xl text-[11px] font-bold text-center border transition flex flex-col items-center gap-1 ${
                        cardStyle === c.id
                          ? 'border-saudi-gold-500 bg-saudi-gold-50 text-saudi-green-950 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className={`w-full h-3 rounded-md bg-gradient-to-r ${c.gradient}`} />
                      <span>{c.labelAr}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy Setting Toggle */}
              <div className="p-3 bg-saudi-sand-50 rounded-2xl border border-saudi-sand-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-saudi-sand-200 text-gray-700 flex items-center justify-center">
                    <EyeOff className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">إخفاء قيمة العانية (عانية سرية)</span>
                    <span className="text-[10px] text-gray-500">لا يظهر المبلغ في سجل التهاني العام ويصل للمعرس فقط</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivateAmount}
                  onChange={(e) => setIsPrivateAmount(e.target.checked)}
                  className="w-4 h-4 text-saudi-green-800 rounded focus:ring-saudi-green-800"
                />
              </div>

              {/* Payment Methods */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-gray-700">طريقة الدفع الفوري</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('apple_pay')}
                    className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      paymentMethod === 'apple_pay'
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Apple Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mada')}
                    className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      paymentMethod === 'mada'
                        ? 'bg-saudi-green-800 text-white border-saudi-green-800 shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>مدى Mada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('stc_pay')}
                    className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      paymentMethod === 'stc_pay'
                        ? 'bg-[#4F008C] text-white border-[#4F008C] shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono text-sm">STC</span>
                    <span>stc pay</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleConfirmGift}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-saudi-gold-500 to-saudi-gold-600 hover:from-saudi-gold-600 hover:to-saudi-gold-700 text-saudi-green-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-saudi-green-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري معالجة الدفع الآمن...</span>
                  </div>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>إرسال العانية ({formatSAR(currentAmount)})</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400">
                <Lock className="w-3 h-3" />
                <span>دفع مشفر 100% متوافق مع نظام المدفوعات والبنك المركزي السعودي (SAMA)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
