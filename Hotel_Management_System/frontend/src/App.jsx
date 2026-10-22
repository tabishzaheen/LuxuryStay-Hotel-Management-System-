import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Reservations from './pages/Reservations';
import Guests from './pages/Guests';
import Housekeeping from './pages/Housekeeping';
import Maintenance from './pages/Maintenance';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Services from './pages/Services';
import Settings from './pages/Settings';
import Login from './pages/Login';
import OnlineBooking from './pages/OnlineBooking';
import GuestPortal from './pages/GuestPortal';

const roles = {
  admin: ['dashboard', 'staff', 'guests', 'rooms', 'reservations', 'housekeeping', 'maintenance', 'billing', 'reports', 'services', 'settings'],
  manager: [ 'rooms', 'reservations', 'housekeeping', 'maintenance', 'billing', 'reports', 'services'],
  receptionist: [ 'rooms', 'reservations'],
  housekeeping: [ 'rooms', 'housekeeping', 'maintenance'],
  maintenance: [ 'rooms', 'maintenance'],
  guest: ['guest']
};

function canAccess(user, permission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roles[user.role]?.includes(permission) || false;
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function Protected({ Component, permission }) {
  const { user } = useAuth();
  if (!canAccess(user, permission)) {
    return <Navigate to={user?.role === 'guest' ? '/guest' : '/'} replace />;
  }
  return <Layout><Component /></Layout>;
}

function RoleLanding() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <Layout><Dashboard /></Layout>;
  }

  const destination = {
    manager: '/reports',
    receptionist: '/reservations',
    housekeeping: '/housekeeping',
    maintenance: '/maintenance',
    guest: '/guest'
  }[user?.role] || '/login';

  return <Navigate to={destination} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/book" element={<OnlineBooking />} />

          <Route path="/" element={<RequireAuth><RoleLanding /></RequireAuth>} />
          <Route path="/guest" element={<RequireAuth><Protected Component={GuestPortal} permission="guest" /></RequireAuth>} />
          <Route path="/guest/services" element={<RequireAuth><Protected Component={GuestPortal} permission="guest" /></RequireAuth>} />
          <Route path="/guest/feedback" element={<RequireAuth><Protected Component={GuestPortal} permission="guest" /></RequireAuth>} />
          <Route path="/guest/maintenance" element={<RequireAuth><Protected Component={GuestPortal} permission="guest" /></RequireAuth>} />
          <Route path="/guest/profile" element={<RequireAuth><Protected Component={GuestPortal} permission="guest" /></RequireAuth>} />
          <Route path="/rooms" element={<RequireAuth><Protected Component={Rooms} permission="rooms" /></RequireAuth>} />
          <Route path="/reservations" element={<RequireAuth><Protected Component={Reservations} permission="reservations" /></RequireAuth>} />
          <Route path="/guests" element={<RequireAuth><Protected Component={Guests} permission="guests" /></RequireAuth>} />
          <Route path="/housekeeping" element={<RequireAuth><Protected Component={Housekeeping} permission="housekeeping" /></RequireAuth>} />
          <Route path="/maintenance" element={<RequireAuth><Protected Component={Maintenance} permission="maintenance" /></RequireAuth>} />
          <Route path="/billing" element={<RequireAuth><Protected Component={Billing} permission="billing" /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Protected Component={Reports} permission="reports" /></RequireAuth>} />
          <Route path="/staff" element={<RequireAuth><Protected Component={Staff} permission="staff" /></RequireAuth>} />
          <Route path="/services" element={<RequireAuth><Protected Component={Services} permission="services" /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Protected Component={Settings} permission="settings" /></RequireAuth>} />

          <Route path="/home" element={<RequireAuth><RoleLanding /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
