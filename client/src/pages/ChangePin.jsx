import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/session.jsx';
import { Logo } from '../components/Logo.jsx';
import { Shell } from '../components/Layout.jsx';

export default function ChangePin() {
  const { user, changePin, logout } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('current'); // current | next | confirm
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const active = step === 'current' ? current : step === 'next' ? next : confirm;
  const setActive = (v) => {
    setErr(null);
    if (step === 'current') setCurrent(v);
    else if (step === 'next') setNext(v);
    else setConfirm(v);
  };

  const onDigit = (d) => {
    if (active.length >= 4) return;
    setActive(active + d);
  };
  const onBack = () => setActive(active.slice(0, -1));

  const advance = async () => {
    if (step === 'current') {
      if (current.length !== 4) return;
      setStep('next');
    } else if (step === 'next') {
      if (next.length !== 4) return;
      if (next === current) {
        setErr('New PIN must differ from current PIN.');
        setNext('');
        return;
      }
      setStep('confirm');
    } else {
      if (confirm.length !== 4) return;
      if (confirm !== next) {
        setErr('PINs do not match. Try again.');
        setConfirm('');
        setNext('');
        setStep('next');
        return;
      }
      setSubmitting(true);
      try {
        await changePin(current, next);
        navigate(user.role === 'owner' ? '/owner' : '/mom', { replace: true });
      } catch (e) {
        setErr(e.message || 'Could not change PIN.');
        setStep('current');
        setCurrent(''); setNext(''); setConfirm('');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Auto-advance when a step's 4 digits are entered.
  useEffect(() => {
    if (active.length === 4 && !submitting) {
      const id = setTimeout(advance, 100);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, submitting, step]);

  const labels = {
    current: 'Enter current PIN',
    next:    'Choose a new PIN',
    confirm: 'Confirm new PIN',
  };

  return (
    <Shell>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={48} />
          <h1 className="text-3xl mt-4">Set your PIN</h1>
          <p className="text-inkDim text-sm text-center mt-2 max-w-sm">
            For security, choose a PIN only you know. The default
            <code className="mx-1 text-gold">0000</code>
            must be replaced before you can use Commonwealth.
          </p>
        </div>

        <div className="cw-card p-6">
          <div className="cw-label mb-3">{labels[step]}</div>

          <div className="flex justify-center gap-3 my-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-12 h-14 rounded border flex items-center justify-center text-2xl font-mono ${
                  active[i] ? 'border-gold text-gold' : 'border-line text-inkDim'
                }`}
              >
                {active[i] ? '•' : ''}
              </div>
            ))}
          </div>

          {err && (
            <div className="text-danger text-sm text-center mb-4">{err}</div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => onDigit(String(n))}
                disabled={submitting}
                className="h-14 rounded bg-surface2 hover:bg-line text-ink text-xl font-medium transition-colors"
              >{n}</button>
            ))}
            <button
              onClick={() => setActive('')}
              disabled={submitting}
              className="h-14 rounded text-inkDim hover:text-ink hover:bg-surface2 transition-colors"
            >Clear</button>
            <button
              onClick={() => onDigit('0')}
              disabled={submitting}
              className="h-14 rounded bg-surface2 hover:bg-line text-ink text-xl font-medium transition-colors"
            >0</button>
            <button
              onClick={onBack}
              disabled={submitting}
              className="h-14 rounded text-inkDim hover:text-ink hover:bg-surface2 transition-colors"
            >←</button>
          </div>

          <div className="mt-6 text-center">
            <button onClick={logout} className="cw-btn-ghost text-xs">
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
