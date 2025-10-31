const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const JNTODataIngestion = require('./workers/jntoDataIngestion');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/japan_tourism';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Tourism Data Schema
const tourismDataSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  country: { type: String, required: true },
  visitors: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  source: { type: String, default: 'JNTO' },
  isOfficial: { type: Boolean, default: true }
});

// Add unique index to prevent duplicates
tourismDataSchema.index({ year: 1, month: 1, country: 1 }, { unique: true });

const TourismData = mongoose.model('TourismData', tourismDataSchema);

// Real-time stats schema
const statsSchema = new mongoose.Schema({
  totalVisitors: Number,
  monthlyGrowth: Number,
  topCountry: String,
  lastUpdated: { type: Date, default: Date.now },
  lastJNTOUpdate: { type: Date },
  dataSource: { type: String, default: 'JNTO' }
});

const Stats = mongoose.model('Stats', statsSchema);

// JNTO Data Ingestion Setup
const jntoWorker = new JNTODataIngestion();

// Initialize sample data (fallback if JNTO worker fails)
const initializeFallbackData = async () => {
  try {
    const count = await TourismData.countDocuments();
    if (count === 0) {
      console.log('⚠️  Initializing fallback tourism data...');
      
      const countries = ["South Korea", "China", "Taiwan", "Hong Kong", "USA", "Thailand"];
      const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
      
      const tourismData = {
        "South Korea": [7540000, 5584000, 92000, 98000, 2325000, 6959000, 8882000, 9200000],
        "China": [8380000, 9594000, 107000, 120000, 972000, 2422000, 6420000, 7850000], 
        "Taiwan": [4757000, 4890000, 167000, 145000, 892000, 4201000, 5680000, 6100000],
        "Hong Kong": [2207000, 2290000, 87000, 76000, 456000, 1607000, 2215000, 2400000],
        "USA": [1526000, 1723000, 434000, 298000, 623000, 2019000, 2890000, 3100000],
        "Thailand": [1131000, 1319000, 126000, 98000, 234000, 667000, 1024000, 1150000]
      };
      
      const sampleData = [];
      
      years.forEach((year, yearIndex) => {
        for (let month = 1; month <= 12; month++) {
          countries.forEach(country => {
            const monthlyFactor = [3, 4, 5, 10, 11].includes(month) ? 1.2 : 
                                [12, 1, 2, 6, 7, 8].includes(month) ? 1.0 : 0.8;
            
            const monthlyVisitors = Math.floor((tourismData[country][yearIndex] / 12) * monthlyFactor);
            
            sampleData.push({
              year,
              month,
              country,
              visitors: monthlyVisitors,
              source: 'FALLBACK_DATA',
              isOfficial: false
            });
          });
        }
      });
      
      await TourismData.insertMany(sampleData);
      console.log('✅ Fallback data initialized successfully');
    }
  } catch (error) {
    console.error('❌ Error initializing fallback data:', error);
  }
};

// Run JNTO data ingestion
const runJNTOIngestion = async () => {
  try {
    console.log('🚀 Starting JNTO data ingestion...');
    
    // Run the JNTO worker
    const data = await jntoWorker.fetchJNTOData();
    
    if (data && data.length > 0) {
      await jntoWorker.updateDatabase(data);
      await jntoWorker.updateStats();
      
      // Update last JNTO update timestamp
      await Stats.findOneAndUpdate(
        {},
        { lastJNTOUpdate: new Date() },
        { upsert: true }
      );
      
      console.log(`✅ JNTO ingestion completed: ${data.length} records processed`);
    } else {
      console.log('⚠️  JNTO ingestion returned no data');
    }
    
  } catch (error) {
    console.error('❌ JNTO ingestion failed:', error);
    // Continue with existing data
  }
};

// Update real-time stats
const updateStats = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Get current month total
    const currentMonthData = await TourismData.aggregate([
      { $match: { year: currentYear, month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$visitors' } } }
    ]);
    
    // Get previous month for growth calculation
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const prevMonthData = await TourismData.aggregate([
      { $match: { year: prevYear, month: prevMonth } },
      { $group: { _id: null, total: { $sum: '$visitors' } } }
    ]);
    
    // Get top country for current month
    const topCountryData = await TourismData.aggregate([
      { $match: { year: currentYear, month: currentMonth } },
      { $group: { _id: '$country', total: { $sum: '$visitors' } } },
      { $sort: { total: -1 } },
      { $limit: 1 }
    ]);
    
    const currentTotal = currentMonthData[0]?.total || 0;
    const prevTotal = prevMonthData[0]?.total || 1;
    const monthlyGrowth = ((currentTotal - prevTotal) / prevTotal * 100).toFixed(1);
    
    await Stats.findOneAndUpdate(
      {},
      {
        totalVisitors: currentTotal,
        monthlyGrowth: parseFloat(monthlyGrowth),
        topCountry: topCountryData[0]?._id || 'N/A',
        lastUpdated: new Date()
      },
      { upsert: true }
    );
    
    console.log('📊 Stats updated successfully');
  } catch (error) {
    console.error('❌ Error updating stats:', error);
  }
};

// API Routes

