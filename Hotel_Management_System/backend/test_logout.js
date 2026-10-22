const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: 'test@luxury.com', password: 'Test1234' })
    });
    const login = await loginRes.json();
    console.log('login:', login.token ? 'ok' : JSON.stringify(login));
    const token = login.token;
    const logoutRes = await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token }
    });
    const logout = await logoutRes.json();
    console.log('logout:', logout);
  } catch (err) {
    console.error(err);
  }
})();
