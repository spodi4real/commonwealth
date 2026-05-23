import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';
import { BurnBar } from '../components/BurnBar.jsx';

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Budgets() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(currentMonthISO());
  const [edits, setEdits] = useState({}); // { category: usdString }
  const [busy, setBusy] = useState(false);

  const load = async (m = month) => {
    const r = await api.get(`/api/budgets?month=${m}`);
    setData(r);
    setEdits({});
  };
  useEffect(() => { load().catch(() => {}); }, [month]);

  const pctElapsed = data ? (data.days_elapsed / data.days_in_month) * 100 : 0;

  const totals = useMemo(() => {
    if (!data) return null;
    return data.budgets.reduce(
      (acc, b) => ({
        limit: acc.limit + b.monthly_limit_usd_cents,
        spent: acc.spent + b.spent_usd_cents,
      }),
      { limit: 0, spent: 0 }
    );
  }, [data]);

  const onSave = async (category) => {
    const usd = parseFloat(edits[category]);
    if (!Number.isFinite(usd) || usd < 0) return;
    setBusy(true);
    try {
      await api.put('/api/budgets', {
        category,
        month,
        monthly_limit_usd_cents: Math.round(usd * 100),
      });
      await load();
    } finally { setBusy(false); }
  };

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="cw-label">Architecture</div>
            <h1 className="text-4xl mt-1">Monthly plan</h1>
            <p className="text-inkDim mt-2 text-sm max-w-2xl">
              Allocate your month before it begins. A budget is not a cage —
              it is the architecture of a life you chose.
            </p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="cw-input"
          />
        </header>

        {data && (
          <div className="cw-card p-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <span className="cw-label mr-2">Day</span>
              <span className="font-mono text-ink">{data.days_elapsed} / {data.days_in_month}</span>
              <span className="text-inkDim ml-2">({Math.round(pctElapsed)}% elapsed)</span>
            </div>
            {totals && (
              <div>
                <span className="cw-label mr-2">Allocated</span>
                <span className="font-mono text-ink">{fmtUSD(totals.spent)}</span>
                <span className="text-inkDim"> / </span>
                <span className="font-mono">{fmtUSD(totals.limit)}</span>
              </div>
            )}
          </div>
        )}

        <div className="cw-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                <th className="text-left  px-4 py-2 font-medium w-1/4">Category</th>
                <th className="text-right px-4 py-2 font-medium">Limit</th>
                <th className="text-right px-4 py-2 font-medium">Spent</th>
                <th className="text-right px-4 py-2 font-medium">Remaining</th>
                <th className="px-4 py-2 w-1/3">Burn</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data?.budgets.map((b) => {
                const remaining = b.monthly_limit_usd_cents - b.spent_usd_cents;
                const isEditing = edits[b.category] !== undefined;
                const displayUSD = (b.monthly_limit_usd_cents / 100).toFixed(0);
                return (
                  <tr key={b.category} className="border-b border-line/30 last:border-0 hover:bg-surface2/40">
                    <td className="px-4 py-3">{b.category}</td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number" min="0" step="1"
                          value={edits[b.category]}
                          onChange={(e) => setEdits((x) => ({ ...x, [b.category]: e.target.value }))}
                          className="cw-input w-24 text-right font-mono py-1"
                          onKeyDown={(e) => e.key === 'Enter' && onSave(b.category)}
                        />
                      ) : (
                        <button
                          onClick={() => setEdits((x) => ({ ...x, [b.category]: displayUSD }))}
                          className="font-mono hover:text-gold"
                          title="Click to edit"
                        >
                          {fmtUSD(b.monthly_limit_usd_cents)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-inkDim">
                      {fmtUSD(b.spent_usd_cents, { cents: true })}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      remaining < 0 ? 'text-danger' :
                      remaining < b.monthly_limit_usd_cents * 0.1 ? 'text-warning' : 'text-ink'
                    }`}>
                      {fmtUSD(remaining, { cents: true })}
                    </td>
                    <td className="px-4 py-3">
                      <BurnBar
                        spentCents={b.spent_usd_cents}
                        limitCents={b.monthly_limit_usd_cents}
                        pctMonthElapsed={pctElapsed}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing && (
                        <>
                          <button
                            onClick={() => onSave(b.category)}
                            disabled={busy}
                            className="text-gold hover:underline text-xs mr-2"
                          >Save</button>
                          <button
                            onClick={() => setEdits((x) => { const n = { ...x }; delete n[b.category]; return n; })}
                            className="text-inkDim hover:text-ink text-xs"
                          >Cancel</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-inkDim">
          The thin vertical line on each bar marks how far through the month you are.
          A bar past that line means you're spending faster than time is passing.
        </div>
      </div>
    </AuthedShell>
  );
}
