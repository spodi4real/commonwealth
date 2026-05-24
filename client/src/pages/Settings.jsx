import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/settings');
      setSettings(r.settings);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => {}); }, []);

  return (
    <AuthedShell>
      <div className="space-y-6 max-w-2xl">
        <header>
          <div className="cw-label">Configuration</div>
          <h1 className="text-4xl mt-1">Settings</h1>
          <p className="text-inkDim mt-2 text-sm leading-relaxed">
            The few numbers that shape how Commonwealth behaves. Change them
            deliberately — they affect dashboards, friction, and Mom's verdicts.
          </p>
        </header>

        {loading && <div className="text-inkDim">Loading…</div>}
        {settings && (
          <>
            <SettingCard
              title="Monthly income"
              description="Drives the dashboard's net position and savings rate. Stored as USD cents."
              keyName="monthly_income_usd_cents"
              value={settings.monthly_income_usd_cents}
              displayMode="usd-cents"
              onSaved={load}
            />
            <SettingCard
              title="Friction threshold"
              description="Allocations at or above this USD amount trigger the justification ritual."
              keyName="friction_threshold_usd"
              value={settings.friction_threshold_usd}
              displayMode="usd"
              onSaved={load}
            />
            <SettingCard
              title="Mom · auto-approve floor"
              description="Mom's asks under this USD amount get a green light immediately."
              keyName="mom_auto_approve_usd"
              value={settings.mom_auto_approve_usd}
              displayMode="usd"
              onSaved={load}
            />
            <SettingCard
              title="Mom · hard limit"
              description="Mom's asks above this USD amount are blocked — Owner must log them directly."
              keyName="mom_hard_limit_usd"
              value={settings.mom_hard_limit_usd}
              displayMode="usd"
              onSaved={load}
            />
          </>
        )}
      </div>
    </AuthedShell>
  );
}

function SettingCard({ title, description, keyName, value, displayMode, onSaved }) {
  const initial = displayMode === 'usd-cents'
    ? ((value ?? 0) / 100).toFixed(2)
    : String(value ?? 0);
  const [val, setVal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const dirty = val !== initial;

  const save = async () => {
    setErr(null);
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n < 0) { setErr('Non-negative number required.'); return; }
    setBusy(true);
    try {
      const payload = displayMode === 'usd-cents' ? Math.round(n * 100) : n;
      await api.put(`/api/settings/${keyName}`, { value: payload });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      await onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="cw-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-xl">{title}</h2>
          <p className="text-xs text-inkDim mt-1 max-w-md">{description}</p>
        </div>
        <div className="text-right">
          <div className="cw-label">Current</div>
          <div className="font-serif text-2xl text-ink">
            {displayMode === 'usd-cents' ? fmtUSD(value) : `$${value}`}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="cw-label block mb-1">New value (USD)</label>
          <input
            type="number" step={displayMode === 'usd-cents' ? '0.01' : '1'} min="0"
            value={val} onChange={(e) => setVal(e.target.value)}
            className="cw-input w-full font-mono"
          />
        </div>
        <button onClick={save} disabled={busy || !dirty}
          className={`cw-btn-primary ${savedFlash ? 'bg-success text-bg' : ''}`}>
          {busy ? '…' : savedFlash ? '✓ Saved' : 'Save'}
        </button>
      </div>
      {err && <div className="text-danger text-xs mt-2">{err}</div>}
    </div>
  );
}
