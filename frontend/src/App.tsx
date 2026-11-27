import React, { useState, useEffect, useRef } from 'react';
import { User, TaskItem } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { TargetTopBanner } from './components/TargetTopBanner';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { TargetManagementView } from './views/TargetManagementView';
import { EmployeeManagementView } from './views/EmployeeManagementView';
import { BrandManagementView } from './views/BrandManagementView';
import { InfluencerManagementView } from './views/InfluencerManagementView';
import { EmployeeBrandAssignmentView } from './views/EmployeeBrandAssignmentView';
import { TaskManagementView } from './views/TaskManagementView';
import { DailyPostingView } from './views/DailyPostingView';
import { PostingCalendarView } from './views/PostingCalendarView';
import { ContentCalendarView } from './views/ContentCalendarView';
import { VerificationQueueView } from './views/VerificationQueueView';
import { EmployeePerformanceView } from './views/EmployeePerformanceView';
import { AuditLogView } from './views/AuditLogView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { DepartmentManagementView } from './views/DepartmentManagementView';
import { InfluencerDirectoryView } from './views/InfluencerDirectoryView';
import { ClientDashboardView } from './views/ClientDashboardView';
import { URLSubmissionModal } from './components/URLSubmissionModal';
import { PendingApprovalModal } from './components/PendingApprovalModal';

