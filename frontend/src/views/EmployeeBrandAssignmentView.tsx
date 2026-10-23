import React, { useState, useEffect, FormEvent } from 'react';
import { 
  UserCheck, Plus, Trash2, Edit2, Briefcase, User as UserIcon, CheckSquare, 
  Square, Search, X, Eye, Loader2, ArrowRightLeft, ChevronDown, ChevronUp, 
  AlertTriangle, CheckCircle2, Layers, Grid, Sparkles, Filter, FileText, Check, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { Employee, Brand, EmployeeBrandAssignment, User } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { InlineLoader } from '../components/PageLoader';
import { DataTable, DataTableColumn } from '../components/DataTable';

// Brand Assignment Division Enum: 1 = Posting & Content, 2 = Barter Collab, 3 = Paid Collab
export const BRAND_ASSIGNMENT_TYPE = {
  POSTING: 1,
  BARTER: 2,
  PAID: 3
} as const;

export type BrandAssignmentTypeId = 1 | 2 | 3;

export const BRAND_ASSIGNMENT_LABEL: Record<number, string> = {
  1: 'Posting & Content',
  2: 'Barter Collab',
  3: 'Paid Collab'
};

export const BRAND_ASSIGNMENT_CONFIG: Record<BrandAssignmentTypeId, { label: string; short: string; color: string; badge: string; bg: string; border: string; icon: string }> = {
  1: {
    label: 'Posting & Content',
    short: 'Posting',
    color: 'text-indigo-700',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    bg: 'bg-indigo-500',
    border: 'border-indigo-300',
    icon: '📸'
  },
  2: {
    label: 'Barter Collab',
    short: 'Barter',
    color: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bg: 'bg-amber-500',
    border: 'border-amber-300',
    icon: '🎁'
  },
  3: {
    label: 'Paid Collab',
    short: 'Paid',
    color: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bg: 'bg-emerald-500',
    border: 'border-emerald-300',
    icon: '💰'
  }
};

const getRoleAssignmentType = (role?: string | null): BrandAssignmentTypeId => {
  if (!role) return 1;
  const r = role.toLowerCase();
  if (r.includes('barter')) return 2;
  if (r.includes('paid')) return 3;
  return 1;
};

interface GroupedAssignment {
  key: string; // `${employeeId}_${assignmentType}`
  employeeId: string;
  employee: Employee;
  assignmentType: BrandAssignmentTypeId;
  assignmentTypeLabel: string;
  assignments: EmployeeBrandAssignment[];
  brands: Brand[];
  responsibility: string;
  priority: string;
  status: string;
  startDate: string;
}

interface MatrixItem {
  brand: Brand;
  posting: Employee | null;
  barter: Employee | null;
  paid: Employee | null;
}

interface EmployeeBrandAssignmentViewProps {
  userRole?: string;
  currentUser?: User | null;
}

export const EmployeeBrandAssignmentView: React.FC<EmployeeBrandAssignmentViewProps> = ({ userRole, currentUser }) => {
  const isEmployeeRole = userRole === 'Employee' || currentUser?.role === 'Employee';

  const [rawAssignments, setRawAssignments] = useState<EmployeeBrandAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab View: 'all', '1' (Posting), '2' (Barter), '3' (Paid), 'matrix' (3-Way Grid)
  const [activeTab, setActiveTab] = useState<'all' | '1' | '2' | '3' | 'matrix'>('all');

  // Matrix Summary state
  const [matrixData, setMatrixData] = useState<MatrixItem[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixCoverageFilter, setMatrixCoverageFilter] = useState<'all' | 'full' | 'partial' | 'unassigned'>('all');

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [viewingGroup, setViewingGroup] = useState<GroupedAssignment | null>(null);
  const [expandedMemberKeys, setExpandedMemberKeys] = useState<Set<string>>(new Set());

  const toggleExpandBrands = (key: string) => {
    setExpandedMemberKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Assign Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedAssignmentType, setSelectedAssignmentType] = useState<BrandAssignmentTypeId>(1);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [assignMemberSearch, setAssignMemberSearch] = useState('');
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [responsibility, setResponsibility] = useState('Brand Operations & Content Posting');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('High');

  // Transfer Brand states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringBrand, setTransferringBrand] = useState(false);
  const [transferAssignmentType, setTransferAssignmentType] = useState<BrandAssignmentTypeId>(1);
  const [transferSelectedBrandId, setTransferSelectedBrandId] = useState('');
  const [transferBrandSearch, setTransferBrandSearch] = useState('');
  const [transferFromEmployeeId, setTransferFromEmployeeId] = useState('');
  const [transferToEmployeeId, setTransferToEmployeeId] = useState('');
  const [showToEmployeeDropdown, setShowToEmployeeDropdown] = useState(false);
  const [toEmployeeSearch, setToEmployeeSearch] = useState('');
  const [transferResponsibility, setTransferResponsibility] = useState('Brand Operations & Content Posting');
  const [transferPriority, setTransferPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('High');

  const fetchData = async () => {
    try {
      const [assignRes, empRes, brandRes] = await Promise.all([
        api.get('/employee-brands'),
        api.get('/employees'),
        api.get('/brands')
      ]);

      if (assignRes.success) setRawAssignments(assignRes.data);
      if (empRes.success) setEmployees(empRes.data.filter((e: Employee) => e.status === 'Active'));
      if (brandRes.success) setBrands(brandRes.data.filter((b: Brand) => b.status === 'Active'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    setMatrixLoading(true);
    try {
      const res = await api.get('/employee-brands/matrix-summary');
      if (res.success && Array.isArray(res.data)) {
        setMatrixData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch matrix summary', err);
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchMatrix();
    }
  }, [activeTab]);

  // Group raw assignments by `${employeeId}_${assignmentType}`
  const groupedMap = new Map<string, GroupedAssignment>();

  rawAssignments.forEach((item) => {
    const emp = item.employeeId as any;
    const brd = item.brandId as any;
    if (!emp) return;

    const empId = typeof emp === 'object' ? (emp._id || emp.id) : String(emp);
    if (!empId) return;

    const empObj = typeof emp === 'object' ? emp : (employees.find(e => e._id === emp) || { _id: emp, name: 'Staff', designation: '' });
    const brdObj = typeof brd === 'object' ? brd : (brands.find(b => b._id === brd) || { _id: brd, brandName: 'Brand', industry: '' });

    const rawType = Number(item.assignmentType);
    const finalType: BrandAssignmentTypeId = [1, 2, 3].includes(rawType) ? (rawType as BrandAssignmentTypeId) : 1;
    const groupKey = `${empId}_${finalType}`;

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        key: groupKey,
        employeeId: empId,
        employee: empObj,
        assignmentType: finalType,
        assignmentTypeLabel: BRAND_ASSIGNMENT_LABEL[finalType],
        assignments: [item],
        brands: brdObj && (brdObj._id || brdObj.brandName) ? [brdObj] : [],
        responsibility: item.responsibility || (finalType === 1 ? 'Brand Operations & Content Posting' : finalType === 2 ? 'Barter Collab Management' : 'Paid Collab Management'),
        priority: item.priority || 'High',
        status: item.status || 'Active',
        startDate: item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A'
      });
    } else {
      const existing = groupedMap.get(groupKey)!;
      existing.assignments.push(item);
      const bId = brdObj?._id || (brdObj as any)?.id;
      if (bId && !existing.brands.some(b => (b._id || (b as any).id) === bId)) {
        existing.brands.push(brdObj);
      }
    }
  });

  const allGroupedAssignments = Array.from(groupedMap.values());

  // Filter groups by active division tab
  const displayedGroups = allGroupedAssignments.filter((g) => {
    if (activeTab === 'all') return true;
    if (activeTab === '1') return g.assignmentType === 1;
    if (activeTab === '2') return g.assignmentType === 2;
    if (activeTab === '3') return g.assignmentType === 3;
    return true;
  });

  // Calculate division assignment counters
  const totalActiveAssignments = rawAssignments.filter(a => a.status === 'Active').length;
  const countPostingAssignments = rawAssignments.filter(a => a.status === 'Active' && (a.assignmentType === 1 || !a.assignmentType)).length;
  const countBarterAssignments = rawAssignments.filter(a => a.status === 'Active' && a.assignmentType === 2).length;
  const countPaidAssignments = rawAssignments.filter(a => a.status === 'Active' && a.assignmentType === 3).length;

  // Open Create Modal
  const openCreateModal = (defaultType?: BrandAssignmentTypeId, preselectBrandId?: string) => {
    setEditingKey(null);
    setSelectedEmployeeId('');
    setShowMemberDropdown(false);
    setAssignMemberSearch('');

    const initialType = defaultType || (activeTab === '1' ? 1 : activeTab === '2' ? 2 : activeTab === '3' ? 3 : 1);
    setSelectedAssignmentType(initialType);

    if (preselectBrandId) {
      setSelectedBrandIds([preselectBrandId]);
    } else {
      setSelectedBrandIds([]);
    }
    setBrandSearch('');
    setResponsibility(
      initialType === 1 ? 'Brand Operations & Content Posting' :
      initialType === 2 ? 'Barter Influencer Outreach & Collaborations' :
      'Paid Influencer Deals & Negotiations'
    );
    setPriority('High');
    setShowAssignModal(true);
  };

  // Open Edit Modal for a specific group
  const openEditModal = (group: GroupedAssignment) => {
    setEditingKey(group.key);
    setSelectedEmployeeId(group.employeeId);
    setSelectedAssignmentType(group.assignmentType);
    setShowMemberDropdown(false);
    setAssignMemberSearch('');
    setSelectedBrandIds(group.brands.map(b => b._id));
    setBrandSearch('');
    setResponsibility(group.responsibility);
    setPriority(group.priority as any);
    setShowAssignModal(true);
  };

  // Switch assignmentType in Modal
  const handleSelectAssignmentType = (typeId: BrandAssignmentTypeId) => {
    setSelectedAssignmentType(typeId);
    if (!editingKey) {
      setResponsibility(
        typeId === 1 ? 'Brand Operations & Content Posting' :
        typeId === 2 ? 'Barter Influencer Outreach & Collaborations' :
        'Paid Influencer Deals & Negotiations'
      );
    }
  };

  // Brands assigned list for Transfer Modal, strictly filtered by transferAssignmentType
  const getAssignedBrandsListForType = (typeId: BrandAssignmentTypeId) => {
    const list: { brand: Brand; currentEmp: Employee | null; assignment: EmployeeBrandAssignment }[] = [];
    rawAssignments.forEach((item) => {
      const itemType = Number(item.assignmentType) || 1;
      if (item.status === 'Active' && itemType === typeId) {
        const emp = item.employeeId as any;
        const brd = item.brandId as any;
        const empId = typeof emp === 'object' ? (emp?._id || emp?.id) : String(emp);
        const bId = typeof brd === 'object' ? (brd?._id || brd?.id) : String(brd);

        const brandObj = typeof brd === 'object' ? brd : brands.find(b => b._id === bId);
        const empObj = typeof emp === 'object' ? emp : employees.find(e => e._id === empId);

        if (brandObj && (brandObj._id || brandObj.brandName)) {
          if (!list.some(x => x.brand._id === (brandObj._id || bId))) {
            list.push({
              brand: brandObj,
              currentEmp: empObj || null,
              assignment: item
            });
          }
        }
      }
    });
    return list.sort((a, b) => (a.brand.brandName || '').localeCompare(b.brand.brandName || ''));
  };

  const transferAssignedList = getAssignedBrandsListForType(transferAssignmentType);

  const openTransferModal = (brandId?: string, fromEmployeeId?: string, assignmentType?: BrandAssignmentTypeId) => {
    const targetType = assignmentType || (activeTab === '1' ? 1 : activeTab === '2' ? 2 : activeTab === '3' ? 3 : 1);
    setTransferAssignmentType(targetType);

    const list = getAssignedBrandsListForType(targetType);

    if (brandId) {
      setTransferSelectedBrandId(brandId);
      if (fromEmployeeId) {
        setTransferFromEmployeeId(fromEmployeeId);
      } else {
        const match = list.find(x => x.brand._id === brandId);
        setTransferFromEmployeeId(match?.currentEmp?._id || '');
      }
    } else if (fromEmployeeId) {
      setTransferFromEmployeeId(fromEmployeeId);
      const firstBrand = list.find(x => x.currentEmp?._id === fromEmployeeId);
      setTransferSelectedBrandId(firstBrand?.brand._id || list[0]?.brand._id || '');
    } else {
      setTransferSelectedBrandId(list[0]?.brand._id || '');
      setTransferFromEmployeeId(list[0]?.currentEmp?._id || '');
    }

    setTransferBrandSearch('');
    setTransferToEmployeeId('');
    setShowToEmployeeDropdown(false);
    setToEmployeeSearch('');
    setTransferResponsibility(
      targetType === 1 ? 'Brand Operations & Content Posting' :
      targetType === 2 ? 'Barter Influencer Outreach & Collaborations' :
      'Paid Influencer Deals & Negotiations'
    );
    setTransferPriority('High');
    setShowTransferModal(true);
  };

  const handleTransferBrandSelect = (bId: string) => {
    setTransferSelectedBrandId(bId);
    const match = transferAssignedList.find(x => x.brand._id === bId);
    if (match && match.currentEmp) {
      setTransferFromEmployeeId(match.currentEmp._id);
    } else {
      setTransferFromEmployeeId('');
    }
  };

  const handleTransferBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferSelectedBrandId || !transferToEmployeeId) {
      alert('Please select both a brand and the target employee.');
      return;
    }
    if (transferFromEmployeeId && transferFromEmployeeId === transferToEmployeeId) {
      alert('Target employee must be different from the current employee.');
      return;
    }

    setTransferringBrand(true);
    try {
      const res = await api.post('/employee-brands/transfer', {
        brandId: transferSelectedBrandId,
        fromEmployeeId: transferFromEmployeeId || undefined,
        toEmployeeId: transferToEmployeeId,
        assignmentType: transferAssignmentType,
        responsibility: transferResponsibility,
        priority: transferPriority
      });

      if (res.success) {
        setShowTransferModal(false);
        setTransferSelectedBrandId('');
        setTransferFromEmployeeId('');
        setTransferToEmployeeId('');
        fetchData();
        if (activeTab === 'matrix') fetchMatrix();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to transfer brand');
    } finally {
      setTransferringBrand(false);
    }
  };

  const handleSaveAssignments = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      alert('Please select an employee.');
      return;
    }

    setSavingAssignments(true);
    try {
      const res = await api.post('/employee-brands/sync-employee', {
        employeeId: selectedEmployeeId,
        brandIds: selectedBrandIds,
        assignmentType: selectedAssignmentType,
        responsibility,
        priority
      });

      if (res.success) {
        setShowAssignModal(false);
        setEditingKey(null);
        fetchData();
        if (activeTab === 'matrix') fetchMatrix();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save brand assignments');
    } finally {
      setSavingAssignments(false);
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

  const requestRemoveAllForGroup = (group: GroupedAssignment) => {
    setDeleteModalState({
      isOpen: true,
      itemName: `${group.employee?.name || 'Executive'} - ${group.assignmentTypeLabel} (${group.brands.length} brands)`,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/employee-brands/employee/${group.employeeId}?assignmentType=${group.assignmentType}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            fetchData();
            if (activeTab === 'matrix') fetchMatrix();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete assignments');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Status Change Confirmation Modal State
  const [statusModalState, setStatusModalState] = useState<{
    isOpen: boolean;
    group: GroupedAssignment | null;
    loading: boolean;
  }>({
    isOpen: false,
    group: null,
    loading: false
  });

  const requestToggleStatus = (group: GroupedAssignment) => {
    setStatusModalState({
      isOpen: true,
      group,
      loading: false
    });
  };

  const confirmToggleStatus = async () => {
    if (!statusModalState.group) return;
    const group = statusModalState.group;
    const newStatus = group.status === 'Active' ? 'Removed' : 'Active';

    setStatusModalState(prev => ({ ...prev, loading: true }));
    try {
      await Promise.all(
        group.assignments.map(a => api.put(`/employee-brands/${a._id}`, { status: newStatus }))
      );
      setStatusModalState({ isOpen: false, group: null, loading: false });
      fetchData();
      if (activeTab === 'matrix') fetchMatrix();
    } catch (err: any) {
      console.error('Failed to update status', err);
      alert(err.message || 'Failed to update status');
      setStatusModalState(prev => ({ ...prev, loading: false }));
    }
  };

  // Available brands for selected division in Modal:
  // A brand is ONLY blocked in this division if assigned to SOMEONE ELSE in the SAME division!
  const assignedBrandIdsInSelectedType = new Set<string>();
  rawAssignments.forEach((item) => {
    const rawType = Number(item.assignmentType) || 1;
    if (item.status === 'Active' && rawType === selectedAssignmentType) {
      const emp = item.employeeId as any;
      const brd = item.brandId as any;
      const empId = typeof emp === 'object' ? (emp?._id || emp?.id) : String(emp);
      const bId = typeof brd === 'object' ? (brd?._id || brd?.id) : String(brd);
      if (empId !== selectedEmployeeId && bId) {
        assignedBrandIdsInSelectedType.add(bId);
      }
    }
  });

  const unassignedBrandsForSelect = brands.filter((b) => !assignedBrandIdsInSelectedType.has(b._id));

  const filteredBrandsForSelect = unassignedBrandsForSelect.filter((b) =>
    b.brandName.toLowerCase().includes(brandSearch.toLowerCase()) ||
    (b.industry || '').toLowerCase().includes(brandSearch.toLowerCase())
  );

  const columns: DataTableColumn<GroupedAssignment>[] = [
    {
      key: 'sno',
      label: 'S.No',
      width: 'w-14',
      align: 'center',
      render: (_, __, idx) => (
        <span className="font-bold text-slate-400 text-xs">{idx + 1}</span>
      ),
    },
    {
      key: 'employee',
      label: 'Team Member',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200 shrink-0">
            <UserIcon size={16} />
          </div>
          <div>
            <div className="text-slate-900 font-extrabold text-xs">{row.employee?.name || 'N/A'}</div>
            <div className="text-[10px] text-purple-600 font-bold">{row.employee?.designation || 'Executive'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'division',
      label: 'Division',
      sortable: true,
      render: (_, row) => {
        const cfg = BRAND_ASSIGNMENT_CONFIG[row.assignmentType] || BRAND_ASSIGNMENT_CONFIG[1];
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs ${cfg.badge}`}>
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
          </span>
        );
      },
    },
    {
      key: 'brands',
      label: 'Assigned Brands',
      sortable: false,
      render: (_, row) => {
        if (!row.brands || row.brands.length === 0) {
          return <span className="text-slate-400 text-xs italic">No brands assigned</span>;
        }

        const isExpanded = expandedMemberKeys.has(row.key);
        const MAX_PREVIEW = 4;
        const hasMore = row.brands.length > MAX_PREVIEW;
        const visibleBrands = hasMore && !isExpanded ? row.brands.slice(0, MAX_PREVIEW) : row.brands;
        const remainingCount = row.brands.length - MAX_PREVIEW;

        return (
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {visibleBrands.map((b) => (
              <span
                key={b._id}
                onClick={() => !isEmployeeRole && openTransferModal(b._id, row.employeeId, row.assignmentType)}
                className={`group/badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-800 border border-slate-200/90 hover:border-purple-300 transition-all shadow-2xs ${
                  !isEmployeeRole ? 'cursor-pointer' : ''
                }`}
                title={!isEmployeeRole ? `Click to Transfer "${b.brandName}" (${row.assignmentTypeLabel})` : b.brandName}
              >
                <Briefcase size={11} className="text-purple-600 shrink-0 opacity-80 group-hover/badge:opacity-100" />
                <span className="max-w-[130px] truncate">{b.brandName}</span>
                {!isEmployeeRole && (
                  <ArrowRightLeft size={10} className="text-slate-400 group-hover/badge:text-purple-600 shrink-0 transition" />
                )}
              </span>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => toggleExpandBrands(row.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                  isExpanded
                    ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300'
                    : 'bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-800 border-slate-200 hover:border-purple-300'
                }`}
                title={isExpanded ? 'Show less brands' : `Show ${remainingCount} more brands`}
              >
                <span>{isExpanded ? 'Show Less' : `+${remainingCount} More`}</span>
                {isExpanded ? (
                  <ChevronUp size={12} className="text-purple-700" />
                ) : (
                  <ChevronDown size={12} className="text-slate-500" />
                )}
              </button>
            )}
          </div>
        );
      },
    },
    { key: 'responsibility', label: 'Responsibility', sortable: false },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (val) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          val === 'Urgent' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
          val === 'High' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
          'bg-purple-50 text-purple-700 border border-purple-200'
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => {
        const isActive = row.status === 'Active';
        return (
          <button
            type="button"
            onClick={() => requestToggleStatus(row)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-teal-600' : 'bg-slate-300'}`}
            role="switch"
            aria-checked={isActive}
            title={isActive ? 'Active (Click to deactivate)' : 'Deactivated (Click to activate)'}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
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
          {isEmployeeRole ? (
            <button
              onClick={() => setViewingGroup(row)}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition font-extrabold text-xs flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="View Assigned Brands Portfolio"
            >
              <Eye size={14} />
              <span>View</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => openEditModal(row)}
                className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                title={`Edit Brand Assignments for ${row.assignmentTypeLabel}`}
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => requestRemoveAllForGroup(row)}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title={`Remove ${row.assignmentTypeLabel} Assignments`}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Banner & Action Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Brand Operations & Division Matrix</h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                150+ Brands Managed
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              3-tier operational division: Posting & Content, Barter Collabs, and Paid Collabs.
            </p>
          </div>
        </div>

        {!isEmployeeRole && (
          <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end">
            <button
              onClick={() => openTransferModal()}
              className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
              title="Transfer a Brand between team members"
            >
              <ArrowRightLeft size={16} className="text-purple-600" />
              <span>Transfer Brand</span>
            </button>

            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2.5 btn-gradient-primary text-white rounded-xl font-bold text-sm flex items-center space-x-2 shadow-md cursor-pointer hover:shadow-lg transition"
            >
              <Plus size={18} />
              <span>New Assignment</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Cards across the 3 Divisions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0 border border-purple-100">
            <Briefcase size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Total Active Brands</span>
            <div className="text-xl font-black text-slate-900">{brands.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0 border border-indigo-200">
            <FileText size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider">Posting & Content</span>
            <div className="text-xl font-black text-indigo-950">{countPostingAssignments} Assignments</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0 border border-amber-200">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-amber-700 block tracking-wider">Barter Collabs</span>
            <div className="text-xl font-black text-amber-950">{countBarterAssignments} Assignments</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-200">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider">Paid Collabs</span>
            <div className="text-xl font-black text-emerald-950">{countPaidAssignments} Assignments</div>
          </div>
        </div>
      </div>

      {/* Division Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <Layers size={14} />
            <span>All Divisions ({allGroupedAssignments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('1')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === '1'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            <span>📸</span>
            <span>Posting & Content ({allGroupedAssignments.filter(g => g.assignmentType === 1).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('2')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === '2'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            <span>🎁</span>
            <span>Barter Collabs ({allGroupedAssignments.filter(g => g.assignmentType === 2).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('3')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === '3'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <span>💰</span>
            <span>Paid Collabs ({allGroupedAssignments.filter(g => g.assignmentType === 3).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 border ${
              activeTab === 'matrix'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-900 border-purple-200 hover:border-purple-300'
            }`}
          >
            <Grid size={14} className={activeTab === 'matrix' ? 'text-purple-300' : 'text-purple-600'} />
            <span>Brand 3-Way Matrix ({brands.length} Brands)</span>
          </button>
        </div>

        {activeTab === 'matrix' && (
          <button
            type="button"
            onClick={fetchMatrix}
            disabled={matrixLoading}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} className={matrixLoading ? 'animate-spin' : ''} />
            <span>Refresh Grid</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <InlineLoader message="Loading brand assignments..." />
      ) : activeTab === 'matrix' ? (
        /* ================= 3-WAY BRAND ALLOCATION MATRIX VIEW ================= */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Matrix Filter & Search Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full md:w-80">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search brands or assigned executives..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium text-xs shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Coverage:</span>
              <button
                type="button"
                onClick={() => setMatrixCoverageFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matrixCoverageFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMatrixCoverageFilter('full')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matrixCoverageFilter === 'full' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                Full (3/3)
              </button>
              <button
                type="button"
                onClick={() => setMatrixCoverageFilter('partial')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matrixCoverageFilter === 'partial' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                Partial (1-2/3)
              </button>
              <button
                type="button"
                onClick={() => setMatrixCoverageFilter('unassigned')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  matrixCoverageFilter === 'unassigned' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                Unassigned (0/3)
              </button>
            </div>
          </div>

          {matrixLoading ? (
            <InlineLoader message="Generating 3-way brand allocation matrix..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Brand</th>
                    <th className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center gap-1.5 text-indigo-700">
                        <span>📸</span>
                        <span>Posting & Content</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <span>🎁</span>
                        <span>Barter Collab</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <span>💰</span>
                        <span>Paid Collab</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 w-32 text-center">Coverage</th>
                    <th className="py-3 px-4 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixData
                    .filter((item) => {
                      const q = matrixSearch.toLowerCase();
                      const bName = item.brand.brandName?.toLowerCase() || '';
                      const ind = (item.brand.industry || '').toLowerCase();
                      const postEmp = item.posting?.name?.toLowerCase() || '';
                      const barterEmp = item.barter?.name?.toLowerCase() || '';
                      const paidEmp = item.paid?.name?.toLowerCase() || '';
                      const matchSearch = bName.includes(q) || ind.includes(q) || postEmp.includes(q) || barterEmp.includes(q) || paidEmp.includes(q);
                      if (!matchSearch) return false;

                      const assignedCount = [item.posting, item.barter, item.paid].filter(Boolean).length;
                      if (matrixCoverageFilter === 'full') return assignedCount === 3;
                      if (matrixCoverageFilter === 'partial') return assignedCount === 1 || assignedCount === 2;
                      if (matrixCoverageFilter === 'unassigned') return assignedCount === 0;
                      return true;
                    })
                    .map((item, idx) => {
                      const assignedCount = [item.posting, item.barter, item.paid].filter(Boolean).length;

                      return (
                        <tr key={item.brand._id} className="hover:bg-purple-50/30 transition">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          
                          {/* Brand Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0 border border-purple-200">
                                {(item.brand.brandName || 'B').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 text-xs truncate">{item.brand.brandName}</div>
                                <div className="text-[10px] text-slate-500 font-semibold">{item.brand.industry || 'Brand'}</div>
                              </div>
                            </div>
                          </td>

                          {/* [1] Posting Exec */}
                          <td className="py-3 px-4">
                            {item.posting ? (
                              <div className="flex items-center space-x-2 bg-indigo-50/70 border border-indigo-200 px-2.5 py-1.5 rounded-xl">
                                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {item.posting.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-indigo-950 text-xs truncate">{item.posting.name}</div>
                                  <div className="text-[9px] text-indigo-600 font-bold truncate">{item.posting.designation || 'Posting Executive'}</div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreateModal(1, item.brand._id)}
                                className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-slate-200 hover:border-indigo-300 px-2.5 py-1.5 rounded-xl transition w-full text-left flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>Assign Posting</span>
                              </button>
                            )}
                          </td>

                          {/* [2] Barter Exec */}
                          <td className="py-3 px-4">
                            {item.barter ? (
                              <div className="flex items-center space-x-2 bg-amber-50/70 border border-amber-200 px-2.5 py-1.5 rounded-xl">
                                <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {item.barter.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-amber-950 text-xs truncate">{item.barter.name}</div>
                                  <div className="text-[9px] text-amber-600 font-bold truncate">{item.barter.designation || 'Barter Executive'}</div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreateModal(2, item.brand._id)}
                                className="text-[11px] font-bold text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-dashed border-slate-200 hover:border-amber-300 px-2.5 py-1.5 rounded-xl transition w-full text-left flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>Assign Barter</span>
                              </button>
                            )}
                          </td>

                          {/* [3] Paid Exec */}
                          <td className="py-3 px-4">
                            {item.paid ? (
                              <div className="flex items-center space-x-2 bg-emerald-50/70 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {item.paid.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-emerald-950 text-xs truncate">{item.paid.name}</div>
                                  <div className="text-[9px] text-emerald-600 font-bold truncate">{item.paid.designation || 'Paid Executive'}</div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreateModal(3, item.brand._id)}
                                className="text-[11px] font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-dashed border-slate-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-xl transition w-full text-left flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>Assign Paid</span>
                              </button>
                            )}
                          </td>

                          {/* Coverage Badge */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              assignedCount === 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              assignedCount === 2 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              assignedCount === 1 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {assignedCount}/3 Assigned
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openCreateModal(1, item.brand._id)}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="Assign or update executives for this brand"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= MEMBER & DIVISION GROUPED TABLE ================= */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <DataTable
            columns={columns}
            data={displayedGroups}
            rowKey="key"
            emptyMessage={
              activeTab === 'all' ? "No employee brand assignments found." :
              `No assignments found for ${BRAND_ASSIGNMENT_LABEL[Number(activeTab) || 1]}.`
            }
          />
        </div>
      )}

      {/* ================= ASSIGN / EDIT MODAL ================= */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={editingKey ? "Edit Executive Brand Portfolio" : "Assign Brands to Executive"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveAssignments} className="space-y-4 text-sm font-bold">
          {/* 1. DIVISION SELECTOR (1 = Posting, 2 = Barter, 3 = Paid) */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Select Division *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as BrandAssignmentTypeId[]).map((typeId) => {
                const isSelected = selectedAssignmentType === typeId;
                const cfg = BRAND_ASSIGNMENT_CONFIG[typeId];
                return (
                  <button
                    key={typeId}
                    type="button"
                    onClick={() => handleSelectAssignmentType(typeId)}
                    className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition cursor-pointer ${
                      isSelected
                        ? `${cfg.badge} border-current shadow-xs ring-2 ring-purple-400/30 font-black`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-purple-50 hover:border-purple-200'
                    }`}
                  >
                    <span className="text-base">{cfg.icon}</span>
                    <span className="text-[11px] leading-tight text-center">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Member Selection Dropdown */}
          <div className="relative">
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5">
              Select Executive *
            </label>

            {editingKey ? (
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <UserIcon size={14} />
                  </div>
                  <div>
                    <div className="text-slate-900 font-extrabold text-xs">
                      {employees.find(e => e._id === selectedEmployeeId)?.name || 'Member'}
                    </div>
                    <div className="text-[10px] text-purple-700 font-semibold">
                      {employees.find(e => e._id === selectedEmployeeId)?.designation || 'Staff'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-white text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
                  Editing {BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]}
                </span>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                  className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-slate-900 font-bold text-xs flex items-center justify-between transition cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <UserIcon size={12} />
                    </div>
                    <span className="truncate">
                      {employees.find(e => e._id === selectedEmployeeId)?.name
                        ? `${employees.find(e => e._id === selectedEmployeeId)?.name} (${employees.find(e => e._id === selectedEmployeeId)?.designation || 'Staff'})`
                        : '-- Select Team Member --'}
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${showMemberDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showMemberDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMemberDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-purple-200 rounded-2xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search executive by name..."
                          value={assignMemberSearch}
                          onChange={(e) => setAssignMemberSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                        {employees
                          .filter(e => e.name.toLowerCase().includes(assignMemberSearch.toLowerCase()) || (e.designation || '').toLowerCase().includes(assignMemberSearch.toLowerCase()))
                          .map((emp) => {
                            const isSelected = selectedEmployeeId === emp._id;
                            const empGroupKey = `${emp._id}_${selectedAssignmentType}`;
                            const assignedGroup = groupedMap.get(empGroupKey);
                            const brandCount = assignedGroup?.brands.length || 0;

                            return (
                              <div
                                key={emp._id}
                                onClick={() => {
                                  const newEmpId = emp._id;
                                  setSelectedEmployeeId(newEmpId);
                                  setShowMemberDropdown(false);
                                  setAssignMemberSearch('');

                                  // Auto-detect role division if not manually picked
                                  const detectedType = getRoleAssignmentType(emp.role || emp.designation);
                                  if (detectedType !== selectedAssignmentType) {
                                    setSelectedAssignmentType(detectedType);
                                  }

                                  const targetKey = `${newEmpId}_${detectedType}`;
                                  const matchingGroup = groupedMap.get(targetKey);
                                  if (matchingGroup) {
                                    setSelectedBrandIds(matchingGroup.brands.map(b => b._id));
                                    setResponsibility(matchingGroup.responsibility);
                                    setPriority(matchingGroup.priority as any || 'High');
                                  }
                                }}
                                className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition ${
                                  isSelected
                                    ? 'bg-purple-600 text-white shadow-2xs'
                                    : 'hover:bg-purple-50 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{emp.name}</span>
                                  <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                                    ({emp.designation || 'Staff'})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {brandCount} Brands
                                  </span>
                                  {isSelected && <CheckSquare size={14} className="text-white shrink-0" />}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 3. Searchable Multi-Select Brand Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-extrabold text-slate-700 uppercase">
                Assign Brands for {BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]} *
              </label>
              <div className="flex items-center space-x-2">
                {selectedBrandIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBrandIds([])}
                    className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <span className="text-[10px] text-purple-700 font-black bg-purple-100 px-2.5 py-0.5 rounded-full">
                  {selectedBrandIds.length} Selected
                </span>
              </div>
            </div>

            {/* Selected Brand Badges Cloud */}
            {selectedBrandIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-purple-50/50 rounded-xl border border-purple-100 mb-2 max-h-32 overflow-y-auto">
                {selectedBrandIds.map(id => {
                  const brand = brands.find(b => b._id === id);
                  return (
                    <span
                      key={id}
                      className="px-2.5 py-1 bg-white text-purple-900 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>{brand?.brandName || id}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBrandIds(selectedBrandIds.filter(bId => bId !== id))}
                        className="text-purple-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search Input for Brands */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search available brands for ${BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]}...`}
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium text-xs"
              />
            </div>

            {/* Unassigned Brands Counter Header */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-extrabold mb-1.5 px-0.5">
              <span>{filteredBrandsForSelect.length} Available Brands for {BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]}</span>
            </div>

            {/* Filtered Brands List */}
            <div className="space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-44 overflow-y-auto">
              {filteredBrandsForSelect.length === 0 ? (
                <p className="text-slate-400 text-xs italic font-medium p-4 text-center">
                  {brandSearch ? `No available brands matching "${brandSearch}".` : `All active brands are currently assigned for ${BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]}.`}
                </p>
              ) : (
                filteredBrandsForSelect.map((b) => {
                  const isChecked = selectedBrandIds.includes(b._id);
                  return (
                    <div
                      key={b._id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedBrandIds(selectedBrandIds.filter(id => id !== b._id));
                        } else {
                          setSelectedBrandIds([...selectedBrandIds, b._id]);
                        }
                      }}
                      className={`p-2 rounded-xl border text-xs font-extrabold flex items-center justify-between cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {isChecked ? <CheckSquare size={16} className="shrink-0" /> : <Square size={16} className="text-slate-400 shrink-0" />}
                        <span className="truncate">{b.brandName}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${isChecked ? 'text-purple-100' : 'text-slate-400'}`}>
                        {b.industry || 'General Industry'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Responsibility / Role *</label>
            <input
              type="text"
              required
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
              placeholder="e.g. Content Posting & Calendar Management"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 focus:outline-none font-bold text-xs"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAssignments}
              className="px-4 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {savingAssignments ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingKey ? "Save Portfolio Changes" : `Assign Brands for ${BRAND_ASSIGNMENT_LABEL[selectedAssignmentType]}`}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= TRANSFER BRAND MODAL ================= */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Transfer Brand Assignment"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleTransferBrand} className="space-y-4 text-sm font-bold">
          {/* Header Banner */}
          <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200 rounded-2xl text-xs text-purple-950 flex items-center gap-2.5 shadow-2xs">
            <ArrowRightLeft size={16} className="text-purple-600 shrink-0" />
            <p className="leading-tight">
              Transfer a brand assignment within the selected operational division without disturbing other division owners.
            </p>
          </div>

          {/* Division Selector for Transfer */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Transfer Division (Enum ID) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as BrandAssignmentTypeId[]).map((typeId) => {
                const isSelected = transferAssignmentType === typeId;
                const cfg = BRAND_ASSIGNMENT_CONFIG[typeId];
                return (
                  <button
                    key={typeId}
                    type="button"
                    onClick={() => {
                      setTransferAssignmentType(typeId);
                      const list = getAssignedBrandsListForType(typeId);
                      setTransferSelectedBrandId(list[0]?.brand._id || '');
                      setTransferFromEmployeeId(list[0]?.currentEmp?._id || '');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition cursor-pointer ${
                      isSelected
                        ? `${cfg.badge} border-current shadow-xs ring-2 ring-purple-400/30 font-black`
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-purple-50 hover:border-purple-200'
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span className="text-[11px] leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. Select Brand to Transfer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                1. Select Brand to Transfer *
              </label>
              {transferSelectedBrandId && (
                <span className="text-[10px] text-purple-700 font-bold bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200">
                  Selected: {transferAssignedList.find(x => x.brand._id === transferSelectedBrandId)?.brand.brandName}
                </span>
              )}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search brand or current executive in ${BRAND_ASSIGNMENT_LABEL[transferAssignmentType]}...`}
                value={transferBrandSearch}
                onChange={(e) => setTransferBrandSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium text-xs shadow-2xs"
              />
            </div>

            <div className="space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-36 overflow-y-auto">
              {transferAssignedList.length === 0 ? (
                <p className="text-slate-400 text-xs italic p-4 text-center">
                  No active assignments found for {BRAND_ASSIGNMENT_LABEL[transferAssignmentType]}.
                </p>
              ) : (
                transferAssignedList
                  .filter(item => {
                    const q = transferBrandSearch.toLowerCase();
                    const bName = item.brand.brandName?.toLowerCase() || '';
                    const empName = item.currentEmp?.name?.toLowerCase() || '';
                    const ind = (item.brand.industry || '').toLowerCase();
                    return bName.includes(q) || empName.includes(q) || ind.includes(q);
                  })
                  .map(({ brand, currentEmp }) => {
                    const isSelected = transferSelectedBrandId === brand._id;
                    return (
                      <div
                        key={brand._id}
                        onClick={() => handleTransferBrandSelect(brand._id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-purple-50/60 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <Briefcase size={14} className={isSelected ? 'text-white' : 'text-purple-600 shrink-0'} />
                          <span className="font-extrabold truncate">{brand.brandName}</span>
                          {brand.industry && (
                            <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {brand.industry}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            isSelected ? 'bg-white/20 text-white border border-white/30' : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}>
                            👤 {currentEmp?.name || 'Staff'}
                          </span>
                          {isSelected && <CheckSquare size={16} className="text-white shrink-0" />}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* 2. Visual Transfer Route Card: [From Current Owner] -> [To New Assignee] */}
          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center space-x-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200">
                <UserIcon size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">From (Current Owner)</span>
                <div className="font-extrabold text-xs text-slate-900 truncate">
                  {employees.find(e => e._id === transferFromEmployeeId)?.name || (transferSelectedBrandId ? 'Current Owner' : 'Select Brand First')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center px-1 shrink-0">
              <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <ArrowRightLeft size={13} />
              </div>
            </div>

            <div className="flex items-center space-x-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                <UserIcon size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-black text-emerald-700 block tracking-wider">To (New Assignee)</span>
                <div className="font-extrabold text-xs text-emerald-900 truncate">
                  {employees.find(e => e._id === transferToEmployeeId)?.name || 'Select Member Below'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Select Destination Member */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                2. Select New Team Member to Assign *
              </label>
              {transferToEmployeeId && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Target: {employees.find(e => e._id === transferToEmployeeId)?.name}
                </span>
              )}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search member name or designation..."
                value={toEmployeeSearch}
                onChange={(e) => setToEmployeeSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium text-xs shadow-2xs"
              />
            </div>

            <div className="space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-36 overflow-y-auto">
              {employees
                .filter(e => e._id !== transferFromEmployeeId)
                .filter(e => e.name.toLowerCase().includes(toEmployeeSearch.toLowerCase()) || (e.designation || '').toLowerCase().includes(toEmployeeSearch.toLowerCase()))
                .map((emp) => {
                  const isSelected = transferToEmployeeId === emp._id;
                  return (
                    <div
                      key={emp._id}
                      onClick={() => setTransferToEmployeeId(emp._id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-emerald-50/50 hover:border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                        }`}>
                          <UserIcon size={12} />
                        </div>
                        <span className="font-extrabold truncate">{emp.name}</span>
                        <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {emp.designation || 'Executive'}
                        </span>
                      </div>

                      {isSelected && <CheckSquare size={16} className="text-white shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Responsibility / Role
            </label>
            <input
              type="text"
              value={transferResponsibility}
              onChange={(e) => setTransferResponsibility(e.target.value)}
              placeholder="e.g. Brand Operations & Content Posting"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 focus:outline-none font-medium text-xs"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowTransferModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferringBrand || !transferSelectedBrandId || !transferToEmployeeId}
              className="px-5 py-2.5 btn-gradient-primary text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transferringBrand ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Transferring Brand...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft size={14} />
                  <span>Confirm & Transfer Brand</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= VIEW BRAND ASSIGNMENT MODAL ================= */}
      {viewingGroup && (
        <Modal
          isOpen={!!viewingGroup}
          onClose={() => setViewingGroup(null)}
          title={`Assigned Brands Portfolio - ${viewingGroup.employee?.name || 'Staff'}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm">
                  {(viewingGroup.employee?.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">{viewingGroup.employee?.name}</h4>
                  <p className="text-xs font-bold text-purple-700">{viewingGroup.employee?.designation || 'Influencer Executive'}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${BRAND_ASSIGNMENT_CONFIG[viewingGroup.assignmentType].badge}`}>
                {viewingGroup.assignmentTypeLabel}
              </span>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase text-slate-500 mb-2 block">
                Assigned Brands Portfolio ({viewingGroup.brands.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {viewingGroup.brands.map((b) => (
                  <div key={b._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs shrink-0">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs">{b.brandName}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{b.industry || 'General Industry'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Responsibility</span>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{viewingGroup.responsibility}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Priority Level</span>
                <p className="text-xs font-bold text-purple-700 mt-0.5">{viewingGroup.priority}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingGroup(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition border border-slate-200 cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* REUSABLE DELETE CONFIRMATION MODAL PANEL */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title="Confirm Remove Brand Assignments"
        itemType="division brand assignments for"
        itemName={deleteModalState.itemName}
        warningMessage="This will deactivate all brand assignments for this executive within this specific division."
        loading={deleteModalState.loading}
      />

      {/* STATUS CHANGE CONFIRMATION MODAL PANEL */}
      <Modal
        isOpen={statusModalState.isOpen}
        onClose={() => {
          if (!statusModalState.loading) {
            setStatusModalState({ isOpen: false, group: null, loading: false });
          }
        }}
        title={statusModalState.group?.status === 'Active' ? 'Confirm Deactivation' : 'Confirm Activation'}
        maxWidth="max-w-md"
      >
        {statusModalState.group && (
          <div className="space-y-4 text-xs">
            {statusModalState.group.status === 'Active' ? (
              <div className="flex items-start space-x-3.5 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">Deactivate Brand Assignments?</h4>
                  <p className="text-slate-600 font-medium leading-relaxed">
                    Are you sure you want to deactivate <strong className="text-slate-900 font-bold">{statusModalState.group.assignmentTypeLabel}</strong> assignments for{' '}
                    <strong className="text-slate-900 font-bold">{statusModalState.group.employee?.name || 'Member'}</strong>
                    {statusModalState.group.brands.length > 0 && (
                      <> ({statusModalState.group.brands.length} assigned {statusModalState.group.brands.length === 1 ? 'brand' : 'brands'})</>
                    )}?
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-3.5 p-4 bg-teal-50/80 border border-teal-200/80 rounded-2xl">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <CheckCircle2 size={20} className="text-teal-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">Activate Brand Assignments?</h4>
                  <p className="text-slate-600 font-medium leading-relaxed">
                    Are you sure you want to activate <strong className="text-slate-900 font-bold">{statusModalState.group.assignmentTypeLabel}</strong> assignments for{' '}
                    <strong className="text-slate-900 font-bold">{statusModalState.group.employee?.name || 'Member'}</strong>
                    {statusModalState.group.brands.length > 0 && (
                      <> ({statusModalState.group.brands.length} assigned {statusModalState.group.brands.length === 1 ? 'brand' : 'brands'})</>
                    )}?
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusModalState({ isOpen: false, group: null, loading: false })}
                disabled={statusModalState.loading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleStatus}
                disabled={statusModalState.loading}
                className={`px-5 py-2 text-white rounded-xl font-bold transition text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer ${
                  statusModalState.group.status === 'Active'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                }`}
              >
                {statusModalState.loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>
                    {statusModalState.group.status === 'Active' ? 'Yes, Deactivate' : 'Yes, Activate'}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
