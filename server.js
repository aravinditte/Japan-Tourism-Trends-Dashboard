const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const JNTODataIngestion = require('./workers/jntoDataIngestion');
const { upsertStatsWithRetry } = require('./server/stats.util');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server binding early on port ${PORT}`));

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

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

const tourismDataSchema = new mongoose.Schema({ year: Number, month: Number, country: String, visitors: Number, lastUpdated: { type: Date, default: Date.now }, source: { type: String, default: 'JNTO' }, isOfficial: { type: Boolean, default: true } }, { timestamps: true });
tourismDataSchema.index({ year: 1, month: 1, country: 1 }, { unique: true });
const TourismData = mongoose.models.TourismData || mongoose.model('TourismData', tourismDataSchema);

const statsSchema = new mongoose.Schema({ totalVisitors: Number, monthlyGrowth: Number, topCountry: String, lastUpdated: { type: Date, default: Date.now }, lastJNTOUpdate: { type: Date }, dataSource: { type: String, default: 'JNTO' } });
const Stats = mongoose.models.Stats || mongoose.model('Stats', statsSchema);

app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/api/health', (req, res) => res.json({ ok: true, mongo: mongoose.connection.readyState === 1, time: new Date().toISOString() }));

const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuildPath));
app.get('/', (req, res, next) => { if (!require('fs').existsSync(path.join(clientBuildPath, 'index.html'))) return res.status(200).send('<!doctype html><html><body><pre>Frontend build missing. Build with:\n\n npm install && cd client && npm install && npm run build && cd ..</pre></body></html>'); next(); });

app.get('/api/countries', async (req, res) => { try { res.json(await TourismData.distinct('country')); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/stats', async (req, res) => { try { const s = await Stats.findOne().sort({ lastUpdated: -1 }); res.json(s || {}); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('*', (req, res) => res.sendFile(path.join(clientBuildPath, 'index.html')));

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