import { PublicCalendarShareView } from './views/PublicCalendarShareView';
import { PublicInfluencerFormView } from './views/PublicInfluencerFormView';
import { PublicBrandRequirementFormView } from './views/PublicBrandRequirementFormView';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetRefreshCount, setTargetRefreshCount] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalMsg, setSessionModalMsg] = useState('Your session has expired. Please sign in again.');
  const sessionModalShownRef = useRef(false);
  // Tracks whether a real authenticated session is active.
  // forceLogout is a no-op when this is false, so a 401 on the login page
  // (e.g. the initial checkAuth call when no session exists) never queues a modal.
  const isLoggedInRef = useRef(false);
  const logoutTriggerRef = useRef<(() => void) | null>(null);

  // Check if current hash is a public share route, e.g. #/share/token
  const getShareTokenFromHash = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#/share/') || hash.startsWith('#share/')) {
      return hash.replace('#/share/', '').replace('#share/', '');
    }
    return null;
  };

  // Check if current hash is a public influencer onboarding form route
  const isPublicApplyRoute = () => {
    const hash = (window.location.hash || '').toLowerCase();
    return hash.startsWith('#/apply') || hash.startsWith('#apply') || 
           hash.startsWith('#/collab') || hash.startsWith('#collab') ||
           hash.startsWith('#/join') || hash.startsWith('#join');
  };

  // Check if current hash is the Ad Buyers & Marketing Team brand product requirement form route
  const isPublicBrandRequirementRoute = () => {
    const hash = (window.location.hash || '').toLowerCase();
    return hash.startsWith('#/brand-requirement') || hash.startsWith('#brand-requirement') ||
           hash.startsWith('#/requirement') || hash.startsWith('#requirement') ||
           hash.startsWith('#/campaign-brief') || hash.startsWith('#campaign-brief');
  };

  const [shareToken, setShareToken] = useState<string | null>(getShareTokenFromHash);
  const [isPublicApply, setIsPublicApply] = useState<boolean>(isPublicApplyRoute);
  const [isPublicBrandReq, setIsPublicBrandReq] = useState<boolean>(isPublicBrandRequirementRoute);

  // Helper to read initial active view from browser URL hash
  const getViewFromHash = () => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    return hash || 'dashboard';
  };

  const [activeView, setActiveView] = useState<string>(getViewFromHash);
  const [submitUrlTask, setSubmitUrlTask] = useState<TaskItem | null>(null);
  const [taskRefreshCount, setTaskRefreshCount] = useState(0);

  // Ref to DashboardView's local task updater — called on URL submit so dashboard card updates instantly
  const dashboardTaskUpdaterRef = useRef<((taskId: string, url: string) => void) | null>(null);

  // Custom view navigator that updates browser URL bar
  const handleNavigate = (view: string) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
    window.scrollTo(0, 0);
  };

  // Scroll to top whenever active view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  // Sync state when browser back/forward buttons are clicked or URL changes directly
  useEffect(() => {
    const handleHashChange = () => {
      setShareToken(getShareTokenFromHash());
      setIsPublicApply(isPublicApplyRoute());
      setIsPublicBrandReq(isPublicBrandRequirementRoute());
      setActiveView(getViewFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Guard for Employee role accessing prohibited views (e.g., settings, system reports, department management)
  useEffect(() => {
    if (user && user.role === 'Employee' && (activeView === 'settings' || activeView === 'reports' || activeView === 'departments')) {
      handleNavigate('dashboard');
    }
  }, [user, activeView]);

  // If URL has a public share token, render public share view immediately (no login required)
  if (shareToken) {
    return <PublicCalendarShareView token={shareToken} />;
  }

  // If URL is public apply route, render public influencer application form immediately (no login required)
  if (isPublicApply) {
    return <PublicInfluencerFormView />;
  }

  // If URL is public brand requirement route (Ad Buyers & Marketing Team), render without login
  if (isPublicBrandReq) {
    return <PublicBrandRequirementFormView />;
  }

  const checkAuth = async () => {
    // 6-second fallback timeout so application never hangs on slow cold starts
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      const res = await api.get('/auth/me');
      if (res.success) {
        isLoggedInRef.current = true;  // Real session confirmed — enable forceLogout
        setUser(res.user);
      }
    } catch (err) {
      // Silently ignore — 401 here just means no active session on this device
      console.error('Session check:', err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // ─── Shared session-validity checker ────────────────────────────────────────
  const checkSessionValidity = async () => {
    try {
      const res = await api.get('/auth/me');
      if (!res.success) {
        forceLogout('Your session was ended because you logged in from another device.');
      }
    } catch (err: any) {
      if (err.httpStatus === 401 || err.httpStatus === 403) {
        forceLogout('Your session was ended because you logged in from another device.');
      }
    }
  };

  // ─── 1. Periodic poll every 15 seconds (background safety net) ──────────────
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSessionValidity, 15 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ─── 2. Instant check when user switches back to this tab/window ────────────
  // Browser timers are throttled in background tabs, so the 15s poll may be
  // delayed. This fires an immediate check the moment the tab becomes visible,
  // giving a ~1-second response time instead of waiting for the next poll tick.
  useEffect(() => {
    if (!user) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionValidity();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [user]);

  // ─── 3. Listen for global 'session:expired' event fired by api.ts ───────────
  // Handles 401s from any active API call (not just the poll).
  useEffect(() => {
    const onSessionExpired = () => {
      forceLogout('Your session has expired or was ended by another login. Please sign in again.');
    };
    window.addEventListener('session:expired', onSessionExpired);
    return () => window.removeEventListener('session:expired', onSessionExpired);
  }, []);

  /**
   * Shows the session-expired modal ON TOP of the current page.
   * GUARD: only runs when isLoggedInRef.current is true (real session active).
   * This prevents the modal from being queued by a 401 on the login page
   * (e.g. initial checkAuth when no session exists on this device).
   */
  const forceLogout = async (message: string) => {
    if (!isLoggedInRef.current) return;       // No active session — ignore silently
    if (sessionModalShownRef.current) return; // Already showing — avoid duplicates
    sessionModalShownRef.current = true;
    isLoggedInRef.current = false;            // Prevent re-entry
    try {
      await api.post('/auth/logout', {});
    } catch (_) { /* best-effort */ }
    setSessionModalMsg(message);
    setShowSessionModal(true);
  };

  /** Called when user clicks "Sign In Again" inside the session-expired modal */
  const handleSessionModalConfirm = () => {
    setShowSessionModal(false);
    sessionModalShownRef.current = false;
    isLoggedInRef.current = false;
    setUser(null);
    window.location.hash = '';
  };

  const handleLoginSuccess = (userData: User, _token: string) => {
    // Clear any stale modal state that may have been set before login
    setShowSessionModal(false);
    sessionModalShownRef.current = false;
    isLoggedInRef.current = true;  // Real session now active
    setUser(userData);
    handleNavigate('dashboard');
  };

  const handleLogout = async () => {
    isLoggedInRef.current = false;
    try {
      await api.post('/auth/logout', {});  // Clears HttpOnly cookie server-side
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      window.location.hash = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col selection:bg-purple-500 selection:text-white">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onRequestLogout={(trigger) => { logoutTriggerRef.current = trigger; }}
        activeView={activeView}
        setActiveView={handleNavigate}
        onUpdateUser={(updatedUser) => setUser(updatedUser)}
      />

      {/* Target Module Top System Banner */}
      <TargetTopBanner
        user={user}
        onNavigateToTargets={() => handleNavigate('targets')}
        refreshTrigger={targetRefreshCount}
      />

      {/* Automatic Manager Approval Popup Modal */}
      <PendingApprovalModal currentUser={user} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          user={user}
          activeView={activeView}
          setActiveView={handleNavigate}
          onLogout={() => {
            if (logoutTriggerRef.current) logoutTriggerRef.current();
            else handleLogout();
          }}
        />

        <main className="flex-1 p-4 overflow-y-auto w-full">
          {activeView === 'dashboard' && (
            user.role === 'Client' ? (
              <ClientDashboardView user={user} />
            ) : (
              <DashboardView
                user={user}
                onNavigate={handleNavigate}
                onOpenSubmitUrlModal={(task) => setSubmitUrlTask(task)}
                onRegisterTaskUpdater={(fn) => { dashboardTaskUpdaterRef.current = fn; }}
              />
            )
          )}

          {activeView === 'targets' && (
            <InfluencerManagementView
              userRole={user.role}
              currentUser={user}
              initialTab="targets"
              onTargetUpdated={() => setTargetRefreshCount(prev => prev + 1)}
            />
          )}

          {activeView === 'employees' && <EmployeeManagementView />}
          {activeView === 'brands' && <BrandManagementView userRole={user.role} />}
          {activeView === 'influencers' && (
            <InfluencerManagementView
              userRole={user.role}
              currentUser={user}
              initialTab="paid"
              onTargetUpdated={() => setTargetRefreshCount(prev => prev + 1)}
            />
          )}
          {activeView === 'influencers-directory' && (
            <InfluencerDirectoryView
              userRole={user.role}
              currentUser={user}
              initialTab="directory"
            />
          )}
          {activeView === 'influencer-applications' && (
            <InfluencerDirectoryView
              userRole={user.role}
              currentUser={user}
              initialTab="applications"
            />
          )}
          {activeView === 'brand-requirements' && (
            <InfluencerDirectoryView
              userRole={user.role}
              currentUser={user}
              initialTab="requirements"
            />
          )}
          {activeView === 'employee-brands' && (
            user.role === 'Employee' ? (
              <BrandManagementView userRole={user.role} />
            ) : (
              <EmployeeBrandAssignmentView userRole={user.role} currentUser={user} />
            )
          )}
          {activeView === 'tasks' && (
            <TaskManagementView
              currentUser={user}
              refreshTrigger={taskRefreshCount}
              onOpenSubmitUrlModal={(task) => setSubmitUrlTask(task)}
            />
          )}

          {activeView === 'daily-posting' && (
            <DailyPostingView currentUser={user} refreshTrigger={taskRefreshCount} />
          )}

          {activeView === 'calendar' && <PostingCalendarView currentUser={user} />}
          {activeView === 'content-calendar' && <ContentCalendarView currentUser={user} />}
          {activeView === 'verification' && (
            <TaskManagementView
              currentUser={user}
              refreshTrigger={taskRefreshCount}
              onOpenSubmitUrlModal={(task) => setSubmitUrlTask(task)}
            />
          )}
          {activeView === 'departments' && <DepartmentManagementView />}
          {activeView === 'performance' && <EmployeePerformanceView currentUser={user} />}
          {activeView === 'reports' && <ReportsView userRole={user.role} currentUser={user} />}
          {activeView === 'audit-logs' && <AuditLogView />}
          {activeView === 'settings' && <SettingsView userRole={user.role} currentUser={user} />}
        </main>
      </div>

      {/* URL Submission Modal */}
      {submitUrlTask && (
        <URLSubmissionModal
          task={submitUrlTask}
          onClose={() => setSubmitUrlTask(null)}
          onSuccess={(taskId, submittedUrl) => {
            setTaskRefreshCount(prev => prev + 1);
            // Update dashboard task card instantly without full reload
            if (dashboardTaskUpdaterRef.current) {
              dashboardTaskUpdaterRef.current(taskId, submittedUrl);
            }
          }}
        />
      )}

      {/* ── Session Expired Modal ─────────────────────────────────────────── */}
      {showSessionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '40px 36px 32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 25px 60px -10px rgba(79, 70, 229, 0.35), 0 0 0 1px rgba(124,58,237,0.08)',
              textAlign: 'center',
              animation: 'modalSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)'
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 32
              }}
            >
              🔒
            </div>

            <h2
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: 10,
                letterSpacing: '-0.02em'
              }}
            >
              Session Expired
            </h2>

            <p
              style={{
                fontSize: '14px',
                color: '#64748b',
                lineHeight: 1.6,
                marginBottom: 28
              }}
            >
              {sessionModalMsg}
            </p>

            <button
              onClick={handleSessionModalConfirm}
              style={{
                width: '100%',
                padding: '13px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.01em',
                boxShadow: '0 4px 15px -2px rgba(124,58,237,0.4)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              Sign In Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
