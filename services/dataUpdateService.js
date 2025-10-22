const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const TourismData = require('../models/TourismData');
const logger = require('../utils/logger');

class DataUpdateService {
  constructor() {
    this.isRunning = false;
    this.lastUpdate = null;
    this.updateInterval = process.env.SCRAPING_INTERVAL || '0 */6 * * *'; // Every 6 hours
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async scrapeJNTOData() {
    let attempt = 0;
    
    while (attempt < this.retryAttempts) {
      try {
        logger.info(`Starting JNTO data scraping attempt ${attempt + 1}/${this.retryAttempts}...`);
        
        const response = await axios.get('https://statistics.jnto.go.jp/en/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 30000,
          maxRedirects: 5
        });
        
        const $ = cheerio.load(response.data);
        const scrapedData = [];
        
        // Try multiple selectors for visitor data
        const selectors = [
          '.visitor-data-table tr',
          '.statistics-table tr',
          '.data-table tr',
          'table tr'
        ];
        
        for (const selector of selectors) {
          const rows = $(selector);
          if (rows.length > 0) {
            logger.info(`Found ${rows.length} rows with selector: ${selector}`);
            
            rows.each((i, element) => {
              try {
                const country = $(element).find('.country-name, td:first-child').text().trim();
                const visitorText = $(element).find('.visitor-count, td:nth-child(2)').text().trim();
                const dateText = $(element).find('.date, td:last-child').text().trim();
                
                const visitors = parseInt(visitorText.replace(/[^0-9]/g, ''));
                
                if (country && !isNaN(visitors) && visitors > 0 && dateText) {
                  const date = this.parseDate(dateText);
                  if (date && date <= new Date()) {
                    scrapedData.push({
                      country: this.normalizeCountryName(country),
                      visitors,
                      date,
                      source: 'JNTO_SCRAPED',
                      dataQuality: 'MEDIUM',
                      period: 'monthly'
                    });
                  }
                }
              } catch (rowError) {
                logger.debug(`Error processing row ${i}:`, rowError.message);
              }
            });
            
            if (scrapedData.length > 0) break;
          }
        }
        
        logger.info(`Scraped ${scrapedData.length} records from JNTO`);
        return scrapedData;
        
      } catch (error) {
        attempt++;
        logger.error(`JNTO scraping attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          logger.info(`Retrying in ${this.retryDelay}ms...`);
          await this.delay(this.retryDelay);
        }
      }
    }
    
    logger.warn('All JNTO scraping attempts failed, returning empty data');
    return [];
  }

  parseDate(dateText) {
    try {
      // Handle various date formats
      const cleanText = dateText.replace(/[^0-9\-\/]/g, '');
      
      // Try different date patterns
      const patterns = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
      ];
      
      for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match) {
          let year, month, day;
          
          if (match[1].length === 4) {
            // Year first
            [, year, month, day] = match;
          } else {
            // Year last
            [, month, day, year] = match;
          }
          
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
      
      // Fallback to current month if no pattern matches
      return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    } catch (error) {
      logger.debug('Date parsing error:', error.message);
      return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    }
  }

  normalizeCountryName(country) {
    const countryMapping = {
      'korea': 'South Korea',
      'south korea': 'South Korea',
      'republic of korea': 'South Korea',
      'china': 'China',
      'people\'s republic of china': 'China',
      'taiwan': 'Taiwan',
      'republic of china': 'Taiwan',
      'usa': 'USA',
      'united states': 'USA',
      'united states of america': 'USA',
      'hong kong': 'Hong Kong',
      'hongkong': 'Hong Kong'
    };
    
    const normalized = country.toLowerCase().trim();
    return countryMapping[normalized] || country.trim();
  }

  async updateDatabaseWithScrapedData(scrapedData, io) {
    let updatedCount = 0;
    let newCount = 0;
    let errorCount = 0;
    
    try {
      for (const record of scrapedData) {
        try {
          const existing = await TourismData.findOne({
            country: record.country,
            date: {
              $gte: new Date(record.date.getFullYear(), record.date.getMonth(), 1),
              $lt: new Date(record.date.getFullYear(), record.date.getMonth() + 1, 1)
            }
          });
          
          if (existing) {
            if (existing.visitors !== record.visitors) {
              existing.visitors = record.visitors;
              existing.source = record.source;
              existing.dataQuality = record.dataQuality;
              existing.updatedAt = new Date();
              
              await existing.save();
              updatedCount++;
              
              // Emit real-time update
              if (io) {
                io.to('tourism-updates').emit('dataUpdate', {
                  type: 'update',
                  country: record.country,
                  data: existing.toSafeObject()
                });
              }
            }
          } else {
            const newRecord = new TourismData(record);
            await newRecord.save();
            newCount++;
            
            // Emit real-time update
            if (io) {
              io.to('tourism-updates').emit('dataUpdate', {
                type: 'new',
                country: record.country,
                data: newRecord.toSafeObject()
              });
            }
          }
        } catch (recordError) {
          errorCount++;
          logger.error(`Error processing record for ${record.country}:`, recordError.message);
        }
      }
      
      logger.info(`Database update complete: ${updatedCount} updated, ${newCount} new records, ${errorCount} errors`);
      this.lastUpdate = new Date();
      
      // Emit summary update
      if (io) {
        const totalRecords = await TourismData.countDocuments({ isActive: true });
        io.to('tourism-updates').emit('updateSummary', {
          timestamp: this.lastUpdate,
          updatedCount,
          newCount,
          errorCount,
          totalRecords,
          source: 'JNTO_SCRAPED'
        });
      }
      
    } catch (error) {
      logger.error('Error updating database with scraped data:', error);
    }
  }

  async performFullUpdate(io) {
    if (this.isRunning) {
      logger.warn('Data update already in progress, skipping...');
      return {
        success: false,
        message: 'Update already in progress'
      };
    }
    
    this.isRunning = true;
    
    try {
      logger.info('Starting full data update...');
      
      // Scrape latest data
      const scrapedData = await this.scrapeJNTOData();
      
      if (scrapedData.length > 0) {
        await this.updateDatabaseWithScrapedData(scrapedData, io);
      } else {
        logger.warn('No data scraped, generating estimated data instead');
      }
      
      // Generate estimated current data if scraping failed
      if (scrapedData.length === 0) {
        await this.generateEstimatedCurrentData(io);
      }
      
      logger.info('Full data update completed successfully');
      
      return {
        success: true,
        scrapedRecords: scrapedData.length,
        lastUpdate: this.lastUpdate
      };
      
    } catch (error) {
      logger.error('Error in full data update:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  async generateEstimatedCurrentData(io) {
    try {
      const countries = ['South Korea', 'China', 'Taiwan', 'USA', 'Hong Kong'];
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const estimatedData = [];
      
      for (const country of countries) {
        // Check if we already have data for this month
        const existing = await TourismData.findOne({
          country,
          date: {
            $gte: firstDayOfMonth,
            $lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
          }
        });
        
        if (!existing) {
          // Get historical average for this month
          const historicalAvg = await TourismData.aggregate([
            {
              $match: {
                country,
                date: {
                  $gte: new Date(2019, 0, 1),
                  $lt: new Date(2020, 0, 1)
                }
              }
            },
            {
              $group: {
                _id: null,
                avgVisitors: { $avg: '$visitors' },
                avgSpending: { $avg: '$avgSpending' },
                avgStayDuration: { $avg: '$avgStayDuration' }
              }
            }
          ]);
          
          const baseData = historicalAvg[0] || { avgVisitors: 500000, avgSpending: 180000, avgStayDuration: 5.5 };
          
          // Apply growth factor and seasonality
          const growthFactor = this.getGrowthFactor(country);
          const seasonalFactor = this.getSeasonalFactor(currentDate.getMonth() + 1);
          
          const estimatedVisitors = Math.floor(
            baseData.avgVisitors * growthFactor * seasonalFactor * (0.9 + Math.random() * 0.2)
          );
          
          const estimatedRecord = {
            country,
            visitors: estimatedVisitors,
            date: firstDayOfMonth,
            avgSpending: Math.floor(baseData.avgSpending * (0.95 + Math.random() * 0.1)),
            avgStayDuration: Math.round((baseData.avgStayDuration * (0.9 + Math.random() * 0.2)) * 10) / 10,
            source: 'ESTIMATED',
            dataQuality: 'ESTIMATED',
            period: 'monthly'
          };
          
          estimatedData.push(estimatedRecord);
        }
      }
      
      // Save estimated data
      for (const record of estimatedData) {
        const newRecord = new TourismData(record);
        await newRecord.save();
        
        if (io) {
          io.to('tourism-updates').emit('dataUpdate', {
            type: 'estimated',
            country: record.country,
            data: newRecord.toSafeObject()
          });
        }
      }
      
      logger.info(`Generated ${estimatedData.length} estimated records`);
      
    } catch (error) {
      logger.error('Error generating estimated data:', error);
    }
  }

  getGrowthFactor(country) {
    // Growth factors based on 2025 trends
    const growthFactors = {
      'South Korea': 1.4,
      'China': 1.6,
      'Taiwan': 1.2,
      'USA': 1.5,
      'Hong Kong': 1.0
    };
    
    return growthFactors[country] || 1.0;
  }

  getSeasonalFactor(month) {
    // Seasonal factors for Japan tourism
    const seasonalFactors = {
      1: 0.8, 2: 0.7, 3: 1.1, 4: 1.3, 5: 1.2,
      6: 0.9, 7: 1.1, 8: 1.0, 9: 0.9, 10: 1.2, 11: 1.1, 12: 0.8
    };
    
    return seasonalFactors[month] || 1.0;
  }

  startPeriodicUpdates(io) {
    try {
      // Schedule periodic updates
      cron.schedule(this.updateInterval, () => {
        logger.info('Starting scheduled data update...');
        this.performFullUpdate(io);
      }, {
        scheduled: true,
        timezone: "Asia/Tokyo"
      });
      
      // Initial update on startup (delayed)
      setTimeout(() => {
        logger.info('Starting initial data update...');
        this.performFullUpdate(io);
      }, 10000); // 10 seconds delay
      
      logger.info(`Periodic data updates scheduled: ${this.updateInterval}`);
      
    } catch (error) {
      logger.error('Error setting up periodic updates:', error);
    }
  }

  stopPeriodicUpdates() {
    cron.destroy();
    logger.info('Periodic data updates stopped');
  }

  async getUpdateStatus() {
    try {
      const totalRecords = await TourismData.countDocuments({ isActive: true });
      const recentRecords = await TourismData.countDocuments({
        isActive: true,
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      return {
        isRunning: this.isRunning,
        lastUpdate: this.lastUpdate,
        totalRecords,
        recentRecords,
        updateInterval: this.updateInterval
      };
    } catch (error) {
      logger.error('Error getting update status:', error);
      return {
        isRunning: this.isRunning,
        lastUpdate: this.lastUpdate,
        error: error.message
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new DataUpdateService();