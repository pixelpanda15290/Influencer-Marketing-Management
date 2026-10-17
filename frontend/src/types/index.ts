export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
  brandId?: string;
  brandDetails?: Brand;
  permissions: string[];
  employeeDetails?: Employee;
}

export interface ClientPosting {
  id: string;
  sourceType: 'ContentCalendar' | 'Task' | 'Influencer';
  title: string;
  platform: string;
  contentType: string;
  postDate: string;
  status: 'Published' | 'Scheduled' | 'Pending Approval';
  mediaUrl?: string;
  publishedUrl?: string;
  notes?: string;
  designerName?: string;
  assigneeName?: string;
  influencerName?: string;
  viewsCount?: number;
  ordersGenerated?: number;
  clientApprovalStatus: 'Pending' | 'Approved' | 'Revision Requested';
  clientComments?: string;
}

export interface ClientOverviewMetrics {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  activeInfluencers: number;
  totalViews: number;
  pendingApprovals: number;
}

export interface ClientOverviewData {
  brand?: Brand;
  metrics: ClientOverviewMetrics;
  platformBreakdown: Record<string, number>;
  recentActivities: any[];
}

export interface IDepartment {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  status: 0 | 1 | 'Active' | 'Inactive';
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  _id: string;
  employeeId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  department: string | IDepartment;
  designation: string;
  role: string;
  reportingManagerId?: Employee | string;
  joiningDate: string;
  status: 'Active' | 'Inactive';
}

export interface Brand {
  _id: string;
  brandId: string;
  brandName: string;
  logo?: string;
  website?: string;
  instagramUrl?: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive';
  brandType?: 'New' | 'Running';
  targetBarterCollabs?: number;
  targetPaidCollabs?: number;
  targetTotalCollabs?: number;
  assignedExecutive?: { name: string; email: string; designation: string } | null;
  notes?: string;
  assignedEmployees?: EmployeeBrandAssignment[];
}

export interface EmployeeBrandAssignment {
  _id: string;
  employeeId: Employee | string;
  brandId: Brand | string;
  assignedBy?: User | string;
  startDate: string;
  endDate?: string;
  responsibility: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Active' | 'Completed' | 'Removed';
}

export interface TaskItem {
  _id: string;
  taskId: string;
  employeeId: Employee | any;
  brandId: Brand | any;
  platform: string;
  contentType: string;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  scheduledDate: string;
  scheduledTime: string;
  deadline: string;
  status: 'Pending' | 'In Progress' | 'Submitted' | 'Verified' | 'Completed' | 'Rejected' | 'Delayed' | 'Missed';
  publishedUrl?: string;
  publishedDate?: string;
  verificationStatus: 'Unsubmitted' | 'Pending Verification' | 'Verified' | 'Rejected';
  verifiedBy?: User | any;
  verifiedAt?: string;
  rejectionReason?: string;
  comments?: string;
  remarks?: string;
  isMainTask?: boolean;
  parentTaskId?: TaskItem | any;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'Assignment' | 'Deadline' | 'Delayed' | 'Verification' | 'System';
  relatedId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  _id: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  module: string;
  entity: string;
  entityId?: string;
  details?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  timestamp: string;
}

export interface SystemRole {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
}

export interface PerformanceMetrics {
  totalAssigned: number;
  completed: number;
  pending: number;
  delayed: number;
  missed: number;
  completionRate: number;
  onTimeRate: number;
  brandsManaged: number;
}

export interface IncentiveSummary {
  netMargin: number;
  individualMonthlyTarget: number;
  targetAchievedPercent: number;
  targetTier: string;
  targetIncentivePercentage: number;
  targetIncentiveAmount: number;
  qualifyingBonusDealsCount: number;
  orderBonusAmount: number;
  totalTakeHomeIncentive: number;
  totalRevenue: number;
  totalInfluencerCost: number;
  barterCount: number;
  paidCount: number;
  totalCollabs: number;
}

export interface QualifyingDeal {
  id: string;
  brandName: string;
  influencerName: string;
  ordersGenerated: number;
  ad2shipMargin: number;
  bonusEarned: number;
}

export interface EmployeePerformanceData {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    department: string | IDepartment;
    designation: string;
    role: string;
  };
  metrics: PerformanceMetrics;
  incentiveSummary?: IncentiveSummary;
  qualifyingDeals?: QualifyingDeal[];
}

export interface MemberTargetItem {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    department?: string | IDepartment;
    designation: string;
    assignedBrandsCount: number;
  };
  individualTarget: number;
  individualBarterTarget?: number;
  barterAchievedPercent?: number;
  netMargin: number;
  targetAchievedPercent: number;
  targetTier: string;
  targetIncentivePercentage: number;
  targetIncentiveAmount: number;
  qualifyingBonusDealsCount: number;
  orderBonusAmount: number;
  totalTakeHomeIncentive: number;
  barterCount: number;
  paidCount: number;
  assignedBrands?: Array<{
    id: string;
    name: string;
    brandType: string;
    targetBarterCollabs: number;
    targetPaidCollabs: number;
    targetTotalCollabs: number;
  }>;
  deals?: Array<{
    id: string;
    transactionDate: string;
    influencerName: string;
    brandName: string;
    category: string;
    brandOnboardingAmt: number;
    influencerOnboardingAmt: number;
    ad2shipMargin: number;
    ordersGenerated: number;
    isOrderBonusQualified: boolean;
    videoType?: string;
    status?: string;
  }>;
}

