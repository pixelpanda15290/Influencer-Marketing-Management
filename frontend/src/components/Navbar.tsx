import React, { useState, useEffect } from 'react';
import { Bell, User, LogOut, CheckCircle2, Shield, Edit3, Briefcase, Phone, Mail, UserCheck, Save, Sparkles, ChevronDown } from 'lucide-react';
import { User as UserType, NotificationItem } from '../types';
import { api } from '../services/api';
import { Modal } from './Modal';

interface NavbarProps {
  user: UserType | null;
  onLogout: () => void;
  onRequestLogout?: (trigger: () => void) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  onUpdateUser?: (updatedUser: UserType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onRequestLogout, activeView, setActiveView, onUpdateUser }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Expose the logout confirmation trigger to parent (for Sidebar)
  useEffect(() => {
    if (onRequestLogout) {
      onRequestLogout(() => setShowLogoutConfirm(true));
    }
  }, [onRequestLogout]);

  const notificationRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileDesignation, setProfileDesignation] = useState('');
  const [assignedBrands, setAssignedBrands] = useState<any[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchNotifications = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const openProfileModal = async () => {
    if (!user) return;
    setProfileMessage(null);

    // Call GET /auth/me to fetch fresh logged in user profile data
    try {
      const res = await api.get('/auth/me');
      if (res.success && res.data) {
        const uData = res.data;
        setProfileName(uData.name || user.name || '');
        const empDetails = uData.employeeDetails || user.employeeDetails;
        setProfilePhone(empDetails?.phone || '+91 98765 43210');
        const deptVal = empDetails?.department;
        const deptName = typeof deptVal === 'object' && deptVal ? (deptVal as any).name : (deptVal || 'Influencer Marketing');
        setProfileDepartment(deptName);
        setProfileDesignation(empDetails?.designation || 'Influencer Executive');

        if (onUpdateUser) {
          onUpdateUser(uData);
        }
      } else {
        setProfileName(user.name || '');
        setProfilePhone(user.employeeDetails?.phone || '+91 98765 43210');
        const deptVal = user.employeeDetails?.department;
        const deptName = typeof deptVal === 'object' && deptVal ? (deptVal as any).name : (deptVal || 'Influencer Marketing');
        setProfileDepartment(deptName);
        setProfileDesignation(user.employeeDetails?.designation || 'Influencer Executive');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfileName(user.name || '');
      setProfilePhone(user.employeeDetails?.phone || '+91 98765 43210');
      const deptVal = user.employeeDetails?.department;
      const deptName = typeof deptVal === 'object' && deptVal ? (deptVal as any).name : (deptVal || 'Influencer Marketing');
      setProfileDepartment(deptName);
      setProfileDesignation(user.employeeDetails?.designation || 'Influencer Executive');
    }

    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const res = await api.put('/auth/profile', {
        name: profileName,
        phone: profilePhone,
        department: profileDepartment,
        designation: profileDesignation
      });

      if (res.success && res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        if (onUpdateUser) {
          onUpdateUser(res.user);
        }
        setShowProfileModal(false);
        setProfileMessage(null);
      } else {
        setProfileMessage({ type: 'error', text: res.message || 'Failed to update profile' });
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-20 px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3.5">
          <img
            src="/logo.png"
            alt="Ad2ship Logo"
            className="h-9 w-auto max-w-[140px] object-contain drop-shadow-xs"
          />
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="font-extrabold text-slate-900 text-base leading-none tracking-tight">
              AD2media
            </h1>
            <p className="text-[11px] text-purple-600 font-bold mt-0.5 tracking-wide">Enterprise Work Management System v1.0</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications Dropdown */}
          <div ref={notificationRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 transition relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white font-black text-xs rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-slate-200 text-sm z-50 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <span className="font-extrabold text-slate-900">Notifications ({unreadCount} unread)</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-purple-700 hover:text-purple-900 font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 size={12} /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-center text-slate-500 py-4 text-xs font-medium">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        className={`p-3 rounded-xl border text-xs ${!n.read ? 'bg-purple-50/60 border-purple-200 text-slate-900 font-medium' : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                      >
                        <div className="font-bold text-slate-900">{n.title}</div>
                        <p className="mt-1 leading-relaxed text-slate-700 font-medium">{n.message}</p>
                        <span className="text-[10px] text-slate-500 font-bold mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar Logo with Dropdown */}
          {user && (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowNotifications(false);
                }}
                className="flex items-center space-x-2 pl-1 pr-2.5 py-1 rounded-2xl bg-slate-100/90 hover:bg-purple-50/80 border border-slate-200 hover:border-purple-200 transition-all cursor-pointer group shadow-2xs"
                title="Account Menu"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center font-extrabold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2.5 w-60 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-2 border border-slate-200/90 text-xs z-50 animate-fade-in space-y-1">
                  {/* User Info Header */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
                    <div className="font-extrabold text-slate-900 text-xs truncate">{user.name}</div>
                    <div className="text-[11px] text-purple-700 font-bold flex items-center gap-1">
                      <Shield size={11} className="text-purple-600 shrink-0" />
                      <span className="truncate">
                        {user.role === 'Client'
                          ? `Client (${user.brandDetails?.brandName || 'Portal'})`
                          : (user.role && user.role !== 'Employee')
                            ? user.role
                            : (user.employeeDetails?.role && user.employeeDetails.role !== 'Employee')
                              ? user.employeeDetails.role
                              : (user.employeeDetails?.designation || user.role || 'Team Member')}
                      </span>
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="space-y-0.5 pt-1">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        openProfileModal();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl font-bold text-slate-700 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                    >
                      <User size={15} className="text-purple-600" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer border-t border-slate-100 mt-1 pt-2"
                    >
                      <LogOut size={15} className="text-rose-600" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* MY PROFILE MODAL */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="My Employee Profile & Account Details"
        maxWidth="max-w-2xl"
      >
        {user && (
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            {/* Header Badge Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-lg border border-purple-200 shadow-2xs">
                  {profileName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{profileName}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-semibold">
                    <span>Role: <strong className="text-slate-800 font-extrabold">{user.role && user.role !== 'Employee' ? user.role : (user.employeeDetails?.role && user.employeeDetails.role !== 'Employee' ? user.employeeDetails.role : (user.employeeDetails?.designation || user.role))}</strong></span>
                    <span>•</span>
                    <span>ID: <strong className="text-slate-800 font-extrabold">{user.employeeId || 'EMP-101'}</strong></span>
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl bg-purple-100/90 text-purple-900 text-xs font-black border border-purple-200">
                {user.role && user.role !== 'Employee' ? user.role : (user.employeeDetails?.role && user.employeeDetails.role !== 'Employee' ? user.employeeDetails.role : (user.employeeDetails?.designation || user.role || 'Active Employee'))}
              </span>
            </div>

            {profileMessage && (
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${profileMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                {profileMessage.type === 'success' ? <CheckCircle2 size={16} /> : <UserCheck size={16} />}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Work Email (Read Only) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Mail size={12} className="text-purple-600" /> Work Email (Read-Only)
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-slate-600 cursor-not-allowed"
                />
              </div>

              {/* Phone Number */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Phone size={12} className="text-purple-600" /> Contact Phone Number
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Department */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Department</label>
                <input
                  type="text"
                  value={profileDepartment}
                  onChange={(e) => setProfileDepartment(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Designation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Designation / Designation Title</label>
                <input
                  type="text"
                  value={profileDesignation}
                  onChange={(e) => setProfileDesignation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Assigned Brands Section (Only for Employee role) */}
            {user.role === 'Employee' && (
              <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 space-y-2">
                <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase size={14} className="text-purple-700" />
                  My Assigned Brand Portfolio ({assignedBrands.length > 0 ? assignedBrands.length : ''})
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedBrands.length > 0 ? (
                    assignedBrands.map((b: any) => (
                      <span key={b._id} className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 text-[11px] font-extrabold shadow-2xs">
                        {b.brandId?.brandName}
                      </span>
                    ))
                  ) : (
                    ['Kala Kurti', 'Vexo Trend', 'Fake Losser', 'Royal Design', 'Rivaayath House', 'KD Design', 'Walkin Wardrobe', 'Sanwarlyanghee', 'Suchira', 'House of Rashmi'].map((b) => (
                      <span key={b} className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 text-[11px] font-extrabold shadow-2xs">
                        {b}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2 btn-gradient-primary disabled:opacity-50 text-white rounded-xl font-bold transition text-xs shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Save size={15} />
                <span>{savingProfile ? 'Saving Profile...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Confirm Logout"
        maxWidth="max-w-sm"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
            <LogOut size={28} className="text-rose-500" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Are you sure you want to logout?</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">You will be redirected to the login page.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogoutConfirm(false);
                onLogout();
              }}
              className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold transition text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              Yes, Logout
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
