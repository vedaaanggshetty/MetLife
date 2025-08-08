const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Policy:
 *       type: object
 *       required:
 *         - policyNumber
 *         - userId
 *         - policyType
 *         - coverageAmount
 *         - premiumAmount
 *         - startDate
 *         - endDate
 *       properties:
 *         policyNumber:
 *           type: string
 *           description: Unique policy number
 *         userId:
 *           type: string
 *           description: Reference to the user who owns this policy
 *         policyType:
 *           type: string
 *           enum: [life, health, auto, home, travel]
 *           description: Type of insurance policy
 *         coverageAmount:
 *           type: number
 *           description: Coverage amount in currency
 *         premiumAmount:
 *           type: number
 *           description: Premium amount to be paid
 *         premiumFrequency:
 *           type: string
 *           enum: [monthly, quarterly, semi-annual, annual]
 *           description: How often premium is paid
 *         startDate:
 *           type: string
 *           format: date
 *           description: Policy start date
 *         endDate:
 *           type: string
 *           format: date
 *           description: Policy end date
 *         status:
 *           type: string
 *           enum: [active, inactive, expired, cancelled]
 *           description: Current policy status
 *         beneficiaries:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               relationship:
 *                 type: string
 *               percentage:
 *                 type: number
 */

const policySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: [true, 'Policy number is required'],
    unique: true,
    uppercase: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  policyType: {
    type: String,
    required: [true, 'Policy type is required'],
    enum: ['life', 'health', 'auto', 'home', 'travel'],
    lowercase: true
  },
  coverageAmount: {
    type: Number,
    required: [true, 'Coverage amount is required'],
    min: [0, 'Coverage amount must be positive']
  },
  premiumAmount: {
    type: Number,
    required: [true, 'Premium amount is required'],
    min: [0, 'Premium amount must be positive']
  },
  premiumFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'semi-annual', 'annual'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'cancelled'],
    default: 'active'
  },
  beneficiaries: [{
    name: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      required: true
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  documents: [{
    name: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  nextPremiumDue: Date,
  lastPremiumPaid: Date,
  totalPremiumsPaid: {
    type: Number,
    default: 0
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for policy duration in years
policySchema.virtual('duration').get(function() {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 365));
});

// Virtual for days until expiry
policySchema.virtual('daysUntilExpiry').get(function() {
  const today = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Index for better query performance
policySchema.index({ userId: 1 });
policySchema.index({ policyNumber: 1 });
policySchema.index({ status: 1 });
policySchema.index({ policyType: 1 });
policySchema.index({ endDate: 1 });

// Pre-save middleware to generate policy number
policySchema.pre('save', async function(next) {
  if (!this.policyNumber) {
    const count = await this.constructor.countDocuments();
    this.policyNumber = `POL${Date.now()}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to check if policy is expired
policySchema.methods.isExpired = function() {
  return new Date() > this.endDate;
};

// Method to calculate next premium due date
policySchema.methods.calculateNextPremiumDue = function() {
  const lastPaid = this.lastPremiumPaid || this.startDate;
  const frequency = this.premiumFrequency;
  
  let nextDue = new Date(lastPaid);
  
  switch (frequency) {
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case 'quarterly':
      nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    case 'semi-annual':
      nextDue.setMonth(nextDue.getMonth() + 6);
      break;
    case 'annual':
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
  }
  
  return nextDue;
};

module.exports = mongoose.model('Policy', policySchema);