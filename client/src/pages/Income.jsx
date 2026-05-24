import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD, fmtDate, fmtRelativeDate, todayISO } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

const SOURCE_TYPES = [
  { v: 'salary',    l: 'Salary' },
  { v: 'bonus',     l: 'Bonus' },
  { v: 'freelance', l: 'Freelance' },
  { v: 'gift',      l: 'Gift' },
  { v: 'refund',    l: 'Refund' },
  { v: 'other',     l: 'Other' },
];

const STATUS_TONES = {
  received: 'text-success',
  partial:  'text-warning',
  pending:  'text-inkDim',
  overdue:  'text-danger',
  missed:   'text-danger',
};

export default function Income() {
  const [forecast, setForecast] = useState([]);
  const [entries,  setEntries]  = useState([]);
  const [sources,  setSources]  = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading, setLoading] = useState(true);

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry,   setEditingEntry]   = useState(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [editingSource,   setEditingSource]   = useState(null);
  const [allocateAfter,   setAllocateAfter]   = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, e, s, sum] = await Promise.all([
        api.get('/api/income/forecast'),
        api.get('/api/income/entries'),
        api.get('/api/income/sources'),
        api.get('/api/income/summary'),
      ]);
      setForecast(f.forecast);
      setEntries(e.entries);
      setSources(s.sources);
      setSummary(sum);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const overdue = useMemo(() => forecast.filter((f) => f.status === 'overdue'), [forecast]);

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Inflow</div>
            <h1 className="text-4xl mt-1">Income</h1>
            <p className="text-inkDim mt-2 text-sm max-w-2xl leading-relaxed">
              Track what you expect, log what actually arrives, watch the gap.
              Every received entry is an invitation to pay yourself first.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingSource(null); setShowSourceModal(true); }}
                    className="cw-btn-ghost text-sm">+ Source</button>
            <button onClick={() => { setEditingEntry(null); setShowEntryModal(true); }}
                    className="cw-btn-primary text-sm">+ Log income</button>
          </div>
        </header>

        {overdue.length > 0 && (
          <div className="cw-card border-l-2 border-danger p-4">
            <div className="cw-label text-danger">Overdue</div>
            {overdue.map((f) => (
              <div key={`${f.source_id}-${f.month}`} className="mt-2 text-sm">
                <span className="font-serif text-lg">{f.source_name}</span>
                <span className="text-inkDim ml-2">expected {fmtDate(f.expected_date)}</span>
                <span className="text-danger ml-2">· {f.days_overdue} day{f.days_overdue === 1 ? '' : 's'} late</span>
                <span className="text-inkDim ml-2">· {fmtUSD(f.expected_amount_usd_cents)}</span>
              </div>
            ))}
            <p className="text-xs text-inkDim mt-2 italic">
              Projections adjust to actual receipts, not expected ones.
            </p>
          </div>
        )}

        {summary && <SummaryStrip s={summary} />}

        {/* Expected forecast */}
        <section>
          <h2 className="font-serif text-2xl mb-3">Expected</h2>
          {forecast.length === 0 ? (
            <div className="cw-card p-6 text-inkDim text-sm text-center">
              No recurring income sources yet. Add one to begin forecasting.
            </div>
          ) : (
            <div className="cw-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                    <th className="text-left  px-4 py-2 font-medium">Source</th>
                    <th className="text-left  px-4 py-2 font-medium">Month</th>
                    <th className="text-left  px-4 py-2 font-medium">Expected</th>
                    <th className="text-right px-4 py-2 font-medium">Expected USD</th>
                    <th className="text-right px-4 py-2 font-medium">Received</th>
                    <th className="text-right px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((f) => (
                    <tr key={`${f.source_id}-${f.month}`} className="border-b border-line/30 last:border-0 hover:bg-surface2/50">
                      <td className="px-4 py-2">{f.source_name}</td>
                      <td className="px-4 py-2 text-inkDim">{f.month}</td>
                      <td className="px-4 py-2 text-inkDim">{fmtDate(f.expected_date)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtUSD(f.expected_amount_usd_cents)}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {f.received_usd_cents > 0
                          ? <span className="text-success">{fmtUSD(f.received_usd_cents)}</span>
                          : <span className="text-inkDim">—</span>}
                      </td>
                      <td className={`px-4 py-2 text-right uppercase text-[10px] tracking-wider ${STATUS_TONES[f.status] ?? ''}`}>
                        {f.status}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => {
                            setEditingEntry({
                              source_id: f.source_id,
                              amount_usd: (f.expected_amount_usd_cents / 100).toFixed(2),
                              received_date: todayISO(),
                              expected_date: f.expected_date,
                              expected_amount_usd: (f.expected_amount_usd_cents / 100).toFixed(2),
                              status: 'received',
                            });
                            setShowEntryModal(true);
                          }}
                          className="cw-btn-ghost text-xs"
                        >
                          Mark received
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Entry log */}
        <section>
          <h2 className="font-serif text-2xl mb-3">Log</h2>
          <div className="cw-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                  <th className="text-left  px-4 py-2 font-medium">Received</th>
                  <th className="text-left  px-4 py-2 font-medium">Source</th>
                  <th className="text-left  px-4 py-2 font-medium">Note</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="6" className="text-center text-inkDim py-8">Loading…</td></tr>}
                {!loading && entries.length === 0 && (
                  <tr><td colSpan="6" className="text-center text-inkDim py-8">
                    No income logged yet.
                  </td></tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-line/30 last:border-0 hover:bg-surface2/50">
                    <td className="px-4 py-2 text-inkDim">{fmtDate(e.received_date)}</td>
                    <td className="px-4 py-2">{e.source_name ?? <span className="text-inkDim italic">one-off</span>}</td>
                    <td className="px-4 py-2 text-inkDim text-xs max-w-xs truncate">{e.note ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtUSD(e.amount_usd_cents)}</td>
                    <td className={`px-4 py-2 text-right uppercase text-[10px] tracking-wider ${STATUS_TONES[e.status] ?? ''}`}>
                      {e.status}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditingEntry(e); setShowEntryModal(true); }}
                              className="text-inkDim hover:text-ink text-xs mr-3">Edit</button>
                      <button onClick={async () => {
                        if (!confirm('Soft-delete this income entry?')) return;
                        await api.del(`/api/income/entries/${e.id}`); await load();
                      }} className="text-inkDim hover:text-danger text-xs">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sources */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-2xl">Sources</h2>
            <button onClick={() => { setEditingSource(null); setShowSourceModal(true); }}
                    className="cw-btn-ghost text-sm">+ Add source</button>
          </div>
          <div className="space-y-2">
            {sources.length === 0 && (
              <div className="cw-card p-6 text-inkDim text-sm text-center">No sources yet.</div>
            )}
            {sources.map((s) => (
              <div key={s.id} className="cw-card p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-lg">
                    {s.name}
                    <span className="text-inkDim text-xs ml-2 uppercase tracking-wider">{s.type}</span>
                  </div>
                  <div className="text-xs text-inkDim mt-0.5">
                    {s.is_recurring
                      ? <>recurring · <span className="font-mono">{fmtUSD(s.expected_amount_usd_cents)}</span>
                          {s.expected_day_of_month ? <> on day {s.expected_day_of_month}</> : ''}</>
                      : 'one-off'}
                  </div>
                </div>
                <div className="flex gap-1 text-xs">
                  <button onClick={() => { setEditingSource(s); setShowSourceModal(true); }}
                          className="cw-btn-ghost">Edit</button>
                  <button onClick={async () => {
                    if (!confirm('Archive this source? Entries are kept.')) return;
                    await api.del(`/api/income/sources/${s.id}`); await load();
                  }} className="cw-btn-ghost hover:text-danger">Archive</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showEntryModal && (
        <EntryModal
          editing={editingEntry}
          sources={sources}
          onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
          onSaved={async (createdEntry) => {
            setShowEntryModal(false); setEditingEntry(null);
            await load();
            // Allocate-on-receipt for new received entries.
            if (createdEntry && (createdEntry.status === 'received' || createdEntry.status === 'partial')) {
              setAllocateAfter(createdEntry);
            }
          }}
        />
      )}

      {showSourceModal && (
        <SourceModal
          editing={editingSource}
          onClose={() => { setShowSourceModal(false); setEditingSource(null); }}
          onSaved={async () => { setShowSourceModal(false); setEditingSource(null); await load(); }}
        />
      )}

      {allocateAfter && (
        <AllocateModal
          entry={allocateAfter}
          onClose={() => setAllocateAfter(null)}
          onDone={async () => { setAllocateAfter(null); await load(); }}
        />
      )}
    </AuthedShell>
  );
}

