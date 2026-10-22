const mongoose = require('mongoose');

const RoomRateSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'hotel' },
    propertyName: { type: String, default: 'LuxuryStay Hospitality', trim: true },
    propertyCode: { type: String, default: 'LSH-001', trim: true },
    contactEmail: { type: String, default: 'frontdesk@luxurystay.com', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    currency: { type: String, enum: ['USD', 'PKR', 'EUR', 'GBP'], default: 'USD' },
    taxRate: { type: Number, default: 12, min: 0, max: 100 },
    defaultCheckIn: { type: String, default: '14:00' },
    defaultCheckOut: { type: String, default: '12:00' },
    roomRates: { type: [RoomRateSchema], default: [] },
    policies: {
      cancellation: { type: String, default: 'Free cancellation up to 24 hours before check-in.' },
      checkIn: { type: String, default: 'Guests must present valid identification at check-in.' },
      children: { type: String, default: 'Children are welcome.' },
      smoking: { type: String, default: 'Smoking is not permitted in guest rooms.' },
      pets: { type: String, default: 'Pets are allowed only in designated rooms.' }
    },
    notifications: {
      newReservation: { type: Boolean, default: true },
      maintenanceIssue: { type: Boolean, default: true },
      serviceRequest: { type: Boolean, default: true },
      feedbackReceived: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: true }
    },
    security: {
      requireAdmin2FA: { type: Boolean, default: false },
      sessionTimeoutMinutes: { type: Number, default: 720, min: 15, max: 1440 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', SettingsSchema);
