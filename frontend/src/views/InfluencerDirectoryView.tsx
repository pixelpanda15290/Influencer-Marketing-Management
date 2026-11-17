import React, { useEffect, useState, useMemo } from 'react';
import {
  Users, Search, Filter, Plus, ExternalLink, Instagram, Phone, Mail,
  Star, Award, TrendingUp, Sparkles, CheckCircle2, Bookmark, Check, X,
  Trash2, Edit2, ShieldCheck, MapPin, MessageSquare, Layers, Eye, RefreshCw, Briefcase,
  Heart, MessageCircle, BarChart2, Globe, SlidersHorizontal, UserCheck, AlertCircle, Grid, Table as TableIcon,
  UserPlus
} from 'lucide-react';
import { api } from '../services/api';
import { InfluencerDirectoryItem } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { InfluencerApplicationsView } from './InfluencerApplicationsView';

interface InfluencerDirectoryViewProps {
  userRole?: string;
  currentUser?: any;
  initialTab?: 'directory' | 'applications';
}

const CATEGORIES = [
  { id: 'All', label: 'All Categories', icon: '🌟' },
  { id: 'Fashion', label: 'Fashion & Styling', icon: '👗' },
  { id: 'Beauty', label: 'Beauty & Skincare', icon: '💄' },
  { id: 'Tech', label: 'Tech & Gadgets', icon: '📱' },
  { id: 'Fitness', label: 'Fitness & Health', icon: '🏋️' },
  { id: 'Food', label: 'Food & Dining', icon: '🍕' },
  { id: 'Travel', label: 'Travel & Lifestyle', icon: '✈️' },
  { id: 'Gaming', label: 'Gaming & Esports', icon: '🎮' },
  { id: 'Entertainment', label: 'Entertainment & Comedy', icon: '🎬' }
];

