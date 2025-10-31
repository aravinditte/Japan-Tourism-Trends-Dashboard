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

// ...existing content up to model definitions remains unchanged

// replace stats cron with retry helper
cron.schedule('0 * * * *', async () => {
  try {
    const ok = await upsertStatsWithRetry(TourismData, Stats, 5);
    if (!ok) console.warn('Stats cron skipped due to Mongo readiness');
  } catch (e) { console.error('Stats cron error:', e.message); }
});

// in safeRunJNTO after bulkWrite:
// await upsertStatsWithRetry(TourismData, Stats, 5);
