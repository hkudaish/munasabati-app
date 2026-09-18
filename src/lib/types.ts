export type GenderSection = 'men' | 'women' | 'families' | 'all';
export type VenueType = 'hall' | 'home' | 'istiraha' | 'chalet' | 'farm' | 'hotel' | 'undecided';
export type OccasionTier = 'economy' | 'medium' | 'luxury' | 'ultra_luxury';
export type BookingStatus = 'requested' | 'awaiting_vendor' | 'quote_received' | 'deposit_required' | 'confirmed' | 'in_preparation' | 'underway' | 'completed' | 'cancelled' | 'disputed';
export type PaymentMethod = 'mada' | 'apple_pay' | 'stc_pay' | 'visa_mastercard' | 'tabby' | 'tamara';

export interface SaudiCity {
  id: string;
  nameAr: string;
  nameEn: string;
  regionAr: string;
  neighborhoods: string[];
  isAvailable: boolean;
}

export interface OccasionType {
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  categoryTag: string;
  descriptionAr: string;
  popular: boolean;
  coverImage: string;
  color: string;
  suggestedServiceCategories: string[];
  defaultChecklist: { title: string; daysBefore: number; category: string }[];
}

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  descriptionAr: string;
  color: string;
  itemCount: number;
}

export interface Vendor {
  id: string;
  businessName: string;
  businessNameEn: string;
  categoryId: string;
  categoryNameAr: string;
  logo: string;
  bannerImage: string;
  rating: number;
  reviewsCount: number;
  completedBookingsCount: number;
  verified: boolean;
  crNumber?: string;
  freelanceLicense?: string;
  vatNumber?: string;
  cityId: string;
  cityNameAr: string;
  neighborhood: string;
  serviceAreas: string[];
  startingPrice: number;
  instantBooking: boolean;
  responseTimeMinutes: number;
  badges: string[];
  bioAr: string;
  portfolio: string[];
  contactPhone: string;
  whatsappNumber: string;
  genderSpecialty?: 'men_specialist' | 'women_specialist' | 'both';
  cancellationPolicyAr: string;
  status: 'active' | 'under_review' | 'suspended';
}

export interface ServiceItem {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorLogo: string;
  categoryId: string;
  categoryNameAr: string;
  cityId: string;
  cityNameAr: string;
  titleAr: string;
  descriptionAr: string;
  price: number;
  priceType: 'fixed' | 'per_person' | 'starting_at';
  images: string[];
  featuresAr: string[];
  capacityMax?: number;
  instantBooking: boolean;
  genderPreference?: 'men' | 'women' | 'unisex';
  badge?: string;
  isPopular?: boolean;
}

export interface PackageItem {
  categoryName: string;
  serviceName: string;
  vendorName: string;
  vendorId: string;
  pricePortion: number;
  included: boolean;
  customizable: boolean;
  options?: string[];
}

export interface SmartPackage {
  id: string;
  titleAr: string;
  subtitleAr: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  cityId: string;
  guestCount: number;
  originalPrice: number;
  packagePrice: number;
  savings: number;
  badge: string;
  image: string;
  items: PackageItem[];
  customizable: boolean;
  rating: number;
  reviewsCount: number;
  descriptionAr: string;
}

export interface Occasion {
  id: string;
  title: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  cityId: string;
  cityNameAr: string;
  neighborhood?: string;
  date: string;
  time?: string;
  isApproximateDate: boolean;
  guestCount: number;
  guestsSection: GenderSection;
  venueType: VenueType;
  venueName?: string;
  budget: number;
  spent: number;
  tier: OccasionTier;
  readinessPercentage: number;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed';
  createdAt: string;
  notes?: string;
  coPlanners?: { name: string; role: 'owner' | 'coplanner' | 'viewer'; phone: string }[];
}

export interface Guest {
  id: string;
  occasionId: string;
  name: string;
  phone: string;
  category: 'men' | 'women' | 'family';
  familyGroup?: string;
  companionCount: number;
  status: 'invited' | 'viewed' | 'confirmed' | 'declined' | 'maybe' | 'attended' | 'absent';
  qrCode: string;
  tableId?: string;
  tableName?: string;
  invitedVia: 'whatsapp' | 'sms' | 'link';
  invitationSentAt?: string;
  rsvpTime?: string;
  notes?: string;
}

