import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/session.jsx';

// Tiny inline icon set — keeps bundle small and lets us tone each icon.
function Icon({ name, className = 'w-5 h-5' }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const props = { className, viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', ...stroke };
  switch (name) {
    case 'home':      return (<svg {...props}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></svg>);
    case 'income':    return (<svg {...props}><path d="M12 20V6" /><path d="M6 12l6-6 6 6" /><circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none" /></svg>);
    case 'ledger':    return (<svg {...props}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>);
    case 'pending':   return (<svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>);
    case 'more':      return (<svg {...props}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>);
    case 'budgets':   return (<svg {...props}><path d="M4 20h16" /><rect x="6"  y="11" width="3" height="9" /><rect x="11" y="6"  width="3" height="14" /><rect x="16" y="14" width="3" height="6" /></svg>);
    case 'goals':     return (<svg {...props}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>);
    case 'reports':   return (<svg {...props}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 16l3-4 3 2 5-7" /></svg>);
    case 'journal':   return (<svg {...props}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>);
    case 'rates':     return (<svg {...props}><path d="M4 17l4-4 4 4 8-8" /><path d="M14 5h6v6" /></svg>);
    case 'settings':  return (<svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.3 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.97 7.97 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.3 3h4l.3-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5L19.4 13z" /></svg>);
    case 'signout':   return (<svg {...props}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></svg>);
    default: return null;
  }
}

const PRIMARY = [
  { to: '/owner',                 label: 'Home',     icon: 'home',    end: true },
  { to: '/owner/income',          label: 'Income',   icon: 'income' },
  { to: '/owner/transactions',    label: 'Log',      icon: 'ledger' },
  { to: '/owner/pending-desires', label: 'Pending',  icon: 'pending' },
];

const MORE = [
  { to: '/owner/budgets',  label: 'Budgets',  icon: 'budgets' },
  { to: '/owner/goals',    label: 'Goals',    icon: 'goals' },
  { to: '/owner/reports',  label: 'Reports',  icon: 'reports' },
  { to: '/owner/journal',  label: 'Journal',  icon: 'journal' },
  { to: '/owner/rates',    label: 'Rates',    icon: 'rates' },
  { to: '/owner/settings', label: 'Settings', icon: 'settings' },
];

export function MobileNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on route change.
  useEffect(() => {
    const onPop = () => setMoreOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (user?.role !== 'owner') return null;

  return (
    <>
      <div className="h-16 sm:hidden" /> {/* spacer so content isn't covered by the fixed bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-surface/95 backdrop-blur border-t border-line
                      pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {PRIMARY.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `flex flex-col items-center justify-center py-2 gap-0.5
                ${isActive ? 'text-gold' : 'text-inkDim active:text-ink'}`}
            >
              <Icon name={l.icon} />
              <span className="text-[10px] tracking-wide">{l.label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)}
                  className="flex flex-col items-center justify-center py-2 gap-0.5 text-inkDim active:text-ink">
            <Icon name="more" />
            <span className="text-[10px] tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-bg/80 cw-fade-in" />
          <div
            className="absolute bottom-0 inset-x-0 bg-surface border-t border-line rounded-t-lg
                       pb-[env(safe-area-inset-bottom,0px)] cw-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line/50">
              <div className="cw-label">More</div>
              <button onClick={() => setMoreOpen(false)} className="cw-btn-ghost text-sm">Done</button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-3">
              {MORE.map((l) => (
                <button key={l.to}
                  onClick={() => { setMoreOpen(false); navigate(l.to); }}
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded text-inkDim active:bg-surface2 active:text-ink"
                >
                  <Icon name={l.icon} className="w-6 h-6" />
                  <span className="text-xs">{l.label}</span>
                </button>
              ))}
              <button onClick={async () => { setMoreOpen(false); await logout(); }}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded text-danger/80 active:bg-surface2"
              >
                <Icon name="signout" className="w-6 h-6" />
                <span className="text-xs">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
