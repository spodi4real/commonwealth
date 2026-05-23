import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtIQD } from '../lib/format.js';
import { MOM_CATEGORIES } from '../lib/categories.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function MomDashboard() {
  const [tab, setTab] = useState('ask'); // ask | log
  const [allowance, setAllowance] = useState(null);

  const loadAllowance = async () => {
    try { setAllowance(await api.get('/api/mom/today-allowance')); }
    catch { setAllowance({ status: 'error' }); }
  };
  useEffect(() => { loadAllowance(); }, []);

  return (
    <AuthedShell>
      <div className="max-w-lg mx-auto space-y-6">
        <AllowanceBar data={allowance} />

        <div className="grid grid-cols-2 gap-2">
          <TabButton active={tab === 'ask'} onClick={() => setTab('ask')}>
            Can I spend this?
          </TabButton>
          <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
            I spent this
          </TabButton>
        </div>

        {tab === 'ask' && <CanISpend onChange={loadAllowance} />}
        {tab === 'log' && <ISpent onChange={loadAllowance} />}
      </div>
    </AuthedShell>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 rounded font-medium transition-colors ${
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
    data?.status === 'green'  ? 'border-success bg-success/10  text-success'  :
    data?.status === 'amber'  ? 'border-warning bg-warning/10  text-warning'  :
    data?.status === 'red'    ? 'border-danger  bg-danger/10   text-danger'   :
                                 'border-line    bg-surface     text-inkDim';

  return (
    <div className={`cw-card border-2 p-4 text-center ${tone}`}>
      <div className="cw-label">Today's allowance</div>
      {data?.status === 'green' || data?.status === 'amber' ? (
        <>
          <div className="font-serif text-4xl mt-1">{fmtIQD(data.allowance_iqd)}</div>
          <div className="text-xs mt-1 opacity-80">
            {data.days_left} day{data.days_left === 1 ? '' : 's'} remaining this month
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

function CanISpend({ onChange }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(MOM_CATEGORIES[0]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reqId, setReqId] = useState(null);
  const [pendingReq, setPendingReq] = useState(null);

  // Poll for amber-request resolution.
  useEffect(() => {
    if (!reqId) return;
    let live = true;
    const tick = async () => {
      try {
        const { request } = await api.get(`/api/mom/can-i-spend/${reqId}`);
        if (!live) return;
        setPendingReq(request);
        if (request.status !== 'pending') {
          setReqId(null);
          setResult({
            verdict: request.status === 'approved' ? 'green' : 'red',
            reason: request.status === 'approved'
              ? `Owner approved.${request.owner_note ? ` "${request.owner_note}"` : ''} You can spend it now — then log it in "I spent this".`
              : `Owner denied.${request.owner_note ? ` "${request.owner_note}"` : ''}`,
            code: request.status,
          });
        }
      } catch { /* keep polling */ }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => { live = false; clearInterval(id); };
  }, [reqId]);

  const ask = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setPendingReq(null);
    setReqId(null);
    try {
      const n = parseFloat(amount);
      const r = await api.post('/api/mom/can-i-spend', { amount_iqd: n, category });
      setResult(r);
      if (r.verdict === 'amber' && r.request) {
        setReqId(r.request.id);
        setPendingReq(r.request);
      }
      onChange?.();
    } catch (e) {
      setResult({ verdict: 'red', reason: e.message });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setResult(null); setReqId(null); setPendingReq(null); setAmount(''); };

  if (result) return <VerdictScreen result={result} pending={pendingReq} onReset={reset} />;

  return (
    <form onSubmit={ask} className="cw-card p-5 space-y-4">
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
              className={`py-2 rounded text-sm transition-colors ${
                category === c
                  ? 'bg-surface2 text-ink ring-1 ring-gold'
                  : 'bg-surface2/40 text-inkDim hover:text-ink hover:bg-surface2'
              }`}
            >{c}</button>
          ))}
        </div>
      </div>
      <button disabled={busy || !amount} className="cw-btn-primary w-full text-lg py-4">
        {busy ? 'Checking…' : 'Check'}
      </button>
    </form>
  );
}

function VerdictScreen({ result, pending, onReset }) {
  const tone =
    result.verdict === 'green' ? 'bg-success/20 border-success text-success' :
    result.verdict === 'amber' ? 'bg-warning/20 border-warning text-warning' :
                                  'bg-danger/20  border-danger  text-danger';
  const headline =
    result.verdict === 'green' ? 'Yes, go ahead' :
    result.verdict === 'amber' ? 'Wait — asking Owner' :
                                  'Not this month';
  const icon = result.verdict === 'green' ? '✓' : result.verdict === 'amber' ? '⋯' : '✕';

  const isWaiting = result.verdict === 'amber' && pending?.status === 'pending';

  return (
    <div className={`cw-card border-2 p-8 text-center ${tone}`}>
      <div className="text-6xl mb-2">{icon}</div>
      <h2 className="font-serif text-3xl">{headline}</h2>
      <p className="mt-3 text-base opacity-90 leading-relaxed">{result.reason}</p>

      {isWaiting && (
        <div className="mt-4 text-xs opacity-70">
          Checking back every few seconds…
        </div>
      )}

      <button onClick={onReset} className="cw-btn-primary mt-6 w-full">
        {isWaiting ? 'Cancel and ask differently' : 'Ask again'}
      </button>
    </div>
  );
}

function ISpent({ onChange }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(MOM_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/api/transactions', {
        amount_iqd: parseFloat(amount),
        category,
        note: note || undefined,
      });
      setDone(true);
      setAmount('');
      setNote('');
      onChange?.();
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
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
              className={`py-2 rounded text-sm transition-colors ${
                category === c
                  ? 'bg-surface2 text-ink ring-1 ring-gold'
                  : 'bg-surface2/40 text-inkDim hover:text-ink hover:bg-surface2'
              }`}
            >{c}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="cw-label block mb-1">Note (optional)</label>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className="cw-input w-full"
        />
      </div>
      {err && <div className="text-danger text-sm">{err}</div>}
      <button disabled={busy || !amount}
        className={`cw-btn-primary w-full text-lg py-4 ${done ? 'bg-success text-bg' : ''}`}>
        {busy ? 'Logging…' : done ? '✓ Logged' : 'Log it'}
      </button>
    </form>
  );
}
