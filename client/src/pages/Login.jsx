import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/session.jsx';
import { Logo } from '../components/Logo.jsx';
import { Shell } from '../components/Layout.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/auth/users').then((r) => setUsers(r.users)).catch(() => {});
  }, []);

  const onDigit = (d) => {
    if (pin.length >= 4) return;
    setErr(null);
    setPin(pin + d);
  };
  const onBack = () => { setErr(null); setPin(pin.slice(0, -1)); };
  const onClear = () => { setErr(null); setPin(''); };

  const submit = async () => {
    if (pin.length !== 4 || !selected) return;
    setSubmitting(true);
    setErr(null);
    try {
      const user = await login(selected.id, pin);
      if (user.mustChangePin) navigate('/change-pin', { replace: true });
      else navigate(user.role === 'owner' ? '/owner' : '/mom', { replace: true });
    } catch (e) {
      setErr(e.message || 'Login failed');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <Shell>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <Logo size={56} withWordmark />
          <p className="mt-4 text-inkDim text-sm tracking-wide">
            A wealth-building operating system.
          </p>
        </div>

        {!selected ? (
          <div className="cw-card p-6">
            <div className="cw-label mb-4">Select user</div>
            <div className="grid grid-cols-2 gap-3">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="cw-card hover:border-gold transition-colors p-6 text-left"
                >
                  <div className="font-serif text-2xl text-ink">{u.name}</div>
                  <div className="text-xs text-inkDim uppercase tracking-widest mt-1">
                    {u.role}
                  </div>
                </button>
              ))}
              {users.length === 0 && (
                <div className="col-span-2 text-inkDim text-sm">
                  No users found. Did you run <code>npm run seed</code>?
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="cw-card p-6">
            <button
              onClick={() => { setSelected(null); setPin(''); setErr(null); }}
              className="cw-btn-ghost text-xs mb-4"
            >
              ← Choose a different user
            </button>
            <div className="cw-label mb-2">PIN for {selected.name}</div>

            <div className="flex justify-center gap-3 my-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded border flex items-center justify-center text-2xl font-mono ${
                    pin[i]
                      ? 'border-gold text-gold'
                      : 'border-line text-inkDim'
                  }`}
                >
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            {err && (
              <div className="text-danger text-sm text-center mb-4">{err}</div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <PinButton key={n} onClick={() => onDigit(String(n))} disabled={submitting}>
                  {n}
                </PinButton>
              ))}
              <PinButton onClick={onClear} disabled={submitting} subtle>Clear</PinButton>
              <PinButton onClick={() => onDigit('0')} disabled={submitting}>0</PinButton>
              <PinButton onClick={onBack} disabled={submitting} subtle>←</PinButton>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function PinButton({ children, subtle, ...props }) {
  return (
    <button
      {...props}
      className={`h-14 rounded font-medium transition-colors ${
        subtle
          ? 'text-inkDim hover:text-ink hover:bg-surface2'
          : 'bg-surface2 hover:bg-line text-ink text-xl'
      }`}
    >
      {children}
    </button>
  );
}
