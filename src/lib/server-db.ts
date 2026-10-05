// Server-side Database Service for Munasabati Marketplace
// Implements resilient hybrid fetching: uses PostgreSQL via Prisma when connected,
// and gracefully falls back to optimized in-memory seed data when offline.

import prisma from './db';
import { VENDORS, SERVICE_ITEMS, SAUDI_CITIES, SERVICE_CATEGORIES } from './seed-data';
import { ensureVendorDetails, ensureServiceDetails } from './utils';
import type { Vendor, ServiceItem, MultiVendorOrder } from './types';

export async function checkDatabaseHealth(): Promise<{ isConnected: boolean; message: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    if (!process.env.DATABASE_URL) {
      return { isConnected: false, message: 'DATABASE_URL not configured. Running on resilient Seed/Local store.' };
    }
    // Ping PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    return {
      isConnected: true,
      message: 'PostgreSQL connection healthy and verified.',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      isConnected: false,
      message: `Database connection unavailable: ${error?.message || 'Check credentials'}. Fallback active.`,
      latencyMs: Date.now() - start,
    };
  }
}

export async function getVendorsFromDB(options?: {
  categoryId?: string;
  cityId?: string;
  featuredOnly?: boolean;
}): Promise<Vendor[]> {
  try {
    if (process.env.DATABASE_URL) {
      const where: any = { status: 'ACTIVE' };
      if (options?.categoryId) where.categoryId = options.categoryId;
      if (options?.cityId) where.cityId = options.cityId;
      if (options?.featuredOnly) where.featured = true;

      const dbVendors = await prisma.vendor.findMany({
        where,
        include: {
          metrics: true,
          availability: true,
          services: {
            include: {
              packages: true,
              addons: true,
            },
          },
        },
      });

      if (dbVendors && dbVendors.length > 0) {
        return dbVendors.map((v: any) => ({
          id: v.id,
          businessName: v.businessName,
          businessNameEn: v.businessNameEn,
          categoryId: v.categoryId,
          categoryNameAr: v.category?.nameAr || 'خدمة مناسبات',
          logo: v.logo,
          bannerImage: v.bannerImage,
          rating: v.rating,
          reviewsCount: v.reviewsCount,
          completedBookingsCount: v.completedBookingsCount,
          verified: v.verified,
          crNumber: v.crNumber || undefined,
          vatNumber: v.vatNumber || undefined,
          cityId: v.cityId,
          cityNameAr: v.city?.nameAr || 'الرياض',
          neighborhood: v.neighborhood,
          serviceAreas: v.serviceAreas,
          startingPrice: v.startingPrice,
          instantBooking: v.instantBooking,
          responseTimeMinutes: v.responseTimeMinutes,
          badges: v.badges,
          bioAr: v.bioAr,
          portfolio: v.portfolio,
          contactPhone: v.contactPhone,
          whatsappNumber: v.whatsappNumber,
          cancellationPolicyAr: v.cancellationPolicyAr,
          status: v.status.toLowerCase() as any,
          featured: v.featured,
          specialtiesAr: v.specialtiesAr,
          metrics: v.metrics ? {
            averageRating: v.metrics.averageRating,
            reviewsCount: v.metrics.reviewsCount,
            completedOrders: v.metrics.completedOrders,
            cancelledOrders: v.metrics.cancelledOrders,
            repeatCustomerRate: v.metrics.repeatCustomerRate,
            responseTimeMinutes: v.metrics.responseTimeMinutes,
            acceptanceRate: v.metrics.acceptanceRate,
            onTimeRate: v.metrics.onTimeRate,
            satisfactionRate: v.metrics.satisfactionRate,
            yearsOfExperience: v.metrics.yearsOfExperience,
          } : undefined,
          availability: v.availability ? {
            workingDays: v.availability.workingDays,
            timeSlots: v.availability.timeSlots,
            capacityPerSlot: v.availability.capacityPerSlot,
            blackoutDates: v.availability.blackoutDates,
            minNoticeDays: v.availability.minNoticeDays,
            maxAdvanceDays: v.availability.maxAdvanceDays,
          } : undefined,
        }));
      }
    }
  } catch (e) {
    console.warn('PostgreSQL fetch fallback to memory store:', e);
  }

  // Resilient memory fallback
  let list = VENDORS.map(ensureVendorDetails);
  if (options?.categoryId) list = list.filter((v) => v.categoryId === options.categoryId);
  if (options?.cityId) list = list.filter((v) => v.cityId === options.cityId);
  if (options?.featuredOnly) list = list.filter((v) => v.featured);
  return list;
}

export async function getVendorByIdFromDB(id: string): Promise<Vendor | null> {
  try {
    if (process.env.DATABASE_URL) {
      const v = await prisma.vendor.findUnique({
        where: { id },
        include: {
          city: true,
          category: true,
          metrics: true,
          availability: true,
          services: {
            include: {
              packages: true,
              addons: true,
            },
          },
        },
      });
      if (v) {
        return ensureVendorDetails({
          ...v,
          crNumber: v.crNumber || undefined,
          freelanceLicense: v.freelanceLicense || undefined,
          vatNumber: v.vatNumber || undefined,
          genderSpecialty: (v.genderSpecialty as any) || undefined,
          cityNameAr: (v as any).city?.nameAr || 'الرياض',
          categoryNameAr: (v as any).category?.nameAr || 'خدمة مناسبات',
          status: v.status.toLowerCase() as any,
          metrics: v.metrics as any,
          availability: v.availability as any,
        });
      }
    }
  } catch (e) {
    console.warn('PostgreSQL single fetch fallback:', e);
  }

  const found = VENDORS.find((v) => v.id === id);
  return found ? ensureVendorDetails(found) : null;
}
