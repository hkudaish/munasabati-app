'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Occasion,
  Guest,
  SeatingTable,
  BudgetItem,
  PlanningTask,
  WishlistGift,
  RFQRequest,
  Booking,
  Review,
  AdminPlatformConfig,
  OccasionType,
  ServiceCategory,
  SaudiCity,
  Vendor,
  ServiceItem,
  SmartPackage,
  InspirationPost,
  PaymentMethod,
  RunOfShowItem,
} from './types';
import {
  INITIAL_OCCASIONS,
  INITIAL_GUESTS,
  INITIAL_TABLES,
  INITIAL_BUDGET_ITEMS,
  INITIAL_TASKS,
  INITIAL_WISHLIST,
  INITIAL_RFQS,
  INITIAL_BOOKINGS,
  INITIAL_REVIEWS,
  INITIAL_ADMIN_CONFIG,
  INITIAL_RUN_OF_SHOW_ITEMS,
  OCCASION_TYPES,
  SERVICE_CATEGORIES,
  SAUDI_CITIES,
  VENDORS,
  SERVICE_ITEMS,
  SMART_PACKAGES,
  INSPIRATION_POSTS,
} from './seed-data';
import { generateBookingNumber, generateGuestQRCode } from './utils';

interface AppContextType {
  // Navigation & Role
  currentRole: 'client' | 'vendor' | 'admin';
  setCurrentRole: (role: 'client' | 'vendor' | 'admin') => void;
  selectedCity: string;
  setSelectedCity: (cityId: string) => void;
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;

  // Occasions
  occasions: Occasion[];
  activeOccasionId: string;
  activeOccasion: Occasion | undefined;
  setActiveOccasionId: (id: string) => void;
  createOccasion: (data: Partial<Occasion>) => string;
  updateOccasion: (id: string, data: Partial<Occasion>) => void;
  deleteOccasion: (id: string) => void;

  // Static/Config Data
  occasionTypes: OccasionType[];
  serviceCategories: ServiceCategory[];
  cities: SaudiCity[];
  vendors: Vendor[];
  services: ServiceItem[];
  packages: SmartPackage[];
  inspirationPosts: InspirationPost[];

  // Occasion Details & Management
  guests: Guest[];
  addGuest: (guest: Omit<Guest, 'id' | 'qrCode'>) => void;
  updateGuestStatus: (guestId: string, status: Guest['status']) => void;
  deleteGuest: (guestId: string) => void;

  tables: SeatingTable[];
  addTable: (table: Omit<SeatingTable, 'id'>) => void;
  assignGuestToTable: (guestId: string, tableId: string) => void;