export interface SeatingTable {
  id: string;
  occasionId: string;
  name: string;
  capacity: number;
  section: 'men' | 'women' | 'vip' | 'general';
  assignedGuestIds: string[];
}

export interface BudgetItem {
  id: string;
  occasionId: string;
  categoryId: string;
  categoryNameAr: string;
  allocatedAmount: number;
  spentAmount: number;
  status: 'estimated' | 'booked' | 'paid';
  vendorId?: string;
  vendorName?: string;
  notes?: string;
}

export interface PlanningTask {
  id: string;
  occasionId: string;
  title: string;
  category: string;
  dueDaysBefore: number;
  dueDate: string;
  assignedTo?: string;
  isCompleted: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface RunOfShowItem {
  id: string;
  occasionId: string;
  time: string; // e.g., "16:00" or "04:00 م"
  titleAr: string;
  descriptionAr: string;
  responsibleRole: 'coordinator' | 'family' | 'photographer' | 'catering' | 'music' | 'hall_manager' | 'other';
  responsibleRoleAr: string;
  responsiblePerson?: string;
  responsiblePhone?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  durationMinutes: number;
  notes?: string;
  iconName?: string;
}


export interface WishlistGift {
  id: string;
  occasionId: string;
  title: string;
  price: number;
  category: string;
  imageUrl: string;
  isFulfilled: boolean;
  giftedBy?: string;
  allowContributions: boolean;
  contributedAmount: number;
  isServiceGift?: boolean;
  serviceVendorName?: string;
}

export interface InspirationPost {
  id: string;
  titleAr: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  likesCount: number;
  savesCount: number;
  tags: string[];
  taggedVendors: {
    vendorId: string;
    vendorName: string;
    category: string;
    servicePrice: number;
  }[];
  descriptionAr: string;
  cityNameAr: string;
}

export interface RFQQuote {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  rating: number;
  basePrice: number;
  setupFee: number;
  transportFee: number;
  vat: number;
  total: number;
  optionalItems: { title: string; price: number }[];
  deliveryTimeAr: string;
  notesAr: string;
  status: 'pending' | 'accepted' | 'declined';
  isBestValue?: boolean;
  isFastest?: boolean;
  isHighestRated?: boolean;
  isClosestBudget?: boolean;
}

export interface RFQRequest {
  id: string;
  occasionId?: string;
  occasionTitle: string;
  occasionTypeAr: string;
  cityAr: string;
  date: string;
  guestCount: number;
  budget: number;
  requirementsAr: string;
  quotesCount: number;
  quotes: RFQQuote[];
  status: 'open' | 'awarded' | 'closed';
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  occasionId?: string;
  occasionTitle: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  serviceId?: string;
  serviceTitleAr: string;
  packageId?: string;
  date: string;
  time?: string;
  cityAr: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositPaid: boolean;
  isFullyPaid: boolean;
  paymentMethod?: PaymentMethod;
  status: BookingStatus;
  cancellationPolicyAr: string;
  createdAt: string;
  deliverablesAr: string[];
  payoutReleased?: boolean;
  payoutRef?: string;
  commissionAmount?: number;
}

export interface Review {
  id: string;
  vendorId: string;
  vendorName: string;
  bookingId: string;
  customerName: string;
  customerCityAr: string;
  occasionTypeAr: string;
  rating: number;
  qualityRating: number;
  punctualityRating: number;
  communicationRating: number;
  valueRating: number;
  date: string;
  commentAr: string;
  isVerifiedBooking: boolean;
  vendorReplyAr?: string;
  featured?: boolean;
  status?: 'approved' | 'pending' | 'rejected';
  avatarUrl?: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingNumber: string;
  occasionTitle: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  type: 'deposit' | 'remaining' | 'full';
  status: 'completed' | 'pending' | 'refunded';
  transactionRef: string;
  invoiceNumber: string;
  paidAt: string;
}

export interface AdminPlatformConfig {
  platformNameAr: string;
  platformNameEn: string;
  taglineAr: string;
  commissionRatePercent: number;
  vatPercent: number;
  currencyAr: string;
  emergencyPhone: string;
  aiAssistantNameAr: string;
  activeCitiesCount: number;
  totalGMV: number;
  totalBookings: number;
  totalUsers: number;
  totalVendors: number;
  announcementText?: string;
  isMaintenanceMode?: boolean;
  defaultEscrowDays?: number;
  autoApproveReviews?: boolean;
}
