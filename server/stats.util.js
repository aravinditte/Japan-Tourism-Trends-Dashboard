// Stats helpers with retry/backoff
const mongoose = require('mongoose');

async function mongoReadyPing(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (mongoose.connection.readyState === 1) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function upsertStatsWithRetry(TourismData, Stats, attempts = 5) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      if (!(await mongoReadyPing())) throw new Error('Mongo not ready');
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const [cur] = await TourismData.aggregate([
        { $match: { year: currentYear, month: currentMonth } },
        { $group: { _id: null, total: { $sum: '$visitors' } } }
      ]);
      await Stats.findOneAndUpdate(
        {},
        { totalVisitors: cur?.total || 0, lastUpdated: new Date() },
        { upsert: true }
      );
      return true;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  console.error('upsertStatsWithRetry failed:', lastErr?.message);
  return false;
}

module.exports = { upsertStatsWithRetry };
