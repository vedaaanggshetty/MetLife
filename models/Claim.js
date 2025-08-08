const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Claim:
 *       type: object
 *       required:
 *         - claimNumber
 *         - policyId
 *         - userId
 *         - claimType
 *         - claimAmount
 *         - incidentDate
 *         - description
 *       properties:
 *         claimNumber:
 *           type: string
 *           description: Unique claim number
 *         policyId:
 *           type: string
 *           description: Reference to the policy
 *         userId:
 *           type: string
 *           description: Reference to the user filing the claim
 *         claimType:
 *           type: string
 *           enum: [medical, accident, death, disability, property]
 *           description: Type of claim
 *         claimAmount:
 *           type: number
 *           description: Claimed amount
 *         incidentDate:
 *           type: string
 *           format: date
 *           description: Date when incident occurred
 *         description:
 *           type: string
 *           description: Detailed description of the claim
 *         status:
 *           type: string
 *           enum: [submitted, under-review, approved, rejected, paid]
 *           description: Current claim status
 */

const claimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: [true, 'Claim number is required'],
    unique: true,
    uppercase: true
  },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Policy',
    required: [true, 'Policy ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  claimType: {
    type: String,
    required: [true, 'Claim type is required'],
    enum: ['medical', 'accident', 'death', 'disability', 'property'],
    lowercase: true
  },
  claimAmount: {
    type: Number,
    required: [true, 'Claim amount is required'],
    min: [0, 'Claim amount must be positive']
  },
  approvedAmount: {
    type: Number,
    default: 0
  },
  incidentDate: {
    type: Date,
    required: [true, 'Incident date is required'],
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Incident date cannot be in the future'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['submitted', 'under-review', 'approved', 'rejected', 'paid'],
    default: 'submitted'
  },
  documents: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['medical-report', 'police-report', 'receipt', 'photo', 'other']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewDate: Date,
  reviewNotes: String,
  rejectionReason: String,
  paymentDate: Date,
  paymentReference: String,
  estimatedProcessingTime: {
    type: Number, // in days
    default: 15
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days since submission
policySchema.virtual('daysSinceSubmission').get(function() {
  const today = new Date();
  const submitted = new Date(this.createdAt);
  const diffTime = today - submitted;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Index for better query performance
claimSchema.index({ userId: 1 });
claimSchema.index({ policyId: 1 });
claimSchema.index({ claimNumber: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ claimType: 1 });
claimSchema.index({ incidentDate: 1 });

// Pre-save middleware to generate claim number
claimSchema.pre('save', async function(next) {
  if (!this.claimNumber) {
    const count = await this.constructor.countDocuments();
    this.claimNumber = `CLM${Date.now()}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to check if claim is overdue for review
claimSchema.methods.isOverdue = function() {
  if (this.status !== 'submitted' && this.status !== 'under-review') {
    return false;
  }
  
  const daysSinceSubmission = Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
  return daysSinceSubmission > this.estimatedProcessingTime;
};

// Static method to get claims statistics
claimSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$claimAmount' },
        avgAmount: { $avg: '$claimAmount' }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Claim', claimSchema);