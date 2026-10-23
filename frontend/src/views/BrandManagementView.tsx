import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, Globe, Mail, Phone, ExternalLink, Search, Users, Eye, Edit2, Trash2, Loader2, ChevronDown, KeyRound, CheckCircle2, Copy, Instagram } from 'lucide-react';
import { api } from '../services/api';
import { Brand } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Pagination } from '../components/Pagination';
import { InlineLoader } from '../components/PageLoader';
import { DataTable, DataTableColumn } from '../components/DataTable';

interface BrandManagementViewProps {
  userRole?: string;
}

const INDUSTRY_OPTIONS = [
  { label: 'Fashion & Apparel', icon: '👗' },
  { label: 'Beauty & Cosmetics', icon: '💄' },
  { label: 'Skincare & Wellness', icon: '🌿' },
  { label: 'Food & Beverages', icon: '🍕' },
  { label: 'Jewelry & Accessories', icon: '💍' },
  { label: 'Home & Living', icon: '🛋️' },
  { label: 'Electronics & Tech', icon: '📱' },
  { label: 'Kids & Baby Care', icon: '👶' },
  { label: 'Travel & Hospitality', icon: '✈️' },
  { label: 'Fitness & Sports', icon: '🏋️' },
  { label: 'Education & E-Learning', icon: '🎓' },
  { label: 'Lifestyle & Luxury', icon: '🎨' },
  { label: 'Other', icon: '💡' }
];

const CustomIndustrySelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = INDUSTRY_OPTIONS.find(o => o.label === value);
  const filteredOpts = INDUSTRY_OPTIONS.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full text-left" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 hover:border-purple-400 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none font-bold text-xs flex items-center justify-between cursor-pointer transition shadow-2xs"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOpt ? (
            <>
              <span className="text-sm shrink-0">{selectedOpt.icon}</span>
              <span className="truncate text-slate-900 font-extrabold">{selectedOpt.label}</span>
            </>
          ) : value ? (
            <>
              <span className="text-sm shrink-0">🏢</span>
              <span className="truncate text-slate-900 font-extrabold">{value}</span>
            </>
          ) : (
            <span className="text-slate-400 font-medium">-- Select Industry --</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-purple-600 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="origin-top-left absolute left-0 right-0 mt-1.5 rounded-2xl bg-white shadow-2xl border border-purple-200 ring-1 ring-purple-950/5 focus:outline-none z-50 overflow-hidden p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1.5 border-b border-purple-100 bg-purple-50/50 rounded-xl">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search industry..."
              className="w-full bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {filteredOpts.length === 0 ? (
              <div className="p-3 text-center text-xs font-semibold text-slate-400">No industry found</div>
            ) : (
              filteredOpts.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    onChange(opt.label);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    value === opt.label
                      ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-800 hover:bg-purple-50 hover:text-purple-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm shrink-0">{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {value === opt.label && <CheckCircle2 size={13} className="text-white shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const BrandManagementView: React.FC<BrandManagementViewProps> = ({ userRole }) => {
  const isManagerOrAdmin = userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Marketing Manager' || userRole === 'Assistant Manager' || userRole === 'Assistant Marketing Manager' || userRole === 'Team Leader';
  const isEmployee = !isManagerOrAdmin;
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandTypeFilter, setBrandTypeFilter] = useState<'All' | 'New' | 'Running'>('All');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const itemsPerPage = 10;

  // Client Portal Credentials Modal State
  const [showClientAccessModal, setShowClientAccessModal] = useState(false);
  const [clientAccessBrand, setClientAccessBrand] = useState<Brand | null>(null);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [clientPasswordInput, setClientPasswordInput] = useState('client123');
  const [savingClientAccess, setSavingClientAccess] = useState(false);
  const [clientAccessSuccess, setClientAccessSuccess] = useState<string | null>(null);

  // Form states
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [brandType, setBrandType] = useState<'New' | 'Running'>('New');
  const [targetBarterCollabs, setTargetBarterCollabs] = useState<number>(8);
  const [targetPaidCollabs, setTargetPaidCollabs] = useState<number>(2);

  const fetchBrands = async (page: number = currentPage, query: string = searchTerm, type: string = brandTypeFilter) => {
    try {
      let url = `/brands?page=${page}&limit=${itemsPerPage}`;
      if (query && query.trim()) {
        url += `&search=${encodeURIComponent(query.trim())}`;
      }
      if (type && type !== 'All') {
        url += `&brandType=${encodeURIComponent(type)}`;
      }
      const res = await api.get(url);
      if (res.success) {
        setBrands(res.data || []);
        if (res.pagination) {
          setServerTotalPages(res.pagination.totalPages || 1);
          setServerTotalItems(res.pagination.total || 0);
          setCurrentPage(res.pagination.page || page);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchBrands(1, searchTerm, brandTypeFilter);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm, brandTypeFilter]);

  const handleBrandTypeChange = (type: 'New' | 'Running') => {
    setBrandType(type);
    if (type === 'New') {
      setTargetBarterCollabs(8);
      setTargetPaidCollabs(2);
    } else {
      setTargetBarterCollabs(7);
      setTargetPaidCollabs(3);
    }
  };

  const openAddBrandModal = () => {
    setEditingBrand(null);
    setBrandName('');
    setIndustry('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setInstagramUrl('');
    setBrandType('New');
    setTargetBarterCollabs(8);
    setTargetPaidCollabs(2);
    setShowAddModal(true);
  };

  const openEditBrandModal = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandName(brand.brandName || '');
    setIndustry(brand.industry || '');
    setContactPerson(brand.contactPerson || '');
    setEmail(brand.email || '');
    setPhone(brand.phone || '');
    setWebsite(brand.website || '');
    setInstagramUrl(brand.instagramUrl || '');
    const bType = brand.brandType || 'Running';
    setBrandType(bType);
    setTargetBarterCollabs(brand.targetBarterCollabs !== undefined ? brand.targetBarterCollabs : (bType === 'New' ? 8 : 7));
    setTargetPaidCollabs(brand.targetPaidCollabs !== undefined ? brand.targetPaidCollabs : (bType === 'New' ? 2 : 3));
    setShowAddModal(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    try {
      const payload = {
        brandName, industry, contactPerson, email, phone, website, instagramUrl,
        brandType,
        targetBarterCollabs: Number(targetBarterCollabs),
        targetPaidCollabs: Number(targetPaidCollabs)
      };

      let res;
      if (editingBrand) {
        res = await api.put(`/brands/${editingBrand._id}`, payload);
      } else {
        res = await api.post('/brands', payload);
      }

      if (res.success) {
        setShowAddModal(false);
        fetchBrands();
        setBrandName(''); setIndustry(''); setContactPerson(''); setEmail(''); setPhone(''); setWebsite(''); setInstagramUrl('');
        setEditingBrand(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save brand');
    } finally {
      setSavingBrand(false);
    }
  };

  // Delete Confirmation Panel State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    itemName?: string;
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    loading: false,
    onConfirm: async () => {}
  });

  const requestDeleteBrand = (brand: Brand) => {
    setDeleteModalState({
      isOpen: true,
      itemName: brand.brandName,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/brands/${brand._id}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            fetchBrands();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete brand');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleToggleStatus = async (brand: Brand) => {
    const newStatus = brand.status === 'Active' ? 'Inactive' : 'Active';
    setBrands(prev => prev.map(b => b._id === brand._id ? { ...b, status: newStatus as any } : b));
    try {
      await api.put(`/brands/${brand._id}`, { status: newStatus });
    } catch (err: any) {
      console.error('Failed to update brand status', err);
      fetchBrands();
    }
  };

  const handleViewBrandDetails = async (id: string) => {
    try {
      const res = await api.get(`/brands/${id}`);
      if (res.success) {
        setSelectedBrand(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openClientAccessModal = (brand: Brand) => {
    setClientAccessBrand(brand);
    setClientNameInput(brand.contactPerson || brand.brandName + ' Client');
    setClientEmailInput(brand.email || '');
    setClientPasswordInput('client123');
    setClientAccessSuccess(null);
    setShowClientAccessModal(true);
  };

  const handleSaveClientAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientAccessBrand) return;
    setSavingClientAccess(true);
    setClientAccessSuccess(null);

    try {
      const res = await api.post(`/brands/${clientAccessBrand._id}/client-user`, {
        name: clientNameInput,
        email: clientEmailInput,
        password: clientPasswordInput
      });

      if (res.success) {
        setClientAccessSuccess(`Client portal login set up successfully for ${clientEmailInput}! Password: ${clientPasswordInput}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to set client credentials');
    } finally {
      setSavingClientAccess(false);
    }
  };

  const paginatedBrands = brands;

  const columns: DataTableColumn<Brand>[] = [
    {
      key: 'brandName',
      label: 'Brand',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow shrink-0">
            {row.brandName.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">{row.brandName}</div>
            <div className="text-[10px] text-purple-600 font-bold">{row.brandId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'brandType',
      label: 'Status & Collab Target',
      render: (_, row) => {
        const isNew = row.brandType === 'New';
        const barter = row.targetBarterCollabs !== undefined ? row.targetBarterCollabs : (isNew ? 8 : 7);
        const paid = row.targetPaidCollabs !== undefined ? row.targetPaidCollabs : (isNew ? 2 : 3);
        const total = barter + paid;

        return (
          <div className="space-y-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isNew ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
              {isNew ? '✨ New Brand' : '⚡ Running Brand'}
            </span>
            <div className="text-[11px] font-bold text-slate-700">
              <span className="text-purple-700">{barter}B</span> : <span className="text-indigo-700">{paid}P</span>
              <span className="text-[10px] text-slate-400 ml-1 font-semibold">({total}/mo)</span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'assignedExecutive',
      label: 'Assigned Executive',
      render: (_, row) => {
        const exec = row.assignedExecutive;
        return exec ? (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center">
              {exec.name.charAt(0)}
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-800">{exec.name}</div>
              <div className="text-[10px] text-slate-400 font-medium">{exec.email}</div>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-semibold italic">Unassigned</span>
        );
      }
    },
    { key: 'industry', label: 'Industry', sortable: true },
    { key: 'contactPerson', label: 'Contact Person', sortable: true },
    {
      key: 'email',
      label: 'Contact Details',
      render: (_, row) => (
        <div className="space-y-0.5 text-[11px]">
          <div className="flex items-center gap-1 text-slate-600">
            <Mail size={11} className="text-purple-600 shrink-0" />
            <span>{row.email}</span>
          </div>
          {!isEmployee && row.phone && (
            <div className="flex items-center gap-1 text-slate-500">
              <Phone size={11} className="text-slate-400 shrink-0" />
              <span>{row.phone}</span>
            </div>
          )}
          {row.website && (
            <a
              href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-purple-600 font-bold hover:underline cursor-pointer"
              title="Open Website"
            >
              <Globe size={11} className="text-purple-600 shrink-0" />
              <span className="truncate">{row.website}</span>
            </a>
          )}
          {row.instagramUrl && (
            <a
              href={row.instagramUrl.startsWith('http') ? row.instagramUrl : `https://instagram.com/${row.instagramUrl.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-pink-600 font-bold hover:underline cursor-pointer"
              title="Open Instagram Profile"
            >
              <Instagram size={11} className="text-pink-600 shrink-0" />
              <span className="truncate">{row.instagramUrl}</span>
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Active',
      sortable: true,
      render: (_, row) => {
        const isActive = row.status === 'Active' || !row.status;
        if (isEmployee) {
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
              isActive ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isActive ? 'bg-teal-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={isActive}
            title={isActive ? 'Active (Click to disable)' : 'Inactive (Click to enable)'}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center space-x-1 whitespace-nowrap">
          {!isEmployee && (
            <button
              onClick={() => openClientAccessModal(row)}
              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition"
              title="Manage Client Portal Access"
            >
              <KeyRound size={15} />
            </button>
          )}
          <button
            onClick={() => handleViewBrandDetails(row._id)}
            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {!isEmployee && (
            <button
              onClick={() => openEditBrandModal(row)}
              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
              title="Edit Brand"
            >
              <Edit2 size={15} />
            </button>
          )}
          {!isEmployee && (
            <button
              onClick={() => requestDeleteBrand(row)}
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
              title="Delete Brand"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Briefcase size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{isEmployee ? 'My Assigned Brands' : 'Brand Portfolio'}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{isEmployee ? 'Brands assigned to you for content posting and campaigns.' : 'Maintain portfolio of brands handled by the company.'}</p>
          </div>
        </div>

        {!isEmployee && (
          <button
            onClick={openAddBrandModal}
            className="px-4 py-2.5 btn-gradient-primary text-white rounded-xl font-bold text-sm flex items-center space-x-2 self-start sm:self-auto shadow-md"
          >
            <Plus size={18} />
            <span>Add Brand</span>
          </button>
        )}
      </div>

      {/* Search & Brand Type Filter */}
      <div className="bg-white p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-200 shadow-xs">
        <div className="relative flex items-center space-x-3 w-full sm:w-2/3">
          <Search size={16} className="text-purple-600 ml-1 shrink-0" />
          <input
            type="text"
            placeholder="Search by brand name, ID, executive, industry, or contact person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent pr-8"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer transition"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2.5 self-end sm:self-auto shrink-0 relative">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Status:</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="px-3.5 py-2 rounded-xl bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200 text-purple-900 text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-2xs"
            >
              <span>
                {brandTypeFilter === 'All' && `🌐 All Brands (${serverTotalItems})`}
                {brandTypeFilter === 'Running' && `⚡ Running Brands`}
                {brandTypeFilter === 'New' && `✨ New Brands`}
              </span>
              <ChevronDown size={14} className={`text-purple-600 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setBrandTypeFilter('All');
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      brandTypeFilter === 'All' ? 'bg-purple-50 text-purple-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>🌐 All Brands</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-extrabold">{serverTotalItems}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBrandTypeFilter('Running');
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                      brandTypeFilter === 'Running' ? 'bg-blue-50 text-blue-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>⚡ Running Brands</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBrandTypeFilter('New');
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                      brandTypeFilter === 'New' ? 'bg-emerald-50 text-emerald-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>✨ New Brands</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <span className="text-xs font-extrabold text-slate-400 whitespace-nowrap bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            {serverTotalItems} records
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <InlineLoader message="Loading brand portfolio..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable
            columns={columns}
            data={paginatedBrands}
            rowKey="_id"
            emptyMessage={isEmployee ? "No brands have been assigned to your account yet. Contact your Team Leader or Manager to assign brands to you." : "No brands found matching criteria."}
            currentPage={currentPage}
            totalPages={serverTotalPages}
            totalItems={serverTotalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              fetchBrands(page, searchTerm, brandTypeFilter);
            }}
          />
        </div>
      )}

      {/* View Details Modal */}
      <Modal
        isOpen={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
        title="Brand Details & Assignments"
        maxWidth="max-w-xl"
      >
        {selectedBrand && (
          <div className="space-y-4 text-xs font-medium">
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">{selectedBrand.brandId}</span>
                <h3 className="text-lg font-black text-slate-900">{selectedBrand.brandName}</h3>
                <p className="text-xs text-slate-500 font-semibold">{selectedBrand.industry}</p>
              </div>
              <div className="text-right space-y-1">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 inline-block">
                  {selectedBrand.status || 'Active'}
                </span>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedBrand.brandType === 'New' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {selectedBrand.brandType || 'Running'} Brand
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Contact Person</span>
                <p className="font-bold text-slate-800 text-xs">{selectedBrand.contactPerson}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Email</span>
                <p className="font-bold text-slate-800 text-xs">{selectedBrand.email}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Monthly Collab Target</span>
                <p className="font-extrabold text-purple-700 text-xs">
                  {selectedBrand.targetBarterCollabs || (selectedBrand.brandType === 'New' ? 8 : 7)} Barter : {selectedBrand.targetPaidCollabs || (selectedBrand.brandType === 'New' ? 2 : 3)} Paid
                  <span className="text-slate-500 font-medium ml-1">({(selectedBrand.targetBarterCollabs || (selectedBrand.brandType === 'New' ? 8 : 7)) + (selectedBrand.targetPaidCollabs || (selectedBrand.brandType === 'New' ? 2 : 3))}/mo)</span>
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Website</span>
                {selectedBrand.website ? (
                  <a
                    href={selectedBrand.website.startsWith('http') ? selectedBrand.website : `https://${selectedBrand.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-extrabold text-purple-600 hover:text-purple-800 underline text-xs flex items-center gap-1.5 cursor-pointer truncate mt-0.5"
                    title="Open Brand Website"
                  >
                    <Globe size={13} className="text-purple-600 shrink-0" />
                    <span className="truncate">{selectedBrand.website}</span>
                    <ExternalLink size={11} className="text-purple-500 shrink-0" />
                  </a>
                ) : (
                  <p className="font-bold text-slate-400 text-xs italic">N/A</p>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Instagram Account</span>
                {selectedBrand.instagramUrl ? (
                  <a
                    href={selectedBrand.instagramUrl.startsWith('http') ? selectedBrand.instagramUrl : `https://instagram.com/${selectedBrand.instagramUrl.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-extrabold text-pink-600 hover:text-pink-700 underline text-xs flex items-center gap-1.5 cursor-pointer mt-0.5"
                  >
                    <Instagram size={13} className="text-pink-600 shrink-0" />
                    <span>{selectedBrand.instagramUrl}</span>
                    <ExternalLink size={11} className="text-pink-500" />
                  </a>
                ) : (
                  <p className="font-bold text-slate-400 text-xs italic">Not configured</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-black text-slate-900 text-xs uppercase mb-2 flex items-center gap-1">
                <Users size={14} className="text-purple-600" />
                Assigned Team Members ({selectedBrand.assignedEmployees?.length || 0})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedBrand.assignedEmployees?.length === 0 ? (
                  <p className="text-slate-400 text-xs font-semibold italic">No team members assigned to this brand yet.</p>
                ) : (
                  selectedBrand.assignedEmployees?.map((assignment: any) => (
                    <div key={assignment._id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900 text-xs">{assignment.employeeId?.name || 'Staff'}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{assignment.employeeId?.designation || 'Team Member'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                        {assignment.employeeId?.employeeId}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBrand(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Brand Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingBrand ? "Edit Brand Details & Targets" : "Add New Brand"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveBrand} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Brand Name *</label>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Vaasva"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
            />
          </div>

          {/* Manager Controls: Brand Status & Collab Targets */}
          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200 space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-purple-900 uppercase mb-1.5">
                Brand Status (Manager Decision) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleBrandTypeChange('Running')}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs text-center border transition-all ${
                    brandType === 'Running'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ⚡ Running Brand (7B : 3P)
                </button>
                <button
                  type="button"
                  onClick={() => handleBrandTypeChange('New')}
                  className={`py-2 px-3 rounded-xl font-extrabold text-xs text-center border transition-all ${
                    brandType === 'New'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ✨ New Brand (8B : 2P)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Barter Collabs
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={targetBarterCollabs}
                  onChange={(e) => setTargetBarterCollabs(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-lg px-3 py-1.5 text-slate-900 font-bold text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Paid Collabs
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={targetPaidCollabs}
                  onChange={(e) => setTargetPaidCollabs(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-lg px-3 py-1.5 text-slate-900 font-bold text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="text-[11px] font-semibold text-purple-700 text-right">
              Total Target: <span className="font-extrabold">{Number(targetBarterCollabs) + Number(targetPaidCollabs)} Collabs/month</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Industry *</label>
            <CustomIndustrySelect
              value={industry}
              onChange={(val) => setIndustry(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Brand Marketing POC (Optional)"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@brand.com (Optional)"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5 h-5">
                <Globe size={13} className="text-purple-600 shrink-0" />
                <span>Website</span>
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://brand.com"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-pink-700 uppercase tracking-wider mb-1 flex items-center gap-1.5 h-5">
                <Instagram size={13} className="text-pink-600 shrink-0" />
                <span className="truncate">Instagram URL</span>
              </label>
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/handle"
                className="w-full bg-slate-50 border border-slate-200 focus:border-pink-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBrand}
              className="px-4 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingBrand ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{editingBrand ? "Saving..." : "Creating..."}</span>
                </>
              ) : (
                <span>{editingBrand ? "Save Changes" : "Create Brand"}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE CLIENT PORTAL ACCESS MODAL */}
      <Modal
        isOpen={showClientAccessModal}
        onClose={() => setShowClientAccessModal(false)}
        title={`Client Portal Access - ${clientAccessBrand?.brandName || 'Brand'}`}
      >
        <form onSubmit={handleSaveClientAccess} className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium leading-relaxed">
            <strong className="font-black flex items-center gap-1 text-amber-800">
              <KeyRound size={14} /> Client Portal Credentials Generator:
            </strong>
            Create or update login access for the brand representative. The client can log in on the main screen by selecting the <strong className="font-bold">Client Portal</strong> tab.
          </div>

          {clientAccessSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 size={16} />
                <span>Account Activated Successfully!</span>
              </div>
              <p className="text-[11px] font-normal text-emerald-900">{clientAccessSuccess}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Client Representative Name *
            </label>
            <input
              type="text"
              required
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none font-medium text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Client Account Email Address *
            </label>
            <input
              type="email"
              required
              value={clientEmailInput}
              onChange={(e) => setClientEmailInput(e.target.value)}
              placeholder="client@brand.com"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none font-medium text-xs"
            />
            <span className="text-[10px] font-semibold text-slate-400 mt-1 block">
              Clients can use any email domain (no @ad2ship.com restriction).
            </span>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Set Initial Password (Optional)
            </label>
            <input
              type="text"
              value={clientPasswordInput}
              onChange={(e) => setClientPasswordInput(e.target.value)}
              placeholder="e.g. client123"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-slate-900 font-mono focus:outline-none font-bold text-xs"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowClientAccessModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={savingClientAccess}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold transition text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {savingClientAccess ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Access...</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Save Client Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* REUSABLE DELETE CONFIRMATION MODAL PANEL */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title="Confirm Delete Brand"
        itemType="brand"
        itemName={deleteModalState.itemName}
        warningMessage="Deleting this brand will also deactivate associated executive brand assignments."
        loading={deleteModalState.loading}
      />
    </div>
  );
};
