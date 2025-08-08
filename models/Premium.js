const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Premium:
 *       type: object
 *       required:
 *         - policyId
 *         - userId
 *         - amount
 *         - dueDate
 *       properties:
 *         policyId:
 *           type: string
 *           description: Reference to the policy
 *         userId:
 *           type: string
 *           description: Reference to the user
 *         amount:
 *           type: number
 *           description: Premium amount
 *         dueDate:
 *           type: string
 *           format: date
 *           description: Premium due date
 *         paidDate:
 *           type: string
 *           format: date
 *           description: Date when premium was paid
 *         status:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled]
 *           description: Premium payment status
 */

const premiumSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: [true, 'Premium amount is required'],
    min: [0, 'Premium amount must be positive']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paidDate: Date,
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit-card', 'debit-card', 'bank-transfer', 'upi', 'cash']
  },
  transactionId: String,
  paymentReference: String,
  lateFee: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: Number, // amount + lateFee - discount
  notes: String,
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days overdue
premiumSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'paid' || this.status === 'cancelled') return 0;
  
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = today - due;
  const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return daysDiff > 0 ? daysDiff : 0;
});

// Index for better query performance
premiumSchema.index({ userId: 1 });
premiumSchema.index({ policyId: 1 });
premiumSchema.index({ status: 1 });
premiumSchema.index({ dueDate: 1 });

// Pre-save middleware to calculate final amount
premiumSchema.pre('save', function(next) {
  this.finalAmount = this.amount + (this.lateFee || 0) - (this.discount || 0);
  next();
});

// Method to mark as overdue
premiumSchema.methods.markOverdue = function() {
  if (this.status === 'pending' && new Date() > this.dueDate) {
    this.status = 'overdue';
    
    // Calculate late fee (2% of premium amount)
    this.lateFee = this.amount * 0.02;
    
    return this.save();
  }
};

// Method to process payment
premiumSchema.methods.processPayment = function(paymentData) {
  this.status = 'paid';
  this.paidDate = new Date();
  this.paymentMethod = paymentData.method;
  this.transactionId = paymentData.transactionId;
  this.paymentReference = paymentData.reference;
  
  return this.save();
};

// Static method to get overdue premiums
premiumSchema.statics.getOverduePremiums = function() {
  return this.find({
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $lt: new Date() }
  }).populate('userId policyId');
};

// Static method to get premium statistics
premiumSchema.statics.getStatistics = async function(userId = null) {
  const matchStage = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$finalAmount' },
        avgAmount: { $avg: '$finalAmount' }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Premium', premiumSchema);