const Redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error('Redis Cache Error:', err);
});

// Connect to Redis
redisClient.connect().catch(console.error);

/**
 * Cache middleware with Redis
 * @param {number} duration - Cache duration in seconds
 * @returns {Function} Express middleware
 */
const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (!redisClient.isOpen) {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        logger.info(`Cache hit for key: ${key}`);
        req.fromCache = true;
        return res.json(JSON.parse(cachedData));
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode === 200) {
          redisClient.setEx(key, duration, JSON.stringify(data))
            .catch(err => logger.error('Cache set error:', err));
        }
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = cache;