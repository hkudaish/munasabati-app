'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Sparkles, Heart, Bookmark, Share2, Store, MapPin, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';

export default function InspirationPage() {
  const { inspirationPosts, occasionTypes } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  const handleToggleLike = (postId: string) => {
    setLikes((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const filteredPosts = inspirationPosts.filter((post) => {
    return selectedCategory === 'all' || post.occasionTypeId === selectedCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
          <Lightbulb className="w-4 h-4" />
          <span>معرض الإلهام والتصاميم السعودية</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
          إلهام المناسبات (Inspiration Feed) ✨
        </h1>
        <p className="text-xs text-gray-500 max-w-2xl font-tajawal">
          استلهم أفكاراً واقعية لحفلات التخرج، الأعراس، عقد القران، واستقبال المواليد مع ربط مباشر بالموردين المسؤولين عن كل تفصيلة.
        </p>
      </div>

      {/* Occasion Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
            selectedCategory === 'all'
              ? 'bg-saudi-green-800 text-white shadow-md'
              : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
          }`}
        >
          كل الأفكار ({inspirationPosts.length})
        </button>

        {occasionTypes.slice(0, 5).map((occ) => (
          <button
            key={occ.id}
            onClick={() => setSelectedCategory(occ.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === occ.id
                ? 'bg-saudi-green-800 text-white shadow-md'
                : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
            }`}
          >
            {occ.nameAr}
          </button>
        ))}
      </div>

      {/* Social Inspiration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map((post) => {
          const isLiked = likes[post.id];

          return (
            <div
              key={post.id}
              className="bg-white rounded-3xl border border-saudi-sand-300 overflow-hidden shadow-card hover:shadow-xl hover:border-saudi-gold-400 transition flex flex-col justify-between group"
            >
              {/* Media with Location */}
              <div className="relative h-72 w-full bg-gray-100 overflow-hidden">
                <img
                  src={post.mediaUrl}
                  alt={post.titleAr}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  <MapPin className="w-3 h-3 text-saudi-gold-400" />
                  <span>{post.cityNameAr} • {post.occasionTypeNameAr}</span>
                </div>

                <button
                  onClick={() => handleToggleLike(post.id)}
                  className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 active:scale-95 transition"
                >
                  <Heart
                    className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                  />
                </button>
              </div>

              {/* Details & Tagged Vendors */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-gray-900 line-clamp-2 font-cairo leading-snug">
                    {post.titleAr}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {post.descriptionAr}
                  </p>

                  {/* Hash Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-saudi-gold-700 bg-saudi-gold-50 px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Tagged Vendors */}
                  <div className="space-y-1.5 pt-3 border-t border-saudi-sand-200 mt-3">
                    <span className="text-[11px] font-bold text-gray-700 block">
                      الموردين المنفذين لهذا العمل:
                    </span>
                    {post.taggedVendors.map((v, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-700">
                        <span className="text-gray-500">{v.category}: <strong className="text-saudi-green-950 font-bold">{v.vendorName}</strong></span>
                        <span className="font-bold text-gray-900">{formatSAR(v.servicePrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct Action */}
                <div className="pt-2">
                  <Link
                    href={`/plan?inspiration=${post.id}`}
                    className="w-full py-3 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Sparkles className="w-4 h-4 text-saudi-gold-300" />
                    <span>احجز نفس هذا التصميم لمناسبتك</span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
