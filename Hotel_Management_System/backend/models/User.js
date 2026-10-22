const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, required: false },

  role: {
    type: String,
    enum: ['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance', 'guest'],
    default: 'guest'
  },

  isActive: { type: Boolean, default: true },

  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  address: { type: String, default: '' },
  preferences: { type: String, default: '' },
  notes: { type: String, default: '' },

  nationality: { type: String, default: '' },
  idNumber: { type: String, default: '' },

  permissions: {
    type: [String],
    default: []
  },

  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);