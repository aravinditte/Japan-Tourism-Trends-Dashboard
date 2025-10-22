const mongoose = require('mongoose');

const tourismDataSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    index: true
  },
  visitors: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  period: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly'
  },
  avgSpending: {
    type: Number,
    min: 0
  },
  avgStayDuration: {
    type: Number,
    min: 0
  },
  source: {
    type: String,
    default: 'JNTO'
  },
  metadata: {
    exchange_rate_usd_jpy: Number,
    major_events: [String],
    notes: String
  }
}, {
  timestamps: true,
  collection: 'tourism_data'
});

// Compound indexes for better query performance
tourismDataSchema.index({ country: 1, date: -1 });
tourismDataSchema.index({ date: -1, visitors: -1 });

// Virtual for recovery rate calculation
tourismDataSchema.virtual('recoveryRate').get(function() {
  if (this.metadata && this.metadata.baselineVisitors) {
    return Math.round((this.visitors / this.metadata.baselineVisitors) * 100);
  }
  return null;
});

tourismDataSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TourismData', tourismDataSchema);