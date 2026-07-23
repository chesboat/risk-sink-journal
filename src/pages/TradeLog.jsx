import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Image,
  FileText,
  Tag,
  X,
  Check,
} from 'lucide-react';
import {
  getIdeaResult,
  getNetR,
  getNetPnl,
  formatPnl,
  formatDate,
  getBehavioralFlags,
  SESSIONS,
  SETUPS,
  INSTRUMENTS,
  TAG_CATEGORIES,
} from '../lib/store';

export default function TradeLog({
  state,
  openEditTrade,
  updateTrade,
  deleteTrade,
}) {
  const { trades, accounts, settings } = state;
  const customTags = settings?.customTags || {};

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedSetups, setSelectedSetups] = useState([]);
  const [selectedResult, setSelectedResult] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [dismissedFlags, setDismissedFlags] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Bulk-select state
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [stagedTags, setStagedTags] = useState({}); // { confirmations:[], conditions:[], riskSinkStyles:[], mistakes:[] }

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelected = () => setSelectedIds(new Set());
  const toggleStagedTag = (category, tag) => {
    setStagedTags(prev => {
      const list = prev[category] || [];
      return {
        ...prev,
        [category]: list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag],
      };
    });
  };
  const stagedCount = Object.values(stagedTags).reduce((s, l) => s + (l?.length || 0), 0);

  // Apply staged tags to all selected trades, merging with existing tags
  const applyBulkTags = () => {
    if (stagedCount === 0 || selectedIds.size === 0) {
      setBulkPickerOpen(false);
      return;
    }
    const ids = new Set(selectedIds);
    trades.forEach(trade => {
      if (!ids.has(trade.id)) return;
      const existing = trade.tags || {};
      const merged = { ...existing };
      TAG_CATEGORIES.forEach(cat => {
        const add = stagedTags[cat.key] || [];
        if (!add.length) return;
        const cur = existing[cat.key] || [];
        merged[cat.key] = Array.from(new Set([...cur, ...add]));
      });
      updateTrade?.({ ...trade, tags: merged });
    });
    setStagedTags({});
    setBulkPickerOpen(false);
    clearSelected();
  };

  // Get behavioral flags
  const behavioralFlags = useMemo(() => {
    if (dismissedFlags) return [];
    const flags = getBehavioralFlags(trades);
    return flags.slice(0, 3);
  }, [trades, dismissedFlags]);

  // Filter and search
  const filteredAndSortedTrades = useMemo(() => {
    let filtered = [...trades];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (trade) =>
          (trade.instrument?.toLowerCase().includes(query)) ||
          (trade.setup?.toLowerCase().includes(query)) ||
          (trade.session?.toLowerCase().includes(query)) ||
          (trade.thesis?.toLowerCase().includes(query)) ||
          (trade.lesson?.toLowerCase().includes(query))
      );
    }

    if (selectedInstruments.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedInstruments.includes(trade.instrument)
      );
    }

    if (selectedSessions.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedSessions.includes(trade.session)
      );
    }

    if (selectedSetups.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedSetups.includes(trade.setup)
      );
    }

    if (selectedResult !== 'all') {
      // 'open' selects ideas with no result yet (getIdeaResult returns null)
      filtered = filtered.filter(
        (trade) => getIdeaResult(trade) === (selectedResult === 'open' ? null : selectedResult)
      );
    }

    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      filtered = filtered.filter((trade) => new Date(trade.date + 'T00:00:00') >= start);
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      filtered = filtered.filter((trade) => new Date(trade.date + 'T00:00:00') <= end);
    }

    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'date':
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
        case 'instrument':
          aVal = a.instrument || '';
          bVal = b.instrument || '';
          break;
        case 'session':
          aVal = a.session || '';
          bVal = b.session || '';
          break;
        case 'setup':
          aVal = a.setup || '';
          bVal = b.setup || '';
          break;
        case 'result':
          aVal = getIdeaResult(a);
          bVal = getIdeaResult(b);
          break;
        case 'netR':
          aVal = getNetR(a);
          bVal = getNetR(b);
          break;
        case 'netPnl':
          aVal = getNetPnl(a);
          bVal = getNetPnl(b);
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [trades, searchQuery, selectedInstruments, selectedSessions, selectedSetups, selectedResult, startDate, endDate, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const toggleInstrument = (instrument) => {
    setSelectedInstruments((prev) =>
      prev.includes(instrument)
        ? prev.filter((i) => i !== instrument)
        : [...prev, instrument]
    );
  };

  const toggleSession = (session) => {
    setSelectedSessions((prev) =>
      prev.includes(session)
        ? prev.filter((s) => s !== session)
        : [...prev, session]
    );
  };

  const toggleSetup = (setup) => {
    setSelectedSetups((prev) =>
      prev.includes(setup)
        ? prev.filter((s) => s !== setup)
        : [...prev, setup]
    );
  };

  // Entry dots rendering
  const renderEntryDots = (entries) => {
    if (!entries || entries.length === 0) {
      return (
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text-muted)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text-muted)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text-muted)' }} />
        </div>
      );
    }

    return (
      <div className="flex gap-1 items-center">
        {entries.slice(0, 3).map((entry, idx) => {
          let bg = 'var(--text-muted)';
          let border = 'none';
          if (entry.triggered === false) {
            bg = 'transparent';
            border = '1px solid var(--text-muted)';
          }
          if (entry.triggered === true) {
            bg = entry.result === 'W' ? 'var(--green)' : entry.result === 'L' ? 'var(--red)' : 'var(--text-dim)';
          }

          return (
            <div
              key={idx}
              className="w-2 h-2 rounded-full"
              style={{ background: bg, border }}
            />
          );
        })}
      </div>
    );
  };

  // Result tag rendering — BE and still-open ideas get their own styling
  // instead of falling through to the red LOSS look.
  const renderResultTag = (trade) => {
    const result = getIdeaResult(trade);
    const style = result === 'WIN'
      ? { background: 'var(--green-dim)', color: 'var(--green)' }
      : result === 'LOSS'
        ? { background: 'var(--red-dim)', color: 'var(--red)' }
        : result === 'BE'
          ? { background: 'var(--surface)', color: 'var(--text-dim)' }
          : { background: 'var(--blue-dim)', color: 'var(--accent)' };
    return (
      <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={style}>
        {result || 'OPEN'}
      </span>
    );
  };

  // Net R rendering
  const renderNetR = (trade) => {
    const netR = getNetR(trade);
    return (
      <span className="font-medium" style={{ color: netR >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {netR.toFixed(2)}R
      </span>
    );
  };

  // Net P&L rendering
  const renderNetPnl = (trade) => {
    const pnl = getNetPnl(trade);
    return (
      <span className="font-medium" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {formatPnl(pnl)}
      </span>
    );
  };

  // Filter chip helper
  const chipStyle = (active) => ({
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-dim)',
    border: active ? 'none' : '1px solid var(--border)',
  });

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Behavioral Flags Banner */}
      <AnimatePresence>
        {behavioralFlags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-3"
            style={{ background: 'rgba(255, 159, 10, 0.1)', borderBottom: '1px solid rgba(255, 159, 10, 0.2)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--orange)' }} />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--orange)' }}>Behavioral Alerts</h3>
                </div>
                <div className="space-y-1">
                  {behavioralFlags.map((flag, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-dim)' }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{flag.message}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setDismissedFlags(true)}
                className="text-sm font-medium flex-shrink-0 border-0 cursor-pointer"
                style={{ color: 'var(--orange)', background: 'transparent' }}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Trade Log</h1>

          {/* Bulk-action toolbar — appears when one or more trades are selected */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setBulkPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-0 transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Tag className="w-4 h-4" />
                  Add tags
                </button>
                <button
                  onClick={clearSelected}
                  className="p-1.5 rounded-lg cursor-pointer border-0 transition-colors"
                  style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by instrument, setup, session, thesis, lesson..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none"
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
            }}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-6 py-4 space-y-4 overflow-y-auto"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {/* Instrument Filter */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                Instrument
              </label>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((instr) => (
                  <button
                    key={instr}
                    onClick={() => toggleInstrument(instr)}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
                    style={chipStyle(selectedInstruments.includes(instr))}
                  >
                    {instr}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Filter */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                Session
              </label>
              <div className="flex flex-wrap gap-2">
                {SESSIONS.map((sess) => (
                  <button
                    key={sess}
                    onClick={() => toggleSession(sess)}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
                    style={chipStyle(selectedSessions.includes(sess))}
                  >
                    {sess}
                  </button>
                ))}
              </div>
            </div>

            {/* Setup Filter */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                Setup
              </label>
              <div className="flex flex-wrap gap-2">
                {SETUPS.map((setup) => (
                  <button
                    key={setup}
                    onClick={() => toggleSetup(setup)}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
                    style={chipStyle(selectedSetups.includes(setup))}
                  >
                    {setup}
                  </button>
                ))}
              </div>
            </div>

            {/* Result Filter */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                Result
              </label>
              <div className="flex gap-2">
                {['all', 'WIN', 'LOSS', 'BE', 'open'].map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResult(res)}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
                    style={chipStyle(selectedResult === res)}
                  >
                    {res === 'open' ? 'OPEN' : res}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: 'var(--card)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: 'var(--card)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedInstruments.length > 0 ||
              selectedSessions.length > 0 ||
              selectedSetups.length > 0 ||
              selectedResult !== 'all' ||
              startDate ||
              endDate) && (
              <button
                onClick={() => {
                  setSelectedInstruments([]);
                  setSelectedSessions([]);
                  setSelectedSetups([]);
                  setSelectedResult('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors border-0"
                style={{ color: 'var(--accent)', background: 'rgba(10, 132, 255, 0.1)' }}
              >
                Clear All Filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        {filteredAndSortedTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'var(--surface)' }}
            >
              <Image className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>No trades yet</h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-dim)' }}>
              Start documenting your trades to build your journal. Each trade logged helps
              you track patterns and improve your decision-making.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {/* Master select cell */}
                <th className="w-10 px-3 py-3 text-left">
                  {(() => {
                    const visibleIds = filteredAndSortedTrades.map(t => t.id);
                    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
                    const someSelected = visibleIds.some(id => selectedIds.has(id));
                    return (
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                        onChange={() => {
                          if (allSelected) {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              visibleIds.forEach(id => next.delete(id));
                              return next;
                            });
                          } else {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              visibleIds.forEach(id => next.add(id));
                              return next;
                            });
                          }
                        }}
                        className="cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    );
                  })()}
                </th>
                {[
                  { key: 'date', label: 'Date' },
                  { key: 'instrument', label: 'Instrument' },
                  { key: 'session', label: 'Session' },
                  { key: 'setup', label: 'Setup' },
                  { key: null, label: 'Tags' },
                  { key: null, label: 'Entries' },
                  { key: 'result', label: 'Result' },
                  { key: 'netR', label: 'Net R' },
                  { key: 'netPnl', label: 'Net P&L' },
                  { key: null, label: 'Actions', align: 'right' },
                ].map((col, i) => (
                  <th
                    key={i}
                    onClick={col.key ? () => handleSort(col.key) : undefined}
                    className={`px-4 py-3 text-${col.align || 'left'} text-xs font-semibold ${col.key ? 'cursor-pointer' : ''} transition-colors`}
                    style={{ color: 'var(--text-dim)' }}
                  >
                    <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                      {col.label}
                      {col.key && sortColumn === col.key && (
                        <span style={{ color: 'var(--accent)' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTrades.map((trade, idx) => {
                const isSelected = selectedIds.has(trade.id);
                return (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="group transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--blue-dim)' : 'transparent',
                  }}
                  onClick={() => openEditTrade(trade)}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Per-row checkbox */}
                  <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(trade.id)}
                      aria-label={`Select trade ${formatDate(trade.date)}`}
                      className="cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    <div className="flex items-center gap-1.5">
                      {formatDate(trade.date)}
                      {(trade.thesis || trade.notes || trade.lesson) && (
                        <FileText size={12} style={{ color: 'var(--accent)', opacity: 0.6, flexShrink: 0 }} title="Has journal entry" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {trade.instrument}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-dim)' }}>
                    {trade.session}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-dim)' }}>
                    {trade.setup}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap max-w-[180px]">
                      {(() => {
                        // Flatten tags-by-category, preserve which color each one belongs to
                        const flat = TAG_CATEGORIES.flatMap(cat =>
                          (trade.tags?.[cat.key] || []).map(t => ({ tag: t, color: cat.color }))
                        );
                        const visible = flat.slice(0, 3);
                        const overflow = flat.length - visible.length;
                        return (
                          <>
                            {visible.map(({ tag, color }, ti) => (
                              <span
                                key={ti}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                              >
                                {tag}
                              </span>
                            ))}
                            {overflow > 0 && (
                              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                +{overflow}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {renderEntryDots(trade.entries)}
                  </td>
                  <td className="px-4 py-3">
                    {renderResultTag(trade)}
                  </td>
                  <td className="px-4 py-3">
                    {renderNetR(trade)}
                  </td>
                  <td className="px-4 py-3">
                    {renderNetPnl(trade)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              'Are you sure you want to delete this trade? This cannot be undone.'
                            )
                          ) {
                            deleteTrade(trade.id);
                          }
                        }}
                        className="p-2 rounded-lg transition-colors border-0 cursor-pointer"
                        style={{ background: 'transparent', color: 'var(--red)' }}
                        title="Delete trade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Tag Picker */}
      <AnimatePresence>
        {bulkPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setBulkPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl w-full max-w-lg overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Add tags</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Tags will be appended to {selectedIds.size} selected trade{selectedIds.size === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => setBulkPickerOpen(false)}
                  className="p-1.5 rounded-lg cursor-pointer border-0"
                  style={{ background: 'transparent', color: 'var(--text-dim)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Categories */}
              <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
                {TAG_CATEGORIES.map(cat => {
                  const all = [
                    ...cat.options,
                    ...((customTags?.[cat.key] || []).filter(t => !cat.options.includes(t))),
                  ];
                  const sel = stagedTags[cat.key] || [];
                  return (
                    <div key={cat.key}>
                      <div className="text-[11px] font-semibold mb-2 uppercase tracking-wide" style={{ color: cat.color, opacity: 0.85 }}>
                        {cat.label}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {all.map(tag => {
                          const isOn = sel.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleStagedTag(cat.key, tag)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border-0 transition-all"
                              style={{
                                background: isOn ? cat.color : 'var(--surface)',
                                color: isOn ? '#fff' : 'var(--text-dim)',
                                border: isOn ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {stagedCount} tag{stagedCount === 1 ? '' : 's'} staged
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStagedTags({}); setBulkPickerOpen(false); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-0"
                    style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyBulkTags}
                    disabled={stagedCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-0 transition-opacity"
                    style={{
                      background: 'var(--accent)',
                      color: '#fff',
                      opacity: stagedCount === 0 ? 0.4 : 1,
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] rounded-lg overflow-hidden"
              style={{ background: 'var(--card)' }}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors z-10 border-0 cursor-pointer"
                style={{ background: 'var(--surface)', color: 'var(--text)' }}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={lightboxImage}
                alt="Trade screenshot"
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
