import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Shield, Sliders, Plus, Edit2, Users, CheckCircle2, UserCheck, Lock, Sparkles, Check, AlertCircle, Loader2, Trash2, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { SystemRole, Employee, IDepartment } from '../types';
import { Modal } from '../components/Modal';
import { InlineLoader } from '../components/PageLoader';

// Available permission catalog grouped by module
const PERMISSION_GROUPS: { moduleName: string; icon: string; permissions: { code: string; label: string }[] }[] = [
  {
    moduleName: 'Member Management',
    icon: '👥',
    permissions: [
      { code: 'employee.view', label: 'View Member Directory & Details' },
      { code: 'employee.create', label: 'Create New Member Profiles' },
      { code: 'employee.update', label: 'Edit Member Roles & Info' },
      { code: 'employee.delete', label: 'Deactivate / Delete Member Accounts' }
    ]
  },
  {
    moduleName: 'Brand Portfolio',
    icon: '💼',
    permissions: [
      { code: 'brand.view', label: 'View Brand Directory' },
      { code: 'brand.create', label: 'Add New Brands' },
      { code: 'brand.update', label: 'Edit Brand Details & Contacts' },
      { code: 'brand.delete', label: 'Delete Brands' },
      { code: 'brand.assign', label: 'Assign Members to Brands' }
    ]
  },
  {
    moduleName: 'Daily Postings & Calendar',
    icon: '⏰',
    permissions: [
      { code: 'posting.view', label: 'View Daily Postings & Calendar' },
      { code: 'posting.create', label: 'Log Daily Content Submissions' },
      { code: 'posting.update', label: 'Update Posting URLs & Statuses' }
    ]
  },
  {
    moduleName: 'Influencer - Barter Collaborations',
    icon: '📦',
    permissions: [
      { code: 'influencer.barter.view', label: 'View Barter Collaborations Tab & Records' },
      { code: 'influencer.barter.create', label: 'Create & Onboard Barter Creators' },
      { code: 'influencer.barter.update', label: 'Update Barter Parcel & Deliverable Statuses' },
      { code: 'influencer.barter.delete', label: 'Delete Barter Records' },
      { code: 'target.barter.view', label: 'View Barter Count Targets & Goals' }
    ]
  },
  {
    moduleName: 'Influencer - Paid Collaborations',
    icon: '💰',
    permissions: [
      { code: 'influencer.paid.view', label: 'View Paid Collaborations Tab & Records' },
      { code: 'influencer.paid.create', label: 'Create & Onboard Paid Creators' },
      { code: 'influencer.paid.update', label: 'Update Paid Commercials, Deliverables & Costs' },
      { code: 'influencer.paid.delete', label: 'Delete Paid Records' },
      { code: 'target.paid.view', label: 'View Paid Revenue & Margin Targets' }
    ]
  },
  {
    moduleName: 'Influencer - Payment Logs & Financial Audits',
    icon: '🧾',
    permissions: [
      { code: 'influencer.payment.view', label: 'Access Payment In/Out Audit Logs & Ledger' }
    ]
  },
  {
    moduleName: 'Targets & Goals Module',
    icon: '🎯',
    permissions: [
      { code: 'target.view', label: 'View Targets & Performance Slabs' },
      { code: 'target.create', label: 'Create Monthly Team & Individual Targets' },
      { code: 'target.update', label: 'Update Target Metrics & Deadlines' },
      { code: 'target.delete', label: 'Archive / Delete Targets' }
    ]
  },
  {
    moduleName: 'Tasks & Content',
    icon: '✍️',
    permissions: [
      { code: 'task.view', label: 'View Content Tasks' },
      { code: 'task.create', label: 'Create & Schedule Tasks' },
      { code: 'task.update', label: 'Edit & Reassign Tasks' },
      { code: 'task.delete', label: 'Delete Tasks' },
      { code: 'task.verify', label: 'Approve & Verify Submitted Content' }
    ]
  },
  {
    moduleName: 'Analytics & Reports',
    icon: '📊',
    permissions: [
      { code: 'performance.view', label: 'View Team Performance Analytics' },
      { code: 'report.view', label: 'View Operational Reports' },
      { code: 'report.export', label: 'Export Reports (CSV / Data)' }
    ]
  },
  {
    moduleName: 'System Administration & Audits',
    icon: '⚙️',
    permissions: [
      { code: 'settings.view', label: 'View System Settings' },
      { code: 'settings.update', label: 'Configure Lookup Values & Roles' },
    ]
  }
];

