import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtUSD, fmtIQD, fmtDate, fmtRelativeDate, todayISO } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';
import { PendingApprovals } from '../components/PendingApprovals.jsx';
import { ReviewModal } from '../components/ReviewModal.jsx';
import { useAuth } from '../lib/session.jsx';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewPrompt, setReviewPrompt] = useState(null);
  const [showReview, setShowReview] = useState(false);

  const load = async () => {
    try {
      const [d, p] = await Promise.all([
        api.get('/api/dashboard'),
        api.get('/api/reviews/prompt').catch(() => null),
      ]);
      setData(d);
      setReviewPrompt(p);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    load().catch(() => setLoading(false));
    const id = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <AuthedShell>
      <div className="space-y-8">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Dashboard</div>
            <h1 className="text-4xl mt-1">Good to see you, {user?.name}.</h1>
          </div>
          {data && (
            <div className="text-right">
              <div className="cw-label">Days using Commonwealth</div>
              <div className="font-serif text-2xl text-gold">{data.days_using}</div>
            </div>
          )}
        </header>

        {reviewPrompt?.needs_review && (
          <ReviewPromptBanner month={reviewPrompt.month} onOpen={() => setShowReview(true)} />
        )}

        {data?.principle && <DailyPrinciple text={data.principle.text} />}

        <PendingApprovals onChange={load} />

        <div className="grid md:grid-cols-3 gap-6">
          <NetPositionCard data={data} />
          <RateCard rate={data?.rate} onChange={load} />
          <DataMaturityCard maturity={data?.maturity} />
        </div>

        <KpiStrip data={data} />

        <GoalsRow goals={data?.goals ?? []} />

        {loading && !data && (
          <div className="text-inkDim text-center py-10">Loading dashboard…</div>
        )}
      </div>

      {showReview && reviewPrompt && (
        <ReviewModal
          month={reviewPrompt.month}
          questions={reviewPrompt.questions}
          onClose={() => setShowReview(false)}
          onSaved={async () => { setShowReview(false); await load(); }}
        />
      )}
    </AuthedShell>
  );
}

function ReviewPromptBanner({ month, onOpen }) {
  return (
    <div className="cw-card border-l-2 border-gold p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="cw-label text-gold">Monthly review · {month}</div>
        <p className="text-ink mt-1 text-sm leading-relaxed max-w-xl">
          Five honest sentences before the new month carries you forward.
          What gets reviewed compounds.
        </p>
      </div>
      <button onClick={onOpen} className="cw-btn-primary text-sm">
        Begin review →
      </button>
    </div>
  );
}

function DailyPrinciple({ text }) {
  return (
    <div className="cw-card border-l-2 border-gold p-5">
      <div className="cw-label mb-2">Today's principle</div>
      <p className="font-serif text-xl leading-snug text-ink italic">"{text}"</p>
    </div>
  );
}

function NetPositionCard({ data }) {
  if (!data) return <SkeletonCard />;
  const income = data.income_usd_cents;
  const spent = data.spent_usd_cents;
  const net = data.net_usd_cents;
  const ratePct = (data.savings_rate * 100).toFixed(0);
  const overspending = data.projected_month_spend_cents > income;

  return (
    <div className="cw-card p-5">
      <div className="cw-label">Net position · this month</div>
      <div className={`font-serif text-3xl mt-1 ${net < 0 ? 'text-danger' : 'text-ink'}`}>
        {net >= 0 ? '+' : ''}{fmtUSD(net)}
      </div>
      <div className="text-xs text-inkDim mt-2 space-y-0.5">
        <div>Income: <span className="font-mono text-ink">{fmtUSD(income)}</span></div>
        <div>Allocated: <span className="font-mono text-ink">{fmtUSD(spent)}</span></div>
        <div>
          Savings rate:{' '}
          <span className={`font-mono ${data.savings_rate >= 0.2 ? 'text-success' : data.savings_rate >= 0 ? 'text-warning' : 'text-danger'}`}>
            {ratePct}%
          </span>
        </div>
        {overspending && (
          <div className="text-warning pt-1">
            ⚠ At today's pace, this month projects to {fmtUSD(data.projected_month_spend_cents)}.
          </div>
        )}
      </div>
    </div>
  );
}

