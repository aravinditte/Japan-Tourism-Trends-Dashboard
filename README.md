# Japan Tourism Trends Dashboard

A comprehensive, real-time dashboard showing international visitor arrivals to Japan by top countries (2018-present), highlighting COVID-19 impact and recovery trends.

## Features

### 📊 Data Visualization
- **Yearly Trends**: Line chart showing visitor arrivals from 2018-2025
- **Monthly Patterns**: Bar chart displaying seasonal tourism patterns
- **COVID-19 Impact Analysis**: Comparative analysis of pandemic effects and recovery
- **Real-time Stats**: Live visitor counts, growth rates, and top countries

### 🚀 Technology Stack
- **Frontend**: React 18, Chart.js, CSS3 with responsive design
- **Backend**: Node.js, Express.js, MongoDB with Mongoose
- **Data Sources**: JNTO (Japan National Tourism Organization) with automated ingestion
- **Deployment**: Production-ready with Docker support

### 🔄 Automated Data Pipeline
- **JNTO Data Ingestion**: Automated worker fetches real tourism data every 6 hours
- **Multiple Data Sources**: Primary JNTO API, web scraping fallback, external sources
- **Smart Fallbacks**: Ensures dashboard always has current data
- **Real-time Updates**: Frontend refreshes every 10 minutes

### 🌍 Top 6 Countries Tracked
1. South Korea 🇰🇷
2. China 🇨🇳
3. Taiwan 🇹🇼
4. Hong Kong 🇭🇰
5. USA 🇺🇸
6. Thailand 🇹🇭

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/aravinditte/Japan-Tourism-Trends-Dashboard.git
cd Japan-Tourism-Trends-Dashboard

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install worker dependencies
cd workers
npm install
cd ..
```

### Environment Setup

Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/japan_tourism
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/japan_tourism

PORT=5000
NODE_ENV=production
```

### Development Mode

```bash
# Terminal 1: Start backend server
npm run dev

# Terminal 2: Start React development server
cd client
npm start
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000 (proxies to backend)

### Production Mode

```bash
# Build React app
cd client
npm run build
cd ..

# Start production server
npm start
```

- Full application: http://localhost:5000

## JNTO Data Ingestion Worker

The dashboard includes an intelligent data ingestion system that automatically fetches real tourism data:

### 🔄 Automated Data Pipeline

1. **Primary Source**: JNTO official statistics API
2. **Fallback Method**: Web scraping of JNTO website
3. **External Sources**: Trading Economics, CEIC data as backup
4. **Realistic Generation**: Smart data generation based on real trends when APIs are unavailable

### ⏰ Scheduling

- **JNTO Data Ingestion**: Every 6 hours (0 */6 * * *)
- **Stats Update**: Every hour (0 * * * *)
- **Frontend Refresh**: Every 10 minutes (client-side)

### 🔧 Manual Data Refresh

```bash
# Run JNTO worker manually
cd workers
node jntoDataIngestion.js

# Or via API endpoint
curl -X POST http://localhost:5000/api/refresh-jnto-data
```

## API Endpoints

### Data Endpoints
- `GET /api/tourism-data` - All tourism data with filters
- `GET /api/tourism-data/yearly` - Yearly aggregated data
- `GET /api/tourism-data/monthly/:year` - Monthly data for specific year
- `GET /api/countries` - Available countries list
- `GET /api/covid-impact` - COVID-19 impact analysis

### Stats & Management
- `GET /api/stats` - Real-time statistics
- `GET /api/data-sources` - Data source information
- `POST /api/refresh-jnto-data` - Manual data refresh

## Project Structure

```
japan-tourism-dashboard/
├── server.js                 # Express server with integrated JNTO worker
├── package.json             # Server dependencies
├── workers/                 # Data ingestion workers
│   ├── jntoDataIngestion.js  # JNTO data worker
│   └── package.json         # Worker dependencies
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.js           # Main application
│   │   └── index.js         # React entry point
│   ├── public/
│   └── package.json         # Client dependencies
└── README.md               # This file
```

## Data Schema

### Tourism Data
```javascript
{
  year: Number,        // 2018-2025
  month: Number,       // 1-12
  country: String,     // Country name
  visitors: Number,    // Visitor count
  source: String,      // Data source (JNTO, JNTO_WEB_SCRAPING, etc.)
  isOfficial: Boolean, // True for official JNTO data
  lastUpdated: Date    // Last update timestamp
}
```

### Real-time Stats
```javascript
{
  totalVisitors: Number,    // Current month total
  monthlyGrowth: Number,    // Growth percentage vs previous month
  topCountry: String,       // Leading source country
  lastUpdated: Date,        // Stats update timestamp
  lastJNTOUpdate: Date      // Last JNTO data ingestion
}
```

## Deployment

### Render.com (Recommended)

1. Connect GitHub repository
2. Set environment variables:
   - `MONGODB_URI`: MongoDB Atlas connection string
   - `NODE_ENV=production`
3. Build command: `npm install && cd client && npm install && npm run build`
4. Start command: `npm start`

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN cd client && npm ci && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## Features Deep Dive

### 📈 COVID-19 Impact Analysis
- Visualizes 80-99% decline in 2020-2021
- Tracks recovery patterns by country
- Highlights countries exceeding pre-pandemic levels
- Shows ongoing impact on specific markets (e.g., China)

### 🌸 Seasonal Patterns
- Spring peak (March-May): Cherry blossom season
- Autumn peak (October-November): Fall colors
- Winter lows (December-February): Cold weather impact
- Summer stable (June-August): Varied by country

### 🔄 Real-time Features
- Live visitor counts with smooth animations
- Auto-refreshing data every 10 minutes
- Growth indicators with positive/negative styling
- Last updated timestamps

### 📱 Responsive Design
- Mobile-first approach
- Touch-friendly controls
- Adaptive charts and layouts
- Optimized for all screen sizes

## Development

### Scripts
```bash
npm run dev          # Development server with nodemon
npm run client       # React development server
npm run server       # Backend only
npm start           # Production server
npm run build       # Build client for production
```

### Environment Variables
```env
MONGODB_URI=         # MongoDB connection string
PORT=5000           # Server port
NODE_ENV=production # Environment mode
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## Data Sources

- **Primary**: [JNTO Japan Tourism Statistics](https://statistics.jnto.go.jp/en/)
- **Secondary**: Trading Economics, CEIC Data
- **Research**: Nippon.com, JNTO reports, tourism industry publications

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check existing GitHub issues
2. Create new issue with detailed description
3. Include error logs and environment details

---

**Built with ❤️ for Japan Tourism Analysis**

Last updated: October 2025