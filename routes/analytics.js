const express = require('express');
const router = express.Router();
const TourismData = require('../models/TourismData');
const cache = require('../middleware/cache');
const logger = require('../utils/logger');
const { query, validationResult } = require('express-validator');

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
 * /api/analytics/summary:
 *   get:
 *     summary: Get overall tourism analytics summary
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 */
router.get('/summary', cache(600), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Overall statistics
    const overallStats = await TourismData.aggregate([
      {
        $group: {
          _id: null,
          totalVisitors: { $sum: "$visitors" },
          totalRecords: { $sum: 1 },
          avgSpending: { $avg: "$avgSpending" },
          avgStayDuration: { $avg: "$avgStayDuration" },
          uniqueCountries: { $addToSet: "$country" },
          dateRange: {
            $push: {
              min: { $min: "$date" },
              max: { $max: "$date" }
            }
          }
        }
      }
    ]);
    
    // Monthly trends for current year
    const monthlyTrends = await TourismData.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          visitors: { $sum: "$visitors" },
          spending: { $avg: "$avgSpending" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Top countries by visitors
    const topCountries = await TourismData.aggregate([
      {
        $group: {
          _id: "$country",
          totalVisitors: { $sum: "$visitors" },
          avgSpending: { $avg: "$avgSpending" }
        }
      },
      { $sort: { totalVisitors: -1 } },
      { $limit: 10 }
    ]);
    
    const summary = overallStats[0] || {};
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalVisitors: summary.totalVisitors || 0,
          totalRecords: summary.totalRecords || 0,
          averageSpending: Math.round(summary.avgSpending || 0),
          averageStayDuration: Math.round((summary.avgStayDuration || 0) * 10) / 10,
          uniqueCountries: summary.uniqueCountries?.length || 0,
          dataAvailable: summary.totalRecords > 0
        },
        monthlyTrends: monthlyTrends.map(trend => ({
          month: trend._id,
          visitors: trend.visitors,
          avgSpending: Math.round(trend.spending || 0)
        })),
        topCountries: topCountries.map(country => ({
          country: country._id,
          totalVisitors: country.totalVisitors,
          avgSpending: Math.round(country.avgSpending || 0)
        }))
      },
      generatedAt: new Date().toISOString(),
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics summary',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/analytics/spending:
 *   get:
 *     summary: Get spending analytics by country and time period
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Country name to filter by
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year to analyze
 *     responses:
 *       200:
 *         description: Spending analytics retrieved successfully
 */
router.get('/spending', [
  query('country').optional().isString().trim(),
  query('year').optional().isInt({ min: 2018, max: 2026 }).toInt(),
  handleValidationErrors,
  cache(1800)
], async (req, res) => {
  try {
    const { country, year } = req.query;
    
    let matchCriteria = {
      avgSpending: { $exists: true, $ne: null }
    };
    
    if (country) {
      matchCriteria.country = new RegExp(country, 'i');
    }
    
    if (year) {
      matchCriteria.date = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      };
    }
    
    const spendingAnalytics = await TourismData.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: "$country",
          avgSpending: { $avg: "$avgSpending" },
          maxSpending: { $max: "$avgSpending" },
          minSpending: { $min: "$avgSpending" },
          totalVisitors: { $sum: "$visitors" },
          recordCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          totalRevenue: { $multiply: ["$avgSpending", "$totalVisitors"] }
        }
      },
      { $sort: { avgSpending: -1 } }
    ]);
    
    // Calculate overall spending statistics
    const overallStats = spendingAnalytics.reduce((acc, curr) => {
      acc.totalRevenue += curr.totalRevenue;
      acc.totalVisitors += curr.totalVisitors;
      acc.countries++;
      return acc;
    }, { totalRevenue: 0, totalVisitors: 0, countries: 0 });
    
    const avgRevenuePerVisitor = overallStats.totalVisitors > 0 
      ? overallStats.totalRevenue / overallStats.totalVisitors 
      : 0;
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue: Math.round(overallStats.totalRevenue),
          totalVisitors: overallStats.totalVisitors,
          avgRevenuePerVisitor: Math.round(avgRevenuePerVisitor),
          countriesAnalyzed: overallStats.countries
        },
        byCountry: spendingAnalytics.map(item => ({
          country: item._id,
          avgSpending: Math.round(item.avgSpending),
          maxSpending: Math.round(item.maxSpending),
          minSpending: Math.round(item.minSpending),
          totalVisitors: item.totalVisitors,
          estimatedRevenue: Math.round(item.totalRevenue),
          recordCount: item.recordCount
        }))
      },
      filters: {
        country: country || 'all',
        year: year || 'all'
      },
      generatedAt: new Date().toISOString(),
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching spending analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spending analytics',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/analytics/seasonal:
 *   get:
 *     summary: Get seasonal tourism patterns and trends
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Seasonal analytics retrieved successfully
 */
