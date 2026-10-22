const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('luxurystay_token');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  // A 401 means the stored session can no longer be trusted.
  // Tell AuthContext to clear it so the UI does not remain in a
  // misleading logged-in state with a stale/expired token.
  if (res.status === 401 && token) {
    window.dispatchEvent(new CustomEvent('luxurystay:auth-expired'));
  }

  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}
