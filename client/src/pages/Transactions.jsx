import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api.js';
import {
  fmtUSD, fmtIQD, fmtRelativeDate, iqdToUsdCents, todayISO,
} from '../lib/format.js';
import { SPENDING_CATEGORIES, TX_TYPES } from '../lib/categories.js';
import { AuthedShell } from '../components/Layout.jsx';
import { JustificationModal } from '../components/JustificationModal.jsx';

export default function Transactions() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat)  params.set('category', filterCat);
      if (filterUser) params.set('userId',   filterUser);
      const r = await api.get('/api/transactions?' + params.toString());
      setTxns(r.transactions);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/api/auth/users').then((r) => setUsers(r.users)).catch(() => {});
  }, []);
  useEffect(() => { load().catch(() => {}); }, [filterCat, filterUser]);

  const monthTotal = useMemo(() => {
    const m = todayISO().slice(0, 7);
    return txns
      .filter((t) => String(t.created_at).slice(0, 7) === m)
      .reduce((sum, t) => sum + t.amount_usd_cents, 0);
  }, [txns]);

  const onSaved = async () => {
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm('Soft-delete this transaction? It stays in the audit trail.')) return;
    await api.del(`/api/transactions/${id}`);
    await load();
  };

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Ledger</div>
            <h1 className="text-4xl mt-1">Allocations</h1>
            <p className="text-inkDim mt-2 text-sm">
              This month allocated: <span className="text-ink font-mono">{fmtUSD(monthTotal, { cents: true })}</span>
            </p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="cw-btn-primary">
            + Log allocation
          </button>
        </header>

        <div className="cw-card p-4 flex items-center gap-4 flex-wrap">
          <div>
            <label className="cw-label block mb-1">Category</label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="cw-input">
              <option value="">All</option>
              {SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="cw-label block mb-1">User</label>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="cw-input">
              <option value="">All</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {(filterCat || filterUser) && (
            <button onClick={() => { setFilterCat(''); setFilterUser(''); }} className="cw-btn-ghost text-sm self-end">
              Clear filters
            </button>
          )}
        </div>

        <div className="cw-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                <th className="text-left  px-4 py-2 font-medium">When</th>
                <th className="text-left  px-4 py-2 font-medium">Who</th>
                <th className="text-left  px-4 py-2 font-medium">Category</th>
                <th className="text-left  px-4 py-2 font-medium">Note</th>
                <th className="text-left  px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">USD</th>
                <th className="text-right px-4 py-2 font-medium">IQD</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="text-center text-inkDim py-8">Loading…</td></tr>}
              {!loading && txns.length === 0 && (
                <tr><td colSpan="8" className="text-center text-inkDim py-10">No allocations yet. Log your first one.</td></tr>
              )}
              {txns.map((t) => (
                <tr key={t.id} className="border-b border-line/30 last:border-0 hover:bg-surface2/60">
                  <td className="px-4 py-3 text-inkDim">{fmtRelativeDate(t.created_at)}</td>
                  <td className="px-4 py-3">{t.user_name}</td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3 text-inkDim text-xs max-w-xs truncate" title={t.note ?? ''}>
                    {t.note || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.type ? <TypeBadge type={t.type} /> : <span className="text-inkDim/60">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtUSD(t.amount_usd_cents, { cents: true })}</td>
                  <td className="px-4 py-3 text-right font-mono text-inkDim text-xs">
                    {t.amount_iqd != null ? fmtIQD(t.amount_iqd) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(t); setShowForm(true); }} className="text-inkDim hover:text-ink text-xs mr-3">Edit</button>
                    <button onClick={() => remove(t.id)} className="text-inkDim hover:text-danger text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <TxFormModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={onSaved}
        />
      )}
    </AuthedShell>
  );
}

