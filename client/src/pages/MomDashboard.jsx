import { AuthedShell } from '../components/Layout.jsx';
import { useAuth } from '../lib/session.jsx';

export default function MomDashboard() {
  const { user } = useAuth();
  return (
    <AuthedShell>
      <div className="max-w-lg mx-auto text-center pt-10">
        <div className="cw-label">Welcome</div>
        <h1 className="text-4xl mt-2">Hello, {user?.name}.</h1>
        <p className="mt-6 text-inkDim leading-relaxed">
          Your simple interface — "Can I spend this?", "I spent this", and
          today's allowance — will arrive in the next phase.
        </p>
      </div>
    </AuthedShell>
  );
}
