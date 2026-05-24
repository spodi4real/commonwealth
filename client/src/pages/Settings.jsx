import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtUSD, fmtIQD } from '../lib/format.js';
import { AuthedShell } from '../components/Layout.jsx';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/settings');
      setSettings(r.settings);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadSettings().catch(() => {}); }, []);

  return (
    <AuthedShell>
      <div className="space-y-8 max-w-3xl">
        <header>
          <div className="cw-label">Configuration</div>
          <h1 className="text-4xl mt-1">Settings</h1>
          <p className="text-inkDim mt-2 text-sm leading-relaxed">
            The few numbers and lists that shape how Commonwealth behaves.
            Change them deliberately — they affect dashboards and friction.
          </p>
        </header>

        <CashPositionSection />

        <section>
          <h2 className="font-serif text-2xl mb-3">Knobs</h2>
          <div className="space-y-4">
            {loading && <div className="text-inkDim">Loading…</div>}
            {settings && (
              <>
                <SettingCard
                  title="Monthly income (fallback)"
                  description="Used only as a baseline before income entries accumulate. Once you log real income, the rolling 3-month average takes over."
                  keyName="monthly_income_usd_cents"
                  value={settings.monthly_income_usd_cents}
                  displayMode="usd-cents"
                  onSaved={loadSettings}
                />
                <SettingCard
                  title="Friction threshold"
                  description="Allocations at or above this USD amount trigger the justification ritual."
                  keyName="friction_threshold_usd"
                  value={settings.friction_threshold_usd}
                  displayMode="usd"
                  onSaved={loadSettings}
                />
              </>
            )}
          </div>
        </section>

        <RerunWizardCard />
      </div>
    </AuthedShell>
  );
}

function CashPositionSection() {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const r = await api.get('/api/cash');
    setData(r);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  if (!data) return null;
  const accounts = data.accounts;

  return (
    <section>
      <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl">Current position</h2>
          <p className="text-inkDim text-sm mt-1">
            A snapshot of where your money actually is right now. Update whenever it changes.
          </p>
        </div>
        <div className="text-right">
          <div className="cw-label">Total cash</div>
          <div className="font-serif text-3xl text-gold">{fmtUSD(data.total_usd_cents)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="cw-card p-6 text-inkDim text-sm text-center">
            No cash accounts logged. Add one to ground the dashboard in reality.
          </div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="cw-card p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg">
                {a.name}
                <span className="text-inkDim text-xs ml-2 uppercase tracking-wider">{a.type.replace('_', ' ')}</span>
              </div>
              {a.notes && <div className="text-xs text-inkDim mt-0.5 italic">{a.notes}</div>}
            </div>
            <div className="text-right">
              <div className="font-mono text-ink">{fmtUSD(a.balance_usd_cents)}</div>
              {a.type === 'cash_iqd' && a.balance_iqd != null && (
                <div className="text-xs text-inkDim font-mono">{fmtIQD(a.balance_iqd)}</div>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <button onClick={() => setEditing(a)} className="cw-btn-ghost py-1 px-2">Edit</button>
              <button onClick={async () => {
                if (!confirm('Archive this account? Totals will drop by this balance.')) return;
                await api.del(`/api/cash/${a.id}`); await load();
              }} className="cw-btn-ghost py-1 px-2 hover:text-danger">Archive</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setAdding(true)} className="cw-btn-ghost text-sm mt-3">+ Add account</button>

      {(adding || editing) && (
        <CashModal
          editing={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await load(); }}
        />
      )}
    </section>
  );
}

function CashModal({ editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState(editing?.type ?? 'bank');
  const [usd, setUsd] = useState(editing ? (editing.balance_usd_cents / 100).toFixed(2) : '');
  const [iqd, setIqd] = useState(editing?.balance_iqd != null ? String(editing.balance_iqd) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Name required.'); return; }
    setBusy(true);
    try {
      const body = { name, type, notes: notes || undefined };
      if (type === 'cash_iqd' && iqd) body.balance_iqd = parseFloat(iqd);
      else                            body.balance_usd = parseFloat(usd) || 0;
      if (isEdit) await api.put(`/api/cash/${editing.id}`, body);
      else        await api.post('/api/cash', body);
      await onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-bg/90 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="cw-card w-full max-w-md p-6 cw-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl">{isEdit ? 'Edit account' : 'Add account'}</h2>
          <button onClick={onClose} className="cw-btn-ghost">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="cw-label block mb-1">Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                   className="cw-input w-full" placeholder="e.g. Wages bank" />
          </div>
          <div>
            <label className="cw-label block mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="cw-input w-full">
              <option value="cash_iqd">Cash IQD</option>
              <option value="cash_usd">Cash USD</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </div>
          {type === 'cash_iqd' ? (
            <div>
              <label className="cw-label block mb-1">Balance (IQD)</label>
              <input type="number" min="0" step="1" value={iqd} onChange={(e) => setIqd(e.target.value)}
                     className="cw-input w-full font-mono" />
              <div className="text-xs text-inkDim mt-1">Converted to USD using the current rate on save.</div>
            </div>
          ) : (
            <div>
              <label className="cw-label block mb-1">Balance (USD)</label>
              <input type="number" min="0" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)}
                     className="cw-input w-full font-mono" />
            </div>
          )}
          <div>
            <label className="cw-label block mb-1">Notes (opt.)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
                   className="cw-input w-full" />
          </div>
          {err && <div className="text-danger text-sm">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="cw-btn-ghost">Cancel</button>
            <button disabled={busy} className="cw-btn-primary">{busy ? '…' : (isEdit ? 'Save' : 'Add')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RerunWizardCard() {
  const [busy, setBusy] = useState(false);
  const trigger = async () => {
    if (!confirm('Re-open the first-run wizard? Your existing data stays intact — the wizard will only add new entries.')) return;
    setBusy(true);
    try {
      await api.post('/api/setup/reset');
      // Force a hard reload so the auth context picks up setupComplete=false
      // and routes us to the wizard.
      window.location.href = '/owner/wizard';
    } finally { setBusy(false); }
  };
  return (
    <section>
      <h2 className="font-serif text-2xl mb-3">Reset</h2>
      <div className="cw-card p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-serif text-lg">Re-run the setup wizard</div>
          <div className="text-xs text-inkDim mt-1">
            Useful if your starting position has drifted from what you first entered.
          </div>
        </div>
        <button onClick={trigger} disabled={busy} className="cw-btn-ghost text-sm">
          {busy ? '…' : 'Open wizard'}
        </button>
      </div>
    </section>
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
