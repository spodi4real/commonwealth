import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD, fmtDate, fmtRelativeDate, todayISO } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/goals');
      setGoals(r.goals);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Capital deployed</div>
            <h1 className="text-4xl mt-1">Goals</h1>
            <p className="text-inkDim mt-2 text-sm max-w-2xl">
              A goal without a date is a wish. Track the capital you've deployed
              toward each objective; projections unlock as contribution history
              accumulates.
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="cw-btn-primary">+ New goal</button>
        </header>

        {loading && <div className="text-inkDim">Loading…</div>}
        {!loading && goals.length === 0 && (
          <div className="cw-card p-10 text-center text-inkDim">No goals yet.</div>
        )}

        <div className="space-y-4">
          {goals.map((g) => <GoalCard key={g.id} goal={g} onChange={load} />)}
        </div>
      </div>

      {adding && <NewGoalModal onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} />}
    </AuthedShell>
  );
}

function GoalCard({ goal, onChange }) {
  const [contributing, setContributing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);

  const pct = goal.target_usd_cents > 0
    ? Math.min((goal.contributed_usd_cents / goal.target_usd_cents) * 100, 100)
    : 0;
  const complete = goal.remaining_usd_cents === 0;

  const loadHistory = async () => {
    const r = await api.get(`/api/goals/${goal.id}/contributions`);
    setHistory(r.contributions);
  };
  const toggleHistory = async () => {
    if (!historyOpen) await loadHistory();
    setHistoryOpen(!historyOpen);
  };

  const removeContribution = async (cid) => {
    if (!confirm('Remove this contribution?')) return;
    await api.del(`/api/goals/contributions/${cid}`);
    await loadHistory();
    await onChange();
  };

  return (
    <div className="cw-card p-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl">{goal.name}</h2>
          <div className="text-inkDim text-sm mt-1">
            {fmtUSD(goal.contributed_usd_cents)} of {fmtUSD(goal.target_usd_cents)}
            {' · '}
            {complete ? (
              <span className="text-success">complete</span>
            ) : (
              <span>{fmtUSD(goal.remaining_usd_cents)} to go</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!complete && (
            <button onClick={() => setContributing(true)} className="cw-btn-primary text-sm px-3">
              + Contribute
            </button>
          )}
          <button onClick={toggleHistory} className="cw-btn-ghost text-sm">
            {historyOpen ? 'Hide history' : 'History'}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-3 rounded bg-line/40 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${complete ? 'bg-success' : 'bg-gold'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-inkDim flex justify-between">
          <span>{Math.round(pct)}%</span>
          <Projection goal={goal} />
        </div>
      </div>

      {historyOpen && (
        <div className="mt-4 border-t border-line/40 pt-3">
          {history.length === 0 ? (
            <div className="text-inkDim text-sm text-center py-4">No contributions yet.</div>
          ) : (
            <ul className="text-sm divide-y divide-line/30">
              {history.map((h) => (
                <li key={h.id} className="py-2 flex items-center justify-between">
                  <span>
                    <span className="font-mono">{fmtUSD(h.amount_usd_cents)}</span>
                    <span className="text-inkDim text-xs ml-2">{fmtRelativeDate(h.contributed_at)}</span>
                  </span>
                  <button onClick={() => removeContribution(h.id)}
                    className="text-inkDim hover:text-danger text-xs">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {contributing && (
        <ContributeModal
          goal={goal}
          onClose={() => setContributing(false)}
          onSaved={async () => { setContributing(false); await onChange(); if (historyOpen) await loadHistory(); }}
        />
      )}
    </div>
  );
}

function Projection({ goal }) {
  if (goal.projection_status === 'complete') return <span className="text-success">funded</span>;
  if (goal.projection_status === 'no_contributions') return <span className="text-inkDim">No contributions yet</span>;
  if (goal.projection_status === 'too_early') return <span className="text-inkDim">Projection unlocks after a few contributions</span>;
  if (goal.projection_status === 'ok' && goal.projected_completion_date) {
    return <span>at this rate, complete by <span className="text-ink">{fmtDate(goal.projected_completion_date)}</span></span>;
  }
  return null;
}

function NewGoalModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/api/goals', { name, target_usd: parseFloat(target) });
      await onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <ModalShell onClose={onClose} title="New goal">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="cw-label block mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="cw-input w-full" />
        </div>
        <div>
          <label className="cw-label block mb-1">Target (USD)</label>
          <input type="number" step="1" min="1" value={target} onChange={(e) => setTarget(e.target.value)}
                 required className="cw-input w-full font-mono" />
        </div>
        {err && <div className="text-danger text-sm">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
          <button disabled={busy} className="cw-btn-primary">{busy ? '…' : 'Create'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ContributeModal({ goal, onClose, onSaved }) {
  const [usd, setUsd] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post(`/api/goals/${goal.id}/contributions`, {
        amount_usd: parseFloat(usd),
        contributed_at: date,
      });
      await onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <ModalShell onClose={onClose} title={`Contribute to ${goal.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="cw-label block mb-1">Amount (USD)</label>
          <input
            autoFocus type="number" step="0.01" min="0.01"
            value={usd} onChange={(e) => setUsd(e.target.value)} required
            className="cw-input w-full font-mono text-xl"
          />
          <div className="text-xs text-inkDim mt-1">
            Remaining: <span className="font-mono">{fmtUSD(goal.remaining_usd_cents)}</span>
          </div>
        </div>
        <div>
          <label className="cw-label block mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 max={todayISO()} className="cw-input w-full" />
        </div>
        {err && <div className="text-danger text-sm">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
          <button disabled={busy} className="cw-btn-primary">{busy ? '…' : 'Contribute'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-bg/90 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="cw-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl">{title}</h2>
          <button onClick={onClose} className="cw-btn-ghost">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
