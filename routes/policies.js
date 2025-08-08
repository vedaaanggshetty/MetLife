const express = require('express');
const Policy = require('../models/Policy');
const Premium = require('../models/Premium');
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const { 
  validatePolicy, 
  validateObjectId, 
  validatePagination 
} = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/v1/policies:
 *   get:
 *     summary: Get all policies
 *     tags: [Policies]
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
 *         description: Number of policies per page
 *       - in: query
 *         name: policyType
 *         schema:
 *           type: string
 *         description: Filter by policy type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by policy status
 *     responses:
 *       200:
 *         description: Policies retrieved successfully
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
    } else if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }
    // Admin can see all policies
    
    // Apply filters
    if (req.query.policyType) {
      query.policyType = req.query.policyType;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }

    const policies = await Policy.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('agentId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Policy.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      status: 'success',
      data: {
        policies,
        pagination: {
          currentPage: page,
          totalPages,
          totalPolicies: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving policies'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies:
 *   post:
 *     summary: Create a new policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Policy'
 *     responses:
 *       201:
 *         description: Policy created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, authorize('admin', 'agent'), validatePolicy, async (req, res) => {
  try {
    const policyData = {
      ...req.body,
      agentId: req.user.role === 'agent' ? req.user._id : req.body.agentId
    };

    const policy = await Policy.create(policyData);
    
    // Create first premium
    const firstPremium = await Premium.create({
      policyId: policy._id,
      userId: policy.userId,
      amount: policy.premiumAmount,
      dueDate: policy.startDate
    });

    // Update policy with next premium due date
    policy.nextPremiumDue = policy.calculateNextPremiumDue();
    await policy.save();

    const populatedPolicy = await Policy.findById(policy._id)
      .populate('userId', 'firstName lastName email')
      .populate('agentId', 'firstName lastName email');

    res.status(201).json({
      status: 'success',
      message: 'Policy created successfully',
      data: {
        policy: populatedPolicy
      }
    });
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating policy'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies/{id}:
 *   get:
 *     summary: Get policy by ID
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Policy ID
 *     responses:
 *       200:
 *         description: Policy retrieved successfully
 *       404:
 *         description: Policy not found
 */
router.get('/:id', protect, validateObjectId('id'), async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Users can only see their own policies
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    } else if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }

    const policy = await Policy.findOne(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('agentId', 'firstName lastName email phone');

    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        policy
      }
    });
  } catch (error) {
    console.error('Get policy error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving policy'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies/{id}:
 *   put:
 *     summary: Update policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Policy ID
 *     responses:
 *       200:
 *         description: Policy updated successfully
 *       404:
 *         description: Policy not found
 */
router.put('/:id', protect, authorize('admin', 'agent'), validateObjectId('id'), async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Agents can only update their own policies
    if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }

    const policy = await Policy.findOne(query);

    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'coverageAmount', 'premiumAmount', 'premiumFrequency', 
      'endDate', 'beneficiaries', 'notes'
    ];
    
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedPolicy = await Policy.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email')
     .populate('agentId', 'firstName lastName email');

    res.json({
      status: 'success',
      message: 'Policy updated successfully',
      data: {
        policy: updatedPolicy
      }
    });
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating policy'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies/{id}/cancel:
 *   patch:
 *     summary: Cancel policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Policy ID
 *     responses:
 *       200:
 *         description: Policy cancelled successfully
 */
router.patch('/:id/cancel', protect, authorize('admin', 'agent'), validateObjectId('id'), async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }

    const policy = await Policy.findOneAndUpdate(
      query,
      { status: 'cancelled' },
      { new: true }
    ).populate('userId', 'firstName lastName email');

    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    // Cancel pending premiums
    await Premium.updateMany(
      { policyId: policy._id, status: 'pending' },
      { status: 'cancelled' }
    );

    res.json({
      status: 'success',
      message: 'Policy cancelled successfully',
      data: {
        policy
      }
    });
  } catch (error) {
    console.error('Cancel policy error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error cancelling policy'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies/{id}/renew:
 *   patch:
 *     summary: Renew policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Policy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEndDate
 *             properties:
 *               newEndDate:
 *                 type: string
 *                 format: date
 *               newPremiumAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Policy renewed successfully
 */
router.patch('/:id/renew', protect, authorize('admin', 'agent'), validateObjectId('id'), async (req, res) => {
  try {
    const { newEndDate, newPremiumAmount } = req.body;
    
    let query = { _id: req.params.id };
    
    if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }

    const policy = await Policy.findOne(query);

    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    // Update policy
    policy.endDate = newEndDate;
    policy.status = 'active';
    
    if (newPremiumAmount) {
      policy.premiumAmount = newPremiumAmount;
    }

    await policy.save();

    const updatedPolicy = await Policy.findById(policy._id)
      .populate('userId', 'firstName lastName email')
      .populate('agentId', 'firstName lastName email');

    res.json({
      status: 'success',
      message: 'Policy renewed successfully',
      data: {
        policy: updatedPolicy
      }
    });
  } catch (error) {
    console.error('Renew policy error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error renewing policy'
    });
  }
});

/**
 * @swagger
 * /api/v1/policies/expiring:
 *   get:
 *     summary: Get policies expiring soon
 *     tags: [Policies]
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
 *         description: Expiring policies retrieved successfully
 */
router.get('/expiring', protect, authorize('admin', 'agent'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    let query = {
      status: 'active',
      endDate: { $lte: expiryDate, $gte: new Date() }
    };

    if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }

    const expiringPolicies = await Policy.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('agentId', 'firstName lastName email')
      .sort({ endDate: 1 });

    res.json({
      status: 'success',
      data: {
        policies: expiringPolicies,
        count: expiringPolicies.length
      }
    });
  } catch (error) {
    console.error('Get expiring policies error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving expiring policies'
    });
  }
});

module.exports = router;