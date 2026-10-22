const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    audienceRoles: { type: [String], default: [] },
    type: {
      type: String,
      enum: ['booking', 'maintenance', 'service', 'system', 'feedback'],
      default: 'system'
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ audienceRoles: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
