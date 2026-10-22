'use client';

import React, { useEffect, useState } from 'react';
import { Star, ShieldCheck, Quote, MessageSquare } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

interface CustomerReviewsShowcaseProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  featuredOnly?: boolean;
  /** kept for the existing call sites; the real list has no demo filters */
  showFilters?: boolean;
}
interface PublicReview { id: string; reviewerName: string; rating: number; commentAr: string; date: string; featured: boolean; replyAr: string | null }

/** Real reviews only: approved by the administrator, written by customers who completed a service on the platform. Hidden until there is at least one. */
export default function CustomerReviewsShowcase({
  title = 'تجارب عملائنا',
  subtitle = 'آراء حقيقية من عملاء أكملوا خدماتهم عبر المنصة، تُنشر بعد مراجعة الإدارة',
  limit = 6,
  featuredOnly = false,
}: CustomerReviewsShowcaseProps) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [summary, setSummary] = useState<{ count: number; average: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requestJSON(`/api/reviews?${featuredOnly ? 'featured=1&' : ''}limit=${limit}`),
      requestJSON('/api/reviews?limit=1'),
    ]).then(([list, all]) => { if (!cancelled) { setReviews(list.reviews); setSummary(all.summary); } }).catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, [featuredOnly, limit]);

  if (!reviews?.length) return null;
  return (
    <section aria-label="تجارب العملاء" className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-saudi-gold-500/20 bg-gradient-to-br from-saudi-green-950 via-saudi-green-900 to-saudi-green-950 p-6 text-white sm:p-10">
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-saudi-gold-500/30 bg-saudi-gold-500/20 px-3.5 py-1 text-xs font-bold text-saudi-gold-300"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /><span>من عملاء أتموا خدماتهم عبر المنصة</span></div>
            <h2 className="font-cairo text-2xl font-black leading-snug text-white sm:text-3xl">{title}</h2>
            <p className="font-tajawal text-xs leading-relaxed text-gray-300 sm:text-sm">{subtitle}</p>
          </div>
          {summary?.average != null && (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur-md sm:p-5">
              <div className="flex items-center justify-center gap-1 text-saudi-gold-400"><Star className="h-5 w-5 fill-saudi-gold-400" aria-hidden="true" /><span className="font-cairo text-3xl font-black text-white">{summary.average.toFixed(1)}</span></div>
              <span className="mt-0.5 block text-xs text-gray-300">من 5 · {summary.count} تقييماً</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map(review => (
          <article key={review.id} className="space-y-3 rounded-2xl border border-saudi-sand-300 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">{review.reviewerName}</h3>
              <span role="img" aria-label={`${Math.round(review.rating)} من 5`} className="text-saudi-gold-600">{'★'.repeat(Math.round(review.rating))}<span className="text-gray-300">{'★'.repeat(5 - Math.round(review.rating))}</span></span>
            </div>
            <p className="flex gap-2 text-sm leading-7 text-gray-700"><Quote className="mt-1 h-4 w-4 shrink-0 text-saudi-gold-500" aria-hidden="true" /><span>{review.commentAr}</span></p>
            {review.replyAr && <p className="flex gap-2 rounded-xl bg-saudi-green-50 p-3 text-xs leading-6 text-saudi-green-950"><MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span><strong>رد المورد:</strong> {review.replyAr}</span></p>}
            <p className="text-caption2 text-gray-500">{review.date}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
