'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, CheckCircle2, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store';
import RFQComparisonMatrix from '@/components/rfq/RFQComparisonMatrix';
import CreateRFQModal from '@/components/rfq/CreateRFQModal';
import { notify } from '@/lib/notify';
import { RFQQuote } from '@/lib/types';

export default function RFQHubPage() {
  const router = useRouter();
  const { rfqRequests, acceptRFQQuote } = useApp();

  const [selectedRFQId, setSelectedRFQId] = useState<string>(rfqRequests[0]?.id || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const selectedRFQ = rfqRequests.find((r) => r.id === selectedRFQId) || rfqRequests[0];

  const handleAcceptQuote = (quote: RFQQuote) => {
    if (!selectedRFQ) return;
    acceptRFQQuote(selectedRFQ.id, quote.id);
    // Orders are created in the commerce checkout, where the server prices every line.
    // A quote typed in the browser is never turned into an order or a payment here.
    notify(`تم اعتماد عرض ${quote.vendorName}. أضف خدماته من المتجر لإتمام الطلب؛ الأسعار النهائية يحددها النظام.`, 'success');
    router.push('/commerce');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-saudi-gold-600">
            <FileText className="w-4 h-4" />
            <span>نظام طلب ومقارنة عروض الأسعار الموحد</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
            عروض الأسعار (RFQ Comparison Matrix)
          </h1>
          <p className="text-xs text-gray-500 max-w-2xl font-tajawal">
            لا داعي لمقارنة ملفات PDF العشوائية يدوياً؛ استقبل عروض أسعار موحدة ومفصلة وقارنها جنباً إلى جنب واقبل العرض الأنسب بضغطة واحدة.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-md self-start sm:self-auto shrink-0 transition"
        >
          <Plus className="w-4 h-4 text-saudi-gold-400" />
          <span>+ طلب عرض سعر جديد</span>
        </button>
      </div>

      {/* RFQ Selector Tabs if multiple */}
      {rfqRequests.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {rfqRequests.map((rfq) => (
            <button
              key={rfq.id}
              onClick={() => setSelectedRFQId(rfq.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                selectedRFQ?.id === rfq.id
                  ? 'bg-saudi-green-800 text-white shadow-md'
                  : 'bg-white border border-saudi-sand-300 text-gray-700 hover:bg-saudi-sand-50'
              }`}
            >
              <span>{rfq.occasionTitle}</span>
              <span className="bg-saudi-gold-500 text-saudi-green-950 text-caption2 font-bold px-1.5 py-0.2 rounded-full">
                {rfq.quotes.length} عروض
              </span>
            </button>
          ))}
        </div>
      )}

      {/* RFQ Comparison Matrix */}
      {selectedRFQ ? (
        <RFQComparisonMatrix
          rfq={selectedRFQ}
          onAcceptQuote={handleAcceptQuote}
        />
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-saudi-sand-300 text-center space-y-4">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800 font-cairo">
            لا توجد طلبات عروض أسعار حتى الآن
          </h3>
          <p className="text-xs text-gray-500">
            اطرح طلب تسعير ليتنافس الموردون على تقديم أفضل سعر وجودة لمناسبتك.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-saudi-green-800 text-white rounded-xl text-xs font-bold"
          >
            + طرح طلب تسعير الآن
          </button>
        </div>
      )}

      {/* Create RFQ Modal */}
      {isCreateModalOpen && (
        <CreateRFQModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newId) => {
            setSelectedRFQId(newId);
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
