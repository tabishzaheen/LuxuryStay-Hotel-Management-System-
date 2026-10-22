import {
  useEffect,
  useState
} from 'react';

import {
  NavLink,
  useNavigate
} from 'react-router-dom';

import {
  LayoutDashboard,
  Users,
  UserCog,
  BedDouble,
  CalendarDays,
  LogOut,
  Menu,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Wrench,
  ReceiptText,
  BarChart3,
  Settings,
  Bell,
  ConciergeBell,
  MessageSquareText,
  UserRound,
  Sun,
  Moon
} from 'lucide-react';

import {
  useAuth
} from '../context/AuthContext';
import { api } from '../services/api';


const nav = [
  ['Admin Dashboard', '/', LayoutDashboard, ['admin']],
  ['Staff & Roles', '/staff', UserCog, ['admin']],
  ['Guest Profiles', '/guests', Users, ['admin']],
  ['Rooms', '/rooms', BedDouble, ['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance']],
  ['Reservations', '/reservations', CalendarDays, ['admin', 'manager', 'receptionist']],
  ['Housekeeping', '/housekeeping', Sparkles, ['admin', 'manager', 'housekeeping']],
  ['Maintenance', '/maintenance', Wrench, ['admin', 'manager', 'housekeeping', 'maintenance']],
  ['Billing', '/billing', ReceiptText, ['admin', 'manager']],
  ['Reports & Analytics', '/reports', BarChart3, ['admin', 'manager']],
  ['Services', '/services', Sparkles, ['admin', 'manager']],
  ['Settings', '/settings', Settings, ['admin']],
  ['My stays', '/guest', Users, ['guest']],
  ['Guest services', '/guest/services', ConciergeBell, ['guest']],
  ['Feedback', '/guest/feedback', MessageSquareText, ['guest']],
  ['Maintenance', '/guest/maintenance', Wrench, ['guest']],
  ['My profile', '/guest/profile', UserRound, ['guest']]
];


