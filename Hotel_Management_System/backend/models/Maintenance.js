const mongoose = require('mongoose');

const MaintenanceSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  location: { type: String, default: '', trim: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  category: {
    type: String,
    enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'internet', 'furniture', 'other'],
    default: 'other'
  },
  description: { type: String, required: true, trim: true },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['reported', 'in-progress', 'resolved'],
    default: 'reported'
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Maintenance', MaintenanceSchema);
