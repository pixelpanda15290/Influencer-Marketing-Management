import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Search, Filter, Phone, Mail, Instagram, CheckCircle2, 
  Clock, XCircle, ChevronRight, Copy, Check, ExternalLink, MessageCircle,
  Building2, DollarSign, Package, UserCheck, AlertCircle, Loader2,
  RefreshCw, MapPin, Eye, FileText, Send, ArrowUpRight, User, Tag, Gift, Layers, Plus, IndianRupee, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { InfluencerApplication, Brand } from '../types';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const NICHE_OPTIONS = [
  'All',
  'Fashion & Styling',
  'Beauty, Makeup & Skincare',
  'Health & Fitness',
  'Food & Culinary',
  'Lifestyle & Daily Vlogs',
  'Tech & Gadgets',
  'Travel & Adventure',
  'Comedy & Entertainment',
  'Parenting & Kids',
  'Finance & Crypto',
  'Gaming & Esports',
  'Other'
];

const DELIVERABLES_PRESETS = [
  '1 Dedicated Reel',
  '1 Story',
  '2 Dedicated Reels',
  '2 Stories',
  '1 Product Unboxing Video',
  '1 Story Series (3 Frames)',
  '1 Integrated Video',
  'Collaborative Post',
  'Photo Carousel Post',
  'Link in Bio (24 Hrs)'
];

interface InfluencerApplicationsViewProps {
  isEmbedded?: boolean;
}

