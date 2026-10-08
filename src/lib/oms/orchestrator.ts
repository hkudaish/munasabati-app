// Multi-Vendor Order Orchestrator
// Orchestrates multi-vendor cart split, suborder creation, master status aggregation,
// and partial fulfillment / refund state management.

import type { CartItem, VendorCartGroup } from '../types';
import type { OMSMasterOrder, OMSSuborder, OMSOrderStatus, PaymentStatus } from './types';

export function aggregateMasterOrderStatus(suborders: OMSSuborder[]): OMSOrderStatus {
  if (!suborders || suborders.length === 0) return 'CREATED';

  const statuses = suborders.map((s) => s.omsStatus);

  // If all closed/completed
  if (statuses.every((s) => s === 'CLOSED' || s === 'COMPLETED')) return 'COMPLETED';

  // If all cancelled/refunded
  if (statuses.every((s) => ['CANCELLED', 'REFUNDED', 'UNFULFILLABLE'].includes(s))) return 'CANCELLED';

  // If any disputed
  if (statuses.some((s) => s === 'DISPUTED')) return 'DISPUTED';

  // If any delayed
  if (statuses.some((s) => s === 'DELAYED' || s === 'AT_RISK')) return 'AT_RISK';

  // If any in progress or delivered
  if (statuses.some((s) => ['IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER_REVIEW'].includes(s))) {
    return 'IN_PROGRESS';
  }

  // If any awaiting acceptance or accepted
  if (statuses.some((s) => ['AWAITING_ACCEPTANCE', 'ACCEPTED'].includes(s))) {
    return 'AWAITING_ACCEPTANCE';
  }

  return 'PAYMENT_CONFIRMED';
}

export function buildMultiVendorMasterOrder(
  cartGroups: VendorCartGroup[],
  customerInfo: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    occasionId?: string;
    eventDate: string;
    eventTime?: string;
    cityId: string;
    cityNameAr: string;
    venueName?: string;
    paymentMethod: string;
    couponCode?: string;
    couponDiscount?: number;
  },
  acceptanceDeadlineMinutes: number = 120
): OMSMasterOrder {
  const orderNumber = `MN-${Math.floor(100000 + Math.random() * 900000)}`;
  const now = new Date().toISOString();
  const acceptanceDeadline = new Date(Date.now() + acceptanceDeadlineMinutes * 60 * 1000).toISOString();

  let totalSubtotal = 0;
  let totalTax = 0;
  let finalTotal = 0;
  let totalDeposit = 0;

  const suborders: OMSSuborder[] = cartGroups.map((group, idx) => {
    const bookingNumber = `BK-${orderNumber.split('-')[1]}-${idx + 1}`;
    const subtotal = group.subtotal;
    const taxAmount = group.taxAmount;
    const totalAmount = group.totalAmount;
    const depositAmount = Math.round(totalAmount * 0.3); // 30% deposit
    const remainingAmount = totalAmount - depositAmount;

    totalSubtotal += subtotal;
    totalTax += taxAmount;
    finalTotal += totalAmount;
    totalDeposit += depositAmount;

    return {
      id: `sub_${Date.now()}_${idx}`,
      orderId: '', // set after master ID created
      vendorId: group.vendorId,
      vendorName: group.vendorName,
      vendorLogo: group.vendorLogo,
      bookingNumber,
      subtotal,
      taxAmount,
      totalAmount,
      depositAmount,
      remainingAmount,
      omsStatus: 'AWAITING_ACCEPTANCE',
      paymentStatus: 'PAID',
      assignedRole: 'vendor',
      nextAction: 'VENDOR_ACCEPTANCE',
      nextActionDeadline: acceptanceDeadline,
      acceptanceDeadline,
      fulfillmentDeadline: new Date(new Date(customerInfo.eventDate).getTime() - 24 * 3600 * 1000).toISOString(),
      isAtRisk: false,
      isDelayed: false,
      slaExtensionDays: 0,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      items: group.items.map((item, itemIdx) => ({
        id: `item_${Date.now()}_${idx}_${itemIdx}`,
        suborderId: '',
        serviceId: item.serviceId,
        serviceTitleAr: item.serviceTitleAr,
        serviceImage: item.serviceImage,
        packageId: item.packageId,
        packageNameAr: item.packageNameAr,
        packagePrice: item.packagePrice,
        addons: item.addons || [],
        quantity: item.quantity,
        scheduledDate: item.scheduledDate || customerInfo.eventDate,
        scheduledTime: item.scheduledTime || customerInfo.eventTime,
        cityId: item.cityId || customerInfo.cityId,
        cityNameAr: item.cityNameAr || customerInfo.cityNameAr,
        venueAddress: item.venueAddress || customerInfo.venueName,
        notes: item.notes,
        basePrice: item.basePrice,
        addonsTotal: item.addonsTotal,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
      })),
    };
  });

  const discount = customerInfo.couponDiscount || 0;
  const netFinalTotal = Math.max(0, finalTotal - discount);

  const masterOrder: OMSMasterOrder = {
    id: `ord_${Date.now()}`,
    orderNumber,
    customerId: customerInfo.customerId,
    customerName: customerInfo.customerName,
    customerPhone: customerInfo.customerPhone,
    customerEmail: customerInfo.customerEmail,
    occasionId: customerInfo.occasionId,
    eventDate: customerInfo.eventDate,
    eventTime: customerInfo.eventTime,
    cityId: customerInfo.cityId,
    cityNameAr: customerInfo.cityNameAr,
    venueName: customerInfo.venueName,
    totalSubtotal,
    totalTax,
    couponDiscount: discount,
    couponCode: customerInfo.couponCode,
    finalTotal: netFinalTotal,
    totalDeposit,
    paymentMethod: customerInfo.paymentMethod,
    paymentStatus: 'PAID',
    isDepositOnly: true,
    omsStatus: 'AWAITING_ACCEPTANCE',
    createdAt: now,
    updatedAt: now,
    suborders: suborders.map((s) => ({
      ...s,
      orderId: `ord_${Date.now()}`,
    })),
  };

  return masterOrder;
}
