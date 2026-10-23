import React, { useEffect, useState } from 'react';
import { BarChart3, Search, LayoutGrid, Table as TableIcon, Download, FileSpreadsheet, Layers, Calendar, Loader2, Eye, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { EmployeePerformanceData, User } from '../types';
import { Pagination } from '../components/Pagination';
import { PageLoader } from '../components/PageLoader';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { MonthDatePicker } from '../components/MonthDatePicker';
import { Modal } from '../components/Modal';

interface EmployeePerformanceViewProps {
  currentUser?: User | null;
}

const getCurrentMonthTimeframe = () => {
  const now = new Date();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return `${monthNames[now.getMonth()]}_${now.getFullYear()}`;
};

export const EmployeePerformanceView: React.FC<EmployeePerformanceViewProps> = ({ currentUser }) => {
  const [performanceData, setPerformanceData] = useState<EmployeePerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [timeframe, setTimeframe] = useState<string>(getCurrentMonthTimeframe());

  // Pagination & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'table' ? 10 : 4;

  // Export & In-Panel Report State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingReportType, setExportingReportType] = useState<string | null>(null);
  const [activePanelReportTab, setActivePanelReportTab] = useState<'analytics' | 'member-summary' | 'brand-summary' | 'daily-posting'>('analytics');
  const [panelReportData, setPanelReportData] = useState<any[]>([]);
  const [panelReportLoading, setPanelReportLoading] = useState(false);

  const userRole = (currentUser?.role || '').toLowerCase();
  const isManagerOrAdmin = userRole.includes('admin') || userRole.includes('manager');
  const isEmployee = !isManagerOrAdmin;

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await api.get(`/performance?timeframe=${timeframe}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (res.success) {
        let data: EmployeePerformanceData[] = res.data || [];
        // Ensure non-manager / non-admin user only sees their own performance record
        if (!isManagerOrAdmin && currentUser) {
          const userEmail = (currentUser.email || '').toLowerCase().trim();
          const userName = (currentUser.name || '').toLowerCase().trim();
          const userEmpId = (currentUser.employeeId || currentUser.id || '').toString().trim().toLowerCase();

          const filtered = data.filter(item => {
            const empEmail = (item.employee?.email || '').toLowerCase().trim();
            const empName = (item.employee?.name || '').toLowerCase().trim();
            const empId = (item.employee?.employeeId || item.employee?.id || '').toString().trim().toLowerCase();
            return (
              (empEmail && userEmail && empEmail === userEmail) ||
              (empId && userEmpId && empId === userEmpId) ||
              (empName && userName && empName === userName)
            );
          });
          if (filtered.length > 0) {
            data = filtered;
          }
        }
        setPerformanceData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [timeframe]);

  // Filter performance data by search term
  const filteredData = performanceData.filter(item => {
    const term = searchTerm.toLowerCase();
    const empName = item.employee?.name?.toLowerCase() || '';
    const empId = item.employee?.employeeId?.toLowerCase() || '';
    const designation = item.employee?.designation?.toLowerCase() || '';
    return empName.includes(term) || empId.includes(term) || designation.includes(term);
  });

  // Calculate total pages & safe page index
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedData = filteredData.slice((validPage - 1) * itemsPerPage, validPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // CSV Exporter for Performance & Incentives
  const handleExportPerformanceCSV = () => {
    if (filteredData.length === 0) {
      alert('No performance data available to export');
      return;
    }
    const headers = ['Member Name', 'Employee ID', 'Designation', 'Paid Target', 'Paid Revenue', 'Slab %', 'Target Incentive', 'Order Bonus Count', 'Order Bonus Amount', 'Total Take Home', 'Barter Collabs', 'Paid Collabs', 'Brands Managed', 'Completion Rate'];
    const rows = filteredData.map(row => [
      `"${row.employee?.name || ''}"`,
      `"${row.employee?.employeeId || ''}"`,
      `"${row.employee?.designation || ''}"`,
      `"${(row.incentiveSummary as any)?.paidTarget || 0}"`,
      `"${(row.incentiveSummary as any)?.paidRevenueAchieved || 0}"`,
      `"${(row.incentiveSummary as any)?.tierPercentage || 0}%"`,
      `"${row.incentiveSummary?.targetIncentiveAmount || 0}"`,
      `"${row.incentiveSummary?.qualifyingBonusDealsCount || 0}"`,
      `"${row.incentiveSummary?.orderBonusAmount || 0}"`,
      `"${row.incentiveSummary?.totalTakeHomeIncentive || 0}"`,
      `"${row.incentiveSummary?.barterCount || 0}"`,
      `"${row.incentiveSummary?.paidCount || 0}"`,
      `"${row.metrics?.brandsManaged || 0}"`,
      `"${row.metrics?.completionRate || 0}%"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `performance_incentive_report_${timeframe}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Exporter for General API endpoints
  const handleExportApiReport = async (endpoint: string, fileName: string, reportType: string) => {
    setExportingReportType(reportType);
    try {
      const res = await api.get(endpoint);
      if (res.success && res.data && res.data.length > 0) {
        let data = res.data;
        if (!isManagerOrAdmin && currentUser?.name) {
          const empNameLower = currentUser.name.toLowerCase().trim();
          const userEmail = (currentUser.email || '').toLowerCase().trim();
          const userEmpId = (currentUser.employeeId || currentUser.id || '').toString().trim().toLowerCase();
          if (endpoint.includes('employee-summary')) {
            data = data.filter((item: any) =>
              (item.name && item.name.toLowerCase().includes(empNameLower)) ||
              (item.email && item.email.toLowerCase() === userEmail) ||
              (item.employeeId && item.employeeId.toString().toLowerCase() === userEmpId)
            );
          } else if (endpoint.includes('daily-posting')) {
            data = data.filter((item: any) => item.employee?.toLowerCase().includes(empNameLower));
          }
        }
        if (data.length === 0) {
          alert('No report entries found for your account');
          return;
        }
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row: any) =>
          Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        );
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
        const link = document.createElement('a');
        link.href = encodeURI(csvContent);
        link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('No data found for this report export');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to export report');
    } finally {
      setExportingReportType(null);
    }
  };

  // View Report on Panel (redirect view without download)
  const handleViewReportOnPanel = async (tab: 'member-summary' | 'brand-summary' | 'daily-posting') => {
    setShowExportModal(false);
    setActivePanelReportTab(tab);
    setPanelReportLoading(true);
    try {
      let endpoint = '/reports/employee-summary';
      if (tab === 'brand-summary') endpoint = '/reports/brand-summary';
      if (tab === 'daily-posting') endpoint = '/reports/daily-posting';

      const res = await api.get(endpoint);
      if (res.success) {
        let data = res.data || [];
        if (!isManagerOrAdmin && currentUser?.name) {
          const empNameLower = currentUser.name.toLowerCase().trim();
          const userEmail = (currentUser.email || '').toLowerCase().trim();
          const userEmpId = (currentUser.employeeId || currentUser.id || '').toString().trim().toLowerCase();
          if (tab === 'member-summary') {
            data = data.filter((item: any) =>
              (item.name && item.name.toLowerCase().includes(empNameLower)) ||
              (item.email && item.email.toLowerCase() === userEmail) ||
              (item.employeeId && item.employeeId.toString().toLowerCase() === userEmpId)
            );
          } else if (tab === 'daily-posting') {
            data = data.filter((item: any) => item.employee?.toLowerCase().includes(empNameLower));
          }
        }
        setPanelReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPanelReportLoading(false);
    }
  };

  const columns: DataTableColumn<EmployeePerformanceData>[] = [
    {
      key: 'employeeName',
      label: 'Member',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center font-extrabold text-xs shadow shrink-0">
            {row.employee?.name?.charAt(0) || 'E'}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">{row.employee?.name || 'Unknown'}</div>
            <div className="text-[10px] text-purple-600 font-bold">
              {row.employee?.employeeId} • {row.employee?.designation}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'netMargin',
      label: 'Ad2ship Net Margin',
      sortable: true,
      render: (_, row) => {
        const margin = row.incentiveSummary?.netMargin || 0;
        return (
          <div className="space-y-0.5">
            <span className="font-black text-slate-900 text-xs">
              ₹{new Intl.NumberFormat().format(margin)}
            </span>
            <div className="text-[10px] text-slate-400 font-semibold">
              Target: ₹1,20,000 ({row.incentiveSummary?.targetAchievedPercent || 0}%)
            </div>
          </div>
        );
      }
    },
    {
      key: 'targetTier',
      label: 'Incentive Slab',
      render: (_, row) => {
        const tier = row.incentiveSummary?.targetTier || '0%';
        const isTier1 = tier === '10%';
        const isTier2 = tier === '5%';

        return (
          <div className="space-y-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              isTier1 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : isTier2 
                  ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {isTier1 ? '🏆 10% Slab (1L+)' : isTier2 ? '🥈 5% Slab (80k+)' : '0% (Below 80k)'}
            </span>
            <div className="text-[11px] font-bold text-emerald-700">
              ₹{new Intl.NumberFormat().format(row.incentiveSummary?.targetIncentiveAmount || 0)}
            </div>
          </div>
        );
      }
    },
    {
      key: 'orderBonus',
      label: '100+ Order Bonus',
      render: (_, row) => {
        const bonusCount = row.incentiveSummary?.qualifyingBonusDealsCount || 0;
        const bonusAmount = row.incentiveSummary?.orderBonusAmount || 0;

        return (
          <div className="space-y-0.5">
            {bonusCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  🌟 {bonusCount} Videos (100+ Orders)
                </span>
                <div className="text-[11px] font-black text-amber-700">
                  +₹{new Intl.NumberFormat().format(bonusAmount)}
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">No qualifying videos</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'totalIncentive',
      label: 'Total Take-Home',
      render: (_, row) => {
        const total = row.incentiveSummary?.totalTakeHomeIncentive || 0;
        return (
          <div className="p-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <span className="text-xs font-black text-emerald-700">
              ₹{new Intl.NumberFormat().format(total)}
            </span>
            <span className="text-[9px] block text-emerald-600 font-extrabold uppercase tracking-wider">Total Incentive</span>
          </div>
        );
      }
    },
    {
      key: 'collabs',
      label: 'Collabs Done',
      render: (_, row) => (
        <div className="text-xs font-bold text-slate-800">
          <span className="text-purple-700">{row.incentiveSummary?.barterCount || 0}B</span> : <span className="text-indigo-700">{row.incentiveSummary?.paidCount || 0}P</span>
          <div className="text-[10px] text-slate-400 font-semibold">{row.metrics.brandsManaged} brands managed</div>
        </div>
      ),
    },
    {
      key: 'completionRate',
      label: 'Completion Rate',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2 w-28">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full rounded-full"
              style={{ width: `${Math.min(row.metrics.completionRate, 100)}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-emerald-600 shrink-0">
            {row.metrics.completionRate}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isManagerOrAdmin ? 'Performance Analytics' : 'My Performance Analytics'}
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {isManagerOrAdmin
                ? 'Calculated directly from task completion data & schedules.'
                : 'Your individual monthly quota, target margin progress & incentive earnings.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Visual Month / Calendar Picker */}
          <MonthDatePicker 
            timeframe={timeframe} 
            onChange={(newTimeframe) => setTimeframe(newTimeframe)} 
          />

          {/* View Toggle */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs">
            <button
              onClick={() => { setViewMode('table'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
            <button
              onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
          </div>

          {/* Export & Reports Action Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
          >
            <Download size={15} />
            <span>Export Reports</span>
          </button>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID or role..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoader message="Calculating performance metrics..." />
      ) : filteredData.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-500 font-medium text-sm">
          No employee performance records found matching "{searchTerm}".
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'table' ? (
            <DataTable
              columns={columns}
              data={filteredData}
              itemsPerPage={10}
              rowKey={(item) => item.employee?.id || item.employee?.employeeId}
              emptyMessage="No performance data available."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedData.map((item) => {
                  const { employee, metrics, incentiveSummary, qualifyingDeals } = item;
                  const margin = incentiveSummary?.netMargin || 0;
                  const targetPct = incentiveSummary?.targetAchievedPercent || 0;
                  const tier = incentiveSummary?.targetTier || '0%';
                  const totalIncentive = incentiveSummary?.totalTakeHomeIncentive || 0;
                  const bonusCount = incentiveSummary?.qualifyingBonusDealsCount || 0;

                  return (
                    <div key={employee.id} className="bg-white glass-card-hover p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center font-extrabold text-base shadow">
                            {employee.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{employee.name}</h3>
                            <span className="text-[11px] text-purple-600 font-bold">{employee.employeeId} • {employee.designation}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-black text-emerald-600">₹{new Intl.NumberFormat().format(totalIncentive)}</span>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Incentive</span>
                        </div>
                      </div>

                      {/* Net Margin & Slabs Box (Clean Light Theme) */}
                      <div className="p-3.5 bg-gradient-to-br from-slate-50 via-purple-50/40 to-emerald-50/40 border border-slate-200/90 rounded-2xl space-y-2.5 shadow-2xs">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-600">Net Ad2ship Margin:</span>
                          <span className="text-base font-black text-slate-900">
                            ₹{new Intl.NumberFormat().format(margin)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Target Progress ({targetPct}%)</span>
                            <span className="text-purple-600">Target: ₹1,20,000</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(targetPct, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            tier === '10%' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : tier === '5%' 
                                ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {tier === '10%' ? '🏆 10% Slab (1L+)' : tier === '5%' ? '🥈 5% Slab (80k+)' : '0% Slab (<80k)'}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            Target Bonus: <strong className="text-emerald-700 font-extrabold">₹{new Intl.NumberFormat().format(incentiveSummary?.targetIncentiveAmount || 0)}</strong>
                          </span>
                        </div>

                        {bonusCount > 0 && (
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-xs">
                            <span className="text-amber-800 font-bold flex items-center gap-1 text-[11px] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              🌟 {bonusCount} Videos (100+ Orders)
                            </span>
                            <span className="text-amber-700 font-black text-xs">
                              +₹{new Intl.NumberFormat().format(incentiveSummary?.orderBonusAmount || 0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Collab Counts & Tasks */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
                          <span className="text-[10px] uppercase font-bold text-purple-700 block">Barter Collabs</span>
                          <span className="text-base font-extrabold text-purple-900">{incentiveSummary?.barterCount || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">Paid Collabs</span>
                          <span className="text-base font-extrabold text-indigo-900">{incentiveSummary?.paidCount || 0}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-600 block">Brands Managed</span>
                          <span className="text-base font-bold text-slate-900">{metrics.brandsManaged}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Task Completion Rate: <strong className="text-emerald-600 font-bold">{metrics.completionRate}%</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls for Grid Mode */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <Pagination
                  currentPage={validPage}
                  totalPages={totalPages}
                  totalItems={filteredData.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal: Export & Reports */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export & Download Performance Reports"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 text-xs font-semibold text-slate-700 p-1">
          {/* Top Featured Hero Banner: Performance & Incentives */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200/90 text-slate-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  ★ Primary Report
                </span>
                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                  {timeframe}
                </span>
              </div>
              <h4 className="font-extrabold text-base text-slate-900 tracking-tight">Performance & Incentive Analytics CSV</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-lg">
                Complete incentive breakdown including target revenue, tier slab percentage, 100+ order bonus, and total take-home incentive.
              </p>
            </div>

            <button
              onClick={handleExportPerformanceCSV}
              className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all duration-200 shrink-0 self-stretch md:self-auto justify-center z-10"
            >
              <Download size={16} className="shrink-0" />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Module Reports & Live Panel Viewers</h5>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">Account Scoped</span>
            </div>

            {/* List Rows */}
            <div className="space-y-2.5">
              {/* Row 1: Member Summary */}
              <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100/90 text-indigo-700 flex items-center justify-center font-extrabold shrink-0 shadow-2xs">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">Member Task Summary</h4>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Tasks & Completion Rate</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Summary of total tasks, completed, pending, delayed, and completion percentage.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    disabled={exportingReportType === 'member'}
                    onClick={() => handleExportApiReport('/reports/employee-summary', 'member_task_summary_report', 'member')}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition disabled:opacity-50"
                  >
                    {exportingReportType === 'member' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => handleViewReportOnPanel('member-summary')}
                    className="px-3.5 py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Eye size={15} />
                    <span>View on Panel</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Brand Summary */}
              <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100/90 text-purple-700 flex items-center justify-center font-extrabold shrink-0 shadow-2xs">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">Brand Performance Summary</h4>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Assigned Brands</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Campaign totals, active brand deals, and execution status for assigned portfolio.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    disabled={exportingReportType === 'brand'}
                    onClick={() => handleExportApiReport('/reports/brand-summary', 'brand_performance_summary_report', 'brand')}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition disabled:opacity-50"
                  >
                    {exportingReportType === 'brand' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => handleViewReportOnPanel('brand-summary')}
                    className="px-3.5 py-2.5 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Eye size={15} />
                    <span>View on Panel</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Daily Postings Log */}
              <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-pink-100/90 text-pink-700 flex items-center justify-center font-extrabold shrink-0 shadow-2xs">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">Daily Postings Audit Log</h4>
                      <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md">Posting Verification</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Day-wise posting schedule, platform URLs, and verification audit trail.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    disabled={exportingReportType === 'daily'}
                    onClick={() => handleExportApiReport('/reports/daily-posting', 'daily_posting_audit_report', 'daily')}
                    className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition disabled:opacity-50"
                  >
                    {exportingReportType === 'daily' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => handleViewReportOnPanel('daily-posting')}
                    className="px-3.5 py-2.5 bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Eye size={15} />
                    <span>View on Panel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Interactive In-Panel Report Viewer */}
      {activePanelReportTab !== 'analytics' && (
        <div className="bg-white p-6 rounded-3xl border border-purple-200 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActivePanelReportTab('analytics')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 transition font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Back to Performance Analytics</span>
              </button>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 capitalize">
                  {activePanelReportTab.replace('-', ' ')} (Panel Report View)
                </h3>
                <p className="text-xs text-slate-500 font-medium">Viewing real-time report records for your account without CSV download.</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => handleViewReportOnPanel('member-summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  activePanelReportTab === 'member-summary' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Member Summary
              </button>
              <button
                onClick={() => handleViewReportOnPanel('brand-summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  activePanelReportTab === 'brand-summary' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Brand Summary
              </button>
              <button
                onClick={() => handleViewReportOnPanel('daily-posting')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  activePanelReportTab === 'daily-posting' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Postings
              </button>
            </div>
          </div>

          {panelReportLoading ? (
            <PageLoader message="Loading report data on panel..." />
          ) : panelReportData.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-200">
              No report records found for your account in this section.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    {Object.keys(panelReportData[0]).map((key) => (
                      <th key={key} className="px-4 py-3 whitespace-nowrap">{key.replace(/([A-Z])/g, ' $1')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {panelReportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40 transition">
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="px-4 py-3 whitespace-nowrap">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

