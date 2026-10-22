const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    category: {
      type: String,
      enum: [
        'overall',
        'room',
        'service',
        'food',
        'cleanliness',
        'staff',
        'other'
      ],
      default: 'overall'
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000
    }
  },
  { timestamps: true }
);

FeedbackSchema.index({ guest: 1, booking: 1 });
FeedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
