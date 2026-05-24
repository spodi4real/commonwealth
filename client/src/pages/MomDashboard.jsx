import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtIQD, fmtRelativeDate } from '../lib/format.js';
import { MOM_CATEGORIES } from '../lib/categories.js';
import { AuthedShell } from '../components/Layout.jsx';
import { useAuth } from '../lib/session.jsx';

export default function MomDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('log'); // log | recent
  const [allowance, setAllowance] = useState(null);

  const loadAllowance = async () => {
    try { setAllowance(await api.get('/api/mom/today-allowance')); }
    catch { setAllowance({ status: 'error' }); }
  };
  useEffect(() => { loadAllowance(); }, []);

  return (
    <AuthedShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <div className="cw-label">Welcome</div>
          <h1 className="font-serif text-3xl mt-1">Hello, {user?.name}.</h1>
        </header>

        <AllowanceBar data={allowance} />

        <div className="grid grid-cols-2 gap-2">
          <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
            Log expense
          </TabButton>
          <TabButton active={tab === 'recent'} onClick={() => setTab('recent')}>
            Recent
          </TabButton>
        </div>

        {tab === 'log'    && <Logger onChange={loadAllowance} />}
        {tab === 'recent' && <RecentMine onChange={loadAllowance} />}
      </div>
    </AuthedShell>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 px-2 rounded font-medium text-sm transition-colors ${
        active
          ? 'bg-surface2 text-ink ring-1 ring-gold'
          : 'text-inkDim hover:text-ink hover:bg-surface2'
      }`}
    >
      {children}
    </button>
  );
}

function AllowanceBar({ data }) {
  const tone =
    data?.status === 'green'  ? 'border-success bg-success/10 text-success' :
    data?.status === 'amber'  ? 'border-warning bg-warning/10 text-warning' :
    data?.status === 'red'    ? 'border-danger  bg-danger/10  text-danger'  :
                                 'border-line    bg-surface    text-inkDim';
  return (
    <div className={`cw-card border-2 p-4 text-center ${tone}`}>
      <div className="cw-label">Today's family allowance</div>
      {data?.status === 'green' || data?.status === 'amber' ? (
        <>
          <div className="font-serif text-4xl mt-1">{fmtIQD(data.allowance_iqd)}</div>
          <div className="text-xs mt-1 opacity-80">
            shared with the household · {data.days_left} day{data.days_left === 1 ? '' : 's'} left this month
          </div>
        </>
      ) : data?.status === 'red' ? (
        <>
          <div className="font-serif text-4xl mt-1">0 IQD</div>
          <div className="text-xs mt-1 opacity-80">Spending plan reached for this month.</div>
        </>
      ) : data?.status === 'no_rate' ? (
        <div className="text-sm mt-2">Ask Owner to set today's exchange rate.</div>
      ) : data?.status === 'no_budget' ? (
        <div className="text-sm mt-2">Ask Owner to set this month's plan.</div>
      ) : (
        <div className="text-sm mt-2">…</div>
      )}
    </div>
  );
}

function Logger({ onChange }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(MOM_CATEGORIES[0]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.post('/api/transactions', {
        amount_iqd: parseFloat(amount),
        category,
        name: name?.trim() || undefined,
        note: note || undefined,
      });
      if (receiptFile && r.transaction?.id) {
        try {
          await api.upload(`/api/transactions/${r.transaction.id}/receipt`, receiptFile, {
            extraFields: { label: (name?.trim() || category) },
          });
        } catch (e) {
          setErr(`Logged, but receipt failed: ${e.message}`);
        }
      }
      setDone(true);
      setAmount(''); setName(''); setNote(''); setReceiptFile(null);
      onChange?.();
      setTimeout(() => setDone(false), 2000);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="cw-card p-5 space-y-4">
      <div>
        <label className="cw-label block mb-1">Amount (IQD)</label>
        <input
          type="number" inputMode="numeric" step="1" min="1"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="5000" autoFocus required
          className="cw-input w-full font-mono text-3xl text-center py-4"
        />
      </div>
      <div>
        <label className="cw-label block mb-2">For</label>
        <div className="grid grid-cols-3 gap-2">
          {MOM_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`py-3 rounded text-sm transition-colors ${
                category === c
                  ? 'bg-surface2 text-ink ring-1 ring-gold'
                  : 'bg-surface2/40 text-inkDim hover:text-ink hover:bg-surface2'
              }`}
            >{c}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="cw-label block mb-1">Name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
               maxLength={120} placeholder="e.g. Bread"
               className="cw-input w-full" />
      </div>
      <div>
        <label className="cw-label block mb-1">Description (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  rows={2} maxLength={1000}
                  placeholder="Anything to remember about this purchase."
                  className="cw-input w-full resize-none" />
      </div>
      <div>
        <label className="cw-label block mb-1">Receipt (optional)</label>
        <label className="cw-input w-full flex items-center gap-2 cursor-pointer">
          <span className="text-inkDim text-sm flex-1 truncate">
            {receiptFile?.name ?? 'Choose photo or PDF…'}
          </span>
          <span className="cw-btn-ghost text-xs">Browse</span>
          <input
            type="file" accept="image/*,application/pdf,.heic,.heif"
            capture="environment"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
      </div>
      {err && <div className="text-danger text-sm">{err}</div>}
      <button disabled={busy || !amount}
        className={`cw-btn-primary w-full text-lg py-4 ${done ? 'bg-success text-bg' : ''}`}>
        {busy ? 'Logging…' : done ? '✓ Logged' : 'Log it'}
      </button>
    </form>
  );
}

function RecentMine({ onChange }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/transactions?limit=30');
      setTxns(r.transactions);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const markReturned = async (id, name) => {
    const what = name ? `"${name}"` : 'this purchase';
    if (!window.confirm(`Mark ${what} as returned?`)) return;
    await api.post(`/api/transactions/${id}/return`);
    await load();
    onChange?.();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-inkDim px-1">
        Your recent purchases. If you returned something, mark it and the money
        comes back to the family allowance.
      </p>
      {loading && <div className="text-inkDim text-sm text-center py-6">Loading…</div>}
      {!loading && txns.length === 0 && (
        <div className="cw-card p-6 text-center text-inkDim text-sm">
          Nothing logged yet. Use "Log expense" to add your first purchase.
        </div>
      )}
      {txns.map((t) => (
        <div key={t.id} className="cw-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-serif text-lg truncate">{t.name || t.category}</div>
              <div className="text-xs text-inkDim mt-0.5">
                {t.category} · {fmtRelativeDate(t.created_at)}
              </div>
              {t.note && <div className="text-xs text-inkDim mt-1 italic truncate">{t.note}</div>}
            </div>
            <div className="text-right">
              <div className="font-mono">
                {t.amount_iqd != null ? fmtIQD(t.amount_iqd) : `$${(t.amount_usd_cents / 100).toFixed(2)}`}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <button onClick={() => markReturned(t.id, t.name)}
                    className="text-warning hover:text-ink text-xs px-3 py-1.5">
              Mark as returned
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
