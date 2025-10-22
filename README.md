# 🇯🇵 Japan Tourism Trends Dashboard v2.0

## Overview

A comprehensive, real-time analytics dashboard for Japan's international tourism data, built with modern Node.js, React, and MongoDB technologies. This application provides live insights into visitor trends, spending patterns, and recovery metrics from official JNTO (Japan National Tourism Organization) sources.

## ✨ Features

### 🔄 Real-time Data Updates
- **Live WebSocket connections** for instant data updates
- **Automated JNTO data scraping** every 6 hours
- **Real-time chart updates** with smooth animations
- **Push notifications** for significant data changes

### 📊 Advanced Analytics
- **Interactive charts** with Chart.js and Recharts
- **Multi-country comparisons** with dynamic filtering
- **Recovery rate calculations** vs pre-COVID baselines
- **Trend analysis** with pattern recognition
- **Seasonal analytics** and growth projections

### 🚀 Modern Tech Stack
- **Backend**: Node.js, Express, MongoDB, Redis, Socket.IO
- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **Real-time**: WebSocket connections with Socket.IO
- **Caching**: Redis for performance optimization
- **API Documentation**: Swagger/OpenAPI 3.0

### 🔒 Production-Ready Features
- **Rate limiting** and request throttling
- **Error handling** and monitoring
- **Docker containerization** with multi-stage builds
- **Nginx reverse proxy** configuration
- **Health checks** and monitoring endpoints
- **Comprehensive logging** with Winston

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│   Node.js API   │◄──►│   MongoDB       │
│                 │    │                 │    │                 │
│ • Real-time UI  │    │ • REST APIs     │    │ • Tourism Data  │
│ • Interactive   │    │ • WebSocket     │    │ • Analytics     │
│   Charts        │    │ • Data Scraping │    │ • Indexes       │
│ • Responsive    │    │ • Caching       │    │                 │
│   Design        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │                 │
                       │ • Caching       │
                       │ • Rate Limiting │
                       │ • Session Store │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB 5+
- Redis 6+
- Docker (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aravinditte/Japan-Tourism-Trends-Dashboard.git
   cd Japan-Tourism-Trends-Dashboard
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start services**
   ```bash
   # Start MongoDB and Redis (if running locally)
   mongod
   redis-server
   
   # Seed database with initial data
   npm run seed
   
   # Start development servers
   npm run dev
   ```

6. **Access the application**
   - Dashboard: http://localhost:3000
   - API: http://localhost:5000
   - API Docs: http://localhost:5000/api-docs

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or run production build
docker-compose -f docker-compose.prod.yml up --build
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/japan-tourism-dashboard` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `JNTO_API_URL` | JNTO data source URL | `https://statistics.jnto.go.jp/en/` |
| `SCRAPING_INTERVAL` | Data update frequency | `6h` |

## 📊 API Documentation

### REST Endpoints

- `GET /api/tourism/visitors` - Get visitor data by country and date range
- `GET /api/tourism/countries` - List all countries with statistics
- `GET /api/tourism/trends` - Get tourism trends and patterns
- `GET /api/analytics/spending` - Get spending analytics
- `GET /api/health` - Health check endpoint

### WebSocket Events

- `subscribe-to-updates` - Subscribe to real-time data updates
- `dataUpdate` - Real-time data update events
- `updateSummary` - Batch update summaries

## 📈 Data Sources

### Primary Source
- **JNTO (Japan National Tourism Organization)**
  - Official visitor arrival statistics
  - Monthly and annual data
  - Country-wise breakdowns

### Data Processing
- **Automated scraping** every 6 hours
- **Data validation** and cleaning
- **Historical trend analysis**
- **Recovery rate calculations**

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client && npm test

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## 📦 Deployment

### Production Build

```bash
# Build client
cd client && npm run build && cd ..

# Start production server
npm start
```

### Docker Deployment

```bash
# Build production image
docker build -t japan-tourism-dashboard .

# Run container
docker run -p 5000:5000 japan-tourism-dashboard
```

### Cloud Deployment

Supports deployment on:
- **Heroku** - Easy deployment with buildpacks
- **AWS EC2/ECS** - Container-based deployment
- **Google Cloud Platform** - App Engine or Cloud Run
- **DigitalOcean** - App Platform or Droplets
- **Vercel/Netlify** - Frontend deployment with serverless API

## 🔧 Development

### Project Structure

```
├── server.js                 # Main server file
├── routes/                   # API routes
│   ├── tourism.js           # Tourism data endpoints
│   └── analytics.js         # Analytics endpoints
├── models/                   # Database models
│   └── TourismData.js       # Tourism data schema
├── services/                 # Business logic
│   └── dataUpdateService.js # Data scraping and updates
├── middleware/               # Express middleware
│   ├── cache.js             # Redis caching
│   ├── rateLimiter.js       # Rate limiting
│   └── errorHandler.js      # Error handling
├── utils/                    # Utilities
│   └── logger.js            # Logging configuration
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API services
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── scripts/                  # Utility scripts
│   ├── seedData.js          # Database seeding
│   └── scrapeJNTO.js        # Manual data scraping
├── docker-compose.yml        # Development compose file
├── Dockerfile               # Production container
└── nginx.conf               # Nginx configuration
```

### Key Technologies

**Backend**
- Express.js for REST APIs
- Socket.IO for real-time communication
- Mongoose for MongoDB interactions
- Redis for caching and rate limiting
- Winston for logging
- Joi for request validation
- Helmet for security headers

**Frontend**
- React 18 with TypeScript
- React Query for data fetching
- Framer Motion for animations
- Chart.js/Recharts for visualizations
- Tailwind CSS for styling
- React Router for navigation

## 📊 Key Statistics (2025)

Based on the latest JNTO data integrated into the dashboard:

- **Total Visitors (Jan-Sep 2025)**: 28.5M+ international arrivals
- **Top Source Countries**:
  - 🇨🇳 China: 10.8M visitors (158% recovery vs 2019)
  - 🇰🇷 South Korea: 7.9M visitors (141% recovery vs 2019)
  - 🇹🇼 Taiwan: 5.7M visitors (116% recovery vs 2019)
  - 🇺🇸 USA: 2.6M visitors (149% recovery vs 2019)
  - 🇭🇰 Hong Kong: 2.2M visitors (98% recovery vs 2019)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Japan National Tourism Organization (JNTO)** for providing official tourism statistics
- **Chart.js** and **Recharts** communities for excellent charting libraries
- **MongoDB**, **Redis**, and **Node.js** communities for robust technologies

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for Japan's tourism industry**

## 🆕 What's New in v2.0

### Major Upgrades
- **Complete rewrite** with Node.js/Express backend
- **Real-time WebSocket** integration for live data updates
- **MongoDB** database with advanced analytics
- **Redis caching** for improved performance
- **TypeScript** support throughout the frontend
- **Docker** containerization for easy deployment
- **Comprehensive API** with Swagger documentation
- **Production-ready** logging and monitoring

### Enhanced Features
- **Automated data scraping** from JNTO sources
- **Advanced trend analysis** with recovery metrics
- **Interactive charts** with multiple visualization options
- **Responsive design** optimized for all devices
- **Rate limiting** and security enhancements
- **Health monitoring** and performance metrics

### Technical Improvements
- **Scalable architecture** supporting high traffic
- **Microservices-ready** component structure
- **CI/CD friendly** with Docker and testing
- **Cloud deployment** ready for major platforms
- **API-first design** for extensibility
- **Real-time notifications** for data changes