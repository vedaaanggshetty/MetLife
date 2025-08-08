const express = require('express');
const Premium = require('../models/Premium');
const Policy = require('../models/Policy');
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const { 
  validatePremium, 
  validateObjectId, 
  validatePagination 
} = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/v1/premiums:
 *   get:
 *     summary: Get all premiums
 *     tags: [Premiums]
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
 *         description: Number of premiums per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by premium status
 *     responses:
 *       200:
 *         description: Premiums retrieved successfully
 */
router.get('/', protect, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    let query = {};
    
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }
    // Admin and agents can see all premiums
    
    // Apply filters
    if (req.query.status) {
      query.status = req.query.status;
    }

    const premiums = await Premium.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType premiumAmount')
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Premium.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      status: 'success',
      data: {
        premiums,
        pagination: {
          currentPage: page,
          totalPages,
          totalPremiums: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get premiums error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving premiums'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums:
 *   post:
 *     summary: Create a new premium (Admin/Agent only)
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Premium'
 *     responses:
 *       201:
 *         description: Premium created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, authorize('admin', 'agent'), validatePremium, async (req, res) => {
  try {
    const { policyId, amount, dueDate } = req.body;

    // Verify policy exists
    const policy = await Policy.findById(policyId);
    
    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    const premiumData = {
      policyId,
      userId: policy.userId,
      amount,
      dueDate
    };

    const premium = await Premium.create(premiumData);
    
    const populatedPremium = await Premium.findById(premium._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType');

    res.status(201).json({
      status: 'success',
      message: 'Premium created successfully',
      data: {
        premium: populatedPremium
      }
    });
  } catch (error) {
    console.error('Create premium error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating premium'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums/{id}:
 *   get:
 *     summary: Get premium by ID
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Premium ID
 *     responses:
 *       200:
 *         description: Premium retrieved successfully
 *       404:
 *         description: Premium not found
 */
router.get('/:id', protect, validateObjectId('id'), async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Users can only see their own premiums
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const premium = await Premium.findOne(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType premiumAmount');

    if (!premium) {
      return res.status(404).json({
        status: 'error',
        message: 'Premium not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        premium
      }
    });
  } catch (error) {
    console.error('Get premium error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving premium'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums/{id}/pay:
 *   patch:
 *     summary: Pay premium
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Premium ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *               - transactionId
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [credit-card, debit-card, bank-transfer, upi, cash]
 *               transactionId:
 *                 type: string
 *               paymentReference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Premium paid successfully
 */
router.patch('/:id/pay', protect, validateObjectId('id'), async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentReference } = req.body;

    let query = { _id: req.params.id };
    
    // Users can only pay their own premiums
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const premium = await Premium.findOne(query);

    if (!premium) {
      return res.status(404).json({
        status: 'error',
        message: 'Premium not found'
      });
    }

    if (premium.status === 'paid') {
      return res.status(400).json({
        status: 'error',
        message: 'Premium has already been paid'
      });
    }

    if (premium.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot pay cancelled premium'
      });
    }

    // Process payment
    await premium.processPayment({
      method: paymentMethod,
      transactionId,
      reference: paymentReference
    });

    // Update policy's last premium paid date and total premiums paid
    const policy = await Policy.findById(premium.policyId);
    if (policy) {
      policy.lastPremiumPaid = new Date();
      policy.totalPremiumsPaid += premium.finalAmount;
      policy.nextPremiumDue = policy.calculateNextPremiumDue();
      await policy.save();
    }

    const updatedPremium = await Premium.findById(premium._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType');

    res.json({
      status: 'success',
      message: 'Premium paid successfully',
      data: {
        premium: updatedPremium
      }
    });
  } catch (error) {
    console.error('Pay premium error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing premium payment'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums/overdue:
 *   get:
 *     summary: Get overdue premiums
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue premiums retrieved successfully
 */
router.get('/overdue', protect, async (req, res) => {
  try {
    let query = {
      status: { $in: ['pending', 'overdue'] },
      dueDate: { $lt: new Date() }
    };

    // Users can only see their own overdue premiums
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const overduePremiums = await Premium.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType')
      .sort({ dueDate: 1 });

    // Mark as overdue and calculate late fees
    for (let premium of overduePremiums) {
      if (premium.status === 'pending') {
        await premium.markOverdue();
      }
    }

    res.json({
      status: 'success',
      data: {
        premiums: overduePremiums,
        count: overduePremiums.length
      }
    });
  } catch (error) {
    console.error('Get overdue premiums error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving overdue premiums'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums/upcoming:
 *   get:
 *     summary: Get upcoming premiums
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead
 *     responses:
 *       200:
 *         description: Upcoming premiums retrieved successfully
 */
router.get('/upcoming', protect, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    let query = {
      status: 'pending',
      dueDate: { $gte: new Date(), $lte: futureDate }
    };

    // Users can only see their own upcoming premiums
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const upcomingPremiums = await Premium.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType')
      .sort({ dueDate: 1 });

    res.json({
      status: 'success',
      data: {
        premiums: upcomingPremiums,
        count: upcomingPremiums.length
      }
    });
  } catch (error) {
    console.error('Get upcoming premiums error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving upcoming premiums'
    });
  }
});

/**
 * @swagger
 * /api/v1/premiums/statistics:
 *   get:
 *     summary: Get premium statistics
 *     tags: [Premiums]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Premium statistics retrieved successfully
 */
router.get('/statistics', protect, async (req, res) => {
  try {
    const userId = req.user.role === 'user' ? req.user._id : null;
    const stats = await Premium.getStatistics(userId);
    
    // Get additional statistics
    let query = {};
    if (userId) {
      query.userId = userId;
    }

    const totalPremiums = await Premium.countDocuments(query);
    const overduePremiums = await Premium.countDocuments({
      ...query,
      status: 'overdue'
    });

    res.json({
      status: 'success',
      data: {
        totalPremiums,
        overduePremiums,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    console.error('Get premium statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving premium statistics'
    });
  }
});

module.exports = router;