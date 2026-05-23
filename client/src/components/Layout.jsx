import { Logo } from './Logo.jsx';
import { useAuth } from '../lib/session.jsx';

export function Shell({ children, footer }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
      {footer}
    </div>
  );
}

export function AuthedShell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size={32} withWordmark />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-inkDim">
              <span className="cw-label mr-2">User</span>
              <span className="text-ink">{user?.name}</span>
            </span>
            <button onClick={logout} className="cw-btn-ghost text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}