export default function Layout({
  children
}) {

  const [open, setOpen] =
    useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('luxurystay_theme') === 'dark'; } catch { return false; }
  });

  const [notifications, setNotifications] =
    useState([]);

  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const [
    profileMenuOpen,
    setProfileMenuOpen
  ] = useState(false);

  const {
    user,
    logout
  } = useAuth();

  const navigate =
    useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('luxurystay_theme', darkMode ? 'dark' : 'light'); } catch {}
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return undefined;
    const loadNotifications = async () => {
      try {
        const data = await api('/notifications?limit=20');
        if (!cancelled) setNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const markNotificationRead = async (notification) => {
    try {
      if (!notification.readAt) {
        const updated = await api(`/notifications/${notification._id}/read`, { method: 'PATCH' });
        setNotifications((items) => items.map((item) => item._id === updated._id ? updated : item));
      }
      if (notification.link) navigate(notification.link);
      setNotificationOpen(false);
    } catch (error) {
      console.warn('Unable to mark notification as read:', error.message);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (error) {
      console.warn('Unable to mark all notifications as read:', error.message);
    }
  };


  const handleLogout =
    async () => {

      await logout();

      navigate('/login');

      setProfileMenuOpen(
        false
      );

    };


  const initials =
    user?.name
      ? user.name
          .split(' ')
          .map(
            (part) =>
              part[0]
          )
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'AD';


  return (

    <div className="app-shell">

      <aside
        className={`sidebar ${
          open
            ? 'open'
            : ''
        }${user?.role === 'guest' ? ' guest-sidebar' : ''}`}
      >

        <div className="brand">

          <div className="brand-mark">
            LS
          </div>

          <div>

            <strong>
              LuxuryStay
            </strong>

            <span>
              Hospitality Group
            </span>

          </div>

        </div>


        <div className="side-label">
          {user?.role === 'guest' ? 'GUEST MENU' : 'ADMINISTRATION'}
        </div>


        <nav>

          {nav.filter(([, , , allowed]) => allowed.includes(user?.role)).map(
            ([
              label,
              path,
              Icon
            ]) => (

              <NavLink
                key={path}
                to={path}
                end={path === '/' || path === '/guest'}
                onClick={() =>
                  setOpen(false)
                }
                className={({
                  isActive
                }) => [
                  isActive ? 'active' : '',
                  path.startsWith('/guest/') ? 'guest-nav-child' : ''
                ].filter(Boolean).join(' ')}
              >

                <Icon size={18} />

                <span>
                  {label}
                </span>

              </NavLink>

            )
          )}

        </nav>


        <div className="side-bottom">

          <div className="admin-note">

            <ShieldCheck
              size={17}
            />

            <div>

              <b>
                {user?.role === 'guest' ? 'Guest secure access' : 'Administrator access'}
              </b>

              <small>
                {user?.role === 'guest' ? 'Private reservation & stay portal' : 'Roles, permissions & profiles'}
              </small>

            </div>

          </div>


          <button
            className="logout"
            onClick={
              handleLogout
            }
            type="button"
          >

            <LogOut
              size={18}
            />

            <span>
              Sign out
            </span>

          </button>


          <div className="user-mini">

            <div className="avatar">

              {
                user?.avatar ||
                initials
              }

            </div>


            <div>

              <b>
                {
                  user?.name ||
                  'Administrator'
                }
              </b>

              <small>
                {
                  user?.role ||
                  'admin'
                }
              </small>

            </div>

          </div>

        </div>

      </aside>


      <main className="main">

        <header className="topbar admin-topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setOpen(!open)
            }
            aria-label="Toggle menu"
            type="button"
          >
            <Menu size={21} />
          </button>


          <div className="topbar-title">

            <ShieldCheck
              size={17}
            />

            <span>
              {user?.role === 'guest' ? 'Guest Portal' : 'Hotel Operations Console'}
            </span>

          </div>


          <div className="top-actions">

            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDarkMode((value) => !value)}
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              title={darkMode ? "Light theme" : "Dark theme"}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <div className="notification-wrap">
              <button type="button" className="notification-button" onClick={() => setNotificationOpen((value) => !value)} aria-label="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {notificationOpen && <div className="notification-panel">
                <div className="notification-head"><div><b>Notifications</b><small>{unreadCount} unread</small></div><button type="button" onClick={markAllNotificationsRead}>Mark all read</button></div>
                <div className="notification-list">
                  {notifications.length === 0 ? <p className="muted">No notifications yet.</p> : notifications.map((item) => <button type="button" className={`notification-item ${item.readAt ? 'read' : 'unread'}`} key={item._id} onClick={() => markNotificationRead(item)}><span className="notification-dot"/><div><b>{item.title}</b><small>{item.message}</small><em>{new Date(item.createdAt).toLocaleString()}</em></div></button>)}
                </div>
              </div>}
            </div>

            <div className="profile-wrap">

              <button
                type="button"
                className="profile"
                onClick={() =>
                  setProfileMenuOpen(
                    (value) =>
                      !value
                  )
                }
              >

                <div className="avatar">
                  {
                    user?.avatar ||
                    initials
                  }
                </div>


                <div className="profile-copy">

                  <b>
                    {
                      user?.name ||
                      'Administrator'
                    }
                  </b>

                  <span>
                    {
                      user?.role ||
                      'Admin'
                    }
                  </span>

                </div>


                <ChevronDown
                  size={16}
                />

              </button>


              {profileMenuOpen && (

                <div className="profile-menu">

                  <button
                    type="button"
                    onClick={() => {
                      navigate(user?.role === 'guest' ? '/guest' : (user?.role === 'admin' ? '/staff' : '/'));
                      setProfileMenuOpen(false);
                    }}
                  >
                    {user?.role === 'guest' ? 'My guest portal' : (user?.role === 'admin' ? 'Manage staff access' : 'Operations dashboard')}
                  </button>



                  <button
                    type="button"
                    className="menu-danger"
                    onClick={
                      handleLogout
                    }
                  >
                    Sign out
                  </button>

                </div>

              )}

            </div>

          </div>

        </header>


        <div className="content">
          {children}
        </div>

      </main>

    </div>

  );

}