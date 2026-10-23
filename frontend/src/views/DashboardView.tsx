import React, { useEffect, useState } from 'react';
import {
  Users, Briefcase, Target, CheckCircle2, Clock, AlertTriangle,
  ArrowUpRight, ExternalLink, Calendar, Send, ShieldCheck,
  BarChart3, Trophy, Medal, TrendingUp, Award, Sparkles, Plus,
  Layers, ChevronRight, CheckSquare, Star, Pencil, Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { User, TaskItem, EmployeePerformanceData } from '../types';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { PageLoader } from '../components/PageLoader';

interface DashboardViewProps {
  user: User | null;
  onNavigate: (view: string) => void;
  onOpenSubmitUrlModal: (task: TaskItem) => void;
  onRegisterTaskUpdater?: (fn: (taskId: string, url: string) => void) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onNavigate, onOpenSubmitUrlModal, onRegisterTaskUpdater }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [perfData, setPerfData] = useState<EmployeePerformanceData[]>([]);
  const [perfPage, setPerfPage] = useState(1);
  const [perfTotal, setPerfTotal] = useState(0);
  const [perfTotalPages, setPerfTotalPages] = useState(1);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [localTasks, setLocalTasks] = useState<any[]>([]);
  const itemsPerPage = 6;
  const perfLimit = 10;

  const userRole = (user?.role || '').toLowerCase();
  const isManagerOrAdmin = userRole.includes('admin') || userRole.includes('manager');

  const fetchPerformance = async (page: number = 1) => {
    if (!isManagerOrAdmin) return;
    setLoadingPerf(true);
    try {
      const perfRes = await api.get(`/performance?page=${page}&limit=${perfLimit}`);
      if (perfRes.success) {
        setPerfData(perfRes.data || []);
        setPerfTotal(perfRes.total ?? (perfRes.data?.length || 0));
        setPerfTotalPages(perfRes.totalPages ?? 1);
        setPerfPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch performance leaderboard', err);
    } finally {
      setLoadingPerf(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // Fetch stats first
      const dashRes = await api.get('/dashboard/stats');
      if (dashRes.success) {
        setData(dashRes.data);
        setLocalTasks(dashRes.data?.todaysTasks || []);
      }

      // Fetch company performance leaderboard ONLY for Manager / Admin roles
      if (isManagerOrAdmin) {
        await fetchPerformance(1);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  // Called by parent after a URL is successfully submitted — update that task locally
  const handleUrlSubmitted = (taskId: string, submittedUrl: string) => {
    setLocalTasks(prev =>
      prev.map(t =>
        t._id === taskId
          ? { ...t, status: 'Submitted', publishedUrl: submittedUrl }
          : t
      )
    );
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Register the updater with the parent so URL submission from the modal triggers an instant update
  useEffect(() => {
    if (onRegisterTaskUpdater) {
      onRegisterTaskUpdater(handleUrlSubmitted);
    }
  }, [onRegisterTaskUpdater]);

  if (loading) return <PageLoader message="Loading operational dashboard..." />;

  const isEmployee = !isManagerOrAdmin;

  // Helper for brand avatars
  const getBrandAvatar = (name: string) => {
    const parts = (name || 'Brand').split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || 'BR').substring(0, 2).toUpperCase();
  };

  const getBrandBg = (idx: number) => {
    const colors = [
      'bg-purple-600 text-white',
      'bg-indigo-600 text-white',
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-pink-600 text-white',
      'bg-amber-600 text-white',
      'bg-violet-600 text-white'
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* Dynamic Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/80 text-purple-800 text-xs font-black mb-2 border border-purple-200">
            <Sparkles size={14} className="text-purple-600" />
            <span>{isEmployee ? (user?.role && user.role !== 'Employee' ? `${user.role} Portal` : 'Team Member Operations Portal') : 'Executive Overview'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome back, {user?.name || 'Vikram Sethi'}! 👋
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 max-w-2xl">
            {isEmployee
              ? 'Your daily content posting schedule, assigned brand portfolio, and operational task hub.'
              : 'Real-time Operations, Multi-Month Campaign Ledger & Team Performance Overview.'}
          </p>
        </div>

      </div>


      {/* Metric Summary Cards */}
      {isEmployee ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: My Assigned Brands */}
          <div
            onClick={() => onNavigate('brands')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>My Assigned Brands</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
                <Briefcase size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900">{data?.myBrands ? data.myBrands.length : 0}</div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-semibold">Active brand portfolio</span>
              <span className="text-purple-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                View <ChevronRight size={14} />
              </span>
            </div>
          </div>

          {/* Card 2: Active Target Goal */}
          <div
            onClick={() => onNavigate('targets')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Active Target Goal</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
                <Target size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 truncate">
              {data?.activeTarget?.targetType === 'Barter'
                ? `${data.activeTarget.targetCount || 120} Collabs`
                : 'Revenue Target'}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md">
                {data?.activeTarget
                  ? `${Math.min(100, Math.round(((data.activeTarget.achievedAmount || 0) / (user?.role === 'Employee' ? 120000 : (data.activeTarget.targetAmount || 720000))) * 100))}% Paid Colab Progress`
                  : 'Goal Active'}
              </span>
              <span className="text-slate-400 font-semibold">Monthly Goal</span>
            </div>
          </div>

          {/* Card 3: Today Completed */}
          <div
            onClick={() => onNavigate('daily-posting')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Today Completed</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-600">
              {data?.todaySummary?.completed || 0} / {data?.todaySummary?.total || 0}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-semibold">Verified submissions</span>
              <span className="text-emerald-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                Manage <ChevronRight size={14} />
              </span>
            </div>
          </div>

          {/* Card 4: Pending Submissions */}
          <div
            onClick={() => onNavigate('daily-posting')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Pending Submission</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
                <Clock size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-600">
              {data?.todaySummary?.pending || 0}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-semibold">Scheduled for today</span>
              <span className="text-amber-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                Submit <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigate('employees')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Active Employees</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
                <Users size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black text-slate-900">{data?.totalEmployees || 0}</div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-semibold">Company internal staff</span>
              <span className="text-purple-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                Manage <ChevronRight size={14} />
              </span>
            </div>
          </div>

          <div
            onClick={() => onNavigate('brands')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Total Brands</span>
              <Briefcase size={18} className="text-purple-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">{data?.totalBrands || 0}</div>
            <p className="text-xs text-slate-500 font-semibold mt-1">Active handled brands</p>
          </div>

          <div
            onClick={() => onNavigate('targets')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Active Target</span>
              <Target size={18} className="text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 truncate">
              {data?.activeTarget ? `₹${Number(data.activeTarget.targetAmount).toLocaleString()}` : '₹0'}
            </div>
            <p className="text-xs text-purple-600 font-bold mt-1 truncate">
              {data?.activeTarget
                ? `${Math.min(100, Math.round(((data.activeTarget.achievedAmount || 0) / (user?.role === 'Employee' ? 120000 : (data.activeTarget.targetAmount || 720000))) * 100))}% Paid Colab Progress`
                : 'Click to set target'}
            </p>
          </div>

          <div
            onClick={() => onNavigate('daily-posting')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div className="flex justify-between items-center text-slate-500 mb-2 text-xs uppercase font-extrabold">
              <span>Today Completion</span>
              <CheckCircle2 size={18} className="text-amber-600" />
            </div>
            <div className="text-3xl font-black text-amber-600">
              {data?.todaySummary?.completed || 0} / {data?.todaySummary?.total || 0}
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-1">Daily postings status</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-4">
        {/* Today's Schedule & Work Hub Table — COMMENTED OUT */}
        {/* ... */}


        {/* Sidebar Panel: My Assigned Brands / System Activity */}
        <div className="space-y-4">

          {isEmployee ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Star size={18} className="text-yellow-500 fill-yellow-400" />
                  My Assigned Brands
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black">
                  {data?.myBrands ? data.myBrands.length : 0} Active
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {(!data?.myBrands || data.myBrands.length === 0) ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <p className="text-xs font-extrabold text-slate-600">No Assigned Brands</p>
                    <p className="text-[11px] text-slate-400 font-medium">You currently have 0 assigned brands in your portfolio.</p>
                  </div>
                ) : (
                  data.myBrands.map((b: any, idx: number) => {
                    const bName = b.brandId?.brandName || b.brandName || 'Brand';
                    return (
                      <div
                        key={b._id || idx}
                        onClick={() => onNavigate('daily-posting')}
                        className="p-3 rounded-2xl bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 flex items-center justify-between text-xs cursor-pointer transition shadow-2xs group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl ${getBrandBg(idx)} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}>
                            {getBrandAvatar(bName)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm group-hover:text-purple-700 transition">{bName}</div>
                            <div className="text-slate-500 font-medium text-[11px]">{b.brandId?.industry || b.industry || 'General Industry'}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            b.priority === 'High' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {b.priority || 'Active'}
                          </span>
                          <ChevronRight size={14} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => onNavigate('brands')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition text-center border border-slate-200"
              >
                View Brand Directory
              </button>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-600" />
                Recent System Activity
              </h3>
              <div className="space-y-2.5">
                {(data?.recentAuditLogs || []).slice((logPage - 1) * itemsPerPage, logPage * itemsPerPage).map((log: any) => (
                  <div key={log._id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{log.userName}</span>
                      <span className="text-slate-500 text-[10px] font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1"><span className="text-purple-700 font-semibold">{log.action}</span> on <span className="font-semibold text-slate-800">{log.entity}</span></p>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={logPage}
                totalPages={Math.ceil((data?.recentAuditLogs?.length || 0) / itemsPerPage)}
                totalItems={data?.recentAuditLogs?.length || 0}
                itemsPerPage={itemsPerPage}
                onPageChange={setLogPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Team Performance & Employee Leaderboard Section for Manager / Admin */}
      {!isEmployee && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Trophy size={20} className="text-amber-500 fill-amber-400" />
                Team Performance & Member Productivity
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Real-time operational task completion, verification rates, and member performance rankings.
              </p>
            </div>
            <button
              onClick={() => onNavigate('performance')}
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-extrabold text-xs transition border border-purple-200 flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Analytics</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Team Performance DataTable */}
          {(() => {
            const tableData = perfData.map((emp: any, idx: number) => ({
              _idx: idx,
              rank: (perfPage - 1) * perfLimit + idx + 1,
              name: emp.employee?.name || emp.employeeName || 'Employee',
              employeeId: emp.employee?.employeeId || emp.employeeId || `EMP-${1000 + (perfPage - 1) * perfLimit + idx}`,
              designation: emp.employee?.designation || emp.designation || 'Influencer Executive',
              brandsManaged: emp.metrics?.brandsManaged ?? emp.assignedBrands ?? 0,
              completedTasks: emp.metrics?.completed ?? emp.completedTasks ?? 0,
              compRate: emp.metrics?.completionRate !== undefined ? emp.metrics.completionRate : parseInt(emp.verifiedRate || '0'),
            }));

            const columns: DataTableColumn<typeof tableData[0]>[] = [
              {
                key: 'rank',
                label: 'Rank',
                sortable: true,
                width: 'w-16',
                render: (_val, row) => row.rank === 1
                  ? <span className="text-amber-500 font-extrabold flex items-center gap-1"><Medal size={14} /> #1</span>
                  : <span className="font-black text-slate-700">#{row.rank}</span>,
              },
              {
                key: 'name',
                label: 'Member',
                sortable: true,
                render: (_val, row) => (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs shadow-2xs">
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900">{row.name}</div>
                      <div className="text-[10px] text-purple-600 font-bold">{row.employeeId}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'designation',
                label: 'Designation',
                sortable: true,
                render: (_val, row) => <span className="text-slate-600">{row.designation}</span>,
              },
              {
                key: 'brandsManaged',
                label: 'Assigned Brands',
                sortable: true,
                render: (_val, row) => <span className="font-bold text-slate-900">{row.brandsManaged} Brands</span>,
              },
              {
                key: 'completedTasks',
                label: 'Completed Tasks',
                sortable: true,
                render: (_val, row) => <span className="font-black text-emerald-600">{row.completedTasks} Tasks</span>,
              },
              {
                key: 'compRate',
                label: 'Verification Rate',
                sortable: true,
                render: (_val, row) => <span className="font-extrabold text-purple-700">{row.compRate}%</span>,
              },
              {
                key: 'compRate',
                label: 'Performance Grade',
                render: (_val, row) => (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    row.compRate >= 80
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : row.compRate >= 50
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {row.compRate >= 80 ? 'High Performer' : row.compRate >= 50 ? 'Steady' : 'Active'}
                  </span>
                ),
              },
            ];

            return (
              <div className="relative">
                {loadingPerf && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-3xl">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-lg border border-purple-100 text-purple-700 font-bold text-xs">
                      <Loader2 size={16} className="animate-spin text-purple-600" />
                      <span>Loading page {perfPage}...</span>
                    </div>
                  </div>
                )}
                <DataTable
                  columns={columns}
                  data={tableData}
                  rowKey="_idx"
                  itemsPerPage={perfLimit}
                  currentPage={perfPage}
                  totalItems={perfTotal}
                  totalPages={perfTotalPages}
                  onPageChange={(page) => fetchPerformance(page)}
                  emptyMessage="No team performance data available."
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
