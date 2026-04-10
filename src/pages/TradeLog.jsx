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
  const [selectedResult, setSelectedResult] = useState('all'); // 'all', 'WIN', 'LOSS'
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

    // Search filter
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

    // Instrument filter
    if (selectedInstruments.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedInstruments.includes(trade.instrument)
      );
    }

    // Session filter
    if (selectedSessions.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedSessions.includes(trade.session)
      );
    }

    // Setup filter
    if (selectedSetups.length > 0) {
      filtered = filtered.filter((trade) =>
        selectedSetups.includes(trade.setup)
      );
    }

    // Result filter
    if (selectedResult !== 'all') {
      filtered = filtered.filter(
        (trade) => getIdeaResult(trade) === selectedResult
      );
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((trade) => new Date(trade.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((trade) => new Date(trade.date) <= end);
    }

    // Sort
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

      // Handle string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle numeric comparison
      if (sortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    return filtered;
  }, [trades, searchQuery, selectedInstruments, selectedSessions, selectedSetups, selectedResult, startDate, endDate, sortColumn, sortDirection]);

  // Toggle sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Toggle filter chips
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
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-2 h-2 rounded-full bg-gray-300" />
        </div>
      );
    }

    return (
      <div className="flex gap-1">
        {entries.slice(0, 3).map((entry, idx) => {
          let bgColor = 'bg-gray-300';
          if (entry.triggered === false) bgColor = 'bg-transparent border border-gray-300';
          if (entry.triggered === true) {
            bgColor = entry.result === 'W' ? 'bg-green-500' : 'bg-red-500';
          }
          if (entry.result === 'BE') bgColor = 'bg-gray-400';

          return (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${bgColor}`}
            />
          );
        })}
      </div>
    );
  };

  // Result tag rendering
  const renderResultTag = (trade) => {
    const result = getIdeaResult(trade);
    const bgColor = result === 'WIN' ? 'bg-green-100' : 'bg-red-100';
    const textColor = result === 'WIN' ? 'text-green-700' : 'text-red-700';

    return (
      <span className={`${bgColor} ${textColor} rounded-md px-2 py-0.5 text-xs font-medium`}>
        {result}
      </span>
    );
  };

  // Net R rendering
  const renderNetR = (trade) => {
    const netR = getNetR(trade);
    const textColor = netR >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={`${textColor} font-medium`}>{netR.toFixed(2)}R</span>;
  };

  // Net P&L rendering
  const renderNetPnl = (trade) => {
    const pnl = getNetPnl(trade);
    return (
      <span className={`font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatPnl(pnl)}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Behavioral Flags Banner */}
      <AnimatePresence>
        {behavioralFlags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-yellow-50 border-b border-yellow-200 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-900 text-sm">Behavioral Alerts</h3>
                </div>
                <div className="space-y-1">
                  {behavioralFlags.map((flag, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-yellow-800">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{flag.message}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setDismissedFlags(true)}
                className="text-yellow-600 hover:text-yellow-700 text-sm font-medium flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Trade Log</h1>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by instrument, setup, session, thesis, lesson..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showFilters ? 'rotate-180' : ''
              }`}
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
            className="border-b border-gray-200 bg-gray-50 px-6 py-4 space-y-4 overflow-y-auto"
          >
            {/* Instrument Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Instrument
              </label>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((instr) => (
                  <button
                    key={instr}
                    onClick={() => toggleInstrument(instr)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedInstruments.includes(instr)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {instr}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Session
              </label>
              <div className="flex flex-wrap gap-2">
                {SESSIONS.map((sess) => (
                  <button
                    key={sess}
                    onClick={() => toggleSession(sess)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedSessions.includes(sess)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {sess}
                  </button>
                ))}
              </div>
            </div>

            {/* Setup Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Setup
              </label>
              <div className="flex flex-wrap gap-2">
                {SETUPS.map((setup) => (
                  <button
                    key={setup}
                    onClick={() => toggleSetup(setup)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedSetups.includes(setup)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {setup}
                  </button>
                ))}
              </div>
            </div>

            {/* Result Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Result
              </label>
              <div className="flex gap-2">
                {['all', 'WIN', 'LOSS'].map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResult(res)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedResult === res
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
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
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Image className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No trades yet</h3>
            <p className="text-gray-600 text-sm max-w-sm">
              Start documenting your trades to build your journal. Each trade logged helps
              you track patterns and improve your decision-making.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Date
                    {sortColumn === 'date' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('instrument')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Instrument
                    {sortColumn === 'instrument' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('session')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Session
                    {sortColumn === 'session' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('setup')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Setup
                    {sortColumn === 'setup' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Entries
                </th>
                <th
                  onClick={() => handleSort('result')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Result
                    {sortColumn === 'result' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('netR')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Net R
                    {sortColumn === 'netR' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('netPnl')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Net P&L
                    {sortColumn === 'netPnl' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                  Screenshot
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTrades.map((trade, idx) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatDate(trade.date)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {trade.instrument}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {trade.session}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {trade.setup}
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
                  <td className="px-4 py-3 text-center">
                    {trade.screenshot && (
                      <button
                        onClick={() => setLightboxImage(trade.screenshot)}
                        className="inline-flex items-center justify-center p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="View screenshot"
                      >
                        <Image className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditTrade(trade)}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit trade"
                      >
                        <Edit3 className="w-4 h-4 text-blue-600" />
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
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete trade"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
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
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition-colors z-10"
              >
                <svg
                  className="w-6 h-6 text-gray-800"
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
