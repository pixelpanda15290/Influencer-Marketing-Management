import React, { useEffect, useState, useRef } from 'react';
import {
  Briefcase, Package, Search, Copy, Check, ExternalLink, Plus, Eye, Edit2,
  Trash2, RefreshCw, Loader2, Users, IndianRupee, Gift, Sparkles, Building2,
  FileText, Link2, Calendar, Video, CheckCircle2, Clock, ChevronDown, ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { Brand, BrandRequirement } from '../types';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

const PRODUCT_CATEGORIES = [
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
  'Home & Living',
  'Jewelry & Accessories',
  'Other'
];

const TEAM_OPTIONS = [
  'Ad Buyers',
  'Marketing Team',
  'Brand Team',
  'Performance Marketing',
  'Operations',
  'Other'
];

const FOLLOWER_TIERS = [
  'Any',
  '1k – 10k (Nano Creator)',
  '10k – 50k (Micro Creator)',
  '50k – 100k (Mid-Tier Creator)',
  '100k – 500k (Macro Creator)',
  '500k+ (Celebrity / Mega Creator)'
];

interface BrandRequirementsViewProps {
  isEmbedded?: boolean;
  onAllotForRequirement?: (reqItem: BrandRequirement) => void;
}

export const BrandRequirementsView: React.FC<BrandRequirementsViewProps> = ({
  isEmbedded = false,
  onAllotForRequirement
}) => {
  const [requirements, setRequirements] = useState<BrandRequirement[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    fulfilled: 0,
    paused: 0,
    closed: 0,
    barter: 0,
    paid: 0,
    both: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [collabFilter, setCollabFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Copy Link
  const [copiedLink, setCopiedLink] = useState(false);

  // Details Modal
  const [selectedReq, setSelectedReq] = useState<BrandRequirement | null>(null);
  const [allottedCreators, setAllottedCreators] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Add / Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReq, setEditingReq] = useState<BrandRequirement | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const [formState, setFormState] = useState({
    brandId: '',
    brandName: '',
    productName: '',
    productCategory: 'Fashion & Styling',
    productLink: '',
    productMrp: 0,
    collabType: 'Barter' as 'Barter' | 'Paid' | 'Both',
    budgetPerCreator: 0,
    deliverables: '1 Dedicated Reel + 1 Story',
    collabDescription: '',
    creatorRequirements: '',
    targetFollowerTier: 'Any',
    creatorsNeeded: 10,
    refVideoLink: '',
    specialGuidelines: '',
    targetTimeline: '',
    submittedByName: '',
    submittedByTeam: 'Ad Buyers',
    submittedByEmail: '',
    submittedByPhone: ''
  });

  // Brand dropdown in add/edit modal
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<BrandRequirement | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await api.get('/brands?all=true&limit=500');
      const list = res.data || res.brands || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) setBrands(list);
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  };

  const fetchRequirements = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (collabFilter !== 'All') params.append('collabType', collabFilter);
      if (teamFilter !== 'All') params.append('submittedByTeam', teamFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/brand-requirements?${params.toString()}`);
      if (res.success) {
        setRequirements(res.items || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.totalCount || 0);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load brand requirements:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchRequirements();
  }, [page, statusFilter, collabFilter, teamFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchRequirements();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleCopyBriefFormLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/brand-requirement`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenDetails = async (item: BrandRequirement) => {
    setSelectedReq(item);
    setAllottedCreators([]);
    setShowDetailsModal(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/brand-requirements/${item._id}`);
      if (res.success) {
        if (res.item) setSelectedReq({ ...item, ...res.item });
        setAllottedCreators(res.allottedCreators || []);
      }
    } catch (err) {
      console.error('Failed to load requirement details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingReq(null);
    const firstBrand = brands[0];
    setIsCustomBrand(false);
    setCustomBrandName('');
    setFormState({
      brandId: (firstBrand as any)?._id || '',
      brandName: firstBrand?.brandName || '',
      productName: '',
      productCategory: 'Fashion & Styling',
      productLink: '',
      productMrp: 0,
      collabType: 'Barter',
      budgetPerCreator: 0,
      deliverables: '1 Dedicated Reel + 1 Story',
      collabDescription: '',
      creatorRequirements: '',
      targetFollowerTier: 'Any',
      creatorsNeeded: 1,
      refVideoLink: '',
      specialGuidelines: '',
      targetTimeline: '',
      submittedByName: '',
      submittedByTeam: 'Ad Buyers',
      submittedByEmail: '',
      submittedByPhone: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item: BrandRequirement) => {
    setEditingReq(item);
    const matchedBrand = brands.find(b => b.brandName.toLowerCase() === item.brandName.toLowerCase());
    setIsCustomBrand(!matchedBrand);
    setCustomBrandName(!matchedBrand ? item.brandName : '');
    setFormState({
      brandId: item.brandId || (matchedBrand as any)?._id || '',
      brandName: item.brandName,
      productName: item.productName || '',
      productCategory: item.productCategory || 'Fashion & Styling',
      productLink: item.productLink || '',
      productMrp: item.productMrp || 0,
      collabType: item.collabType || 'Barter',
      budgetPerCreator: item.budgetPerCreator || 0,
      deliverables: item.deliverables || '1 Dedicated Reel + 1 Story',
      collabDescription: item.collabDescription || '',
      creatorRequirements: item.creatorRequirements || '',
      targetFollowerTier: item.targetFollowerTier || 'Any',
      creatorsNeeded: item.creatorsNeeded || 1,
      refVideoLink: item.refVideoLink || '',
      specialGuidelines: item.specialGuidelines || '',
      targetTimeline: item.targetTimeline || '',
      submittedByName: item.submittedByName || '',
      submittedByTeam: item.submittedByTeam || 'Ad Buyers',
      submittedByEmail: item.submittedByEmail || '',
      submittedByPhone: item.submittedByPhone || ''
    });
    setShowFormModal(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBrandName = isCustomBrand ? customBrandName.trim() : formState.brandName.trim();
    if (!finalBrandName) {
      alert('Please select or enter a brand name.');
      return;
    }

    setSavingForm(true);
    try {
      const payload = {
        ...formState,
        brandId: isCustomBrand ? '' : formState.brandId,
        brandName: finalBrandName
      };

      const res = editingReq
        ? await api.put(`/brand-requirements/${editingReq._id}`, payload)
        : await api.post('/brand-requirements', payload);

      if (res.success) {
        setShowFormModal(false);
        fetchRequirements();
      } else {
        alert(res.message || 'Failed to save product brief.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving product brief.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleStatusChange = async (item: BrandRequirement, newStatus: string) => {
    try {
      const res = await api.patch(`/brand-requirements/${item._id}/status`, { status: newStatus });
      if (res.success) {
        fetchRequirements();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/brand-requirements/${deleteTarget._id}`);
      if (res.success) {
        setDeleteTarget(null);
        fetchRequirements();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete product brief.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredBrands = brands.filter(b => {
    if (!brandSearch.trim()) return true;
    const q = brandSearch.trim().toLowerCase();
    return b.brandName.toLowerCase().includes(q) || (b.industry || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Top Action Banner */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/50 border border-indigo-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                Ad Buyers &amp; Marketing Team Brief Form
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                Live &bull; Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Share this form with Ad Buyers &amp; Marketing Team to submit Brand, Product, Collab Description &amp; Creator Requirements for product-wise allotment.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyBriefFormLink}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
              copiedLink
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {copiedLink ? <><Check size={14} /> Link Copied!</> : <><Copy size={14} /> Copy Brief Form Link</>}
          </button>

          <a
            href={`${window.location.origin}${window.location.pathname}#/brand-requirement`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center gap-1.5 transition shadow-2xs"
          >
            <ExternalLink size={14} />
            <span>Preview Form</span>
          </a>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Add Product Brief</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Product Briefs</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Ad Buyers &amp; Marketing</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText size={17} />
            </div>
          </div>

          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">Open Briefs</span>
              <span className="text-xl font-black text-amber-600 mt-0.5 block">{stats.open}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Ready for Allotment</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={17} />
            </div>
          </div>

          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider block">In Progress</span>
              <span className="text-xl font-black text-purple-600 mt-0.5 block">{stats.inProgress}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Creators Being Allotted</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Package size={17} />
            </div>
          </div>

          <div className="p-3.5 sm:px-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block">Fulfilled</span>
              <span className="text-xl font-black text-emerald-600 mt-0.5 block">{stats.fulfilled}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{stats.barter} Barter &bull; {stats.paid} Paid &bull; {stats.both} Both</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={17} />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search brand, product, code (REQ-...), submitter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Fulfilled">Fulfilled</option>
              <option value="Paused">Paused</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={collabFilter}
              onChange={e => { setCollabFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold"
            >
              <option value="All">All Collab Types</option>
              <option value="Barter">Barter</option>
              <option value="Paid">Paid</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={teamFilter}
              onChange={e => { setTeamFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-bold"
            >
              <option value="All">All Teams</option>
              {TEAM_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={() => fetchRequirements(true)}
              disabled={isRefreshing}
              className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition cursor-pointer"
              title="Refresh briefs"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Briefs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Brand &amp; Code</th>
                <th className="py-3.5 px-4">Product &amp; Category</th>
                <th className="py-3.5 px-4">Collab &amp; Deliverables</th>
                <th className="py-3.5 px-4">Submitted By</th>
                <th className="py-3.5 px-4">Allotment Progress &amp; Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading product briefs...
                  </td>
                </tr>
              ) : requirements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <Briefcase size={36} className="mx-auto text-slate-300 mb-2" />
                    <div className="text-slate-600 font-bold text-sm">No brand product briefs yet</div>
                    <p className="text-slate-400 text-xs mt-1">
                      Copy the brief form link above for Ad Buyers &amp; Marketing Team, or click &ldquo;Add Product Brief&rdquo;.
                    </p>
                  </td>
                </tr>
              ) : (
                requirements.map(item => {
                  const allottedCount = item.allottedCount || 0;
                  const needed = item.creatorsNeeded || 1;
                  const pct = Math.min(100, Math.round((allottedCount / needed) * 100));

                  return (
                    <tr key={item._id} className="hover:bg-indigo-50/25 transition">
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px] font-black tracking-wider mb-1">
                          {item.requirementCode}
                        </span>
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-600 shrink-0" />
                          <span>{item.brandName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Added {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[230px]">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <Package size={13} className="text-purple-600 shrink-0" />
                          <span className="truncate" title={item.productName || item.productCategory}>
                            {item.productName || item.productCategory}
                          </span>
                        </div>
                        {item.productName && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{item.productCategory}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {item.productLink && (
                            <a
                              href={item.productLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              <Link2 size={10} /> Product Link
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.collabType === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.collabType === 'Barter'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {item.collabType}
                          </span>
                          {item.budgetPerCreator ? (
                            <span className="text-xs font-black text-slate-800">
                              ₹{item.budgetPerCreator.toLocaleString('en-IN')}<span className="text-[10px] font-normal text-slate-400">/creator</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 mt-1 truncate" title={item.deliverables}>
                          {item.deliverables}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5" title={item.collabDescription}>
                          {item.collabDescription}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-xs">{item.submittedByName}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {item.submittedByTeam}
                        </span>
                        {item.targetTimeline && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-1">{item.targetTimeline}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[90px]">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-black text-slate-700">
                            {allottedCount}/{needed}
                          </span>
                          {Boolean(item.acceptedCount) && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {item.acceptedCount} accepted
                            </span>
                          )}
                        </div>
                        <select
                          value={item.status}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border cursor-pointer focus:outline-none ${
                            item.status === 'Open'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : item.status === 'In Progress'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : item.status === 'Fulfilled'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Fulfilled">Fulfilled</option>
                          <option value="Paused">Paused</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onAllotForRequirement && item.status !== 'Closed' && (
                            <button
                              type="button"
                              onClick={() => onAllotForRequirement(item)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition"
                              title="Go to Applications & Allot Creators for this product"
                            >
                              <span>Allot Creators</span>
                              <ArrowRight size={12} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item)}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 cursor-pointer"
                            title="View Brief & Allotted Creators"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 cursor-pointer"
                            title="Edit Product Brief"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 cursor-pointer"
                            title="Delete Brief"
                          >
                            <Trash2 size={14} />
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

      {/* Details Modal */}
      {showDetailsModal && selectedReq && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`${selectedReq.requirementCode}: ${selectedReq.brandName} — ${selectedReq.productName || selectedReq.productCategory}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-700">
            <div className="p-4 bg-gradient-to-r from-indigo-50 via-blue-50/50 to-purple-50/40 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">{selectedReq.requirementCode}</span>
                  <h4 className="text-base font-black text-slate-900">{selectedReq.brandName}</h4>
                  <span className="text-slate-400">&bull;</span>
                  <span className="font-bold text-indigo-800">{selectedReq.productName || selectedReq.productCategory}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Submitted by <strong>{selectedReq.submittedByName}</strong> ({selectedReq.submittedByTeam})
                  {selectedReq.targetTimeline ? ` • Timeline: ${selectedReq.targetTimeline}` : ''}
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-800 text-[11px] font-black uppercase self-start">
                {selectedReq.collabType} • {selectedReq.allottedCount || 0}/{selectedReq.creatorsNeeded} Allotted
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Deliverables</span>
                <span className="font-bold text-slate-900 block mt-0.5">{selectedReq.deliverables}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Target Tier &amp; Budget</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {selectedReq.targetFollowerTier || 'Any'}
                  {selectedReq.budgetPerCreator ? ` • ₹${selectedReq.budgetPerCreator.toLocaleString('en-IN')}/creator` : ''}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">Collaboration Description</div>
              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{selectedReq.collabDescription}</p>
            </div>

            {selectedReq.creatorRequirements && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">Creator Requirements</div>
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{selectedReq.creatorRequirements}</p>
              </div>
            )}

            {(selectedReq.specialGuidelines || selectedReq.productLink || selectedReq.refVideoLink) && (
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-2 text-xs">
                {selectedReq.specialGuidelines && (
                  <div>
                    <span className="font-extrabold text-amber-900 uppercase text-[10px] block">Special Guidelines</span>
                    <p className="text-slate-800 mt-0.5">{selectedReq.specialGuidelines}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 pt-1">
                  {selectedReq.productLink && (
                    <a href={selectedReq.productLink} target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-bold hover:underline inline-flex items-center gap-1">
                      <Link2 size={13} /> Open Product Link
                    </a>
                  )}
                  {selectedReq.refVideoLink && (
                    <a href={selectedReq.refVideoLink} target="_blank" rel="noopener noreferrer" className="text-purple-700 font-bold hover:underline inline-flex items-center gap-1">
                      <Video size={13} /> Open Reference Video
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Allotted Creators for this Product */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Allotted Creators for {selectedReq.productName || selectedReq.productCategory}</span>
                <span className="text-indigo-700">{allottedCreators.length} Creator(s)</span>
              </div>
              {loadingDetails ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  <Loader2 size={16} className="animate-spin inline mr-1.5" /> Loading allotted creators...
                </div>
              ) : allottedCreators.length === 0 ? (
                <div className="py-3 text-xs text-slate-400">No creators have been allotted to this product yet.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allottedCreators.map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{c.fullName}</span>
                        <span className="text-pink-600 font-semibold ml-2">{c.instagramHandle}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        c.status === 'Opportunity Accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'Opportunity Declined'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {onAllotForRequirement && selectedReq.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    onAllotForRequirement(selectedReq);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Allot Creators for This Product</span>
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Modal */}
      {showFormModal && (
        <Modal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingReq ? `Edit Product Brief (${editingReq.requirementCode})` : 'Add Brand Product Brief'}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Brand */}
              <div ref={brandDropdownRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand *</label>
                <button
                  type="button"
                  onClick={() => setShowBrandDropdown(p => !p)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-bold flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">
                    {isCustomBrand ? (customBrandName || '+ Custom Brand') : (formState.brandName || 'Select Brand...')}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {showBrandDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5">
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search brand..."
                      className="w-full px-2.5 py-1.5 mb-1 border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-0.5">
                      {filteredBrands.map(b => (
                        <button
                          type="button"
                          key={b._id}
                          onClick={() => {
                            setIsCustomBrand(false);
                            setFormState(prev => ({ ...prev, brandId: b._id, brandName: b.brandName }));
                            setShowBrandDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 text-xs font-semibold"
                        >
                          {b.brandName}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomBrand(true);
                          setShowBrandDropdown(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-indigo-700 font-bold text-xs hover:bg-indigo-50 border-t border-slate-100 mt-1"
                      >
                        + Other / Custom Brand
                      </button>
                    </div>
                  </div>
                )}
                {isCustomBrand && (
                  <input
                    type="text"
                    value={customBrandName}
                    onChange={e => setCustomBrandName(e.target.value)}
                    placeholder="Custom brand name..."
                    className="mt-1.5 w-full px-3 py-2 border border-indigo-300 rounded-xl text-xs font-semibold"
                  />
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Category</label>
                <select
                  value={formState.productCategory}
                  onChange={e => setFormState(p => ({ ...p, productCategory: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Collab Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Collab Mode *</label>
                <select
                  value={formState.collabType}
                  onChange={e => setFormState(p => ({ ...p, collabType: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="Barter">Barter</option>
                  <option value="Paid">Paid</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deliverables (optional)</label>
                <input
                  type="text"
                  value={formState.deliverables}
                  onChange={e => setFormState(p => ({ ...p, deliverables: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              {/* Creators Needed & Budget */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Creators Needed</label>
                  <input
                    type="number"
                    min={1}
                    value={formState.creatorsNeeded}
                    onChange={e => setFormState(p => ({ ...p, creatorsNeeded: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Budget/Creator (₹)</label>
                  <input
                    type="number"
                    value={formState.budgetPerCreator}
                    onChange={e => setFormState(p => ({ ...p, budgetPerCreator: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Submitter Name & Team */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Submitted By (Ad Buyer / Marketing) *</label>
                <input
                  type="text"
                  required
                  value={formState.submittedByName}
                  onChange={e => setFormState(p => ({ ...p, submittedByName: e.target.value }))}
                  placeholder="Name of requester"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Team</label>
                <select
                  value={formState.submittedByTeam}
                  onChange={e => setFormState(p => ({ ...p, submittedByTeam: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  {TEAM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Link (optional)</label>
              <input
                type="url"
                value={formState.productLink}
                onChange={e => setFormState(p => ({ ...p, productLink: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description for Collab *</label>
              <textarea
                rows={3}
                required
                value={formState.collabDescription}
                onChange={e => setFormState(p => ({ ...p, collabDescription: e.target.value }))}
                placeholder="Concept, hooks, USPs, talking points..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Creator Requirements (optional)</label>
              <textarea
                rows={2}
                value={formState.creatorRequirements}
                onChange={e => setFormState(p => ({ ...p, creatorRequirements: e.target.value }))}
                placeholder="Follower tier, location, niche, language..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Follower Tier</label>
                <select
                  value={formState.targetFollowerTier}
                  onChange={e => setFormState(p => ({ ...p, targetFollowerTier: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  {FOLLOWER_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Timeline</label>
                <input
                  type="date"
                  value={formState.targetTimeline}
                  onChange={e => setFormState(p => ({ ...p, targetTimeline: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingForm}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {savingForm ? 'Saving...' : (editingReq ? 'Update Brief' : 'Save Brief')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Brand Product Brief"
        itemType="product brief"
        itemName={deleteTarget ? `${deleteTarget.brandName} — ${deleteTarget.productName || deleteTarget.productCategory} (${deleteTarget.requirementCode})` : ''}
        loading={deleting}
      />
    </div>
  );
};

