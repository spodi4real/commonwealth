import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/session.jsx';
import Login from './pages/Login.jsx';
import ChangePin from './pages/ChangePin.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';
import Rates from './pages/Rates.jsx';
import MomDashboard from './pages/MomDashboard.jsx';

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-inkDim">
      <span className="font-serif text-2xl">Commonwealth</span>
    </div>
  );
}

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.mustChangePin && loc.pathname !== '/change-pin') {
    return <Navigate to="/change-pin" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'owner' ? '/owner' : '/mom'} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePin) return <Navigate to="/change-pin" replace />;
  return <Navigate to={user.role === 'owner' ? '/owner' : '/mom'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-pin"
        element={
          <RequireAuth>
            <ChangePin />
          </RequireAuth>
        }
      />
      <Route
        path="/owner"
        element={
          <RequireAuth role="owner">
            <OwnerDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/rates"
        element={
          <RequireAuth role="owner">
            <Rates />
          </RequireAuth>
        }
      />
      <Route
        path="/mom"
        element={
          <RequireAuth role="mom">
            <MomDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
