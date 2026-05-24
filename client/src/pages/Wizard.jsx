import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtUSD, fmtIQD, todayISO } from '../lib/format.js';
import { Logo } from '../components/Logo.jsx';
import { Shell } from '../components/Layout.jsx';
import { useAuth } from '../lib/session.jsx';

const STEPS = ['Welcome', 'Rate', 'Cash', 'Opening savings', 'Income source', 'Finish'];

export default function Wizard() {
  const { refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1: rate
  const [rate, setRate] = useState('');

  // Step 2: cash accounts
  const [accounts, setAccounts] = useState([
    { name: 'Cash on hand (IQD)', type: 'cash_iqd', balance_iqd: '',  balance_usd: '' },
    { name: 'Cash on hand (USD)', type: 'cash_usd', balance_iqd: '',  balance_usd: '' },
  ]);

  // Step 3: opening savings
  const [goals, setGoals] = useState([]);
  const [openings, setOpenings] = useState({}); // { [goalId]: usdString }
  useEffect(() => {
    api.get('/api/goals').then((r) => setGoals(r.goals)).catch(() => {});
  }, []);

  // Step 4: primary income
  const [income, setIncome] = useState({
    name: 'Primary Salary',
    type: 'salary',
    expected_amount_usd: '1000',
    expected_day_of_month: '28',
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const finish = async () => {
    setErr(null);
    setBusy(true);
    try {
      const cleanAccounts = accounts
        .filter((a) => a.name?.trim())
        .map((a) => ({
          name: a.name.trim(),
          type: a.type,
          balance_usd: a.balance_usd ? parseFloat(a.balance_usd) : undefined,
          balance_iqd: a.balance_iqd ? parseFloat(a.balance_iqd) : undefined,
        }))
        .filter((a) => (a.balance_usd ?? 0) > 0 || (a.balance_iqd ?? 0) > 0);

      const opening_savings = Object.entries(openings)
        .map(([gid, usd]) => ({ goal_id: Number(gid), amount_usd: parseFloat(usd) }))
        .filter((o) => Number.isFinite(o.amount_usd) && o.amount_usd > 0);

      const payload = {
        rate_iqd_per_usd: rate ? parseFloat(rate) : undefined,
        cash_accounts: cleanAccounts,
        opening_savings,
        primary_income: income.name?.trim() ? {
          name: income.name.trim(),
          type: income.type,
          expected_amount_usd: parseFloat(income.expected_amount_usd) || 0,
          expected_day_of_month: parseInt(income.expected_day_of_month, 10) || null,
        } : undefined,
      };

      await api.post('/api/setup/complete', payload);
      await refresh();
      navigate('/owner', { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Shell>
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-6">
          <Logo size={56} withWordmark />
          <p className="text-inkDim text-sm tracking-wide mt-2">First-run setup</p>
        </div>

        <Progress step={step} total={STEPS.length} labels={STEPS} />

        <div className="cw-card p-6 mt-4 cw-fade-in">
          {step === 0 && <StepWelcome onNext={next} />}
          {step === 1 && <StepRate  value={rate} onChange={setRate} />}
          {step === 2 && <StepCash  accounts={accounts} setAccounts={setAccounts} rate={parseFloat(rate)} />}
          {step === 3 && <StepOpening goals={goals} openings={openings} setOpenings={setOpenings} />}
          {step === 4 && <StepIncome income={income} setIncome={setIncome} />}
          {step === 5 && <StepReview rate={rate} accounts={accounts} openings={openings} goals={goals} income={income} />}

          {err && <div className="text-danger text-sm mt-4">{err}</div>}

          {step > 0 && (
            <div className="flex justify-between mt-6 pt-4 border-t border-line">
              <button onClick={back} disabled={busy} className="cw-btn-ghost">← Back</button>
              <div className="flex gap-2">
                <button onClick={logout} className="cw-btn-ghost text-xs">Sign out</button>
                {step < STEPS.length - 1 ? (
                  <button onClick={next} className="cw-btn-primary">Continue →</button>
                ) : (
                  <button onClick={finish} disabled={busy} className="cw-btn-primary">
                    {busy ? 'Setting up…' : 'Finish setup'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Progress({ step, total, labels }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1">
          <div className={`h-1 rounded ${i <= step ? 'bg-gold' : 'bg-line/60'} transition-colors`} />
          <div className={`text-[10px] uppercase tracking-wider mt-1 text-center ${
            i === step ? 'text-gold' : 'text-inkDim/60'
          }`}>{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

function StepWelcome({ onNext }) {
  return (
    <div>
      <div className="cw-label">Step 0</div>
      <h2 className="font-serif text-3xl mt-1">Ground the app in reality.</h2>
      <p className="text-inkDim mt-3 leading-relaxed">
        A budget app that assumes a clean slate is fiction. The next few screens
        ask: how much do you actually have right now, in what form, and what's
        already saved toward each goal?
      </p>
      <p className="text-inkDim mt-3 leading-relaxed">
        Anything you enter can be changed later from Settings.
      </p>
      <div className="mt-6 flex justify-end">
        <button onClick={onNext} className="cw-btn-primary">Begin →</button>
      </div>
    </div>
  );
}

function StepRate({ value, onChange }) {
  return (
    <div>
      <div className="cw-label">Step 1 · Exchange rate</div>
      <h2 className="font-serif text-2xl mt-1">Today's IQD per 1 USD</h2>
      <p className="text-inkDim text-sm mt-2">
        Every transaction is stored in USD and rendered in IQD using the rate
        active on its date. Skip if you'll set this later — but then Mom's flow
        won't price anything.
      </p>
      <input
        autoFocus type="number" inputMode="numeric" step="1" min="1"
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1500"
        className="cw-input mt-4 w-full font-mono text-2xl"
      />
    </div>
  );
}

function StepCash({ accounts, setAccounts, rate }) {
  const update = (i, key, val) => {
    const next = accounts.slice();
    next[i] = { ...next[i], [key]: val };
    setAccounts(next);
  };
  const add = () => setAccounts([...accounts, { name: '', type: 'bank', balance_usd: '' }]);
  const remove = (i) => setAccounts(accounts.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="cw-label">Step 2 · Cash position</div>
      <h2 className="font-serif text-2xl mt-1">Where is your money right now?</h2>
      <p className="text-inkDim text-sm mt-2">
        Add as many accounts as you have. Leave any you don't use empty.
      </p>

      <div className="mt-4 space-y-3">
        {accounts.map((a, i) => (
          <div key={i} className="cw-card p-3 grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="text-xs text-inkDim block mb-1">Name</label>
              <input
                value={a.name} onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="e.g. Savings bank"
                className="cw-input w-full text-sm"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-inkDim block mb-1">Type</label>
              <select
                value={a.type} onChange={(e) => update(i, 'type', e.target.value)}
                className="cw-input w-full text-sm"
              >
                <option value="cash_iqd">Cash IQD</option>
                <option value="cash_usd">Cash USD</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </div>
            {a.type === 'cash_iqd' ? (
              <div className="col-span-4">
                <label className="text-xs text-inkDim block mb-1">Amount (IQD)</label>
                <input
                  type="number" min="0" step="1"
                  value={a.balance_iqd ?? ''} onChange={(e) => update(i, 'balance_iqd', e.target.value)}
                  className="cw-input w-full text-sm font-mono"
                  placeholder="0"
                />
                {rate > 0 && a.balance_iqd && (
                  <div className="text-xs text-inkDim mt-1">
                    ≈ ${(parseFloat(a.balance_iqd) / rate).toFixed(2)}
                  </div>
                )}
              </div>
            ) : (
              <div className="col-span-4">
                <label className="text-xs text-inkDim block mb-1">Amount (USD)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={a.balance_usd ?? ''} onChange={(e) => update(i, 'balance_usd', e.target.value)}
                  className="cw-input w-full text-sm font-mono"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="col-span-1 text-right">
              <button onClick={() => remove(i)} className="text-inkDim hover:text-danger text-sm">✕</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="cw-btn-ghost text-sm mt-3">+ Add another account</button>
    </div>
  );
}

function StepOpening({ goals, openings, setOpenings }) {
  return (
    <div>
      <div className="cw-label">Step 3 · Opening savings</div>
      <h2 className="font-serif text-2xl mt-1">What's already saved toward each goal?</h2>
      <p className="text-inkDim text-sm mt-2">
        Pre-fills your progress bars from day one. Leave blank if starting from zero.
      </p>
      <div className="mt-4 space-y-3">
        {goals.length === 0 && (
          <div className="text-inkDim text-sm">No goals yet — finish setup, then add some.</div>
        )}
        {goals.map((g) => (
          <div key={g.id} className="cw-card p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-serif text-lg">{g.name}</div>
              <div className="text-xs text-inkDim">target {fmtUSD(g.target_usd_cents)}</div>
            </div>
            <div className="w-32">
              <input
                type="number" min="0" step="1"
                value={openings[g.id] ?? ''}
                onChange={(e) => setOpenings({ ...openings, [g.id]: e.target.value })}
                placeholder="0"
                className="cw-input w-full text-right font-mono"
              />
            </div>
            <span className="text-inkDim text-xs w-8">USD</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepIncome({ income, setIncome }) {
  const update = (k, v) => setIncome({ ...income, [k]: v });
  return (
    <div>
      <div className="cw-label">Step 4 · Primary income</div>
      <h2 className="font-serif text-2xl mt-1">Your main income source</h2>
      <p className="text-inkDim text-sm mt-2">
        This sets up a recurring expected entry. You'll log actual receipts each
        month — projections will compare actual vs expected over time.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="cw-label block mb-1">Source name</label>
          <input value={income.name} onChange={(e) => update('name', e.target.value)}
                 className="cw-input w-full" placeholder="Primary Salary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cw-label block mb-1">Type</label>
            <select value={income.type} onChange={(e) => update('type', e.target.value)} className="cw-input w-full">
              <option value="salary">Salary</option>
              <option value="freelance">Freelance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="cw-label block mb-1">Expected day of month</label>
            <input type="number" min="1" max="31"
                   value={income.expected_day_of_month}
                   onChange={(e) => update('expected_day_of_month', e.target.value)}
                   className="cw-input w-full font-mono" placeholder="28" />
          </div>
        </div>
        <div>
          <label className="cw-label block mb-1">Expected amount (USD)</label>
          <input type="number" min="0" step="1"
                 value={income.expected_amount_usd}
                 onChange={(e) => update('expected_amount_usd', e.target.value)}
                 className="cw-input w-full font-mono text-xl" placeholder="1000" />
        </div>
      </div>
      <p className="text-xs text-inkDim mt-3 italic">
        If your income is irregular, set the expected amount to 0 and log each
        receipt manually. The app adapts.
      </p>
    </div>
  );
}

function StepReview({ rate, accounts, openings, goals, income }) {
  const cashSummary = accounts.filter((a) => (a.balance_usd ?? 0) || (a.balance_iqd ?? 0));
  const openingsSummary = Object.entries(openings)
    .filter(([, v]) => parseFloat(v) > 0)
    .map(([gid, usd]) => ({ goal: goals.find((g) => g.id === Number(gid)), usd: parseFloat(usd) }));
  return (
    <div>
      <div className="cw-label">Step 5 · Review</div>
      <h2 className="font-serif text-2xl mt-1">Looks right?</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Exchange rate">
          {rate ? <span className="font-mono">{Math.round(parseFloat(rate)).toLocaleString()} IQD / USD</span>
                : <span className="text-inkDim italic">not set</span>}
        </Row>
        <Row label="Cash position">
          {cashSummary.length === 0 ? <span className="text-inkDim italic">none</span> : (
            <ul className="space-y-0.5">
              {cashSummary.map((a, i) => (
                <li key={i} className="text-ink">
                  <span className="text-inkDim">{a.name}: </span>
                  <span className="font-mono">
                    {a.type === 'cash_iqd' ? fmtIQD(a.balance_iqd) : `$${a.balance_usd}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Opening savings">
          {openingsSummary.length === 0 ? <span className="text-inkDim italic">starting from zero</span> : (
            <ul className="space-y-0.5">
              {openingsSummary.map((o, i) => (
                <li key={i} className="text-ink">
                  <span className="text-inkDim">{o.goal?.name}: </span>
                  <span className="font-mono">${o.usd}</span>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Primary income">
          {income.name?.trim()
            ? <span className="text-ink">
                {income.name} ({income.type}), <span className="font-mono">${income.expected_amount_usd}</span>
                {income.expected_day_of_month && <> on day {income.expected_day_of_month}</>}
              </span>
            : <span className="text-inkDim italic">none</span>}
        </Row>
      </dl>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-4">
      <dt className="cw-label w-32 shrink-0 pt-0.5">{label}</dt>
      <dd className="flex-1 text-ink">{children}</dd>
    </div>
  );
}
