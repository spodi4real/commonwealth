import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../lib/api.js';
import { fmtUSD, fmtDate, fmtRelativeDate } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CATEGORY_COLORS = ['#C9A961','#3F8F5C','#B14444','#D9A441','#5C7AA8','#7A6CB1','#7A8E8C','#B97A4A','#8A8077'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonthISO());

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/reports?month=${month}`);
      setData(r);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, [month]);

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Insights</div>
            <h1 className="text-4xl mt-1">Reports</h1>
          </div>
          <input
            type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="cw-input"
          />
        </header>

        {loading && <div className="text-inkDim">Loading…</div>}

        {data?.maturity && <MaturityBanner m={data.maturity} />}

        {data?.maturity?.unlocks?.monthlySummary
          ? <Summary data={data} />
          : <LockedCard title="Monthly summary" days={30} m={data?.maturity} />}

        {data?.by_category?.length > 0 && data?.maturity?.unlocks?.monthlySummary && (
          <CategoryBreakdown items={data.by_category} />
        )}

        {data?.trend?.length > 0
          ? <TrendChart trend={data.trend} unlocked={data?.maturity?.unlocks?.trends} />
          : <LockedCard title="Spending trend" days={30} m={data?.maturity} />}

        {data?.top5?.length > 0 && <TopExpenses items={data.top5} />}

        {data?.maturity?.unlocks?.momentum
          ? <GoalVelocityChart goals={data.goal_velocity} />
          : <LockedCard title="Goal velocity" days={90} m={data?.maturity} />}

        {data?.maturity?.unlocks?.seasonal
          ? <MonthlyHistory rows={data.monthly_history} />
          : <LockedCard title="Best / worst months" days={180} m={data?.maturity} />}

        <FrictionCard data={data} />

        {data?.maturity?.unlocks?.yearOverYear ? null
          : <LockedCard title="Year-over-year comparison" days={365} m={data?.maturity} />}
      </div>
    </AuthedShell>
  );
}

function MaturityBanner({ m }) {
  if (!m.days_since_first_transaction) {
    return (
      <div className="cw-card border-l-2 border-gold p-5">
        <div className="cw-label">Insights</div>
        <p className="mt-2 text-inkDim leading-relaxed">
          Commonwealth is learning your patterns. Log a few allocations to begin
          accumulating data. The first insights unlock at 30 days.
        </p>
      </div>
    );
  }
  return (
    <div className="cw-card border-l-2 border-gold p-5">
      <div className="cw-label">Data maturity</div>
      <div className="mt-1 text-sm text-inkDim">
        {m.days_since_first_transaction} days of history.
        {m.next_milestone_days && (
          <> Next insights unlock in <span className="text-gold">{m.days_to_next_milestone} days</span>
          {' '}({m.next_milestone_days}-day milestone).</>
        )}
      </div>
    </div>
  );
}

function LockedCard({ title, days, m }) {
  const left = m?.days_since_first_transaction != null
    ? Math.max(days - m.days_since_first_transaction, 0)
    : days;
  return (
    <div className="cw-card p-5 opacity-70">
      <div className="cw-label">{title}</div>
      <p className="text-inkDim text-sm mt-2">
        Unlocks at {days} days of history.{' '}
        {left > 0 && <span className="text-gold">{left} days to go.</span>}
      </p>
    </div>
  );
}

function Summary({ data }) {
  const s = data.summary;
  return (
    <div className="grid md:grid-cols-4 gap-3">
      <Tile label="Income"        value={fmtUSD(s.income_usd_cents)} />
      <Tile label="Allocated"     value={fmtUSD(s.allocated_usd_cents)} />
      <Tile label="Saved"         value={fmtUSD(s.saved_usd_cents)}    tone={s.saved_usd_cents >= 0 ? 'text-success' : 'text-danger'} />
      <Tile label="Savings rate"  value={`${(s.savings_rate * 100).toFixed(0)}%`}
            tone={s.savings_rate >= 0.2 ? 'text-success' : s.savings_rate >= 0 ? 'text-warning' : 'text-danger'} />
      <Tile label="Mom's spend"   value={fmtUSD(s.mom_spend_usd_cents)} />
      <Tile label="Transactions"  value={s.transaction_count} />
    </div>
  );
}
function Tile({ label, value, tone }) {
  return (
    <div className="cw-card p-4">
      <div className="cw-label">{label}</div>
      <div className={`font-serif text-2xl mt-1 ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

