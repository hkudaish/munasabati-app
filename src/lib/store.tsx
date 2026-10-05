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
  EaniyahGift,
  CartItem,
  VendorCartGroup,
  Coupon,
  MultiVendorOrder,
  RankingWeights,
  VendorRecommendationResult,
  ServicePackage,
  CartItemAddon,
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
  INITIAL_EANIYAH_GIFTS,
  INITIAL_COUPONS,
} from './seed-data';
import { 
  generateBookingNumber, 
  generateOrderNumber,
  generateGuestQRCode,
  calculateCartTotals,
  ensureServiceDetails,
  ensureVendorDetails,
} from './utils';
import { DEFAULT_RANKING_WEIGHTS } from './ranking-engine';

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

  // Digital Eaniyah & Cash Gifting
  eaniyahGifts: EaniyahGift[];
  sendEaniyahGift: (gift: Omit<EaniyahGift, 'id' | 'createdAt' | 'status' | 'transactionRef'>) => EaniyahGift;
  transferEaniyahPayout: (occasionId: string, iban: string, bankName: string) => void;

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

  // Shopping Cart & Multi-Vendor Commerce
  cart: CartItem[];
  savedForLater: CartItem[];
  appliedCoupon: Coupon | null;
  coupons: Coupon[];
  addToCart: (
    serviceOrItem: any,
    selectedPackage?: any,
    selectedAddons?: any[],
    config?: any
  ) => void;
  updateCartItemQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  saveItemForLater: (id: string) => void;
  moveToCartFromSaved: (id: string) => void;
  applyCouponCode: (code: string) => { success: boolean; messageAr: string };
  removeCoupon: () => void;
  cartTotals: {
    subtotal: number;
    discount: number;
    taxableAmount: number;
    tax: number;
    total: number;
    depositAmount: number;
    remainingAmount: number;
  };
  vendorCartGroups: VendorCartGroup[];

  // Orders
  multiVendorOrders: MultiVendorOrder[];
  checkoutCart: (checkoutData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    eventDate?: string;
    scheduleDate?: string;
    eventTime?: string;
    scheduleTime?: string;
    cityId?: string;
    cityNameAr?: string;
    locationCity?: string;
    venueName?: string;
    locationAddress?: string;
    occasionId?: string;
    paymentMethod: PaymentMethod;
    isDepositOnly: boolean;
  }) => MultiVendorOrder;

  // Favorites & Comparison
  favoriteVendorIds: string[];
  favoriteServiceIds: string[];
  toggleFavoriteVendor: (vendorId: string) => void;
  toggleFavoriteService: (serviceId: string) => void;
  comparisonVendorIds: string[];
  addToComparison: (vendorId: string) => boolean;
  removeFromComparison: (vendorId: string) => void;
  clearComparison: () => void;

  // Ranking weights
  rankingWeights: RankingWeights;
  updateRankingWeights: (weights: Partial<RankingWeights>) => void;
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
  const [vendors, setVendors] = useState<Vendor[]>(() => VENDORS.map(ensureVendorDetails));
  const [services, setServices] = useState<ServiceItem[]>(() => SERVICE_ITEMS.map(ensureServiceDetails));
  const [packages, setPackages] = useState<SmartPackage[]>(SMART_PACKAGES);
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>(INSPIRATION_POSTS);

  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [tables, setTables] = useState<SeatingTable[]>(INITIAL_TABLES);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(INITIAL_BUDGET_ITEMS);
  const [tasks, setTasks] = useState<PlanningTask[]>(INITIAL_TASKS);
  const [runOfShowItems, setRunOfShowItems] = useState<RunOfShowItem[]>(INITIAL_RUN_OF_SHOW_ITEMS);
  const [wishlistGifts, setWishlistGifts] = useState<WishlistGift[]>(INITIAL_WISHLIST);
  const [eaniyahGifts, setEaniyahGifts] = useState<EaniyahGift[]>(INITIAL_EANIYAH_GIFTS);
  const [rfqRequests, setRfqRequests] = useState<RFQRequest[]>(INITIAL_RFQS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [adminConfig, setAdminConfig] = useState<AdminPlatformConfig>(INITIAL_ADMIN_CONFIG);

  // Commerce & Marketplace State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [multiVendorOrders, setMultiVendorOrders] = useState<MultiVendorOrder[]>([]);
  const [favoriteVendorIds, setFavoriteVendorIds] = useState<string[]>(['vendor-1', 'vendor-3']);
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>(['srv-1']);
  const [comparisonVendorIds, setComparisonVendorIds] = useState<string[]>([]);
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(
    INITIAL_ADMIN_CONFIG.rankingWeights || DEFAULT_RANKING_WEIGHTS
  );

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
        if (parsed.eaniyahGifts) setEaniyahGifts(parsed.eaniyahGifts);
        if (parsed.bookings) setBookings(parsed.bookings);
        if (parsed.rfqRequests) setRfqRequests(parsed.rfqRequests);
        if (parsed.adminConfig) setAdminConfig(parsed.adminConfig);
        if (parsed.vendors) setVendors(parsed.vendors.map(ensureVendorDetails));
        if (parsed.services) setServices(parsed.services.map(ensureServiceDetails));
        if (parsed.packages) setPackages(parsed.packages);
        if (parsed.reviews) setReviews(parsed.reviews);
        if (parsed.cities) setCities(parsed.cities);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.savedForLater) setSavedForLater(parsed.savedForLater);
        if (parsed.appliedCoupon) setAppliedCoupon(parsed.appliedCoupon);
        if (parsed.multiVendorOrders) setMultiVendorOrders(parsed.multiVendorOrders);
        if (parsed.favoriteVendorIds) setFavoriteVendorIds(parsed.favoriteVendorIds);
        if (parsed.favoriteServiceIds) setFavoriteServiceIds(parsed.favoriteServiceIds);
        if (parsed.comparisonVendorIds) setComparisonVendorIds(parsed.comparisonVendorIds);
        if (parsed.rankingWeights) setRankingWeights(parsed.rankingWeights);
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
          eaniyahGifts,
          bookings,
          rfqRequests,
          adminConfig,
          vendors,
          services,
          packages,
          reviews,
          cities,
          cart,
          savedForLater,
          appliedCoupon,
          multiVendorOrders,
          favoriteVendorIds,
          favoriteServiceIds,
          comparisonVendorIds,
          rankingWeights,
        })
      );
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
  }, [
    occasions,
    activeOccasionId,
    guests,
    budgetItems,
    tasks,
    runOfShowItems,
    eaniyahGifts,
    bookings,
    rfqRequests,
    adminConfig,
    vendors,
    services,
    packages,
    reviews,
    cities,
    cart,
    savedForLater,
    appliedCoupon,
    multiVendorOrders,
    favoriteVendorIds,
    favoriteServiceIds,
    comparisonVendorIds,
    rankingWeights,
  ]);

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

  const sendEaniyahGift = (
    giftData: Omit<EaniyahGift, 'id' | 'createdAt' | 'status' | 'transactionRef'>
  ): EaniyahGift => {
    const id = `ean-${Date.now().toString().slice(-6)}`;
    const transactionRef = `EAN-SA-${Math.floor(100000 + Math.random() * 900000)}`;
    const newGift: EaniyahGift = {
      ...giftData,
      id,
      status: 'completed',
      createdAt: new Date().toISOString(),
      transactionRef,
    };
    setEaniyahGifts((prev) => [newGift, ...prev]);
    return newGift;
  };

  const transferEaniyahPayout = (occasionId: string, iban: string, bankName: string) => {
    setEaniyahGifts((prev) =>
      prev.map((g) => (g.occasionId === occasionId ? { ...g, status: 'transferred' as const } : g))
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

  // Group cart items by vendor
  const vendorCartGroups: VendorCartGroup[] = React.useMemo(() => {
    const groups: Record<string, VendorCartGroup> = {};
    cart.forEach((item) => {
      if (!groups[item.vendorId]) {
        groups[item.vendorId] = {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          vendorLogo: item.vendorLogo,
          cityId: item.cityId,
          cityNameAr: item.cityNameAr,
          items: [],
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        };
      }
      groups[item.vendorId].items.push(item);
      groups[item.vendorId].subtotal += item.subtotal;
      groups[item.vendorId].taxAmount += item.taxAmount;
      groups[item.vendorId].totalAmount += item.totalAmount;
    });
    return Object.values(groups);
  }, [cart]);

  const cartTotals = React.useMemo(() => {
    return calculateCartTotals(
      cart,
      appliedCoupon,
      adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15
    );
  }, [cart, appliedCoupon, adminConfig.vatPercent]);

  const addToCart = (
    serviceOrItem: any,
    selectedPackage?: any,
    selectedAddons?: any[],
    config?: any
  ) => {
    let itemData: Omit<CartItem, 'id' | 'subtotal' | 'taxAmount' | 'totalAmount' | 'addonsTotal'>;

    // Check if called with (service, package, addons, config)
    if (selectedPackage !== undefined || selectedAddons !== undefined || config !== undefined) {
      const service: ServiceItem = serviceOrItem;
      const pkg: ServicePackage = selectedPackage || {
        id: `${service.id}-pkg-default`,
        nameAr: 'الباقة القياسية',
        tier: 'standard',
        price: service.price,
        durationHours: 4,
        featuresAr: service.featuresAr || [],
      };
      const addonsList: CartItemAddon[] = (selectedAddons || []).map((a: any) => ({
        addonId: a.id || a.addonId || `add-${Date.now()}`,
        titleAr: a.titleAr || a.nameAr || 'إضافة',
        price: a.price || 0,
        quantity: a.quantity || 1,
      }));
      const cfg = config || {};
      const vendor = vendors.find((v) => v.id === service.vendorId);
      const vName = (vendor as any)?.businessName || service.vendorName || 'مورد المناسبات';
      const vLogo = (vendor as any)?.logo || service.vendorLogo || '/images/default-vendor.jpg';
      const sImage = (service.images && service.images[0]) || (service as any)?.imageUrl || '/images/service-fallback.jpg';

      itemData = {
        vendorId: service.vendorId,
        vendorName: vName,
        vendorLogo: vLogo,
        serviceId: service.id,
        serviceTitleAr: service.titleAr,
        serviceImage: sImage,
        packageId: pkg.id,
        packageNameAr: pkg.nameAr,
        selectedPackage: pkg,
        packagePrice: pkg.price,
        addons: addonsList,
        selectedAddons: addonsList,
        quantity: cfg.quantity || 1,
        scheduledDate: cfg.scheduledDate || cfg.date || '2026-10-09',
        scheduleDate: cfg.scheduledDate || cfg.date || '2026-10-09',
        scheduledTime: cfg.scheduledTime || cfg.time || '18:00',
        scheduleTime: cfg.scheduledTime || cfg.time || '18:00',
        cityId: cfg.cityId || service.cityId || 'ruh',
        cityNameAr: cfg.cityNameAr || cfg.locationCity || service.cityNameAr || 'الرياض',
        venueAddress: cfg.venueAddress || cfg.locationAddress || '',
        notes: cfg.notes || '',
        basePrice: pkg.price,
        totalPrice: pkg.price,
      };
    } else {
      // Called with single CartItem data object
      itemData = serviceOrItem;
    }

    const addonsTotal = (itemData.addons || []).reduce(
      (sum, a) => sum + (a.price || 0) * (a.quantity || 1),
      0
    );
    const itemSubtotal = ((itemData.basePrice || itemData.packagePrice || 0) + addonsTotal) * (itemData.quantity || 1);
    const vatRate = adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15;
    const itemTax = Math.round(itemSubtotal * vatRate);
    const itemTotal = itemSubtotal + itemTax;

    const targetDate = itemData.scheduledDate || itemData.scheduleDate || '2026-10-09';
    const targetPkgId = itemData.packageId || (itemData.selectedPackage ? itemData.selectedPackage.id : 'pkg-default');

    const existingIndex = cart.findIndex(
      (c) =>
        c.serviceId === itemData.serviceId &&
        (c.packageId === targetPkgId || c.selectedPackage?.id === targetPkgId) &&
        (c.scheduledDate === targetDate || c.scheduleDate === targetDate)
    );

    if (existingIndex > -1) {
      setCart((prev) =>
        prev.map((c, idx) => {
          if (idx === existingIndex) {
            const newQty = c.quantity + (itemData.quantity || 1);
            const newSubtotal = (c.basePrice + c.addonsTotal) * newQty;
            const newTax = Math.round(newSubtotal * vatRate);
            return {
              ...c,
              quantity: newQty,
              subtotal: newSubtotal,
              taxAmount: newTax,
              totalAmount: newSubtotal + newTax,
              totalPrice: newSubtotal + newTax,
            };
          }
          return c;
        })
      );
    } else {
      const id = `cart-${Date.now().toString().slice(-6)}`;
      const newItem: CartItem = {
        ...itemData,
        id,
        addonsTotal,
        subtotal: itemSubtotal,
        taxAmount: itemTax,
        totalAmount: itemTotal,
        totalPrice: itemTotal,
        scheduledDate: targetDate,
        scheduleDate: targetDate,
      };
      setCart((prev) => [newItem, ...prev]);
    }
  };

  const updateCartItemQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null;
            const vatRate = adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15;
            const newSub = (it.basePrice + it.addonsTotal) * newQty;
            const newTax = Math.round(newSub * vatRate);
            return {
              ...it,
              quantity: newQty,
              subtotal: newSub,
              taxAmount: newTax,
              totalAmount: newSub + newTax,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((it) => it.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const saveItemForLater = (id: string) => {
    const item = cart.find((it) => it.id === id);
    if (!item) return;
    setCart((prev) => prev.filter((it) => it.id !== id));
    setSavedForLater((prev) => [item, ...prev]);
  };

  const moveToCartFromSaved = (id: string) => {
    const item = savedForLater.find((it) => it.id === id);
    if (!item) return;
    setSavedForLater((prev) => prev.filter((it) => it.id !== id));
    setCart((prev) => [item, ...prev]);
  };

  const applyCouponCode = (code: string): { success: boolean; messageAr: string } => {
    const clean = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === clean);
    if (!found) {
      return { success: false, messageAr: 'كوبون الخصم غير صحيح أو منتهي الصلاحية.' };
    }
    const currentSubtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
    if (currentSubtotal < found.minOrderAmount) {
      return {
        success: false,
        messageAr: `الحد الأدنى لتفعيل هذا الكوبون هو ${found.minOrderAmount} ر.س. أضف المزيد للسلة.`,
      };
    }
    setAppliedCoupon(found);
    return { success: true, messageAr: `تم تفعيل كود الخصم: ${found.descriptionAr} بنجاح! 🎉` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const checkoutCart = (checkoutData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    eventDate?: string;
    scheduleDate?: string;
    eventTime?: string;
    scheduleTime?: string;
    cityId?: string;
    cityNameAr?: string;
    locationCity?: string;
    venueName?: string;
    locationAddress?: string;
    occasionId?: string;
    paymentMethod: PaymentMethod;
    isDepositOnly: boolean;
  }): MultiVendorOrder => {
    const orderId = `ord-${Date.now().toString().slice(-6)}`;
    const orderNumber = generateOrderNumber();

    const evDate = checkoutData.eventDate || checkoutData.scheduleDate || '2026-10-09';
    const evTime = checkoutData.eventTime || checkoutData.scheduleTime || '07:00 م';
    const cCity = checkoutData.cityNameAr || checkoutData.locationCity || 'الرياض';
    const cCityId = checkoutData.cityId || 'ruh';
    const vName = checkoutData.venueName || checkoutData.locationAddress || 'قاعة المناسبة';
    const occId = checkoutData.occasionId || activeOccasionId;

    // Group items by vendor into suborders
    const groups: Record<string, CartItem[]> = {};
    cart.forEach((it) => {
      if (!groups[it.vendorId]) groups[it.vendorId] = [];
      groups[it.vendorId].push(it);
    });

    const vatRate = adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15;
    const suborders = Object.entries(groups).map(([vendorId, items], idx) => {
      const vSubtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
      const vTax = Math.round(vSubtotal * vatRate);
      const vTotal = vSubtotal + vTax;
      const vDeposit = Math.round(vTotal * 0.3);
      const vBookingNumber = generateBookingNumber();

      // Create Booking in store for vendor dashboard and user tracking
      const firstItem = items[0];
      const newBooking: Booking = {
        id: `bok-${Date.now().toString().slice(-4)}-${idx}`,
        bookingNumber: vBookingNumber,
        occasionId: occId,
        occasionTitle: activeOccasion?.title || 'مناسبة خاصة',
        vendorId,
        vendorName: firstItem.vendorName,
        vendorLogo: firstItem.vendorLogo,
        serviceId: firstItem.serviceId,
        serviceTitleAr: items.map((it) => it.serviceTitleAr).join(' + '),
        date: evDate || firstItem.scheduledDate || firstItem.scheduleDate || '2026-10-09',
        time: evTime || firstItem.scheduledTime || firstItem.scheduleTime || '07:00 م',
        cityAr: cCity || firstItem.cityNameAr || 'الرياض',
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
        customerEmail: checkoutData.customerEmail,
        totalAmount: vTotal,
        depositAmount: vDeposit,
        remainingAmount: checkoutData.isDepositOnly ? vTotal - vDeposit : 0,
        depositPaid: true,
        isFullyPaid: !checkoutData.isDepositOnly,
        paymentMethod: checkoutData.paymentMethod,
        status: 'confirmed',
        cancellationPolicyAr: 'تطبق سياسة الإلغاء المعتمدة لكل مورد.',
        createdAt: new Date().toISOString(),
        deliverablesAr: items.map((it) => `${it.serviceTitleAr} (${it.packageNameAr || 'باقة قياسية'})`),
        commissionAmount: Math.round(vTotal * ((adminConfig.commissionRatePercent || 10) / 100)),
      };
      setBookings((prev) => [newBooking, ...prev]);

      return {
        suborderId: `subord-${orderId}-${idx + 1}`,
        vendorId,
        vendorName: firstItem.vendorName,
        vendorLogo: firstItem.vendorLogo,
        items,
        subtotal: vSubtotal,
        taxAmount: vTax,
        totalAmount: vTotal,
        depositAmount: vDeposit,
        remainingAmount: checkoutData.isDepositOnly ? vTotal - vDeposit : 0,
        status: 'confirmed' as const,
        bookingNumber: vBookingNumber,
      };
    });

    const newOrder: MultiVendorOrder = {
      id: orderId,
      orderNumber,
      customerId: 'cust-demo-1',
      customerName: checkoutData.customerName,
      customerPhone: checkoutData.customerPhone,
      customerEmail: checkoutData.customerEmail,
      eventDate: evDate,
      eventTime: evTime,
      cityId: cCityId,
      cityNameAr: cCity,
      venueName: vName,
      suborders,
      totalSubtotal: cartTotals.subtotal,
      totalTax: cartTotals.tax,
      couponDiscount: cartTotals.discount,
      couponCode: appliedCoupon?.code,
      finalTotal: cartTotals.total,
      totalDeposit: cartTotals.depositAmount,
      paymentMethod: checkoutData.paymentMethod,
      isDepositOnly: checkoutData.isDepositOnly,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
    };

    setMultiVendorOrders((prev) => [newOrder, ...prev]);
    clearCart();

    return newOrder;
  };

  const toggleFavoriteVendor = (vendorId: string) => {
    setFavoriteVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const toggleFavoriteService = (serviceId: string) => {
    setFavoriteServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const addToComparison = (vendorId: string): boolean => {
    if (comparisonVendorIds.includes(vendorId)) return true;
    if (comparisonVendorIds.length >= 4) {
      alert('الحد الأقصى للمقارنة هو 4 موردين في نفس الوقت.');
      return false;
    }
    setComparisonVendorIds((prev) => [...prev, vendorId]);
    return true;
  };

  const removeFromComparison = (vendorId: string) => {
    setComparisonVendorIds((prev) => prev.filter((id) => id !== vendorId));
  };

  const clearComparison = () => {
    setComparisonVendorIds([]);
  };

  const updateRankingWeights = (weights: Partial<RankingWeights>) => {
    const updated = { ...rankingWeights, ...weights };
    setRankingWeights(updated);
    setAdminConfig((prev) => ({ ...prev, rankingWeights: updated }));
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

        eaniyahGifts,
        sendEaniyahGift,
        transferEaniyahPayout,

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

        // Commerce & Cart
        cart,
        savedForLater,
        appliedCoupon,
        coupons,
        addToCart,
        updateCartItemQuantity,
        removeFromCart,
        clearCart,
        saveItemForLater,
        moveToCartFromSaved,
        applyCouponCode,
        removeCoupon,
        cartTotals,
        vendorCartGroups,

        // Orders
        multiVendorOrders,
        checkoutCart,

        // Favorites & Comparison
        favoriteVendorIds,
        favoriteServiceIds,
        toggleFavoriteVendor,
        toggleFavoriteService,
        comparisonVendorIds,
        addToComparison,
        removeFromComparison,
        clearComparison,

        // Ranking
        rankingWeights,
        updateRankingWeights,
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
