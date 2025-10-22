const logger = require('../utils/logger');

/**
 * Enhanced error handler middleware with detailed error processing
 * @param {Error} err - Error object
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode;
  
  // Log the full error with stack trace
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID format';
    error = { 
      message, 
      statusCode: 400,
      type: 'ValidationError'
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate ${field} already exists`;
    error = { 
      message, 
      statusCode: 409,
      type: 'DuplicateError',
      field
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = { 
      message: 'Validation failed',
      statusCode: 400,
      type: 'ValidationError',
      details: messages
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: 401,
      type: 'AuthenticationError'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: 401,
      type: 'AuthenticationError'
    };
  }

  // Syntax errors (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = {
      message: 'Invalid JSON format in request body',
      statusCode: 400,
      type: 'SyntaxError'
    };
  }

  // Request timeout
  if (err.code === 'ETIMEDOUT') {
    error = {
      message: 'Request timeout',
      statusCode: 408,
      type: 'TimeoutError'
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File size too large',
      statusCode: 413,
      type: 'FileSizeError'
    };
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    error = {
      message: 'Too many requests, please try again later',
      statusCode: 429,
      type: 'RateLimitError',
      retryAfter: err.retryAfter || 60
    };
  }

  // Database connection errors
  if (err.name === 'MongoServerError' || err.name === 'MongoNetworkError') {
    error = {
      message: 'Database connection error',
      statusCode: 503,
      type: 'DatabaseError'
    };
  }

  // Redis connection errors
  if (err.code === 'ECONNREFUSED' && err.port === 6379) {
    error = {
      message: 'Cache service unavailable',
      statusCode: 503,
      type: 'CacheError'
    };
  }

  // Set default error if none matched
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const type = error.type || 'ServerError';

  // Prepare response object
  const errorResponse = {
    success: false,
    error: {
      type,
      message,
      ...(error.details && { details: error.details }),
      ...(error.field && { field: error.field }),
      ...(error.retryAfter && { retryAfter: error.retryAfter })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      ...error.details
    };
  }

  // Set rate limiting headers if applicable
  if (statusCode === 429) {
    res.set('Retry-After', error.retryAfter || 60);
  }

  // Set security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  // Send error response
  res.status(statusCode).json(errorResponse);

  // Don't call next() as this is the final error handler
};

/**
 * Async error wrapper to catch async function errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler for undefined routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  error.type = 'NotFoundError';
  next(error);
};

/**
 * Create error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} type - Error type
 * @returns {Error} Error object
 */
const createError = (message, statusCode = 500, type = 'ServerError') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.type = type;
  return error;
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  createError
};

// Export errorHandler as default for backward compatibility
module.exports.default = errorHandler;