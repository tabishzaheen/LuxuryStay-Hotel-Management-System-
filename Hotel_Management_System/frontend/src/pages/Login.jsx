import { useEffect, useState } from 'react';
import {
  useLocation,
  useNavigate
} from 'react-router-dom';

import {
  ArrowRight,
  ShieldCheck,
  Wifi,
  Star,
  Sun,
  Moon
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] =
    useState('admin@luxurystay.com');

  const [password, setPassword] =
    useState('admin123');

  const [idNumber, setIdNumber] =
    useState('');

  const [error, setError] =
    useState('');

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('luxurystay_theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('luxurystay_theme', darkMode ? 'dark' : 'light'); } catch {}
  }, [darkMode]);

  const { login } = useAuth();

  const navigate =
    useNavigate();

  const location =
    useLocation();


  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const user = await login(
        email,
        password,
        idNumber
      );

      const destination = location.state?.from?.pathname || (user.role === 'guest' ? '/guest' : '/');
      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err.message ||
        'Unable to sign in.'
      );
    }
  };


  return (
    <div className="login-page">
      <button
        type="button"
        className="login-theme-toggle"
        onClick={() => setDarkMode((value) => !value)}
        aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        title={darkMode ? 'Light theme' : 'Dark theme'}
      >
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        <span>{darkMode ? 'Light' : 'Dark'}</span>
      </button>

      <div className="login-visual">
        <div className="visual-overlay"></div>

        <div className="visual-copy">

          <div className="brand light">
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


          <div className="quote">
            <span>
              The Art of Hospitality
            </span>

            <h1>
              Exceptional service,
              <br />
              <em>
                seamless operations.
              </em>
            </h1>

            <p>
              Tools designed for hospitality teams to deliver
              consistent, memorable guest experiences.
            </p>
          </div>


          <div className="trust">
            <div>
              <ShieldCheck size={18} />
              Secure access
            </div>

            <div>
              <Wifi size={18} />
              Live operations
            </div>

            <div>
              <Star size={18} />
              5-star service
            </div>
          </div>

        </div>
      </div>


      <div className="login-panel">

        <div className="login-box">

          <div className="mobile-brand">
            <div className="brand-mark">
              LS
            </div>

            <b>
              LuxuryStay
            </b>
          </div>


          <div className="eyebrow">
            STAFF & GUEST PORTAL
          </div>

          <h2>
            Welcome back
          </h2>

          <p className="muted">
            Sign in to manage today's operations.
          </p>


          <form onSubmit={submit}>

            <label>
              Work email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="name@luxurystay.com"
                autoComplete="email"
              />
            </label>


            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </label>

            <label>
              Passport / ID number <span style={{fontWeight: 500, color: '#87918d'}}>(guests only)</span>

              <input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                placeholder="Required for guest accounts"
                autoComplete="off"
              />
            </label>


            {error && (
              <div className="form-error">
                {error}
              </div>
            )}


            <div className="remember">

              <label className="check">
                <input
                  type="checkbox"
                  defaultChecked
                />

                Remember me
              </label>

              <a href="#">
                Forgot password?
              </a>

            </div>


            <button
              className="btn primary full"
              type="submit"
            >
              Sign in
              <ArrowRight size={17} />
            </button>

          </form>


          <div className="demo-hint">
            <b>
              Current seed access
            </b>

            <span>
              admin@luxurystay.com · admin123
            </span>
          </div>


          <small className="login-footer">
            © 2026 LuxuryStay Hospitality Group
            · Authorized personnel only
          </small>

        </div>

      </div>

    </div>
  );
}