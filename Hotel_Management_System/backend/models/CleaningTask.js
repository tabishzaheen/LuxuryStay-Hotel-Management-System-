const mongoose = require('mongoose');

const CleaningTaskSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    },

    taskType: {
      type: String,
      enum: [
        'cleaning',
        'deep-cleaning',
        'turn-down',
        'restock',
        'inspection',
        'other'
      ],
      default: 'cleaning'
    },

    notes: {
      type: String,
      default: '',
      trim: true
    },

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    scheduledFor: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },

    completedAt: {
      type: Date,
      default: null
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CleaningTask', CleaningTaskSchema);