// Get all tourism data
app.get('/api/tourism-data', async (req, res) => {
  try {
    const { year, country, limit } = req.query;
    let query = {};
    
    if (year) query.year = parseInt(year);
    if (country) query.country = country;
    
    const data = await TourismData.find(query)
      .sort({ year: 1, month: 1 })
      .limit(parseInt(limit) || 1000);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get yearly aggregated data
app.get('/api/tourism-data/yearly', async (req, res) => {
  try {
    const data = await TourismData.aggregate([
      {
        $group: {
          _id: { year: '$year', country: '$country' },
          totalVisitors: { $sum: '$visitors' },
          isOfficial: { $first: '$isOfficial' },
          source: { $first: '$source' }
        }
      },
      {
        $project: {
          year: '$_id.year',
          country: '$_id.country',
          visitors: '$totalVisitors',
          isOfficial: 1,
          source: 1,
          _id: 0
        }
      },
      { $sort: { year: 1, country: 1 } }
    ]);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly data for specific year
app.get('/api/tourism-data/monthly/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const data = await TourismData.aggregate([
      { $match: { year } },
      {
        $group: {
          _id: { month: '$month', country: '$country' },
          totalVisitors: { $sum: '$visitors' },
          isOfficial: { $first: '$isOfficial' },
          source: { $first: '$source' }
        }
      },
      {
        $project: {
          month: '$_id.month',
          country: '$_id.country',
          visitors: '$totalVisitors',
          isOfficial: 1,
          source: 1,
          _id: 0
        }
      },
      { $sort: { month: 1, country: 1 } }
    ]);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Stats.findOne().sort({ lastUpdated: -1 });
    res.json(stats || { 
      totalVisitors: 0, 
      monthlyGrowth: 0, 
      topCountry: 'N/A',
      lastJNTOUpdate: null,
      dataSource: 'FALLBACK'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get countries list
app.get('/api/countries', async (req, res) => {
  try {
    const countries = await TourismData.distinct('country');
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// COVID impact analysis
app.get('/api/covid-impact', async (req, res) => {
  try {
    const data = await TourismData.aggregate([
      {
        $group: {
          _id: { year: '$year', country: '$country' },
          totalVisitors: { $sum: '$visitors' }
        }
      },
      {
        $project: {
          year: '$_id.year',
          country: '$_id.country',
          visitors: '$totalVisitors',
          _id: 0
        }
      },
      { $sort: { country: 1, year: 1 } }
    ]);
    
    // Calculate COVID impact for each country
    const countries = [...new Set(data.map(d => d.country))];
    const analysis = countries.map(country => {
      const countryData = data.filter(d => d.country === country);
      const preCovid2019 = countryData.find(d => d.year === 2019)?.visitors || 0;
      const covid2020 = countryData.find(d => d.year === 2020)?.visitors || 0;
      const covid2021 = countryData.find(d => d.year === 2021)?.visitors || 0;
      const recovery2025 = countryData.find(d => d.year === 2025)?.visitors || 0;
      
      const covidLow = Math.min(covid2020, covid2021);
      const declinePercent = preCovid2019 > 0 ? ((preCovid2019 - covidLow) / preCovid2019 * 100) : 0;
      const recoveryPercent = preCovid2019 > 0 ? (recovery2025 / preCovid2019 * 100) : 0;
      
      return {
        country,
        preCovid2019,
        covidLow,
        recovery2025,
        declinePercent: Math.round(declinePercent * 10) / 10,
        recoveryPercent: Math.round(recoveryPercent * 10) / 10
      };
    });
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual JNTO data refresh endpoint
app.post('/api/refresh-jnto-data', async (req, res) => {
  try {
    console.log('🔄 Manual JNTO data refresh requested');
    await runJNTOIngestion();
    await updateStats();
    
    res.json({ 
      success: true, 
      message: 'JNTO data refresh completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual JNTO refresh failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Data source information
app.get('/api/data-sources', async (req, res) => {
  try {
    const sources = await TourismData.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          countries: { $addToSet: '$country' },
          latestUpdate: { $max: '$lastUpdated' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const stats = await Stats.findOne().sort({ lastUpdated: -1 });
    
    res.json({
      sources,
      lastJNTOUpdate: stats?.lastJNTOUpdate,
      lastStatsUpdate: stats?.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Scheduled Jobs

// JNTO Data Ingestion - Every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('⏰ Running scheduled JNTO data ingestion...');
  runJNTOIngestion();
});

// Stats Update - Every hour
cron.schedule('0 * * * *', () => {
  console.log('⏰ Running scheduled stats update...');
  updateStats();
});

// Initialize data and start server
const initializeServer = async () => {
  try {
    // Initialize fallback data first
    await initializeFallbackData();
    
    // Run initial JNTO ingestion
    console.log('🚀 Running initial JNTO data ingestion...');
    await runJNTOIngestion();
    
    // Update initial stats
    await updateStats();
    
    // Start server
    app.listen(PORT, () => {
      console.log('✅ ===============================================');
      console.log(`🚀 Japan Tourism Dashboard server running on port ${PORT}`);
      console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
      console.log(`🔄 JNTO data ingestion: Every 6 hours`);
      console.log(`📊 Stats update: Every hour`);
      console.log(`💾 Database: ${MONGODB_URI.includes('localhost') ? 'Local MongoDB' : 'Remote MongoDB'}`);
      console.log('✅ ===============================================');
    });
    
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
};

// Start the server
initializeServer();

module.exports = app;