router.get('/seasonal', cache(3600), async (req, res) => {
  try {
    const seasonalData = await TourismData.aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$date" },
            country: "$country"
          },
          avgVisitors: { $avg: "$visitors" },
          totalVisitors: { $sum: "$visitors" },
          avgSpending: { $avg: "$avgSpending" },
          recordCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          countries: {
            $push: {
              country: "$_id.country",
              avgVisitors: "$avgVisitors",
              totalVisitors: "$totalVisitors",
              avgSpending: "$avgSpending"
            }
          },
          monthlyTotal: { $sum: "$totalVisitors" },
          monthlyAvgSpending: { $avg: "$avgSpending" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Define seasons
    const getSeasonName = (month) => {
      if (month >= 3 && month <= 5) return 'Spring';
      if (month >= 6 && month <= 8) return 'Summer';
      if (month >= 9 && month <= 11) return 'Autumn';
      return 'Winter';
    };
    
    // Group by seasons
    const seasonalSummary = seasonalData.reduce((acc, monthData) => {
      const season = getSeasonName(monthData._id);
      if (!acc[season]) {
        acc[season] = {
          season,
          totalVisitors: 0,
          avgSpending: 0,
          months: [],
          recordCount: 0
        };
      }
      
      acc[season].totalVisitors += monthData.monthlyTotal;
      acc[season].avgSpending += monthData.monthlyAvgSpending || 0;
      acc[season].months.push({
        month: monthData._id,
        visitors: monthData.monthlyTotal,
        spending: Math.round(monthData.monthlyAvgSpending || 0)
      });
      acc[season].recordCount++;
      
      return acc;
    }, {});
    
    // Calculate averages for seasons
    Object.keys(seasonalSummary).forEach(season => {
      const data = seasonalSummary[season];
      data.avgSpending = Math.round(data.avgSpending / data.recordCount);
    });
    
    // Monthly breakdown with month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthlyBreakdown = seasonalData.map(month => ({
      month: month._id,
      monthName: monthNames[month._id - 1],
      season: getSeasonName(month._id),
      totalVisitors: month.monthlyTotal,
      avgSpending: Math.round(month.monthlyAvgSpending || 0),
      topCountries: month.countries
        .sort((a, b) => b.totalVisitors - a.totalVisitors)
        .slice(0, 3)
        .map(c => ({
          country: c.country,
          visitors: c.totalVisitors,
          avgSpending: Math.round(c.avgSpending || 0)
        }))
    }));
    
    res.status(200).json({
      success: true,
      data: {
        seasonalSummary: Object.values(seasonalSummary),
        monthlyBreakdown,
        insights: {
          peakMonth: monthlyBreakdown.reduce((max, current) => 
            current.totalVisitors > max.totalVisitors ? current : max
          ),
          lowMonth: monthlyBreakdown.reduce((min, current) => 
            current.totalVisitors < min.totalVisitors ? current : min
          )
        }
      },
      generatedAt: new Date().toISOString(),
      cached: req.fromCache || false
    });
    
  } catch (error) {
    logger.error('Error fetching seasonal analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasonal analytics',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;