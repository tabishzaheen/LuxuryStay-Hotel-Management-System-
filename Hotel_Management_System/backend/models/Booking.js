const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },

  status: {
    type: String,
    enum: ['reserved', 'checked-in', 'checked-out', 'cancelled'],
    default: 'reserved'
  },

  source: {
    type: String,
    enum: ['front-desk', 'online'],
    default: 'front-desk'
  },

  services: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      quantity: { type: Number, default: 1, min: 1 }
    }
  ],

  // Room-only charge. Additional services are stored separately and
  // are combined with the room charge when an invoice is generated.
  totalPrice: {
    type: Number,
    default: 0
  },

  keyIssued: {
    type: Boolean,
    default: false
  },

  keyCode: {
    type: String,
    default: ''
  },

  checkedInAt: {
    type: Date,
    default: null
  },

  checkedOutAt: {
    type: Date,
    default: null
  },

  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
