import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/server/auth';
import { api, HttpError } from '@/lib/server/http';
import { orderInclude, orderScope, visibleOrder } from '@/lib/server/commerce';
export const GET = api(async (_request, { params }: { params: { id: string } }) => {
  const user = await requireUser(); const id = params.id;
  const order = await prisma.multiVendorOrder.findFirst({ where: { AND: [orderScope(user), { OR: [{ id }, { orderNumber: id }, { suborders: { some: { OR: [{ id }, { bookingNumber: id }] } } }] }] }, include: orderInclude });
  if (!order) throw new HttpError(404, 'الطلب غير موجود');
  const vendorId = user.role === 'VENDOR' ? user.vendorProfile?.id : undefined;
  const masterOrder = visibleOrder(order, user);
  const events = await prisma.oMSOrderEvent.findMany({ where: { orderId: order.id, ...(vendorId ? { suborder: { vendorId } } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  return { success: true, masterOrder, events };
}, { allowDisabledFeature: true });