function SummaryStrip({ s }) {
  const actualPct = s.expected_this_month_usd_cents > 0
    ? Math.round((s.actual_this_month_usd_cents / s.expected_this_month_usd_cents) * 100)
    : null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Tile label="Actual · this month" value={fmtUSD(s.actual_this_month_usd_cents)} />
      <Tile label="Expected · this month" value={fmtUSD(s.expected_this_month_usd_cents)}
            sub={actualPct != null && <span className={actualPct >= 100 ? 'text-success' : 'text-warning'}>{actualPct}% received</span>} />
      <Tile label="Effective monthly (3-mo avg)" value={fmtUSD(s.effective_monthly_usd_cents)} tone="text-gold" />
      <Tile label="Reliability score"
            value={s.reliability_score == null ? '—' : `${Math.round(s.reliability_score * 100)}%`}
            tone={s.reliability_score == null ? 'text-inkDim' : s.reliability_score >= 0.9 ? 'text-success' : s.reliability_score >= 0.6 ? 'text-warning' : 'text-danger'}
            sub={s.avg_delay_days != null && (
              <span className="text-inkDim">avg {s.avg_delay_days >= 0 ? `+${s.avg_delay_days.toFixed(0)}` : s.avg_delay_days.toFixed(0)}d delay</span>
            )} />
    </div>
  );
}
function Tile({ label, value, tone, sub }) {
  return (
    <div className="cw-card p-4">
      <div className="cw-label">{label}</div>
      <div className={`font-serif text-2xl mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
      {sub && <div className="text-xs mt-1">{sub}</div>}
    </div>
  );
}

function EntryModal({ editing, sources, onClose, onSaved }) {
  const isEdit = !!editing?.id;
  const [sourceId, setSourceId] = useState(editing?.source_id ?? '');
  const [amount,   setAmount]   = useState(
    editing?.amount_usd ?? (editing?.amount_usd_cents != null ? (editing.amount_usd_cents / 100).toFixed(2) : '')
  );
  const [receivedDate, setReceivedDate] = useState(editing?.received_date ?? todayISO());
  const [expectedDate, setExpectedDate] = useState(editing?.expected_date ?? '');
  const [note,   setNote]   = useState(editing?.note ?? '');
  const [status, setStatus] = useState(editing?.status ?? 'received');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const v = parseFloat(amount);
    if (!Number.isFinite(v) || v <= 0) { setErr('Positive amount required.'); return; }
    setBusy(true);
    try {
      const body = {
        source_id: sourceId ? Number(sourceId) : null,
        amount_usd: v,
        received_date: receivedDate,
        expected_date: expectedDate || null,
        note: note || undefined,
        status,
      };
      const r = isEdit
        ? await api.put(`/api/income/entries/${editing.id}`, body)
        : await api.post('/api/income/entries', body);
      await onSaved(r.entry);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={isEdit ? 'Edit income entry' : 'Log income'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="cw-label block mb-1">Source</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="cw-input w-full">
            <option value="">One-off (no source)</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cw-label block mb-1">Amount (USD)</label>
            <input autoFocus type="number" min="0.01" step="0.01"
                   value={amount} onChange={(e) => setAmount(e.target.value)} required
                   className="cw-input w-full font-mono text-xl" />
          </div>
          <div>
            <label className="cw-label block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="cw-input w-full">
              <option value="received">Received (in full)</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cw-label block mb-1">Received date</label>
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)}
                   max={todayISO()} className="cw-input w-full" required />
          </div>
          <div>
            <label className="cw-label block mb-1">Expected date (opt.)</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                   className="cw-input w-full" />
          </div>
        </div>
        <div>
          <label className="cw-label block mb-1">Note (opt.)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                 className="cw-input w-full" placeholder="e.g. partial — rest promised next week" />
        </div>
        {err && <div className="text-danger text-sm">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
          <button disabled={busy} className="cw-btn-primary">{busy ? '…' : (isEdit ? 'Save' : 'Log')}</button>
        </div>
      </form>
    </Modal>
  );
}

function SourceModal({ editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState(editing?.type ?? 'salary');
  const [amount, setAmount] = useState(
    editing ? (editing.expected_amount_usd_cents / 100).toFixed(0) : ''
  );
  const [day, setDay] = useState(editing?.expected_day_of_month ?? '');
  const [recurring, setRecurring] = useState(editing ? !!editing.is_recurring : true);
  const [active, setActive] = useState(editing ? !!editing.is_active : true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Name required.'); return; }
    setBusy(true);
    try {
      const body = {
        name, type,
        expected_amount_usd: parseFloat(amount) || 0,
        expected_day_of_month: day ? Number(day) : null,
        is_recurring: recurring,
        is_active: active,
      };
      if (isEdit) await api.put(`/api/income/sources/${editing.id}`, body);
      else        await api.post('/api/income/sources', body);
      await onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={isEdit ? 'Edit source' : 'New income source'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="cw-label block mb-1">Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="cw-input w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cw-label block mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="cw-input w-full">
              {SOURCE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="cw-label block mb-1">Expected day of month</label>
            <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)}
                   className="cw-input w-full font-mono" />
          </div>
        </div>
        <div>
          <label className="cw-label block mb-1">Expected amount (USD)</label>
          <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                 className="cw-input w-full font-mono" />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Recurring
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>
        {err && <div className="text-danger text-sm">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
          <button disabled={busy} className="cw-btn-primary">{busy ? '…' : (isEdit ? 'Save' : 'Create')}</button>
        </div>
      </form>
    </Modal>
  );
}

function AllocateModal({ entry, onClose, onDone }) {
  const [goals, setGoals] = useState([]);
  const [splits, setSplits] = useState({}); // { [goalId]: usdString }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/api/goals').then((r) => setGoals(r.goals.filter((g) => g.remaining_usd_cents > 0))).catch(() => {});
  }, []);

  const totalAlloc = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const incomeUsd = entry.amount_usd_cents / 100;
  const remaining = incomeUsd - totalAlloc;

  const submit = async () => {
    setErr(null);
    if (totalAlloc < 0 || totalAlloc > incomeUsd + 0.0001) {
      setErr('Allocations exceed the received amount.');
      return;
    }
    setBusy(true);
    try {
      for (const [gid, v] of Object.entries(splits)) {
        const usd = parseFloat(v);
        if (!Number.isFinite(usd) || usd <= 0) continue;
        await api.post(`/api/goals/${gid}/contributions`, { amount_usd: usd });
      }
      await onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Pay yourself first" onClose={onClose}>
      <p className="text-sm text-inkDim">
        <span className="font-mono text-ink">{fmtUSD(entry.amount_usd_cents)}</span> received.
        Allocate any portion to a goal before it gets absorbed into spending.
      </p>
      <div className="mt-4 space-y-2">
        {goals.length === 0 && (
          <div className="text-inkDim text-sm">All goals are funded. Nothing to allocate to.</div>
        )}
        {goals.map((g) => (
          <div key={g.id} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-serif text-lg">{g.name}</div>
              <div className="text-xs text-inkDim">{fmtUSD(g.remaining_usd_cents)} to go</div>
            </div>
            <div className="w-28">
              <input type="number" min="0" step="0.01"
                     value={splits[g.id] ?? ''}
                     onChange={(e) => setSplits({ ...splits, [g.id]: e.target.value })}
                     placeholder="0"
                     className="cw-input w-full text-right font-mono" />
            </div>
            <span className="text-inkDim text-xs">USD</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-inkDim">Remaining to spending:</span>
        <span className={`font-mono ${remaining < 0 ? 'text-danger' : 'text-ink'}`}>${remaining.toFixed(2)}</span>
      </div>
      {err && <div className="text-danger text-sm mt-2">{err}</div>}
      <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-line">
        <button onClick={onClose} className="cw-btn-ghost">Keep as available</button>
        <button onClick={submit} disabled={busy || totalAlloc === 0}
                className="cw-btn-primary">{busy ? '…' : 'Allocate'}</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-bg/90 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="cw-card w-full max-w-lg p-6 cw-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl">{title}</h2>
          <button onClick={onClose} className="cw-btn-ghost">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
