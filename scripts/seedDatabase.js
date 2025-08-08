const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Premium = require('../models/Premium');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'Password123!',
    phone: '+1234567890',
    dateOfBirth: new Date('1985-06-15'),
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    },
    role: 'user',
    isActive: true,
    isEmailVerified: true
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    password: 'Password123!',
    phone: '+1234567891',
    dateOfBirth: new Date('1990-03-22'),
    address: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA'
    },
    role: 'user',
    isActive: true,
    isEmailVerified: true
  },
  {
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@metlife.com',
    password: 'Password123!',
    phone: '+1234567892',
    dateOfBirth: new Date('1982-11-08'),
    address: {
      street: '789 Pine St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA'
    },
    role: 'agent',
    isActive: true,
    isEmailVerified: true
  },
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@metlife.com',
    password: 'Admin123!',
    phone: '+1234567893',
    dateOfBirth: new Date('1980-01-01'),
    address: {
      street: '100 Admin Blvd',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    },
    role: 'admin',
    isActive: true,
    isEmailVerified: true
  }
];

const samplePolicies = [
  {
    policyType: 'life',
    coverageAmount: 500000,
    premiumAmount: 2500,
    premiumFrequency: 'annual',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2034-01-01'),
    status: 'active',
    beneficiaries: [
      {
        name: 'Jane Doe',
        relationship: 'Spouse',
        percentage: 100
      }
    ]
  },
  {
    policyType: 'health',
    coverageAmount: 100000,
    premiumAmount: 3600,
    premiumFrequency: 'annual',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    status: 'active',
    beneficiaries: []
  },
  {
    policyType: 'auto',
    coverageAmount: 50000,
    premiumAmount: 1200,
    premiumFrequency: 'annual',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    status: 'active',
    beneficiaries: []
  }
];

const sampleClaims = [
  {
    claimType: 'medical',
    claimAmount: 5000,
    incidentDate: new Date('2024-02-15'),
    description: 'Emergency room visit for chest pain. Required multiple tests and overnight observation.',
    status: 'approved',
    approvedAmount: 4500,
    documents: [
      {
        name: 'Medical Report',
        url: '/documents/medical-report-001.pdf',
        type: 'medical-report'
      },
      {
        name: 'Hospital Bill',
        url: '/documents/hospital-bill-001.pdf',
        type: 'receipt'
      }
    ]
  },
  {
    claimType: 'accident',
    claimAmount: 15000,
    incidentDate: new Date('2024-03-10'),
    description: 'Car accident resulting in vehicle damage and minor injuries.',
    status: 'under-review',
    documents: [
      {
        name: 'Police Report',
        url: '/documents/police-report-001.pdf',
        type: 'police-report'
      },
      {
        name: 'Accident Photos',
        url: '/documents/accident-photos-001.pdf',
        type: 'photo'
      }
    ]
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Policy.deleteMany({});
    await Claim.deleteMany({});
    await Premium.deleteMany({});
    
    console.log('Cleared existing data');

    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`Created ${users.length} users`);

    // Create policies
    const policies = [];
    for (let i = 0; i < samplePolicies.length; i++) {
      const policyData = {
        ...samplePolicies[i],
        userId: users[i % 2]._id, // Assign to first two users
        agentId: users[2]._id // Assign to agent
      };
      
      const policy = new Policy(policyData);
      await policy.save();
      policies.push(policy);
    }
    console.log(`Created ${policies.length} policies`);

    // Create claims
    const claims = [];
    for (let i = 0; i < sampleClaims.length; i++) {
      const claimData = {
        ...sampleClaims[i],
        policyId: policies[i]._id,
        userId: policies[i].userId,
        reviewedBy: users[3]._id // Reviewed by admin
      };
      
      if (claimData.status === 'approved') {
        claimData.reviewDate = new Date();
        claimData.reviewNotes = 'Claim approved after thorough review of documentation.';
      }
      
      const claim = new Claim(claimData);
      await claim.save();
      claims.push(claim);
    }
    console.log(`Created ${claims.length} claims`);

    // Create premiums
    const premiums = [];
    for (const policy of policies) {
      // Create current year premiums
      const currentYear = new Date().getFullYear();
      const premiumsPerYear = policy.premiumFrequency === 'monthly' ? 12 : 
                             policy.premiumFrequency === 'quarterly' ? 4 :
                             policy.premiumFrequency === 'semi-annual' ? 2 : 1;
      
      for (let i = 0; i < premiumsPerYear; i++) {
        const dueDate = new Date(currentYear, i * (12 / premiumsPerYear), 1);
        const premium = new Premium({
          policyId: policy._id,
          userId: policy.userId,
          amount: policy.premiumAmount / premiumsPerYear,
          dueDate: dueDate,
          status: i < 2 ? 'paid' : 'pending', // First 2 premiums are paid
          paidDate: i < 2 ? new Date(dueDate.getTime() - 5 * 24 * 60 * 60 * 1000) : null, // Paid 5 days before due
          paymentMethod: i < 2 ? 'credit-card' : null,
          transactionId: i < 2 ? `txn_${Date.now()}_${i}` : null
        });
        
        await premium.save();
        premiums.push(premium);
      }
    }
    console.log(`Created ${premiums.length} premiums`);

    // Update policies with premium tracking
    for (const policy of policies) {
      const paidPremiums = await Premium.find({ 
        policyId: policy._id, 
        status: 'paid' 
      });
      
      policy.totalPremiumsPaid = paidPremiums.reduce((sum, p) => sum + p.finalAmount, 0);
      policy.lastPremiumPaid = paidPremiums.length > 0 ? 
        paidPremiums[paidPremiums.length - 1].paidDate : null;
      policy.nextPremiumDue = policy.calculateNextPremiumDue();
      
      await policy.save();
    }

    console.log('Database seeding completed successfully!');
    console.log('\nSample login credentials:');
    console.log('User: john.doe@example.com / Password123!');
    console.log('Agent: mike.johnson@metlife.com / Password123!');
    console.log('Admin: admin@metlife.com / Admin123!');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeding
connectDB().then(() => {
  seedDatabase();
});