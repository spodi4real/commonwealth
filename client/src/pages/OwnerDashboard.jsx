import { AuthedShell } from '../components/Layout.jsx';
import { useAuth } from '../lib/session.jsx';

export default function OwnerDashboard() {
  const { user } = useAuth();
  return (
    <AuthedShell>
      <div className="space-y-8">
        <header>
          <div className="cw-label">Dashboard</div>
          <h1 className="text-4xl mt-1">Good to see you, {user?.name}.</h1>
        </header>

        <div className="cw-card p-6">
          <div className="cw-label mb-2">Phase 1 status</div>
          <p className="text-ink leading-relaxed">
            The foundation is in place. Authentication, database, and the two
            seeded users are working. Daily principle, exchange rate, transactions,
            budgets, goals, dashboard, and the friction engine arrive in
            subsequent phases.
          </p>
          <p className="text-inkDim mt-3 text-sm italic">
            "Begin where you are, with what you have. Compound math forgives a
            late start more than a slow one."
          </p>
        </div>
      </div>
    </AuthedShell>
  );
}
