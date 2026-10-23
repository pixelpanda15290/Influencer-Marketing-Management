import React, { useEffect, useState } from 'react';
import { Users, Plus, Search, Mail, Eye, Edit2, Trash2, CheckCircle2, Phone, Briefcase, Calendar, Shield, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Employee, IDepartment } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { Pagination } from '../components/Pagination';
import { InlineLoader } from '../components/PageLoader';
import { DataTable, DataTableColumn } from '../components/DataTable';

export const EmployeeManagementView: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const itemsPerPage = 10;

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form fields for Create & Edit
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Influencer Marketing');
  const [designation, setDesignation] = useState('Influencer Executive');
  const [role, setRole] = useState('Employee');
  const [password, setPassword] = useState('User@123');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);

  const DEFAULT_ROLES = [
    'Employee',
    'Posting & Content Executive',
    'Barter Collab Executive',
    'Paid Collab Executive',
    'Team Leader',
    'Assistant Manager',
    'Assistant Marketing Manager',
    'Marketing Manager',
    'Admin'
  ];

  const availableRoleNames = Array.from(new Set([
    ...DEFAULT_ROLES,
    ...rolesList.map((r: any) => r.name)
  ]));

  const fetchEmployees = async (page = currentPage) => {
    try {
      const res = await api.get(`/employees?page=${page}&limit=${itemsPerPage}`);
      if (res.success) {
        setEmployees(res.data);
        if (res.pagination) {
          setServerTotalPages(res.pagination.totalPages || 1);
          setServerTotalItems(res.pagination.total || 0);
        }
      }
      
      const pRes = await api.get('/employees/pending-approvals');
      if (pRes.success) setPendingEmployees(pRes.data);

      const dRes = await api.get('/departments');
      if (dRes.success && Array.isArray(dRes.data)) {
        setDepartmentsList(dRes.data);
        if (dRes.data.length > 0 && !department) {
          setDepartment(dRes.data[0]._id);
        }
      }

      const rRes = await api.get('/roles');
      if (rRes.success && Array.isArray(rRes.data)) {
        setRolesList(rRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleApproveSignup = async (emp: Employee) => {
    setApprovingId(emp._id);
    try {
      const res = await api.put(`/employees/${emp._id}/approve`, {
        role: emp.role || 'Employee',
        designation: emp.designation || 'Influencer Executive',
        department: emp.department || 'Influencer Marketing'
      });
      if (res.success) {
        alert(`Account for ${emp.name} (${emp.email}) has been approved successfully!`);
        fetchEmployees();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve account');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.toLowerCase().trim().endsWith('@ad2ship.com')) {
      alert('Validation Error: Employee work email address must use the @ad2ship.com company domain.');
      return;
    }

    setSavingEmp(true);
    try {
      const res = await api.post('/employees', {
        name, email: email.toLowerCase().trim(), phone, department, designation, role, password
      });
      if (res.success) {
        setShowAddModal(false);
        fetchEmployees();
        setName(''); setEmail(''); setPhone(''); setPassword('User@123');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create employee');
    } finally {
      setSavingEmp(false);
    }
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setDepartment(typeof emp.department === 'object' && emp.department ? emp.department._id : (emp.department || ''));
    setDesignation(emp.designation || 'Influencer Executive');
    setRole(emp.role || 'Employee');
    setStatus(emp.status as any || 'Active');
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setSavingEmp(true);
    try {
      const res = await api.put(`/employees/${editingEmployee._id}`, {
        name, phone, department, designation, role, status
      });
      if (res.success) {
        setEditingEmployee(null);
        fetchEmployees();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update employee');
    } finally {
      setSavingEmp(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await api.put(`/employees/${emp._id}`, { status: newStatus });
      if (res.success) {
        setEmployees(prev =>
          prev.map(e => (e._id === emp._id ? { ...e, status: newStatus } : e))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
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

  const requestDeleteEmployee = (emp: Employee) => {
    setDeleteModalState({
      isOpen: true,
      itemName: `${emp.name} (${emp.employeeId || emp.email})`,
      loading: false,
      onConfirm: async () => {
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.delete(`/employees/${emp._id}`);
          if (res.success) {
            setDeleteModalState(prev => ({ ...prev, isOpen: false }));
            fetchEmployees();
          }
        } catch (err: any) {
          alert(err.message || 'Failed to delete employee');
        } finally {
          setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedEmployees = filteredEmployees;

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'name',
      label: 'Member',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center font-extrabold text-sm shadow shrink-0">
            {row.name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">{row.name}</div>
            <div className="text-[10px] text-purple-600 font-bold">{row.employeeId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <Mail size={12} className="text-slate-400" />
          <span className="font-medium">{val}</span>
        </div>
      ),
    },
    { key: 'designation', label: 'Designation', sortable: true },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (val) => typeof val === 'object' && val ? val.name : (val || 'Influencer Marketing')
    },
    {
      key: 'role',
      label: 'System Role',
      sortable: true,
      render: (val) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
          {val}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const isActive = val === 'Active';
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
      key: 'actions' as any,
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setViewingEmployee(row)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 transition cursor-pointer"
            title="View Details"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 transition cursor-pointer"
            title="Edit Employee"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => requestDeleteEmployee(row)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
            title="Delete Employee"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Members Directory</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Manage internal company staff, designations, and roles.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 btn-gradient-primary rounded-xl font-bold text-sm flex items-center space-x-2 self-start sm:self-auto shadow-md cursor-pointer"
        >
          <Plus size={18} />
          <span>Add Member</span>
        </button>
      </div>

      {/* PENDING SIGN-UP APPROVALS BANNER */}
      {pendingEmployees.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border border-amber-200/90 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>Pending Registration Requests</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                  {pendingEmployees.length} Awaiting Manager Approval
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-semibold hidden sm:block">
              Review and approve verified user email requests to grant dashboard access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingEmployees.map((pEmp) => (
              <div key={pEmp._id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                <div className="space-y-0.5 overflow-hidden">
                  <div className="font-extrabold text-xs text-slate-900 truncate">{pEmp.name}</div>
                  <div className="text-[11px] text-purple-700 font-bold truncate">{pEmp.email}</div>
                  <div className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    <span>Email Verified • Pending Manager Approval</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={approvingId === pEmp._id}
                  onClick={() => handleApproveSignup(pEmp)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold text-xs shadow-2xs shrink-0 flex items-center gap-1 transition disabled:opacity-50"
                >
                  {approvingId === pEmp._id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  <span>Approve</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl flex items-center space-x-3 border border-slate-200 shadow-xs">
        <Search size={16} className="text-purple-600 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, ID, or email..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="bg-transparent border-none text-sm text-slate-900 placeholder-slate-400 focus:outline-none w-full"
        />
        <span className="text-xs text-slate-400 font-medium shrink-0">{filteredEmployees.length} records</span>
      </div>

      {/* Data Table */}
      {loading ? (
        <InlineLoader message="Loading member list..." />
      ) : (
        <DataTable
          columns={columns}
          data={paginatedEmployees}
          rowKey="_id"
          emptyMessage="No members found matching your search."
          currentPage={currentPage}
          totalPages={serverTotalPages}
          totalItems={serverTotalItems || filteredEmployees.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            fetchEmployees(page);
          }}
        />
      )}

      {/* View Employee Details Modal */}
      <Modal
        isOpen={!!viewingEmployee}
        onClose={() => setViewingEmployee(null)}
        title="Member Information Details"
      >
        {viewingEmployee && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-lg border border-purple-200">
                  {viewingEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewingEmployee.name}</h3>
                  <p className="text-xs text-purple-700 font-bold">{viewingEmployee.employeeId}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                viewingEmployee.status === 'Active' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {viewingEmployee.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase">Work Email</label>
                <div className="font-bold text-slate-900 text-xs mt-0.5">{viewingEmployee.email}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase">Phone Number</label>
                <div className="font-bold text-slate-900 text-xs mt-0.5">{viewingEmployee.phone || 'N/A'}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase">Department</label>
                <div className="font-bold text-slate-900 text-xs mt-0.5">
                  {typeof viewingEmployee.department === 'object' && viewingEmployee.department ? viewingEmployee.department.name : (viewingEmployee.department || 'Influencer Marketing')}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase">Designation</label>
                <div className="font-bold text-slate-900 text-xs mt-0.5">{viewingEmployee.designation || 'Influencer Executive'}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">System Role</label>
                <div className="font-bold text-purple-700 text-xs mt-0.5">{viewingEmployee.role || 'Employee'}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={!!editingEmployee}
        onClose={() => setEditingEmployee(null)}
        title="Edit Member Account & Profile"
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Email (Read Only)</label>
            <input
              type="email"
              disabled
              value={email}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-bold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
              >
                {departmentsList.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
              >
                {availableRoleNames.map((roleName) => (
                  <option key={roleName} value={roleName}>{roleName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setEditingEmployee(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEmp}
              className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingEmp ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Member"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Roy"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ananya@ad2ship.com"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
              >
                {departmentsList.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
              >
                {availableRoleNames.map((roleName) => (
                  <option key={roleName} value={roleName}>{roleName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Default Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEmp}
              className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingEmp ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Member</span>
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
        title="Confirm Delete Employee"
        itemType="employee member"
        itemName={deleteModalState.itemName}
        warningMessage="Deleting this employee will deactivate their login access and brand assignments."
        loading={deleteModalState.loading}
      />
    </div>
  );
};
