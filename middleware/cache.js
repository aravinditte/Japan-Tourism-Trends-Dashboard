const Redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client with better error handling
let redisClient = null;

try {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 60000,
      lazyConnect: true,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return false;
        }
        return Math.min(retries * 50, 1000);
      }
    },
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.warn('Redis server connection refused');
        return false;
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        logger.error('Redis retry time exhausted');
        return false;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });
  
  redisClient.on('error', (err) => {
    logger.warn('Redis Cache Error (non-fatal):', err.message);
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis cache connected successfully');
  });
  
  redisClient.on('ready', () => {
    logger.info('Redis cache ready for operations');
  });
  
  redisClient.on('end', () => {
    logger.info('Redis cache connection closed');
  });
  
} catch (error) {
  logger.warn('Redis client initialization failed, caching disabled:', error.message);
  redisClient = null;
}

/**
 * Cache middleware with Redis and fallback handling
 * @param {number} duration - Cache duration in seconds (default: 300)
 * @param {object} options - Additional cache options
 * @returns {Function} Express middleware
 */
const cache = (duration = 300, options = {}) => {
  const {
    keyPrefix = 'cache',
    skipCache = false,
    varyBy = [],
    condition = null
  } = options;
  
  return async (req, res, next) => {
    // Skip cache if disabled or Redis unavailable
    if (skipCache || !redisClient) {
      return next();
    }
    
    try {
      // Check if Redis is connected
      if (!redisClient.isOpen) {
        logger.debug('Redis not connected, attempting connection...');
        try {
          await redisClient.connect();
        } catch (connectError) {
          logger.warn('Redis connection failed, skipping cache:', connectError.message);
          return next();
        }
      }
      
      // Build cache key
      let cacheKey = `${keyPrefix}:${req.originalUrl}`;
      
      // Add vary-by parameters to key
      if (varyBy.length > 0) {
        const varyParams = varyBy.map(param => {
          if (param.startsWith('header.')) {
            const headerName = param.substring(7);
            return req.get(headerName) || '';
          }
          return req.query[param] || req.body[param] || '';
        }).join(':');
        
        if (varyParams) {
          cacheKey += `:${varyParams}`;
        }
      }
      
      // Check condition if provided
      if (condition && typeof condition === 'function' && !condition(req)) {
        return next();
      }
      
      // Try to get cached data
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        req.fromCache = true;
        
        try {
          const parsedData = JSON.parse(cachedData);
          
          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-TTL': await redisClient.ttl(cacheKey)
          });
          
          return res.json(parsedData);
        } catch (parseError) {
          logger.warn('Cache data parsing failed:', parseError.message);
          // Continue to fetch fresh data
        }
      }
      
      // Cache miss - override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data) {
          try {
            const serializedData = JSON.stringify(data);
            
            // Set cache with expiration
            redisClient.setEx(cacheKey, duration, serializedData)
              .then(() => {
                logger.debug(`Cached data for key: ${cacheKey} (TTL: ${duration}s)`);
              })
              .catch(err => {
                logger.warn('Cache set error:', err.message);
              });
              
            // Add cache headers
            res.set({
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
              'X-Cache-Duration': duration
            });
            
          } catch (serializeError) {
            logger.warn('Cache serialization error:', serializeError.message);
          }
        }
        
        return originalJson(data);
      };
      
      next();
      
    } catch (error) {
      logger.warn('Cache middleware error, continuing without cache:', error.message);
      next();
    }
  };
};

/**
 * Clear cache for specific pattern
 * @param {string} pattern - Redis key pattern
 * @returns {Promise<number>} Number of keys deleted
 */
cache.clear = async (pattern = '*') => {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn('Redis not available for cache clearing');
    return 0;
  }
  
  try {
    const keys = await redisClient.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      const deleted = await redisClient.del(keys);
      logger.info(`Cleared ${deleted} cache entries matching pattern: ${pattern}`);
      return deleted;
    }
    return 0;
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return 0;
  }
};

/**
 * Get cache statistics
 * @returns {Promise<object>} Cache statistics
 */
cache.stats = async () => {
  if (!redisClient || !redisClient.isOpen) {
    return {
      available: false,
      error: 'Redis not available'
    };
  }
  
  try {
    const info = await redisClient.info('memory');
    const keys = await redisClient.keys('cache:*');
    
    return {
      available: true,
      connected: redisClient.isOpen,
      totalKeys: keys.length,
      memoryInfo: info,
      uptime: await redisClient.info('server')
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
};

/**
 * Warm up cache with specific data
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} duration - Cache duration in seconds
 * @returns {Promise<boolean>} Success status
 */
cache.warmup = async (key, data, duration = 300) => {
  if (!redisClient || !redisClient.isOpen) {
    return false;
  }
  
  try {
    const serializedData = JSON.stringify(data);
    await redisClient.setEx(`cache:${key}`, duration, serializedData);
    logger.info(`Cache warmed up for key: ${key}`);
    return true;
  } catch (error) {
    logger.error('Cache warmup error:', error);
    return false;
  }
};

// Export Redis client for direct use if needed
cache.client = redisClient;

module.exports = cache;