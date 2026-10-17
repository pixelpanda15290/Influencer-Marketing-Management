import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, ArrowRight, RotateCcw } from 'lucide-react';

export interface DayCalendarPickerProps {
  startDate?: string; // ISO date string (YYYY-MM-DD) or empty
  endDate?: string;   // ISO date string (YYYY-MM-DD) or empty
  value?: string;     // Backward compatibility for single date
  onChange: (startDate: string, endDate: string) => void;
  availableDates?: string[]; // Array of dates with data in ledger
  placeholder?: string;
  align?: 'left' | 'right';
  className?: string;
}

export const DayCalendarPicker: React.FC<DayCalendarPickerProps> = ({
  startDate,
  endDate,
  value,
  onChange,
  availableDates = [],
  placeholder = 'Date Range',
  align = 'left',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize incoming props
  const propStart = startDate !== undefined ? startDate : (value || '');
  const propEnd = endDate !== undefined ? endDate : (value || '');

  // Internal selection state (to allow two-click range selection)
  const [tempStart, setTempStart] = useState<string>(propStart);
  const [tempEnd, setTempEnd] = useState<string>(propEnd);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync internal state with props when props change or popover opens
  useEffect(() => {
    setTempStart(propStart);
    setTempEnd(propEnd);
  }, [propStart, propEnd, isOpen]);

  // Normalize availableDates to YYYY-MM-DD set for fast lookup
  const availableSet = useMemo(() => {
    const set = new Set<string>();
    availableDates.forEach(d => {
      if (!d) return;
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        set.add(`${y}-${m}-${day}`);
      }
    });
    return set;
  }, [availableDates]);

  // Initial view date based on current start date, or first available date, or today
  const getInitialViewDate = () => {
    const dateToUse = propStart || propEnd;
    if (dateToUse) {
      const parsed = new Date(dateToUse);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (availableDates.length > 0) {
      const first = new Date(availableDates[availableDates.length - 1] || availableDates[0]);
      if (!isNaN(first.getTime())) return first;
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(getInitialViewDate);

  // Sync viewDate when active date prop changes
  useEffect(() => {
    const target = propStart || propEnd;
    if (target) {
      const parsed = new Date(target);
      if (!isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [propStart, propEnd]);

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // If user picked a start date but didn't pick end date, apply single day
        if (tempStart && !tempEnd) {
          onChange(tempStart, tempStart);
        }
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, tempStart, tempEnd, onChange]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Day Selection Logic
  const handleSelectDay = (iso: string) => {
    // If no start date, or both start & end were already selected -> start new range
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(iso);
      setTempEnd('');
      return;
    }

    // If start date is already selected, and user clicks second date
    if (tempStart && !tempEnd) {
      if (iso >= tempStart) {
        setTempEnd(iso);
        onChange(tempStart, iso);
      } else {
        // User clicked an earlier date, make it the new start date
        setTempStart(iso);
        setTempEnd('');
      }
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTempStart('');
    setTempEnd('');
    setHoverDate(null);
    onChange('', '');
    setIsOpen(false);
  };

  const handleResetSelection = () => {
    setTempStart('');
    setTempEnd('');
    setHoverDate(null);
  };

  // Quick Preset Handlers
  const handleSetToday = () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setTempStart(iso);
    setTempEnd(iso);
    onChange(iso, iso);
    setViewDate(today);
  };

  const handleSetThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const format = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const startIso = format(monday);
    const endIso = format(sunday);

    setTempStart(startIso);
    setTempEnd(endIso);
    onChange(startIso, endIso);
    setViewDate(today);
  };

  const handleSetThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();

    const startIso = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const endIso = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    setTempStart(startIso);
    setTempEnd(endIso);
    onChange(startIso, endIso);
    setViewDate(now);
  };

  const handleSetPast30Days = () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 29);

    const format = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const startIso = format(past);
    const endIso = format(today);

    setTempStart(startIso);
    setTempEnd(endIso);
    onChange(startIso, endIso);
    setViewDate(today);
  };

  // Build calendar matrix
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const iso = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, iso, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, iso, isCurrentMonth: true });
  }

  // Next month leading days to complete grid
  const remainingSlots = 42 - calendarDays.length; // 6 rows * 7 columns
  for (let d = 1; d <= (remainingSlots >= 7 ? remainingSlots - 7 : remainingSlots); d++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const iso = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, iso, isCurrentMonth: false });
  }

  // Helpers to format date displays
  const formatDateDisplay = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format label for the trigger button
  const formatTriggerLabel = () => {
    if (!propStart && !propEnd) return placeholder;
    if (propStart && !propEnd) return `${formatDateDisplay(propStart)} ➔ End?`;
    if (propStart && propEnd) {
      if (propStart === propEnd) return formatDateDisplay(propStart);
      const [y1, m1, d1] = propStart.split('-').map(Number);
      const [y2, m2, d2] = propEnd.split('-').map(Number);
      const dt1 = new Date(y1, m1 - 1, d1);
      const dt2 = new Date(y2, m2 - 1, d2);

      if (y1 === y2 && m1 === m2) {
        const mStr = dt1.toLocaleDateString(undefined, { month: 'short' });
        return `${mStr} ${d1} – ${d2}, ${y1}`;
      } else if (y1 === y2) {
        const m1Str = dt1.toLocaleDateString(undefined, { month: 'short' });
        const m2Str = dt2.toLocaleDateString(undefined, { month: 'short' });
        return `${m1Str} ${d1} – ${m2Str} ${d2}, ${y1}`;
      } else {
        return `${formatDateDisplay(propStart)} – ${formatDateDisplay(propEnd)}`;
      }
    }
    return placeholder;
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const hasSelection = Boolean(propStart || propEnd);

  // Active range used for calendar cell styling
  const activeStart = tempStart;
  const activeEnd = tempEnd || (tempStart && hoverDate && hoverDate >= tempStart ? hoverDate : '');

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer select-none shadow-2xs whitespace-nowrap ${
          hasSelection
            ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300'
            : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-slate-700'
        }`}
        title={hasSelection ? `Filtered: ${formatTriggerLabel()}` : 'Select date range'}
      >
        <Calendar size={13} className={hasSelection ? 'text-white shrink-0' : 'text-purple-600 shrink-0'} />
        <span className="truncate max-w-[190px]">{formatTriggerLabel()}</span>

        {hasSelection ? (
          <span
            onClick={handleClear}
            className="p-0.5 hover:bg-purple-700/90 rounded-full transition cursor-pointer ml-0.5 shrink-0"
            title="Clear date filter"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronRight size={12} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        )}
      </button>

      {/* Calendar Dropdown Modal / Popover */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 z-50 animate-scale-in text-slate-800 select-none`}
        >
          {/* Header Navigation */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="text-center">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                {monthNames[month]} {year}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Range Selection Status Banner */}
          <div className="flex items-center justify-between px-2.5 py-1.5 mb-2.5 bg-purple-50/70 border border-purple-100 rounded-xl text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              {!tempStart && !tempEnd && (
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Calendar size={12} className="text-purple-600 shrink-0" />
                  Click a start date
                </span>
              )}
              {tempStart && !tempEnd && (
                <span className="text-purple-900 font-bold flex items-center gap-1 truncate">
                  <span className="text-purple-600 font-black">Start:</span>
                  <span>{formatDateDisplay(tempStart)}</span>
                  <ArrowRight size={11} className="text-purple-500 shrink-0 animate-pulse" />
                  <span className="text-purple-700 italic font-semibold">Select end date</span>
                </span>
              )}
              {tempStart && tempEnd && (
                <span className="text-purple-950 font-extrabold truncate">
                  {tempStart === tempEnd
                    ? formatDateDisplay(tempStart)
                    : `${formatDateDisplay(tempStart)} → ${formatDateDisplay(tempEnd)}`}
                </span>
              )}
            </div>

            {tempStart && (
              <button
                type="button"
                onClick={handleResetSelection}
                className="text-[10px] text-slate-400 hover:text-rose-600 font-extrabold flex items-center gap-0.5 transition cursor-pointer shrink-0 ml-1"
                title="Reset selection"
              >
                <RotateCcw size={10} /> Reset
              </button>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 transition cursor-pointer shrink-0"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleSetThisWeek}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 transition cursor-pointer shrink-0"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={handleSetThisMonth}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 transition cursor-pointer shrink-0"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={handleSetPast30Days}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 transition cursor-pointer shrink-0"
            >
              Past 30D
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <span
                key={d}
                className={`text-[10px] font-black uppercase tracking-wider py-1 ${
                  i === 0 || i === 6 ? 'text-purple-600 font-extrabold' : 'text-slate-400'
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div
            className="grid grid-cols-7 text-center gap-y-1"
            onMouseLeave={() => setHoverDate(null)}
          >
            {calendarDays.map((item, idx) => {
              const iso = item.iso;
              const isStart = activeStart === iso;
              const isEnd = activeEnd === iso;
              const isSingleDay = activeStart === activeEnd && isStart;
              const isInRange = Boolean(
                activeStart &&
                activeEnd &&
                iso > activeStart &&
                iso < activeEnd
              );
              const isPreviewRange = Boolean(
                tempStart &&
                !tempEnd &&
                hoverDate &&
                hoverDate > tempStart &&
                iso > tempStart &&
                iso < hoverDate
              );

              const hasData = availableSet.has(iso);
              const isToday = iso === todayIso;

              // Cell range styling
              let cellBg = '';
              let textColor = item.isCurrentMonth ? 'text-slate-700' : 'text-slate-300';
              let rounded = 'rounded-xl';

              if (isSingleDay) {
                cellBg = 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/30 ring-2 ring-purple-300';
                textColor = 'text-white';
                rounded = 'rounded-xl';
              } else if (isStart) {
                cellBg = 'bg-purple-600 text-white font-black shadow-sm';
                textColor = 'text-white';
                rounded = activeEnd ? 'rounded-l-xl rounded-r-none' : 'rounded-xl ring-2 ring-purple-300';
              } else if (isEnd) {
                cellBg = tempEnd ? 'bg-purple-600 text-white font-black shadow-sm' : 'bg-purple-400 text-white font-bold';
                textColor = 'text-white';
                rounded = 'rounded-r-xl rounded-l-none';
              } else if (isInRange) {
                cellBg = 'bg-purple-100 text-purple-900 font-bold';
                textColor = 'text-purple-900';
                rounded = 'rounded-none';
              } else if (isPreviewRange) {
                cellBg = 'bg-purple-50 text-purple-900 font-semibold border-y border-purple-200 border-dashed';
                textColor = 'text-purple-900';
                rounded = 'rounded-none';
              } else if (item.isCurrentMonth) {
                if (hasData) {
                  cellBg = 'bg-purple-50/60 text-purple-900 font-black hover:bg-purple-100';
                  textColor = 'text-purple-900';
                } else {
                  cellBg = 'hover:bg-slate-100';
                }
              } else {
                cellBg = 'hover:text-slate-500';
              }

              return (
                <div key={`${iso}-${idx}`} className="p-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleSelectDay(iso)}
                    onMouseEnter={() => {
                      if (tempStart && !tempEnd) {
                        setHoverDate(iso);
                      }
                    }}
                    className={`h-8 w-full text-xs flex flex-col items-center justify-center relative transition cursor-pointer ${rounded} ${cellBg} ${textColor} ${
                      isToday && !isStart && !isEnd && !isInRange ? 'ring-1 ring-purple-400 font-black' : ''
                    }`}
                  >
                    <span>{item.day}</span>
                    {/* Indicator Dot for Days with data in ledger */}
                    {hasData && !isStart && !isEnd && !isInRange && (
                      <span className="w-1 h-1 rounded-full bg-purple-600 absolute bottom-1" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Action Footer */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            >
              Clear Filter
            </button>

            <div className="flex items-center gap-1.5">
              {tempStart && !tempEnd && (
                <button
                  type="button"
                  onClick={() => {
                    setTempEnd(tempStart);
                    onChange(tempStart, tempStart);
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-extrabold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition cursor-pointer"
                  title="Filter for this single day"
                >
                  Single Day
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