interface SettingsViewProps {
  userRole?: string;
  currentUser?: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userRole, currentUser }) => {
  const isAssistant = userRole === 'Assistant Manager' || userRole === 'Assistant Marketing Manager' || (!!userRole && userRole.toLowerCase().includes('assistant'));
  const isManagerOrAdmin = userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Marketing Manager' || userRole === 'Manager' || isAssistant || userRole === 'Team Leader';
  const [activeTab, setActiveTab] = useState<'roles' | 'config' | 'delegation'>(isManagerOrAdmin ? 'roles' : 'config');
  const [settings, setSettings] = useState<any>({});
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Role Modal State
  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [roleDescription, setRoleDescription] = useState('');

  // Create Role Modal State
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, rRes, eRes] = await Promise.all([
        api.get('/settings'),
        api.get('/roles'),
        api.get('/employees')
      ]);
      if (sRes.success) setSettings(sRes.data);
      if (rRes.success) setRoles(rRes.data);
      if (eRes.success) setEmployees(eRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditRoleModal = (role: SystemRole) => {
    setSelectedRole(role);
    setEditingPermissions([...role.permissions]);
    setRoleDescription(role.description || '');
  };

  const togglePermission = (code: string) => {
    if (editingPermissions.includes(code)) {
      setEditingPermissions(editingPermissions.filter(p => p !== code));
    } else {
      setEditingPermissions([...editingPermissions, code]);
    }
  };

  const toggleNewRolePermission = (code: string) => {
    if (newRolePermissions.includes(code)) {
      setNewRolePermissions(newRolePermissions.filter(p => p !== code));
    } else {
      setNewRolePermissions([...newRolePermissions, code]);
    }
  };

  const handleSelectAllGroup = (groupPermissions: { code: string }[]) => {
    const groupCodes = groupPermissions.map(p => p.code);
    const allSelected = groupCodes.every(code => editingPermissions.includes(code));

    if (allSelected) {
      setEditingPermissions(editingPermissions.filter(p => !groupCodes.includes(p)));
    } else {
      const merged = Array.from(new Set([...editingPermissions, ...groupCodes]));
      setEditingPermissions(merged);
    }
  };

  const handleSaveRolePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setSaving(true);
    setMessage(null);

    try {
      const targetId = selectedRole._id || selectedRole.name;
      const res = await api.put(`/roles/${targetId}`, {
        description: roleDescription,
        permissions: editingPermissions
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Role "${selectedRole.name}" permissions updated successfully!` });
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to update role permissions' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update role permissions' });
    } finally {
      setSaving(false);
      setSelectedRole(null);
      fetchData();
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await api.post('/roles', {
        name: newRoleName,
        description: newRoleDescription,
        permissions: newRolePermissions
      });

      if (res.success) {
        setMessage({ type: 'success', text: `New Role "${newRoleName}" created successfully!` });
        setShowCreateRoleModal(false);
        setNewRoleName('');
        setNewRoleDescription('');
        setNewRolePermissions([]);
        fetchData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create role' });
    } finally {
      setSaving(false);
    }
  };



  const handleUpdateEmployeeRole = async (empId: string, newRole: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.put(`/employees/${empId}`, { role: newRole });
      if (res.success) {
        setMessage({ type: 'success', text: `Employee role updated to "${newRole}" and synced to DB!` });
        fetchData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update employee role' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <SettingsIcon size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Hierarchical role delegation and dynamic permission configuration.
            </p>
          </div>
        </div>

        {isManagerOrAdmin && (
          <button
            onClick={() => setShowCreateRoleModal(true)}
            className="px-4 py-2.5 btn-gradient-primary text-white rounded-xl font-bold text-xs flex items-center space-x-2 shadow-md shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Custom Role</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex flex-wrap text-xs font-extrabold w-full sm:w-auto self-start">
        {isManagerOrAdmin && (
          <>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-5 py-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-white text-purple-700 shadow-xs border border-slate-200/60 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Roles & Permissions Matrix
            </button>
            <button
              onClick={() => setActiveTab('delegation')}
              className={`px-5 py-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'delegation'
                  ? 'bg-white text-purple-700 shadow-xs border border-slate-200/60 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              User Role Delegation ({employees.length})
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('config')}
          className={`px-5 py-2.5 rounded-xl transition cursor-pointer ${
            activeTab === 'config'
              ? 'bg-white text-purple-700 shadow-xs border border-slate-200/60 font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          System Config Lookup Values
        </button>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-2xl border text-xs font-bold animate-fade-in flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <InlineLoader message="Loading Roles & Permissions module..." />
      ) : (
        <>
          {/* TAB 1: ROLES & PERMISSIONS MATRIX */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {roles.map((r) => (
                <div
                  key={r._id}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-200 transition"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {r.isSystemRole ? 'System Role' : 'Custom Role'}
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-2">{r.name}</h3>
                      </div>

                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        {r.permissions.length} Perms
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2.5 font-medium leading-relaxed">
                      {r.description || 'No description configured for this role.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">
                      Scope: {r.name === 'Super Admin' ? 'All Permissions' : 'Delegated Access'}
                    </span>

                    <button
                      onClick={() => openEditRoleModal(r)}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Edit2 size={13} />
                      <span>Edit Permissions</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: USER ROLE DELEGATION TABLE */}
          {activeTab === 'delegation' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">User Role Assignment Matrix</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Delegate system access roles (Super Admin, Manager, Team Lead, Employee) to members</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Member</th>
                      <th className="px-6 py-3.5">Department</th>
                      <th className="px-6 py-3.5">Designation</th>
                      <th className="px-6 py-3.5">Current Role</th>
                      <th className="px-6 py-3.5 text-right">Delegate New Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {employees.map((emp) => (
                      <tr key={emp._id} className="hover:bg-purple-50/40 transition">
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-900 text-sm">{emp.name}</div>
                          <div className="text-slate-500 font-semibold text-[11px]">{emp.email} • {emp.employeeId}</div>
                        </td>

                        <td className="px-6 py-4 text-slate-800 font-bold">
                          {typeof emp.department === 'object' && emp.department 
                            ? emp.department.name 
                            : (typeof emp.department === 'string' && /^[a-f\d]{24}$/i.test(emp.department) 
                              ? 'Influencer Marketing' 
                              : (emp.department || 'N/A'))}
                        </td>

                        <td className="px-6 py-4 text-slate-700 font-semibold">
                          {emp.designation}
                        </td>

                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            {emp.role}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <select
                            value={emp.role}
                            onChange={(e) => handleUpdateEmployeeRole(emp._id, e.target.value)}
                            disabled={saving}
                            className="bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-extrabold focus:outline-none cursor-pointer"
                          >
                            {roles.map((r) => (
                              <option key={r._id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM LOOKUP VALUES */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders size={18} className="text-purple-600" />
                  Social Media Platforms
                </h3>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {settings.platforms?.map((p: string) => (
                    <span key={p} className="px-3 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders size={18} className="text-purple-600" />
                  Supported Content Types
                </h3>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {settings.contentTypes?.map((c: string) => (
                    <span key={c} className="px-3 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* EDIT ROLE PERMISSIONS MODAL */}
      <Modal
        isOpen={!!selectedRole}
        onClose={() => setSelectedRole(null)}
        title={selectedRole ? `Configure Permissions: ${selectedRole.name}` : 'Edit Role'}
        maxWidth="max-w-3xl"
      >
        {selectedRole && (
          <form onSubmit={handleSaveRolePermissions} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Role Description</label>
              <input
                type="text"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Description of role responsibilities..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span>Select Granular System Permissions ({editingPermissions.length} Enabled)</span>
              </div>

              {PERMISSION_GROUPS.map((group) => {
                const groupCodes = group.permissions.map(p => p.code);
                const allSelected = groupCodes.every(code => editingPermissions.includes(code));

                return (
                  <div key={group.moduleName} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <span>{group.icon}</span>
                        <span>{group.moduleName}</span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => handleSelectAllGroup(group.permissions)}
                        className="text-[11px] font-extrabold text-purple-700 hover:text-purple-900"
                      >
                        {allSelected ? 'Clear Group' : 'Select All Group'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.permissions.map((p) => {
                        const isChecked = editingPermissions.includes(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`p-2.5 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition ${
                              isChecked ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(p.code)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300 cursor-pointer"
                            />
                            <span className="text-xs">{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Role Permissions</span>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* CREATE NEW CUSTOM ROLE MODAL */}
      <Modal
        isOpen={showCreateRoleModal}
        onClose={() => setShowCreateRoleModal(false)}
        title="Create New Custom System Role"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Role Title</label>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Senior Content Team Lead"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Role Description</label>
            <input
              type="text"
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              placeholder="Responsibilities and delegated authority scope..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            <div className="font-extrabold text-slate-800 uppercase">Select Initial Permissions ({newRolePermissions.length})</div>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.moduleName} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-extrabold text-slate-900">{group.icon} {group.moduleName}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {group.permissions.map((p) => {
                    const isChecked = newRolePermissions.includes(p.code);
                    return (
                      <label key={p.code} className="flex items-center space-x-2 text-xs cursor-pointer p-1.5 bg-white rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleNewRolePermission(p.code)}
                          className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300"
                        />
                        <span className="font-medium text-slate-800">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateRoleModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 btn-gradient-primary text-white rounded-xl font-bold transition text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating Role...</span>
                </>
              ) : (
                <span>Create Role in DB</span>
              )}
            </button>
          </div>
        </form>
      </Modal>


    </div>
  );
};