export const InfluencerDirectoryView: React.FC<InfluencerDirectoryViewProps> = ({ userRole, currentUser, initialTab = 'directory' }) => {
  // Navigation Tabs: Directory vs Application & Allocation
  const [activeTab, setActiveTab] = useState<'directory' | 'applications'>(initialTab);

  // Inbound Applications Stats for Header Metric Card
  const [pendingAppsCount, setPendingAppsCount] = useState<number>(0);
  const [totalAppsCount, setTotalAppsCount] = useState<number>(0);

  const fetchAppStats = async () => {
    try {
      const res = await api.get('/influencer-applications?limit=1');
      if (res.success && res.stats) {
        setPendingAppsCount(res.stats.pending || 0);
        setTotalAppsCount(res.stats.total || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAppStats();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  // Database Directory State & Pagination
  const [directoryItems, setDirectoryItems] = useState<InfluencerDirectoryItem[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [followerTier, setFollowerTier] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(12);

  // Metrics & Stats
  const [metrics, setMetrics] = useState({
    totalCreators: 0,
    categoriesCount: CATEGORIES.filter(c => c.id !== 'All').length,
    avgEngagement: 4.8
  });

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InfluencerDirectoryItem | null>(null);
  const [formData, setFormData] = useState<Partial<InfluencerDirectoryItem>>({
    instagramHandle: '',
    name: '',
    avatar: '',
    category: 'Fashion',
    followersCount: undefined,
    engagementRate: undefined,
    phone: '',
    email: '',
    location: '',
    profileLink: '',
    status: 0,
    rating: 5,
    notes: '',
    bio: ''
  });

  // Success / Error Banner State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Saved Database Directory (Fast & Paginated)
  const fetchDirectory = async (page: number = currentPage, forceSync: boolean = false, query: string = searchQuery) => {
    setLoadingDirectory(true);
    try {
      let url = `/influencer-directory?page=${page}&limit=${pageSize}&category=${encodeURIComponent(selectedCategory)}&status=${encodeURIComponent(selectedStatus)}`;
      if (query && query.trim()) url += `&search=${encodeURIComponent(query.trim())}`;
      if (forceSync) url += `&forceSync=true`;

      if (followerTier === 'micro') {
        url += `&minFollowers=10000&maxFollowers=50000`;
      } else if (followerTier === 'mid') {
        url += `&minFollowers=50000&maxFollowers=500000`;
      } else if (followerTier === 'macro') {
        url += `&minFollowers=500000`;
      }

      const res = await api.get(url);
      if (res.success) {
        setDirectoryItems(res.items || []);
        if (res.stats) {
          setMetrics(res.stats);
        }
        if (res.pagination) {
          setTotalItems(res.pagination.total || (res.items || []).length);
          setTotalPages(res.pagination.totalPages || 1);
          setCurrentPage(res.pagination.page || page);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch directory:', err);
    } finally {
      setLoadingDirectory(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchDirectory(1, false, searchQuery);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedCategory, selectedStatus, followerTier]);

  // Save / Update Form Submission for Saved Directory Modal
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem && editingItem._id) {
        const res = await api.put(`/influencer-directory/${editingItem._id}`, formData);
        if (res.success) {
          showToast(`Influencer ${formData.name} updated successfully!`);
          setIsModalOpen(false);
          fetchDirectory();
        }
      } else {
        const res = await api.post('/influencer-directory', formData);
        if (res.success) {
          showToast(`Influencer ${formData.name} saved to directory!`);
          setIsModalOpen(false);
          setCurrentPage(1);
          fetchDirectory(1);
        }
      }
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to save influencer'}`);
    }
  };

  // Delete Confirmation Panel State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title?: string;
    itemType?: string;
    itemName?: string;
    warningMessage?: string;
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: 'Confirm Remove Influencer',
    loading: false,
    onConfirm: async () => {}
  });

  const requestDeleteItem = (item: InfluencerDirectoryItem) => {
    setDeleteModalState({
      isOpen: true,
      itemName: `${item.name} (${item.instagramHandle})`,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/influencer-directory/${item._id}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            showToast(`Removed ${item.name} from directory.`);
            fetchDirectory();
          }
        } catch (err: any) {
          showToast(`Error deleting: ${err.message}`);
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Multi-Select & Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllFiltered, setSelectAllFiltered] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);

  const allPageIds = useMemo(() => {
    return directoryItems.map(d => d._id).filter(Boolean) as string[];
  }, [directoryItems]);

  const isAllPageSelected = useMemo(() => {
    if (allPageIds.length === 0) return false;
    return allPageIds.every(id => selectedIds.includes(id));
  }, [allPageIds, selectedIds]);

  const isSomePageSelected = useMemo(() => {
    if (allPageIds.length === 0) return false;
    return allPageIds.some(id => selectedIds.includes(id)) && !isAllPageSelected;
  }, [allPageIds, selectedIds, isAllPageSelected]);

  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allPageIds])));
    } else {
      setSelectedIds(prev => prev.filter(id => !allPageIds.includes(id)));
      setSelectAllFiltered(false);
    }
  };

  const handleToggleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        setSelectAllFiltered(false);
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setSelectAllFiltered(false);
  };

  const handleSelectAllMatching = () => {
    setSelectAllFiltered(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await api.post('/influencer-directory/bulk-delete', { ids: selectedIds });
      if (res.success) {
        showToast(`Successfully deleted ${res.deletedCount || selectedIds.length} creator(s) from directory.`);
        setSelectedIds([]);
        setSelectAllFiltered(false);
        setShowBulkDeleteModal(false);
        fetchDirectory();
      } else {
        showToast(`Error: ${res.message || 'Failed to delete'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Failed to delete selected creators'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Single Influencer Instagram Sync Handler
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncSingleInfluencer = async (id: string, handle: string) => {
    try {
      setSyncingId(id);
      showToast(`🔄 Syncing live Instagram data for ${handle}...`);
      const res = await api.post(`/influencer-directory/sync/${id}`, {});
      if (res.success) {
        showToast(`✅ Synced live Instagram profile data for ${handle}!`);
        fetchDirectory();
      }
    } catch (err: any) {
      showToast(`Error syncing ${handle}: ${err.message || 'Sync failed'}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Brand Collabs History Modal State
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [selectedBrandHistory, setSelectedBrandHistory] = useState<any>(null);
  const [loadingBrandHistory, setLoadingBrandHistory] = useState(false);

  const openBrandHistoryModal = async (item: InfluencerDirectoryItem) => {
    try {
      setIsBrandModalOpen(true);
      setLoadingBrandHistory(true);
      setSelectedBrandHistory(null);
      const res = await api.get(`/influencer-directory/${item._id}/brands`);
      if (res.success) {
        setSelectedBrandHistory(res);
      }
    } catch (err: any) {
      showToast(`Error fetching brand history: ${err.message || 'Failed to load'}`);
    } finally {
      setLoadingBrandHistory(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      instagramHandle: '',
      name: '',
      avatar: '',
      category: 'Fashion',
      followersCount: undefined,
      engagementRate: undefined,
      phone: '',
      email: '',
      location: '',
      profileLink: '',
      status: 0,
      rating: 5,
      notes: '',
      bio: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: InfluencerDirectoryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // Helper to ensure Instagram profile URLs are clean and open directly without login redirects
  const getCleanInstagramUrl = (handle?: string, link?: string) => {
    let clean = (handle || '').replace(/^@/, '').replace(/\s+/g, '').replace(/%20/g, '').trim();
    if (!clean && link) {
      const parts = link.split('?')[0].split('/').filter(Boolean);
      clean = parts.pop() || '';
    }
    clean = clean.split('?')[0].trim();
    return `https://www.instagram.com/${clean}/`;
  };

  // Helper to get unique diverse avatar for creators
  const DIVERSE_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'
  ];

  const getCreatorAvatar = (avatarUrl?: string, handle?: string, name?: string) => {
    // 1. Use real avatar URL if stored in DB (including Instagram scontent links)
    if (avatarUrl && avatarUrl.trim() && avatarUrl.startsWith('http') && !avatarUrl.includes('ui-avatars')) {
      return avatarUrl.trim();
    }
    // 2. Live unavatar Instagram profile picture proxy
    const cleanHandle = (handle || '').replace(/^@/, '').replace(/\s+/g, '').trim();
    if (cleanHandle) {
      return `https://unavatar.io/instagram/${cleanHandle}`;
    }
    // 3. Fallback: ui-avatars initials avatar
    const label = name || cleanHandle || 'Creator';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=7c3aed&color=fff&size=200&bold=true`;
  };

  // Helper to ensure creator name is never a raw URL string
  const getCleanCreatorName = (name: string, handle?: string) => {
    if (!name || name.startsWith('http') || name.toLowerCase().includes('instagram.com') || name.toLowerCase().includes('reel')) {
      const raw = handle ? handle.replace(/^@/, '') : (name ? name.split('?')[0].split('/').filter(Boolean).pop() : 'Creator');
      const clean = (raw || 'Creator').replace(/[\-_.]/g, ' ').replace(/\s+/g, ' ').trim();
      return clean ? (clean.charAt(0).toUpperCase() + clean.slice(1)) : 'Creator';
    }
    return name;
  };

  const isItemActive = (status?: string | number) => {
    if (status === undefined || status === null) return true;
    if (status === 0 || status === '0') return true;
    if (status === 1 || status === '1') return false;
    const s = String(status).toLowerCase().trim();
    return s === 'active' || s === 'available' || s === 'preferred' || s === 'contacted' || s === 'in discussion';
  };

  const handleToggleStatus = async (item: InfluencerDirectoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyActive = isItemActive(item.status);
    const newStatus = currentlyActive ? 1 : 0; // 0 for active, 1 for inactive

    // Optimistically update
    setDirectoryItems(prev => prev.map(d => (d._id === item._id ? { ...d, status: newStatus } : d)));

    try {
      const res = await api.put(`/influencer-directory/${item._id}`, { status: newStatus });
      if (res.success) {
        showToast(`Influencer status updated to ${newStatus === 0 ? 'Active (0)' : 'Inactive (1)'}`);
      } else {
        setDirectoryItems(prev => prev.map(d => (d._id === item._id ? { ...d, status: item.status } : d)));
        showToast(`⚠️ Could not update status`);
      }
    } catch (err: any) {
      setDirectoryItems(prev => prev.map(d => (d._id === item._id ? { ...d, status: item.status } : d)));
      showToast(`⚠️ Error: ${err.message || 'Status update failed'}`);
    }
  };

  const columns: DataTableColumn<InfluencerDirectoryItem>[] = [
    {
      key: 'select',
      label: (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isAllPageSelected}
            ref={(el) => {
              if (el) el.indeterminate = isSomePageSelected;
            }}
            onChange={(e) => handleSelectAllOnPage(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition accent-purple-600"
            title={isAllPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
          />
        </div>
      ),
      align: 'center',
      width: '46px',
      render: (_, row) => (
        <div className="flex items-center justify-center py-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.includes(row._id || '')}
            onChange={() => handleToggleSelectRow(row._id || '')}
            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition accent-purple-600"
          />
        </div>
      )
    },
    {
      key: 'sno',
      label: 'S.NO',
      align: 'center',
      width: '60px',
      render: (_, __, index) => (
        <span className="font-bold text-slate-500 text-xs">
          {(currentPage - 1) * pageSize + index + 1}
        </span>
      )
    },
    {
      key: 'name',
      label: 'CREATOR',
      sortable: true,
      render: (_, row) => (
        <div
          className="cursor-pointer group py-1"
          onClick={() => openBrandHistoryModal(row)}
        >
          <div className="font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors flex items-center gap-1.5 text-xs sm:text-sm">
            <span>{getCleanCreatorName(row.name, row.instagramHandle)}</span>
            {row.nicheTags && row.nicheTags.length > 0 && (
              <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 border border-purple-200/60 px-1.5 py-0.2 rounded">
                #{row.nicheTags[0]}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'category',
      label: 'CATEGORY',
      sortable: true,
      render: (_, row) => (
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
          {row.category || 'General'}
        </span>
      )
    },
    {
      key: 'followersCount',
      label: 'FOLLOWERS',
      sortable: true,
      render: (_, row) => (
        <span className="font-extrabold text-slate-900 text-xs">
          {formatNumber(row.followersCount || 0)}
        </span>
      )
    },
    {
      key: 'engagementRate',
      label: 'ENGAGEMENT',
      sortable: true,
      render: (_, row) => (
        <span className="font-black text-emerald-600 text-xs">
          {(row.engagementRate || 0) > 0 ? `${row.engagementRate}%` : '—'}
        </span>
      )
    },
    {
      key: 'pastCollabsCount',
      label: 'PAST COLLABS',
      align: 'center',
      sortable: true,
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openBrandHistoryModal(row);
          }}
          className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
          title="View all brand collaboration records"
        >
          <Briefcase size={12} />
          <span>{row.pastCollabsCount || 0}</span>
        </button>
      )
    },
    {
      key: 'status',
      label: 'STATUS',
      align: 'center',
      sortable: true,
      render: (_, row) => {
        const active = isItemActive(row.status);
        return (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => handleToggleStatus(row, e)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                active ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
              title={active ? 'Active (0) - Click to mark Inactive (1)' : 'Inactive (1) - Click to mark Active (0)'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        );
      }
    },
    {
      key: 'contact',
      label: 'CONTACT',
      render: (_, row) => (
        <div className="flex flex-col gap-1 py-1 text-xs" onClick={(e) => e.stopPropagation()}>
          {/* Phone */}
          <div className="flex items-center gap-1.5 text-slate-700">
            <Phone size={12} className="text-emerald-600 shrink-0" />
            {row.phone ? (
              <a
                href={`https://wa.me/${row.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-800 hover:text-emerald-600 hover:underline"
              >
                {row.phone}
              </a>
            ) : (
              <span className="text-slate-400 text-[11px]">—</span>
            )}
          </div>

          {/* Instagram */}
          <div className="flex items-center gap-1.5 text-slate-700">
            <Instagram size={12} className="text-pink-600 shrink-0" />
            {row.instagramHandle ? (
              <a
                href={getCleanInstagramUrl(row.instagramHandle, row.profileLink)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-purple-700 hover:underline"
              >
                @{row.instagramHandle.replace(/^@/, '')}
              </a>
            ) : (
              <span className="text-slate-400 text-[11px]">—</span>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center gap-1.5 text-slate-700">
            <Mail size={12} className="text-blue-600 shrink-0" />
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                className="font-semibold text-slate-800 hover:text-blue-600 hover:underline truncate max-w-[180px]"
                title={row.email}
              >
                {row.email}
              </a>
            ) : (
              <span className="text-slate-400 text-[11px]">—</span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg cursor-pointer transition"
            title="Edit Influencer"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => requestDeleteItem(row)}
            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition"
            title="Delete from Directory"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 border border-purple-500/30">
          <Sparkles className="text-amber-400 shrink-0" size={18} />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Header Banner (Sleek, Compact & Proportional) */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-50/60 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-700 text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <Sparkles size={12} className="text-purple-600" /> Influencer Operations Hub
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {activeTab === 'directory' ? 'Influencer Directory' : 'Influencer Application and Allocation'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 max-w-xl font-medium">
              {activeTab === 'directory'
                ? 'Access and manage your verified creator database from past Barter & Paid collaborations.'
                : 'Review inbound creators from the WhatsApp onboarding form, allot matching brands, and trigger alerts.'}
            </p>
          </div>

          {/* Unified Mode Switcher Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shrink-0 self-start md:self-center shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} className={activeTab === 'directory' ? 'text-purple-600' : 'text-slate-400'} />
              <span>Influencer Directory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('applications');
                fetchAppStats();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'applications'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus size={14} className={activeTab === 'applications' ? 'text-purple-600' : 'text-slate-400'} />
              <span>Application and Allocation</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Switcher based on Active Tab ────────────────────────── */}
      {activeTab === 'applications' ? (
        <InfluencerApplicationsView isEmbedded={true} />
      ) : (
        <>

      {/* Directory Content Area */}
      <div className="space-y-4">
        {/* Sleek Directory Metrics Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="p-3.5 sm:px-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Database Creators</span>
                <span className="text-xl font-black text-purple-700 mt-0.5 block">{totalItems}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Verified roster profiles</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Users size={17} />
              </div>
            </div>

            <div className="p-3.5 sm:px-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Content Categories</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">{metrics.categoriesCount || CATEGORIES.filter(c => c.id !== 'All').length}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Fashion, Tech, Beauty &amp; more</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Layers size={17} />
              </div>
            </div>

            <div className="p-3.5 sm:px-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg Engagement Rate</span>
                <span className="text-xl font-black text-emerald-600 mt-0.5 block">{metrics.avgEngagement || 4.8}%</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Across recorded collaborations</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp size={17} />
              </div>
            </div>
          </div>
        </div>
        {/* Directory Toolbar / Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, @handle, phone, email, bio..."
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer transition"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer hover:border-purple-300"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>

            {/* Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer hover:border-purple-300"
            >
              <option value="All">All Statuses</option>
              <option value="0">Active (0)</option>
              <option value="1">Inactive (1)</option>
            </select>

            {/* Follower Tier */}
            <select
              value={followerTier}
              onChange={(e) => setFollowerTier(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer hover:border-purple-300"
            >
              <option value="All">All Follower Counts</option>
              <option value="micro">Micro (10K - 50K)</option>
              <option value="mid">Mid-Tier (50K - 500K)</option>
              <option value="macro">Macro (500K+)</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => fetchDirectory(1, true)}
              disabled={loadingDirectory}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Directory"
            >
              <RefreshCw size={14} className={loadingDirectory ? 'animate-spin text-purple-600' : ''} />
              <span>Refresh</span>
            </button>

            {/* Add New Influencer Button */}
            <button
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} /> Add Influencer
            </button>
          </div>
        </div>

        {/* Light Themed Bulk Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-4 z-30 mb-2 bg-purple-50/95 backdrop-blur-md border border-purple-200/90 rounded-2xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-fade-in transition-all">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-600 text-white font-black text-xs shadow-2xs">
                <CheckCircle2 size={14} />
                <span>{selectAllFiltered ? totalItems : selectedIds.length} Selected</span>
              </div>

              {totalItems > directoryItems.length && !selectAllFiltered && (
                <button
                  type="button"
                  onClick={handleSelectAllMatching}
                  className="text-xs font-extrabold text-purple-700 hover:text-purple-900 underline hover:no-underline cursor-pointer transition"
                >
                  Select all {totalItems} creators
                </button>
              )}

              {selectAllFiltered && (
                <span className="text-xs font-bold text-purple-700">
                  All {totalItems} creators across all pages selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition shadow-2xs"
              >
                Clear Selection
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-rose-600/20 cursor-pointer transition"
              >
                <Trash2 size={14} />
                <span>Delete Selected ({selectAllFiltered ? totalItems : selectedIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Directory Content List */}
        {loadingDirectory ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200">
            <RefreshCw className="animate-spin text-purple-600 mx-auto mb-3" size={28} />
            <p className="text-sm font-bold text-slate-600">Loading your saved influencers...</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden p-2">
            <DataTable
              columns={columns}
              data={directoryItems}
              rowKey={(row) => row._id || row.instagramHandle}
              emptyMessage="No saved influencers found matching your current filters."
              pagination={true}
              itemsPerPage={pageSize}
              currentPage={currentPage}
              totalItems={totalItems}
              totalPages={totalPages}
              onPageChange={(p) => {
                setCurrentPage(p);
                fetchDirectory(p);
              }}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingItem ? `Edit Profile: ${editingItem.name}` : 'Add New Influencer to Database'}
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instagram Handle *</label>
                <input
                  type="text"
                  required
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  placeholder="@fashion_creator"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Influencer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Komal Pandey"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Profile Photo / Avatar Image URL</label>
              <input
                type="text"
                value={formData.avatar || ''}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                placeholder="Paste direct Instagram profile picture link or custom image URL..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Leave blank to automatically load live Instagram profile picture for this handle.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category / Niche *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                {CATEGORIES.filter(c => c.id !== 'All').map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Followers Count</label>
                <input
                  type="number"
                  value={formData.followersCount ?? ''}
                  onChange={(e) => setFormData({ ...formData, followersCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Engagement Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.engagementRate ?? ''}
                  onChange={(e) => setFormData({ ...formData, engagementRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="e.g. 4.5"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@creator.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bio / Niche Overview</label>
              <textarea
                rows={2}
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Brief profile summary, fashion styling specialization..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shadow-md shadow-purple-500/20 cursor-pointer"
              >
                Save Influencer
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* Brands Worked With & Collaboration History Modal */}
      <Modal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        title="Influencer Brand Collaborations History"
        maxWidth="max-w-3xl"
      >
        {loadingBrandHistory ? (
          <div className="py-12 text-center text-slate-500 font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-purple-600" size={20} /> Loading brand collaboration history...
          </div>
        ) : selectedBrandHistory ? (
          <div className="space-y-5">
            {/* Influencer Summary Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200/80 text-slate-900 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shrink-0">
                  {getCleanCreatorName(selectedBrandHistory.influencer?.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">{getCleanCreatorName(selectedBrandHistory.influencer?.name, selectedBrandHistory.influencer?.instagramHandle)}</h3>
                  <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-purple-700">@{selectedBrandHistory.influencer?.instagramHandle?.replace(/^@/, '')}</span>
                    <span>•</span>
                    <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full text-[10px] font-bold">{selectedBrandHistory.influencer?.category || 'Fashion'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Total Collabs</div>
                  <div className="text-base font-black text-purple-700">{selectedBrandHistory.totalCollabs} Deals</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Unique Brands</div>
                  <div className="text-base font-black text-emerald-600">{selectedBrandHistory.uniqueBrandsCount} Brands</div>
                </div>
              </div>
            </div>

            {/* Brands List Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                <Briefcase size={14} className="text-purple-600" /> Brands Collaborated With ({selectedBrandHistory.uniqueBrandsCount})
              </h4>

              {selectedBrandHistory.brands && selectedBrandHistory.brands.length > 0 ? (
                selectedBrandHistory.brands.map((b: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-purple-200 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          {b.brandName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <h5 className="font-extrabold text-slate-900 text-sm">{b.brandName}</h5>
                          <div className="text-[10px] font-semibold text-slate-500">Worked on {b.totalDeals} collaboration(s)</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-black">
                        {b.totalDeals} Deals
                      </span>
                    </div>

                    {/* Specific Deals */}
                    <div className="space-y-1.5 pt-1">
                      {b.deals.map((deal: any, dIdx: number) => (
                        <div key={dIdx} className="text-xs flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${deal.category === 'Paid' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                              {deal.category || 'Barter'}
                            </span>
                            <span className="font-semibold text-slate-800">{deal.videoType || 'Single Product Video'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            {deal.viewsCount > 0 && <span>👁️ {deal.viewsCount.toLocaleString()} views</span>}
                            {deal.ordersGenerated > 0 && <span className="font-bold text-purple-700">📦 {deal.ordersGenerated} orders</span>}
                            <span className="font-medium text-slate-400">{new Date(deal.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
                  <div className="text-purple-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Briefcase size={14} /> Database Collaboration Record
                  </div>
                  <p className="text-xs text-slate-800 font-bold">
                    {selectedBrandHistory.influencer?.notes || `Recorded ${selectedBrandHistory.totalCollabs || 0} past collaboration(s) in system.`}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Individual video deliverables, views, and order receipts will be listed here as new brand deals are assigned to this creator.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* REUSABLE DELETE CONFIRMATION MODAL PANEL */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title={deleteModalState.title || 'Confirm Remove Influencer'}
        itemType={deleteModalState.itemType || 'influencer'}
        itemName={deleteModalState.itemName}
        warningMessage={deleteModalState.warningMessage}
        loading={deleteModalState.loading}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Bulk Remove Influencers"
        itemType="influencer(s)"
        itemName={`${selectAllFiltered ? totalItems : selectedIds.length} selected creator(s)`}
        warningMessage="These creator profiles will be soft-deleted and removed from the active influencer directory."
        loading={isBulkDeleting}
      />
        </>
      )}
    </div>
  );
};
