// ═══════════════════════════════════════════════════
// LOCAL SNAPSHOTS — last-resort safety net in localStorage
//
// Supabase is the source of truth, but a server-side clobber (bad import,
// multi-device overwrite, paused project) used to be unrecoverable because
// the free tier has no point-in-time restore. These snapshots give the user
// a local copy to fall back on: one automatic snapshot per day (taken after
// a successful pull) plus a snapshot before every destructive import.
//
// Screenshots are stripped — base64 images would blow the ~5MB localStorage
// quota after a handful of trades. Structured data is what matters here.
// ═══════════════════════════════════════════════════

const MAX_SNAPSHOTS = 14;
const keyFor = (userId) => `rsj-snapshots-${userId}`;

const stripScreenshots = (state) => ({
  ...state,
  trades: (state.trades || []).map(t =>
    t.screenshot ? { ...t, screenshot: null, screenshotStripped: true } : t
  ),
});

export function listSnapshots(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// label: 'auto' (daily) | 'pre-import'
// Auto snapshots are deduped to one per calendar day; labeled ones always save.
export function saveSnapshot(state, userId, label = 'auto') {
  if (!userId || !state) return;
  const today = new Date().toISOString().slice(0, 10);
  let list = listSnapshots(userId);

  if (label === 'auto' && list.some(s => s.label === 'auto' && s.date === today)) return;

  const snap = {
    date: today,
    takenAt: new Date().toISOString(),
    label,
    tradeCount: (state.trades || []).length,
    state: stripScreenshots(state),
  };
  list = [snap, ...list].slice(0, MAX_SNAPSHOTS);

  // Quota-safe: on failure evict oldest snapshots until it fits (or give up).
  while (list.length > 0) {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, list.length - 1);
    }
  }
}

export function downloadSnapshot(snap) {
  const blob = new Blob([JSON.stringify(snap.state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risk-sink-snapshot-${snap.date}${snap.label !== 'auto' ? `-${snap.label}` : ''}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
