const express = require('express');
const Razorpay = require('razorpay');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Premium = require('../models/Premium');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * @swagger
 * /api/v1/payments/razorpay/create-order:
 *   post:
 *     summary: Create Razorpay order for premium payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - premiumId
 *             properties:
 *               premiumId:
 *                 type: string
 *                 description: Premium ID to pay
 *     responses:
 *       200:
 *         description: Razorpay order created successfully
 *       404:
 *         description: Premium not found
 */
router.post('/razorpay/create-order', protect, async (req, res) => {
  try {
    const { premiumId } = req.body;

    // Find premium
    let query = { _id: premiumId };
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const premium = await Premium.findOne(query).populate('policyId', 'policyNumber policyType');

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

    // Create Razorpay order
    const orderOptions = {
      amount: Math.round(premium.finalAmount * 100), // Amount in paise
      currency: 'INR',
      receipt: `premium_${premiumId}`,
      notes: {
        premiumId: premiumId,
        userId: premium.userId.toString(),
        policyNumber: premium.policyId.policyNumber
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    res.json({
      status: 'success',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        premium: {
          id: premium._id,
          amount: premium.finalAmount,
          dueDate: premium.dueDate,
          policy: premium.policyId
        }
      }
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating payment order'
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/razorpay/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *               - premiumId
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *               premiumId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified and processed successfully
 *       400:
 *         description: Payment verification failed
 */
router.post('/razorpay/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, premiumId } = req.body;

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment verification failed'
      });
    }

    // Find premium
    let query = { _id: premiumId };
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

    // Process payment
    await premium.processPayment({
      method: 'razorpay',
      transactionId: razorpay_payment_id,
      reference: razorpay_order_id
    });

    // Update policy's premium tracking
    const Policy = require('../models/Policy');
    const policy = await Policy.findById(premium.policyId);
    if (policy) {
      policy.lastPremiumPaid = new Date();
      policy.totalPremiumsPaid += premium.finalAmount;
      policy.nextPremiumDue = policy.calculateNextPremiumDue();
      await policy.save();
    }

    const updatedPremium = await Premium.findById(premium._id)
      .populate('userId', 'firstName lastName email')
      .populate('policyId', 'policyNumber policyType');

    res.json({
      status: 'success',
      message: 'Payment processed successfully',
      data: {
        premium: updatedPremium,
        paymentId: razorpay_payment_id
      }
    });
  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing payment'
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/stripe/create-intent:
 *   post:
 *     summary: Create Stripe payment intent for premium payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - premiumId
 *             properties:
 *               premiumId:
 *                 type: string
 *                 description: Premium ID to pay
 *     responses:
 *       200:
 *         description: Stripe payment intent created successfully
 *       404:
 *         description: Premium not found
 */
router.post('/stripe/create-intent', protect, async (req, res) => {
  try {
    const { premiumId } = req.body;

    // Find premium
    let query = { _id: premiumId };
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const premium = await Premium.findOne(query)
      .populate('userId', 'firstName lastName email')
      .populate('policyId', 'policyNumber policyType');

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

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(premium.finalAmount * 100), // Amount in cents
      currency: 'usd', // Change to your preferred currency
      customer: premium.userId.email,
      metadata: {
        premiumId: premiumId,
        userId: premium.userId._id.toString(),
        policyNumber: premium.policyId.policyNumber
      },
      description: `Premium payment for policy ${premium.policyId.policyNumber}`
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: premium.finalAmount,
        premium: {
          id: premium._id,
          amount: premium.finalAmount,
          dueDate: premium.dueDate,
          policy: premium.policyId
        }
      }
    });
  } catch (error) {
    console.error('Create Stripe payment intent error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating payment intent'
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/stripe/confirm:
 *   post:
 *     summary: Confirm Stripe payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *               - premiumId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               premiumId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed and processed successfully
 *       400:
 *         description: Payment confirmation failed
 */
router.post('/stripe/confirm', protect, async (req, res) => {
  try {
    const { paymentIntentId, premiumId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        status: 'error',
        message: 'Payment not completed'
      });
    }

    // Find premium
    let query = { _id: premiumId };
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

    // Process payment
    await premium.processPayment({
      method: 'stripe',
      transactionId: paymentIntent.id,
      reference: paymentIntent.charges.data[0]?.id || paymentIntent.id
    });

    // Update policy's premium tracking
    const Policy = require('../models/Policy');
    const policy = await Policy.findById(premium.policyId);
    if (policy) {
      policy.lastPremiumPaid = new Date();
      policy.totalPremiumsPaid += premium.finalAmount;
      policy.nextPremiumDue = policy.calculateNextPremiumDue();
      await policy.save();
    }

    const updatedPremium = await Premium.findById(premium._id)
      .populate('userId', 'firstName lastName email')
      .populate('policyId', 'policyNumber policyType');

    res.json({
      status: 'success',
      message: 'Payment processed successfully',
      data: {
        premium: updatedPremium,
        paymentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Confirm Stripe payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing payment'
    });
  }
});

/**
 * @swagger
 * /api/v1/payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
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
 *         description: Number of payments per page
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 */
router.get('/history', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { status: 'paid' };
    
    // Users can only see their own payment history
    if (req.user.role === 'user') {
      query.userId = req.user._id;
    }

    const payments = await Premium.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('policyId', 'policyNumber policyType')
      .sort({ paidDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Premium.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Calculate total amount paid
    const totalAmount = await Premium.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]).then(result => result[0]?.total || 0);

    res.json({
      status: 'success',
      data: {
        payments,
        summary: {
          totalPayments: total,
          totalAmount
        },
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving payment history'
    });
  }
});

// Webhook endpoints for payment confirmations
router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Verify webhook signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(body);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      
      // Handle successful payment
      console.log('Razorpay payment captured:', payment.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).send('Webhook error');
  }
});

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Handle successful payment
      console.log('Stripe payment succeeded:', paymentIntent.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;