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
  const [preview, setPreview] = useState(null);

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

  const onSaved = async () => { setShowForm(false); setEditing(null); await load(); };

  const remove = async (id) => {
    if (!window.confirm('Soft-delete this transaction? It stays in the audit trail.')) return;
    await api.del(`/api/transactions/${id}`); await load();
  };
  const markReturned = async (id, name) => {
    const what = name ? `"${name}"` : 'this purchase';
    if (!window.confirm(`Mark ${what} as returned? Its amount stops counting toward your spending.`)) return;
    await api.post(`/api/transactions/${id}/return`); await load();
  };

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Ledger</div>
            <h1 className="text-3xl sm:text-4xl mt-1">Allocations</h1>
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

        {/* Mobile-friendly card list (sm:hidden) */}
        <div className="space-y-2 sm:hidden">
          {loading && <div className="text-inkDim text-center py-6">Loading…</div>}
          {!loading && txns.length === 0 && (
            <div className="cw-card p-6 text-center text-inkDim text-sm">No allocations yet.</div>
          )}
          {txns.map((t) => (
            <TxCard key={t.id} t={t}
                    onEdit={() => { setEditing(t); setShowForm(true); }}
                    onRemove={() => remove(t.id)}
                    onReturn={() => markReturned(t.id, t.name)}
                    onPreviewReceipt={() => setPreview(t.receipt_path)} />
          ))}
        </div>

        {/* Desktop table (hidden sm:block) */}
        <div className="cw-card overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                <th className="text-left  px-4 py-2 font-medium">When</th>
                <th className="text-left  px-4 py-2 font-medium">Who</th>
                <th className="text-left  px-4 py-2 font-medium">Name</th>
                <th className="text-left  px-4 py-2 font-medium">Category</th>
                <th className="text-left  px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">USD</th>
                <th className="text-right px-4 py-2 font-medium">IQD</th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="9" className="text-center text-inkDim py-8">Loading…</td></tr>}
              {!loading && txns.length === 0 && (
                <tr><td colSpan="9" className="text-center text-inkDim py-10">No allocations yet. Log your first one.</td></tr>
              )}
              {txns.map((t) => (
                <tr key={t.id} className="border-b border-line/30 last:border-0 hover:bg-surface2/60">
                  <td className="px-4 py-3 text-inkDim">{fmtRelativeDate(t.created_at)}</td>
                  <td className="px-4 py-3">{t.user_name}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink">{t.name || <span className="text-inkDim italic">—</span>}</div>
                    {t.note && <div className="text-xs text-inkDim truncate max-w-[16rem]" title={t.note}>{t.note}</div>}
                  </td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3 text-xs">
                    {t.type ? <TypeBadge type={t.type} /> : <span className="text-inkDim/60">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtUSD(t.amount_usd_cents, { cents: true })}</td>
                  <td className="px-4 py-3 text-right font-mono text-inkDim text-xs">
                    {t.amount_iqd != null ? fmtIQD(t.amount_iqd) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.receipt_path && (
                      <button onClick={() => setPreview(t.receipt_path)}
                              className="text-inkDim hover:text-gold text-xs" title="View receipt">📎</button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(t); setShowForm(true); }} className="text-inkDim hover:text-ink text-xs mr-2">Edit</button>
                    <button onClick={() => markReturned(t.id, t.name)} className="text-inkDim hover:text-warning text-xs mr-2">Return</button>
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

      {preview && <ReceiptPreview path={preview} onClose={() => setPreview(null)} />}
    </AuthedShell>
  );
}

function TxCard({ t, onEdit, onRemove, onReturn, onPreviewReceipt }) {
  return (
    <div className="cw-card p-3 active:bg-surface2/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-lg truncate">{t.name || t.category}</span>
            {t.type && <TypeBadge type={t.type} />}
            {t.receipt_path && <button onClick={onPreviewReceipt} className="text-gold text-xs">📎</button>}
          </div>
          <div className="text-xs text-inkDim mt-0.5">
            {t.user_name} · {t.category} · {fmtRelativeDate(t.created_at)}
          </div>
          {t.note && <div className="text-xs text-inkDim mt-1 italic">{t.note}</div>}
        </div>
        <div className="text-right">
          <div className="font-mono text-ink">{fmtUSD(t.amount_usd_cents, { cents: true })}</div>
          {t.amount_iqd != null && (
            <div className="font-mono text-xs text-inkDim">{fmtIQD(t.amount_iqd)}</div>
          )}
        </div>
      </div>
      <div className="flex gap-3 mt-2 -mx-1 text-xs">
        <button onClick={onEdit} className="px-3 py-1.5 text-inkDim hover:text-ink">Edit</button>
        <button onClick={onReturn} className="px-3 py-1.5 text-warning hover:text-ink">Return</button>
        <button onClick={onRemove} className="px-3 py-1.5 text-danger/80 hover:text-danger ml-auto">Remove</button>
      </div>
    </div>
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

function ReceiptPreview({ path, onClose }) {
  const isPdf = path?.toLowerCase().endsWith('.pdf');
  return (
    <div className="fixed inset-0 bg-bg/95 z-50 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-line">
        <div className="cw-label">Receipt</div>
        <button onClick={onClose} className="cw-btn-ghost">✕ Close</button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {isPdf
          ? <iframe src={`/receipts/${path}`} className="w-full h-full border-0 bg-white" title="Receipt PDF" />
          : <img src={`/receipts/${path}`} alt="Receipt" className="max-h-full max-w-full object-contain" />}
      </div>
    </div>
  );
}

function TxFormModal({ editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [currency, setCurrency] = useState('USD');
  const [usd, setUsd]     = useState(editing ? (editing.amount_usd_cents / 100).toFixed(2) : '');
  const [iqd, setIqd]     = useState('');
  const [name, setName]   = useState(editing?.name ?? '');
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
  const [receiptFile, setReceiptFile] = useState(null);
  const [existingReceipt, setExistingReceipt] = useState(editing?.receipt_path ?? null);

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
      name: name?.trim() || undefined,
      note: note || undefined,
      type: type || undefined,
      created_at: date,
      ...extra,
    };
    if (currency === 'USD') body.amount_usd_cents = Math.round(parseFloat(usd) * 100);
    else                    body.amount_iqd = parseFloat(iqd);
    return body;
  };

  const uploadReceiptIfAny = async (txId) => {
    if (!receiptFile) return;
    try {
      await api.upload(`/api/transactions/${txId}/receipt`, receiptFile, {
        extraFields: { label: (name?.trim() || category) },
      });
    } catch (e) {
      // Don't roll back the transaction — just warn the user.
      setErr(`Saved, but receipt upload failed: ${e.message}`);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const cents = resolveCents();
    if (cents == null) { setErr('Enter a valid amount.'); return; }

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
      let txId;
      if (isEdit) {
        await api.put(`/api/transactions/${editing.id}`, body);
        txId = editing.id;
      } else {
        const r = await api.post('/api/transactions', body);
        txId = r.transaction?.id;
      }
      if (txId && receiptFile) await uploadReceiptIfAny(txId);
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
    const combinedNote = note ? `${note} · why: ${whyNow}` : `why: ${whyNow}`;

    if (t === 'want' && canWait) {
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

  const removeExistingReceipt = async () => {
    if (!editing?.id) return;
    if (!confirm('Remove the attached receipt?')) return;
    try {
      await api.del(`/api/transactions/${editing.id}/receipt`);
      setExistingReceipt(null);
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <ModalShell onClose={onClose} title={isEdit ? 'Edit allocation' : 'Log allocation'}>
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
                type="number" inputMode="decimal" step="0.01" min="0.01"
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
                type="number" inputMode="numeric" step="1" min="1"
                value={iqd} onChange={(e) => setIqd(e.target.value)}
                placeholder="0" autoFocus required
                className="cw-input w-full font-mono text-xl"
              />
              {previewUsd != null && (
                <div className="text-xs text-inkDim mt-1">
                  ≈ {fmtUSD(previewUsd, { cents: true })} @ {Math.round(rate.rate_iqd_per_usd).toLocaleString()}
                </div>
              )}
              {!rate && <div className="text-xs text-warning mt-1">No exchange rate set yet.</div>}
            </div>
          )}

          <div>
            <label className="cw-label block mb-1">Name (optional)</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder="e.g. Grocery run · Carrefour"
              className="cw-input w-full"
            />
          </div>

          <div>
            <label className="cw-label block mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="cw-input w-full">
              {SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="cw-label block mb-1">Type (optional)</label>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setType('')}
                className={`flex-1 min-w-[64px] cw-btn text-xs ${type === '' ? 'bg-surface2 ring-1 ring-line' : 'text-inkDim hover:text-ink'}`}>
                Unset
              </button>
              {TX_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  className={`flex-1 min-w-[80px] cw-btn text-xs ${type === t.key ? 'bg-surface2 ring-1 ring-gold text-ink' : 'text-inkDim hover:text-ink hover:bg-surface2'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="cw-label block mb-1">Description (optional)</label>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="What it was, with whom, anything you'd want to remember."
              maxLength={1000} rows={2}
              className="cw-input w-full resize-none"
            />
          </div>

          <div>
            <label className="cw-label block mb-1">Receipt (optional)</label>
            {existingReceipt && (
              <div className="flex items-center gap-2 text-xs text-inkDim mb-2">
                <span>📎 Receipt attached</span>
                <button type="button" onClick={removeExistingReceipt} className="hover:text-danger">remove</button>
              </div>
            )}
            <label className="cw-input w-full flex items-center gap-2 cursor-pointer">
              <span className="text-inkDim text-sm flex-1 truncate">
                {receiptFile?.name ?? (existingReceipt ? 'Replace receipt…' : 'Choose photo or PDF…')}
              </span>
              <span className="cw-btn-ghost text-xs">Browse</span>
              <input
                type="file" accept="image/*,application/pdf,.heic,.heif"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-inkDim mt-1">
              Stored on disk at <code>D:\CW\receipts\</code>. Max 10MB.
            </p>
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
      </ModalShell>

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

// Modal shell that goes full-screen on mobile, centered card on desktop.
function ModalShell({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-bg/95 sm:bg-bg/90 z-40 sm:flex sm:items-center sm:justify-center sm:px-4 cw-fade-in">
      <div
        className="bg-surface w-full h-full sm:h-auto sm:max-w-md sm:w-full sm:rounded-lg sm:border sm:border-line p-6 overflow-y-auto sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl">{title}</h2>
          <button onClick={onClose} className="cw-btn-ghost text-lg" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
