import { useEffect, useState } from 'react';
import { fmtUSD } from '../lib/format.js';
import { TX_TYPES } from '../lib/categories.js';

// Three-step ritual for transactions at or above the friction threshold.
// The point isn't to gather data — it's to interrupt the moment of impulse.
//
// Returns via onDecided({ type, canWait, whyNow }) where:
//   type    : 'need' | 'want' | 'investment'
//   canWait : boolean | null  (null when not asked, i.e. not a want)
//   whyNow  : string (>= 10 chars)

export function JustificationModal({ amountCents, category, onClose, onDecided }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [canWait, setCanWait] = useState(null);
  const [whyNow, setWhyNow] = useState('');
  const [err, setErr] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalSteps = type === 'want' ? 3 : 2;

  const next = () => {
    setErr(null);
    if (step === 1) {
      if (!type) { setErr('Choose a classification.'); return; }
      setStep(type === 'want' ? 2 : 3);
      return;
    }
    if (step === 2) {
      if (canWait === null) { setErr('Choose one.'); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (whyNow.trim().length < 10) { setErr('At least 10 characters.'); return; }
      onDecided({ type, canWait: type === 'want' ? canWait : null, whyNow: whyNow.trim() });
    }
  };

  const back = () => {
    setErr(null);
    if (step === 3) setStep(type === 'want' ? 2 : 1);
    else if (step === 2) setStep(1);
  };

  const willDefer = type === 'want' && canWait === true;

  return (
    <div className="fixed inset-0 bg-bg/95 flex items-center justify-center px-4 z-50">
      <div className="cw-card w-full max-w-lg p-6 border-l-2 border-gold" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="cw-label">Pause and decide</div>
          <span className="text-xs text-inkDim">Step {step === 3 ? totalSteps : step} of {totalSteps}</span>
        </div>
        <h2 className="font-serif text-2xl mb-1">
          {fmtUSD(amountCents, { cents: true })}
          <span className="text-inkDim text-base ml-2">· {category}</span>
        </h2>
        <p className="text-inkDim text-sm mb-6 italic">
          {step === 1 && 'What kind of allocation is this?'}
          {step === 2 && 'Could this purchase wait twenty-four hours?'}
          {step === 3 && 'Why now? Write one honest sentence.'}
        </p>

        {step === 1 && (
          <div className="grid grid-cols-3 gap-3">
            {TX_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`cw-card p-4 text-left transition-all ${
                  type === t.key ? 'border-gold ring-1 ring-gold' : 'hover:border-gold/40'
                }`}
              >
                <div className="font-serif text-xl">{t.label}</div>
                <div className="text-xs text-inkDim mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: true,  l: 'Yes, it can wait', s: 'It moves to the Pending Desires list. The app will ask again in 24h.' },
              { v: false, l: 'No, not really',   s: 'You will log this allocation now.' },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                onClick={() => setCanWait(opt.v)}
                className={`cw-card p-4 text-left transition-all ${
                  canWait === opt.v ? 'border-gold ring-1 ring-gold' : 'hover:border-gold/40'
                }`}
              >
                <div className="font-serif text-lg">{opt.l}</div>
                <div className="text-xs text-inkDim mt-1">{opt.s}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            <textarea
              autoFocus
              value={whyNow}
              onChange={(e) => setWhyNow(e.target.value)}
              placeholder="One honest sentence about why this can't wait, or why it builds future value."
              className="cw-input w-full h-28 resize-none"
              maxLength={500}
            />
            <div className="text-xs text-inkDim mt-1 flex justify-between">
              <span>Minimum 10 characters.</span>
              <span className={whyNow.length >= 10 ? 'text-success' : ''}>
                {whyNow.length}
              </span>
            </div>
            {willDefer && (
              <div className="mt-3 text-xs text-warning bg-warning/10 border border-warning/40 rounded p-3">
                This will be deferred to Pending Desires. You'll be asked again in 24 hours.
              </div>
            )}
          </div>
        )}

        {err && <div className="text-danger text-sm mt-3">{err}</div>}

        <div className="flex justify-between mt-6">
          <div>
            {step > 1 && (
              <button onClick={back} className="cw-btn-ghost text-sm">← Back</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="cw-btn-ghost text-sm">Cancel</button>
            <button onClick={next} className="cw-btn-primary text-sm">
              {step === 3
                ? (willDefer ? 'Defer 24 hours' : 'Log allocation')
                : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
