# LuxuryStay Hotel Management System

MERN-based Hotel Management System with separate `frontend` and `backend` folders.

## Quick start

### 1. Backend

```bash
cd backend
npm install
npm run seed
npm run dev
```

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Default API: `http://localhost:5000/api`

## Demo credentials

| Role | Email | Password | Guest ID |
|---|---|---|---|
| Admin | admin@luxurystay.com | admin123 | — |
| Manager | manager@luxurystay.com | manager123 | — |
| Receptionist | receptionist@luxurystay.com | reception123 | — |
| Housekeeping | housekeeping@luxurystay.com | housekeeping123 | — |
| Maintenance | maintenance@luxurystay.com | maintenance123 | — |
| Guest | guest@luxurystay.com | guest123 | GUEST-001 |

`npm run seed` is non-destructive: it creates missing demo records and preserves existing hotel data.

## Role access

- **Admin:** full administration and hotel operations.
- **Manager:** rooms, reservations, housekeeping, maintenance, billing, reports and services.
- **Receptionist:** room inventory viewing and reservation/front-desk operations. Guest profile administration, billing, services, maintenance dashboard and room CRUD are restricted.
- **Housekeeping:** room status visibility, cleaning task scheduling/completion, and maintenance issue reporting/tracking.
- **Maintenance:** assigned maintenance work and resolution status updates; cannot create new maintenance reports.
- **Guest:** private guest portal for reservations, services, feedback and maintenance reporting.

## Important security behavior

Guest passwords are stored as bcrypt hashes. Plaintext passwords are not returned by the API and are not displayed in MongoDB/UI. Administrators can set/reset a guest password from the guest profile.

Guest login requires **email + password + passport/ID number**.

## Database index cleanup

The backend automatically removes obsolete indexes left by older versions, including the stale invoice `invoiceNumber_1` index that caused the observed `E11000 duplicate key ... invoiceNumber: null` error.

## Final audit

See [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) for the detailed requirements and non-functional compliance audit.