export interface TeamTargetBreakdown {
  teamSize: number;
  perMemberTarget: number;
  teamTargetAmount: number;
  teamAchievedMargin: number;
  teamCompletionPercent: number;
  teamSlab: string;
  teamBarterTarget?: number;
  teamAchievedBarterCount?: number;
  teamBarterCompletionPercent?: number;
  teamQualifyingVideosCount: number;
  teamTotalBonus: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  members: MemberTargetItem[];
}

export interface TargetItem {
  _id: string;
  title: string;
  targetType?: 'Paid' | 'Barter';
  targetMetric?: 'Margin' | 'Revenue' | 'Count';
  targetAmount: number;
  achievedAmount: number;
  targetCount?: number;
  achievedCount?: number;
  currency: string;
  period: string;
  startDate?: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Archived';
  isActive: boolean;
  autoSync?: boolean;
  description?: string;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfluencerTransaction {
  _id: string;
  sNo?: number;
  transactionDate?: string;
  connectedDate?: string;
  influencerManager?: string;
  brandManagerTeam?: string;
  assignedExecutive?: string;
  brandId?: Brand | any;
  brandName: string;
  influencerName: string;
  influencerInstagramId?: string;
  phone?: string;
  profileLink?: string;
  category: 'Paid' | 'Barter';

  // Financial breakdown
  brandOnboardingAmt: number;
  brandReceivedAmt: number;
  brandPendingAmt: number;
  influencerOnboardingAmt: number;
  influencerPaidAmt: number;
  influencerPendingAmt: number;
  ad2shipMargin: number;
  inAmount: number;
  outAmount: number;
  balance: number;
  finalPaymentReceived: boolean;

  // Deliverables & Content
  productLink?: string;
  videoType?: string;
  videoDescription?: string;
  refVideoLink?: string;
  referenceVideoLink?: string;
  orderId?: string;
  orderDate?: string;
  platform: string;
  status: 'Pending' | 'In Discussion' | 'Parcel Sent' | 'Under Review' | 'Completed' | 'Settled' | 'Approved';
  contentLink?: string;
  adsCode?: string;
  viewsCount?: number;
  ordersCount?: number;
  ordersGenerated?: number;
  isOrderBonusQualified?: boolean;
  isApproved?: boolean;
  approvalStatus?: 'Approved' | 'Not Approved' | 'Pending';
  reason?: string;
  notes?: string;
  remark?: string;
  moneyReceivedBy?: string;
  paymentDoneBy?: string;
  completedAt?: string;
  parcelSentAt?: string;
  underReviewAt?: string;
  inDiscussionAt?: string;
  statusUpdatedAt?: string;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentLogItem {
  _id: string;
  influencerId?: string;
  influencerName: string;
  brandName: string;
  type: 'IN' | 'OUT';
  amount: number;
  paymentMode: string;
  transactionDate: string;
  referenceNo?: string;
  handledBy: string;
  notes?: string;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentCalendarItem {
  _id: string;
  brandId?: any;
  brandName: string;
  postDate: string;
  dayOfWeek?: string;
  typeOfPost: string;
  platform: string;
  referenceLink?: string;
  mediaLink?: string;
  assignedDesignerId?: any;
  assignedDesignerName?: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Published';
  notes?: string;
  cycleId?: string;
  cycleTitle?: string;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfluencerDirectoryItem {
  _id?: string;
  instagramHandle: string;
  name: string;
  avatar?: string;
  category: string;
  nicheTags?: string[];
  followersCount: number;
  followingCount?: number;
  postsCount?: number;
  engagementRate: number;
  avgLikes?: number;
  avgComments?: number;
  bio?: string;
  location?: string;
  email?: string;
  phone?: string;
  profileLink?: string;
  isVerified?: boolean;
  status?: 0 | 1 | string | number;
  rating?: number;
  notes?: string;
  source?: 'Manual' | 'API Discovery' | 'Past Collab' | 'Sheet Sync';
  externalId?: string;
  pastCollabsCount?: number;
  brandsWorkedWith?: string[];
  brandsCount?: number;
  instagramDataSyncedAt?: string;
  instagramSyncStatus?: 'synced' | 'failed' | 'pending';
  instagramSyncError?: string;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiscoveredInfluencer {
  instagramHandle: string;
  name: string;
  avatar: string;
  category: string;
  nicheTags: string[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  bio: string;
  location: string;
  email: string;
  phone: string;
  profileLink: string;
  isVerified: boolean;
  estRatePerPost?: string;
  recentPosts?: Array<{ image: string; likes: number; comments: number }>;
  isSavedInDb?: boolean;
  dbId?: string | null;
  dbStatus?: string | null;
  dbRating?: number | null;
}

