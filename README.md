# MetLife Backend - Healthcare Management System

A comprehensive Node.js/Express.js backend system for managing healthcare insurance policies, claims, premiums, and user accounts.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (User, Agent, Admin)
  - Password reset functionality
  - Account lockout protection

- **Policy Management**
  - Create, read, update, delete policies
  - Multiple policy types (Life, Health, Auto, Home, Travel)
  - Policy renewal and cancellation
  - Beneficiary management

- **Claims Processing**
  - Submit and track claims
  - Document upload support
  - Claim review and approval workflow
  - Automated status notifications

- **Premium Management**
  - Automated premium calculation
  - Payment tracking and reminders
  - Overdue premium handling
  - Multiple payment methods

- **Admin Dashboard**
  - Comprehensive analytics and reports
  - User management
  - Policy and claim statistics
  - Revenue tracking

### Technical Features
- **Payment Integration**
  - Razorpay integration
  - Stripe integration
  - Webhook handling for payment confirmations

- **Email Notifications**
  - Welcome emails
  - Policy creation notifications
  - Claim status updates
  - Premium reminders

- **Security & Validation**
  - Input validation and sanitization
  - Rate limiting
  - CORS protection
  - Helmet security headers

- **Documentation**
  - Swagger/OpenAPI documentation
  - Comprehensive API documentation

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd metlife-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/metlife
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   
   # Payment Gateways
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   STRIPE_SECRET_KEY=your_stripe_secret_key
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB service
   # Then seed the database with sample data
   npm run seed
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`

## 🔐 Authentication

### Sample Login Credentials (after seeding)

**Regular User:**
- Email: `john.doe@example.com`
- Password: `Password123!`

**Agent:**
- Email: `mike.johnson@metlife.com`
- Password: `Password123!`

**Admin:**
- Email: `admin@metlife.com`
- Password: `Admin123!`

## 📁 Project Structure

```
metlife-backend/
├── config/
│   ├── database.js          # Database configuration
│   └── swagger.js           # Swagger documentation setup
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── validation.js        # Input validation
│   ├── errorHandler.js      # Global error handling
│   └── logger.js            # Request logging
├── models/
│   ├── User.js              # User model
│   ├── Policy.js            # Policy model
│   ├── Claim.js             # Claim model
│   └── Premium.js           # Premium model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── policies.js          # Policy management routes
│   ├── claims.js            # Claim management routes
│   ├── premiums.js          # Premium management routes
│   ├── admin.js             # Admin dashboard routes
│   └── payments.js          # Payment processing routes
├── utils/
│   └── emailService.js      # Email service utilities
├── scripts/
│   └── seedDatabase.js      # Database seeding script
├── logs/                    # Application logs
├── .env.example             # Environment variables template
├── server.js                # Main application file
└── package.json             # Dependencies and scripts
```

## 🔧 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user profile
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password

### Users
- `GET /api/v1/users` - Get all users (Admin only)
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user profile
- `GET /api/v1/users/:id/dashboard` - Get user dashboard data

### Policies
- `GET /api/v1/policies` - Get policies
- `POST /api/v1/policies` - Create new policy
- `GET /api/v1/policies/:id` - Get policy by ID
- `PUT /api/v1/policies/:id` - Update policy
- `PATCH /api/v1/policies/:id/cancel` - Cancel policy
- `PATCH /api/v1/policies/:id/renew` - Renew policy

### Claims
- `GET /api/v1/claims` - Get claims
- `POST /api/v1/claims` - Submit new claim
- `GET /api/v1/claims/:id` - Get claim by ID
- `PATCH /api/v1/claims/:id/review` - Review claim (Admin/Agent)
- `PATCH /api/v1/claims/:id/pay` - Mark claim as paid (Admin)

### Premiums
- `GET /api/v1/premiums` - Get premiums
- `POST /api/v1/premiums` - Create premium (Admin/Agent)
- `GET /api/v1/premiums/:id` - Get premium by ID
- `PATCH /api/v1/premiums/:id/pay` - Pay premium
- `GET /api/v1/premiums/overdue` - Get overdue premiums
- `GET /api/v1/premiums/upcoming` - Get upcoming premiums

### Payments
- `POST /api/v1/payments/razorpay/create-order` - Create Razorpay order
- `POST /api/v1/payments/razorpay/verify` - Verify Razorpay payment
- `POST /api/v1/payments/stripe/create-intent` - Create Stripe payment intent
- `POST /api/v1/payments/stripe/confirm` - Confirm Stripe payment
- `GET /api/v1/payments/history` - Get payment history

### Admin
- `GET /api/v1/admin/dashboard` - Get admin dashboard statistics
- `GET /api/v1/admin/users` - Get users with advanced filtering
- `GET /api/v1/admin/reports/policies` - Get policy reports
- `GET /api/v1/admin/reports/claims` - Get claim reports
- `GET /api/v1/admin/reports/revenue` - Get revenue reports

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring & Logging

- Application logs are stored in the `logs/` directory
- Logs are automatically rotated daily
- Old logs are cleaned up after 30 days
- Request/response logging with performance metrics

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS protection
- Helmet security headers
- Account lockout after failed login attempts

## 🚀 Deployment

### Environment Variables for Production

Make sure to set these environment variables in your production environment:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_production_jwt_secret
# ... other production configurations
```

### Deployment Platforms

This backend is ready to deploy on:
- **Heroku**
- **Render**
- **Railway**
- **DigitalOcean App Platform**
- **AWS Elastic Beanstalk**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Email: support@metlife.com
- Documentation: [API Docs](http://localhost:5000/api-docs)

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
  - User authentication and authorization
  - Policy, claim, and premium management
  - Payment integration
  - Admin dashboard
  - Email notifications
  - Comprehensive API documentation