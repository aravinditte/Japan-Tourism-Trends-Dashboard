const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client for rate limiting
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch((error) => {
  logger.error('Rate limiter Redis connection error:', error);
});

// Rate limiter configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'tourism_api_rl',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Number of requests
  duration: 15 * 60, // Per 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    if (!redisClient.isOpen) {
      return next();
    }

    const key = req.ip || req.connection.remoteAddress;
    await rateLimiter.consume(key);
    next();
  } catch (rejRes) {
    const remainingPoints = rejRes?.remainingPoints || 0;
    const msBeforeNext = rejRes?.msBeforeNext || 15 * 60 * 1000;

    res.set('Retry-After', Math.round(msBeforeNext / 1000) || 1);
    res.set('X-RateLimit-Limit', process.env.RATE_LIMIT_MAX_REQUESTS || 100);
    res.set('X-RateLimit-Remaining', remainingPoints);
    res.set('X-RateLimit-Reset', new Date(Date.now() + msBeforeNext));

    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
};

module.exports = rateLimiterMiddleware;