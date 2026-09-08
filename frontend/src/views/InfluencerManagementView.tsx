import React, { useEffect, useState } from 'react';
import { 
  Sparkles, Plus, Search, Filter, DollarSign, User, Trash2, Edit2, 
  ArrowUpRight, ArrowDownRight, ExternalLink, Video, Link2, ChevronDown, 
  Receipt, Eye, ShoppingBag, ChevronUp, ChevronsUpDown, Target, TrendingUp,
  Award, Clock, AlertCircle, CheckCircle2, ShieldCheck, Layers, RefreshCw, Users,
  Calendar, ChevronLeft, ChevronRight, CalendarDays, Loader2, Lock, Settings, X,
  Activity, Shield, Package, MessageSquare, Info, LayoutGrid, List,
  Upload, Download, FileSpreadsheet, FileUp
} from 'lucide-react';
import { api } from '../services/api';
import { InfluencerTransaction, Brand, Employee, PaymentLogItem, TargetItem, TeamTargetBreakdown, MemberTargetItem, AuditLogItem } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Pagination } from '../components/Pagination';
import { InlineLoader } from '../components/PageLoader';
import { MonthDatePicker } from '../components/MonthDatePicker';

interface InfluencerManagementViewProps {
  userRole?: string;
  currentUser?: any;
  initialTab?: 'targets' | 'paid' | 'barter' | 'payments' | 'all';
  onTargetUpdated?: () => void;
}

// Helper to get current month timeframe key
const getCurrentMonthTimeframe = () => {
  const now = new Date();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return `${monthNames[now.getMonth()]}_${now.getFullYear()}`;
};

// Helper to check if status is achieved (Completed, Approved, Settled)
const isAchievedStatus = (s?: string) => {
  if (!s) return false;
  const st = s.toLowerCase();
  return st === 'completed' || st === 'approved' || st === 'settled';
};