function DataMaturityCard({ maturity }) {
  if (!maturity) return <SkeletonCard />;
  const m = maturity;
  return (
    <div className="cw-card p-5">
      <div className="cw-label">Data maturity</div>
      <div className="font-serif text-3xl mt-1 text-ink">{m.days_since_first_transaction}</div>
      <div className="text-xs text-inkDim">days of history</div>
      {m.next_milestone_days && (
        <div className="mt-3 text-xs text-inkDim leading-relaxed">
          Insights deepen in <span className="text-gold">{m.days_to_next_milestone}</span> days
          ({m.next_milestone_days}-day milestone).
        </div>
      )}
      <div className="mt-3 grid grid-cols-5 gap-1 text-[10px]">
        <Bar on={m.unlocks.monthlySummary} label="30" />
        <Bar on={m.unlocks.trends}         label="60" />
        <Bar on={m.unlocks.momentum}       label="90" />
        <Bar on={m.unlocks.seasonal}       label="180" />
        <Bar on={m.unlocks.yearOverYear}   label="365" />
      </div>
    </div>
  );
}
function Bar({ on, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-full h-1 rounded ${on ? 'bg-gold' : 'bg-line/60'}`} />
      <span className="mt-0.5 text-inkDim">{label}</span>
    </div>
  );
}

function KpiStrip({ data }) {
  if (!data) return null;
  const kpis = [
    {
      label: 'Avg daily allocation',
      value: fmtUSD(data.avg_daily_spend_cents, { cents: true }),
    },
    {
      label: 'Total capital deployed',
      value: fmtUSD(data.total_wealth_cents),
      tone: 'text-gold',
    },
    {
      label: 'Months of runway',
      value: data.months_of_runway == null
        ? '—'
        : data.months_of_runway > 999 ? '∞' : data.months_of_runway.toFixed(1),
    },
    {
      label: 'Saved by friction · month',
      value: fmtUSD(data.saved_by_friction_this_month_cents),
      tone: data.saved_by_friction_this_month_cents > 0 ? 'text-success' : 'text-inkDim',
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className="cw-card p-4">
          <div className="cw-label">{k.label}</div>
          <div className={`font-serif text-2xl mt-1 ${k.tone ?? 'text-ink'}`}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function GoalsRow({ goals }) {
  if (!goals?.length) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="cw-label">Goals</div>
        <Link to="/owner/goals" className="text-xs text-gold hover:underline">
          Manage →
        </Link>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((g) => <GoalProgressCard key={g.id} g={g} />)}
      </div>
    </div>
  );
}

function GoalProgressCard({ g }) {
  const pct = g.target_usd_cents > 0
    ? Math.min((g.contributed_usd_cents / g.target_usd_cents) * 100, 100)
    : 0;
  const complete = g.remaining_usd_cents === 0;

  return (
    <div className="cw-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-xl">{g.name}</h3>
        <span className="text-xs text-inkDim">{Math.round(pct)}%</span>
      </div>
      <div className="h-3 rounded bg-line/40 overflow-hidden mt-3">
        <div
          className={`h-full transition-all duration-700 ${complete ? 'bg-success' : 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-inkDim mt-2 flex justify-between">
        <span>
          <span className="font-mono text-ink">{fmtUSD(g.contributed_usd_cents)}</span>
          {' / '}
          <span className="font-mono">{fmtUSD(g.target_usd_cents)}</span>
        </span>
        <span>
          {g.projection_status === 'ok' && g.projected_completion_date && (
            <>by {fmtDate(g.projected_completion_date)}</>
          )}
          {g.projection_status === 'complete' && <span className="text-success">funded</span>}
          {g.projection_status === 'no_contributions' && <>no contributions</>}
          {g.projection_status === 'too_early' && <>projection unlocks soon</>}
        </span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="cw-card p-5 opacity-50">
      <div className="cw-label">Loading…</div>
      <div className="h-8 mt-2 bg-line/40 rounded animate-pulse" />
    </div>
  );
}

function RateCard({ rate: initialRate, onChange }) {
  const [rate, setRate] = useState(initialRate);
  useEffect(() => { setRate(initialRate); }, [initialRate]);

  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setErr(null);
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) { setErr('Positive number required.'); return; }
    setBusy(true);
    try {
      const r = await api.post('/api/rates', { effectiveDate: todayISO(), rate: n });
      setRate(r.rate);
      setEditing(false); setVal('');
      onChange?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="cw-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="cw-label">IQD / 1 USD</div>
          {!rate && (
            <>
              <div className="font-serif text-2xl mt-1 text-warning">Not set</div>
              <div className="text-xs text-inkDim mt-1">Set today's rate to begin pricing.</div>
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
              autoFocus type="number" inputMode="numeric" step="1" min="1"
              value={val} onChange={(e) => setVal(e.target.value)}
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
        </div>
      )}
    </div>
  );
}
