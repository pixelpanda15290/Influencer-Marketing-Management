import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Edit3, ChevronRight, CheckCircle2, DollarSign, X } from 'lucide-react';
import { TargetItem, User } from '../types';
import { api } from '../services/api';

interface TargetTopBannerProps {
  user: User | null;
  onNavigateToTargets: () => void;
  refreshTrigger?: number;
}

export const TargetTopBanner: React.FC<TargetTopBannerProps> = ({ user, onNavigateToTargets, refreshTrigger }) => {
  const [target, setTarget] = useState<TargetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [newAchieved, setNewAchieved] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const isAssistantManager = user?.role === 'Assistant Manager' || user?.role === 'Assistant Marketing Manager' || (!!user?.role && user.role.toLowerCase().includes('assistant'));
  const isManagerOrAdmin = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'Marketing Manager' || user?.role === 'Manager' || isAssistantManager || user?.role === 'Team Leader';
  const isTargetManager = (user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'Marketing Manager' || user?.role === 'Manager') && !isAssistantManager;

  const fetchActiveTarget = async () => {
    try {
      const res = await api.get('/targets/active');
      if (res.success && res.data) {
        setTarget(res.data);
        setNewAchieved(res.data.achievedAmount || 0);
      } else {
        setTarget(null);
      }
    } catch (err) {
      console.error('Failed to fetch active target for top banner', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTarget();
  }, [refreshTrigger]);

  const handleQuickUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      const res = await api.put(`/targets/${target._id}`, {
        achievedAmount: Number(newAchieved)
      });
      if (res.success) {
        setTarget(res.data);
        setShowQuickEdit(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update target');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !target) return null;

  const isBarterUser = user?.role === 'Barter Collab Executive' || (!!user?.role && user.role.toLowerCase().includes('barter')) || target.targetType === 'Barter';
  const isEmployee = user?.role === 'Employee' || isAssistantManager || isBarterUser || (!!user?.role && user.role.toLowerCase().includes('paid'));

  const effectiveTargetAmount = isBarterUser 
    ? (target.targetCount || target.targetAmount || 300)
    : (isEmployee ? 120000 : (target.targetAmount || 720000));

  const effectiveAchieved = isBarterUser
    ? (target.achievedCount !== undefined ? target.achievedCount : (target.achievedAmount || 0))
    : (target.achievedAmount || 0);

  const percentage = effectiveTargetAmount > 0 ? Math.min(100, Math.round((effectiveAchieved / effectiveTargetAmount) * 100)) : 0;
  const remaining = Math.max(0, effectiveTargetAmount - effectiveAchieved);
  const formattedTarget = new Intl.NumberFormat().format(effectiveTargetAmount);
  const formattedAchieved = new Intl.NumberFormat().format(effectiveAchieved);
  const formattedRemaining = new Intl.NumberFormat().format(remaining);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-2.5 border-b border-indigo-500/20 shadow-md relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Title & Period */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
            <Target size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-wide">{target.title}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase">
                {target.period}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              {isBarterUser ? (
                <>Monthly Barter Target | Performance: <span className="font-bold text-purple-300">{percentage}% Barter Deals Met ({formattedAchieved}/{formattedTarget} Deals)</span></>
              ) : isTargetManager ? (
                <>Net Margin Target: <span className="font-bold text-emerald-400">{target.currency}{formattedTarget}</span> | Achieved: <span className="font-bold text-purple-300">{target.currency}{formattedAchieved}</span> ({percentage}%)</>
              ) : (
                <>Monthly Target | Performance: <span className="font-bold text-purple-300">{percentage}% Paid Colab Met</span></>
              )}
            </p>
          </div>
        </div>

        {/* Center: Dynamic Visual Progress Bar */}
        <div className="flex-1 max-w-md w-full mx-2">
          <div className="flex justify-between items-center text-[11px] font-bold mb-1">
            <span className="text-purple-300 flex items-center gap-1">
              <TrendingUp size={12} /> {percentage}% Completed
            </span>
            <span className="text-slate-400">
              {remaining === 0 ? '🎯 Target Reached!' : isBarterUser ? `${formattedRemaining} Deals Remaining` : isTargetManager ? `${target.currency}${formattedRemaining} Remaining` : `${100 - percentage}% Remaining`}
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-slate-700 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                percentage >= 100
                  ? 'from-emerald-500 to-teal-400'
                  : percentage >= 75
                  ? 'from-purple-500 to-indigo-400'
                  : percentage >= 40
                  ? 'from-blue-500 to-indigo-500'
                  : 'from-amber-500 to-orange-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>


      {/* Quick Update Modal */}
      {showQuickEdit && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Target className="text-purple-600" size={20} />
                Update Target Progress
              </h3>
              <button
                onClick={() => setShowQuickEdit(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Title
                </label>
                <input
                  type="text"
                  disabled
                  value={target.title}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Goal Amount
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${target.currency}${new Intl.NumberFormat().format(target.targetAmount)}`}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Achieved ({target.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newAchieved}
                    onChange={(e) => setNewAchieved(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-purple-300 focus:ring-2 focus:ring-purple-500 rounded-xl text-sm font-extrabold text-purple-700 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-800">
                <span className="font-bold">Calculated Progress: </span>
                {Math.min(100, Math.round(((newAchieved || 0) / (target.targetAmount || 1)) * 100))}%
                ({target.currency}{new Intl.NumberFormat().format(newAchieved)} achieved of {target.currency}{new Intl.NumberFormat().format(target.targetAmount)})
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickEdit(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
