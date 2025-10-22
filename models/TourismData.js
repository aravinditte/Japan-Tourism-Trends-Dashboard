const mongoose = require('mongoose');

const tourismDataSchema = new mongoose.Schema({
  country: {
    type: String,
    required: [true, 'Country is required'],
    index: true,
    trim: true,
    maxlength: [50, 'Country name cannot exceed 50 characters']
  },
  visitors: {
    type: Number,
    required: [true, 'Visitor count is required'],
    min: [0, 'Visitor count cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Visitor count must be an integer'
    }
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true,
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Date cannot be in the future'
    }
  },
  period: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly', 'quarterly', 'annual'],
      message: 'Period must be one of: daily, weekly, monthly, quarterly, annual'
    },
    default: 'monthly'
  },
  avgSpending: {
    type: Number,
    min: [0, 'Average spending cannot be negative'],
    validate: {
      validator: function(value) {
        return value == null || (typeof value === 'number' && value >= 0);
      },
      message: 'Average spending must be a positive number'
    }
  },
  avgStayDuration: {
    type: Number,
    min: [0, 'Average stay duration cannot be negative'],
    max: [365, 'Average stay duration cannot exceed 365 days'],
    validate: {
      validator: function(value) {
        return value == null || (typeof value === 'number' && value >= 0 && value <= 365);
      },
      message: 'Average stay duration must be between 0 and 365 days'
    }
  },
  source: {
    type: String,
    default: 'JNTO',
    enum: {
      values: ['JNTO', 'JNTO_SCRAPED', 'ESTIMATED', 'MANUAL', 'IMPORT'],
      message: 'Source must be one of the predefined values'
    }
  },
  dataQuality: {
    type: String,
    enum: {
      values: ['HIGH', 'MEDIUM', 'LOW', 'ESTIMATED'],
      message: 'Data quality must be HIGH, MEDIUM, LOW, or ESTIMATED'
    },
    default: 'HIGH'
  },
  metadata: {
    exchange_rate_usd_jpy: {
      type: Number,
      min: 0
    },
    major_events: [{
      type: String,
      maxlength: 200
    }],
    notes: {
      type: String,
      maxlength: 500
    },
    weather_impact: {
      type: String,
      enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    seasonal_factor: {
      type: Number,
      min: 0.1,
      max: 5.0,
      default: 1.0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'tourism_data'
});

// Compound indexes for better query performance
tourismDataSchema.index({ country: 1, date: -1 });
tourismDataSchema.index({ date: -1, visitors: -1 });
tourismDataSchema.index({ source: 1, createdAt: -1 });
tourismDataSchema.index({ country: 1, period: 1, date: -1 });

// Text index for search functionality
tourismDataSchema.index({
  country: 'text',
  'metadata.notes': 'text'
});

// Virtual for recovery rate calculation
tourismDataSchema.virtual('recoveryRate').get(function() {
  if (this.metadata && this.metadata.baselineVisitors) {
    return Math.round((this.visitors / this.metadata.baselineVisitors) * 100 * 100) / 100;
  }
  return null;
});

// Virtual for visitor density (visitors per day based on period)
tourismDataSchema.virtual('visitorDensity').get(function() {
  const periodDays = {
    'daily': 1,
    'weekly': 7,
    'monthly': 30,
    'quarterly': 90,
    'annual': 365
  };
  
  const days = periodDays[this.period] || 30;
  return Math.round(this.visitors / days * 100) / 100;
});

// Virtual for spending per day
tourismDataSchema.virtual('spendingPerDay').get(function() {
  if (this.avgSpending && this.avgStayDuration && this.avgStayDuration > 0) {
    return Math.round(this.avgSpending / this.avgStayDuration);
  }
  return null;
});

// Instance methods
tourismDataSchema.methods.toSafeObject = function() {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

tourismDataSchema.methods.isRecent = function() {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return this.date >= oneMonthAgo;
};

// Static methods
tourismDataSchema.statics.findByCountry = function(country, limit = 100) {
  return this.find({ country: new RegExp(country, 'i'), isActive: true })
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

tourismDataSchema.statics.getCountryStats = async function(country) {
  const stats = await this.aggregate([
    { $match: { country: new RegExp(country, 'i'), isActive: true } },
    {
      $group: {
        _id: null,
        totalVisitors: { $sum: '$visitors' },
        avgVisitors: { $avg: '$visitors' },
        avgSpending: { $avg: '$avgSpending' },
        avgStayDuration: { $avg: '$avgStayDuration' },
        recordCount: { $sum: 1 },
        firstDate: { $min: '$date' },
        lastDate: { $max: '$date' }
      }
    }
  ]);
  
  return stats[0] || null;
};

tourismDataSchema.statics.getTopCountries = function(limit = 10, year = null) {
  const matchCriteria = { isActive: true };
  
  if (year) {
    matchCriteria.date = {
      $gte: new Date(`${year}-01-01`),
      $lt: new Date(`${year + 1}-01-01`)
    };
  }
  
  return this.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$country',
        totalVisitors: { $sum: '$visitors' },
        avgSpending: { $avg: '$avgSpending' },
        recordCount: { $sum: 1 }
      }
    },
    { $sort: { totalVisitors: -1 } },
    { $limit: limit }
  ]);
};

// Pre-save middleware
tourismDataSchema.pre('save', function(next) {
  // Set data quality based on source
  if (this.source === 'ESTIMATED') {
    this.dataQuality = 'ESTIMATED';
  } else if (this.source === 'JNTO') {
    this.dataQuality = 'HIGH';
  } else if (this.source === 'JNTO_SCRAPED') {
    this.dataQuality = 'MEDIUM';
  }
  
  // Ensure country name is properly formatted
  if (this.country) {
    this.country = this.country.trim();
  }
  
  next();
});

// Post-save middleware for logging
tourismDataSchema.post('save', function(doc) {
  console.log(`Tourism data saved: ${doc.country} - ${doc.visitors} visitors on ${doc.date}`);
});

// Enable virtuals in JSON output
tourismDataSchema.set('toJSON', { virtuals: true });
tourismDataSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TourismData', tourismDataSchema);