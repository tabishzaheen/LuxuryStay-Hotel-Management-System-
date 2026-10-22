# LuxuryStay HMS — Backend

Quick instructions to run the backend locally.

1. Install dependencies

```bash
cd backend
npm install
```

2. Create `.env` (copy from `.env.example`) and set `MONGO_URI` and `JWT_SECRET`.

3. Seed sample data (creates admin@luxurystay.com / admin123)

```bash
npm run seed
```

4. Start server

```bash
npm run dev
```

Demo accounts created only when missing:

- Admin: `admin@luxurystay.com` / `admin123`
- Manager: `manager@luxurystay.com` / `manager123`
- Receptionist: `receptionist@luxurystay.com` / `reception123`
- Housekeeping: `housekeeping@luxurystay.com` / `housekeeping123`
- Maintenance: `maintenance@luxurystay.com` / `maintenance123`
- Guest: `guest@luxurystay.com` / `guest123` + ID `GUEST-001`

Passwords are stored as bcrypt hashes; the application never returns plaintext passwords.

API root: `GET /` — health check.