export const InfluencerApplicationsView: React.FC<InfluencerApplicationsViewProps> = ({ isEmbedded = false }) => {
  const [applications, setApplications] = useState<InfluencerApplication[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    allotted: 0,
    rejected: 0,
    barterOnly: 0,
    paidOnly: 0,
    bothCollab: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [collabTypeFilter, setCollabTypeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals & UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedApp, setSelectedApp] = useState<InfluencerApplication | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAllotModal, setShowAllotModal] = useState(false);

  // Allot Brand Form State
  const [allotForm, setAllotForm] = useState({
    brandId: '',
    brandName: '',
    collabType: 'Barter' as 'Barter' | 'Paid' | 'Both',
    deliverables: '1 Dedicated Reel + 1 Story',
    commercialAmount: 0,
    managerNotes: '',
    sendEmailNotification: true,
    addToActiveTracking: true
  });
  const [submittingAllotment, setSubmittingAllotment] = useState(false);
  const [allotmentSuccessData, setAllotmentSuccessData] = useState<{
    whatsappShareUrl: string;
    whatsappMessage: string;
    brandName: string;
    influencerName: string;
  } | null>(null);

  // Deliverables Dropdown State & Dynamic Options
  const [showDeliverablesDropdown, setShowDeliverablesDropdown] = useState(false);
  const [deliverableOptions, setDeliverableOptions] = useState<string[]>(DELIVERABLES_PRESETS);
  const [newDeliverableInput, setNewDeliverableInput] = useState('');
  const deliverablesDropdownRef = useRef<HTMLDivElement>(null);

  const handleAddNewDeliverable = () => {
    const trimmed = newDeliverableInput.trim();
    if (!trimmed) return;

    if (!deliverableOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase())) {
      setDeliverableOptions(prev => [...prev, trimmed]);
    }

    const current = (allotForm.deliverables || '').trim();
    if (!current) {
      setAllotForm(prev => ({ ...prev, deliverables: trimmed }));
    } else {
      const parts = current
        .split(/\s*(?:\+|\band\b|,)\s*/i)
        .map(p => p.trim())
        .filter(Boolean);

      if (!parts.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
        parts.push(trimmed);
        setAllotForm(prev => ({ ...prev, deliverables: parts.join(' + ') }));
      }
    }

    setNewDeliverableInput('');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deliverablesDropdownRef.current && !deliverablesDropdownRef.current.contains(e.target as Node)) {
        setShowDeliverablesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Brands for dropdown
  const fetchBrands = async () => {
    try {
      const res = await api.get('/brands?all=true&limit=500');
      const brandList = res.data || res.brands || (Array.isArray(res) ? res : []);
      if (Array.isArray(brandList)) {
        setBrands(brandList);
      }
    } catch (err) {
      console.error('Failed to load brands:', err);
    }
  };

  // Fetch Applications
  const fetchApplications = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setLoading(true);

    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '20'
      });
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (collabTypeFilter !== 'All') queryParams.append('collabType', collabTypeFilter);
      if (categoryFilter !== 'All') queryParams.append('category', categoryFilter);
      if (search.trim()) queryParams.append('search', search.trim());

      const res = await api.get(`/influencer-applications?${queryParams.toString()}`);
      if (res.success) {
        setApplications(res.items || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.totalCount || 0);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [page, statusFilter, collabTypeFilter, categoryFilter]);

  // Debounced Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchApplications();
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Copy Public Form Link (to send over WhatsApp to influencers)
  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}#/apply`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Open Allotment Modal
  const handleOpenAllotModal = async (appItem: InfluencerApplication) => {
    setSelectedApp(appItem);
    setAllotmentSuccessData(null);
    let currentBrands = brands;
    if (currentBrands.length === 0) {
      try {
        const res = await api.get('/brands?all=true&limit=500');
        const list = res.data || res.brands || [];
        if (Array.isArray(list) && list.length > 0) {
          currentBrands = list;
          setBrands(list);
        }
      } catch (err) {
        console.error('Error fetching brands for modal:', err);
      }
    }

    const firstBrand = currentBrands[0];
    setAllotForm({
      brandId: (firstBrand as any)?._id || firstBrand?.brandId || '',
      brandName: firstBrand?.brandName || (currentBrands.length === 0 ? 'Other / Custom Brand' : ''),
      collabType: (appItem.collabTypePreference === 'Paid' || appItem.collabTypePreference === 'Both')
        ? appItem.collabTypePreference
        : 'Barter',
      deliverables: '1 Dedicated Reel + 1 Story',
      commercialAmount: appItem.costPerReel || 0,
      managerNotes: '',
      sendEmailNotification: true,
      addToActiveTracking: true
    });
    setShowDeliverablesDropdown(false);
    setShowAllotModal(true);
  };

  // Submit Brand Allotment
  const handleAllotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    if (!allotForm.brandName) {
      alert('Please select or specify a brand to allot.');
      return;
    }

    setSubmittingAllotment(true);
    try {
      const res = await api.post(`/influencer-applications/${selectedApp._id}/allot-brand`, {
        brandId: allotForm.brandId,
        brandName: allotForm.brandName,
        collabType: allotForm.collabType,
        deliverables: allotForm.deliverables,
        commercialAmount: allotForm.commercialAmount,
        managerNotes: allotForm.managerNotes,
        sendEmailNotification: allotForm.sendEmailNotification,
        addToActiveTracking: allotForm.addToActiveTracking
      });

      if (res.success) {
        setAllotmentSuccessData({
          whatsappShareUrl: res.whatsappShareUrl,
          whatsappMessage: res.whatsappMessage,
          brandName: allotForm.brandName,
          influencerName: selectedApp.fullName
        });
        fetchApplications();
      } else {
        alert(res.message || 'Failed to allot brand.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while allotting brand.');
    } finally {
      setSubmittingAllotment(false);
    }
  };

  // Helper to check if a deliverable preset is included in current text
  const isDeliverableSelected = (chip: string) => {
    if (!allotForm.deliverables) return false;
    const parts = allotForm.deliverables
      .split(/\s*(?:\+|\band\b|,)\s*/i)
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);
    return parts.some(p => p === chip.toLowerCase() || p.includes(chip.toLowerCase()));
  };

  // Toggle deliverable chip while preserving any custom text written by user
  const handleToggleDeliverableChip = (chip: string) => {
    const current = (allotForm.deliverables || '').trim();
    if (!current) {
      setAllotForm(prev => ({ ...prev, deliverables: chip }));
      return;
    }

    // Split by ' + ' or ',' or ' and '
    let items = current
      .split(/\s*(?:\+|\band\b|,)\s*/i)
      .map(s => s.trim())
      .filter(Boolean);

    const existingIdx = items.findIndex(
      item => item.toLowerCase() === chip.toLowerCase() || item.toLowerCase().includes(chip.toLowerCase())
    );

    if (existingIdx >= 0) {
      // Toggle off / remove
      items.splice(existingIdx, 1);
    } else {
      // Toggle on / append
      items.push(chip);
    }

    setAllotForm(prev => ({ ...prev, deliverables: items.join(' + ') }));
  };

  // WhatsApp wa.me generator helper
  const getWhatsAppDirectUrl = (appItem: InfluencerApplication) => {
    const rawDigits = (appItem.whatsappNumber || '').replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
    
    if (appItem.whatsappMessageText) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(appItem.whatsappMessageText)}`;
    }

    const defaultMsg = `Hi ${appItem.fullName}! Greetings from Ad2ship Influencer Operations. We received your creator application!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
  };

  // Helper to extract initials for avatar
  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'CR';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* ── Top Header Banner: Light Panel Card (Shown when standalone) ────────── */}
      {!isEmbedded ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-purple-50/70 via-pink-50/30 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              Influencer Application and Allocation
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">
              Review inbound creators from the WhatsApp onboarding form, allot matching brands, and trigger alerts.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 relative z-10">
            <button
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
                copiedLink
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check size={14} /> Link Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy WhatsApp Form Link
                </>
              )}
            </button>

            <a
              href={`${window.location.origin}${window.location.pathname}#/apply`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 flex items-center gap-1.5 transition"
            >
              <ExternalLink size={14} /> Preview Form
            </a>
          </div>
        </div>
      ) : (
        /* Action Banner when embedded inside Influencer Operations Hub */
        <div className="bg-gradient-to-r from-purple-50/70 via-white to-purple-50/40 border border-purple-200/70 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">Inbound Creator WhatsApp Onboarding Form</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Live &bull; Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Share this link across WhatsApp broadcasts &amp; DMs to collect verified creator details, rates, and PR parcel sizing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
                copiedLink
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check size={14} /> Link Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Form Link
                </>
              )}
            </button>

            <a
              href={`${window.location.origin}${window.location.pathname}#/apply`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center gap-1.5 transition shadow-2xs"
            >
              <ExternalLink size={14} />
              <span>Preview Form</span>
            </a>
          </div>
        </div>
      )}

      {/* ── KPI Metric Cards: Unified Executive Card (Compact, Balanced, Not Stretched) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* Total Submissions */}
          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Submissions</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Via WhatsApp Broadcast</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FileText size={17} />
            </div>
          </div>

          {/* Pending Review */}
          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">Pending Review</span>
              <span className="text-xl font-black text-amber-600 mt-0.5 block">{stats.pending}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Needs Brand Allotment</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={17} />
            </div>
          </div>

          {/* Brand Allotted */}
          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">Brand Allotted</span>
              <span className="text-xl font-black text-emerald-600 mt-0.5 block">{stats.allotted}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Dispatched to Creators</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={17} />
            </div>
          </div>

          {/* Barter vs Paid Split */}
          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Collab Preferences</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-bold text-xs">
                  {stats.barterOnly} Barter
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-xs">
                  {stats.paidOnly} Paid
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">{stats.bothCollab} open for both deals</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Tag size={17} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ─────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search by name, @handle, phone, email, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Brand Allotted">Brand Allotted</option>
              <option value="Reviewing">Reviewing</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Collab Preference Filter */}
          <div className="md:col-span-2">
            <select
              value={collabTypeFilter}
              onChange={e => { setCollabTypeFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
            >
              <option value="All">All Collab Deals</option>
              <option value="Barter">Barter Collabs</option>
              <option value="Paid">Paid Collabs</option>
              <option value="Both">Both Barter &amp; Paid</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
            >
              <option value="All">All Niches</option>
              {NICHE_OPTIONS.filter(n => n !== 'All').map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Refresh Button (Compact Square) */}
          <div className="md:col-span-1 flex justify-end">
            <button
              onClick={() => fetchApplications(true)}
              disabled={isRefreshing}
              className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0"
              title="Refresh applications list"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-purple-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Submissions Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Influencer</th>
                <th className="py-3.5 px-4">Instagram &amp; Metrics</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Collab &amp; Rates</th>
                <th className="py-3.5 px-4">Status &amp; Brand</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-purple-600 mb-2" />
                    Loading submissions...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <UserCheck size={36} className="mx-auto text-slate-300 mb-2" />
                    <div className="text-slate-600 font-bold text-sm">No submissions found</div>
                    <p className="text-slate-400 text-xs mt-1">Copy the WhatsApp form link above and share it with influencers.</p>
                  </td>
                </tr>
              ) : (
                applications.map(item => {
                  const isAllotted = item.status === 'Brand Allotted';
                  const isPending = item.status === 'Pending';
                  const isRejected = item.status === 'Rejected';

                  return (
                    <tr key={item._id} className="hover:bg-purple-50/30 transition">
                      {/* Name & City with Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {getInitials(item.fullName)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              {item.fullName}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{item.city}{item.state ? `, ${item.state}` : ''}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Applied: {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Instagram & Niche */}
                      <td className="py-3.5 px-4">
                        <a
                          href={item.instagramUrl || `https://instagram.com/${item.instagramHandle.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/60 font-bold text-xs transition group"
                        >
                          <Instagram size={13} className="text-pink-600" />
                          <span>{item.instagramHandle}</span>
                          <ArrowUpRight size={11} className="text-pink-400 group-hover:translate-x-0.5 transition" />
                        </a>
                        <div className="text-xs font-bold text-slate-800 mt-1.5">
                          {item.category}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.followersCountBracket}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 space-y-1">
                        <a
                          href={`https://wa.me/${item.whatsappNumber.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-emerald-700 transition"
                        >
                          <Phone size={13} className="text-emerald-600" />
                          <span>{item.whatsappNumber}</span>
                        </a>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Mail size={13} className="text-slate-400" />
                          <span className="truncate max-w-[140px]" title={item.email}>{item.email}</span>
                        </div>
                      </td>

                      {/* Collab Preference & Rates */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.collabTypePreference === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.collabTypePreference === 'Barter'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {item.collabTypePreference}
                        </span>
                        {item.costPerReel ? (
                          <div className="text-xs font-black text-slate-900 mt-1">
                            ₹{item.costPerReel.toLocaleString('en-IN')}<span className="text-[10px] font-normal text-slate-500">/Reel</span>
                          </div>
                        ) : null}
                      </td>

                      {/* Status & Allotted Brand */}
                      <td className="py-3.5 px-4">
                        {isAllotted ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Allotted
                            </span>
                            <div className="font-extrabold text-purple-900 text-xs flex items-center gap-1 mt-0.5">
                              <Building2 size={12} className="text-purple-600" />
                              <span>{item.allottedBrandName}</span>
                            </div>
                          </div>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-black uppercase shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black uppercase">
                            <XCircle size={11} /> {item.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Allot Brand Button */}
                          <button
                            onClick={() => handleOpenAllotModal(item)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            title="Allot Brand to this Influencer"
                          >
                            <Building2 size={13} />
                            <span>{isAllotted ? 'Re-allot' : 'Allot Brand'}</span>
                          </button>

                          {/* Direct WhatsApp Message Link */}
                          <a
                            href={getWhatsAppDirectUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition"
                            title="Send WhatsApp message"
                          >
                            <MessageCircle size={15} />
                          </a>

                          {/* Details Button */}
                          <button
                            onClick={() => {
                              setSelectedApp(item);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition cursor-pointer"
                            title="View Full Profile & Address"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalCount}
            itemsPerPage={20}
          />
        </div>
      </div>

      {/* ====================================================================== */}
      {/* ALLOT BRAND MODAL (Executive Light Theme - Wide Professional Layout) */}
      {/* ====================================================================== */}
      {showAllotModal && selectedApp && (
        <Modal
          isOpen={showAllotModal}
          onClose={() => {
            setShowAllotModal(false);
            setAllotmentSuccessData(null);
          }}
          title={allotmentSuccessData ? 'Brand Allotted Successfully!' : `Allot Brand to ${selectedApp.fullName}`}
          maxWidth="max-w-4xl"
        >
          {allotmentSuccessData ? (
            /* Success View with Direct WhatsApp Trigger */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm">
                    {allotmentSuccessData.brandName} allotted to {allotmentSuccessData.influencerName}!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    An official brand allotment confirmation email has been dispatched to <strong>{selectedApp.email}</strong>.
                  </p>
                </div>
              </div>

              {/* Ready-to-send WhatsApp Message Preview in WhatsApp styled container */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <MessageCircle size={15} className="text-emerald-600" />
                    Prepared WhatsApp Message (Ready to Send)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(allotmentSuccessData.whatsappMessage);
                      alert('WhatsApp message copied to clipboard!');
                    }}
                    className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={12} /> Copy Text
                  </button>
                </div>
                <div className="bg-white border border-emerald-200/80 rounded-xl p-3 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed shadow-2xs border-l-4 border-l-emerald-500">
                  {allotmentSuccessData.whatsappMessage}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a
                  href={allotmentSuccessData.whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition cursor-pointer"
                >
                  <Send size={16} /> Open in WhatsApp &amp; Send to {selectedApp.fullName.split(' ')[0]}
                </a>

                <button
                  type="button"
                  onClick={() => setShowAllotModal(false)}
                  className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Allotment Form */
            <form onSubmit={handleAllotSubmit} className="space-y-4">
              {/* Creator Snapshot Card */}
              <div className="p-4 bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-pink-50/30 border border-purple-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
                    {getInitials(selectedApp.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                        {selectedApp.fullName}
                      </h4>
                      <a
                        href={`https://instagram.com/${selectedApp.instagramHandle.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-purple-700 bg-purple-100/80 hover:bg-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition"
                      >
                        <Instagram size={12} />
                        <span>{selectedApp.instagramHandle}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
                      <span className="font-semibold text-slate-700">{selectedApp.category}</span>
                      <span>&bull;</span>
                      <span>{selectedApp.city}{selectedApp.state ? `, ${selectedApp.state}` : ''}</span>
                      {selectedApp.followersCountBracket && (
                        <>
                          <span>&bull;</span>
                          <span className="text-purple-700 font-semibold">{selectedApp.followersCountBracket}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 text-right bg-white/90 p-2.5 rounded-xl border border-purple-100/70 shrink-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
                    Preference: <span className="text-purple-950 font-black">{selectedApp.collabTypePreference}</span>
                  </div>
                  {selectedApp.costPerReel ? (
                    <div className="text-xs font-black text-slate-900">
                      Rate: ₹{selectedApp.costPerReel.toLocaleString()}<span className="text-[10px] font-semibold text-slate-500">/Reel</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-bold text-emerald-600">Open to Barter PR</div>
                  )}
                </div>
              </div>

              {/* 2-Column Executive Row: Brand Selector & Collaboration Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Brand Selector */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 size={14} className="text-purple-600" />
                    Select Brand to Allot <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={allotForm.brandName}
                    onChange={e => {
                      const selectedBrand = brands.find(b => b.brandName === e.target.value);
                      setAllotForm(prev => ({
                        ...prev,
                        brandName: e.target.value,
                        brandId: (selectedBrand as any)?._id || selectedBrand?.brandId || ''
                      }));
                    }}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white shadow-2xs transition"
                  >
                    {brands.length === 0 && (
                      <option value="" disabled>-- No brands found in system --</option>
                    )}
                    {brands.map((b, idx) => (
                      <option key={b.brandId || (b as any)._id || idx} value={b.brandName}>
                        {b.brandName} {b.industry ? `(${b.industry})` : ''} {b.brandId ? `• ${b.brandId}` : ''}
                      </option>
                    ))}
                    <option value="Other / Custom Brand">+ Other / Custom Brand</option>
                  </select>

                  {allotForm.brandName === 'Other / Custom Brand' && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Custom Brand Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter brand name..."
                        onChange={e => setAllotForm(prev => ({ ...prev, brandName: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* Collab Type Selectable Cards */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Collaboration Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Barter Option Card */}
                    <button
                      type="button"
                      onClick={() => setAllotForm(prev => ({ ...prev, collabType: 'Barter' }))}
                      className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        allotForm.collabType === 'Barter'
                          ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          allotForm.collabType === 'Barter' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Gift size={13} />
                        </div>
                        <span className="text-xs font-black text-slate-900 truncate">Barter</span>
                      </div>
                      {allotForm.collabType === 'Barter' && (
                        <CheckCircle2 size={13} className="text-purple-600 shrink-0 ml-1" />
                      )}
                    </button>

                    {/* Paid Option Card */}
                    <button
                      type="button"
                      onClick={() => setAllotForm(prev => ({
                        ...prev,
                        collabType: 'Paid',
                        commercialAmount: prev.commercialAmount || selectedApp.costPerReel || 0
                      }))}
                      className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        allotForm.collabType === 'Paid'
                          ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          allotForm.collabType === 'Paid' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <IndianRupee size={13} />
                        </div>
                        <span className="text-xs font-black text-slate-900 truncate">Paid</span>
                      </div>
                      {allotForm.collabType === 'Paid' && (
                        <CheckCircle2 size={13} className="text-purple-600 shrink-0 ml-1" />
                      )}
                    </button>

                    {/* Both Option Card */}
                    <button
                      type="button"
                      onClick={() => setAllotForm(prev => ({
                        ...prev,
                        collabType: 'Both',
                        commercialAmount: prev.commercialAmount || selectedApp.costPerReel || 0
                      }))}
                      className={`py-2 px-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        allotForm.collabType === 'Both'
                          ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          allotForm.collabType === 'Both' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Sparkles size={13} />
                        </div>
                        <span className="text-xs font-black text-slate-900 truncate">Both</span>
                      </div>
                      {allotForm.collabType === 'Both' && (
                        <CheckCircle2 size={13} className="text-purple-600 shrink-0 ml-1" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Conditional Mode Details: Barter PR details vs Paid Commercial input vs Both */}
              {allotForm.collabType === 'Both' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Paid Commercial Box */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5 flex flex-col justify-between">
                    <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <IndianRupee size={14} className="text-amber-600" />
                      Agreed Commercial Payout (₹ INR) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">₹</span>
                      <input
                        type="number"
                        value={allotForm.commercialAmount}
                        onChange={e => setAllotForm(prev => ({ ...prev, commercialAmount: Number(e.target.value) }))}
                        placeholder="0"
                        className="w-full pl-8 pr-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* PR Parcel Box */}
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                      <div className="flex items-center gap-1.5">
                        <Package size={14} className="text-emerald-600" />
                        <span>PR Parcel Delivery &amp; Sizing</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                        Shipping Details
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 font-medium truncate" title={`${selectedApp.shippingAddress?.addressLine || 'Address provided'}, ${selectedApp.shippingAddress?.city || selectedApp.city}, ${selectedApp.shippingAddress?.state || selectedApp.state} - ${selectedApp.shippingAddress?.pincode || ''}`}>
                      {selectedApp.shippingAddress?.addressLine || 'Address provided'}, {selectedApp.shippingAddress?.city || selectedApp.city}
                    </div>
                    {(selectedApp.shippingAddress?.clothingSize || selectedApp.shippingAddress?.shoeSize) && (
                      <div className="flex items-center gap-2 pt-0.5 text-[11px] font-bold text-slate-700">
                        {selectedApp.shippingAddress?.clothingSize && (
                          <span className="bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                            Clothing: <strong className="text-emerald-950">{selectedApp.shippingAddress.clothingSize}</strong>
                          </span>
                        )}
                        {selectedApp.shippingAddress?.shoeSize && (
                          <span className="bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                            Footwear: <strong className="text-emerald-950">{selectedApp.shippingAddress.shoeSize}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : allotForm.collabType === 'Paid' ? (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5">
                  <label className="block text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <IndianRupee size={14} className="text-amber-600" />
                    Agreed Commercial Payout (₹ INR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      value={allotForm.commercialAmount}
                      onChange={e => setAllotForm(prev => ({ ...prev, commercialAmount: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                    <div className="flex items-center gap-1.5">
                      <Package size={14} className="text-emerald-600" />
                      <span>PR Parcel Delivery &amp; Sizing</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      Shipping Details
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-slate-700 font-medium">
                      {selectedApp.shippingAddress?.addressLine || 'Address provided'}, {selectedApp.shippingAddress?.city || selectedApp.city}, {selectedApp.shippingAddress?.state || selectedApp.state} - {selectedApp.shippingAddress?.pincode || ''}
                      {selectedApp.shippingAddress?.landmark ? ` (Near ${selectedApp.shippingAddress.landmark})` : ''}
                    </div>
                    {(selectedApp.shippingAddress?.clothingSize || selectedApp.shippingAddress?.shoeSize) && (
                      <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-slate-700">
                        {selectedApp.shippingAddress?.clothingSize && (
                          <span className="bg-white border border-emerald-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                            Clothing: <strong className="text-emerald-950">{selectedApp.shippingAddress.clothingSize}</strong>
                          </span>
                        )}
                        {selectedApp.shippingAddress?.shoeSize && (
                          <span className="bg-white border border-emerald-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                            Footwear: <strong className="text-emerald-950">{selectedApp.shippingAddress.shoeSize}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Campaign Deliverables (Multi-Select Dropdown & Custom Text Input) */}
              <div ref={deliverablesDropdownRef} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                    Campaign Deliverables <span className="text-rose-500">*</span>
                  </label>
                  {allotForm.deliverables && (
                    <button
                      type="button"
                      onClick={() => setAllotForm(prev => ({ ...prev, deliverables: '' }))}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Clear deliverables text"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={allotForm.deliverables}
                    onChange={e => setAllotForm(prev => ({ ...prev, deliverables: e.target.value }))}
                    placeholder="Type deliverables or select from dropdown..."
                    className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-bold focus:bg-white focus:outline-none focus:border-purple-500 shadow-2xs transition"
                  />
                  
                  {/* Clean Arrow Button (No label) */}
                  <button
                    type="button"
                    onClick={() => setShowDeliverablesDropdown(prev => !prev)}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer transition flex items-center justify-center"
                    title="Select deliverables"
                  >
                    <ChevronDown size={17} className={`transition-transform duration-200 ${showDeliverablesDropdown ? 'rotate-180 text-purple-600' : ''}`} />
                  </button>
                </div>

                {/* Multi-Select Dropdown Menu Popover */}
                {showDeliverablesDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between border-b border-slate-100 mb-1.5">
                      <span>Select Deliverables (Multi-Select)</span>
                      <span className="text-purple-600 font-bold">Click to toggle</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                      {deliverableOptions.map(chip => {
                        const selected = isDeliverableSelected(chip);
                        return (
                          <button
                            type="button"
                            key={chip}
                            onClick={() => handleToggleDeliverableChip(chip)}
                            className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between text-left cursor-pointer ${
                              selected
                                ? 'bg-purple-50 text-purple-800 font-black border border-purple-200 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <span className="truncate">{chip}</span>
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ml-2 ${
                              selected ? 'bg-purple-600 text-white' : 'border border-slate-300 bg-white'
                            }`}>
                              {selected && <Check size={11} className="stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Add Custom Deliverable into Dropdown */}
                    <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center gap-2 px-1">
                      <input
                        type="text"
                        value={newDeliverableInput}
                        onChange={e => setNewDeliverableInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewDeliverable();
                          }
                        }}
                        placeholder="+ Add custom deliverable..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewDeliverable}
                        disabled={!newDeliverableInput.trim()}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Guidelines & Manager Notes */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Special Notes &amp; Guidelines
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={allotForm.managerNotes}
                  onChange={e => setAllotForm(prev => ({ ...prev, managerNotes: e.target.value }))}
                  placeholder="e.g. Tag @brandname, use hashtag #BrandCollab, draft approval required before posting..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500 shadow-2xs transition"
                />
              </div>

              {/* Notification Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Email Alert Toggle */}
                <label className="py-2.5 px-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-purple-200 transition">
                  <input
                    type="checkbox"
                    checked={allotForm.sendEmailNotification}
                    onChange={e => setAllotForm(prev => ({ ...prev, sendEmailNotification: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Mail size={13} className="text-purple-600" />
                    <span>Send Allotment Email</span>
                  </div>
                </label>

                {/* Tracking Sync Toggle */}
                <label className="py-2.5 px-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-purple-200 transition">
                  <input
                    type="checkbox"
                    checked={allotForm.addToActiveTracking}
                    onChange={e => setAllotForm(prev => ({ ...prev, addToActiveTracking: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-600" />
                    <span>Sync to Active Tracking</span>
                  </div>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllotModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingAllotment}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-purple-500/25 transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingAllotment ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Allotting &amp; Dispatching...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Allot Brand &amp; Generate WhatsApp Alert
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ====================================================================== */}
      {/* DETAILS MODAL (Full Application Information) */}
      {/* ====================================================================== */}
      {showDetailsModal && selectedApp && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`Influencer Application: ${selectedApp.fullName}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-700">
            {/* Top Creator Header Card */}
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-pink-50/30 border border-purple-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
                  {getInitials(selectedApp.fullName)}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 leading-tight">
                    {selectedApp.fullName}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      {selectedApp.city}{selectedApp.state ? `, ${selectedApp.state}` : ''}
                    </span>
                    <span>&bull;</span>
                    <span>Applied: {new Date(selectedApp.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col sm:items-end gap-1.5">
                {selectedApp.status === 'Brand Allotted' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Brand Allotted
                  </span>
                ) : selectedApp.status === 'Pending' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black uppercase">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Pending Review
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black uppercase">
                    <XCircle size={12} /> {selectedApp.status}
                  </span>
                )}
              </div>
            </div>

            {/* Section 1: Contact Details */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User size={13} className="text-purple-600" />
                <span>1. Personal &amp; Contact Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">WhatsApp Number</span>
                  <a
                    href={`https://wa.me/${selectedApp.whatsappNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-extrabold text-slate-800 hover:text-emerald-600 flex items-center gap-1.5 mt-0.5"
                  >
                    <Phone size={13} className="text-emerald-600" />
                    <span>{selectedApp.whatsappNumber}</span>
                  </a>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Email Address</span>
                  <a
                    href={`mailto:${selectedApp.email}`}
                    className="font-extrabold text-slate-800 hover:text-purple-600 flex items-center gap-1.5 mt-0.5 truncate"
                    title={selectedApp.email}
                  >
                    <Mail size={13} className="text-slate-400" />
                    <span className="truncate">{selectedApp.email}</span>
                  </a>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Current City</span>
                  <span className="font-extrabold text-slate-800 block mt-0.5">{selectedApp.city || 'Not provided'}</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">State</span>
                  <span className="font-extrabold text-slate-800 block mt-0.5">{selectedApp.state || 'Not provided'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Social Media & Audience Metrics */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Instagram size={13} className="text-pink-600" />
                <span>2. Instagram &amp; Audience Metrics</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Instagram Profile</span>
                  <a
                    href={selectedApp.instagramUrl || `https://instagram.com/${selectedApp.instagramHandle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-extrabold text-xs mt-1 transition"
                  >
                    <Instagram size={13} className="text-pink-600" />
                    <span>{selectedApp.instagramHandle}</span>
                    <ArrowUpRight size={11} className="text-pink-400" />
                  </a>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Primary Content Niche</span>
                  <span className="font-extrabold text-slate-800 block mt-1 text-xs">
                    {selectedApp.category}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Audience / Follower Tier</span>
                  <span className="font-extrabold text-slate-800 block mt-1 text-xs">
                    {selectedApp.followersCountBracket}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Content Languages</span>
                  <span className="font-extrabold text-slate-800 block mt-1 text-xs">
                    {selectedApp.languages && selectedApp.languages.length > 0
                      ? selectedApp.languages.join(', ')
                      : 'Hindi, English'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Collaboration Preferences & Commercial Rates */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-600" />
                <span>3. Collaboration Preferences &amp; Rates</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Preferred Deals</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 ${
                    selectedApp.collabTypePreference === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedApp.collabTypePreference === 'Barter'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedApp.collabTypePreference}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Expected Rate per Reel</span>
                  <span className="font-black text-slate-900 block mt-1 text-xs">
                    {selectedApp.costPerReel ? `₹${selectedApp.costPerReel.toLocaleString('en-IN')}` : 'Not specified / Open'}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Expected Rate per Story</span>
                  <span className="font-black text-slate-900 block mt-1 text-xs">
                    {selectedApp.costPerStory ? `₹${selectedApp.costPerStory.toLocaleString('en-IN')}` : 'Not specified / Open'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: PR Package & Shipping Delivery Address */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Package size={13} className="text-blue-600" />
                <span>4. PR Package &amp; Courier Delivery Address</span>
              </div>
              
              <div className="bg-white p-3 rounded-xl border border-blue-100/80 space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Address</span>
                  <div className="font-extrabold text-slate-800 mt-0.5">
                    {selectedApp.shippingAddress?.addressLine || 'Address not specified'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">City, State &amp; Pincode</span>
                    <div className="font-semibold text-slate-700">
                      {selectedApp.shippingAddress?.city || selectedApp.city}, {selectedApp.shippingAddress?.state || selectedApp.state} - {selectedApp.shippingAddress?.pincode || 'N/A'}
                    </div>
                  </div>
                  {selectedApp.shippingAddress?.landmark && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Landmark</span>
                      <div className="font-semibold text-slate-700">{selectedApp.shippingAddress.landmark}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1.5 border-t border-slate-100">
                  {selectedApp.shippingAddress?.clothingSize && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-extrabold text-[11px]">
                      Apparel Size: {selectedApp.shippingAddress.clothingSize}
                    </span>
                  )}
                  {selectedApp.shippingAddress?.shoeSize && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-extrabold text-[11px]">
                      Footwear Size: {selectedApp.shippingAddress.shoeSize}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Allotted Brand Information (if allotted) */}
            {selectedApp.status === 'Brand Allotted' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Campaign Allotment Details</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Allotted Brand</span>
                      <div className="font-black text-purple-900 text-sm flex items-center gap-1 mt-0.5">
                        <Building2 size={13} className="text-purple-600" />
                        <span>{selectedApp.allottedBrandName}</span>
                        <span className="text-xs font-normal text-slate-500">({selectedApp.allottedCollabType})</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Deliverables</span>
                      <div className="font-bold text-slate-800 mt-0.5">{selectedApp.allottedDeliverables}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Campaign Manager</span>
                      <div className="font-bold text-slate-700">{selectedApp.allottedManagerName || 'Operations Team'}</div>
                    </div>
                    {selectedApp.allottedCommercial ? (
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Commercial Agreed</span>
                        <div className="font-black text-emerald-600">₹{selectedApp.allottedCommercial.toLocaleString('en-IN')}</div>
                      </div>
                    ) : null}
                  </div>

                  {selectedApp.managerNotes && (
                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Manager Guidelines / Notes</span>
                      <div className="text-slate-700 italic mt-0.5">{selectedApp.managerNotes}</div>
                    </div>
                  )}

                  {selectedApp.allottedAt && (
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      Allotted on: {new Date(selectedApp.allottedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleOpenAllotModal(selectedApp);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition cursor-pointer"
              >
                <Building2 size={15} /> Allot Brand
              </button>
              <a
                href={getWhatsAppDirectUrl(selectedApp)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
