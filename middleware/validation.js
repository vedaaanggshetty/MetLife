const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// User validation rules
const validateUserRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom(value => {
      if (new Date(value) >= new Date()) {
        throw new Error('Date of birth must be in the past');
      }
      return true;
    }),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateUserUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  
  handleValidationErrors
];

// Policy validation rules
const validatePolicy = [
  body('policyType')
    .isIn(['life', 'health', 'auto', 'home', 'travel'])
    .withMessage('Policy type must be one of: life, health, auto, home, travel'),
  
  body('coverageAmount')
    .isNumeric()
    .withMessage('Coverage amount must be a number')
    .custom(value => {
      if (value <= 0) {
        throw new Error('Coverage amount must be positive');
      }
      return true;
    }),
  
  body('premiumAmount')
    .isNumeric()
    .withMessage('Premium amount must be a number')
    .custom(value => {
      if (value <= 0) {
        throw new Error('Premium amount must be positive');
      }
      return true;
    }),
  
  body('premiumFrequency')
    .optional()
    .isIn(['monthly', 'quarterly', 'semi-annual', 'annual'])
    .withMessage('Premium frequency must be one of: monthly, quarterly, semi-annual, annual'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  
  body('endDate')
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('beneficiaries')
    .optional()
    .isArray()
    .withMessage('Beneficiaries must be an array'),
  
  body('beneficiaries.*.name')
    .if(body('beneficiaries').exists())
    .notEmpty()
    .withMessage('Beneficiary name is required'),
  
  body('beneficiaries.*.relationship')
    .if(body('beneficiaries').exists())
    .notEmpty()
    .withMessage('Beneficiary relationship is required'),
  
  body('beneficiaries.*.percentage')
    .if(body('beneficiaries').exists())
    .isNumeric()
    .withMessage('Beneficiary percentage must be a number')
    .custom(value => {
      if (value < 0 || value > 100) {
        throw new Error('Beneficiary percentage must be between 0 and 100');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Claim validation rules
const validateClaim = [
  body('policyId')
    .isMongoId()
    .withMessage('Please provide a valid policy ID'),
  
  body('claimType')
    .isIn(['medical', 'accident', 'death', 'disability', 'property'])
    .withMessage('Claim type must be one of: medical, accident, death, disability, property'),
  
  body('claimAmount')
    .isNumeric()
    .withMessage('Claim amount must be a number')
    .custom(value => {
      if (value <= 0) {
        throw new Error('Claim amount must be positive');
      }
      return true;
    }),
  
  body('incidentDate')
    .isISO8601()
    .withMessage('Please provide a valid incident date')
    .custom(value => {
      if (new Date(value) > new Date()) {
        throw new Error('Incident date cannot be in the future');
      }
      return true;
    }),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  handleValidationErrors
];

// Premium validation rules
const validatePremium = [
  body('policyId')
    .isMongoId()
    .withMessage('Please provide a valid policy ID'),
  
  body('amount')
    .isNumeric()
    .withMessage('Premium amount must be a number')
    .custom(value => {
      if (value <= 0) {
        throw new Error('Premium amount must be positive');
      }
      return true;
    }),
  
  body('dueDate')
    .isISO8601()
    .withMessage('Please provide a valid due date'),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Please provide a valid ${paramName}`),
  
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePolicy,
  validateClaim,
  validatePremium,
  validateObjectId,
  validatePagination
};