function TypeBadge({ type }) {
  const styles = {
    need:       'bg-success/20 text-success',
    want:       'bg-warning/20 text-warning',
    investment: 'bg-gold/20    text-gold',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${styles[type] ?? ''}`}>
      {type}
    </span>
  );
}

function TxFormModal({ editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [currency, setCurrency] = useState('USD');
  const [usd, setUsd]     = useState(editing ? (editing.amount_usd_cents / 100).toFixed(2) : '');
  const [iqd, setIqd]     = useState('');
  const [category, setCategory] = useState(editing?.category ?? SPENDING_CATEGORIES[0]);
  const [note, setNote]   = useState(editing?.note ?? '');
  const [type, setType]   = useState(editing?.type ?? '');
  const [date, setDate]   = useState(editing ? String(editing.created_at).slice(0, 10) : todayISO());
  const [rate, setRate]   = useState(null);
  const [threshold, setThreshold] = useState(20);
  const [err, setErr]     = useState(null);
  const [busy, setBusy]   = useState(false);
  const [showJustify, setShowJustify] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    api.get('/api/rates/current').then((r) => setRate(r.rate)).catch(() => {});
    api.get('/api/settings').then((r) => {
      const t = Number(r.settings?.friction_threshold_usd);
      if (Number.isFinite(t)) setThreshold(t);
    }).catch(() => {});
  }, []);

  const previewIqd = useMemo(() => {
    if (!rate || !usd) return null;
    return Math.round(parseFloat(usd) * rate.rate_iqd_per_usd);
  }, [usd, rate]);
  const previewUsd = useMemo(() => {
    if (!rate || !iqd) return null;
    return iqdToUsdCents(parseFloat(iqd), rate.rate_iqd_per_usd);
  }, [iqd, rate]);

  // Final USD cents resolved from whichever input is active.
  const resolveCents = () => {
    if (currency === 'USD') {
      const v = parseFloat(usd);
      if (!Number.isFinite(v) || v <= 0) return null;
      return Math.round(v * 100);
    }
    if (!rate) return null;
    const v = parseFloat(iqd);
    if (!Number.isFinite(v) || v <= 0) return null;
    return iqdToUsdCents(v, rate.rate_iqd_per_usd);
  };

  const buildBody = (extra = {}) => {
    const body = {
      category,
      note: note || undefined,
      type: type || undefined,
      created_at: date,
      ...extra,
    };
    if (currency === 'USD') body.amount_usd_cents = Math.round(parseFloat(usd) * 100);
    else                    body.amount_iqd = parseFloat(iqd);
    return body;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const cents = resolveCents();
    if (cents == null) { setErr('Enter a valid amount.'); return; }

    // Editing skips friction — the decision was already made.
    if (!isEdit && cents >= threshold * 100) {
      setPendingPayload(buildBody());
      setShowJustify(true);
      return;
    }
    await persist(buildBody());
  };

  const persist = async (body) => {
    setBusy(true);
    try {
      if (isEdit) await api.put(`/api/transactions/${editing.id}`, body);
      else        await api.post('/api/transactions', body);
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onJustified = async ({ type: t, canWait, whyNow }) => {
    setShowJustify(false);
    const cents = resolveCents();
    const combinedNote = note
      ? `${note} · why: ${whyNow}`
      : `why: ${whyNow}`;

    if (t === 'want' && canWait) {
      // Defer to pending_desires instead of creating a transaction.
      setBusy(true);
      try {
        await api.post('/api/pending-desires', {
          amount_usd_cents: cents,
          category,
          note: combinedNote,
        });
        await onSaved();
      } catch (e) { setErr(e.message); }
      finally { setBusy(false); }
      return;
    }

    await persist({ ...pendingPayload, type: t, note: combinedNote });
  };

  return (
    <>
      <div className="fixed inset-0 bg-bg/90 flex items-center justify-center px-4 z-40" onClick={onClose}>
        <div className="cw-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl">{isEdit ? 'Edit allocation' : 'Log allocation'}</h2>
            <button onClick={onClose} className="cw-btn-ghost">✕</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="flex gap-2">
              {['USD', 'IQD'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 cw-btn ${currency === c ? 'bg-surface2 text-ink ring-1 ring-gold' : 'text-inkDim hover:text-ink hover:bg-surface2'}`}
                >{c}</button>
              ))}
            </div>

            {currency === 'USD' ? (
              <div>
                <label className="cw-label block mb-1">Amount (USD)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={usd} onChange={(e) => setUsd(e.target.value)}
                  placeholder="0.00" autoFocus required
                  className="cw-input w-full font-mono text-xl"
                />
                {previewIqd != null && (
                  <div className="text-xs text-inkDim mt-1">
                    ≈ {fmtIQD(previewIqd)} @ {Math.round(rate.rate_iqd_per_usd).toLocaleString()}
                  </div>
                )}
                {!isEdit && resolveCents() != null && resolveCents() >= threshold * 100 && (
                  <div className="text-xs text-warning mt-2">
                    This is ${threshold} or more — you'll be asked to justify.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="cw-label block mb-1">Amount (IQD)</label>
                <input
                  type="number" step="1" min="1"
                  value={iqd} onChange={(e) => setIqd(e.target.value)}
                  placeholder="0" autoFocus required
                  className="cw-input w-full font-mono text-xl"
                />
                {previewUsd != null && (
                  <div className="text-xs text-inkDim mt-1">
                    ≈ {fmtUSD(previewUsd, { cents: true })} @ {Math.round(rate.rate_iqd_per_usd).toLocaleString()}
                  </div>
                )}
                {!rate && (
                  <div className="text-xs text-warning mt-1">No exchange rate set yet.</div>
                )}
              </div>
            )}

            <div>
              <label className="cw-label block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="cw-input w-full">
                {SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="cw-label block mb-1">Type (optional)</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setType('')}
                  className={`flex-1 cw-btn text-xs ${type === '' ? 'bg-surface2 ring-1 ring-line' : 'text-inkDim hover:text-ink'}`}>
                  Unset
                </button>
                {TX_TYPES.map((t) => (
                  <button key={t.key} type="button" onClick={() => setType(t.key)}
                    className={`flex-1 cw-btn text-xs ${type === t.key ? 'bg-surface2 ring-1 ring-gold text-ink' : 'text-inkDim hover:text-ink hover:bg-surface2'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="cw-label block mb-1">Note (optional)</label>
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="lunch with..." maxLength={500}
                className="cw-input w-full"
              />
            </div>

            <div>
              <label className="cw-label block mb-1">Date</label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                max={todayISO()} className="cw-input w-full"
              />
            </div>

            {err && <div className="text-danger text-sm">{err}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
              <button type="submit" disabled={busy} className="cw-btn-primary">
                {busy ? 'Saving…' : (isEdit ? 'Save changes' : 'Log allocation')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showJustify && (
        <JustificationModal
          amountCents={resolveCents()}
          category={category}
          onClose={() => setShowJustify(false)}
          onDecided={onJustified}
        />
      )}
    </>
  );
}
