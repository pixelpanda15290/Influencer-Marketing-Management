import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Briefcase, UserCheck, Calendar,
  CheckSquare, CheckCircle, BarChart3, FileSpreadsheet, ShieldAlert,
  Settings, Clock, Target, Sparkles, ChevronDown, ChevronRight, Layers, Building2, LogOut
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  user: User | null;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout?: () => void;
}

interface SubMenuItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: any;
  subItems: SubMenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setActiveView, onLogout }) => {
  const isManagerOrAdmin = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'Marketing Manager' || user?.role === 'Assistant Manager' || user?.role === 'Assistant Marketing Manager' || user?.role === 'Team Leader';
  const isEmployee = !isManagerOrAdmin && user?.role !== 'Client';
  const isClient = user?.role === 'Client';

  const userPerms = user?.permissions || [];
  const isPostingExec = user?.role === 'Posting & Content Executive';
  const isBarterExec = user?.role === 'Barter Collab Executive';
  const isPaidExec = user?.role === 'Paid Collab Executive';

  // Determine module visibility
  const canAccessInfluencers = isManagerOrAdmin || isBarterExec || isPaidExec || user?.role === 'Employee' || userPerms.includes('influencer.view') || userPerms.includes('influencer.paid.view') || userPerms.includes('influencer.barter.view');
  const canAccessPostings = isManagerOrAdmin || isPostingExec || user?.role === 'Employee' || userPerms.includes('posting.view');

  if (isClient) {
    return (
      <aside className="w-64 bg-white/90 border-r border-slate-200/80 flex flex-col shrink-0 h-full p-4 space-y-2 backdrop-blur-xl overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-purple-600 flex items-center gap-1.5">
          <Sparkles size={13} /> Client Portal Modules
        </div>

        <nav className="space-y-2 flex-1 pt-1">
          <button
            onClick={() => { setActiveView('dashboard'); window.scrollTo(0, 0); }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'dashboard'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <LayoutDashboard size={18} className={`shrink-0 ${activeView === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Brand Overview & Feed</span>
            </div>
          </button>

          <button
            onClick={() => { setActiveView('content-calendar'); window.scrollTo(0, 0); }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'content-calendar'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <Calendar size={18} className={`shrink-0 ${activeView === 'content-calendar' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Content Calendar</span>
            </div>
          </button>

          <button
            onClick={() => { setActiveView('reports'); window.scrollTo(0, 0); }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'reports'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <FileSpreadsheet size={18} className={`shrink-0 ${activeView === 'reports' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Reports & Export</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl font-extrabold text-xs text-rose-600 bg-rose-50/70 hover:bg-rose-100/90 border border-rose-200/80 transition shadow-2xs cursor-pointer mt-auto"
            title="Logout of session"
          >
            <LogOut size={16} className="text-rose-600 shrink-0" />
            <span>Logout</span>
          </button>
        )}
      </aside>
    );
  }

  // Grouped Menu Definitions
  const menuGroups: MenuGroup[] = [
    ...(!isEmployee ? [{
      id: 'brand-management',
      label: 'Brand',
      icon: Briefcase,
      subItems: [
        { id: 'brands', label: 'Brand Portfolio', icon: Briefcase },
        { id: 'employee-brands', label: 'Brand Assignments', icon: UserCheck },
      ]
    }] : []),
    ...(canAccessPostings ? [{
      id: 'content-tasks',
      label: 'Tasks & Postings',
      icon: CheckSquare,
      subItems: [
        { id: 'calendar', label: 'Posting Calendar', icon: Calendar },
        { id: 'content-calendar', label: 'Content Calendar', icon: FileSpreadsheet },
      ]
    }] : []),
    ...(!isEmployee ? [{
      id: 'team-performance',
      label: 'Team & Performance',
      icon: Users,
      subItems: [
        { id: 'employees', label: 'Members Directory', icon: Users },
        { id: 'departments', label: 'Departments', icon: Building2 },
        { id: 'performance', label: 'Performance', icon: BarChart3 },
      ]
    }] : []),
    ...(!isEmployee ? [{
      id: 'system-reports',
      label: 'Reports & Settings',
      icon: Settings,
      subItems: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }] : [])
  ];

  // Track expanded groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    menuGroups.forEach(group => {
      if (group.subItems.some(sub => sub.id === activeView)) {
        initialState[group.id] = true;
      }
    });
    return initialState;
  });

  // Auto-expand parent group when activeView changes
  useEffect(() => {
    menuGroups.forEach(group => {
      if (group.subItems.some(sub => sub.id === activeView)) {
        setOpenGroups(prev => ({ ...prev, [group.id]: true }));
      }
    });
  }, [activeView]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  return (
    <aside className="w-64 bg-white/90 border-r border-slate-200/80 flex flex-col shrink-0 h-full p-4 space-y-1 backdrop-blur-xl overflow-y-auto">
      <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-purple-600 flex items-center gap-1.5">
        <Layers size={13} /> Navigation
      </div>

      <nav className="space-y-2 flex-1">
        {/* Single Standalone Item: Dashboard */}
        <button
          onClick={() => {
            setActiveView('dashboard');
            window.scrollTo(0, 0);
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
            activeView === 'dashboard'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
              : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <LayoutDashboard size={18} className={`shrink-0 ${activeView === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
            <span className="whitespace-nowrap truncate">Dashboard</span>
          </div>
        </button>

        {/* Single Standalone Item: Targets & Revenue */}
        {canAccessInfluencers && (
          <button
            onClick={() => {
              setActiveView('targets');
              window.scrollTo(0, 0);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'targets' || activeView === 'influencers'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <Target size={18} className={`shrink-0 ${activeView === 'targets' || activeView === 'influencers' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Targets & Revenue</span>
            </div>
          </button>
        )}

        {/* Single Standalone Item: Influencer Directory & Discovery */}
        {canAccessInfluencers && (
          <button
            onClick={() => {
              setActiveView('influencers-directory');
              window.scrollTo(0, 0);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'influencers-directory'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <Sparkles size={18} className={`shrink-0 ${activeView === 'influencers-directory' ? 'text-white' : 'text-purple-500'}`} />
              <span className="whitespace-nowrap truncate">Influencers</span>
            </div>
          </button>
        )}

        {/* Single Standalone Item for Employee: Brand */}
        {isEmployee && (
          <button
            onClick={() => {
              setActiveView('brands');
              window.scrollTo(0, 0);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'brands'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <Briefcase size={18} className={`shrink-0 ${activeView === 'brands' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Brand</span>
            </div>
          </button>
        )}

        {/* Single Standalone Item for Employee: Performance */}
        {isEmployee && (
          <button
            onClick={() => {
              setActiveView('performance');
              window.scrollTo(0, 0);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              activeView === 'performance'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <BarChart3 size={18} className={`shrink-0 ${activeView === 'performance' ? 'text-white' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap truncate">Performance</span>
            </div>
          </button>
        )}



        {/* Grouped Accordion Parent Modules */}
        {menuGroups.map((group) => {
          // If all subItems in this group are hidden for the user, skip rendering group
          if (group.subItems.length === 0) return null;

          const GroupIcon = group.icon;
          const isOpen = !!openGroups[group.id];
          const hasActiveChild = group.subItems.some(sub => sub.id === activeView);

          return (
            <div key={group.id} className="rounded-xl overflow-hidden border border-slate-100/80 bg-slate-50/40">
              {/* Group Header Button */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 font-bold text-xs uppercase tracking-wider transition-all duration-150 ${
                  hasActiveChild
                    ? 'text-purple-900 bg-purple-100/60 font-extrabold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <GroupIcon size={16} className={hasActiveChild ? 'text-purple-600' : 'text-slate-400'} />
                  <span className="truncate">{group.label}</span>
                </div>
                {isOpen ? (
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                )}
              </button>

              {/* Sub-Modules List */}
              {isOpen && (
                <div className="py-1 px-1.5 space-y-1 bg-white/70">
                  {group.subItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeView === sub.id;

                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveView(sub.id);
                          window.scrollTo(0, 0);
                        }}
                        className={`w-full flex items-center justify-between pl-4 pr-3 py-2 rounded-lg font-semibold text-xs transition-all duration-150 ${
                          isSubActive
                            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white shadow-sm shadow-purple-500/20 font-bold'
                            : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50/70'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <SubIcon size={15} className={`shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{sub.label}</span>
                        </div>
                        {sub.badge && (
                          <span
                            className={`shrink-0 text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md ml-1 ${
                              isSubActive
                                ? 'bg-white/20 text-white border border-white/30'
                                : 'bg-purple-100 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer info & Bottom-Left Logout Button */}
      <div className="pt-2 space-y-2 mt-auto">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-extrabold text-xs text-rose-600 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/90 transition shadow-2xs cursor-pointer"
            title="Logout of session"
          >
            <LogOut size={16} className="text-rose-600 shrink-0" />
            <span>Logout</span>
          </button>
        )}

        <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-500 border border-slate-200">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Influencer OPS v1.0
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Modular Navigation</p>
        </div>
      </div>
    </aside>
  );
};

