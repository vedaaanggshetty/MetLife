const express = require('express');
const User = require('../models/User');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Premium = require('../models/Premium');
const { protect, authorize } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// All routes require admin access
router.use(protect, authorize('admin'));

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get basic counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalPolicies = await Policy.countDocuments();
    const activePolicies = await Policy.countDocuments({ status: 'active' });
    const totalClaims = await Claim.countDocuments();
    const pendingClaims = await Claim.countDocuments({ 
      status: { $in: ['submitted', 'under-review'] } 
    });
    const totalPremiums = await Premium.countDocuments();
    const overduePremiums = await Premium.countDocuments({ status: 'overdue' });

    // Get revenue statistics
    const totalRevenue = await Premium.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]).then(result => result[0]?.total || 0);

    const monthlyRevenue = await Premium.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]).then(result => result[0]?.total || 0);

    // Get policy type distribution
    const policyTypeStats = await Policy.aggregate([
      {
        $group: {
          _id: '$policyType',
          count: { $sum: 1 },
          totalCoverage: { $sum: '$coverageAmount' }
        }
      }
    ]);

    // Get claim status distribution
    const claimStatusStats = await Claim.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimAmount' },
          avgAmount: { $avg: '$claimAmount' }
        }
      }
    ]);

    // Get recent activities
    const recentUsers = await User.find()
      .select('firstName lastName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPolicies = await Policy.find()
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentClaims = await Claim.find()
      .populate('userId', 'firstName lastName email')
      .populate('policyId', 'policyNumber policyType')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get monthly trends (last 12 months)
    const monthlyTrends = await Policy.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          policies: { $sum: 1 },
          totalCoverage: { $sum: '$coverageAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      status: 'success',
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalPolicies,
          activePolicies,
          totalClaims,
          pendingClaims,
          totalPremiums,
          overduePremiums,
          totalRevenue,
          monthlyRevenue
        },
        distributions: {
          policyTypes: policyTypeStats,
          claimStatuses: claimStatusStats
        },
        recentActivities: {
          users: recentUsers,
          policies: recentPolicies,
          claims: recentClaims
        },
        trends: {
          monthly: monthlyTrends
        }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving dashboard statistics'
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with advanced filtering
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users', validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    if (req.query.role) {
      query.role = req.query.role;
    }
    
    if (req.query.status) {
      query.isActive = req.query.status === 'active';
    }
    
    if (req.query.search) {
      query.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Build sort
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      sort = { [req.query.sortBy]: sortOrder };
    }

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        users,
        statistics: userStats,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving users'
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/reports/policies:
 *   get:
 *     summary: Get policy reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report
 *       - in: query
 *         name: policyType
 *         schema:
 *           type: string
 *         description: Filter by policy type
 *     responses:
 *       200:
 *         description: Policy report generated successfully
 */
router.get('/reports/policies', async (req, res) => {
  try {
    const { startDate, endDate, policyType } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Build query
    let query = { ...dateFilter };
    if (policyType) {
      query.policyType = policyType;
    }

    // Get policy statistics
    const policyStats = await Policy.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            type: '$policyType',
            status: '$status'
          },
          count: { $sum: 1 },
          totalCoverage: { $sum: '$coverageAmount' },
          totalPremiums: { $sum: '$premiumAmount' },
          avgCoverage: { $avg: '$coverageAmount' },
          avgPremium: { $avg: '$premiumAmount' }
        }
      }
    ]);

    // Get monthly breakdown
    const monthlyBreakdown = await Policy.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$policyType'
          },
          count: { $sum: 1 },
          totalCoverage: { $sum: '$coverageAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get top agents
    const topAgents = await Policy.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$agentId',
          policyCount: { $sum: 1 },
          totalCoverage: { $sum: '$coverageAmount' }
        }
      },
      { $sort: { policyCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: '$agent' }
    ]);

    res.json({
      status: 'success',
      data: {
        summary: {
          totalPolicies: await Policy.countDocuments(query),
          totalCoverage: await Policy.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$coverageAmount' } } }
          ]).then(result => result[0]?.total || 0)
        },
        statistics: policyStats,
        monthlyBreakdown,
        topAgents
      }
    });
  } catch (error) {
    console.error('Get policy reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating policy reports'
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/reports/claims:
 *   get:
 *     summary: Get claim reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report
 *       - in: query
 *         name: claimType
 *         schema:
 *           type: string
 *         description: Filter by claim type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by claim status
 *     responses:
 *       200:
 *         description: Claim report generated successfully
 */
router.get('/reports/claims', async (req, res) => {
  try {
    const { startDate, endDate, claimType, status } = req.query;
    
    // Build query
    let query = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (claimType) query.claimType = claimType;
    if (status) query.status = status;

    // Get claim statistics
    const claimStats = await Claim.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            type: '$claimType',
            status: '$status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimAmount' },
          totalApproved: { $sum: '$approvedAmount' },
          avgAmount: { $avg: '$claimAmount' },
          avgProcessingTime: {
            $avg: {
              $divide: [
                { $subtract: ['$reviewDate', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        }
      }
    ]);

    // Get approval rates
    const approvalRates = await Claim.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$claimType',
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $multiply: [{ $divide: ['$approved', '$total'] }, 100]
          }
        }
      }
    ]);

    // Get monthly trends
    const monthlyTrends = await Claim.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimAmount' },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      status: 'success',
      data: {
        summary: {
          totalClaims: await Claim.countDocuments(query),
          totalAmount: await Claim.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$claimAmount' } } }
          ]).then(result => result[0]?.total || 0),
          totalApproved: await Claim.aggregate([
            { $match: { ...query, status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$approvedAmount' } } }
          ]).then(result => result[0]?.total || 0)
        },
        statistics: claimStats,
        approvalRates,
        monthlyTrends
      }
    });
  } catch (error) {
    console.error('Get claim reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating claim reports'
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/reports/revenue:
 *   get:
 *     summary: Get revenue reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report
 *     responses:
 *       200:
 *         description: Revenue report generated successfully
 */
router.get('/reports/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.paidDate = {};
      if (startDate) dateFilter.paidDate.$gte = new Date(startDate);
      if (endDate) dateFilter.paidDate.$lte = new Date(endDate);
    }

    const query = { status: 'paid', ...dateFilter };

    // Get revenue statistics
    const revenueStats = await Premium.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'policies',
          localField: 'policyId',
          foreignField: '_id',
          as: 'policy'
        }
      },
      { $unwind: '$policy' },
      {
        $group: {
          _id: '$policy.policyType',
          totalRevenue: { $sum: '$finalAmount' },
          count: { $sum: 1 },
          avgPremium: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Get monthly revenue trends
    const monthlyRevenue = await Premium.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          revenue: { $sum: '$finalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get payment method breakdown
    const paymentMethods = await Premium.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$finalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate total revenue
    const totalRevenue = await Premium.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]).then(result => result[0]?.total || 0);

    res.json({
      status: 'success',
      data: {
        summary: {
          totalRevenue,
          totalTransactions: await Premium.countDocuments(query)
        },
        byPolicyType: revenueStats,
        monthlyTrends: monthlyRevenue,
        paymentMethods
      }
    });
  } catch (error) {
    console.error('Get revenue reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating revenue reports'
    });
  }
});

module.exports = router;