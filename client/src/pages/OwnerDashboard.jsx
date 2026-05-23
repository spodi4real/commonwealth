import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtDate, fmtRelativeDate, todayISO } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';
import { useAuth } from '../lib/session.jsx';

export default function OwnerDashboard() {
  const { user } = useAuth();
  return (
    <AuthedShell>
      <div className="space-y-8">
        <header>
          <div className="cw-label">Dashboard</div>
          <h1 className="text-4xl mt-1">Good to see you, {user?.name}.</h1>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          <RateCard />
          <ComingSoonCard
            title="Capital position"
            body="Net position, savings rate, and wealth velocity arrive once transactions and budgets are wired in (Phases 3–5)."
          />
          <ComingSoonCard
            title="Goals"
            body="Emergency Fund ($1,000) and Australia Fund ($5,000) progress bars arrive in Phase 6."
          />
        </div>
      </div>
    </AuthedShell>
  );
}

function ComingSoonCard({ title, body }) {
  return (
    <div className="cw-card p-5">
      <div className="cw-label">{title}</div>
      <p className="text-inkDim text-sm mt-3 leading-relaxed">{body}</p>
    </div>
  );
}

function RateCard() {
  const [rate, setRate] = useState(undefined); // undefined = loading, null = none yet
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/api/rates/current');
      setRate(r.rate);
    } catch {
      setRate(null);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(null);
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) { setErr('Positive number required.'); return; }
    setBusy(true);
    try {
      await api.post('/api/rates', { effectiveDate: todayISO(), rate: n });
      await load();
      setEditing(false);
      setVal('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="cw-label">IQD / 1 USD</div>
          {rate === undefined && (
            <div className="text-inkDim mt-1">Loading…</div>
          )}
          {rate === null && (
            <>
              <div className="font-serif text-2xl mt-1 text-warning">Not set</div>
              <div className="text-xs text-inkDim mt-1">
                Set today's rate to begin pricing transactions.
              </div>
            </>
          )}
          {rate && (
            <>
              <div className="font-serif text-3xl mt-1 text-ink">
                {Math.round(rate.rate_iqd_per_usd).toLocaleString()}
              </div>
              <div className="text-xs text-inkDim mt-1">
                as of {fmtDate(rate.effective_date)}{' '}
                <span className="text-inkDim/60">· {fmtRelativeDate(rate.effective_date)}</span>
              </div>
            </>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="cw-btn-ghost text-xs whitespace-nowrap">
            {rate ? 'Update' : 'Set rate'}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="e.g. 1500"
              className="cw-input flex-1 font-mono"
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button onClick={save} disabled={busy || !val} className="cw-btn-primary text-sm px-3">
              {busy ? '…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setVal(''); setErr(null); }}
              className="cw-btn-ghost text-sm"
            >
              Cancel
            </button>
          </div>
          {err && <div className="text-danger text-xs">{err}</div>}
          <div className="text-xs text-inkDim">
            Saves under today's date ({fmtDate(todayISO())}). View history →{' '}
            <Link to="/owner/rates" className="text-gold hover:underline">Rates</Link>
          </div>
        </div>
      )}
    </div>
  );
}
