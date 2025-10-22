const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('redis');
const logger = require('../utils/logger');

// Configuration
const RATE_LIMIT_CONFIG = {
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
  keyPrefix: 'tourism_api_rl'
};

// Strict rate limiting for sensitive endpoints
const STRICT_RATE_LIMIT_CONFIG = {
  points: 20,
  duration: 15 * 60,
  blockDuration: 60 * 60, // Block for 1 hour
  keyPrefix: 'tourism_api_strict_rl'
};

let redisClient;
let rateLimiter;
let strictRateLimiter;
let fallbackLimiter;
let strictFallbackLimiter;

// Initialize Redis client with error handling
try {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 60000,
      lazyConnect: true,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          logger.warn('Rate limiter Redis reconnection failed, using memory fallback');
          return false;
        }
        return Math.min(retries * 100, 2000);
      }
    }
  });
  
  redisClient.on('error', (error) => {
    logger.warn('Rate limiter Redis error (falling back to memory):', error.message);
  });
  
  redisClient.on('connect', () => {
    logger.info('Rate limiter Redis connected');
  });
  
  // Initialize Redis-based rate limiters
  rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    ...RATE_LIMIT_CONFIG
  });
  
  strictRateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    ...STRICT_RATE_LIMIT_CONFIG
  });
  
} catch (error) {
  logger.warn('Rate limiter Redis initialization failed, using memory storage:', error.message);
  redisClient = null;
}

// Memory-based fallback rate limiters
fallbackLimiter = new RateLimiterMemory({
  ...RATE_LIMIT_CONFIG,
  keyPrefix: 'memory_rl'
});

strictFallbackLimiter = new RateLimiterMemory({
  ...STRICT_RATE_LIMIT_CONFIG,
  keyPrefix: 'memory_strict_rl'
});

/**
 * Get the appropriate rate limiter based on Redis availability
 * @param {boolean} strict - Whether to use strict rate limiting
 * @returns {Object} Rate limiter instance
 */
const getRateLimiter = (strict = false) => {
  if (redisClient && redisClient.isOpen) {
    return strict ? strictRateLimiter : rateLimiter;
  }
  return strict ? strictFallbackLimiter : fallbackLimiter;
};

/**
 * Generate rate limiting key based on request
 * @param {Object} req - Express request object
 * @returns {string} Rate limiting key
 */
