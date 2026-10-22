const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    serviceName: { type: String, required: true, trim: true },
    serviceType: {
      type: String,
      enum: ['room-service', 'wake-up-call', 'transportation', 'laundry', 'housekeeping', 'concierge', 'other'],
      default: 'other'
    },
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    requestedFor: { type: Date, default: null },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      default: 'requested'
    },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ guest: 1, createdAt: -1 });
ServiceRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
