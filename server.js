const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const JNTODataIngestion = require('./workers/jntoDataIngestion');
const { upsertStatsWithRetry } = require('./server/stats.util');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Bind early so Render detects port
app.listen(PORT, () => console.log(`Server binding early on port ${PORT}`));

// Core middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Mongo setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/japan_tourism';
mongoose.set('strictQuery', true);

async function waitForMongoReady(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      if (mongoose.connection.readyState === 1) return true;
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000, maxPoolSize: 5, retryWrites: true });
      return true;
    } catch (_) { await new Promise(r => setTimeout(r, 2000)); }
  }
  return false;
}

(async () => { const ok = await waitForMongoReady(60000); console.log(ok ? '✅ MongoDB connected successfully' : '❌ MongoDB not ready after 60s'); })();

// Schemas/Models
const tourismDataSchema = new mongoose.Schema({ year: Number, month: Number, country: String, visitors: Number, lastUpdated: { type: Date, default: Date.now }, source: { type: String, default: 'JNTO' }, isOfficial: { type: Boolean, default: true } }, { timestamps: true });
tourismDataSchema.index({ year: 1, month: 1, country: 1 }, { unique: true });
const TourismData = mongoose.models.TourismData || mongoose.model('TourismData', tourismDataSchema);

const statsSchema = new mongoose.Schema({ totalVisitors: Number, monthlyGrowth: Number, topCountry: String, lastUpdated: { type: Date, default: Date.now }, lastJNTOUpdate: { type: Date }, dataSource: { type: String, default: 'JNTO' } });
const Stats = mongoose.models.Stats || mongoose.model('Stats', statsSchema);

// ===========================
// API ROUTES FIRST (before static/Spa fallback)
// ===========================
app.get('/healthz', (req, res) => res.type('text/plain').status(200).send('ok'));
app.get('/api/health', (req, res) => res.type('application/json').json({ ok: true, mongo: mongoose.connection.readyState === 1, time: new Date().toISOString() }));

app.get('/api/countries', async (req, res) => {
  try { const data = await TourismData.distinct('country'); res.type('application/json').json(data); }
  catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
  try { const s = await Stats.findOne().sort({ lastUpdated: -1 }); res.type('application/json').json(s || {}); }
  catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

app.get('/api/tourism-data', async (req, res) => {
  try {
    const { year, country, limit } = req.query;
    const q = {};
    if (year) q.year = parseInt(year);
    if (country) q.country = country;
    const data = await TourismData.find(q).sort({ year: 1, month: 1 }).limit(parseInt(limit)||1000);
    res.type('application/json').json(data);
  } catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

app.get('/api/tourism-data/yearly', async (req, res) => {
  try {
    const data = await TourismData.aggregate([
      { $group: { _id: { year: '$year', country: '$country' }, totalVisitors: { $sum: '$visitors' }, isOfficial: { $first: '$isOfficial' }, source: { $first: '$source' } } },
      { $project: { year: '$_id.year', country: '$_id.country', visitors: '$totalVisitors', isOfficial: 1, source: 1, _id: 0 } },
      { $sort: { year: 1, country: 1 } }
    ]);
    res.type('application/json').json(data);
  } catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

app.get('/api/tourism-data/monthly/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const data = await TourismData.aggregate([
      { $match: { year } },
      { $group: { _id: { month: '$month', country: '$country' }, totalVisitors: { $sum: '$visitors' }, isOfficial: { $first: '$isOfficial' }, source: { $first: '$source' } } },
      { $project: { month: '$_id.month', country: '$_id.country', visitors: '$totalVisitors', isOfficial: 1, source: 1, _id: 0 } },
      { $sort: { month: 1, country: 1 } }
    ]);
    res.type('application/json').json(data);
  } catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

app.get('/api/covid-impact', async (req, res) => {
  try {
    const data = await TourismData.aggregate([
      { $group: { _id: { year: '$year', country: '$country' }, totalVisitors: { $sum: '$visitors' } } },
      { $project: { year: '$_id.year', country: '$_id.country', visitors: '$totalVisitors', _id: 0 } },
      { $sort: { country: 1, year: 1 } }
    ]);
    const countries = [...new Set(data.map(d => d.country))];
    const analysis = countries.map(country => {
      const cd = data.filter(d => d.country === country);
      const pre2019 = cd.find(d => d.year === 2019)?.visitors || 0;
      const y2020 = cd.find(d => d.year === 2020)?.visitors || 0;
      const y2021 = cd.find(d => d.year === 2021)?.visitors || 0;
      const y2025 = cd.find(d => d.year === 2025)?.visitors || 0;
      const low = Math.min(y2020, y2021);
      const decline = pre2019>0 ? ((pre2019-low)/pre2019*100) : 0;
      const recovery = pre2019>0 ? (y2025/pre2019*100) : 0;
      return { country, preCovid2019: pre2019, covidLow: low, recovery2025: y2025, declinePercent: Math.round(decline*10)/10, recoveryPercent: Math.round(recovery*10)/10 };
    });
    res.type('application/json').json(analysis);
  } catch (e) { res.status(500).type('application/json').json({ error: e.message }); }
});

// ===========================
// STATIC & SPA FALLBACK AFTER APIs
// ===========================
const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use((req,res,next)=>{ // prevent static from intercepting /api/*
  if (req.path.startsWith('/api/')) return next();
  return express.static(clientBuildPath)(req,res,next);
});

app.get('/', (req, res, next) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(200).type('text/html').send('<!doctype html><html><body><pre>Frontend build missing. Build with:\n\n npm install && cd client && npm install && npm run build && cd ..</pre></body></html>');
  }
  next();
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).type('application/json').json({ error: 'Not found' });
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Background jobs
const jntoWorker = new JNTODataIngestion();
async function bulkUpsert(data) { if (!data?.length) return; const ops = data.map(r => ({ updateOne: { filter: { year: r.year, month: r.month, country: r.country }, update: { $set: { ...r, lastUpdated: new Date() } }, upsert: true } })); await TourismData.bulkWrite(ops, { ordered: false }); }

const safeRunJNTO = async () => {
  try {
    if (mongoose.connection.readyState !== 1) { console.warn('Mongo not ready, skipping JNTO run'); return; }
    const data = await jntoWorker.fetchJNTOData();
    if (data?.length) {
      await bulkUpsert(data);
      await upsertStatsWithRetry(TourismData, Stats, 5);
      await Stats.findOneAndUpdate({}, { lastJNTOUpdate: new Date() }, { upsert: true });
      console.log(`JNTO run complete with ${data.length} records`);
    }
  } catch (e) { console.error('JNTO run failed:', e.message); }
};

setTimeout(() => { safeRunJNTO(); }, 15000);
cron.schedule('0 */6 * * *', safeRunJNTO);
cron.schedule('0 * * * *', async () => { try { await upsertStatsWithRetry(TourismData, Stats, 5); } catch (e) { console.error('Stats cron error:', e.message); } });

module.exports = app;
