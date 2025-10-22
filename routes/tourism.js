const express = require('express');
const router = express.Router();
const TourismData = require('../models/TourismData');
const cache = require('../middleware/cache');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/tourism/visitors:
 *   get:
 *     summary: Get visitor data by country and date range
 *     tags: [Tourism]
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Country name
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date
 *     responses:
 *       200:
 *         description: Visitor data retrieved successfully
 */
router.get('/visitors', cache(300), async (req, res) => {
  try {
    const { country, startDate, endDate, period } = req.query;
    
    let query = {};
    if (country) query.country = country;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const data = await TourismData.find(query)
      .sort({ date: -1 })
      .limit(1000);
    
    // Group by period if specified
    let processedData = data;
    if (period === 'monthly') {
      processedData = await TourismData.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              country: "$country"
            },
            totalVisitors: { $sum: "$visitors" },
            avgSpending: { $avg: "$avgSpending" }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } }
      ]);
    }
    
    res.status(200).json({
      success: true,
      data: processedData,
      count: processedData.length,
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching visitor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch visitor data'
    });
  }
});

/**
 * @swagger
 * /api/tourism/countries:
 *   get:
 *     summary: Get list of all countries with visitor data
 *     tags: [Tourism]
 *     responses:
 *       200:
 *         description: Countries list retrieved successfully
 */
router.get('/countries', cache(3600), async (req, res) => {
  try {
    const countries = await TourismData.distinct('country');
    const countriesWithStats = await Promise.all(
      countries.map(async (country) => {
        const latestData = await TourismData
          .findOne({ country })
          .sort({ date: -1 });
        
        const totalVisitors = await TourismData.aggregate([
          { $match: { country } },
          { $group: { _id: null, total: { $sum: "$visitors" } } }
        ]);
        
        return {
          country,
          latestVisitors: latestData?.visitors || 0,
          latestDate: latestData?.date,
          totalVisitors: totalVisitors[0]?.total || 0
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: countriesWithStats,
      count: countriesWithStats.length
    });
    
  } catch (error) {
    logger.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch countries data'
    });
  }
});

/**
 * @swagger
 * /api/tourism/trends:
 *   get:
 *     summary: Get tourism trends and patterns
 *     tags: [Tourism]
 *     responses:
 *       200:
 *         description: Trends data retrieved successfully
 */
router.get('/trends', cache(1800), async (req, res) => {
  try {
    const { timeframe = '12m' } = req.query;
    
    let dateFilter = new Date();
    if (timeframe === '12m') {
      dateFilter.setFullYear(dateFilter.getFullYear() - 1);
    } else if (timeframe === '6m') {
      dateFilter.setMonth(dateFilter.getMonth() - 6);
    } else if (timeframe === '3m') {
      dateFilter.setMonth(dateFilter.getMonth() - 3);
    }
    
    const trends = await TourismData.aggregate([
      { $match: { date: { $gte: dateFilter } } },
      {
        $group: {
          _id: {
            country: "$country",
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          visitors: { $sum: "$visitors" },
          spending: { $avg: "$avgSpending" }
        }
      },
      {
        $group: {
          _id: "$_id.country",
          monthlyData: {
            $push: {
              year: "$_id.year",
              month: "$_id.month",
              visitors: "$visitors",
              spending: "$spending"
            }
          },
          totalVisitors: { $sum: "$visitors" },
          avgSpending: { $avg: "$spending" }
        }
      },
      { $sort: { totalVisitors: -1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: trends,
      timeframe,
      generatedAt: new Date()
    });
    
  } catch (error) {
    logger.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends data'
    });
  }
});

module.exports = router;