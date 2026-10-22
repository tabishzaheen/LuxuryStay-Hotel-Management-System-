const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  items: [
    {
      description: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 }
    }
  ],
  subtotal: { type: Number, required: true, min: 0, default: 0 },
  taxRate: { type: Number, required: true, min: 0, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  paid: { type: Boolean, default: false },
  issuedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
