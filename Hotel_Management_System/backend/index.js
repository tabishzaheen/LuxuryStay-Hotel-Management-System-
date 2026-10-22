const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const serviceRoutes = require('./routes/services');
const maintenanceRoutes = require('./routes/maintenance');
const housekeepingRoutes = require('./routes/housekeeping');
const invoiceRoutes = require('./routes/invoices');
const reportRoutes = require('./routes/reports');
const feedbackRoutes = require('./routes/feedback');
const serviceRequestRoutes = require('./routes/serviceRequests');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

app.get('/', (req, res) =>
  res.send({ ok: true, service: 'LuxuryStay HMS Backend' })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function removeLegacyIndex(collectionName, indexName) {
  try {
    const collection = mongoose.connection.db.collection(collectionName);
    const indexes = await collection.indexes();
    const legacy = indexes.find((index) => index.name === indexName);

    if (legacy) {
      await collection.dropIndex(indexName);
      console.log(`Removed legacy ${collectionName} index: ${indexName}`);
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn(`Legacy ${collectionName} index check skipped:`, err.message);
    }
  }
}

async function removeLegacyBookingIndex() {
  // Older project versions created a unique bookingNumber index.
  // The current Booking model does not use bookingNumber, so a stale
  // bookingNumber_1 index can reject every new booking with E11000/null.
  try {
    const collection = mongoose.connection.db.collection('bookings');
    const indexes = await collection.indexes();
    const legacy = indexes.find((index) => index.name === 'bookingNumber_1');

    if (legacy) {
      await collection.dropIndex('bookingNumber_1');
      console.log('Removed legacy bookings index: bookingNumber_1');
    }
  } catch (err) {
    // A fresh database may not have a bookings collection yet.
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('Legacy index check skipped:', err.message);
    }
  }
}

async function removeLegacyDataIndexes() {
  // Older builds used fields that no longer exist. MongoDB keeps those
  // indexes until they are explicitly removed, which can cause E11000
  // duplicate-key errors even though the current Mongoose schema is correct.
  await removeLegacyBookingIndex();
  await removeLegacyIndex('invoices', 'invoiceNumber_1');
  await removeLegacyIndex('services', 'name_1');
  await removeLegacyIndex('bookings', 'services.name_1');
  await removeLegacyIndex('rooms', 'roomNumber_1');
}

async function startServer() {
  try {
    await connectDB();
    await removeLegacyDataIndexes();

    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
