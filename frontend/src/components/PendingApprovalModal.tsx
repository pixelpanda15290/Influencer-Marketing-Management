import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, Shield, User, Mail, Phone, Briefcase, Loader2, X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';

interface PendingApprovalModalProps {
  currentUser: UserType | null;
}

export const PendingApprovalModal: React.FC<PendingApprovalModalProps> = ({ currentUser }) => {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<{ [key: string]: string }>({});

  const isManager = currentUser && (
    currentUser.role === 'Super Admin' ||
    currentUser.role === 'Admin' ||
    currentUser.role === 'Marketing Manager' ||
    currentUser.role === 'Assistant Manager' ||
    currentUser.role === 'Assistant Marketing Manager' ||
    (currentUser.role && currentUser.role.toLowerCase().includes('assistant'))
  );

  const fetchPendingApprovals = async () => {
    if (!isManager) return;
    try {
      const res = await api.get('/employees/pending-approvals');
      if (res.success && res.data && res.data.length > 0) {
        setPendingUsers(res.data);
        setIsOpen(true);

        // Initialize default roles
        const initialRoles: { [key: string]: string } = {};
        res.data.forEach((emp: any) => {
          initialRoles[emp._id] = emp.role || 'Employee';
        });
        setSelectedRoles(initialRoles);
      } else {
        setPendingUsers([]);
      }
    } catch (err) {
      console.error('Error fetching pending approvals for modal:', err);
    }
  };

  useEffect(() => {
    if (isManager) {
      fetchPendingApprovals();
      // Poll every 15 seconds for new registrations
      const interval = setInterval(fetchPendingApprovals, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  if (!isOpen || pendingUsers.length === 0 || !isManager) return null;

  const handleApprove = async (emp: any) => {
    const roleToAssign = selectedRoles[emp._id] || 'Employee';
    setApprovingId(emp._id);

    try {
      const res = await api.put(`/employees/${emp._id}/approve`, {
        role: roleToAssign,
        designation: emp.designation || 'Influencer Executive',
        department: emp.department || 'Influencer Marketing'
      });

      if (res.success) {
        const remaining = pendingUsers.filter(u => u._id !== emp._id);
        setPendingUsers(remaining);
        if (remaining.length === 0) {
          setIsOpen(false);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve account');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden relative space-y-0">
        
        {/* POPUP HEADER - LIGHT & ELEGANT */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-pink-50/50 border-b border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-100/90 text-purple-600 flex items-center justify-center shadow-xs border border-purple-200/60">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Account Registration Approval Required
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-700 border border-purple-200/80">
                  {pendingUsers.length} Pending
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Review and approve new team members to grant dashboard access.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200/80 flex items-center justify-center transition shadow-2xs cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* PENDING USERS LIST */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50/30">
          {pendingUsers.map((emp) => (
            <div
              key={emp._id}
              className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-purple-200/80 hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <h3 className="font-extrabold text-sm text-slate-900 truncate">{emp.name}</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail size={13} className="text-purple-500 shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{emp.email}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone size={13} className="text-purple-500 shrink-0" />
                        <span className="text-slate-600">{emp.phone}</span>
                      </div>
                    )}
                    {emp.department && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Briefcase size={13} className="text-purple-500 shrink-0" />
                        <span className="text-slate-600">
                          {typeof emp.department === 'object' && emp.department 
                            ? emp.department.name 
                            : (typeof emp.department === 'string' && /^[a-f\d]{24}$/i.test(emp.department) 
                              ? 'Influencer Marketing' 
                              : emp.department)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ROLE SELECTOR & APPROVE BUTTON */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <select
                    value={selectedRoles[emp._id] || 'Employee'}
                    onChange={(e) => setSelectedRoles({ ...selectedRoles, [emp._id]: e.target.value })}
                    className="bg-slate-50 hover:bg-white border border-slate-300/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 cursor-pointer shadow-2xs transition"
                  >
                    <option value="Employee">Role: Employee</option>
                    <option value="Assistant Marketing Manager">Role: Assistant Manager</option>
                    <option value="Marketing Manager">Role: Marketing Manager</option>
                    <option value="Admin">Role: Admin</option>
                  </select>

                  <button
                    type="button"
                    disabled={approvingId === emp._id}
                    onClick={() => handleApprove(emp)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-extrabold text-xs shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    {approvingId === emp._id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/70 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium flex items-center gap-1.5">
            <AlertCircle size={14} className="text-purple-500 shrink-0" />
            <span className="text-[11px] text-slate-500">Approved users receive immediate dashboard access according to their role.</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
};
