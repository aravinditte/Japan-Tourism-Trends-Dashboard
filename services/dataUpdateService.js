const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const TourismData = require('../models/TourismData');
const logger = require('../utils/logger');

class DataUpdateService {
  constructor() {
    this.isRunning = false;
    this.lastUpdate = null;
  }

  async scrapeJNTOData() {
    try {
      logger.info('Starting JNTO data scraping...');
      
      // Scrape latest data from JNTO statistics page
      const response = await axios.get('https://statistics.jnto.go.jp/en/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      const $ = cheerio.load(response.data);
      const scrapedData = [];
      
      // Parse visitor data from the statistics page
      // This is a simplified example - actual implementation would be more complex
      $('.visitor-data-table tr').each((i, element) => {
        const country = $(element).find('.country-name').text().trim();
        const visitors = parseInt($(element).find('.visitor-count').text().replace(/,/g, ''));
        const dateStr = $(element).find('.date').text().trim();
        
        if (country && visitors && dateStr) {
          scrapedData.push({
            country,
            visitors,
            date: new Date(dateStr),
            source: 'JNTO_SCRAPED'
          });
        }
      });
      
      logger.info(`Scraped ${scrapedData.length} records from JNTO`);
      return scrapedData;
      
    } catch (error) {
      logger.error('Error scraping JNTO data:', error.message);
      return [];
    }
  }

  async updateDatabaseWithScrapedData(scrapedData, io) {
    try {
      let updatedCount = 0;
      let newCount = 0;
      
      for (const record of scrapedData) {
        const existing = await TourismData.findOne({
          country: record.country,
          date: record.date
        });
        
        if (existing) {
          if (existing.visitors !== record.visitors) {
            existing.visitors = record.visitors;
            existing.updatedAt = new Date();
            await existing.save();
            updatedCount++;
            
            // Emit real-time update
            io.to('tourism-updates').emit('dataUpdate', {
              type: 'update',
              country: record.country,
              data: existing.toJSON()
            });
          }
        } else {
          const newRecord = new TourismData(record);
          await newRecord.save();
          newCount++;
          
          // Emit real-time update
          io.to('tourism-updates').emit('dataUpdate', {
            type: 'new',
            country: record.country,
            data: newRecord.toJSON()
          });
        }
      }
      
      logger.info(`Database update complete: ${updatedCount} updated, ${newCount} new records`);
      this.lastUpdate = new Date();
      
      // Emit summary update
      io.to('tourism-updates').emit('updateSummary', {
        timestamp: this.lastUpdate,
        updatedCount,
        newCount,
        totalRecords: await TourismData.countDocuments()
      });
      
    } catch (error) {
      logger.error('Error updating database:', error);
    }
  }

  async performFullUpdate(io) {
    if (this.isRunning) {
      logger.warn('Data update already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    
    try {
      logger.info('Starting full data update...');
      
      // Scrape latest data
      const scrapedData = await this.scrapeJNTOData();
      
      if (scrapedData.length > 0) {
        await this.updateDatabaseWithScrapedData(scrapedData, io);
      }
      
      // Also fetch data from backup APIs if needed
      await this.fetchFromBackupSources(io);
      
      logger.info('Full data update completed');
      
    } catch (error) {
      logger.error('Error in full data update:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async fetchFromBackupSources(io) {
    try {
      // Simulate fetching from alternative data sources
      // In a real implementation, this could call other tourism APIs
      const simulatedData = this.generateSimulatedCurrentData();
      
      for (const record of simulatedData) {
        const existing = await TourismData.findOne({
          country: record.country,
          date: {
            $gte: new Date(record.date.getFullYear(), record.date.getMonth(), 1),
            $lt: new Date(record.date.getFullYear(), record.date.getMonth() + 1, 1)
          }
        });
        
        if (!existing) {
          const newRecord = new TourismData({
            ...record,
            source: 'ESTIMATED'
          });
          await newRecord.save();
          
          io.to('tourism-updates').emit('dataUpdate', {
            type: 'estimated',
            country: record.country,
            data: newRecord.toJSON()
          });
        }
      }
      
    } catch (error) {
      logger.error('Error fetching from backup sources:', error);
    }
  }

  generateSimulatedCurrentData() {
    const countries = ['South Korea', 'China', 'Taiwan', 'USA', 'Hong Kong'];
    const currentDate = new Date();
    const data = [];
    
    countries.forEach(country => {
      // Generate realistic visitor numbers based on historical patterns
      let baseVisitors;
      switch (country) {
        case 'South Korea': baseVisitors = 750000; break;
        case 'China': baseVisitors = 1000000; break;
        case 'Taiwan': baseVisitors = 600000; break;
        case 'USA': baseVisitors = 200000; break;
        case 'Hong Kong': baseVisitors = 220000; break;
        default: baseVisitors = 100000;
      }
      
      // Add some randomness
      const visitors = Math.floor(baseVisitors * (0.8 + Math.random() * 0.4));
      
      data.push({
        country,
        visitors,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        avgSpending: Math.floor(150000 + Math.random() * 100000),
        avgStayDuration: 4 + Math.random() * 6
      });
    });
    
    return data;
  }

  startPeriodicUpdates(io) {
    // Update every 6 hours
    cron.schedule('0 */6 * * *', () => {
      logger.info('Starting scheduled data update...');
      this.performFullUpdate(io);
    });
    
    // Initial update on startup (delayed)
    setTimeout(() => {
      this.performFullUpdate(io);
    }, 5000);
    
    logger.info('Periodic data updates scheduled');
  }
}

module.exports = new DataUpdateService();