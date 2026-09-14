'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  Share2,
  Trash2,
  Search,
  Filter,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Guest } from '@/lib/types';

export default function GuestManager() {
  const { activeOccasion, guests, addGuest, updateGuestStatus, deleteGuest } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'men' | 'women' | 'family'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeQRModalGuest, setActiveQRModalGuest] = useState<Guest | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<'men' | 'women' | 'family'>('women');
  const [companionCount, setCompanionCount] = useState('0');
  const [familyGroup, setFamilyGroup] = useState('');

  if (!activeOccasion) return null;

  const occasionGuests = guests.filter((g) => g.occasionId === activeOccasion.id);

  // Filtered list
  const filteredGuests = occasionGuests.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone.includes(searchQuery);
    const matchesCategory = filterCategory === 'all' || g.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || g.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: occasionGuests.reduce((acc, g) => acc + 1 + (g.companionCount || 0), 0),
    confirmed: occasionGuests.filter((g) => g.status === 'confirmed').reduce((acc, g) => acc + 1 + (g.companionCount || 0), 0),
    declined: occasionGuests.filter((g) => g.status === 'declined').reduce((acc, g) => acc + 1 + (g.companionCount || 0), 0),
    attended: occasionGuests.filter((g) => g.status === 'attended').reduce((acc, g) => acc + 1 + (g.companionCount || 0), 0),
    pending: occasionGuests.filter((g) => g.status === 'invited').reduce((acc, g) => acc + 1 + (g.companionCount || 0), 0),
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addGuest({
      occasionId: activeOccasion.id,
      name,
      phone: phone || '+966500000000',
      category,
      companionCount: Number(companionCount) || 0,
      familyGroup: familyGroup || 'عام',
      status: 'invited',
      invitedVia: 'whatsapp',
    });

    setName('');
    setPhone('');
    setCompanionCount('0');
    setFamilyGroup('');
    setIsAddModalOpen(false);
  };

  const generateWhatsAppMessage = (guest: Guest) => {
    const rsvpLink = `${window.location.origin}/invite/${guest.qrCode}`;
    const text = `السلام عليكم ورحمة الله وبركاته،\nنتشرف بدعوتكم لحضور "${activeOccasion.title}"\nالموعد: ${activeOccasion.date}\nيسعدنا تأكيد حضوركم عبر الرابط المخصص لكم:\n${rsvpLink}\n\nحضوركم يسعدنا ويشرفنا! ✨`;
    const cleanPhone = guest.phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
          <Users className="w-5 h-5 mx-auto text-saudi-green-800 mb-1" />
          <span className="text-[11px] text-gray-500 block">إجمالي المدعوين</span>
          <span className="text-xl font-bold text-gray-900 font-cairo">{stats.total}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
          <span className="text-[11px] text-gray-500 block">المؤكدين (RSVP)</span>
          <span className="text-xl font-bold text-green-700 font-cairo">{stats.confirmed}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
          <Clock className="w-5 h-5 mx-auto text-amber-600 mb-1" />
          <span className="text-[11px] text-gray-500 block">بانتظار الرد</span>
          <span className="text-xl font-bold text-amber-600 font-cairo">{stats.pending}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center">
          <XCircle className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <span className="text-[11px] text-gray-500 block">المعتذرين</span>
          <span className="text-xl font-bold text-red-600 font-cairo">{stats.declined}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm text-center col-span-2 sm:col-span-1">
          <QrCode className="w-5 h-5 mx-auto text-saudi-gold-600 mb-1" />
          <span className="text-[11px] text-gray-500 block">حضروا بالقاعة</span>
          <span className="text-xl font-bold text-saudi-green-900 font-cairo">{stats.attended}</span>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-saudi-sand-300 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الجوال..."
            className="w-full pr-9 pl-3 py-1.5 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
          />
        </div>

        {/* Filters & Add Guest Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="px-3 py-1.5 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs text-gray-700"
          >
            <option value="all">كل الفئات</option>
            <option value="women">قسم النساء</option>
            <option value="men">قسم الرجال</option>
            <option value="family">عائلات</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-saudi-sand-50 border border-gray-200 rounded-xl text-xs text-gray-700"
          >
            <option value="all">جميع الحالات</option>
            <option value="confirmed">مؤكد</option>
            <option value="invited">بانتظار الرد</option>
            <option value="attended">حضر بالقاعة</option>
            <option value="declined">معتذر</option>
          </select>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4 text-saudi-gold-400" />
            <span>+ إضافة مدعو</span>
          </button>
        </div>
      </div>

      {/* Guest List */}
      <div className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-saudi-sand-100 text-gray-600 font-bold border-b border-saudi-sand-300">
              <tr>
                <th className="p-3.5">الاسم والبيانات</th>
                <th className="p-3.5">الفئة والمجموعة</th>
                <th className="p-3.5">المرافقين</th>
                <th className="p-3.5">الطاولة المخصصة</th>
                <th className="p-3.5">حالة التأكيد (RSVP)</th>
                <th className="p-3.5 text-center">إجراءات ودعوة واتساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    لا يوجد مدعوين مطابقين للبحث. اضغط "+ إضافة مدعو" للبدء.
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-saudi-sand-50/60 transition">
                    <td className="p-3.5">
                      <span className="font-bold text-gray-900 block">{guest.name}</span>
                      <span className="text-[10px] text-gray-500 dir-ltr inline-block">{guest.phone}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-saudi-sand-100 text-saudi-green-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {guest.category === 'women' ? 'نساء' : guest.category === 'men' ? 'رجال' : 'عائلة'}
                      </span>
                      {guest.familyGroup && (
                        <span className="text-[10px] text-gray-400 block mt-0.5">{guest.familyGroup}</span>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-gray-700">
                      {guest.companionCount > 0 ? `+${guest.companionCount} مرافق` : 'بدون مرافق'}
                    </td>
                    <td className="p-3.5 text-gray-600">
                      {guest.tableName ? (
                        <span className="font-semibold text-saudi-green-800">{guest.tableName}</span>
                      ) : (
                        <span className="text-gray-400 italic">غير محدد</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {guest.status === 'confirmed' && (
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            مؤكد الحضور
                          </span>
                        )}
                        {guest.status === 'attended' && (
                          <span className="bg-saudi-green-900 text-saudi-gold-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            حضر بالقاعة
                          </span>
                        )}
                        {guest.status === 'invited' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            بانتظار الرد
                          </span>
                        )}
                        {guest.status === 'declined' && (
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            اعتذر
                          </span>
                        )}

                        {/* Quick state change dropdown */}
                        <select
                          value={guest.status}
                          onChange={(e) => updateGuestStatus(guest.id, e.target.value as any)}
                          className="text-[10px] bg-transparent border border-gray-200 rounded px-1 py-0.5 text-gray-600"
                        >
                          <option value="invited">دعوة</option>
                          <option value="confirmed">تأكيد</option>
                          <option value="attended">حضور</option>
                          <option value="declined">اعتذار</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* WhatsApp Invite button */}
                        <a
                          href={generateWhatsAppMessage(guest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-1 text-[11px] font-bold px-2.5 shadow-sm transition"
                          title="إرسال الدعوة بالواتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">واتساب</span>
                        </a>

                        {/* QR Code preview */}
                        <button
                          onClick={() => setActiveQRModalGuest(guest)}
                          className="p-1.5 text-saudi-green-800 hover:bg-saudi-green-50 rounded-lg border border-saudi-green-200"
                          title="بطاقة الدخول QR"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteGuest(guest.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Guest Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              إضافة مدعو جديد
            </h4>

            <form onSubmit={handleAddGuest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم المدعو</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الدكتورة أمل العتيبي، أبو فيصل..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال (واتساب)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966501234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500 text-left dir-ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">القسم</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  >
                    <option value="women">قسم النساء</option>
                    <option value="men">قسم الرجال</option>
                    <option value="family">عائلات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">عدد المرافقين</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={companionCount}
                    onChange={(e) => setCompanionCount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المجموعة العائلية / التصنيف</label>
                <input
                  type="text"
                  value={familyGroup}
                  onChange={(e) => setFamilyGroup(e.target.value)}
                  placeholder="مثال: زملاء العمل، العائلة المقربة، الجيران..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                />
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
                  إضافة وإصدار كود QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Pass Modal */}
      {activeQRModalGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-gradient-to-b from-saudi-green-950 to-saudi-green-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-saudi-gold-500/40 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-2 bg-gold-gradient" />

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-saudi-gold-400 uppercase tracking-widest">
                بطاقة دخول المناسبة (VIP Pass)
              </span>
              <h4 className="text-lg font-bold font-cairo text-white">
                {activeOccasion.title}
              </h4>
              <p className="text-xs text-saudi-sand-200">{activeOccasion.date}</p>
            </div>

            {/* Simulated QR Box */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg my-2">
              <div className="w-44 h-44 bg-saudi-sand-50 border-2 border-dashed border-saudi-green-800 rounded-xl flex flex-col items-center justify-center p-2 text-center">
                <QrCode className="w-24 h-24 text-saudi-green-950" />
                <span className="text-[10px] font-mono text-gray-600 mt-2 font-bold">
                  {activeQRModalGuest.qrCode}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-saudi-gold-300 text-sm block">
                {activeQRModalGuest.name}
              </span>
              <p className="text-gray-300 text-[11px]">
                {activeQRModalGuest.category === 'women' ? 'قسم النساء' : 'قسم الرجال'}
                {activeQRModalGuest.companionCount > 0 && ` • مرافقين: +${activeQRModalGuest.companionCount}`}
              </p>
              {activeQRModalGuest.tableName && (
                <p className="text-saudi-gold-400 font-bold text-[11px]">
                  {activeQRModalGuest.tableName}
                </p>
              )}
            </div>

            <button
              onClick={() => setActiveQRModalGuest(null)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
            >
              إغلاق المعاينة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