function CategoryBreakdown({ items }) {
  const data = items.map((i) => ({ name: i.category, value: i.amount_usd_cents }));
  const total = items.reduce((s, i) => s + i.amount_usd_cents, 0);
  return (
    <div className="cw-card p-5">
      <div className="cw-label mb-3">Category breakdown</div>
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} innerRadius={56} stroke="#0B1220">
                {data.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#141B2D', border: '1px solid #252E47', borderRadius: 4 }}
                formatter={(v) => [fmtUSD(v, { cents: true }), '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-sm">
          <table className="w-full">
            <tbody>
              {items.map((i, idx) => {
                const pct = total > 0 ? (i.amount_usd_cents / total) * 100 : 0;
                return (
                  <tr key={i.category} className="border-b border-line/30 last:border-0">
                    <td className="py-2">
                      <span className="inline-block w-3 h-3 rounded mr-2 align-middle"
                            style={{ background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                      {i.category}
                    </td>
                    <td className="text-right font-mono">{fmtUSD(i.amount_usd_cents, { cents: true })}</td>
                    <td className="text-right text-inkDim text-xs pl-3">{pct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ trend, unlocked }) {
  return (
    <div className="cw-card p-5">
      <div className="cw-label mb-3">
        Spending trend {!unlocked && <span className="text-warning ml-2">(preview · rolling avg unlocks at 60 days)</span>}
      </div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#252E47" strokeDasharray="2 4" />
            <XAxis dataKey="date" stroke="#A8A293" fontSize={10} tickFormatter={(d) => d.slice(5)} />
            <YAxis stroke="#A8A293" fontSize={10} tickFormatter={(v) => '$' + Math.round(v / 100)} width={48} />
            <Tooltip
              contentStyle={{ background: '#141B2D', border: '1px solid #252E47', borderRadius: 4, fontSize: 12 }}
              formatter={(v) => [fmtUSD(v, { cents: true }), '']}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#A8A293' }} />
            <Line type="monotone" dataKey="total"    name="Daily"      stroke="#A8A293" strokeWidth={1} dot={false} />
            <Line type="monotone" dataKey="rolling7" name="7-day avg"  stroke="#C9A961" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopExpenses({ items }) {
  return (
    <div className="cw-card overflow-hidden">
      <div className="cw-label px-5 pt-5 pb-2">Top 5 allocations this month</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-inkDim border-y border-line text-xs uppercase tracking-wider">
            <th className="text-left  px-5 py-2 font-medium">When</th>
            <th className="text-left  px-5 py-2 font-medium">Category</th>
            <th className="text-left  px-5 py-2 font-medium">Note</th>
            <th className="text-right px-5 py-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b border-line/30 last:border-0 hover:bg-surface2/50">
              <td className="px-5 py-3 text-inkDim">{fmtRelativeDate(t.created_at)}</td>
              <td className="px-5 py-3">{t.category}</td>
              <td className="px-5 py-3 text-inkDim text-xs">{t.note || '—'}</td>
              <td className="px-5 py-3 text-right font-mono">{fmtUSD(t.amount_usd_cents, { cents: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalVelocityChart({ goals }) {
  if (!goals?.length) return null;
  return (
    <div className="cw-card p-5">
      <div className="cw-label mb-3">Goal velocity · last 90 days</div>
      <div className="space-y-4">
        {goals.map((g) => (
          <div key={g.goal_id} className="border-t border-line/30 pt-3 first:border-0 first:pt-0">
            <div className="flex items-baseline justify-between">
              <div className="font-serif text-lg">{g.name}</div>
              <div className="text-sm text-inkDim">
                {fmtUSD(g.total_90d_usd_cents)} in 90 days · {fmtUSD(g.per_day_usd_cents, { cents: true })}/day
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyHistory({ rows }) {
  if (!rows?.length) return null;
  const best = [...rows].sort((a, b) => a.allocated - b.allocated)[0];
  const worst = [...rows].sort((a, b) => b.allocated - a.allocated)[0];
  return (
    <div className="cw-card p-5">
      <div className="cw-label mb-3">Monthly history</div>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className="cw-card p-3">
          <div className="text-xs text-success uppercase tracking-wider">Lightest</div>
          <div className="font-serif text-xl mt-1">{best.month}</div>
          <div className="text-xs text-inkDim mt-1">{fmtUSD(best.allocated)} allocated</div>
        </div>
        <div className="cw-card p-3">
          <div className="text-xs text-warning uppercase tracking-wider">Heaviest</div>
          <div className="font-serif text-xl mt-1">{worst.month}</div>
          <div className="text-xs text-inkDim mt-1">{fmtUSD(worst.allocated)} allocated</div>
        </div>
      </div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid stroke="#252E47" strokeDasharray="2 4" />
            <XAxis dataKey="month" stroke="#A8A293" fontSize={10} />
            <YAxis stroke="#A8A293" fontSize={10} tickFormatter={(v) => '$' + Math.round(v / 100)} width={48} />
            <Tooltip contentStyle={{ background: '#141B2D', border: '1px solid #252E47', borderRadius: 4, fontSize: 12 }}
              formatter={(v) => [fmtUSD(v), 'Allocated']} />
            <Line type="monotone" dataKey="allocated" stroke="#C9A961" strokeWidth={2} dot={{ r: 3, fill: '#C9A961' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FrictionCard({ data }) {
  if (!data) return null;
  return (
    <div className="cw-card p-5 border-l-2 border-success">
      <div className="cw-label">Saved by friction</div>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <div className="text-xs text-inkDim">This month</div>
          <div className="font-serif text-2xl text-success">
            {fmtUSD(data.saved_friction_month_usd_cents)}
          </div>
        </div>
        <div>
          <div className="text-xs text-inkDim">Lifetime</div>
          <div className="font-serif text-2xl text-gold">
            {fmtUSD(data.saved_friction_lifetime_usd_cents)}
          </div>
        </div>
      </div>
      <p className="text-xs text-inkDim mt-3 italic">
        The total of every "Want" deferred for 24 hours and ultimately abandoned.
      </p>
    </div>
  );
}
