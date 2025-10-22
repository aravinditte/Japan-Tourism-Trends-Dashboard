const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error.message);
  }
}

// Custom log levels with colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Define log format for files
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'stack'] }),
  winston.format.json()
);

// Define log format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    // Add stack trace if present
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create transports array
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// File transports (only if log directory exists)
if (fs.existsSync(logDir)) {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      handleExceptions: true,
      handleRejections: true
    })
  );
  
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 20
    })
  );
  
  // HTTP access log
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 15
    })
  );
  
  // Debug log (development only)
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'debug.log'),
        level: 'debug',
        format: fileFormat,
        maxsize: 2097152, // 2MB
        maxFiles: 5
      })
    );
  }
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: customLevels.levels,
  format: fileFormat,
  transports,
  exitOnError: false,
  
  // Exception handlers
  exceptionHandlers: fs.existsSync(logDir) ? [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  ] : [],
  
  // Rejection handlers
  rejectionHandlers: fs.existsSync(logDir) ? [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  ] : []
});

// Enhanced logging methods with additional context
const originalError = logger.error;
logger.error = function(message, meta = {}) {
  const errorMeta = {
    ...meta,
    timestamp: new Date().toISOString(),
    level: 'error',
    ...(typeof message === 'object' && message.stack && { stack: message.stack })
  };
  
  return originalError.call(this, message instanceof Error ? message.message : message, errorMeta);
};

// HTTP request logger
logger.http = function(message, meta = {}) {
  const httpMeta = {
    ...meta,
    timestamp: new Date().toISOString(),
    level: 'http'
  };
  
  return logger.log('http', message, httpMeta);
};

// Performance logging
logger.perf = function(operation, duration, meta = {}) {
  const perfMeta = {
    ...meta,
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    level: 'info'
  };
  
  return logger.info(`Performance: ${operation} completed in ${duration}ms`, perfMeta);
};

// Security logging
logger.security = function(event, details = {}) {
  const securityMeta = {
    ...details,
    securityEvent: event,
    timestamp: new Date().toISOString(),
    level: 'warn'
  };
  
  return logger.warn(`Security Event: ${event}`, securityMeta);
};

// Database operation logging
logger.db = function(operation, collection, query = {}, meta = {}) {
  const dbMeta = {
    ...meta,
    operation,
    collection,
    query: typeof query === 'object' ? JSON.stringify(query) : query,
    timestamp: new Date().toISOString(),
    level: 'debug'
  };
  
  return logger.debug(`Database ${operation} on ${collection}`, dbMeta);
};

// API request/response logging
logger.api = function(method, endpoint, statusCode, duration, meta = {}) {
  const apiMeta = {
    ...meta,
    method,
    endpoint,
    statusCode,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    level: statusCode >= 400 ? 'warn' : 'info'
  };
  
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  return logger[level](`${method} ${endpoint} ${statusCode} - ${duration}ms`, apiMeta);
};

// Create stream for morgan HTTP logger
logger.stream = {
  write: function(message) {
    logger.http(message.trim());
  }
};

// Logger health check
logger.healthCheck = function() {
  try {
    const logDirExists = fs.existsSync(logDir);
    const canWrite = logDirExists ? fs.constants.W_OK : false;
    
    return {
      status: 'healthy',
      logDirectory: logDirExists ? logDir : 'not created',
      canWriteFiles: canWrite,
      activeTransports: logger.transports.length,
      logLevel: logger.level,
      environment: process.env.NODE_ENV || 'development'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
logger.close = function() {
  return new Promise((resolve) => {
    logger.info('Closing logger...');
    logger.end(() => {
      console.log('Logger closed successfully');
      resolve();
    });
  });
};

// Log startup information
if (process.env.NODE_ENV !== 'test') {
  logger.info('Logger initialized', {
    level: logger.level,
    environment: process.env.NODE_ENV || 'development',
    logDirectory: fs.existsSync(logDir) ? logDir : 'console only',
    transports: logger.transports.length
  });
}

module.exports = logger;