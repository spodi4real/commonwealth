import { useState } from 'react';
import { api } from '../lib/api.js';

export function ReviewModal({ month, questions, existingAnswers, onClose, onSaved }) {
  const init = existingAnswers ?? { q1: '', q2: '', q3: '', q4: '', q5: '' };
  const [a, setA] = useState(init);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const keys = ['q1', 'q2', 'q3', 'q4', 'q5'];
  const k = keys[step];
  const last = step === questions.length - 1;
  const ready = (a[k] ?? '').trim().length > 0;

  const next = () => {
    setErr(null);
    if (!ready) { setErr('Write something honest before continuing.'); return; }
    setStep(step + 1);
  };

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.post('/api/reviews', { month, ...a });
      await onSaved?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-bg/95 flex items-center justify-center px-4 z-50">
      <div className="cw-card w-full max-w-xl p-6 border-l-2 border-gold">
        <div className="flex items-center justify-between mb-2">
          <div className="cw-label">Monthly review · {month}</div>
          <span className="text-xs text-inkDim">{step + 1} of {questions.length}</span>
        </div>
        <h2 className="font-serif text-2xl mb-4">{questions[step]}</h2>

        <textarea
          autoFocus
          value={a[k]}
          onChange={(e) => setA({ ...a, [k]: e.target.value })}
          rows={5}
          className="cw-input w-full resize-none"
          placeholder="Be specific. Future-you will read this."
          maxLength={2000}
        />

        {err && <div className="text-danger text-sm mt-2">{err}</div>}

        <div className="flex justify-between mt-5">
          <div>
            {step > 0 && (
              <button onClick={() => { setErr(null); setStep(step - 1); }} className="cw-btn-ghost text-sm">
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="cw-btn-ghost text-sm">Save & close later</button>
            {last ? (
              <button onClick={submit} disabled={busy || !ready} className="cw-btn-primary">
                {busy ? '…' : 'Save review'}
              </button>
            ) : (
              <button onClick={next} disabled={!ready} className="cw-btn-primary">Continue →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
