require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const socketIo = require('socket.io');
const http = require('http');
const Redis = require('redis');
const path = require('path');

// Import routes and middleware
const tourismRoutes = require('./routes/tourism');
const analyticsRoutes = require('./routes/analytics');
const dataUpdateService = require('./services/dataUpdateService');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Redis client for caching
let redisClient;
try {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 60000,
      lazyConnect: true
    }
  });
  
  redisClient.on('error', (err) => {
    logger.warn('Redis Client Error (non-fatal):', err.message);
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });
} catch (error) {
  logger.warn('Redis initialization failed, continuing without cache:', error.message);
  redisClient = null;
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined', { 
  stream: { 
    write: (message) => logger.info(message.trim()) 
  } 
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
}

// Rate limiting (only if Redis is available)
if (redisClient) {
  app.use(rateLimiter);
}

// API Documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Japan Tourism Dashboard API',
      version: '2.0.1',
      description: 'Real-time tourism analytics API for Japan visitor data with comprehensive endpoints for data visualization and analysis'
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        TourismData: {
          type: 'object',
          properties: {
            country: { type: 'string', example: 'South Korea' },
            visitors: { type: 'number', example: 750000 },
            date: { type: 'string', format: 'date', example: '2025-10-01' },
            avgSpending: { type: 'number', example: 180000 },
            avgStayDuration: { type: 'number', example: 5.2 }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Routes
app.use('/api/tourism', tourismRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    let redisStatus = 'Not Available';
    
    if (redisClient) {
      try {
        redisStatus = redisClient.isOpen ? 'Connected' : 'Disconnected';
      } catch (error) {
        redisStatus = 'Error';
      }
    }
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        mongodb: mongoStatus,
        redis: redisStatus
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      version: '2.0.1',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  socket.emit('connection-status', {
    status: 'connected',
    timestamp: new Date().toISOString(),
    clientId: socket.id
  });
  
  socket.on('subscribe-to-updates', (data) => {
    socket.join('tourism-updates');
    logger.info(`Client ${socket.id} subscribed to tourism updates for ${data?.country || 'all countries'}`);
    
    socket.emit('subscription-confirmed', {
      status: 'subscribed',
      room: 'tourism-updates',
      country: data?.country || 'all'
    });
  });
  
  socket.on('unsubscribe-from-updates', () => {
    socket.leave('tourism-updates');
    logger.info(`Client ${socket.id} unsubscribed from tourism updates`);
  });
  
  socket.on('disconnect', (reason) => {
    logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    logger.error(`WebSocket error for client ${socket.id}:`, error);
  });
});

// Make io and redisClient available to other modules
app.set('io', io);
app.set('redisClient', redisClient);

// MongoDB connection with retry logic
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/japan-tourism-dashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    logger.info('Connected to MongoDB successfully');
    
    // Initialize Redis connection if available
    if (redisClient) {
      redisClient.connect().catch((error) => {
        logger.warn('Redis connection failed, continuing without cache:', error.message);
      });
    }
    
    // Start data update service
    dataUpdateService.startPeriodicUpdates(io);
  })
  .catch((error) => {
    logger.error('MongoDB connection failed:', error);
    logger.info('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, starting graceful shutdown...');
  
  try {
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connections
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }
    
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  if (process.env.NODE_ENV === 'production') {
    logger.info(`Dashboard available at http://localhost:${PORT}`);
  }
});

module.exports = { app, io, redisClient };