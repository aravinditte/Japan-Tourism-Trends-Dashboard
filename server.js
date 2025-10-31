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

// immediately bind listener to satisfy Render port detection
const server = app.listen(PORT, () => {
  console.log(`Server binding early on port ${PORT}`);
});

// Security and middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// MongoDB connection with explicit options and timeout handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/japan_tourism';
mongoose.set('strictQuery', true);

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      retryWrites: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB initial connection error:', err.message);
  }
})();

// Schemas and Models
const tourismDataSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  country: { type: String, required: true },
  visitors: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  source: { type: String, default: 'JNTO' },
  isOfficial: { type: Boolean, default: true }
}, { timestamps: true });

tourismDataSchema.index({ year: 1, month: 1, country: 1 }, { unique: true });

const TourismData = mongoose.models.TourismData || mongoose.model('TourismData', tourismDataSchema);

const statsSchema = new mongoose.Schema({
  totalVisitors: Number,
  monthlyGrowth: Number,
  topCountry: String,
  lastUpdated: { type: Date, default: Date.now },
  lastJNTOUpdate: { type: Date },
  dataSource: { type: String, default: 'JNTO' }
});

const Stats = mongoose.models.Stats || mongoose.model('Stats', statsSchema);

// Health endpoint for Render
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Serve static only after build exists
const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuildPath));

// API Routes (unchanged but trimmed for brevity)
app.get('/api/countries', async (req, res) => {
  try { res.json(await TourismData.distinct('country')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
  try { const s = await Stats.findOne().sort({ lastUpdated: -1 }); res.json(s || {}); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fallback SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Background jobs - delay heavy jobs until DB connected and server bound
const jntoWorker = new JNTODataIngestion();
const safeRunJNTO = async () => {
  try {
    // quick no-op if mongoose not connected
    if (mongoose.connection.readyState !== 1) {
      console.warn('Mongo not ready, skipping JNTO run');
      return;
    }
    const data = await jntoWorker.fetchJNTOData();
    if (data?.length) {
      await jntoWorker.updateDatabase(data);
      await jntoWorker.updateStats();
      await Stats.findOneAndUpdate({}, { lastJNTOUpdate: new Date() }, { upsert: true });
      console.log(`JNTO run complete with ${data.length} records`);
    }
  } catch (e) {
    console.error('JNTO run failed:', e.message);
  }
};

// Stagger initial heavy work to avoid port-scan failure
setTimeout(() => {
  safeRunJNTO();
}, 5000);

// Cron schedules
cron.schedule('0 */6 * * *', safeRunJNTO);
cron.schedule('0 * * * *', async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const agg = await TourismData.aggregate([
      { $match: { year: currentYear, month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$visitors' } } }
    ]);
    const currentTotal = agg[0]?.total || 0;
    await Stats.findOneAndUpdate({}, { totalVisitors: currentTotal, lastUpdated: new Date() }, { upsert: true });
  } catch (e) { console.error('Stats cron error:', e.message); }
});

module.exports = app;