  budgetItems: BudgetItem[];
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: string) => void;

  tasks: PlanningTask[];
  toggleTaskCompleted: (taskId: string) => void;
  addTask: (task: Omit<PlanningTask, 'id'>) => void;

  // Run of Show (Day-of Schedule)
  runOfShowItems: RunOfShowItem[];
  addRunOfShowItem: (item: Omit<RunOfShowItem, 'id'>) => void;
  updateRunOfShowItem: (id: string, data: Partial<RunOfShowItem>) => void;
  deleteRunOfShowItem: (id: string) => void;

  wishlistGifts: WishlistGift[];
  addWishlistGift: (gift: Omit<WishlistGift, 'id'>) => void;
  contributeToGift: (giftId: string, amount: number, contributorName: string) => void;

  // Marketplace & RFQ & Bookings
  rfqRequests: RFQRequest[];
  createRFQ: (rfq: Omit<RFQRequest, 'id' | 'quotes' | 'quotesCount' | 'createdAt'>) => string;
  acceptRFQQuote: (rfqId: string, quoteId: string) => void;

  bookings: Booking[];
  createBooking: (bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>) => string;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  payBookingDeposit: (bookingId: string, method: PaymentMethod) => void;
  payRemainingBooking: (bookingId: string, method: PaymentMethod) => void;

  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date'>) => void;
  toggleReviewFeatured: (reviewId: string) => void;
  updateReviewStatus: (reviewId: string, status: Review['status']) => void;
  deleteReview: (reviewId: string) => void;
  replyToReview: (reviewId: string, reply: string) => void;

  // Full Admin & Catalog Management Actions
  addVendor: (vendor: Omit<Vendor, 'id'>) => string;
  updateVendor: (id: string, data: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  updateVendorStatus: (vendorId: string, status: Vendor['status'], verified: boolean) => void;

  addService: (service: Omit<ServiceItem, 'id'>) => string;
  updateService: (id: string, data: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;

  addPackage: (pkg: Omit<SmartPackage, 'id'>) => string;
  updatePackage: (id: string, data: Partial<SmartPackage>) => void;
  deletePackage: (id: string) => void;

  releaseEscrowPayout: (bookingId: string) => void;
  refundBooking: (bookingId: string) => void;
  toggleCityAvailability: (cityId: string) => void;

  // Admin Config
  adminConfig: AdminPlatformConfig;
  updateAdminConfig: (config: Partial<AdminPlatformConfig>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'munasabati_state_v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<'client' | 'vendor' | 'admin'>('client');
  const [selectedCity, setSelectedCity] = useState<string>('riyadh');
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);

  const [occasions, setOccasions] = useState<Occasion[]>(INITIAL_OCCASIONS);
  const [activeOccasionId, setActiveOccasionId] = useState<string>('occ-101');

  const [occasionTypes, setOccasionTypes] = useState<OccasionType[]>(OCCASION_TYPES);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(SERVICE_CATEGORIES);
  const [cities, setCities] = useState<SaudiCity[]>(SAUDI_CITIES);
  const [vendors, setVendors] = useState<Vendor[]>(VENDORS);
  const [services, setServices] = useState<ServiceItem[]>(SERVICE_ITEMS);
  const [packages, setPackages] = useState<SmartPackage[]>(SMART_PACKAGES);
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>(INSPIRATION_POSTS);

  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [tables, setTables] = useState<SeatingTable[]>(INITIAL_TABLES);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(INITIAL_BUDGET_ITEMS);
  const [tasks, setTasks] = useState<PlanningTask[]>(INITIAL_TASKS);
  const [runOfShowItems, setRunOfShowItems] = useState<RunOfShowItem[]>(INITIAL_RUN_OF_SHOW_ITEMS);
  const [wishlistGifts, setWishlistGifts] = useState<WishlistGift[]>(INITIAL_WISHLIST);
  const [rfqRequests, setRfqRequests] = useState<RFQRequest[]>(INITIAL_RFQS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [adminConfig, setAdminConfig] = useState<AdminPlatformConfig>(INITIAL_ADMIN_CONFIG);

  // Load from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.occasions) setOccasions(parsed.occasions);
        if (parsed.activeOccasionId) setActiveOccasionId(parsed.activeOccasionId);
        if (parsed.guests) setGuests(parsed.guests);
        if (parsed.budgetItems) setBudgetItems(parsed.budgetItems);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.runOfShowItems) setRunOfShowItems(parsed.runOfShowItems);
        if (parsed.bookings) setBookings(parsed.bookings);
        if (parsed.rfqRequests) setRfqRequests(parsed.rfqRequests);
        if (parsed.adminConfig) setAdminConfig(parsed.adminConfig);
        if (parsed.vendors) setVendors(parsed.vendors);
        if (parsed.services) setServices(parsed.services);
        if (parsed.packages) setPackages(parsed.packages);
        if (parsed.reviews) setReviews(parsed.reviews);
        if (parsed.cities) setCities(parsed.cities);
      }
    } catch (e) {
      console.warn('Failed to parse local storage', e);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          occasions,
          activeOccasionId,
          guests,
          budgetItems,
          tasks,
          runOfShowItems,
          bookings,
          rfqRequests,
          adminConfig,
          vendors,
          services,
          packages,
          reviews,
          cities,
        })
      );
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
  }, [occasions, activeOccasionId, guests, budgetItems, tasks, runOfShowItems, bookings, rfqRequests, adminConfig, vendors, services, packages, reviews, cities]);

  const activeOccasion = occasions.find((o) => o.id === activeOccasionId) || occasions[0];

  const createOccasion = (data: Partial<Occasion>): string => {
    const newId = `occ-${Date.now().toString().slice(-4)}`;
    const occasionTypeObj = occasionTypes.find((t) => t.id === data.occasionTypeId);
    const cityObj = cities.find((c) => c.id === data.cityId);

    const newOccasion: Occasion = {
      id: newId,
      title: data.title || `مناسبة ${occasionTypeObj?.nameAr || 'جديدة'}`,
      occasionTypeId: data.occasionTypeId || 'graduation',
      occasionTypeNameAr: occasionTypeObj?.nameAr || 'تخرج',
      cityId: data.cityId || 'riyadh',
      cityNameAr: cityObj?.nameAr || 'الرياض',
      neighborhood: data.neighborhood || 'الملقا',
      date: data.date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: data.time || '08:00 م',
      isApproximateDate: !!data.isApproximateDate,
      guestCount: data.guestCount || 50,
      guestsSection: data.guestsSection || 'women',
      venueType: data.venueType || 'home',
      venueName: data.venueName || '',
      budget: data.budget || 15000,
      spent: 0,
      tier: data.tier || 'medium',
      readinessPercentage: 20,
      status: 'planning',
      createdAt: new Date().toISOString(),
      notes: data.notes || '',
    };

    setOccasions((prev) => [newOccasion, ...prev]);
    setActiveOccasionId(newId);

    // Auto generate default tasks based on occasion type checklist
    if (occasionTypeObj?.defaultChecklist) {
      const generatedTasks: PlanningTask[] = occasionTypeObj.defaultChecklist.map((item, idx) => {
        const dueDate = new Date(Date.now() + (30 - item.daysBefore) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        return {
          id: `tsk-${newId}-${idx + 1}`,
          occasionId: newId,
          title: item.title,
          category: item.category,
          dueDaysBefore: item.daysBefore,
          dueDate: dueDate,
          isCompleted: false,
          priority: item.daysBefore >= 20 ? 'high' : 'medium',
        };
      });
      setTasks((prev) => [...generatedTasks, ...prev]);
    }

    // Auto generate estimated budget allocations
    const totalBudget = newOccasion.budget;
    const defaultAllocations: BudgetItem[] = [
      {
        id: `bgt-${newId}-1`,
        occasionId: newId,
        categoryId: 'decor',
        categoryNameAr: 'الكوشة والديكور وتنسيق الورد',
        allocatedAmount: Math.round(totalBudget * 0.35),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-2`,
        occasionId: newId,
        categoryId: 'hospitality',
        categoryNameAr: 'الضيافة السعودية والبوفيه والمشروبات',
        allocatedAmount: Math.round(totalBudget * 0.30),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-3`,
        occasionId: newId,
        categoryId: 'photography',
        categoryNameAr: 'التصوير وتوثيق المناسبة والفيديو',
        allocatedAmount: Math.round(totalBudget * 0.18),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-4`,
        occasionId: newId,
        categoryId: 'giveaways',
        categoryNameAr: 'التوزيعات والهدايا التذكارية',
        allocatedAmount: Math.round(totalBudget * 0.12),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-5`,
        occasionId: newId,
        categoryId: 'invitations',
        categoryNameAr: 'الدعوات والبطاقات الرقمية',
        allocatedAmount: Math.round(totalBudget * 0.05),
        spentAmount: 0,
        status: 'estimated',
      },
    ];
    setBudgetItems((prev) => [...defaultAllocations, ...prev]);

    return newId;
  };

  const updateOccasion = (id: string, data: Partial<Occasion>) => {
    setOccasions((prev) =>
      prev.map((occ) => {
        if (occ.id === id) {
          return { ...occ, ...data };
        }
        return occ;
      })
    );
  };

  const deleteOccasion = (id: string) => {
    setOccasions((prev) => prev.filter((o) => o.id !== id));
    if (activeOccasionId === id) {
      const remaining = occasions.filter((o) => o.id !== id);
      if (remaining.length > 0) {
        setActiveOccasionId(remaining[0].id);
      }
    }
  };

  const addGuest = (guestData: Omit<Guest, 'id' | 'qrCode'>) => {
    const id = `gst-${Date.now().toString().slice(-5)}`;
    const qrCode = generateGuestQRCode(id, guestData.occasionId);
    const newGuest: Guest = {
      ...guestData,
      id,
      qrCode,
      invitationSentAt: new Date().toISOString(),
    };
    setGuests((prev) => [newGuest, ...prev]);
  };

  const updateGuestStatus = (guestId: string, status: Guest['status']) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.id === guestId) {
          return {
            ...g,
            status,
            rsvpTime: new Date().toISOString(),
          };
        }
        return g;
      })
    );
  };

  const deleteGuest = (guestId: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  };

  const addTable = (tableData: Omit<SeatingTable, 'id'>) => {
    const id = `tbl-${Date.now().toString().slice(-4)}`;
    setTables((prev) => [...prev, { ...tableData, id }]);
  };

  const assignGuestToTable = (guestId: string, tableId: string) => {
    const tableObj = tables.find((t) => t.id === tableId);
    setGuests((prev) =>
      prev.map((g) => {
        if (g.id === guestId) {
          return { ...g, tableId, tableName: tableObj?.name };
        }
        return g;
      })
    );
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          if (!t.assignedGuestIds.includes(guestId)) {
            return { ...t, assignedGuestIds: [...t.assignedGuestIds, guestId] };
          }
        } else {
          return { ...t, assignedGuestIds: t.assignedGuestIds.filter((id) => id !== guestId) };
        }
        return t;
      })
    );
  };

  const addBudgetItem = (itemData: Omit<BudgetItem, 'id'>) => {
    const id = `bgt-${Date.now().toString().slice(-4)}`;
    setBudgetItems((prev) => [...prev, { ...itemData, id }]);
  };

  const updateBudgetItem = (id: string, itemData: Partial<BudgetItem>) => {
    setBudgetItems((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          return { ...b, ...itemData };
        }
        return b;
      })
    );
  };

  const deleteBudgetItem = (id: string) => {
    setBudgetItems((prev) => prev.filter((b) => b.id !== id));
  };

  const toggleTaskCompleted = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, isCompleted: !t.isCompleted };
        }
        return t;
      })
    );
  };

  const addTask = (taskData: Omit<PlanningTask, 'id'>) => {
    const id = `tsk-${Date.now().toString().slice(-4)}`;
    setTasks((prev) => [
      {
        ...taskData,
        id,
      },
      ...prev,
    ]);
  };

  const addWishlistGift = (giftData: Omit<WishlistGift, 'id'>) => {
    const id = `wsh-${Date.now().toString().slice(-4)}`;
    setWishlistGifts((prev) => [
      ...prev,
      {
        ...giftData,
        id,
      },
    ]);
  };

  const contributeToGift = (giftId: string, amount: number, contributorName: string) => {
    setWishlistGifts((prev) =>
      prev.map((w) => {
        if (w.id === giftId) {
          const newContributed = w.contributedAmount + amount;
          const isFulfilled = newContributed >= w.price;
          return {
            ...w,
            contributedAmount: newContributed,
            isFulfilled,
            giftedBy: isFulfilled ? contributorName : w.giftedBy,
          };
        }
        return w;
      })
    );
  };

  const createRFQ = (rfqData: Omit<RFQRequest, 'id' | 'quotes' | 'quotesCount' | 'createdAt'>): string => {
    const id = `rfq-${Date.now().toString().slice(-4)}`;
    const newRFQ: RFQRequest = {
      ...rfqData,
      id,
      quotesCount: 0,
      quotes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setRfqRequests((prev) => [newRFQ, ...prev]);
    return id;
  };

  const acceptRFQQuote = (rfqId: string, quoteId: string) => {
    setRfqRequests((prev) =>
      prev.map((rfq) => {
        if (rfq.id === rfqId) {
          const updatedQuotes = rfq.quotes.map((q) => {
            if (q.id === quoteId) return { ...q, status: 'accepted' as const };
            return { ...q, status: 'declined' as const };
          });
          return { ...rfq, quotes: updatedQuotes, status: 'awarded' as const };
        }
        return rfq;
      })
    );
  };

  const createBooking = (bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>): string => {
    const id = `bok-${Date.now().toString().slice(-4)}`;
    const bookingNumber = generateBookingNumber();
    const newBooking: Booking = {
      ...bookingData,
      id,
      bookingNumber,
      createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [newBooking, ...prev]);
    return id;
  };

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return { ...b, status };
        }
        return b;
      })
    );
  };

  const payBookingDeposit = (bookingId: string, method: PaymentMethod) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            depositPaid: true,
            paymentMethod: method,
            status: 'confirmed',
          };
        }
        return b;
      })
    );
  };

  const addRunOfShowItem = (itemData: Omit<RunOfShowItem, 'id'>) => {
    const id = `ros-${Date.now().toString().slice(-4)}`;
    const newItem: RunOfShowItem = {
      ...itemData,
      id,
    };
    setRunOfShowItems((prev) => [...prev, newItem].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const updateRunOfShowItem = (id: string, data: Partial<RunOfShowItem>) => {
    setRunOfShowItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, ...data } : item))
        .sort((a, b) => a.time.localeCompare(b.time))
    );
  };

  const deleteRunOfShowItem = (id: string) => {
    setRunOfShowItems((prev) => prev.filter((item) => item.id !== id));
  };

  const payRemainingBooking = (bookingId: string, method: PaymentMethod) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            isFullyPaid: true,
            remainingAmount: 0,
            paymentMethod: method,
            status: 'completed',
          };
        }
        return b;
      })
    );
  };

  const addReview = (reviewData: Omit<Review, 'id' | 'date'>) => {
    const id = `rev-${Date.now().toString().slice(-4)}`;
    const newReview: Review = {
      ...reviewData,
      id,
      date: new Date().toISOString().split('T')[0],
      status: reviewData.status || 'approved',
    };
    setReviews((prev) => [newReview, ...prev]);
  };

  const toggleReviewFeatured = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, featured: !r.featured } : r))
    );
  };

  const updateReviewStatus = (reviewId: string, status: Review['status']) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, status } : r))
    );
  };

  const deleteReview = (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  const replyToReview = (reviewId: string, reply: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, vendorReplyAr: reply } : r))
    );
  };

  // Vendor management actions
  const addVendor = (vendorData: Omit<Vendor, 'id'>): string => {
    const id = `vendor-${Date.now().toString().slice(-4)}`;
    const newVendor: Vendor = {
      ...vendorData,
      id,
    };
    setVendors((prev) => [newVendor, ...prev]);
    return id;
  };

  const updateVendor = (id: string, data: Partial<Vendor>) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...data } : v))
    );
  };

  const deleteVendor = (id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const updateVendorStatus = (vendorId: string, status: Vendor['status'], verified: boolean) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id === vendorId) {
          return { ...v, status, verified };
        }
        return v;
      })
    );
  };

  // Service management actions
  const addService = (serviceData: Omit<ServiceItem, 'id'>): string => {
    const id = `srv-${Date.now().toString().slice(-4)}`;
    const newService: ServiceItem = {
      ...serviceData,
      id,
    };
    setServices((prev) => [newService, ...prev]);
    return id;
  };

  const updateService = (id: string, data: Partial<ServiceItem>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  };

  const deleteService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Package management actions
  const addPackage = (pkgData: Omit<SmartPackage, 'id'>): string => {
    const id = `pkg-${Date.now().toString().slice(-4)}`;
    const newPkg: SmartPackage = {
      ...pkgData,
      id,
    };
    setPackages((prev) => [newPkg, ...prev]);
    return id;
  };

  const updatePackage = (id: string, data: Partial<SmartPackage>) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const deletePackage = (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  // Escrow and bookings actions
  const releaseEscrowPayout = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            payoutReleased: true,
            payoutRef: `SARIE-${Date.now().toString().slice(-6)}`,
            status: 'completed',
          };
        }
        return b;
      })
    );
  };

  const refundBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            status: 'cancelled',
          };
        }
        return b;
      })
    );
  };

  // City management actions
  const toggleCityAvailability = (cityId: string) => {
    setCities((prev) =>
      prev.map((c) => (c.id === cityId ? { ...c, isAvailable: !c.isAvailable } : c))
    );
  };

  const updateAdminConfig = (configData: Partial<AdminPlatformConfig>) => {
    setAdminConfig((prev) => ({ ...prev, ...configData }));
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        selectedCity,
        setSelectedCity,
        isAIOpen,
        setIsAIOpen,

        occasions,
        activeOccasionId,
        activeOccasion,
        setActiveOccasionId,
        createOccasion,
        updateOccasion,
        deleteOccasion,

        occasionTypes,
        serviceCategories,
        cities,
        vendors,
        services,
        packages,
        inspirationPosts,

        guests,
        addGuest,
        updateGuestStatus,
        deleteGuest,

        tables,
        addTable,
        assignGuestToTable,

        budgetItems,
        addBudgetItem,
        updateBudgetItem,
        deleteBudgetItem,

        tasks,
        toggleTaskCompleted,
        addTask,

        runOfShowItems,
        addRunOfShowItem,
        updateRunOfShowItem,
        deleteRunOfShowItem,

        wishlistGifts,
        addWishlistGift,
        contributeToGift,

        rfqRequests,
        createRFQ,
        acceptRFQQuote,

        bookings,
        createBooking,
        updateBookingStatus,
        payBookingDeposit,
        payRemainingBooking,

        reviews,
        addReview,
        toggleReviewFeatured,
        updateReviewStatus,
        deleteReview,
        replyToReview,

        addVendor,
        updateVendor,
        deleteVendor,
        updateVendorStatus,

        addService,
        updateService,
        deleteService,

        addPackage,
        updatePackage,
        deletePackage,

        releaseEscrowPayout,
        refundBooking,
        toggleCityAvailability,

        adminConfig,
        updateAdminConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
