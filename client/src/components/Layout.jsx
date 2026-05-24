import { NavLink } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { useAuth } from '../lib/session.jsx';
import { MobileNav } from './MobileNav.jsx';

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

const OWNER_NAV = [
  { to: '/owner',                 label: 'Dashboard',    end: true },
  { to: '/owner/income',          label: 'Income' },
  { to: '/owner/transactions',    label: 'Allocations' },
  { to: '/owner/pending-desires', label: 'Pending' },
  { to: '/owner/budgets',         label: 'Budgets' },
  { to: '/owner/goals',           label: 'Goals' },
  { to: '/owner/reports',         label: 'Reports' },
  { to: '/owner/journal',         label: 'Journal' },
  { to: '/owner/rates',           label: 'Rates' },
  { to: '/owner/settings',        label: 'Settings' },
];

// Desktop-only horizontal nav. Mobile uses the bottom bar (MobileNav).
function OwnerNav() {
  return (
    <nav className="hidden sm:flex flex-wrap items-center gap-0.5 text-sm">
      {OWNER_NAV.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
              isActive ? 'text-gold bg-gold/5' : 'text-inkDim hover:text-ink hover:bg-surface2/60'
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AuthedShell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink pt-[env(safe-area-inset-top,0px)]">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-start justify-between gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <Logo size={32} withWordmark />
            {user?.role === 'owner' && <OwnerNav />}
          </div>
          <div className="flex items-center gap-3 text-sm py-1">
            <span className="text-inkDim hidden sm:inline">
              <span className="cw-label mr-2">User</span>
              <span className="text-ink">{user?.name}</span>
            </span>
            {/* Sign out lives in the mobile More sheet — hide here on mobile */}
            <button onClick={logout} className="cw-btn-ghost text-sm hidden sm:inline-flex">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line/50 mt-8 sm:mt-12 hidden sm:block">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-inkDim/70 flex items-center justify-between flex-wrap gap-2">
          <span>Commonwealth · a wealth-building operating system</span>
          <span className="italic">Built in silence. Compounded in patience.</span>
        </div>
      </footer>
      <MobileNav />
    </div>
  );
}