const generateKey = (req) => {
  // Use IP address as primary identifier
  let key = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Add forwarded IP if available (for proxy setups)
  const forwardedFor = req.get('X-Forwarded-For');
  if (forwardedFor) {
    key = forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to connection remote address
  if (!key) {
    key = 'unknown';
  }
  
  return key;
};

/**
 * Standard rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
const rateLimiterMiddleware = (options = {}) => {
  const {
    strict = false,
    skipIf = null,
    keyGenerator = generateKey,
    onLimitReached = null,
    points = null,
    duration = null
  } = options;
  
  return async (req, res, next) => {
    try {
      // Skip rate limiting if condition is met
      if (skipIf && typeof skipIf === 'function' && skipIf(req)) {
        return next();
      }
      
      // Skip for health checks and monitoring
      if (req.path === '/api/health' || req.path.startsWith('/api-docs')) {
        return next();
      }
      
      const key = keyGenerator(req);
      const limiter = getRateLimiter(strict);
      
      // Custom points/duration if specified
      if (points || duration) {
        const customConfig = {
          ...RATE_LIMIT_CONFIG,
          ...(points && { points }),
          ...(duration && { duration, blockDuration: duration })
        };
        
        const customLimiter = redisClient && redisClient.isOpen 
          ? new RateLimiterRedis({ storeClient: redisClient, ...customConfig })
          : new RateLimiterMemory(customConfig);
          
        await customLimiter.consume(key);
      } else {
        await limiter.consume(key);
      }
      
      next();
      
    } catch (rejRes) {
      const remainingPoints = rejRes?.remainingPoints || 0;
      const msBeforeNext = rejRes?.msBeforeNext || 15 * 60 * 1000;
      const totalHits = rejRes?.totalHits || 0;
      
      // Set rate limit headers
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': options.points || RATE_LIMIT_CONFIG.points,
        'X-RateLimit-Remaining': Math.max(remainingPoints, 0),
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
        'X-RateLimit-Total': totalHits
      });
      
      // Log rate limit violation
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        remainingPoints,
        totalHits,
        strict
      });
      
      // Call custom handler if provided
      if (onLimitReached && typeof onLimitReached === 'function') {
        onLimitReached(req, res, rejRes);
      }
      
      // Return rate limit error
      res.status(429).json({
        success: false,
        error: {
          type: 'RateLimitError',
          message: 'Too many requests, please try again later',
          retryAfter: Math.round(msBeforeNext / 1000),
          limit: options.points || RATE_LIMIT_CONFIG.points,
          remaining: Math.max(remainingPoints, 0),
          resetTime: new Date(Date.now() + msBeforeNext).toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Strict rate limiting for sensitive endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
const strictRateLimiterMiddleware = (options = {}) => {
  return rateLimiterMiddleware({
    ...options,
    strict: true
  });
};

/**
 * Progressive rate limiting that gets stricter with violations
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
const progressiveRateLimiter = (options = {}) => {
  const {
    basePoints = 50,
    escalationFactor = 0.5,
    maxEscalation = 5
  } = options;
  
  return async (req, res, next) => {
    try {
      const key = generateKey(req);
      const limiter = getRateLimiter();
      
      // Check current violations
      const resRateLimiter = await limiter.get(key);
      const currentViolations = resRateLimiter ? Math.floor(resRateLimiter.totalHits / basePoints) : 0;
      
      // Calculate escalated points
      const escalation = Math.min(currentViolations * escalationFactor, maxEscalation);
      const adjustedPoints = Math.max(basePoints - (basePoints * escalation), 10);
      
      // Create dynamic limiter with adjusted points
      const dynamicLimiter = redisClient && redisClient.isOpen 
        ? new RateLimiterRedis({
            storeClient: redisClient,
            ...RATE_LIMIT_CONFIG,
            points: adjustedPoints,
            keyPrefix: 'progressive_rl'
          })
        : new RateLimiterMemory({
            ...RATE_LIMIT_CONFIG,
            points: adjustedPoints,
            keyPrefix: 'progressive_memory_rl'
          });
      
      await dynamicLimiter.consume(key);
      next();
      
    } catch (rejRes) {
      // Handle rate limit exceeded (similar to standard middleware)
      const remainingPoints = rejRes?.remainingPoints || 0;
      const msBeforeNext = rejRes?.msBeforeNext || 15 * 60 * 1000;
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Type': 'Progressive',
        'X-RateLimit-Remaining': Math.max(remainingPoints, 0)
      });
      
      logger.warn('Progressive rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        remainingPoints
      });
      
      res.status(429).json({
        success: false,
        error: {
          type: 'ProgressiveRateLimitError',
          message: 'Rate limit exceeded. Continued violations result in stricter limits.',
          retryAfter: Math.round(msBeforeNext / 1000)
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Get rate limiter statistics
 * @param {string} key - Optional key to get specific stats
 * @returns {Promise<Object>} Rate limiter statistics
 */
const getRateLimiterStats = async (key = null) => {
  try {
    const limiter = getRateLimiter();
    
    if (key) {
      const resRateLimiter = await limiter.get(key);
      return resRateLimiter ? {
        totalHits: resRateLimiter.totalHits,
        remainingPoints: resRateLimiter.remainingPoints,
        msBeforeNext: resRateLimiter.msBeforeNext
      } : null;
    }
    
    return {
      type: redisClient && redisClient.isOpen ? 'Redis' : 'Memory',
      config: RATE_LIMIT_CONFIG,
      connected: redisClient ? redisClient.isOpen : false
    };
    
  } catch (error) {
    logger.error('Error getting rate limiter stats:', error);
    return { error: error.message };
  }
};

/**
 * Reset rate limit for a specific key
 * @param {string} key - Key to reset
 * @returns {Promise<boolean>} Success status
 */
const resetRateLimit = async (key) => {
  try {
    const limiter = getRateLimiter();
    await limiter.delete(key);
    logger.info(`Rate limit reset for key: ${key}`);
    return true;
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    return false;
  }
};

// Connect Redis client if available
if (redisClient) {
  redisClient.connect().catch((error) => {
    logger.warn('Rate limiter Redis connection failed on startup:', error.message);
  });
}

module.exports = {
  rateLimiterMiddleware,
  strictRateLimiterMiddleware,
  progressiveRateLimiter,
  getRateLimiterStats,
  resetRateLimit,
  generateKey
};

// Export default middleware for backward compatibility
module.exports.default = rateLimiterMiddleware();