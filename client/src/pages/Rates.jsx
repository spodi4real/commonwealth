import { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../lib/api.js';
import { fmtDate, fmtRelativeDate, todayISO } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function Rates() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(todayISO());
  const [rate, setRate] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/rates');
      setRates(r.rates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const n = parseFloat(rate);
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter a positive number.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/rates', { effectiveDate: date, rate: n });
      setRate('');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Remove this rate entry? Past transactions logged under it will use the next-most-recent rate.')) return;
    try {
      await api.del(`/api/rates/${id}`);
      await load();
    } catch (e) {
      window.alert(e.message);
    }
  };

  // Chart needs oldest → newest left-to-right.
  const chartData = [...rates].reverse().map((r) => ({
    date: r.effective_date,
    rate: Math.round(r.rate_iqd_per_usd),
  }));

  return (
    <AuthedShell>
      <div className="space-y-6">
        <header>
          <div className="cw-label">Capital instrument</div>
          <h1 className="text-4xl mt-1">Exchange rate</h1>
          <p className="text-inkDim mt-2 max-w-2xl leading-relaxed">
            Every transaction is stored in USD and rendered in IQD using the rate
            active on its date. Update this whenever the market moves — past
            entries keep the rate that was true on the day they were logged.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          <form onSubmit={submit} className="cw-card p-5 space-y-4">
            <div className="cw-label">Add or update</div>
            <div>
              <label htmlFor="rate-date" className="text-xs text-inkDim block mb-1">
                Effective date
              </label>
              <input
                id="rate-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="cw-input w-full"
                max={todayISO()}
              />
            </div>
            <div>
              <label htmlFor="rate-val" className="text-xs text-inkDim block mb-1">
                IQD per 1 USD
              </label>
              <input
                id="rate-val"
                type="number"
                step="1"
                min="1"
                inputMode="numeric"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="1500"
                className="cw-input w-full font-mono"
                required
              />
            </div>
            {err && <div className="text-danger text-sm">{err}</div>}
            <button className="cw-btn-primary w-full" disabled={busy || !rate}>
              {busy ? 'Saving…' : savedFlash ? 'Saved' : 'Save rate'}
            </button>
            <p className="text-xs text-inkDim">
              Entering a rate for a date that already has one will replace it.
            </p>
          </form>

          <div className="cw-card p-5 md:col-span-2">
            <div className="flex items-baseline justify-between mb-3">
              <div className="cw-label">History</div>
              {rates[0] && (
                <div className="text-xs text-inkDim">
                  Latest: <span className="text-ink font-mono">
                    {Math.round(rates[0].rate_iqd_per_usd).toLocaleString()}
                  </span> · {fmtDate(rates[0].effective_date)}
                </div>
              )}
            </div>
            {chartData.length >= 2 ? (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#252E47" strokeDasharray="2 4" />
                    <XAxis
                      dataKey="date"
                      stroke="#A8A293"
                      fontSize={11}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis
                      stroke="#A8A293"
                      fontSize={11}
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => v.toLocaleString()}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#141B2D',
                        border: '1px solid #252E47',
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#EDE8DC' }}
                      itemStyle={{ color: '#C9A961' }}
                      formatter={(v) => [v.toLocaleString(), 'IQD / 1 USD']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#C9A961"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#C9A961' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-inkDim text-sm py-12 text-center">
                The chart unlocks once at least two rates are logged.
              </div>
            )}
          </div>
        </div>

        <div className="cw-card overflow-hidden">
          <div className="cw-label px-5 pt-5 pb-3">Log</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-inkDim border-y border-line text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-2 font-medium">Effective date</th>
                <th className="text-right px-5 py-2 font-medium">IQD / 1 USD</th>
                <th className="text-right px-5 py-2 font-medium">Logged</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="4" className="text-center text-inkDim py-8">Loading…</td></tr>
              )}
              {!loading && rates.length === 0 && (
                <tr><td colSpan="4" className="text-center text-inkDim py-8">
                  No rates yet. Add today's to begin.
                </td></tr>
              )}
              {rates.map((r) => (
                <tr key={r.id} className="border-b border-line/40 last:border-0 hover:bg-surface2/60">
                  <td className="px-5 py-3">{fmtDate(r.effective_date)}</td>
                  <td className="px-5 py-3 text-right font-mono">
                    {Math.round(r.rate_iqd_per_usd).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-inkDim text-xs">
                    {fmtRelativeDate(r.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => del(r.id)}
                      className="text-inkDim hover:text-danger text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthedShell>
  );
}
