import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD, fmtRelativeDate } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function PendingDesires() {
  const [desires, setDesires] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        api.get('/api/pending-desires'),
        api.get('/api/pending-desires?resolved=true'),
      ]);
      setDesires(p.desires);
      setResolved(r.desires);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const keep = async (id) => { await api.post(`/api/pending-desires/${id}/keep`);    await load(); };
  const drop = async (id) => { await api.post(`/api/pending-desires/${id}/abandon`); await load(); };

  const totalAbandoned = resolved
    .filter((r) => r.kept === 0)
    .reduce((sum, r) => sum + r.amount_usd_cents, 0);

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header>
          <div className="cw-label">Friction outcomes</div>
          <h1 className="text-4xl mt-1">Pending desires</h1>
          <p className="text-inkDim mt-2 text-sm max-w-2xl leading-relaxed">
            A want that survives twenty-four hours is a need. A want that does
            not was never one. Deferred purchases land here — revisit them when
            the urgency has passed.
          </p>
        </header>

        <div className="cw-card p-5">
          <div className="cw-label">Saved by friction · lifetime</div>
          <div className={`font-serif text-3xl mt-1 ${totalAbandoned > 0 ? 'text-success' : 'text-inkDim'}`}>
            {fmtUSD(totalAbandoned)}
          </div>
          <div className="text-xs text-inkDim mt-1">
            The sum of every "Want" you walked away from after sleeping on it.
          </div>
        </div>

        <section>
          <h2 className="font-serif text-2xl mb-3">Waiting</h2>
          {loading && <div className="text-inkDim">Loading…</div>}
          {!loading && desires.length === 0 && (
            <div className="cw-card p-8 text-center text-inkDim text-sm">
              Nothing waiting. Anything you defer from the Allocations page lands here.
            </div>
          )}
          <div className="space-y-3">
            {desires.map((d) => {
              const created = new Date(d.created_at.replace(' ', 'T') + 'Z');
              const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
              const ripe = ageHours >= 24;
              return (
                <div key={d.id} className={`cw-card p-4 ${ripe ? 'border-gold' : ''}`}>
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <span className="font-serif text-2xl">{fmtUSD(d.amount_usd_cents, { cents: true })}</span>
                      <span className="text-inkDim ml-2 text-sm">{d.category}</span>
                      {d.note && (
                        <div className="text-inkDim text-sm mt-1 italic">"{d.note}"</div>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-inkDim">{fmtRelativeDate(d.created_at)}</div>
                      {!ripe && (
                        <div className="text-warning mt-1">
                          ripens in {Math.ceil(24 - ageHours)}h
                        </div>
                      )}
                      {ripe && <div className="text-gold mt-1">ready to decide</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      onClick={() => drop(d.id)}
                      className="cw-btn bg-success/20 text-success hover:bg-success/30 text-sm px-3"
                    >
                      ✓ Abandon — saved
                    </button>
                    <button
                      onClick={() => keep(d.id)}
                      disabled={!ripe}
                      title={!ripe ? 'Wait until 24h has passed' : ''}
                      className="cw-btn bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-40 text-sm px-3"
                    >
                      Still want it — log it
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {resolved.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl mb-3">Resolved</h2>
            <div className="cw-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-inkDim border-b border-line text-xs uppercase tracking-wider">
                    <th className="text-left  px-4 py-2 font-medium">When</th>
                    <th className="text-left  px-4 py-2 font-medium">Category</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                    <th className="text-right px-4 py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((r) => (
                    <tr key={r.id} className="border-b border-line/30 last:border-0 hover:bg-surface2/60">
                      <td className="px-4 py-2 text-inkDim">{fmtRelativeDate(r.resolved_at)}</td>
                      <td className="px-4 py-2">{r.category}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtUSD(r.amount_usd_cents, { cents: true })}</td>
                      <td className="px-4 py-2 text-right">
                        {r.kept
                          ? <span className="text-warning text-xs">Spent</span>
                          : <span className="text-success text-xs">Abandoned · saved</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AuthedShell>
  );
}
