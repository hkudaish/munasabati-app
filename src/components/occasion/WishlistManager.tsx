'use client';

import React, { useState } from 'react';
import { Gift, Plus, Sparkles, Heart, CheckCircle2, DollarSign } from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';

export default function WishlistManager() {
  const { activeOccasion, wishlistGifts, addWishlistGift, contributeToGift } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('ضيافة');
  const [imageUrl, setImageUrl] = useState('');
  const [allowContributions, setAllowContributions] = useState(true);

  const [contributeModalGift, setContributeModalGift] = useState<any | null>(null);
  const [contributeAmount, setContributeAmount] = useState('200');
  const [contributorName, setContributorName] = useState('');

  if (!activeOccasion) return null;

  const occasionGifts = wishlistGifts.filter((g) => g.occasionId === activeOccasion.id);

  const handleAddGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !price) return;

    addWishlistGift({
      occasionId: activeOccasion.id,
      title,
      price: Number(price),
      category,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
      isFulfilled: false,
      allowContributions,
      contributedAmount: 0,
      isServiceGift: category === 'ضيافة' || category === 'تصوير',
    });

    setTitle('');
    setPrice('');
    setIsAddModalOpen(false);
  };

  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeModalGift) return;

    contributeToGift(contributeModalGift.id, Number(contributeAmount), contributorName || 'فاعل خير');
    setContributeModalGift(null);
    setContributorName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center gap-2">
            <Gift className="w-5 h-5 text-saudi-gold-600" />
            <span>قائمة الهدايا و"اهدِ مناسبة"</span>
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            أتح لأصدقائك وأحبابك إهداء جزء من مستلزمات الحفل (عربة قهوة، كيكة، تصوير) أو المساهمة في هدية كبرى.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm transition"
        >
          <Plus className="w-4 h-4 text-saudi-gold-400" />
          <span>+ إضافة طلب هدية</span>
        </button>
      </div>

      {/* Gifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {occasionGifts.map((gift) => {
          const percentage = Math.min(100, Math.round((gift.contributedAmount / gift.price) * 100));

          return (
            <div
              key={gift.id}
              className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-sm hover:border-saudi-gold-400 transition flex flex-col justify-between"
            >
              <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                <img
                  src={gift.imageUrl}
                  alt={gift.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
                <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {gift.category}
                </span>

                {gift.isFulfilled && (
                  <div className="absolute inset-0 bg-saudi-green-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                    <CheckCircle2 className="w-8 h-8 text-saudi-gold-400 mb-1" />
                    <span className="text-xs font-bold">تم الإهداء بالكامل! ✨</span>
                    {gift.giftedBy && (
                      <span className="text-[11px] text-saudi-gold-200 mt-0.5">من: {gift.giftedBy}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-sm text-gray-900 line-clamp-2">{gift.title}</h5>
                  <span className="text-xs font-bold text-saudi-green-900 block mt-1">
                    القيمة: {formatSAR(gift.price)}
                  </span>
                </div>

                {gift.allowContributions && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>تم جمع: {formatSAR(gift.contributedAmount)}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-saudi-gold-500 h-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {!gift.isFulfilled && (
                  <button
                    onClick={() => setContributeModalGift(gift)}
                    className="w-full py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Heart className="w-4 h-4 text-saudi-green-950" />
                    <span>{gift.allowContributions ? 'المساهمة في الهدية' : 'إهداء كامل المبلغ'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Gift Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              إضافة طلب هدية أو خدمة لقائمة الهدايا
            </h4>

            <form onSubmit={handleAddGift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم الهدية / الخدمة</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: عربة آيسكريم ومشروبات، ألبوم إيطالي..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">القيمة التقريبية (ر.س)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1500"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  >
                    <option value="ضيافة">ضيافة (اهدِ مناسبة)</option>
                    <option value="تصوير">تصوير وترقية ألبوم</option>
                    <option value="ديكور">ديكور وكوشة</option>
                    <option value="هدايا شخصية">هدايا شخصية</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowContribute"
                  checked={allowContributions}
                  onChange={(e) => setAllowContributions(e.target.checked)}
                  className="rounded text-saudi-green-800"
                />
                <label htmlFor="allowContribute" className="text-xs text-gray-700 font-medium">
                  السماح بمساهمات جزئية من عدة أشخاص
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl"
                >
                  إضافة للقائمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contributeModalGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              المساهمة في إهداء المناسبة 🎁
            </h4>
            <p className="text-xs text-gray-500">
              أنت تساهم في: <span className="font-bold text-gray-800">{contributeModalGift.title}</span>
            </p>

            <form onSubmit={handleContribute} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسمك الكريم (لإضافته في بطاقة الإهداء)</label>
                <input
                  type="text"
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  placeholder="مثال: خالتي أم محمد..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">مبلغ المساهمة (ر.س)</label>
                <input
                  type="number"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  max={contributeModalGift.price - contributeModalGift.contributedAmount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setContributeModalGift(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl"
                >
                  تأكيد الإهداء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
