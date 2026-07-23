import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, AlertCircle, CheckCircle, X, Bot } from 'lucide-react';
import { getBotAccounts, BROKER_LABEL, formatPnl } from '../lib/store';
import { processCsv, REQUIRED_FIELDS } from '../lib/csvImport';

const BOT_ACCENT = '#a855f7';

// Field labels shown in the column-mapping preview
const FIELD_LABELS = {
  externalId: 'Trade ID',
  symbol: 'Symbol',
  side: 'Side',
  qty: 'Quantity',
  entryPrice: 'Entry Price',
  exitPrice: 'Exit Price',
  entryTs: 'Entry Time',
  exitTs: 'Exit Time',
  pnl: 'P&L',
  fees: 'Fees',
  accountLabel: 'Account Label',
};

export default function ImportBotTrades({ state, importBotTrades }) {
  const fileInputRef = useRef(null);
  const [csvText, setCsvText] = useState(null);
  const [fileName, setFileName] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { count, dupes, errors } after import
  // Naive CSV timestamps are interpreted in this zone (futures exports are
  // conventionally US/Eastern). 'local' = this computer's timezone.
  const [csvTz, setCsvTz] = useState('America/New_York');
  // Most broker "Realized P&L" columns are already net of commissions;
  // unchecking makes the app subtract the Fees column itself.
  const [feesIncluded, setFeesIncluded] = useState(true);

  const botAccounts = useMemo(() => getBotAccounts(state.accounts || []), [state.accounts]);
  const selectedAccount = botAccounts.find(a => a.id === accountId) || null;

  // Source string is derived from the selected account's broker
  const source = selectedAccount ? `${selectedAccount.broker}-csv` : null;

  // Process the CSV (parse + dedupe) reactively whenever the inputs change
  const processed = useMemo(() => {
    if (!csvText || !selectedAccount || !source) return null;
    return processCsv(csvText, selectedAccount, source, state.botTrades || [], { tz: csvTz, feesIncluded });
  }, [csvText, selectedAccount, source, state.botTrades, csvTz, feesIncluded]);

  const handleFileChoose = (file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target.result);
    reader.onerror = () => alert('Failed to read file');
    reader.readAsText(file);
  };

  const onFileInput = (e) => handleFileChoose(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    handleFileChoose(e.dataTransfer.files?.[0]);
  };

  const reset = () => {
    setCsvText(null);
    setFileName('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!processed || processed.fresh.length === 0) return;
    setImporting(true);
    try {
      await importBotTrades(processed.fresh);
      const errorCount = processed.rows.filter(r => !r.ok).length;
      setResult({
        added: processed.fresh.length,
        duplicates: processed.duplicates.length,
        errors: errorCount,
      });
    } catch (err) {
      alert('Import failed: ' + (err?.message || err));
    } finally {
      setImporting(false);
    }
  };

  // ── Empty state: no bot accounts yet ──
  if (botAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            Import Bot Trades
          </h1>
        </div>
        <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <Bot size={40} className="mx-auto mb-3" style={{ color: BOT_ACCENT }} />
          <div className="text-sm font-medium text-white">No bot accounts to import into</div>
          <div className="text-xs text-gray-400 mt-1">Go to the Accounts page and add a Bot Account first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          Import Bot Trades
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          Drop a trade-history CSV from Tradovate (Lucid/Tradeify) or TopstepX. Re-importing the same file is safe — duplicates are skipped automatically.
        </p>
      </div>

      {/* Step 1: pick the account */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">1 · Choose the bot account</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {botAccounts.map(a => (
            <button
              key={a.id}
              onClick={() => setAccountId(a.id)}
              className="text-left p-3 rounded-xl border cursor-pointer transition-all"
              style={{
                borderColor: accountId === a.id ? BOT_ACCENT : 'var(--border)',
                background: accountId === a.id ? 'rgba(168,85,247,0.08)' : 'var(--surface)',
                outline: accountId === a.id ? `1px solid ${BOT_ACCENT}` : 'none',
              }}
            >
              <div className="font-semibold text-white text-sm">{a.name}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {BROKER_LABEL[a.broker] || a.broker}
                {a.propFirm && ` · ${a.propFirm}`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: file drop */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">2 · Drop your CSV</div>

        {!csvText ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors"
            style={{
              borderColor: selectedAccount ? 'var(--border)' : 'var(--surface)',
              opacity: selectedAccount ? 1 : 0.5,
              pointerEvents: selectedAccount ? 'auto' : 'none',
              background: 'var(--surface)',
            }}
          >
            <Upload size={28} className="mx-auto mb-3" style={{ color: BOT_ACCENT }} />
            <div className="text-sm font-medium text-white">
              {selectedAccount ? 'Drop CSV here or click to browse' : 'Choose an account first'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Tradovate Trades export · TopstepX Trades export</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface)' }}>
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: BOT_ACCENT }} />
                <span className="text-sm font-medium text-white">{fileName}</span>
              </div>
              <button
                onClick={reset}
                className="p-1 cursor-pointer border-0 bg-transparent"
                style={{ color: 'var(--text-muted)' }}
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>

            {/* Interpretation options */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl text-xs" style={{ background: 'var(--surface)' }}>
              <label className="flex items-center gap-2">
                <span style={{ color: 'var(--text-dim)' }}>CSV times are in</span>
                <select
                  value={csvTz}
                  onChange={(e) => setCsvTz(e.target.value)}
                  className="px-2 py-1 rounded-md border-0 cursor-pointer"
                  style={{ background: 'var(--card)', color: 'var(--text)' }}
                >
                  <option value="America/New_York">US Eastern (futures standard)</option>
                  <option value="America/Chicago">US Central (CME)</option>
                  <option value="UTC">UTC</option>
                  <option value="local">This computer's timezone</option>
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feesIncluded}
                  onChange={(e) => setFeesIncluded(e.target.checked)}
                />
                <span style={{ color: 'var(--text-dim)' }}>
                  P&L column already includes fees
                  <span className="opacity-60"> (uncheck to subtract the Fees column separately)</span>
                </span>
              </label>
            </div>

            {/* Detected mapping */}
            {processed && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">Column mapping</div>
                {processed.missing.length > 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold mb-1">Missing required columns</div>
                      <div>
                        Couldn't find columns for: {processed.missing.map(f => FIELD_LABELS[f] || f).join(', ')}.
                      </div>
                      <div className="mt-1.5 opacity-80">
                        Detected headers in your file: <span className="font-mono">{processed.headers.join(', ')}</span>
                      </div>
                      <div className="mt-1.5 opacity-80">
                        Rename the relevant column in your CSV (e.g. to "Trade ID", "Symbol", "Qty", "P&L", "Exit Time") and re-upload.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(processed.mapping).map(([field, header]) => (
                      <div key={field} className="p-2 rounded-lg text-xs" style={{ background: 'var(--surface)' }}>
                        <div className="text-gray-500 text-[10px] uppercase tracking-wide">
                          {FIELD_LABELS[field] || field}
                          {REQUIRED_FIELDS.includes(field) && <span className="ml-1" style={{ color: BOT_ACCENT }}>*</span>}
                        </div>
                        <div className="text-white font-medium truncate" title={header || '—'}>
                          {header || <span className="text-gray-600 italic">not found</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            {processed && processed.missing.length === 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">Preview</div>
                <PreviewStats processed={processed} />
                <PreviewTable processed={processed} accountName={selectedAccount?.name} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: import button & result */}
      {processed && processed.missing.length === 0 && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
              {processed.fresh.length === 0 ? (
                'Nothing new to import — every row in this CSV is already in the journal.'
              ) : (
                <>Ready to import <span className="font-bold text-white">{processed.fresh.length}</span> new trade{processed.fresh.length !== 1 ? 's' : ''}.</>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={importing || processed.fresh.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white keep-white border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: BOT_ACCENT }}
            >
              {importing ? 'Importing…' : `Import ${processed.fresh.length}`}
            </button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'var(--green-dim)', color: 'var(--green)' }}
              >
                <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold">Imported {result.added} trade{result.added !== 1 ? 's' : ''}</div>
                  <div className="opacity-80 mt-0.5">
                    {result.duplicates > 0 && <>Skipped {result.duplicates} duplicate{result.duplicates !== 1 ? 's' : ''}. </>}
                    {result.errors > 0 && <>Skipped {result.errors} unparseable row{result.errors !== 1 ? 's' : ''}.</>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function PreviewStats({ processed }) {
  const totalRows = processed.rows.length;
  const validRows = processed.rows.filter(r => r.ok).length;
  const invalidRows = totalRows - validRows;
  const totalPnl = processed.fresh.reduce((s, t) => s + (Number(t.pnl) || 0) - (Number(t.fees) || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <Stat label="Total rows" value={totalRows} />
      <Stat label="New" value={processed.fresh.length} accent={BOT_ACCENT} />
      <Stat label="Duplicates" value={processed.duplicates.length} accent="var(--text-muted)" />
      <Stat label="Net P&L (new)" value={formatPnl(totalPnl)} accent={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
      {invalidRows > 0 && <Stat label="Unparseable" value={invalidRows} accent="var(--red)" />}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold" style={{ color: accent || 'var(--text)' }}>{value}</div>
    </div>
  );
}

function PreviewTable({ processed, accountName }) {
  const sample = processed.fresh.slice(0, 5);
  if (sample.length === 0) {
    return <div className="text-xs text-gray-500 italic">No new rows to preview.</div>;
  }
  const fmtTs = (iso) => new Date(iso).toLocaleString();
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'var(--surface)' }}>
            <th className="text-left px-2 py-1.5 font-semibold opacity-60">Symbol</th>
            <th className="text-left px-2 py-1.5 font-semibold opacity-60">Side</th>
            <th className="text-right px-2 py-1.5 font-semibold opacity-60">Qty</th>
            <th className="text-left px-2 py-1.5 font-semibold opacity-60">Exit</th>
            <th className="text-right px-2 py-1.5 font-semibold opacity-60">P&L</th>
            <th className="text-right px-2 py-1.5 font-semibold opacity-60">Fees</th>
          </tr>
        </thead>
        <tbody>
          {sample.map((t, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="px-2 py-1.5 text-white">{t.symbol}</td>
              <td className="px-2 py-1.5 text-white uppercase">{t.side || '—'}</td>
              <td className="px-2 py-1.5 text-right text-white">{t.qty}</td>
              <td className="px-2 py-1.5 text-gray-400">{fmtTs(t.exit_ts)}</td>
              <td className="px-2 py-1.5 text-right font-mono" style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPnl(t.pnl)}</td>
              <td className="px-2 py-1.5 text-right text-gray-500">${(Number(t.fees) || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {processed.fresh.length > 5 && (
        <div className="px-2 py-1.5 text-[11px] text-gray-500 text-center" style={{ background: 'var(--surface)' }}>
          …{processed.fresh.length - 5} more new row{processed.fresh.length - 5 !== 1 ? 's' : ''} not shown
        </div>
      )}
      <div className="px-2 py-1.5 text-[10px] text-gray-500" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        All rows will be tagged to <span className="text-white font-medium">{accountName}</span>. Strategy is resolved per-row from the assignment timeline at exit time.
      </div>
    </div>
  );
}
