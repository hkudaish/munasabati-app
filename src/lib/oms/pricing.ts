// Pure pricing rules shared by the server and regression tests. Amounts are whole SAR.
export function priceSelection(service: any, selection: any) {
  const quantity = selection.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('الكمية غير صالحة');
  const packageId = selection.packageId || selection.selectedPackage?.id;
  const pack = packageId ? service.packages.find((p: any) => p.id === packageId) : undefined;
  if (packageId && !pack) throw new Error('الباقة غير متاحة لهذه الخدمة');
  if (service.priceType === 'STARTING_AT' && !pack) throw new Error('اختر باقة بسعر محدد قبل تقديم الطلب');
  const basePrice = pack?.price ?? service.price;
  const inputAddons = selection.addons ?? [];
  if (!Array.isArray(inputAddons) || inputAddons.length > 30) throw new Error('الإضافات غير صالحة');
  const seen = new Set();
  const addons = inputAddons.map((input: any) => {
    const addon = service.addons.find((a: any) => a.id === input.addonId && a.isAvailable);
    if (!addon || seen.has(addon.id)) throw new Error('الإضافة غير متاحة أو مكررة');
    seen.add(addon.id);
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > (addon.maxQuantity ?? 10000)) throw new Error('كمية الإضافة غير صالحة');
    return { addonId: addon.id, titleAr: addon.titleAr, price: addon.price, quantity: input.quantity };
  });
  const addonsTotal = addons.reduce((sum: number, a: any) => sum + a.price * a.quantity, 0);
  const subtotal = (basePrice + addonsTotal) * quantity;
  const taxAmount = Math.round(subtotal * 0.15);
  if (![basePrice, addonsTotal, subtotal, taxAmount, subtotal + taxAmount].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2_000_000_000)) throw new Error('قيمة الطلب تتجاوز الحد المسموح');
  return { packageId: pack?.id, packageNameAr: pack?.nameAr, packagePrice: basePrice, basePrice, addons, addonsTotal, quantity, subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

export function bookingInterval(date: string, time: string, hours: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('أدخل تاريخاً ووقتاً صالحين');
  const start = new Date(`${date}T${time}:00+03:00`);
  if (!Number.isFinite(start.getTime()) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('تاريخ غير صالح');
  return { start: start.getTime(), end: start.getTime() + hours * 3600000 };
}
export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) { return a.start < b.end && b.start < a.end; }
