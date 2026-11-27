import React, { useEffect, useState } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, CheckCircle2, AlertCircle, Loader2, FolderTree } from 'lucide-react';
import { api } from '../services/api';
import { IDepartment } from '../types';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/PageLoader';
import { DataTable, DataTableColumn } from '../components/DataTable';

export const DepartmentManagementView: React.FC = () => {
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<IDepartment | null>(null);
  const [deletingDept, setDeletingDept] = useState<IDepartment | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<0 | 1>(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const itemsPerPage = 10;

  const fetchDepartments = async (page = currentPage) => {
    setLoading(true);
    try {
      const res = await api.get(`/departments/all?page=${page}&limit=${itemsPerPage}`);
      if (res.success && Array.isArray(res.data)) {
        setDepartments(res.data);
        if (res.pagination) {
          setServerTotalPages(res.pagination.totalPages || 1);
          setServerTotalItems(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch departments:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load departments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments(1);
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setStatus(0);
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (dept: IDepartment) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code || '');
    setDescription(dept.description || '');
    setStatus(dept.status === 1 || (dept.status as any) === 'Inactive' ? 1 : 0);
    setModalError(null);
    setShowModal(true);
  };

  const handleToggleStatus = async (dept: IDepartment) => {
    const currentIsActive = dept.status === 0 || (dept.status as any) === 'Active';
    const newStatus = currentIsActive ? 1 : 0;
    try {
      const res = await api.put(`/departments/${dept._id}`, { status: newStatus });
      if (res.success) {
        fetchDepartments();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update status' });
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setMessage(null);
    setModalError(null);

    try {
      let res;
      if (editingDept) {
        res = await api.put(`/departments/${editingDept._id}`, {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
          status
        });
      } else {
        res = await api.post('/departments', {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
          status
        });
      }

      if (res.success) {
        setMessage({
          type: 'success',
          text: `Department "${name.trim()}" ${editingDept ? 'updated' : 'created'} successfully!`
        });
        setShowModal(false);
        fetchDepartments();
      } else {
        setModalError(res.message || 'Failed to save department');
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!deletingDept) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await api.delete(`/departments/${deletingDept._id}`);
      if (res.success) {
        setMessage({ type: 'success', text: `Department "${deletingDept.name}" deleted successfully` });
        setDeletingDept(null);
        fetchDepartments();
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to delete department' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete department' });
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter((d) => {
    const q = searchTerm.toLowerCase().trim();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.code || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      d._id.toLowerCase().includes(q)
    );
  });

  const activeCount = departments.filter((d) => d.status === 0 || (d.status as any) === 'Active').length;
  const inactiveCount = departments.filter((d) => d.status === 1 || (d.status as any) === 'Inactive').length;

  // Table Columns Definition
  const columns: DataTableColumn<IDepartment>[] = [
    {
      key: 'sno',
      label: 'S.NO',
      sortable: true,
      width: 'w-16',
      align: 'center',
      render: (_, __, idx) => (
        <span className="font-extrabold text-slate-500 text-xs">{idx + 1}</span>
      ),
    },
    {
      key: 'name',
      label: 'DEPARTMENT NAME',
      sortable: true,
      render: (val) => (
        <span className="font-extrabold text-slate-900 text-xs">{val}</span>
      ),
    },
    {
      key: 'description',
      label: 'DESCRIPTION',
      sortable: true,
      render: (val) => val ? (
        <span className="text-slate-600 font-medium text-xs max-w-sm truncate inline-block" title={val}>
          {val}
        </span>
      ) : (
        <span className="text-slate-400 italic text-xs">No description</span>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      sortable: true,
      align: 'center',
      render: (val, row) => {
        const isActive = val === 0 || val === 'Active';
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isActive ? 'bg-teal-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={isActive}
            title={isActive ? 'Active (0) - Click to deactivate' : 'Inactive (1) - Click to activate'}
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
      key: 'createdAt',
      label: 'CREATED ON',
      sortable: true,
      render: (val, row) => {
        const dateVal = row.createdAt || (row as any).updatedAt;
        if (!dateVal) return <span className="text-slate-400 text-xs">—</span>;
        const d = new Date(dateVal);
        return (
          <span className="text-slate-700 font-semibold text-xs">
            {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'ACTION',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition cursor-pointer shadow-2xs"
            title="Edit Department"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => setDeletingDept(row)}
            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition cursor-pointer shadow-2xs"
            title="Delete Department"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageLoader message="Loading Dynamic Departments..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER BAR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100/90 text-purple-700 flex items-center justify-center font-bold shrink-0 border border-purple-200/60 shadow-xs">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Department Management
            </h2>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 btn-gradient-primary rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md cursor-pointer hover:opacity-95 transition-all"
        >
          <Plus size={18} />
          <span>Add Department</span>
        </button>
      </div>

      {/* COMPACT AUTO-DISMISS FLOATING TOAST NOTIFICATION */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-sm">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center justify-between space-x-3 text-xs font-bold transition-all ${
              message.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-rose-600 text-white border-rose-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-200 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white font-black text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Departments</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{departments.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <FolderTree size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Active Departments</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Inactive Departments</p>
            <p className="text-2xl font-black text-rose-500 mt-1">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-900 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* COMMON DATA TABLE WITH INTEGRATED PAGINATION */}
      <DataTable
        columns={columns}
        data={filteredDepartments}
        rowKey="_id"
        emptyMessage={
          searchTerm
            ? `No departments found matching "${searchTerm}".`
            : 'No department records found. Click "+ Add Department" to create one.'
        }
        currentPage={currentPage}
        totalPages={serverTotalPages}
        totalItems={serverTotalItems || filteredDepartments.length}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => {
          setCurrentPage(page);
          fetchDepartments(page);
        }}
      />

      {/* CREATE / EDIT DEPARTMENT MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDept ? `Edit Department: ${editingDept.name}` : 'Create New Department'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Influencer Marketing, Quality Control"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Department Short Code (Optional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. IM, CC, QC, MGMT"
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of department scope and team responsibilities..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:bg-white resize-none transition-all"
            />
          </div>

          {editingDept && (
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(Number(e.target.value) as 0 | 1)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:bg-white transition-all"
              >
                <option value={0}>Active (0)</option>
                <option value={1}>Inactive (1)</option>
              </select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingDept ? 'Update Department' : 'Create Department'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL PANEL */}
      <Modal
        isOpen={!!deletingDept}
        onClose={() => setDeletingDept(null)}
        title="Confirm Delete Department"
        maxWidth="max-w-md"
      >
        {deletingDept && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center space-x-3 p-3 bg-rose-50 border border-rose-100 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Are you sure?</h4>
                <p className="text-slate-600 font-medium mt-0.5">
                  Do you really want to delete <strong className="text-slate-900">"{deletingDept.name}"</strong>?
                </p>
              </div>
            </div>



            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingDept(null)}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDepartment}
                disabled={saving}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
