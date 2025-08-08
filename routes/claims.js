const express = require('express');
const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const { 
  validateClaim, 
  validateObjectId, 
  validatePagination 
} = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/v1/claims:
 *   get:
 *     summary: Get all claims
 *     tags: [Claims]
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
 *         description: Number of claims per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by claim status
 *       - in: query
 *         name: claimType
 *         schema:
 *           type: string
 *         description: Filter by claim type
 *     responses:
 *       200:
 *         description: Claims retrieved successfully
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
    // Admin and agents can see all claims
    
    // Apply filters
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    if (req.query.claimType) {
      query.claimType = req.query.claimType;
    }

    const claims = await Claim.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType coverageAmount')
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Claim.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      status: 'success',
      data: {
        claims,
        pagination: {
          currentPage: page,
          totalPages,
          totalClaims: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get claims error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving claims'
    });
  }
});

/**
 * @swagger
 * /api/v1/claims:
 *   post:
 *     summary: Create a new claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Claim'
 *     responses:
 *       201:
 *         description: Claim created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, validateClaim, async (req, res) => {
  try {
    const { policyId, claimType, claimAmount, incidentDate, description, documents } = req.body;

    // Verify policy exists and belongs to user (if user role)
    const policy = await Policy.findById(policyId);
    
    if (!policy) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    if (req.user.role === 'user' && policy.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only create claims for your own policies'
      });
    }

    // Check if policy is active
    if (policy.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot create claim for inactive policy'
      });
    }

    // Check if claim amount exceeds coverage
    if (claimAmount > policy.coverageAmount) {
      return res.status(400).json({
        status: 'error',
        message: 'Claim amount exceeds policy coverage amount'
      });
    }

    const claimData = {
      policyId,
      userId: req.user.role === 'user' ? req.user._id : policy.userId,
      claimType,
      claimAmount,
      incidentDate,
      description,
      documents: documents || []
    };

    const claim = await Claim.create(claimData);
    
    const populatedClaim = await Claim.findById(claim._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType coverageAmount');

    res.status(201).json({
      status: 'success',
      message: 'Claim submitted successfully',
      data: {
        claim: populatedClaim
      }
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating claim'
    });
  }
});

/**
 * @swagger
 * /api/v1/claims/{id}:
 *   get:
 *     summary: Get claim by ID
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim ID
 *     responses:
 *       200:
 *         description: Claim retrieved successfully
 *       404:
 *         description: Claim not found
 */
router.get('/:id', protect, validateObjectId('id'), async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Users can only see their own claims
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const claim = await Claim.findOne(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType coverageAmount')
      .populate('reviewedBy', 'firstName lastName email');

    if (!claim) {
      return res.status(404).json({
        status: 'error',
        message: 'Claim not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        claim
      }
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving claim'
    });
  }
});

/**
 * @swagger
 * /api/v1/claims/{id}/review:
 *   patch:
 *     summary: Review claim (Admin/Agent only)
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               approvedAmount:
 *                 type: number
 *               reviewNotes:
 *                 type: string
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Claim reviewed successfully
 */
router.patch('/:id/review', protect, authorize('admin', 'agent'), validateObjectId('id'), async (req, res) => {
  try {
    const { status, approvedAmount, reviewNotes, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Status must be either approved or rejected'
      });
    }

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        status: 'error',
        message: 'Claim not found'
      });
    }

    if (claim.status !== 'submitted' && claim.status !== 'under-review') {
      return res.status(400).json({
        status: 'error',
        message: 'Claim has already been reviewed'
      });
    }

    // Update claim
    claim.status = status;
    claim.reviewedBy = req.user._id;
    claim.reviewDate = new Date();
    claim.reviewNotes = reviewNotes;

    if (status === 'approved') {
      claim.approvedAmount = approvedAmount || claim.claimAmount;
    } else {
      claim.rejectionReason = rejectionReason;
    }

    await claim.save();

    const updatedClaim = await Claim.findById(claim._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType coverageAmount')
      .populate('reviewedBy', 'firstName lastName email');

    res.json({
      status: 'success',
      message: `Claim ${status} successfully`,
      data: {
        claim: updatedClaim
      }
    });
  } catch (error) {
    console.error('Review claim error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error reviewing claim'
    });
  }
});

/**
 * @swagger
 * /api/v1/claims/{id}/pay:
 *   patch:
 *     summary: Mark claim as paid (Admin only)
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentReference
 *             properties:
 *               paymentReference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Claim marked as paid successfully
 */
router.patch('/:id/pay', protect, authorize('admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { paymentReference } = req.body;

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        status: 'error',
        message: 'Claim not found'
      });
    }

    if (claim.status !== 'approved') {
      return res.status(400).json({
        status: 'error',
        message: 'Only approved claims can be marked as paid'
      });
    }

    claim.status = 'paid';
    claim.paymentDate = new Date();
    claim.paymentReference = paymentReference;

    await claim.save();

    const updatedClaim = await Claim.findById(claim._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('policyId', 'policyNumber policyType coverageAmount')
      .populate('reviewedBy', 'firstName lastName email');

    res.json({
      status: 'success',
      message: 'Claim marked as paid successfully',
      data: {
        claim: updatedClaim
      }
    });
  } catch (error) {
    console.error('Pay claim error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing claim payment'
    });
  }
});

/**
 * @swagger
 * /api/v1/claims/statistics:
 *   get:
 *     summary: Get claims statistics
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Claims statistics retrieved successfully
 */
router.get('/statistics', protect, authorize('admin', 'agent'), async (req, res) => {
  try {
    const stats = await Claim.getStatistics();
    
    // Get additional statistics
    const totalClaims = await Claim.countDocuments();
    const overdueClaims = await Claim.find().then(claims => 
      claims.filter(claim => claim.isOverdue()).length
    );

    res.json({
      status: 'success',
      data: {
        totalClaims,
        overdueClaims,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    console.error('Get claims statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving claims statistics'
    });
  }
});

module.exports = router;