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

// Bind early for Render port detection
const server = app.listen(PORT, () => {
  console.log(`Server binding early on port ${PORT}`);
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Mongo connection with robust settings
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/japan_tourism';
mongoose.set('strictQuery', true);

async function waitForMongoReady(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      if (mongoose.connection.readyState === 1) return true;
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 5,
        retryWrites: true,
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return false;
}

(async () => {
  const ok = await waitForMongoReady(60000);
  if (ok) console.log('✅ MongoDB connected successfully');
  else console.error('❌ MongoDB not ready after 60s');
})();

// Schemas
const tourismDataSchema = new mongoose.Schema({
  year: Number, month: Number, country: String, visitors: Number,
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

// Health endpoints
app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/api/health', async (req, res) => {
  try {
    const ping = mongoose.connection.readyState === 1;
    res.json({ ok: true, mongo: ping, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Static serving with graceful fallback
const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuildPath));

// Minimal splash if build missing
app.get('/', (req, res, next) => {
  if (!require('fs').existsSync(path.join(clientBuildPath, 'index.html'))) {
    return res.status(200).send('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Japan Tourism Dashboard</title><style>body{margin:0;font-family:system-ui;background:#0f1115;color:#e6e9ef;display:flex;align-items:center;justify-content:center;height:100vh} .card{border:1px solid #242a35;border-radius:12px;padding:20px;background:#161a22;max-width:560px} .muted{color:#9aa4b2} code{background:#0f1115;padding:2px 4px;border-radius:4px}</style></head><body><div class="card"><h1>Japan Tourism Dashboard</h1><p class="muted">The frontend build is not present yet.</p><p>Deploy with Render build command:<br><code>npm install && cd client && npm install && npm run build && cd ..</code></p><p>API health: <a href="/api/health">/api/health</a></p></div></body></html>');
  }
  next();
});

// APIs (samples)
app.get('/api/countries', async (req, res) => {
  try { res.json(await TourismData.distinct('country')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
  try { const s = await Stats.findOne().sort({ lastUpdated: -1 }); res.json(s || {}); } catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Background jobs
const jntoWorker = new JNTODataIngestion();

async function bulkUpsert(data) {
  if (!data?.length) return;
  const ops = data.map(r => ({
    updateOne: {
      filter: { year: r.year, month: r.month, country: r.country },
      update: { $set: { ...r, lastUpdated: new Date() } },
      upsert: true
    }
  }));
  await TourismData.bulkWrite(ops, { ordered: false });
}

const safeRunJNTO = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('Mongo not ready, skipping JNTO run');
      return;
    }
    const data = await jntoWorker.fetchJNTOData();
    if (data?.length) {
      await bulkUpsert(data);
      await jntoWorker.updateStats();
      await Stats.findOneAndUpdate({}, { lastJNTOUpdate: new Date() }, { upsert: true });
      console.log(`JNTO run complete with ${data.length} records`);
    }
  } catch (e) {
    console.error('JNTO run failed:', e.message);
  }
};

// Delay initial run by 15s to allow Atlas warmup
setTimeout(() => { safeRunJNTO(); }, 15000);

cron.schedule('0 */6 * * *', safeRunJNTO);
cron.schedule('0 * * * *', async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [cur] = await TourismData.aggregate([
      { $match: { year: currentYear, month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$visitors' } } }
    ]);
    await Stats.findOneAndUpdate({}, { totalVisitors: cur?.total || 0, lastUpdated: new Date() }, { upsert: true });
  } catch (e) { console.error('Stats cron error:', e.message); }
});

module.exports = app;