// Custom Premium Select Dropdown Component
const CustomSelectDropdown: React.FC<{
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string; icon?: React.ReactNode }[];
  allLabel: string;
}> = ({
  label,
  icon,
  value,
  onChange,
  options,
  allLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find(o => o.value === value);
  const activeDisplayLabel = value ? (selectedOpt ? selectedOpt.label : value) : allLabel;
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-150 shadow-2xs border cursor-pointer select-none ${
          value
            ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20'
            : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-700'
        }`}
      >
        {icon}
        <span className="truncate max-w-[140px] tracking-tight">{activeDisplayLabel}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 shrink-0 ${value ? 'text-white' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Popover Panel - Solid Opaque White */}
      {isOpen && (
        <div className="absolute left-0 mt-2 min-w-[220px] max-w-[280px] rounded-2xl bg-white border border-slate-200 shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Search Box Header */}
          {options.length > 0 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${label}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 text-slate-800 placeholder-slate-400"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin bg-white">
            {/* All Options Default Button */}
            <button
              type="button"
              onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
              className={`w-full px-3 py-2 text-left text-xs font-extrabold rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                !value
                  ? 'bg-purple-600 text-white font-extrabold'
                  : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {icon}
                <span className="truncate">{allLabel}</span>
              </div>
              {!value && <CheckCircle2 size={13} className="text-white shrink-0" />}
            </button>

            {/* Filtered Option Items */}
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                    className={`w-full px-3 py-2 text-left text-xs font-bold rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white font-extrabold'
                        : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 size={13} className="text-white shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Pill Select for Status
const StatusPillDropdown: React.FC<{
  currentStatus: string;
  userRole?: string;
  onSelect: (newStatus: string) => void;
}> = ({ currentStatus, userRole, onSelect }) => {
  const isAssistant = userRole === 'Assistant Manager' || userRole === 'Assistant Marketing Manager' || (!!userRole && userRole.toLowerCase().includes('assistant'));
  const isManagerOrAdmin = userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Marketing Manager' || userRole === 'Manager' || isAssistant || userRole === 'Team Leader';

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentStatus || 'Pending'}
        onChange={(e) => onSelect(e.target.value)}
        className={`appearance-none pl-3 pr-7 py-1 rounded-xl text-[11px] font-extrabold focus:outline-none cursor-pointer border shadow-2xs transition ${
          currentStatus === 'Completed' || currentStatus === 'Approved'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
            : currentStatus === 'Parcel Sent'
              ? 'bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-200'
              : currentStatus === 'In Discussion'
                ? 'bg-cyan-100 text-cyan-900 border-cyan-300 hover:bg-cyan-200'
                : currentStatus === 'Under Review'
                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                  : currentStatus === 'Settled'
                    ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                    : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
        }`}
      >
        <option value="Pending" className="bg-white text-slate-900 font-bold py-1">🟠 Pending</option>
        <option value="In Discussion" className="bg-white text-slate-900 font-bold py-1">💬 In Discussion</option>
        <option value="Parcel Sent" className="bg-white text-slate-900 font-bold py-1">📦 Parcel Sent</option>
        <option value="Under Review" className="bg-white text-slate-900 font-bold py-1">🟡 Under Review</option>
        <option value="Completed" className="bg-white text-slate-900 font-bold py-1">🟢 Completed</option>
        <option value="Settled" className="bg-white text-slate-900 font-bold py-1">🟣 Settled</option>
      </select>
      <ChevronDown size={13} className="absolute right-2.5 pointer-events-none opacity-80" />
    </div>
  );
};

// Searchable Combobox for Brand Selection
const SearchableBrandSelect: React.FC<{
  brands: Brand[];
  selectedBrandId: string;
  customBrandName: string;
  onSelectBrand: (brandId: string, brandName: string) => void;
}> = ({ brands, selectedBrandId, customBrandName, onSelectBrand }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (customBrandName) {
      setSearchQuery(customBrandName);
    } else {
      const selected = brands.find(b => b._id === selectedBrandId);
      setSearchQuery(selected ? selected.brandName : '');
    }
  }, [selectedBrandId, customBrandName, brands]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBrands = brands.filter(b =>
    b.brandName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-slate-700 mb-1">Brand Name *</label>
      <div className="relative">
        <input
          type="text"
          required
          placeholder="Search brand (e.g. Vaasva, EBBANI)..."
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSelectBrand('', e.target.value);
            setIsOpen(true);
          }}
          className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              onSelectBrand('', '');
              setIsOpen(true);
            }}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl py-1 text-xs divide-y divide-slate-100">
          {filteredBrands.length === 0 ? (
            <div className="px-3.5 py-2.5 text-slate-400 font-semibold italic text-center">
              No matching brands found. Custom brand "{searchQuery}" will be used.
            </div>
          ) : (
            filteredBrands.map((b) => {
              const isSelected = b._id === selectedBrandId || b.brandName.toLowerCase() === searchQuery.toLowerCase();
              return (
                <div
                  key={b._id}
                  onClick={() => {
                    onSelectBrand(b._id, b.brandName);
                    setSearchQuery(b.brandName);
                    setIsOpen(false);
                  }}
                  className={`px-3.5 py-2 cursor-pointer flex items-center justify-between transition ${
                    isSelected ? 'bg-purple-50 text-purple-900 font-black' : 'hover:bg-slate-50 text-slate-800 font-semibold'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {b.logo ? (
                      <img src={b.logo} alt={b.brandName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black shrink-0">
                        {b.brandName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate">{b.brandName}</span>
                  </div>
                  {b.brandType && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                      b.brandType === 'New' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {b.brandType}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const InfluencerManagementView: React.FC<InfluencerManagementViewProps> = ({
  userRole,
  currentUser,
  initialTab = 'paid',
  onTargetUpdated
}) => {
  const [influencers, setInfluencers] = useState<InfluencerTransaction[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogItem[]>([]);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [teamBreakdown, setTeamBreakdown] = useState<TeamTargetBreakdown | null>(null);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<MemberTargetItem | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'overview' | 'brands' | 'deals'>('overview');
  const [detailDealsSearch, setDetailDealsSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab View Mode State
  const mapInitialTab = (tab: string) => {
    if (tab === 'targets') return 'Targets & Goals';
    if (tab === 'barter') return 'Barter Collaborations';
    if (tab === 'payments') return 'Payment Audit Logs';
    if (tab === 'all') return 'All Collaborations';
    return 'Paid Collaborations';
  };

  const [viewMode, setViewMode] = useState<'Targets & Goals' | 'Paid Collaborations' | 'Barter Collaborations' | 'Payment Audit Logs' | 'User Activity Logs' | 'All Collaborations'>(mapInitialTab(initialTab));
  
  // Category Filter State
  const [activeCategory, setActiveCategory] = useState<'All' | 'Paid' | 'Barter'>('All');
  const [timeframe, setTimeframe] = useState<string>(getCurrentMonthTimeframe());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayLogType, setSelectedPayLogType] = useState<'All' | 'IN' | 'OUT'>('All');

  // Team Breakdown in Targets Tab State
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamViewMode, setTeamViewMode] = useState<'table' | 'cards'>('table');
  const [isSlabsModalOpen, setIsSlabsModalOpen] = useState(false);
  const [teamPage, setTeamPage] = useState(1);
  const [teamLimit, setTeamLimit] = useState(10);
  const [teamTotalPages, setTeamTotalPages] = useState(1);
  const [teamTotalItems, setTeamTotalItems] = useState(0);
  const [teamLoading, setTeamLoading] = useState(false);

  // User Activity & Audit Logs State
  const [activityLogs, setActivityLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterUser, setLogFilterUser] = useState('All');
  const [logFilterRole, setLogFilterRole] = useState('All');
  const [logFilterModule, setLogFilterModule] = useState('All');
  const [logFilterAction, setLogFilterAction] = useState('All');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  const monthsList = [
    { label: 'August 2026 (Current)', value: 'august_2026', monthIndex: 7, year: 2026 },
    { label: 'July 2026', value: 'july_2026', monthIndex: 6, year: 2026 },
    { label: 'June 2026', value: 'june_2026', monthIndex: 5, year: 2026 },
    { label: 'May 2026', value: 'may_2026', monthIndex: 4, year: 2026 },
    { label: 'April 2026', value: 'april_2026', monthIndex: 3, year: 2026 },
    { label: 'March 2026', value: 'march_2026', monthIndex: 2, year: 2026 },
    { label: 'February 2026', value: 'february_2026', monthIndex: 1, year: 2026 },
    { label: 'January 2026', value: 'january_2026', monthIndex: 0, year: 2026 },
    { label: 'All Months (Lifetime)', value: 'all', monthIndex: -1, year: 2026 },
  ];

  const handlePrevMonth = () => {
    const curIdx = monthsList.findIndex(m => m.value === timeframe);
    if (curIdx !== -1 && curIdx < monthsList.length - 2) {
      setTimeframe(monthsList[curIdx + 1].value);
    } else if (timeframe === 'all') {
      setTimeframe('august_2026');
    }
  };

  const handleNextMonth = () => {
    const curIdx = monthsList.findIndex(m => m.value === timeframe);
    if (curIdx > 0) {
      setTimeframe(monthsList[curIdx - 1].value);
    }
  };

  const handleCurrentMonth = () => {
    setTimeframe(getCurrentMonthTimeframe());
  };

  // Metrics
  const [metrics, setMetrics] = useState({
    totalIn: 0,
    totalOut: 0,
    netBalance: 0,
    totalCount: 0
  });

  // Sorting State — Default Ascending (Past Date to Present Date: 8/1 -> 8/22) by transactionDate
  const [sortKey, setSortKey] = useState<string>('transactionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Multi-Filter Dropdown State (Brand, Manager, Status, Deliverable)
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterManager, setFilterManager] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDeliverable, setFilterDeliverable] = useState<string>('');
  const [dbFilterOptions, setDbFilterOptions] = useState<{
    brands?: string[];
    managers?: string[];
    statuses?: string[];
    deliverables?: string[];
  }>({});
  const [tabCounts, setTabCounts] = useState<{ paid: number; barter: number; all: number }>({
    paid: 0,
    barter: 0,
    all: 0
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const isAssistantManager = userRole === 'Assistant Manager' || userRole === 'Assistant Marketing Manager' || (!!userRole && userRole.toLowerCase().includes('assistant'));
  const isManagerOrAdmin = userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Marketing Manager' || userRole === 'Manager' || isAssistantManager || userRole === 'Team Leader';
  const isTargetManager = (userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Marketing Manager' || userRole === 'Manager') && !isAssistantManager;
  const isTargetEmployee = userRole === 'Employee' || isAssistantManager;
  const isEmployee = userRole === 'Employee';

  const myMember = (teamBreakdown?.members || []).find(m => {
    if (!currentUser) return false;
    const cId = currentUser.id || currentUser._id;
    const cEmpId = currentUser.employeeId;
    const cEmail = currentUser.email?.toLowerCase();
    const cName = currentUser.name?.toLowerCase();

    return (
      (m.employee.id && cId && m.employee.id.toString() === cId.toString()) ||
      (m.employee.employeeId && cEmpId && m.employee.employeeId === cEmpId) ||
      (m.employee.email && cEmail && m.employee.email.toLowerCase() === cEmail) ||
      (m.employee.name && cName && m.employee.name.toLowerCase() === cName)
    );
  }) || (teamBreakdown?.members || [])[0];

  const displayedMembers = isEmployee
    ? (myMember ? [myMember] : (teamBreakdown?.members || []).slice(0, 1))
    : (teamBreakdown?.members || []);

  // Modal State — Influencer Record
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InfluencerTransaction | null>(null);

  // Modal State — Payment Audit Log
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payLogInfluencerName, setPayLogInfluencerName] = useState('');
  const [payLogBrandName, setPayLogBrandName] = useState('');
  const [payLogType, setPayLogType] = useState<'IN' | 'OUT'>('IN');
  const [payLogAmount, setPayLogAmount] = useState<number | ''>('');
  const [payLogMode, setPayLogMode] = useState('Bank Transfer');
  const [payLogRefNo, setPayLogRefNo] = useState('');
  const [payLogHandledBy, setPayLogHandledBy] = useState('');
  const [payLogDate, setPayLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [payLogNotes, setPayLogNotes] = useState('');

  // Modal State — Target Record
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetItem | null>(null);
  const [targetFormData, setTargetFormData] = useState({
    title: '',
    targetType: 'Paid' as 'Paid' | 'Barter',
    targetMetric: 'Margin' as 'Margin' | 'Revenue' | 'Count',
    targetAmount: '500000',
    targetCount: '120',
    currency: '₹',
    period: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    description: '',
    isActive: true,
    autoSync: true,
    status: 'Active'
  });
  const [savingTarget, setSavingTarget] = useState(false);
  const [submittingInfluencer, setSubmittingInfluencer] = useState(false);

  // Google Sheet Auto-Sync State
  const [syncStatus, setSyncStatus] = useState<{
    isConfigured: boolean;
    maskedUrl?: string;
    autoSyncEnabled: boolean;
    syncIntervalSeconds: number;
    lastSyncedAt?: string;
    lastSyncedCount: number;
    lastSyncStatus: string;
    lastSyncMessage?: string;
  } | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [showSyncConfigModal, setShowSyncConfigModal] = useState(false);
  const [inputSheetUrl, setInputSheetUrl] = useState('');
  const [inputAutoSync, setInputAutoSync] = useState(true);
  const [savingPayLog, setSavingPayLog] = useState(false);

  // Form Fields (Influencer Record)
  const [influencerManager, setInfluencerManager] = useState('');
  const [influencerName, setInfluencerName] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [customBrandName, setCustomBrandName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLink, setProfileLink] = useState('');
  const [category, setCategory] = useState<'Paid' | 'Barter'>('Paid');

  // Financial Breakdown Fields
  const [brandOnboardingAmt, setBrandOnboardingAmt] = useState<number | ''>(0);
  const [brandReceivedAmt, setBrandReceivedAmt] = useState<number | ''>(0);
  const [influencerOnboardingAmt, setInfluencerOnboardingAmt] = useState<number | ''>(0);
  const [influencerPaidAmt, setInfluencerPaidAmt] = useState<number | ''>(0);
  const [finalPaymentReceived, setFinalPaymentReceived] = useState(false);

  // Content Deliverable & Spreadsheet Fields
  const [brandManagerTeam, setBrandManagerTeam] = useState('');
  const [influencerInstagramId, setInfluencerInstagramId] = useState('');
  const [productLink, setProductLink] = useState('');
  const [videoType, setVideoType] = useState('Single Product Video');
  const [videoDescription, setVideoDescription] = useState('');
  const [refVideoLink, setRefVideoLink] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [status, setStatus] = useState<'Pending' | 'Under Review' | 'Completed' | 'Settled' | 'Approved'>('Pending');
  const [approvalStatus, setApprovalStatus] = useState<'Approved' | 'Not Approved' | 'Pending'>('Pending');
  const [reason, setReason] = useState('');
  const [contentLink, setContentLink] = useState('');
  const [adsCode, setAdsCode] = useState('');
  const [viewsCount, setViewsCount] = useState<number | ''>(0);
  const [ordersCount, setOrdersCount] = useState<number | ''>(0);
  const [isApproved, setIsApproved] = useState(false);
  const [transactionDate, setTransactionDate] = useState('');
  const [connectedDate, setConnectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [remark, setRemark] = useState('');
  const [moneyReceivedBy, setMoneyReceivedBy] = useState('');
  const [paymentDoneBy, setPaymentDoneBy] = useState('');

  // View Details Modal State
  const [selectedViewItem, setSelectedViewItem] = useState<InfluencerTransaction | null>(null);

  const openViewModal = (item: InfluencerTransaction) => {
    setSelectedViewItem(item);
  };

  // Fetch Google Sheet Sync Status
  const fetchSyncStatus = async () => {
    try {
      const res = await api.get('/sync/status');
      if (res.success && res.data) {
        setSyncStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch sync status', err);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncingSheet(true);
    try {
      const res = await api.post('/sync/trigger', {});
      if (res.success) {
        fetchSyncStatus();
        fetchInfluencers();
        fetchTeamBreakdown();
        if (onTargetUpdated) onTargetUpdated();
      } else {
        alert(res.message || 'Sync failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering sync');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSaveSyncConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingSheet(true);
    try {
      const res = await api.post('/sync/config', {
        sheetUrl: inputSheetUrl,
        autoSyncEnabled: inputAutoSync,
        syncIntervalSeconds: 60
      });
      if (res.success) {
        setShowSyncConfigModal(false);
        fetchSyncStatus();
        fetchInfluencers();
        fetchTeamBreakdown();
        if (onTargetUpdated) onTargetUpdated();
      } else {
        alert(res.message || 'Failed to update config');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving sync config');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Fetch Brands from DB
  const fetchBrands = async () => {
    try {
      const res = await api.get('/brands?limit=500');
      if (res.success && res.data) setBrands(res.data);
    } catch (err) {
      console.error('Failed to fetch brands from DB', err);
    }
  };

  // Fetch Employees from DB
  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees?limit=500');
      if (res.success && res.data) setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees from DB', err);
    }
  };

  // Fetch Targets (Month-Aware)
  const fetchTargets = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await api.get(`/targets?timeframe=${timeframe}&year=${year}&month=${month}`);
      if (res.success) {
        setTargets(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch targets', err);
    }
  };

  // Fetch Team Breakdown (Month-Aware with Server-Side Pagination & Search)
  const fetchTeamBreakdown = async (page = teamPage, search = teamSearchQuery, limit = teamLimit) => {
    setTeamLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      let url = `/targets/team-breakdown?timeframe=${timeframe}&year=${year}&month=${month}&page=${page}&limit=${limit}`;
      if (search && search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const res = await api.get(url);
      if (res.success && res.data) {
        setTeamBreakdown(res.data);
        if (res.data.pagination) {
          setTeamTotalPages(res.data.pagination.totalPages || 1);
          setTeamTotalItems(res.data.pagination.total || 0);
          setTeamPage(res.data.pagination.page || page);
        } else {
          setTeamTotalPages(1);
          setTeamTotalItems(res.data.members?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch team target breakdown', err);
    } finally {
      setTeamLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const itemsPerPage = 10;

  // Fetch All Influencers for Active Timeframe & Category (Keeps all card counters intact)
  const fetchInfluencers = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      let url = `/influencers?timeframe=${timeframe}&year=${year}&month=${month}&page=all&limit=all`;
      if (viewMode === 'Paid Collaborations') url += '&category=Paid';
      if (viewMode === 'Barter Collaborations') url += '&category=Barter';

      const res = await api.get(url);
      if (res.success) {
        setInfluencers(res.data);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.pagination) {
          setServerTotalPages(res.pagination.totalPages || 1);
          setServerTotalItems(res.pagination.total || 0);
        }
        if (res.filterOptions) {
          setDbFilterOptions(res.filterOptions);
        }
        if (res.tabCounts) {
          setTabCounts(res.tabCounts);
        }
      }
    } catch (err) {
      console.error('Failed to fetch influencers', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Payment Audit Logs
  const fetchPaymentLogs = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      let url = `/influencers/payment-logs?timeframe=${timeframe}&year=${year}&month=${month}`;
      if (selectedPayLogType !== 'All') url += `&type=${selectedPayLogType}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      const res = await api.get(url);
      if (res.success) {
        setPaymentLogs(res.data);
        if (res.metrics) setMetrics(res.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch payment logs', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch User Activity & Audit Logs
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      let url = `/audit-logs?limit=300`;
      if (logFilterUser && logFilterUser !== 'All') url += `&userName=${encodeURIComponent(logFilterUser)}`;
      if (logFilterRole && logFilterRole !== 'All') url += `&userRole=${encodeURIComponent(logFilterRole)}`;
      if (logFilterModule && logFilterModule !== 'All') url += `&module=${encodeURIComponent(logFilterModule)}`;
      if (logFilterAction && logFilterAction !== 'All') url += `&action=${encodeURIComponent(logFilterAction)}`;
      if (logSearchTerm) url += `&search=${encodeURIComponent(logSearchTerm)}`;

      const res = await api.get(url);
      if (res.success && res.data) {
        setActivityLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    fetchEmployees();
    fetchTargets();
    fetchTeamBreakdown();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    if (viewMode === 'User Activity Logs') {
      fetchAuditLogs();
    } else if (viewMode === 'Payment Audit Logs') {
      fetchPaymentLogs();
    } else if (viewMode === 'Targets & Goals') {
      fetchTargets();
      fetchTeamBreakdown();
      fetchInfluencers();
    } else {
      fetchInfluencers();
    }
  }, [activeCategory, timeframe, currentDate, viewMode, selectedPayLogType, logFilterUser, logFilterRole, logFilterModule, logFilterAction, logSearchTerm]);

  // Target Action Handlers
  const handleOpenCreateTargetModal = (defaultType: 'Paid' | 'Barter' = 'Paid') => {
    const defaultPeriod = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
    setTargetFormData({
      title: defaultType === 'Barter' ? `Barter Target - ${defaultPeriod}` : `Monthly Revenue Target - ${defaultPeriod}`,
      targetType: defaultType,
      targetMetric: defaultType === 'Barter' ? 'Count' : 'Margin',
      targetAmount: '',
      targetCount: '',
      currency: defaultType === 'Barter' ? 'Collabs' : '₹',
      period: defaultPeriod,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      description: defaultType === 'Barter' 
        ? 'Monthly barter collaboration target set by AD2ship.'
        : 'Monthly AD2ship profit margin target (Brand Quoted Price - Influencer Cost).',
      isActive: true,
      autoSync: true,
      status: 'Active'
    });
    setEditingTarget(null);
    setShowTargetModal(true);
  };

  const handleOpenEditTargetModal = (target: TargetItem) => {
    setEditingTarget(target);
    setTargetFormData({
      title: target.title,
      targetType: target.targetType || 'Paid',
      targetMetric: target.targetMetric || (target.targetType === 'Barter' ? 'Count' : 'Margin'),
      targetAmount: (target.targetAmount || 0).toString(),
      targetCount: (target.targetCount || target.targetAmount || 0).toString(),
      currency: target.currency || (target.targetType === 'Barter' ? 'Collabs' : '₹'),
      period: target.period,
      startDate: target.startDate ? new Date(target.startDate).toISOString().split('T')[0] : '',
      endDate: target.endDate ? new Date(target.endDate).toISOString().split('T')[0] : '',
      description: target.description || '',
      isActive: target.isActive,
      autoSync: target.autoSync !== false,
      status: target.status
    });
    setShowTargetModal(true);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTarget(true);
    try {
      const payload = {
        title: targetFormData.title,
        targetType: targetFormData.targetType,
        targetMetric: targetFormData.targetMetric,
        targetAmount: Number(targetFormData.targetAmount),
        targetCount: Number(targetFormData.targetCount || targetFormData.targetAmount),
        currency: targetFormData.currency,
        period: targetFormData.period,
        startDate: targetFormData.startDate || undefined,
        endDate: targetFormData.endDate || undefined,
        description: targetFormData.description,
        isActive: targetFormData.isActive,
        autoSync: targetFormData.autoSync,
        status: targetFormData.status
      };

      let res;
      if (editingTarget) {
        res = await api.put(`/targets/${editingTarget._id}`, payload);
      } else {
        res = await api.post('/targets', payload);
      }

      if (res.success) {
        setShowTargetModal(false);
        fetchTargets();
        fetchTeamBreakdown();
        if (onTargetUpdated) onTargetUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleSetActiveTarget = async (id: string) => {
    try {
      const res = await api.patch(`/targets/${id}/active`);
      if (res.success) {
        fetchTargets();
        if (onTargetUpdated) onTargetUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to set active target');
    }
  };

  // Influencer Record Handlers
  const openAddModal = (defaultCategory: 'Paid' | 'Barter' = 'Barter') => {
    setEditingItem(null);
    setInfluencerManager('');
    setBrandManagerTeam('');
    setInfluencerName('');
    setInfluencerInstagramId('');
    setSelectedBrandId('');
    setCustomBrandName('');
    setPhone('');
    setProfileLink('');
    setCategory(defaultCategory);
    setBrandOnboardingAmt('');
    setBrandReceivedAmt('');
    setInfluencerOnboardingAmt('');
    setInfluencerPaidAmt('');
    setFinalPaymentReceived(false);
    setProductLink('');
    setVideoType('Single Product Video');
    setVideoDescription('');
    setRefVideoLink('');
    setOrderId('');
    setOrderDate('');
    setPlatform('Instagram');
    setStatus('Pending');
    setApprovalStatus('Pending');
    setReason('');
    setContentLink('');
    setAdsCode('');
    setViewsCount('');
    setOrdersCount('');
    setIsApproved(false);
    setTransactionDate('');
    setConnectedDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setRemark('');
    setMoneyReceivedBy('');
    setPaymentDoneBy('');
    setShowModal(true);
  };

  const openEditModal = (item: InfluencerTransaction) => {
    setEditingItem(item);
    setInfluencerManager(item.influencerManager || '');
    setBrandManagerTeam(item.brandManagerTeam || '');
    setInfluencerName(item.influencerName || '');
    setInfluencerInstagramId(item.influencerInstagramId || item.profileLink || '');
    setSelectedBrandId(typeof item.brandId === 'object' ? item.brandId?._id : item.brandId || '');
    setCustomBrandName(item.brandName);
    setPhone(item.phone || '');
    setProfileLink(item.profileLink || '');
    setCategory(item.category);
    setBrandOnboardingAmt(item.brandOnboardingAmt || item.inAmount || 0);
    setBrandReceivedAmt(item.brandReceivedAmt || item.inAmount || 0);
    setInfluencerOnboardingAmt(item.influencerOnboardingAmt || item.outAmount || 0);
    setInfluencerPaidAmt(item.influencerPaidAmt || item.outAmount || 0);
    setFinalPaymentReceived(!!item.finalPaymentReceived);
    setProductLink(item.productLink || '');
    setVideoType(item.videoType || 'Single Product Video');
    setVideoDescription(item.videoDescription || '');
    setRefVideoLink(item.refVideoLink || item.referenceVideoLink || '');
    setOrderId(item.orderId || '');
    setOrderDate(item.orderDate ? item.orderDate.split('T')[0] : '');
    setPlatform(item.platform || 'Instagram');
    setStatus((item.status as any) || 'Pending');
    setApprovalStatus(item.approvalStatus || (item.isApproved ? 'Approved' : 'Pending'));
    setReason(item.reason || '');
    setContentLink(item.contentLink || '');
    setAdsCode(item.adsCode || '');
    setViewsCount(item.viewsCount || 0);
    setOrdersCount(item.ordersCount || 0);
    setIsApproved(item.isApproved !== undefined ? item.isApproved : false);
    setTransactionDate(item.transactionDate ? item.transactionDate.split('T')[0] : '');
    setConnectedDate(item.connectedDate ? item.connectedDate.split('T')[0] : (item.transactionDate ? item.transactionDate.split('T')[0] : new Date().toISOString().split('T')[0]));
    setNotes(item.notes || '');
    setRemark(item.remark || '');
    setMoneyReceivedBy(item.moneyReceivedBy || '');
    setPaymentDoneBy(item.paymentDoneBy || '');
    setShowModal(true);
  };

  const handleSubmitInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInfluencer(true);
    try {
      const brandObj = brands.find(b => b._id === selectedBrandId);
      const bName = brandObj ? brandObj.brandName : (customBrandName || 'Bunaiwala');

      const cleanHandle = influencerInstagramId.trim();
      const cleanProfileLink = cleanHandle
        ? (cleanHandle.startsWith('http') ? cleanHandle : `https://instagram.com/${cleanHandle.replace(/^@/, '')}`)
        : '';

      const payload = {
        influencerManager,
        brandManagerTeam,
        influencerName: influencerName.trim(),
        influencerInstagramId: cleanHandle,
        brandId: selectedBrandId || undefined,
        brandName: bName,
        phone,
        profileLink: cleanProfileLink,
        category,
        brandOnboardingAmt: Number(brandOnboardingAmt) || 0,
        brandReceivedAmt: Number(brandReceivedAmt) || 0,
        influencerOnboardingAmt: Number(influencerOnboardingAmt) || 0,
        influencerPaidAmt: Number(influencerPaidAmt) || 0,
        finalPaymentReceived,
        productLink,
        videoType,
        videoDescription,
        refVideoLink,
        orderId,
        orderDate,
        platform,
        status,
        contentLink,
        adsCode,
        viewsCount: Number(viewsCount) || 0,
        ordersCount: Number(ordersCount) || 0,
        isApproved,
        transactionDate,
        connectedDate,
        notes,
        remark,
        moneyReceivedBy,
        paymentDoneBy
      };

      let res;
      if (editingItem) {
        res = await api.put(`/influencers/${editingItem._id}`, payload);
      } else {
        res = await api.post('/influencers', payload);
      }

      if (res.success) {
        setShowModal(false);
        fetchInfluencers();
        fetchTargets();
        if (onTargetUpdated) onTargetUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save influencer record');
    } finally {
      setSubmittingInfluencer(false);
    }
  };

  // Delete Confirmation Panel State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    itemType: string;
    itemName?: string;
    warningMessage?: string;
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: 'Confirm Delete',
    itemType: 'record',
    loading: false,
    onConfirm: async () => {}
  });

  // Multi-Record Selection State for Ledger
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedRecordIds([]);
  };

  const requestBulkDeleteInfluencers = () => {
    if (selectedRecordIds.length === 0) return;
    setDeleteModalState({
      isOpen: true,
      title: `Delete ${selectedRecordIds.length} Collaboration Records`,
      itemType: `${selectedRecordIds.length} Selected Records`,
      itemName: `${selectedRecordIds.length} collaboration item${selectedRecordIds.length > 1 ? 's' : ''}`,
      warningMessage: 'These records will be soft-deleted. Monthly targets and revenue margins will recalculate immediately.',
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.post('/influencers/bulk-delete', { ids: selectedRecordIds });
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            setSelectedRecordIds([]);
            fetchInfluencers();
            fetchTargets();
            if (onTargetUpdated) onTargetUpdated();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete selected records');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Import Previous Month / Custom Collaborations State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileBase64, setImportFileBase64] = useState<string>('');
  const [importMonthOverride, setImportMonthOverride] = useState<string>('auto');
  const [importYearOverride, setImportYearOverride] = useState<number>(new Date().getFullYear());
  const [importPreviewList, setImportPreviewList] = useState<any[]>([]);
  const [importTotalRows, setImportTotalRows] = useState<number>(0);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDownloadSampleTemplate = () => {
    const csvContent = [
      'Date,Brand Name,Brand Manager,Assigne,Collab Type,Product Link,Type Of Video,ReferanceVideo Link,Status',
      '02/09/2026,Morani Boutique,Lakshit,Gunjan,Barter,https://moraniboutique.com/product-1,Voice Over,https://pin.it/sample,Pending',
      '02/09/2026,Morani Boutique,Lakshit,Gunjan,Barter,https://moraniboutique.com/product-2,Single Product Video,,Pending',
      '03/09/2026,Walkinwardrobe,Lakshita Jaju,Khushi,Barter,https://walkinwardrobe.in/product-3,Single Product Video,https://pin.it/ref1,Under Review',
      '03/09/2026,zaliba,Lakshita Jaju,Kajal,Barter,https://zaliba.com/product-4,Single Product Video,,Completed',
      '03/09/2026,zaliba,Lakshita Jaju,Kajal,Paid,https://zaliba.com/product-5,Single Product Video,,Pending'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Ad2Ship_Collaborations_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = (file: File) => {
    setImportFile(file);
    setImportStatusMessage(null);
    setIsReadingFile(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Str = e.target?.result as string;
      setImportFileBase64(base64Str);

      try {
        const res = await api.post('/influencers/import-preview', {
          fileBase64: base64Str,
          targetMonth: importMonthOverride !== 'auto' ? importMonthOverride.split('_')[0] : undefined,
          targetYear: importYearOverride
        });

        if (res.success) {
          setImportPreviewList(res.preview || []);
          setImportTotalRows(res.totalRows || 0);
        } else {
          setImportStatusMessage({ type: 'error', text: res.message || 'Failed to read file preview' });
        }
      } catch (err: any) {
        setImportStatusMessage({ type: 'error', text: err.message || 'Error processing file preview' });
      } finally {
        setIsReadingFile(false);
      }
    };

    reader.onerror = () => {
      setIsReadingFile(false);
      setImportStatusMessage({ type: 'error', text: 'Failed to read the selected file' });
    };

    reader.readAsDataURL(file);
  };

  const handleConfirmImport = async () => {
    if (!importFileBase64) return;
    setIsSubmittingImport(true);
    setImportStatusMessage(null);

    try {
      const res = await api.post('/influencers/import', {
        fileBase64: importFileBase64,
        targetMonth: importMonthOverride !== 'auto' ? importMonthOverride.split('_')[0] : undefined,
        targetYear: importYearOverride
      });

      if (res.success) {
        setImportStatusMessage({ type: 'success', text: `Successfully imported ${res.count || 0} collaboration records!` });
        fetchInfluencers();
        fetchTargets();
        if (onTargetUpdated) onTargetUpdated();
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportFile(null);
          setImportFileBase64('');
          setImportPreviewList([]);
          setImportStatusMessage(null);
        }, 1600);
      } else {
        setImportStatusMessage({ type: 'error', text: res.message || 'Import failed' });
      }
    } catch (err: any) {
      setImportStatusMessage({ type: 'error', text: err.message || 'Failed to submit import' });
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const requestDeleteTarget = (t: TargetItem) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Target',
      itemType: 'Target Record',
      itemName: `${t.title} (${t.period || ''})`,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/targets/${t._id}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            fetchTargets();
            if (onTargetUpdated) onTargetUpdated();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete target');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const requestDeleteInfluencer = (item: InfluencerTransaction) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Collaboration Record',
      itemType: `${item.category || 'Influencer'} Collaboration`,
      itemName: `${item.brandName || 'Brand'} — ${item.influencerName || item.influencerInstagramId || 'Creator'}`,
      warningMessage: 'This record will be soft-deleted. Target achievements and revenue margins will recalculate immediately.',
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/influencers/${item._id}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            setSelectedRecordIds(prev => prev.filter(id => id !== item._id));
            fetchInfluencers();
            fetchTargets();
            if (onTargetUpdated) onTargetUpdated();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete record');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const requestDeletePaymentLog = (log: PaymentLogItem) => {
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Payment Audit Log',
      itemType: 'Payment Audit Log',
      itemName: `${log.type === 'IN' ? 'Inward' : 'Outward'} Payment of ₹${(log.amount || 0).toLocaleString()} (${log.brandName} - ${log.influencerName})`,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/influencers/payment-logs/${log._id}`);
          setDeleteModalState(prev => ({ ...prev, isOpen: false }));
          fetchPaymentLogs();
        } catch (err: any) {
          alert(err.message || 'Failed to delete log');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Payment Log Handlers
  const openPaymentModal = () => {
    setPayLogInfluencerName('');
    setPayLogBrandName('');
    setPayLogType('IN');
    setPayLogAmount('');
    setPayLogMode('Bank Transfer');
    setPayLogRefNo('');
    setPayLogHandledBy('');
    setPayLogDate(new Date().toISOString().split('T')[0]);
    setPayLogNotes('');
    setShowPaymentModal(true);
  };

  const handlePaymentLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayLog(true);
    try {
      const res = await api.post('/influencers/payment-logs', {
        influencerName: payLogInfluencerName,
        brandName: payLogBrandName || 'Bunaiwala',
        type: payLogType,
        amount: Number(payLogAmount) || 0,
        paymentMode: payLogMode,
        referenceNo: payLogRefNo,
        handledBy: payLogHandledBy,
        transactionDate: payLogDate,
        notes: payLogNotes
      });
      if (res.success) {
        setShowPaymentModal(false);
        fetchPaymentLogs();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to log payment entry');
    } finally {
      setSavingPayLog(false);
    }
  };

  // Inline table update handlers
  const handleStatusChange = async (id: string, newStatus: string) => {
    setInfluencers(prev => prev.map(i => i._id === id ? { ...i, status: newStatus as any } : i));
    try {
      await api.put(`/influencers/${id}`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status', err);
      fetchInfluencers();
    }
  };

  const handleApprovalChange = async (id: string, newApproved: boolean) => {
    setInfluencers(prev => prev.map(i => i._id === id ? { ...i, isApproved: newApproved } : i));
    try {
      await api.put(`/influencers/${id}`, { isApproved: newApproved });
    } catch (err) {
      console.error('Failed to update approval status', err);
      fetchInfluencers();
    }
  };

  // Dynamic Unique Options for Toolbar Dropdowns (Fetched from DB & Active Records)
  const uniqueBrands: string[] = Array.from(new Set([
    ...brands.map(b => b.brandName?.trim()).filter((x): x is string => Boolean(x)),
    ...(dbFilterOptions.brands || []),
    ...influencers.map(i => i.brandName?.trim()).filter((x): x is string => Boolean(x))
  ])).sort();

  const uniqueManagers: string[] = Array.from(new Set([
    ...employees.map(e => e.name?.trim()).filter((x): x is string => Boolean(x)),
    ...(teamBreakdown?.members?.map(m => m.employee.name?.trim()) || []),
    ...(dbFilterOptions.managers || []),
    ...influencers.map(i => i.influencerManager?.trim()).filter((x): x is string => Boolean(x))
  ])).sort();

  const panelMemberOptions: string[] = Array.from(new Set([
    ...employees.map(e => e.name?.trim()).filter((x): x is string => Boolean(x)),
    ...(teamBreakdown?.members?.map(m => m.employee.name?.trim()) || []),
    ...(dbFilterOptions.managers || [])
  ])).filter(name => name.length > 0).sort();

  const ALL_STATUS_OPTIONS = [
    { label: 'Pending', value: 'Pending', icon: '🟠' },
    { label: 'In Discussion', value: 'In Discussion', icon: '💬' },
    { label: 'Parcel Sent', value: 'Parcel Sent', icon: '📦' },
    { label: 'Under Review', value: 'Under Review', icon: '🟡' },
    { label: 'Completed', value: 'Completed', icon: '🟢' },
    { label: 'Settled', value: 'Settled', icon: '🟣' }
  ];

  const uniqueDeliverables: string[] = (dbFilterOptions.deliverables && dbFilterOptions.deliverables.length > 0)
    ? dbFilterOptions.deliverables
    : Array.from(new Set(
        influencers
          .filter(i => viewMode === 'All Collaborations' || i.category === (viewMode === 'Barter Collaborations' ? 'Barter' : 'Paid'))
          .map(i => i.videoType?.trim())
          .filter((x): x is string => Boolean(x))
      )).sort();

  const hasActiveFilters = !!(filterBrand || filterManager || filterStatus || filterDeliverable || searchTerm);

  const resetAllFilters = () => {
    setFilterBrand('');
    setFilterManager('');
    setFilterStatus('');
    setFilterDeliverable('');
    setSearchTerm('');
  };

  // Filtered & Sorted Influencers (Searches only within the active tab view)
  const filteredInfluencers = influencers.filter(i => {
    if (viewMode === 'Paid Collaborations' && i.category !== 'Paid') return false;
    if (viewMode === 'Barter Collaborations' && i.category !== 'Barter') return false;

    // Filter by Brand
    if (filterBrand && (i.brandName || '').trim().toLowerCase() !== filterBrand.toLowerCase()) {
      return false;
    }

    // Filter by Manager / Assignee
    if (filterManager) {
      if (filterManager === '__UNASSIGNED__') {
        if (i.influencerManager && i.influencerManager.trim().length > 0) return false;
      } else if ((i.influencerManager || '').trim().toLowerCase() !== filterManager.toLowerCase()) {
        return false;
      }
    }

    // Filter by Status
    if (filterStatus) {
      if (filterStatus === 'Completed') {
        if (!isAchievedStatus(i.status)) return false;
      } else if (filterStatus === 'Pending') {
        if (isAchievedStatus(i.status)) return false;
      } else if ((i.status || '').trim().toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }
    }

    // Filter by Deliverable
    if (filterDeliverable) {
      if ((i.videoType || '').trim().toLowerCase() !== filterDeliverable.toLowerCase()) {
        return false;
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchInf = i.influencerName?.toLowerCase().includes(term);
      const matchBrand = i.brandName?.toLowerCase().includes(term);
      const matchMgr = i.influencerManager?.toLowerCase().includes(term);
      const matchPhone = i.phone?.toLowerCase().includes(term);
      const matchPlatform = i.platform?.toLowerCase().includes(term);
      const matchVideo = i.videoType?.toLowerCase().includes(term);
      if (!matchInf && !matchBrand && !matchMgr && !matchPhone && !matchPlatform && !matchVideo) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    let valA = (a as any)[sortKey];
    let valB = (b as any)[sortKey];

    if (sortKey === 'sNo') {
      valA = a.sNo || 0;
      valB = b.sNo || 0;
    } else if (sortKey === 'transactionDate') {
      valA = a.transactionDate ? new Date(a.transactionDate).getTime() : (a.connectedDate ? new Date(a.connectedDate).getTime() : 0);
      valB = b.transactionDate ? new Date(b.transactionDate).getTime() : (b.connectedDate ? new Date(b.connectedDate).getTime() : 0);
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return (a.sNo || 0) - (b.sNo || 0);
  });

  // Calculate Metrics from Current View (Include all paid collaborations for metric card totals)
  const allPaidCollabs = influencers.filter(i => i.category === 'Paid');
  const allBarterCollabs = influencers.filter(i => i.category === 'Barter');
  const paidCollabs = influencers.filter(i => i.category === 'Paid' && isAchievedStatus(i.status));
  const barterCollabs = influencers.filter(i => i.category === 'Barter' && isAchievedStatus(i.status));

  const totalBrandBilling = allPaidCollabs.reduce((acc, curr) => acc + (curr.brandOnboardingAmt || curr.inAmount || 0), 0);
  const totalInfluencerCost = allPaidCollabs.reduce((acc, curr) => acc + (curr.influencerOnboardingAmt || curr.outAmount || 0), 0);
  const netAd2shipMargin = totalBrandBilling - totalInfluencerCost;
  const marginPercentage = totalBrandBilling > 0 ? Math.round((netAd2shipMargin / totalBrandBilling) * 100) : 0;

  const totalBrandReceived = allPaidCollabs.reduce((acc, curr) => acc + (curr.brandReceivedAmt || curr.inAmount || 0), 0);
  const totalInfluencerPaid = allPaidCollabs.reduce((acc, curr) => acc + (curr.influencerPaidAmt || curr.outAmount || 0), 0);
  const cashflowBalance = totalBrandReceived - totalInfluencerPaid;

  const totalBarterViews = allBarterCollabs.reduce((acc, curr) => acc + (curr.viewsCount || 0), 0);
  const totalBarterOrders = allBarterCollabs.reduce((acc, curr) => acc + (curr.ordersCount || curr.ordersGenerated || 0), 0);

  // Active Target Calculations
  const activePaidTarget = targets.find(t => t.isActive && (t.targetType === 'Paid' || !t.targetType)) || targets.find(t => (t.targetType === 'Paid' || !t.targetType));
  const activeBarterTarget = targets.find(t => t.isActive && t.targetType === 'Barter') || targets.find(t => t.targetType === 'Barter');

  const paidAchieved = isEmployee
    ? (myMember?.netMargin !== undefined ? myMember.netMargin : (activePaidTarget ? activePaidTarget.achievedAmount : netAd2shipMargin))
    : (activePaidTarget ? activePaidTarget.achievedAmount : (teamBreakdown?.teamAchievedMargin || netAd2shipMargin));
  const paidGoal = isEmployee
    ? 120000
    : (activePaidTarget ? activePaidTarget.targetAmount : (teamBreakdown?.teamTargetAmount || 720000));
  const paidPct = paidGoal > 0 ? Math.min(100, Math.round((paidAchieved / paidGoal) * 100)) : 0;

  const barterAchieved = isEmployee
    ? (myMember?.barterCount !== undefined ? myMember.barterCount : barterCollabs.length)
    : (activeBarterTarget ? (activeBarterTarget.achievedCount || activeBarterTarget.achievedAmount || 0) : (teamBreakdown?.teamAchievedBarterCount || barterCollabs.length));

  const barterGoal = isEmployee
    ? (myMember?.individualBarterTarget || (activeBarterTarget ? (activeBarterTarget.targetCount || activeBarterTarget.targetAmount) : 0))
    : ((activeBarterTarget && activeBarterTarget.targetAmount) ? (activeBarterTarget.targetCount || activeBarterTarget.targetAmount) : (teamBreakdown?.teamBarterTarget || 0));

  const barterPct = barterGoal > 0 ? Math.min(100, Math.round((barterAchieved / barterGoal) * 100)) : 0;

  // Table Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInfluencers.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedInfluencers = filteredInfluencers.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const isAllSelectedOnPage =
    paginatedInfluencers.length > 0 &&
    paginatedInfluencers.every(item => selectedRecordIds.includes(item._id));

  const isSomeSelectedOnPage =
    paginatedInfluencers.some(item => selectedRecordIds.includes(item._id)) && !isAllSelectedOnPage;

  const handleToggleSelectAllPage = () => {
    if (isAllSelectedOnPage) {
      const pageIds = new Set(paginatedInfluencers.map(i => i._id));
      setSelectedRecordIds(prev => prev.filter(id => !pageIds.has(id)));
    } else {
      const newIds = new Set(selectedRecordIds);
      paginatedInfluencers.forEach(i => newIds.add(i._id));
      setSelectedRecordIds(Array.from(newIds));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedRecordIds(filteredInfluencers.map(i => i._id));
  };

  const SortHeader = ({ field, label, align = 'left' }: { field: string; label: string; align?: 'left' | 'right' | 'center' }) => {
    const isSorted = sortKey === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-3.5 py-3 border-b border-r border-slate-700/80 select-none cursor-pointer hover:bg-slate-700/90 transition-colors bg-slate-800 text-slate-200 text-xs font-bold ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className="truncate">{label}</span>
          {isSorted ? (
            sortDir === 'asc' ? <ChevronUp size={13} className="text-purple-300" /> : <ChevronDown size={13} className="text-purple-300" />
          ) : (
            <ChevronsUpDown size={11} className="text-slate-400 opacity-40 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Influencer & Revenue Management</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Paid Collaboration Profit Margins, Barter Collaboration Count Goals, and Complete Payment In/Out Ledger.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {isTargetManager && (
            <button
              onClick={() => handleOpenCreateTargetModal('Paid')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs flex items-center space-x-2 transition"
            >
              <Target size={16} className="text-purple-600" />
              <span>Set Target</span>
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs flex items-center space-x-2 transition cursor-pointer"
            title="Import past or custom month collaboration records from Excel/CSV"
          >
            <Upload size={16} />
            <span>Import Collabs</span>
          </button>

          <button
            onClick={() => openAddModal(viewMode === 'Paid Collaborations' ? 'Paid' : 'Barter')}
            className="px-4 py-2.5 btn-gradient-primary text-white rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md transition"
          >
            <Plus size={16} />
            <span>Add Collaboration</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setViewMode('Targets & Goals')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition ${
              viewMode === 'Targets & Goals'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
            }`}
          >
            <Target size={15} />
            <span>Targets & Goals</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
              viewMode === 'Targets & Goals' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
            }`}>
              {targets.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('Paid Collaborations')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition ${
              viewMode === 'Paid Collaborations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
            }`}
          >
            <DollarSign size={15} />
            <span>Paid Collaborations</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
              viewMode === 'Paid Collaborations' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {tabCounts.paid || 0}
            </span>
          </button>

          <button
            onClick={() => setViewMode('Barter Collaborations')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition ${
              viewMode === 'Barter Collaborations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
            }`}
          >
            <ShoppingBag size={15} />
            <span>Barter Collaborations</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
              viewMode === 'Barter Collaborations' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {tabCounts.barter || 0}
            </span>
          </button>

          <button
            onClick={() => setViewMode('Payment Audit Logs')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition ${
              viewMode === 'Payment Audit Logs'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
            }`}
          >
            <Receipt size={15} />
            <span>Payment Audit Logs</span>
          </button>

          <button
            onClick={() => setViewMode('All Collaborations')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition ${
              viewMode === 'All Collaborations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
            }`}
          >
            <Layers size={15} />
            <span>All Records</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
              viewMode === 'All Collaborations' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {tabCounts.all || ((tabCounts.paid || 0) + (tabCounts.barter || 0))}
            </span>
          </button>
        </div>

        {/* Global Filters with Modern Visual Calendar Picker */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          <MonthDatePicker 
            timeframe={timeframe} 
            onChange={(newTimeframe) => setTimeframe(newTimeframe)} 
          />

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search influencer / brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-medium w-48 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: TARGETS & REVENUE GOALS */}
      {viewMode === 'Targets & Goals' && (
        <div className="space-y-6">
          {/* 1. Executive Summary Targets Grid (2 Clean Modern Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Paid Revenue & Margin Target */}
            <div className="bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-3xl p-5 border border-emerald-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200 shadow-2xs">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      {isTargetEmployee ? 'Personal Paid Margin Goal' : 'Team Paid Margin Target'}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">
                      {isTargetEmployee ? 'Monthly Quota: ₹1,20,000' : (activePaidTarget ? activePaidTarget.title : 'Monthly Revenue Target')}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    {activePaidTarget ? activePaidTarget.period : `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`}
                  </span>
                  {isTargetManager && activePaidTarget && (
                    <button
                      onClick={() => handleOpenEditTargetModal(activePaidTarget)}
                      className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-purple-700 border border-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
                      title="Edit Paid Target"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Numbers Overview */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/80 p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Target Margin</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">
                    {isTargetManager ? `₹${new Intl.NumberFormat().format(paidGoal)}` : '₹1,20,000'}
                  </p>
                </div>
                <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
                  <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Achieved Margin</p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">
                    {isTargetManager ? `₹${new Intl.NumberFormat().format(paidAchieved)}` : `₹${new Intl.NumberFormat().format(myMember?.netMargin || 0)}`}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <TrendingUp size={13} /> {paidPct}% Progress
                  </span>
                  <span className="text-slate-500 text-[11px] font-bold">
                    {isTargetManager ? `Remaining: ₹${new Intl.NumberFormat().format(Math.max(0, paidGoal - paidAchieved))}` : `${myMember?.targetAchievedPercent || 0}% Met`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500 shadow-xs"
                    style={{ width: `${Math.min(100, Math.max(paidPct, 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Barter Collabs Volume Goal */}
            <div className="bg-gradient-to-br from-white via-purple-50/20 to-white rounded-3xl p-5 border border-purple-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold border border-purple-200 shadow-2xs">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded-md">
                      {isEmployee ? 'Personal Barter Goal' : 'Barter Collabs Goal'}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">
                      {isEmployee ? 'My Assigned Brands Barter Deals' : (activeBarterTarget ? activeBarterTarget.title : 'Monthly Barter Target')}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    {activeBarterTarget ? activeBarterTarget.period : `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`}
                  </span>
                  {isTargetManager && activeBarterTarget && (
                    <button
                      onClick={() => handleOpenEditTargetModal(activeBarterTarget)}
                      className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-purple-700 border border-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
                      title="Edit Barter Target"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Numbers Overview */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/80 p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Target Collabs</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">
                    {barterGoal} <span className="text-xs font-bold text-slate-400">Deals</span>
                  </p>
                </div>
                <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200/80 shadow-2xs">
                  <p className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">Achieved Deals</p>
                  <p className="text-xl font-black text-purple-700 mt-0.5">
                    {barterAchieved} <span className="text-xs font-bold text-slate-400">Completed</span>
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-purple-700 flex items-center gap-1">
                    <Award size={13} /> {barterPct}% Completed
                  </span>
                  <span className="text-slate-500 text-[11px] font-bold">
                    Remaining: {Math.max(0, barterGoal - barterAchieved)} Deals
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500 shadow-xs"
                    style={{ width: `${Math.min(100, Math.max(barterPct, 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Commission Slabs Quick Pill Bar */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-3.5 rounded-2xl border border-purple-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 text-xs text-slate-800 font-bold">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Award size={15} />
              </span>
              <span>
                <strong>Incentive Slabs:</strong> Tier 1 (10% on ₹1L+ Margin) • Tier 2 (5% on ₹80k+ Margin) • Viral Video (+10% Bonus on 100+ orders)
              </span>
            </div>
            <button
              onClick={() => setIsSlabsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold text-xs transition shadow-2xs shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Info size={13} /> View Slab Details & Rules
            </button>
          </div>

          {/* 3. Team Quota & Performance Section (Searchable Table & Card View with Server Pagination) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Users size={18} className="text-purple-600" />
                  {isEmployee ? 'My Monthly Quota & Performance' : 'Team Member Quotas & Performance'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {isEmployee
                    ? 'Your auto-calculated quota, achieved margins, slab eligibility, and calculated take-home.'
                    : `Tracking quota, live margin progress, and commission eligibility for ${teamTotalItems || teamBreakdown?.members?.length || 0} executive(s).`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Executive with live API hit */}
                {!isEmployee && (
                  <div className="relative min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={teamSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTeamSearchQuery(val);
                        setTeamPage(1);
                        fetchTeamBreakdown(1, val);
                      }}
                      placeholder="Search executive..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/60"
                    />
                    {teamSearchQuery && (
                      <button
                        onClick={() => {
                          setTeamSearchQuery('');
                          setTeamPage(1);
                          fetchTeamBreakdown(1, '');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* View Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  <button
                    onClick={() => setTeamViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                      teamViewMode === 'table' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List size={13} /> Table
                  </button>
                  <button
                    onClick={() => setTeamViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                      teamViewMode === 'cards' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid size={13} /> Cards
                  </button>
                </div>
              </div>
            </div>

            {/* RENDER TABLE OR CARDS WITH SERVER PAGINATION */}
            {teamLoading ? (
              <div className="py-12">
                <InlineLoader message="Loading team performance quotas..." />
              </div>
            ) : !teamBreakdown?.members || teamBreakdown.members.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                No team members found{teamSearchQuery ? ` matching "${teamSearchQuery}"` : ''}.
              </div>
            ) : teamViewMode === 'table' ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-200 font-bold">
                      <th className="p-3 text-center w-12 border-b border-r border-slate-700">S.No</th>
                      <th className="p-3 border-b border-r border-slate-700">Executive</th>
                      <th className="p-3 border-b border-r border-slate-700">Paid Margin & Goal</th>
                      <th className="p-3 border-b border-r border-slate-700 text-center">Barter Deals</th>
                      <th className="p-3 border-b border-r border-slate-700 text-center">Incentive Slab</th>
                      <th className="p-3 border-b border-r border-slate-700 text-right">Take-Home Bonus</th>
                      <th className="p-3 border-b border-slate-700 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800 bg-white">
                    {teamBreakdown.members.map((m, idx) => {
                      const isTier1 = m.targetTier === '10%';
                      const isTier2 = m.targetTier === '5%';
                      const serialNo = (teamPage - 1) * teamLimit + idx + 1;

                      return (
                        <tr key={m.employee.id} className="hover:bg-purple-50/40 transition">
                          <td className="p-3 text-center font-bold text-slate-400 border-r border-slate-100">
                            {serialNo}
                          </td>
                          <td className="p-3 border-r border-slate-100">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shadow-2xs shrink-0">
                                {m.employee.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">{m.employee.name}</div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                  <span className="font-bold text-purple-700">{m.employee.employeeId}</span> • {m.employee.assignedBrandsCount} Brands
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 border-r border-slate-100 min-w-[180px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-900 font-extrabold">
                                  ₹{new Intl.NumberFormat().format(m.netMargin)}
                                </span>
                                <span className="text-purple-600 text-[10px]">
                                  {m.targetAchievedPercent}% of ₹1.2L
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(m.targetAchievedPercent, 0))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 border-r border-slate-100 text-center">
                            <span className="font-extrabold text-slate-800">
                              {m.barterCount} / {m.individualBarterTarget || 0}
                            </span>
                            <span className="block text-[10px] text-purple-600 font-bold">
                              {m.barterAchievedPercent || 0}% Done
                            </span>
                          </td>
                          <td className="p-3 border-r border-slate-100 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              isTier1 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isTier2 ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {isTier1 ? '🏆 10% Slab' : isTier2 ? '🥈 5% Slab' : '0% Slab'}
                            </span>
                          </td>
                          <td className="p-3 border-r border-slate-100 text-right">
                            <span className="font-black text-emerald-600 text-xs">
                              ₹{new Intl.NumberFormat().format(m.totalTakeHomeIncentive)}
                            </span>
                            {m.qualifyingBonusDealsCount > 0 && (
                              <span className="block text-[9px] text-amber-700 font-bold">
                                +{m.qualifyingBonusDealsCount} viral deal(s)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedMemberForDetail(m);
                                setDetailActiveTab('overview');
                              }}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold rounded-lg text-[11px] transition cursor-pointer border border-purple-200/80 shadow-2xs"
                            >
                              View Deals →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamBreakdown.members.map((m) => {
                  const isTier1 = m.targetTier === '10%';
                  const isTier2 = m.targetTier === '5%';

                  return (
                    <div
                      key={m.employee.id}
                      onClick={() => {
                        setSelectedMemberForDetail(m);
                        setDetailActiveTab('overview');
                      }}
                      className="p-4 bg-slate-50/80 hover:bg-white rounded-2xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs group-hover:scale-105 transition-transform">
                            {m.employee.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-xs group-hover:text-purple-700 transition-colors flex items-center gap-1">
                              <span>{m.employee.name}</span>
                              <ArrowUpRight size={12} className="text-slate-400 group-hover:text-purple-600 opacity-0 group-hover:opacity-100 transition" />
                            </h4>
                            <span className="text-[10px] text-purple-600 font-bold">{m.employee.employeeId} • {m.employee.assignedBrandsCount} Brands</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          isTier1 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isTier2 ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {isTier1 ? '🏆 10% Slab' : isTier2 ? '🥈 5% Slab (80k+)' : '0% Slab'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-600">
                            Net Margin: <strong className="text-slate-900">₹{new Intl.NumberFormat().format(m.netMargin)}</strong>
                          </span>
                          <span className="text-purple-600">{m.targetAchievedPercent}% of ₹1.2L</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${m.targetAchievedPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Barter */}
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Barter: <strong className="text-purple-700">{m.barterCount} / {m.individualBarterTarget || 0}</strong></span>
                        <span className="text-purple-600 font-extrabold">{m.barterAchievedPercent || 0}% Goal</span>
                      </div>

                      {/* Take Home */}
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-black text-emerald-700">Take-Home:</span>
                        <span className="font-black text-emerald-600 text-sm">₹{new Intl.NumberFormat().format(m.totalTakeHomeIncentive)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Server-Side Pagination */}
            <Pagination
              currentPage={teamPage}
              totalPages={teamTotalPages}
              totalItems={teamTotalItems}
              itemsPerPage={teamLimit}
              onPageChange={(newPage) => {
                setTeamPage(newPage);
                fetchTeamBreakdown(newPage, teamSearchQuery);
              }}
            />
          </div>

          {/* Full Target Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Target size={20} className="text-purple-600" />
                  Target Records Directory
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  All active & historical AD2ship monthly targets.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 font-bold">
                    <th className="p-3 border-b border-r border-slate-700">Target Title</th>
                    <th className="p-3 border-b border-r border-slate-700">Type</th>
                    <th className="p-3 border-b border-r border-slate-700 text-right">Target Goal</th>
                    <th className="p-3 border-b border-r border-slate-700 text-right">Achieved</th>
                    <th className="p-3 border-b border-r border-slate-700">Progress</th>
                    <th className="p-3 border-b border-r border-slate-700">Period</th>
                    <th className="p-3 border-b border-r border-slate-700 text-center">Status</th>
                    <th className="p-3 border-b border-slate-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {targets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 font-semibold">
                        No targets created yet. Click "+ Set Monthly Target" to get started.
                      </td>
                    </tr>
                  ) : (
                    targets.map((t) => {
                      const isBarter = t.targetType === 'Barter';
                      const goalVal = isBarter 
                        ? (isTargetEmployee ? barterGoal : (t.targetCount || t.targetAmount))
                        : (isTargetEmployee ? 120000 : t.targetAmount);
                      const achVal = isBarter 
                        ? (isTargetEmployee ? barterAchieved : (t.achievedCount || t.achievedAmount || 0))
                        : (isTargetEmployee ? (myMember?.netMargin !== undefined ? myMember.netMargin : (t.achievedAmount || 0)) : (t.achievedAmount || 0));
                      const pct = Math.min(100, Math.round(((achVal || 0) / (goalVal || 1)) * 100));

                      return (
                        <tr key={t._id} className={`hover:bg-slate-50 transition ${t.isActive ? 'bg-purple-50/40 font-semibold' : ''}`}>
                          <td className="p-3 border-r border-slate-100">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {t.isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Banner Target" />}
                              <span>{t.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium line-clamp-1">{t.description || 'Monthly AD2ship Target'}</span>
                          </td>

                          <td className="p-3 border-r border-slate-100">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                              isBarter ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                            }`}>
                              {t.targetType || 'Paid'}
                            </span>
                          </td>

                          <td className="p-3 border-r border-slate-100 text-right font-extrabold text-slate-900">
                            {isBarter ? `${goalVal} Collabs` : isTargetManager ? `₹${new Intl.NumberFormat().format(goalVal)}` : <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black">PAID</span>}
                          </td>

                          <td className="p-3 border-r border-slate-100 text-right font-extrabold text-emerald-600">
                            {isBarter ? `${achVal} Collabs` : isTargetManager ? `₹${new Intl.NumberFormat().format(achVal)}` : <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">PAID</span>}
                          </td>

                          <td className="p-3 border-r border-slate-100 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isBarter ? 'bg-blue-500' : 'bg-purple-600'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold shrink-0 text-slate-700">{pct}%</span>
                            </div>
                          </td>

                          <td className="p-3 border-r border-slate-100 font-semibold text-slate-600">
                            {t.period}
                          </td>

                          <td className="p-3 border-r border-slate-100 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              t.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {t.status}
                            </span>
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            {isTargetManager && (
                              <div className="flex items-center justify-center gap-2">
                                {!t.isActive ? (
                                  <button
                                    onClick={() => handleSetActiveTarget(t._id)}
                                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold border border-purple-200 transition cursor-pointer"
                                    title="Set as Top Banner Active Target"
                                  >
                                    Set Active
                                  </button>
                                ) : (
                                  <div className="w-[70px]" />
                                )}
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleOpenEditTargetModal(t)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-50 text-purple-600 border border-slate-200 hover:border-purple-200 transition cursor-pointer"
                                    title="Edit Target"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => requestDeleteTarget(t)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                                    title="Delete Target"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2 & VIEW 3 & VIEW 5: PAID / BARTER / ALL COLLABORATIONS */}
      {(viewMode === 'Paid Collaborations' || viewMode === 'Barter Collaborations' || viewMode === 'All Collaborations') && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          {viewMode === 'Barter Collaborations' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Barter Collabs Done</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">{barterCollabs.length}</h4>
                  <p className="text-[11px] text-purple-600 font-semibold mt-0.5">Completed Product Deals</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShoppingBag size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Monthly Goal Progress</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {barterAchieved} {barterGoal > 0 ? `/ ${barterGoal}` : ''}
                  </h4>
                  <p className="text-[11px] text-blue-600 font-bold mt-0.5">
                    {barterGoal > 0 ? `${barterPct}% Goal Achieved` : 'No Active Goal'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Award size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Views Generated</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">{new Intl.NumberFormat().format(totalBarterViews)}</h4>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Sum of Content Views</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Eye size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Orders Driven</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">{new Intl.NumberFormat().format(totalBarterOrders)}</h4>
                  <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">Conversion Product Orders</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>
          ) : isTargetManager ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Brand Onboarding (IN)</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    ₹{new Intl.NumberFormat().format(totalBrandBilling)}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Client Agreed Revenue</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ArrowDownRight size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Creator Cost (OUT)</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    ₹{new Intl.NumberFormat().format(totalInfluencerCost)}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Real Influencer Payout</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold">
                  <ArrowUpRight size={24} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl text-white shadow-md flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-100">AD2ship Profit Margin</p>
                  <h4 className="text-2xl font-black text-white mt-1">
                    ₹{new Intl.NumberFormat().format(netAd2shipMargin)}
                  </h4>
                  <p className="text-[11px] text-emerald-100 font-bold mt-0.5">Margin: {marginPercentage}% Profit</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold backdrop-blur-xs">
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Cashflow Balance</p>
                  <h4 className={`text-2xl font-black mt-1 ${cashflowBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ₹{new Intl.NumberFormat().format(cashflowBalance)}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Received IN - Paid OUT</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Receipt size={24} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Paid Collabs Completed</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">{paidCollabs.length}</h4>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Active Paid Collaborations</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Orders Driven</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {new Intl.NumberFormat().format(paidCollabs.reduce((acc, curr) => acc + (curr.ordersCount || curr.ordersGenerated || 0), 0))}
                  </h4>
                  <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">Paid Video Conversion Orders</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">100+ Order Bonus Videos</p>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {paidCollabs.filter(curr => (curr.ordersCount || curr.ordersGenerated || 0) >= 100).length}
                  </h4>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">High Performance Videos</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Sparkles size={24} />
                </div>
              </div>
            </div>
          )}

          {/* Interactive Pipeline Stage Status Summary Cards */}
          {(() => {
            const listForPipeline = viewMode === 'Barter Collaborations' ? allBarterCollabs : viewMode === 'Paid Collaborations' ? allPaidCollabs : influencers;
            const discussionCount = listForPipeline.filter(i => i.status === 'In Discussion').length;
            const parcelSentCount = listForPipeline.filter(i => i.status === 'Parcel Sent').length;
            const reviewCount = listForPipeline.filter(i => i.status === 'Under Review').length;
            const completedCount = listForPipeline.filter(i => i.status === 'Completed' || i.status === 'Approved' || i.status === 'Settled').length;
            const pendingCount = listForPipeline.filter(i => !i.status || i.status === 'Pending').length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Stage 1: In Discussion */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === 'In Discussion' ? '' : 'In Discussion');
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between group cursor-pointer ${
                    filterStatus === 'In Discussion'
                      ? 'bg-cyan-600 text-white border-cyan-700 ring-2 ring-cyan-400'
                      : 'bg-white border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40 text-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${filterStatus === 'In Discussion' ? 'text-cyan-100' : 'text-cyan-800'}`}>
                      💬 In Discussion
                    </p>
                    <h4 className="text-2xl font-black mt-0.5">{discussionCount}</h4>
                    <p className={`text-[10px] font-bold ${filterStatus === 'In Discussion' ? 'text-cyan-100' : 'text-slate-400'}`}>Talking Terms</p>
                  </div>
                  <div className={`p-2.5 rounded-xl transition ${filterStatus === 'In Discussion' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-800 group-hover:scale-105'}`}>
                    <MessageSquare size={20} />
                  </div>
                </button>

                {/* Stage 2: Parcel Sent */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === 'Parcel Sent' ? '' : 'Parcel Sent');
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between group cursor-pointer ${
                    filterStatus === 'Parcel Sent'
                      ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${filterStatus === 'Parcel Sent' ? 'text-indigo-100' : 'text-indigo-800'}`}>
                      📦 Parcel Sent
                    </p>
                    <h4 className="text-2xl font-black mt-0.5">{parcelSentCount}</h4>
                    <p className={`text-[10px] font-bold ${filterStatus === 'Parcel Sent' ? 'text-indigo-100' : 'text-slate-400'}`}>Dispatched Products</p>
                  </div>
                  <div className={`p-2.5 rounded-xl transition ${filterStatus === 'Parcel Sent' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800 group-hover:scale-105'}`}>
                    <Package size={20} />
                  </div>
                </button>

                {/* Stage 3: Under Review */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === 'Under Review' ? '' : 'Under Review');
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between group cursor-pointer ${
                    filterStatus === 'Under Review'
                      ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400'
                      : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${filterStatus === 'Under Review' ? 'text-amber-100' : 'text-amber-800'}`}>
                      🟡 Under Review
                    </p>
                    <h4 className="text-2xl font-black mt-0.5">{reviewCount}</h4>
                    <p className={`text-[10px] font-bold ${filterStatus === 'Under Review' ? 'text-amber-100' : 'text-slate-400'}`}>Content Submitted</p>
                  </div>
                  <div className={`p-2.5 rounded-xl transition ${filterStatus === 'Under Review' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 group-hover:scale-105'}`}>
                    <Clock size={20} />
                  </div>
                </button>

                {/* Stage 4: Completed / Settled */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === 'Completed' ? '' : 'Completed');
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between group cursor-pointer ${
                    filterStatus === 'Completed'
                      ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${filterStatus === 'Completed' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                      🟢 Completed
                    </p>
                    <h4 className="text-2xl font-black mt-0.5">{completedCount}</h4>
                    <p className={`text-[10px] font-bold ${filterStatus === 'Completed' ? 'text-emerald-100' : 'text-slate-400'}`}>Approved & Settled</p>
                  </div>
                  <div className={`p-2.5 rounded-xl transition ${filterStatus === 'Completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 group-hover:scale-105'}`}>
                    <CheckCircle2 size={20} />
                  </div>
                </button>

                {/* Stage 5: Pending Outreach */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === 'Pending' ? '' : 'Pending');
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 shadow-2xs hover:shadow-md flex items-center justify-between group cursor-pointer ${
                    filterStatus === 'Pending'
                      ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-400'
                      : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 text-slate-800'
                  }`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${filterStatus === 'Pending' ? 'text-orange-100' : 'text-orange-800'}`}>
                      🟠 Pending
                    </p>
                    <h4 className="text-2xl font-black mt-0.5">{pendingCount}</h4>
                    <p className={`text-[10px] font-bold ${filterStatus === 'Pending' ? 'text-orange-100' : 'text-slate-400'}`}>Initial Stage</p>
                  </div>
                  <div className={`p-2.5 rounded-xl transition ${filterStatus === 'Pending' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800 group-hover:scale-105'}`}>
                    <Layers size={20} />
                  </div>
                </button>
              </div>
            );
          })()}

          {/* Dedicated Standalone Quick Filter Toolbar Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-3 relative z-30">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-extrabold text-slate-700 flex items-center gap-1.5 mr-1">
                <Filter size={15} className="text-purple-600" /> Filter Ledger:
              </span>

              {/* Filter by Assignee */}
              <CustomSelectDropdown
                label="Assignee"
                icon={<User size={13} className="text-purple-600 shrink-0" />}
                value={filterManager}
                onChange={(val) => { setFilterManager(val); setCurrentPage(1); }}
                allLabel={`All Assignees (${uniqueManagers.length})`}
                options={[
                  ...uniqueManagers.map(m => ({ label: m, value: m })),
                  { label: 'Unassigned (—)', value: '__UNASSIGNED__' }
                ]}
              />

              {/* Filter by Brand */}
              <CustomSelectDropdown
                label="Brand"
                icon={<ShoppingBag size={13} className="text-blue-600 shrink-0" />}
                value={filterBrand}
                onChange={(val) => { setFilterBrand(val); setCurrentPage(1); }}
                allLabel={`All Brands (${uniqueBrands.length})`}
                options={uniqueBrands.map(b => ({ label: b, value: b }))}
              />

              {/* Filter by Status (All Collaboration Statuses) */}
              <CustomSelectDropdown
                label="Status"
                icon={<CheckCircle2 size={13} className="text-emerald-600 shrink-0" />}
                value={filterStatus}
                onChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}
                allLabel="All Statuses"
                options={ALL_STATUS_OPTIONS.map(s => ({
                  label: `${s.icon} ${s.label}`,
                  value: s.value
                }))}
              />

              {/* Filter by Deliverable */}
              {uniqueDeliverables.length > 0 && (
                <CustomSelectDropdown
                  label="Deliverable"
                  icon={<Video size={13} className="text-indigo-600 shrink-0" />}
                  value={filterDeliverable}
                  onChange={(val) => { setFilterDeliverable(val); setCurrentPage(1); }}
                  allLabel="All Deliverables"
                  options={uniqueDeliverables.map(d => ({ label: d, value: d }))}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Reset all active filters"
                >
                  <X size={14} /> Reset Filters
                </button>
              )}
              <span className="text-xs font-bold text-slate-500">
                Filtered: <strong className="text-purple-700 font-black">{filteredInfluencers.length}</strong> / {influencers.length}
              </span>
            </div>
          </div>

          {/* Main Table Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  {viewMode === 'Paid Collaborations' && <DollarSign className="text-emerald-600" size={20} />}
                  {viewMode === 'Barter Collaborations' && <ShoppingBag className="text-blue-600" size={20} />}
                  {viewMode === 'All Collaborations' && <Layers className="text-purple-600" size={20} />}
                  {viewMode} Ledger
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Showing {filteredInfluencers.length > 0 ? (safeCurrentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(safeCurrentPage * itemsPerPage, filteredInfluencers.length)} of {filteredInfluencers.length} items • Real-time AD2ship financial margins and deliverable metrics.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  title="Import historical or previous month records (.xlsx, .csv)"
                >
                  <FileSpreadsheet size={13} className="text-purple-600" />
                  <span>Import Past Month</span>
                </button>

                {viewMode === 'Barter Collaborations' && (
                  <div className="flex items-center gap-2 bg-purple-50/80 p-1.5 rounded-xl border border-purple-100">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Auto-Sync Active (60s)
                    </span>

                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={isSyncingSheet}
                      className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                      title="Sync latest rows from Google Sheet now"
                    >
                      <RefreshCw size={13} className={isSyncingSheet ? "animate-spin text-purple-600" : "text-purple-600"} />
                      <span>{isSyncingSheet ? "Syncing..." : "Sync Sheet Now"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bulk Selection Action Toolbar - Light Themed */}
            {selectedRecordIds.length > 0 && (
              <div className="mx-5 my-3 p-3 bg-purple-50/90 border border-purple-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-purple-600 text-white text-xs font-black shadow-2xs">
                    {selectedRecordIds.length}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-900">
                      {selectedRecordIds.length} record{selectedRecordIds.length > 1 ? 's' : ''} selected
                    </span>
                    {filteredInfluencers.length > selectedRecordIds.length && (
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-xs text-purple-700 hover:text-purple-900 underline font-bold cursor-pointer transition ml-1"
                      >
                        Select all {filteredInfluencers.length} filtered records
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200/90 shadow-2xs"
                  >
                    Cancel Selection
                  </button>
                  <button
                    type="button"
                    onClick={requestBulkDeleteInfluencers}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm shadow-rose-600/25 cursor-pointer active:scale-95"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedRecordIds.length})</span>
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 font-bold">
                    <th className="p-3 border-b border-r border-slate-700 text-center w-11">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isAllSelectedOnPage}
                          ref={el => {
                            if (el) el.indeterminate = isSomeSelectedOnPage;
                          }}
                          onChange={handleToggleSelectAllPage}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-400 cursor-pointer accent-purple-600 transition"
                          title={isAllSelectedOnPage ? "Deselect all rows on this page" : "Select all rows on this page"}
                        />
                      </div>
                    </th>
                    <SortHeader field="sNo" label="#" align="center" />
                    <SortHeader field="transactionDate" label="Date" />
                    <SortHeader field="influencerManager" label="Assignee" />
                    <SortHeader field="brandName" label="Brand" />
                    <SortHeader field="influencerName" label="Influencer" />
                    <SortHeader field="category" label="Category" align="center" />
                    <SortHeader field="productLink" label="Product Link" />
                    
                    {/* Paid Financial Headers */}
                    {(viewMode === 'Paid Collaborations' || viewMode === 'All Collaborations') && (
                      <>
                        <SortHeader field="brandOnboardingAmt" label="Brand Price (IN) / Receiver" align="right" />
                        <SortHeader field="influencerOnboardingAmt" label="Creator Price (OUT) / Payer" align="right" />
                        {isTargetManager && (
                          <SortHeader field="ad2shipMargin" label="AD2ship Margin" align="right" />
                        )}
                        <SortHeader field="ordersCount" label="Orders & Bonus" align="center" />
                      </>
                    )}

                    {/* Barter Deliverable Headers */}
                    {(viewMode === 'Barter Collaborations' || viewMode === 'All Collaborations') && (
                      <>
                        <SortHeader field="videoType" label="Deliverable" />
                        <SortHeader field="viewsCount" label="Views / Orders" align="right" />
                      </>
                    )}

                    <SortHeader field="status" label="Status" align="center" />
                    <th className="p-3 border-b border-slate-700 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={15} className="p-12 text-center">
                        <InlineLoader message="Loading influencer ledger data..." />
                      </td>
                    </tr>
                  ) : paginatedInfluencers.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-12 text-center text-slate-400 font-semibold">
                        No collaboration records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedInfluencers.map((item, idx) => {
                      const isPaid = item.category === 'Paid';
                      const margin = (item.brandOnboardingAmt || item.inAmount || 0) - (item.influencerOnboardingAmt || item.outAmount || 0);
                      const orders = item.ordersGenerated !== undefined ? item.ordersGenerated : (item.ordersCount || 0);
                      const isBonusQualified = isPaid && orders >= 100;
                      const isSelected = selectedRecordIds.includes(item._id);

                      return (
                        <tr key={item._id} className={`transition ${isSelected ? 'bg-purple-50/80 hover:bg-purple-100/70 border-l-4 border-l-purple-600' : 'hover:bg-slate-50'}`}>
                          <td className="p-3 border-r border-slate-100 text-center w-11">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectRecord(item._id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer accent-purple-600 transition"
                              />
                            </div>
                          </td>

                          <td className="p-3 border-r border-slate-100 text-center font-extrabold text-slate-500">
                            {(safeCurrentPage - 1) * itemsPerPage + idx + 1}
                          </td>

                          <td className="p-3 border-r border-slate-100 font-semibold whitespace-nowrap text-slate-600">
                            {item.transactionDate ? (
                              new Date(item.transactionDate).toLocaleDateString()
                            ) : item.connectedDate ? (
                              <span className="text-purple-700 font-bold" title="Connection Date">{new Date(item.connectedDate).toLocaleDateString()}</span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="p-3 border-r border-slate-100">
                            {item.influencerManager ? (
                              <>
                                <div className="font-bold text-slate-800">{item.influencerManager}</div>
                                {item.brandManagerTeam && (
                                  <div className="text-[10px] text-purple-700 font-extrabold block">Brand Manager: {item.brandManagerTeam}</div>
                                )}
                              </>
                            ) : item.brandManagerTeam ? (
                              <>
                                <span className="text-slate-400 font-semibold text-xs block">Unassigned</span>
                                <div className="text-[10px] text-purple-700 font-extrabold block">Brand Manager: {item.brandManagerTeam}</div>
                              </>
                            ) : (
                              <span className="text-slate-400 font-semibold">—</span>
                            )}
                          </td>

                          <td className="p-3 border-r border-slate-100 font-extrabold text-slate-900">
                            {item.brandName}
                          </td>

                          <td className="p-3 border-r border-slate-100 min-w-[140px]">
                            {(() => {
                              let rawName = (item.influencerName || '').trim();
                              let rawInsta = (item.influencerInstagramId || item.profileLink || '').trim();

                              const isNonInstaUrl = (s: string) => {
                                if (!s) return false;
                                const lower = s.toLowerCase();
                                if (lower.startsWith('@http') || lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('www.')) {
                                  return !lower.includes('instagram.com/');
                                }
                                if (lower.includes('.com') || lower.includes('.in') || lower.includes('.store') || lower.includes('.shop') || lower.includes('.co') || lower.includes('/')) {
                                  return !lower.includes('instagram.com/');
                                }
                                return false;
                              };

                              if (isNonInstaUrl(rawName)) rawName = '';
                              if (isNonInstaUrl(rawInsta)) rawInsta = '';

                              const cleanName = rawName.replace(/\s*\((Barter|Paid)\)\s*/gi, '').trim();

                              let instaHandle = '';
                              let instaUrl = '';

                              if (rawInsta) {
                                if (rawInsta.toLowerCase().includes('instagram.com/')) {
                                  const parts = rawInsta.split('?')[0].split('#')[0].split('/').filter(Boolean);
                                  const handleCandidate = parts.pop() || '';
                                  if (handleCandidate && handleCandidate !== 'instagram.com' && handleCandidate !== 'www.instagram.com' && handleCandidate !== 'reel' && handleCandidate !== 'p' && handleCandidate !== 'reels') {
                                    instaHandle = `@${handleCandidate.replace(/^@/, '')}`;
                                    instaUrl = `https://instagram.com/${handleCandidate.replace(/^@/, '')}`;
                                  }
                                } else if (!rawInsta.includes('/') && !rawInsta.includes('.')) {
                                  const cleanHandle = rawInsta.replace(/^@/, '').replace(/\s+/g, '');
                                  if (cleanHandle) {
                                    instaHandle = `@${cleanHandle}`;
                                    instaUrl = `https://instagram.com/${cleanHandle}`;
                                  }
                                }
                              }

                              const showName = cleanName && (!instaHandle || cleanName.toLowerCase() !== instaHandle.replace(/^@/, '').toLowerCase());

                              if (!showName && !instaHandle && !item.phone) {
                                return <span className="text-slate-400 font-semibold text-[11px]">—</span>;
                              }

                              return (
                                <div>
                                  {showName && <div className="font-extrabold text-slate-900 text-xs">{cleanName}</div>}
                                  {instaHandle && (
                                    <a
                                      href={instaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-purple-700 font-bold hover:underline block truncate max-w-[140px] mt-0.5"
                                    >
                                      📷 {instaHandle}
                                    </a>
                                  )}
                                  {item.phone && <div className="text-[10px] text-slate-400 font-medium">{item.phone}</div>}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="p-3 border-r border-slate-100 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}>
                              {item.category}
                            </span>
                          </td>

                          {/* Product Link Column */}
                          <td className="p-3 border-r border-slate-100 font-semibold min-w-[120px]">
                            {item.productLink ? (
                              <a
                                href={item.productLink.startsWith('http') ? item.productLink : `https://${item.productLink}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 transition shadow-2xs max-w-[130px] truncate"
                                title={item.productLink}
                              >
                                <ExternalLink size={12} className="shrink-0 text-blue-600" />
                                Product Link
                              </a>
                            ) : (
                              <span className="text-slate-400 font-semibold text-[11px]">—</span>
                            )}
                          </td>

                          {/* Financial Columns */}
                          {(viewMode === 'Paid Collaborations' || viewMode === 'All Collaborations') && (
                            <>
                              <td className="p-3 border-r border-slate-100 text-right font-black text-slate-900">
                                <div>₹{new Intl.NumberFormat().format(item.brandOnboardingAmt || item.inAmount || 0)}</div>
                                <div className="text-[10px] text-emerald-700 font-extrabold flex items-center justify-end gap-1 mt-0.5">
                                  📥 {item.moneyReceivedBy || 'rahul'}
                                </div>
                              </td>

                              <td className="p-3 border-r border-slate-100 text-right font-black text-slate-700">
                                <div>₹{new Intl.NumberFormat().format(item.influencerOnboardingAmt || item.outAmount || 0)}</div>
                                <div className="text-[10px] text-rose-700 font-extrabold flex items-center justify-end gap-1 mt-0.5">
                                  📤 {item.paymentDoneBy || 'rahul'}
                                </div>
                              </td>

                              {isTargetManager && (
                                <td className="p-3 border-r border-slate-100 text-right font-black text-emerald-600 bg-emerald-50/30">
                                  ₹{new Intl.NumberFormat().format(margin)}
                                </td>
                              )}

                              <td className="p-3 border-r border-slate-100 text-center">
                                {isBonusQualified ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                      🌟 {orders} orders
                                    </span>
                                    {isTargetManager && (
                                      <div className="text-[10px] font-black text-emerald-700">
                                        +₹{new Intl.NumberFormat().format(Math.round(margin * 0.10))} Bonus
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    {orders > 0 ? `${orders} orders` : '—'}
                                  </span>
                                )}
                              </td>
                            </>
                          )}

                          {/* Barter Columns */}
                          {(viewMode === 'Barter Collaborations' || viewMode === 'All Collaborations') && (
                            <>
                              <td className="p-3 border-r border-slate-100 space-y-0.5">
                                <div className="font-extrabold text-slate-900">{item.videoType || 'Product Video'}</div>
                                {item.videoDescription && (
                                  <div className="text-[10px] text-slate-500 font-medium line-clamp-1">{item.videoDescription}</div>
                                )}
                                {item.orderId && (
                                  <div className="text-[10px] text-purple-700 font-black">Order: {item.orderId}</div>
                                )}
                                {(item.refVideoLink || item.referenceVideoLink) && (
                                  <a href={item.refVideoLink || item.referenceVideoLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline block">
                                    📹 Ref Video Link
                                  </a>
                                )}
                                {item.contentLink && (
                                  <a href={item.contentLink} target="_blank" rel="noreferrer" className="block text-[10px] text-purple-600 font-bold hover:underline truncate max-w-[120px]">
                                    🔗 Content Link
                                  </a>
                                )}
                              </td>

                              <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-700">
                                {item.viewsCount || orders ? (
                                  <div>{item.viewsCount || 0} views / {orders} orders</div>
                                ) : (
                                  <span className="text-slate-400 font-semibold text-[11px]">—</span>
                                )}
                                {item.orderDate && (
                                  <div className="text-[10px] text-slate-400 font-normal">Order Date: {new Date(item.orderDate).toLocaleDateString()}</div>
                                )}
                              </td>
                            </>
                          )}

                          <td className="p-3 border-r border-slate-100 text-center space-y-1">
                            <StatusPillDropdown
                              currentStatus={item.status}
                              userRole={userRole}
                              onSelect={(newStat) => handleStatusChange(item._id, newStat)}
                            />
                            {item.approvalStatus === 'Not Approved' && (
                              <div className="mt-1">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border bg-rose-100 text-rose-800 border-rose-300">
                                  ❌ Not Approved
                                </span>
                              </div>
                            )}
                            {item.reason && (
                              <div className="text-[9px] text-slate-500 font-semibold italic max-w-[110px] mx-auto truncate" title={item.reason}>
                                {item.reason}
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-center space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => openViewModal(item)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                              title="View Record Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
                              title="Edit Record"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => requestDeleteInfluencer(item)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  totalItems={filteredInfluencers.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={(p) => {
                    setCurrentPage(p);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: PAYMENT AUDIT LOGS */}
      {viewMode === 'Payment Audit Logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Receipt className="text-purple-600" size={20} />
                Payment In/Out Audit Logs
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Exact log of all payments received from client brands (IN) and payouts disbursed to creators (OUT).
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedPayLogType}
                onChange={(e: any) => setSelectedPayLogType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-extrabold bg-slate-50"
              >
                <option value="All">All Types (IN & OUT)</option>
                <option value="IN">Payments IN (From Brand)</option>
                <option value="OUT">Payments OUT (To Creator)</option>
              </select>

              <button
                onClick={openPaymentModal}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={14} /> Log New Payment
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 font-bold">
                  <th className="p-3 border-b border-r border-slate-700">Date</th>
                  <th className="p-3 border-b border-r border-slate-700 text-center">Type</th>
                  <th className="p-3 border-b border-r border-slate-700">Brand Name</th>
                  <th className="p-3 border-b border-r border-slate-700">Influencer Name</th>
                  <th className="p-3 border-b border-r border-slate-700 text-right">Amount</th>
                  <th className="p-3 border-b border-r border-slate-700">Mode & Ref #</th>
                  <th className="p-3 border-b border-r border-slate-700">Handled By</th>
                  <th className="p-3 border-b border-slate-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {paymentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                      No payment log entries recorded yet. Click "Log New Payment" to record a transaction.
                    </td>
                  </tr>
                ) : (
                  paymentLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50 transition">
                      <td className="p-3 border-r border-slate-100 font-semibold whitespace-nowrap text-slate-600">
                        {new Date(log.transactionDate).toLocaleDateString()}
                      </td>

                      <td className="p-3 border-r border-slate-100 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          log.type === 'IN' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-pink-100 text-pink-800 border border-pink-300'
                        }`}>
                          {log.type === 'IN' ? '📥 Payments IN' : '📤 Payments OUT'}
                        </span>
                      </td>

                      <td className="p-3 border-r border-slate-100 font-extrabold text-slate-900">
                        {log.brandName}
                      </td>

                      <td className="p-3 border-r border-slate-100 font-extrabold text-purple-700">
                        {log.influencerName}
                      </td>

                      <td className={`p-3 border-r border-slate-100 text-right font-black ${
                        log.type === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {isManagerOrAdmin ? (
                          `${log.type === 'IN' ? '+' : '-'}₹${new Intl.NumberFormat().format(log.amount)}`
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black border border-purple-200">PAID</span>
                        )}
                      </td>

                      <td className="p-3 border-r border-slate-100">
                        <div className="font-bold text-slate-800">{log.paymentMode}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {log.referenceNo || 'N/A'}</div>
                      </td>

                      <td className="p-3 border-r border-slate-100 font-semibold text-slate-700">
                        {log.handledBy || 'Admin'}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => requestDeletePaymentLog(log)}
                          className="p-1 rounded-lg text-red-600 hover:bg-red-50 transition"
                          title="Delete Audit Log"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* MODAL 1: ADD / EDIT INFLUENCER COLLABORATION */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Collaboration Record' : 'New Influencer Collaboration'}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSubmitInfluencer} className="space-y-5 text-xs">
          {/* Top Header Card: Collaboration Type Selector */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 rounded-2xl border border-purple-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-slate-800 font-extrabold text-sm block">Collaboration Type</span>
              <p className="text-[11px] text-slate-500 font-medium">Select whether this deal is a paid client contract or product barter deal.</p>
            </div>

            <div className="flex bg-white/80 p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setCategory('Paid')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  category === 'Paid' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-purple-600 hover:bg-slate-50'
                }`}
              >
                💼 Paid Deal
              </button>
              <button
                type="button"
                onClick={() => setCategory('Barter')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  category === 'Barter' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                }`}
              >
                🎁 Barter Deal
              </button>
            </div>
          </div>

          {/* Section 1: Influencer & Brand Information */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">1</span>
              <span>Influencer & Brand Profile</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Influencer Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={influencerName}
                  onChange={(e) => setInfluencerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-xs font-semibold text-slate-900 transition"
                />
              </div>

              <SearchableBrandSelect
                brands={brands}
                selectedBrandId={selectedBrandId}
                customBrandName={customBrandName}
                onSelectBrand={(bId, bName) => {
                  setSelectedBrandId(bId);
                  setCustomBrandName(bName);
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Influencer Instagram ID / Handle</label>
                <input
                  type="text"
                  placeholder="e.g. @payalrajput057 or profile link"
                  value={influencerInstagramId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInfluencerInstagramId(val);
                    setProfileLink(val ? (val.startsWith('http') ? val : `https://instagram.com/${val.replace(/^@/, '')}`) : '');
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-xs font-semibold text-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-xs font-semibold text-slate-900 transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Assignment & Brand Management */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">2</span>
              <span>Assignment & Brand Management</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Assignee (Panel Member) <span className="text-purple-600 font-semibold text-[10px]">(Only Panel Members)</span>
                </label>
                <select
                  value={influencerManager}
                  onChange={(e) => setInfluencerManager(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-xs font-semibold text-slate-900 bg-white cursor-pointer transition"
                >
                  <option value="">-- Select Panel Assignee (Optional) --</option>
                  {panelMemberOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Brand Manager <span className="text-slate-400 font-normal text-[10px]">(Can be anyone / external)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manish Jangid, Lakshita Jaju, Vinny"
                  value={brandManagerTeam}
                  onChange={(e) => setBrandManagerTeam(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-semibold text-slate-900 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-extrabold text-purple-900">Connection Date</label>
                <input
                  type="date"
                  value={connectedDate}
                  onChange={(e) => setConnectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold text-purple-900 bg-purple-50/30"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-extrabold">Transaction Date</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold text-slate-900 bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Deal Status & Remarks */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">3</span>
              <span>Deal Status & Remarks</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-extrabold">Deal Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none font-bold bg-white text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Pending">🟠 Pending (Default)</option>
                  <option value="In Discussion">💬 In Discussion (Talking Terms)</option>
                  <option value="Parcel Sent">📦 Parcel Sent (Dispatched)</option>
                  <option value="Under Review">🟡 Under Review</option>
                  <option value="Approved">🟢 Approved</option>
                  <option value="Completed">🟢 Completed</option>
                  <option value="Settled">🟣 Settled</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Reason / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Approved by client"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Deliverables & Order Links */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">4</span>
              <span>Deliverables & Orders</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Deliverable Video Type</label>
                <select
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Single Product Video">Single Product Video</option>
                  <option value="Instagram Reel (2 Reels)">Instagram Reel (2 Reels)</option>
                  <option value="Story Promotion">Story Promotion</option>
                  <option value="YouTube Integration">YouTube Integration</option>
                  <option value="Unboxing & Review">Unboxing & Review</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Video Description</label>
                <input
                  type="text"
                  placeholder="e.g. Cinderella blush embellished set video review"
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Reference Video Link</label>
                <input
                  type="text"
                  placeholder="https://instagram.com/reel/..."
                  value={refVideoLink}
                  onChange={(e) => setRefVideoLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. #VAASVA16236 or Directly by brand"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Product Link</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={productLink}
                  onChange={(e) => setProductLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Content Post Link</label>
                <input
                  type="text"
                  placeholder="https://instagram.com/p/..."
                  value={contentLink}
                  onChange={(e) => setContentLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Views Count</label>
                <input
                  type="number"
                  placeholder="0"
                  value={viewsCount}
                  onChange={(e) => setViewsCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold flex items-center justify-between">
                  <span>Orders Generated</span>
                  {Number(ordersCount) >= 100 && category === 'Paid' && (
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      🌟 10% Bonus Qualified
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={ordersCount}
                  onChange={(e) => setOrdersCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Financial Details (Paid Collaborations) */}
          {category === 'Paid' && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">5</span>
                  <span>Financial Breakdown & Payouts</span>
                </span>
                {isTargetManager && (
                  <span className="text-[11px] text-purple-700 font-extrabold bg-purple-100 px-2.5 py-0.5 rounded-md">
                    Auto-Calculated Margin
                  </span>
                )}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Brand Payment (IN) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Client Brand Payment (IN)</span>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Quoted Price to Brand (IN) ₹</label>
                    <input
                      type="number"
                      placeholder="20000"
                      value={brandOnboardingAmt}
                      onChange={(e) => setBrandOnboardingAmt(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-slate-900 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Money Received By (Brand Receiver)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul / Account Name"
                      value={moneyReceivedBy}
                      onChange={(e) => setMoneyReceivedBy(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* Creator Payout (OUT) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Influencer Payout (OUT)</span>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Cost Paid to Creator (OUT) ₹</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={influencerOnboardingAmt}
                      onChange={(e) => setInfluencerOnboardingAmt(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-slate-900 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Actual Amount Disbursed (OUT) ₹</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={influencerPaidAmt}
                      onChange={(e) => setInfluencerPaidAmt(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-black text-pink-700 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Payment Done By (Creator Payer)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul / Account Name"
                      value={paymentDoneBy}
                      onChange={(e) => setPaymentDoneBy(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time AD2ship Margin Preview (Manager/Admin Only) */}
              {isTargetManager && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 rounded-xl text-white flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-100">Calculated AD2ship Profit Margin</span>
                    <p className="text-base font-black">
                      ₹{new Intl.NumberFormat().format(Number(brandOnboardingAmt || 0) - Number(influencerOnboardingAmt || 0))}
                    </p>
                  </div>
                  <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-lg">
                    {Number(brandOnboardingAmt || 0) > 0 
                      ? `${Math.round(((Number(brandOnboardingAmt || 0) - Number(influencerOnboardingAmt || 0)) / Number(brandOnboardingAmt || 1)) * 100)}% Profit`
                      : '0%'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-extrabold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingInfluencer}
              className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-extrabold shadow-md flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submittingInfluencer ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{editingItem ? 'Saving...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{editingItem ? 'Save Changes' : 'Create Record'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CREATE / EDIT TARGET */}
      <Modal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title={editingTarget ? 'Edit Target Goal' : 'Set New AD2ship Target'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveTarget} className="space-y-3 text-xs font-bold">
          <div>
            <label className="block text-slate-700 mb-1">Target Category *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetFormData({ ...targetFormData, targetType: 'Paid', currency: '₹', targetMetric: 'Margin' })}
                className={`py-2 px-3 rounded-xl font-black transition ${
                  targetFormData.targetType === 'Paid' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                💼 Paid Revenue Target
              </button>
              <button
                type="button"
                onClick={() => setTargetFormData({ ...targetFormData, targetType: 'Barter', currency: 'Collabs', targetMetric: 'Count', targetAmount: '' })}
                className={`py-2 px-3 rounded-xl font-black transition ${
                  targetFormData.targetType === 'Barter' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                🎁 Barter Collabs Target
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1">Target Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. August 2026 Revenue Target"
              value={targetFormData.title}
              onChange={(e) => setTargetFormData({ ...targetFormData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1">
                {targetFormData.targetType === 'Barter' ? 'Target Collab Count *' : 'Target Amount (₹) *'}
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder={targetFormData.targetType === 'Barter' ? '120' : '500000'}
                value={targetFormData.targetAmount}
                onChange={(e) => setTargetFormData({ ...targetFormData, targetAmount: e.target.value, targetCount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-extrabold outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Target Period *</label>
              <input
                type="text"
                required
                placeholder="e.g. August 2026"
                value={targetFormData.period}
                onChange={(e) => setTargetFormData({ ...targetFormData, period: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>

          {targetFormData.targetType === 'Paid' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold text-purple-900">
                  ⚡ Auto-Calculate Team Target
                </p>
                <p className="text-[10px] text-purple-600 font-semibold">
                  {teamBreakdown?.teamSize || 6} Executives × ₹1,20,000 = ₹{new Intl.NumberFormat().format((teamBreakdown?.teamSize || 6) * 120000)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetFormData({
                  ...targetFormData,
                  targetAmount: String((teamBreakdown?.teamSize || 6) * 120000),
                  title: `${targetFormData.period || 'Monthly'} Team Revenue Target (${teamBreakdown?.teamSize || 6} Members)`,
                  description: `Auto-filled quota for ${teamBreakdown?.teamSize || 6} Social Media & Influencer Marketing Executives at ₹1.2L margin/member.`
                })}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-extrabold transition shadow-2xs"
              >
                Auto-Fill ₹{new Intl.NumberFormat().format((teamBreakdown?.teamSize || 6) * 120000)}
              </button>
            </div>
          )}

          {targetFormData.targetType === 'Barter' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold text-purple-900">
                  ⚡ Auto-Calculate Barter Collab Goal
                </p>
                <p className="text-[10px] text-purple-600 font-semibold">
                  {teamBreakdown?.teamBarterTarget || 0} Total Collabs across {teamBreakdown?.teamSize || 6} Team Members' Brands (7B Running : 8B New)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetFormData({
                  ...targetFormData,
                  targetAmount: String(teamBreakdown?.teamBarterTarget || 0),
                  targetCount: String(teamBreakdown?.teamBarterTarget || 0),
                  title: `${targetFormData.period || 'Monthly'} Barter Collaborations Goal (${teamBreakdown?.teamBarterTarget || 0} Collabs)`,
                  description: `Auto-calculated barter volume quota across assigned brands (${teamBreakdown?.teamBarterTarget || 0} Collabs).`
                })}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-extrabold transition shadow-2xs"
              >
                Auto-Fill {teamBreakdown?.teamBarterTarget || 0} Collabs
              </button>
            </div>
          )}

          <div>
            <label className="block text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Notes on AD2ship monthly target..."
              value={targetFormData.description}
              onChange={(e) => setTargetFormData({ ...targetFormData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={targetFormData.autoSync}
                onChange={(e) => setTargetFormData({ ...targetFormData, autoSync: e.target.checked })}
                className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="text-slate-800 font-extrabold">Auto-Sync from Database</span>
            </label>
            <p className="text-[10px] text-slate-500 font-medium">
              Automatically calculates achieved progress from actual transaction entries in MongoDB.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowTargetModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTarget}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-md flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingTarget ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Target Goal</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: LOG MANUAL PAYMENT ENTRY */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Log Payment Audit Entry"
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePaymentLogSubmit} className="space-y-3 text-xs font-bold">
          <div>
            <label className="block text-slate-700 mb-1">Transaction Type *</label>
            <select
              value={payLogType}
              onChange={(e: any) => setPayLogType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-extrabold outline-none"
            >
              <option value="IN">📥 Payments IN (From Client Brand)</option>
              <option value="OUT">📤 Payments OUT (To Creator / Influencer)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1">Brand Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bunaiwala"
                value={payLogBrandName}
                onChange={(e) => setPayLogBrandName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Influencer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Priya Singh"
                value={payLogInfluencerName}
                onChange={(e) => setPayLogInfluencerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                placeholder="10000"
                value={payLogAmount}
                onChange={(e) => setPayLogAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={payLogDate}
                onChange={(e) => setPayLogDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1">Payment Mode</label>
              <select
                value={payLogMode}
                onChange={(e) => setPayLogMode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-bold"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Ref / UTR Number</label>
              <input
                type="text"
                placeholder="e.g. UTR987654"
                value={payLogRefNo}
                onChange={(e) => setPayLogRefNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="Payment receipt details..."
              value={payLogNotes}
              onChange={(e) => setPayLogNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPayLog}
              className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-black shadow-md flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingPayLog ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Log...</span>
                </>
              ) : (
                <span>Save Log Entry</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
      {/* MODAL 4: EXECUTIVE TARGET & INCENTIVE DETAIL MODAL */}
      <Modal
        isOpen={!!selectedMemberForDetail}
        onClose={() => setSelectedMemberForDetail(null)}
        title={selectedMemberForDetail ? `${selectedMemberForDetail.employee.name} — Quota & Incentive Ledger` : 'Executive Details'}
        maxWidth="max-w-4xl"
      >
        {selectedMemberForDetail && (
          <div className="space-y-4 text-xs">
            {/* Header Profile Ribbon */}
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50/70 to-emerald-50/70 rounded-2xl border border-purple-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  {selectedMemberForDetail.employee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedMemberForDetail.employee.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-slate-600 font-bold text-[11px]">
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md text-[10px] font-black">{selectedMemberForDetail.employee.employeeId}</span>
                    <span>•</span>
                    <span>{selectedMemberForDetail.employee.designation || 'Influencer Marketing Executive'}</span>
                    <span>•</span>
                    <span className="text-purple-700 font-extrabold">{selectedMemberForDetail.assignedBrands?.length || selectedMemberForDetail.employee.assignedBrandsCount} Assigned Brands</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border shadow-2xs ${
                  selectedMemberForDetail.targetTier === '10%'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : selectedMemberForDetail.targetTier === '5%'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {selectedMemberForDetail.targetTier === '10%' ? '🏆 10% Slab (1L+)' : selectedMemberForDetail.targetTier === '5%' ? '🥈 5% Slab (80k+)' : '0% Slab (<80k)'}
                </span>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-slate-200 gap-2 pb-1 font-extrabold text-xs">
              <button
                onClick={() => setDetailActiveTab('overview')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  detailActiveTab === 'overview'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TrendingUp size={14} /> Performance & Incentive Ledger
              </button>
              <button
                onClick={() => setDetailActiveTab('brands')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  detailActiveTab === 'brands'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingBag size={14} /> Assigned Brands ({selectedMemberForDetail.assignedBrands?.length || selectedMemberForDetail.employee.assignedBrandsCount})
              </button>
              <button
                onClick={() => setDetailActiveTab('deals')}
                className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  detailActiveTab === 'deals'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers size={14} /> Collab Deals ({selectedMemberForDetail.deals?.length || 0})
              </button>
            </div>

            {/* TAB 1: OVERVIEW & INCENTIVE BREAKDOWN */}
            {detailActiveTab === 'overview' && (
              <div className="space-y-4 pt-1">
                {/* Quota Progress Meter */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-700">Monthly Net Margin Paid Colab Progress</span>
                    <span className="text-purple-700">
                      ₹{new Intl.NumberFormat().format(selectedMemberForDetail.netMargin)} / ₹{new Intl.NumberFormat().format(selectedMemberForDetail.individualTarget)} ({selectedMemberForDetail.targetAchievedPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${selectedMemberForDetail.targetAchievedPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedMemberForDetail.targetAchievedPercent >= 100
                      ? '🎉 Congratulations! Full ₹1,20,000 quota achieved. Qualified for 10% Incentive Slab.'
                      : selectedMemberForDetail.netMargin >= 80000
                        ? '🥈 5% Incentive Slab unlocked (₹80k+ threshold crossed). ₹' + new Intl.NumberFormat().format(100000 - selectedMemberForDetail.netMargin) + ' needed for 10% Slab.'
                        : '⚡ ₹' + new Intl.NumberFormat().format(80000 - selectedMemberForDetail.netMargin) + ' more Net Margin needed to unlock the 5% Incentive Slab.'}
                  </p>
                </div>

                {/* Barter Quota Progress Meter */}
                {selectedMemberForDetail.individualBarterTarget !== undefined && selectedMemberForDetail.individualBarterTarget > 0 && (
                  <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200/80 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-purple-900 flex items-center gap-1.5">
                        <ShoppingBag size={14} className="text-purple-600" />
                        Monthly Barter Collabs Goal ({selectedMemberForDetail.assignedBrands?.length || selectedMemberForDetail.employee.assignedBrandsCount} Brands)
                      </span>
                      <span className="text-purple-700">
                        {selectedMemberForDetail.barterCount} / {selectedMemberForDetail.individualBarterTarget} Collabs ({selectedMemberForDetail.barterAchievedPercent || 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${selectedMemberForDetail.barterAchievedPercent || 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-purple-700 font-medium">
                      Auto-calculated from assigned brands quota (7B per Running Brand : 8B per New Brand).
                    </p>
                  </div>
                )}

                {/* 4 Financial Highlight Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Ad2ship Margin</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">
                      ₹{new Intl.NumberFormat().format(selectedMemberForDetail.netMargin)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{selectedMemberForDetail.paidCount} Paid Collabs</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Incentive Slab</span>
                    <span className="text-base font-black text-purple-700 mt-0.5 block">
                      {selectedMemberForDetail.targetIncentivePercentage}% Payout
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {selectedMemberForDetail.netMargin >= 100000 ? '1L+ Threshold Met' : selectedMemberForDetail.netMargin >= 80000 ? '80k Threshold Met' : '< 80k Threshold'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Bonus</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      ₹{new Intl.NumberFormat().format(selectedMemberForDetail.targetIncentiveAmount)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{selectedMemberForDetail.targetIncentivePercentage}% × Net Margin</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">100+ Orders Bonus</span>
                    <span className="text-base font-black text-amber-800 mt-0.5 block">
                      +₹{new Intl.NumberFormat().format(selectedMemberForDetail.orderBonusAmount)}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">{selectedMemberForDetail.qualifyingBonusDealsCount} Viral Videos</span>
                  </div>
                </div>

                {/* Total Take-Home Incentive Banner */}
                <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 block">
                      Total Monthly Take-Home Incentive Payout
                    </span>
                    <span className="text-2xl font-black mt-0.5 block">
                      ₹{new Intl.NumberFormat().format(selectedMemberForDetail.totalTakeHomeIncentive)}
                    </span>
                    <p className="text-[10px] text-emerald-100 font-semibold mt-0.5">
                      = Target Slab Incentive (₹{new Intl.NumberFormat().format(selectedMemberForDetail.targetIncentiveAmount)}) + 100+ Orders Video Bonus (₹{new Intl.NumberFormat().format(selectedMemberForDetail.orderBonusAmount)})
                    </p>
                  </div>

                  <div className="text-right bg-white/20 px-3 py-2 rounded-xl backdrop-blur-xs">
                    <span className="text-[10px] font-black uppercase text-emerald-100 block">Collabs Completed</span>
                    <span className="text-sm font-black text-white">
                      {selectedMemberForDetail.barterCount} Barter : {selectedMemberForDetail.paidCount} Paid
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ASSIGNED BRANDS */}
            {detailActiveTab === 'brands' && (
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-slate-700">
                    Brands Assigned to {selectedMemberForDetail.employee.name} ({selectedMemberForDetail.assignedBrands?.length || 0} Total)
                  </span>
                </div>

                {(!selectedMemberForDetail.assignedBrands || selectedMemberForDetail.assignedBrands.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 font-semibold">
                    No brand assignments found for this executive.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                    {selectedMemberForDetail.assignedBrands.map((b, idx) => (
                      <div key={b.id || idx} className="p-3 bg-white hover:bg-purple-50/40 rounded-xl border border-slate-200 shadow-2xs transition space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-slate-900 text-xs truncate">{b.name}</h4>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                            b.brandType === 'New'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {b.brandType === 'New' ? '✨ New' : '⚡ Running'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold flex justify-between pt-1 border-t border-slate-100">
                          <span>Target: <strong className="text-purple-700">{b.targetBarterCollabs}B : {b.targetPaidCollabs}P</strong></span>
                          <span className="text-slate-700 font-bold">{b.targetTotalCollabs} Total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DEALS & COLLABORATIONS */}
            {detailActiveTab === 'deals' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-extrabold text-slate-700">
                    All Collaborations ({selectedMemberForDetail.deals?.length || 0})
                  </span>
                  <div className="relative w-56">
                    <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search influencer or brand..."
                      value={detailDealsSearch}
                      onChange={(e) => setDetailDealsSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {(!selectedMemberForDetail.deals || selectedMemberForDetail.deals.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 font-semibold">
                    No collaboration deals recorded for this executive.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-slate-200 font-bold text-[11px] sticky top-0">
                          <th className="p-2.5 border-b border-r border-slate-700">Brand</th>
                          <th className="p-2.5 border-b border-r border-slate-700">Influencer</th>
                          <th className="p-2.5 border-b border-r border-slate-700 text-center">Type</th>
                          <th className="p-2.5 border-b border-r border-slate-700 text-right">Brand (IN)</th>
                          <th className="p-2.5 border-b border-r border-slate-700 text-right">Creator (OUT)</th>
                          <th className="p-2.5 border-b border-r border-slate-700 text-right">Margin</th>
                          <th className="p-2.5 border-b border-slate-700 text-center">Orders & Bonus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800 text-[11px]">
                        {selectedMemberForDetail.deals
                          .filter(d => {
                            if (!detailDealsSearch) return true;
                            const q = detailDealsSearch.toLowerCase();
                            return (d.brandName && d.brandName.toLowerCase().includes(q)) || (d.influencerName && d.influencerName.toLowerCase().includes(q));
                          })
                          .map((d, idx) => (
                            <tr key={d.id || idx} className="hover:bg-purple-50/30 transition">
                              <td className="p-2.5 border-r border-slate-100 font-extrabold text-slate-900">{d.brandName}</td>
                              <td className="p-2.5 border-r border-slate-100 font-bold text-slate-700">{d.influencerName}</td>
                              <td className="p-2.5 border-r border-slate-100 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  d.category === 'Paid' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {d.category}
                                </span>
                              </td>
                              <td className="p-2.5 border-r border-slate-100 text-right font-semibold">
                                {d.category === 'Paid' ? `₹${new Intl.NumberFormat().format(d.brandOnboardingAmt || 0)}` : '-'}
                              </td>
                              <td className="p-2.5 border-r border-slate-100 text-right font-semibold text-rose-600">
                                {d.category === 'Paid' ? `₹${new Intl.NumberFormat().format(d.influencerOnboardingAmt || 0)}` : '-'}
                              </td>
                              <td className={`p-2.5 border-r border-slate-100 text-right font-black ${
                                (d.ad2shipMargin ?? ((d.brandOnboardingAmt || 0) - (d.influencerOnboardingAmt || 0))) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {d.category === 'Paid' ? `₹${new Intl.NumberFormat().format(d.ad2shipMargin !== undefined ? d.ad2shipMargin : ((d.brandOnboardingAmt || 0) - (d.influencerOnboardingAmt || 0)))}` : '-'}
                              </td>
                              <td className="p-2.5 text-center">
                                {d.ordersGenerated >= 100 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                    🌟 {d.ordersGenerated} (+₹{new Intl.NumberFormat().format(Math.round(d.ad2shipMargin * 0.10))})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold">{d.ordersGenerated || 0} orders</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Modal Close Button */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMemberForDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* FULL DETAILS VIEW MODAL */}
      <Modal
        isOpen={!!selectedViewItem}
        onClose={() => setSelectedViewItem(null)}
        title={`Collaboration Record Details — ${selectedViewItem?.brandName || ''}`}
        maxWidth="max-w-4xl"
      >
        {selectedViewItem && (
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            {/* Header Banner - Light elegant shade */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/70 to-blue-50 border border-purple-100/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-black text-slate-900">{selectedViewItem.brandName}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    selectedViewItem.category === 'Paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}>
                    {selectedViewItem.category}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-2 font-medium">
                  <span className="font-bold text-slate-700">Influencer:</span>
                  <span className="font-black text-purple-900">{selectedViewItem.influencerName}</span>
                  {selectedViewItem.influencerInstagramId && (
                    <a
                      href={selectedViewItem.profileLink || `https://instagram.com/${selectedViewItem.influencerInstagramId.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-700 hover:text-purple-900 font-extrabold hover:underline text-xs inline-flex items-center gap-1 bg-white px-2.5 py-0.5 rounded-lg border border-purple-200 shadow-2xs"
                    >
                      📷 {selectedViewItem.influencerInstagramId}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                  selectedViewItem.status === 'Completed' || selectedViewItem.status === 'Approved' || selectedViewItem.status === 'Settled'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : selectedViewItem.status === 'Pending' || selectedViewItem.status === 'Under Review'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {selectedViewItem.status || 'Pending'}
                </span>
              </div>
            </div>

            {/* Grid 1: Basic Information */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-purple-600" /> Basic & Assignment Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Assignee (Manager)</span>
                  <span className="font-black text-slate-800">{selectedViewItem.influencerManager || (selectedViewItem.brandManagerTeam ? 'Unassigned' : '—')}</span>
                  {selectedViewItem.brandManagerTeam && (
                    <span className="text-[10px] text-purple-700 font-extrabold block">Brand Manager: {selectedViewItem.brandManagerTeam}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Assigned Executive</span>
                  <span className="font-bold text-slate-700">{selectedViewItem.assignedExecutive || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Phone Contact</span>
                  <span className="font-bold text-slate-700">{selectedViewItem.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Transaction Date</span>
                  <span className="font-bold text-slate-700">{selectedViewItem.transactionDate ? new Date(selectedViewItem.transactionDate).toLocaleDateString() : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Connected Date</span>
                  <span className="font-bold text-slate-700">{selectedViewItem.connectedDate ? new Date(selectedViewItem.connectedDate).toLocaleDateString() : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">Platform</span>
                  <span className="font-bold text-slate-700">{selectedViewItem.platform || 'Instagram'}</span>
                </div>
              </div>
            </div>

            {/* Grid 2: Product & Deliverables Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-blue-600" /> Product & Deliverable Content
              </h4>

              <div className="space-y-3">
                {/* Highlighted Product Link */}
                <div className="p-3 bg-white rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">Product Link</span>
                    {selectedViewItem.productLink ? (
                      <span className="text-xs font-bold text-slate-800 break-all">{selectedViewItem.productLink}</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">No product link provided</span>
                    )}
                  </div>
                  {selectedViewItem.productLink && (
                    <a
                      href={selectedViewItem.productLink.startsWith('http') ? selectedViewItem.productLink : `https://${selectedViewItem.productLink}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 transition shadow-xs shrink-0"
                    >
                      <ExternalLink size={13} /> Visit Product Link
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Deliverable Type</span>
                    <span className="font-extrabold text-slate-800">{selectedViewItem.videoType || 'Single Product Video'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Order ID</span>
                    <span className="font-bold text-purple-700">{selectedViewItem.orderId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Order Date</span>
                    <span className="font-bold text-slate-700">{selectedViewItem.orderDate ? new Date(selectedViewItem.orderDate).toLocaleDateString() : '—'}</span>
                  </div>
                </div>

                {selectedViewItem.videoDescription && (
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Video Description</span>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-700">{selectedViewItem.videoDescription}</div>
                  </div>
                )}

                {/* Additional Links */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(selectedViewItem.refVideoLink || selectedViewItem.referenceVideoLink) && (
                    <a
                      href={selectedViewItem.refVideoLink || selectedViewItem.referenceVideoLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs inline-flex items-center gap-1.5 transition"
                    >
                      📹 Reference Video Link
                    </a>
                  )}
                  {selectedViewItem.contentLink && (
                    <a
                      href={selectedViewItem.contentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs inline-flex items-center gap-1.5 transition"
                    >
                      🔗 Published Content Link
                    </a>
                  )}
                  {selectedViewItem.adsCode && (
                    <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
                      🏷️ Ads Code: {selectedViewItem.adsCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Grid 3: Financial & Performance Metrics */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-600" /> Financial Breakdown & Performance Metrics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block text-[10px]">Brand Price (IN)</span>
                  <span className="text-sm font-black text-slate-900">₹{new Intl.NumberFormat().format(selectedViewItem.brandOnboardingAmt || selectedViewItem.inAmount || 0)}</span>
                  {selectedViewItem.moneyReceivedBy && (
                    <div className="text-[10px] text-emerald-700 font-extrabold mt-0.5">📥 Received by: {selectedViewItem.moneyReceivedBy}</div>
                  )}
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block text-[10px]">Creator Price (OUT)</span>
                  <span className="text-sm font-black text-slate-700">₹{new Intl.NumberFormat().format(selectedViewItem.influencerOnboardingAmt || selectedViewItem.outAmount || 0)}</span>
                  {selectedViewItem.paymentDoneBy && (
                    <div className="text-[10px] text-rose-700 font-extrabold mt-0.5">📤 Paid by: {selectedViewItem.paymentDoneBy}</div>
                  )}
                </div>
                <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 font-bold block text-[10px]">AD2ship Margin</span>
                  <span className="text-sm font-black text-emerald-700">
                    ₹{new Intl.NumberFormat().format((selectedViewItem.brandOnboardingAmt || selectedViewItem.inAmount || 0) - (selectedViewItem.influencerOnboardingAmt || selectedViewItem.outAmount || 0))}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block text-[10px]">Views & Orders</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {selectedViewItem.viewsCount || 0} views / {selectedViewItem.ordersGenerated ?? selectedViewItem.ordersCount ?? 0} orders
                  </span>
                </div>
              </div>
            </div>

            {/* Grid 4: Approval Status & Internal Remarks */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-indigo-600" /> Approval & Verification Audit
                </h4>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border flex items-center gap-1.5 shadow-2xs ${
                  selectedViewItem.approvalStatus === 'Approved' || selectedViewItem.isApproved
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : selectedViewItem.approvalStatus === 'Not Approved'
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {selectedViewItem.approvalStatus === 'Approved' || selectedViewItem.isApproved ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-700" /> Approved & Verified
                    </>
                  ) : selectedViewItem.approvalStatus === 'Not Approved' ? (
                    <>
                      <AlertCircle size={13} className="text-rose-700" /> Not Approved
                    </>
                  ) : (
                    <>
                      <Clock size={13} className="text-amber-700 animate-pulse" /> Pending Approval Review
                    </>
                  )}
                </span>
              </div>

              {/* Status & Manager Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Card 1: Approval Status */}
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                  selectedViewItem.approvalStatus === 'Approved' || selectedViewItem.isApproved
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : selectedViewItem.approvalStatus === 'Not Approved'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className={`p-2 rounded-lg ${
                    selectedViewItem.approvalStatus === 'Approved' || selectedViewItem.isApproved
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedViewItem.approvalStatus === 'Not Approved'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedViewItem.approvalStatus === 'Approved' || selectedViewItem.isApproved ? <ShieldCheck size={18} /> : selectedViewItem.approvalStatus === 'Not Approved' ? <AlertCircle size={18} /> : <Clock size={18} />}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Approval Status</span>
                    <span className="font-black text-xs">
                      {selectedViewItem.approvalStatus || (selectedViewItem.isApproved ? 'Approved' : 'Pending Verification')}
                    </span>
                  </div>
                </div>

                {/* Card 2: Workflow Stage */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Activity size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Workflow Status</span>
                    <span className={`font-extrabold text-xs px-2.5 py-0.5 rounded-full inline-block mt-0.5 border ${
                      selectedViewItem.status === 'Parcel Sent'
                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        : selectedViewItem.status === 'In Discussion'
                        ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                        : selectedViewItem.status === 'Completed' || selectedViewItem.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : selectedViewItem.status === 'Settled'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : selectedViewItem.status === 'Under Review'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      {selectedViewItem.status === 'Parcel Sent' ? '📦 Parcel Sent' : selectedViewItem.status === 'In Discussion' ? '💬 In Discussion' : selectedViewItem.status || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Card 3: Manager / Team */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <User size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Managed By</span>
                    <span className="font-extrabold text-xs text-slate-900">{selectedViewItem.influencerManager || (selectedViewItem.brandManagerTeam ? 'Unassigned' : '—')}</span>
                    {selectedViewItem.brandManagerTeam && (
                      <span className="text-[10px] text-purple-700 font-extrabold block">Brand Manager: {selectedViewItem.brandManagerTeam}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Rejection / Disapproval Alert Box */}
              {selectedViewItem.reason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-rose-700 flex items-center gap-1">
                    <AlertCircle size={12} /> Disapproval / Rejection Reason
                  </span>
                  <div className="font-bold text-rose-900 text-xs">{selectedViewItem.reason}</div>
                </div>
              )}

              {/* Remarks & Internal Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Remarks</span>
                  {selectedViewItem.remark ? (
                    <p className="font-medium text-slate-700 text-xs">{selectedViewItem.remark}</p>
                  ) : (
                    <p className="font-medium text-slate-400 italic text-xs">No remarks added</p>
                  )}
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Internal Notes</span>
                  {selectedViewItem.notes ? (
                    <p className="font-medium text-slate-700 text-xs">{selectedViewItem.notes}</p>
                  ) : (
                    <p className="font-medium text-slate-400 italic text-xs">No internal notes added</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const itemToEdit = selectedViewItem;
                  setSelectedViewItem(null);
                  openEditModal(itemToEdit);
                }}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl font-extrabold text-xs transition inline-flex items-center gap-1.5"
              >
                <Edit2 size={13} /> Edit Record
              </button>
              <button
                type="button"
                onClick={() => setSelectedViewItem(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REUSABLE DELETE CONFIRMATION MODAL PANEL */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title={deleteModalState.title}
        itemType={deleteModalState.itemType}
        itemName={deleteModalState.itemName}
        warningMessage={deleteModalState.warningMessage}
        loading={deleteModalState.loading}
      />

      {/* HISTORICAL / PREVIOUS MONTH COLLABORATION IMPORT MODAL */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          if (!isSubmittingImport) {
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportFileBase64('');
            setImportPreviewList([]);
            setImportStatusMessage(null);
          }
        }}
        title="Import Collaborations (Excel / CSV)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          {/* Top Info Banner & Template Download */}
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-purple-600" />
                <span>Import Previous Month or Offline Data</span>
              </h4>
              <p className="text-slate-600 text-xs font-medium leading-relaxed">
                Upload collaboration records for past or custom months. These records are protected from live Google Sheet auto-sync and will automatically update target achievements.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
              title="Download sample CSV template formatted with sheet headers"
            >
              <Download size={13} />
              <span>Download Template</span>
            </button>
          </div>

          {/* Month Scope & Year Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Target Month Scope
              </label>
              <select
                value={importMonthOverride}
                onChange={e => setImportMonthOverride(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                <option value="auto">Auto-detect from Date column (Recommended)</option>
                <option value="september_2026">September 2026</option>
                <option value="august_2026">August 2026</option>
                <option value="july_2026">July 2026</option>
                <option value="june_2026">June 2026</option>
                <option value="may_2026">May 2026</option>
                <option value="april_2026">April 2026</option>
                <option value="march_2026">March 2026</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Default Year
              </label>
              <input
                type="number"
                value={importYearOverride}
                onChange={e => setImportYearOverride(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                min="2020"
                max="2035"
              />
            </div>
          </div>

          {/* Drag & Drop File Upload Zone */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Select Excel / CSV File (.xlsx, .xls, .csv)
            </label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelected(e.dataTransfer.files[0]);
                }
              }}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition cursor-pointer ${
                importFile ? 'border-purple-400 bg-purple-50/40' : 'border-slate-300 hover:border-purple-400 bg-slate-50/60 hover:bg-purple-50/20'
              }`}
              onClick={() => {
                const input = document.getElementById('collab-file-input');
                if (input) input.click();
              }}
            >
              <input
                id="collab-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2 shadow-2xs">
                {isReadingFile ? <Loader2 size={24} className="animate-spin text-purple-600" /> : <Upload size={24} />}
              </div>

              {importFile ? (
                <div className="space-y-0.5">
                  <p className="font-extrabold text-slate-900 text-xs">{importFile.name}</p>
                  <p className="text-[11px] text-purple-700 font-bold">
                    {(importFile.size / 1024).toFixed(1)} KB • {importTotalRows > 0 ? `${importTotalRows} rows detected` : 'Parsing file...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 text-xs">
                    Drag and drop your spreadsheet here, or <span className="text-purple-700 underline font-extrabold">browse</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Supports Excel (.xlsx, .xls) and CSV (.csv) formats matching standard headers
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status Message Banner */}
          {importStatusMessage && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold animate-fade-in ${
              importStatusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {importStatusMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
              <span>{importStatusMessage.text}</span>
            </div>
          )}

          {/* Live Data Preview Table */}
          {importPreviewList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-700">
                  Data Preview (First {importPreviewList.length} of {importTotalRows} rows)
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Columns mapped automatically
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-800 text-slate-200 font-bold">
                    <tr>
                      <th className="p-2 border-b border-r border-slate-700 text-center w-8">#</th>
                      <th className="p-2 border-b border-r border-slate-700">Date</th>
                      <th className="p-2 border-b border-r border-slate-700">Brand</th>
                      <th className="p-2 border-b border-r border-slate-700">Assignee</th>
                      <th className="p-2 border-b border-r border-slate-700 text-center">Type</th>
                      <th className="p-2 border-b border-r border-slate-700">Deliverable</th>
                      <th className="p-2 border-b border-slate-700 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                    {importPreviewList.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-400 font-bold border-r border-slate-100">{row.rowNumber}</td>
                        <td className="p-2 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap">{row.date}</td>
                        <td className="p-2 font-extrabold text-slate-900 border-r border-slate-100">{row.brandName}</td>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-100">{row.assignee || row.brandManager || '—'}</td>
                        <td className="p-2 text-center border-r border-slate-100">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            row.collabType === 'Paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                          }`}>
                            {row.collabType}
                          </span>
                        </td>
                        <td className="p-2 text-slate-700 border-r border-slate-100">{row.videoType}</td>
                        <td className="p-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              disabled={isSubmittingImport}
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportFileBase64('');
                setImportPreviewList([]);
                setImportStatusMessage(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingImport || !importFileBase64 || importPreviewList.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold transition text-xs shadow-md shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isSubmittingImport ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Importing Records...</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>Import {importTotalRows > 0 ? `${importTotalRows} Records` : 'Collaborations'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* COMMISSION SLABS & INCENTIVE RULES MODAL */}
      <Modal
        isOpen={isSlabsModalOpen}
        onClose={() => setIsSlabsModalOpen(false)}
        title="Commission Slabs & Incentive Rules"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 font-medium">
            Influencer Marketing Executives earn lucrative performance bonuses based on their monthly Ad2ship net margin and viral content deliverables.
          </p>

          <div className="space-y-3">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 uppercase flex items-center gap-1.5">
                  <Award size={16} className="text-emerald-600" /> Tier 1: 10% Incentive Slab
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  10% Payout
                </span>
              </div>
              <p className="text-xs font-black text-slate-900">
                Target: ₹1,00,000+ Net Margin (Quota: ₹1,20,000)
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Executive receives <strong className="text-emerald-700 font-bold">10% incentive</strong> on entire Ad2ship Net Profit Margin achieved in that calendar month.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-blue-600" /> Tier 2: 5% Incentive Slab
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                  5% Payout
                </span>
              </div>
              <p className="text-xs font-black text-slate-900">
                Target: ₹80,000 to ₹99,999 Net Margin
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Executive receives <strong className="text-blue-700 font-bold">5% incentive</strong> on entire Ad2ship Net Profit Margin achieved in that calendar month.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-600" /> Viral Deal Bonus (100+ Orders)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  +10% Deal Bonus
                </span>
              </div>
              <p className="text-xs font-black text-slate-900">
                Per Video Deliverable with 100+ Orders Generated
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Extra <strong className="text-amber-800 font-bold">+10% bonus on that specific video's profit margin</strong>, stacking directly on top of the monthly payout.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setIsSlabsModalOpen(false)}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shadow-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
