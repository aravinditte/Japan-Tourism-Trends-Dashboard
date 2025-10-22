const express = require('express');
const router = express.Router();
const TourismData = require('../models/TourismData');
const cache = require('../middleware/cache');
const logger = require('../utils/logger');
const { body, query, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * @swagger
 * components:
 *   schemas:
 *     VisitorData:
 *       type: object
 *       properties:
 *         country:
 *           type: string
 *           example: South Korea
 *         visitors:
 *           type: number
 *           example: 750000
 *         date:
 *           type: string
 *           format: date
 *           example: 2025-10-01
 *         avgSpending:
 *           type: number
 *           example: 180000
 *         avgStayDuration:
 *           type: number
 *           example: 5.2
 */

/**
 * @swagger
 * /api/tourism/visitors:
 *   get:
 *     summary: Get visitor data by country and date range
 *     tags: [Tourism Data]
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Country name (e.g., South Korea, China, Taiwan, USA, Hong Kong)
 *         example: South Korea
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for data range
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for data range
 *         example: 2025-10-22
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, quarterly, annual]
 *         description: Data aggregation period
 *         example: monthly
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         description: Maximum number of records to return
 *         example: 100
 *     responses:
 *       200:
 *         description: Visitor data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VisitorData'
 *                 count:
 *                   type: integer
 *                   example: 50
 *                 cached:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: Bad request - validation error
 *       500:
 *         description: Internal server error
 */
router.get('/visitors', [
  query('country').optional().isString().trim().isLength({ min: 1, max: 50 }),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  query('period').optional().isIn(['monthly', 'quarterly', 'annual']),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  handleValidationErrors,
  cache(300)
], async (req, res) => {
  try {
    const { country, startDate, endDate, period, limit = 1000 } = req.query;
    
    let query = {};
    if (country) {
      query.country = new RegExp(country, 'i'); // Case-insensitive search
    }
    
    if (startDate && endDate) {
      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date must be before end date'
        });
      }
      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }
    
    let processedData;
    
    // Group by period if specified
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
            avgSpending: { $avg: "$avgSpending" },
            avgStayDuration: { $avg: "$avgStayDuration" },
            recordCount: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: limit }
      ]);
    } else if (period === 'quarterly') {
      processedData = await TourismData.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              quarter: { $ceil: { $divide: [{ $month: "$date" }, 3] } },
              country: "$country"
            },
            totalVisitors: { $sum: "$visitors" },
            avgSpending: { $avg: "$avgSpending" },
            avgStayDuration: { $avg: "$avgStayDuration" },
            recordCount: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": -1, "_id.quarter": -1 } },
        { $limit: limit }
      ]);
    } else if (period === 'annual') {
      processedData = await TourismData.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              country: "$country"
            },
            totalVisitors: { $sum: "$visitors" },
            avgSpending: { $avg: "$avgSpending" },
            avgStayDuration: { $avg: "$avgStayDuration" },
            recordCount: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": -1 } },
        { $limit: limit }
      ]);
    } else {
      // Raw data
      processedData = await TourismData.find(query)
        .select('country visitors date avgSpending avgStayDuration source period')
        .sort({ date: -1 })
        .limit(limit)
        .lean();
    }
    
    res.status(200).json({
      success: true,
      data: processedData,
      count: processedData.length,
      cached: req.fromCache || false,
      query: {
        country: country || 'all',
        period: period || 'raw',
        dateRange: {
          start: startDate || 'earliest',
          end: endDate || 'latest'
        }
      }
    });
    
  } catch (error) {
    logger.error('Error fetching visitor data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch visitor data',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/tourism/countries:
 *   get:
 *     summary: Get list of all countries with visitor statistics
 *     tags: [Tourism Data]
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [totalVisitors, latestVisitors, country]
 *         description: Field to sort countries by
 *         example: totalVisitors
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *         example: desc
 *     responses:
 *       200:
 *         description: Countries list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       country:
 *                         type: string
 *                       latestVisitors:
 *                         type: number
 *                       latestDate:
 *                         type: string
 *                         format: date
 *                       totalVisitors:
 *                         type: number
 *                       avgSpending:
 *                         type: number
 *                       recordCount:
 *                         type: number
 */
router.get('/countries', [
  query('sortBy').optional().isIn(['totalVisitors', 'latestVisitors', 'country']),
  query('order').optional().isIn(['asc', 'desc']),
  handleValidationErrors,
  cache(3600)
], async (req, res) => {
  try {
    const { sortBy = 'totalVisitors', order = 'desc' } = req.query;
    
    const countries = await TourismData.distinct('country');
    const countriesWithStats = await Promise.all(
      countries.map(async (country) => {
        const latestData = await TourismData
          .findOne({ country })
          .sort({ date: -1 })
          .lean();
        
        const aggregatedData = await TourismData.aggregate([
          { $match: { country } },
          {
            $group: {
              _id: null,
              totalVisitors: { $sum: "$visitors" },
              avgSpending: { $avg: "$avgSpending" },
              avgStayDuration: { $avg: "$avgStayDuration" },
              recordCount: { $sum: 1 },
              firstDate: { $min: "$date" },
              lastDate: { $max: "$date" }
            }
          }
        ]);
        
        const stats = aggregatedData[0] || {};
        
        return {
          country,
          latestVisitors: latestData?.visitors || 0,
          latestDate: latestData?.date,
          totalVisitors: stats.totalVisitors || 0,
          avgSpending: Math.round(stats.avgSpending || 0),
          avgStayDuration: Math.round((stats.avgStayDuration || 0) * 10) / 10,
          recordCount: stats.recordCount || 0,
          dataRange: {
            start: stats.firstDate,
            end: stats.lastDate
          }
        };
      })
    );
    
    // Sort results
    const sortMultiplier = order === 'asc' ? 1 : -1;
    countriesWithStats.sort((a, b) => {
      if (sortBy === 'country') {
        return sortMultiplier * a.country.localeCompare(b.country);
      }
      return sortMultiplier * (a[sortBy] - b[sortBy]);
    });
    
    res.status(200).json({
      success: true,
      data: countriesWithStats,
      count: countriesWithStats.length,
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch countries data',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/tourism/trends:
 *   get:
 *     summary: Get tourism trends and growth patterns
 *     tags: [Tourism Analytics]
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [3m, 6m, 12m, 24m, all]
 *         description: Time period for trend analysis
 *         example: 12m
 *       - in: query
 *         name: countries
 *         schema:
 *           type: string
 *         description: Comma-separated list of countries to analyze
 *         example: South Korea,China,Taiwan
 *     responses:
 *       200:
 *         description: Trends data retrieved successfully
 */
router.get('/trends', [
  query('timeframe').optional().isIn(['3m', '6m', '12m', '24m', 'all']),
  query('countries').optional().isString(),
  handleValidationErrors,
  cache(1800)
], async (req, res) => {
  try {
    const { timeframe = '12m', countries } = req.query;
    
    let dateFilter = {};
    if (timeframe !== 'all') {
      const now = new Date();
      const monthsBack = parseInt(timeframe.replace('m', ''));
      dateFilter = { date: { $gte: new Date(now.setMonth(now.getMonth() - monthsBack)) } };
    }
    
    let countryFilter = {};
    if (countries) {
      const countryList = countries.split(',').map(c => c.trim());
      countryFilter = { country: { $in: countryList } };
    }
    
    const matchCriteria = { ...dateFilter, ...countryFilter };
    
    const trends = await TourismData.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            country: "$country",
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          visitors: { $sum: "$visitors" },
          spending: { $avg: "$avgSpending" },
          stayDuration: { $avg: "$avgStayDuration" }
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
              spending: "$spending",
              stayDuration: "$stayDuration"
            }
          },
          totalVisitors: { $sum: "$visitors" },
          avgSpending: { $avg: "$spending" },
          avgStayDuration: { $avg: "$stayDuration" }
        }
      },
      { $sort: { totalVisitors: -1 } }
    ]);
    
    // Calculate growth rates for each country
    const trendsWithGrowth = trends.map(trend => {
      const sortedData = trend.monthlyData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      let growthRate = 0;
      if (sortedData.length >= 2) {
        const first = sortedData[0].visitors;
        const last = sortedData[sortedData.length - 1].visitors;
        growthRate = first > 0 ? ((last - first) / first * 100) : 0;
      }
      
      return {
        ...trend,
        growthRate: Math.round(growthRate * 100) / 100,
        monthlyData: sortedData
      };
    });
    
    res.status(200).json({
      success: true,
      data: trendsWithGrowth,
      timeframe,
      countries: countries || 'all',
      generatedAt: new Date().toISOString(),
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends data',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/tourism/recovery:
 *   get:
 *     summary: Get COVID-19 recovery statistics compared to 2019 baseline
 *     tags: [Tourism Analytics]
 *     parameters:
 *       - in: query
 *         name: baselineYear
 *         schema:
 *           type: integer
 *           minimum: 2018
 *           maximum: 2020
 *         description: Baseline year for recovery comparison
 *         example: 2019
 *     responses:
 *       200:
 *         description: Recovery statistics retrieved successfully
 */
router.get('/recovery', [
  query('baselineYear').optional().isInt({ min: 2018, max: 2020 }).toInt(),
  handleValidationErrors,
  cache(3600)
], async (req, res) => {
  try {
    const { baselineYear = 2019 } = req.query;
    
    // Get baseline data (2019 by default)
    const baselineData = await TourismData.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${baselineYear}-01-01`),
            $lt: new Date(`${baselineYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: "$country",
          baselineVisitors: { $sum: "$visitors" }
        }
      }
    ]);
    
    // Get latest year data (2025)
    const currentData = await TourismData.aggregate([
      {
        $match: {
          date: {
            $gte: new Date('2025-01-01'),
            $lt: new Date('2026-01-01')
          }
        }
      },
      {
        $group: {
          _id: "$country",
          currentVisitors: { $sum: "$visitors" }
        }
      }
    ]);
    
    // Calculate recovery rates
    const recoveryStats = baselineData.map(baseline => {
      const current = currentData.find(c => c._id === baseline._id);
      const currentVisitors = current?.currentVisitors || 0;
      const recoveryRate = baseline.baselineVisitors > 0 
        ? Math.round((currentVisitors / baseline.baselineVisitors) * 100 * 100) / 100
        : 0;
      
      return {
        country: baseline._id,
        baselineVisitors: baseline.baselineVisitors,
        currentVisitors,
        recoveryRate,
        status: recoveryRate >= 100 ? 'Exceeded' : recoveryRate >= 80 ? 'Strong Recovery' : recoveryRate >= 50 ? 'Partial Recovery' : 'Slow Recovery'
      };
    }).sort((a, b) => b.recoveryRate - a.recoveryRate);
    
    res.status(200).json({
      success: true,
      data: recoveryStats,
      baselineYear,
      comparisonYear: 2025,
      generatedAt: new Date().toISOString(),
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching recovery data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recovery data',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;