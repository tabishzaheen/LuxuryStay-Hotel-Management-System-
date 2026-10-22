const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, trim: true },
  type: { type: String, required: true, trim: true },
  floor: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['available', 'occupied', 'cleaning', 'maintenance'],
    default: 'available'
  },
  price: { type: Number, required: true, min: 0 },
  amenities: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
