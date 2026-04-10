import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Trash2,
  Edit3,
  AlertTriangle,
  ChevronDown,
  Image,
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
} from '../lib/store';

export default function TradeLog({
  state,
  openEditTrade,
  deleteTrade,
}) {
  const { trades, accounts, settings } = state;

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
      filtered = filtered.filter(
        (trade) => getIdeaResult(trade) === selectedResult
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
      <div className="flex gap-1">
        {entries.slice(0, 3).map((entry, idx) => {
          let bg = 'var(--text-muted)';
          let border = 'none';
          if (entry.triggered === false) {
            bg = 'transparent';
            border = '1px solid var(--text-muted)';
          }
          if (entry.triggered === true) {
            bg = entry.result === 'W' ? 'var(--green)' : 'var(--red)';
          }
          if (entry.result === 'BE') bg = 'var(--text-muted)';

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

  // Result tag rendering
  const renderResultTag = (trade) => {
    const result = getIdeaResult(trade);
    return (
      <span
        className="rounded-md px-2 py-0.5 text-xs font-medium"
        style={{
          background: result === 'WIN' ? 'var(--green-dim)' : 'var(--red-dim)',
          color: result === 'WIN' ? 'var(--green)' : 'var(--red)',
        }}
      >
        {result}
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
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>Trade Log</h1>
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
                {['all', 'WIN', 'LOSS'].map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResult(res)}
                    className="px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
                    style={chipStyle(selectedResult === res)}
                  >
                    {res}
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
              {filteredAndSortedTrades.map((trade, idx) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="group transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {formatDate(trade.date)}
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
                      {[...(trade.tags?.confirmations || []), ...(trade.tags?.conditions || []), ...(trade.tags?.mistakes || [])].slice(0, 3).map((tag, ti) => {
                        const isMistake = (trade.tags?.mistakes || []).includes(tag);
                        const isConfirm = (trade.tags?.confirmations || []).includes(tag);
                        return (
                          <span key={ti} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: isMistake ? 'var(--red-dim)' : isConfirm ? 'var(--green-dim)' : 'var(--blue-dim)',
                              color: isMistake ? 'var(--red)' : isConfirm ? 'var(--green)' : 'var(--accent)',
                            }}>
                            {tag}
                          </span>
                        );
                      })}
                      {((trade.tags?.confirmations?.length || 0) + (trade.tags?.conditions?.length || 0) + (trade.tags?.mistakes?.length || 0)) > 3 && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          +{((trade.tags?.confirmations?.length || 0) + (trade.tags?.conditions?.length || 0) + (trade.tags?.mistakes?.length || 0)) - 3}
                        </span>
                      )}
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
                        onClick={() => openEditTrade(trade)}
                        className="p-2 rounded-lg transition-colors border-0 cursor-pointer"
                        style={{ background: 'transparent', color: 'var(--accent)' }}
                        title="Edit trade"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
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
              ))}
            </tbody>
          </table>
        )}
      </div>

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
