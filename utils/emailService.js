const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email function
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  welcome: (user) => ({
    subject: 'Welcome to MetLife',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #009688;">Welcome to MetLife, ${user.firstName}!</h2>
        <p>Thank you for joining MetLife. Your account has been successfully created.</p>
        <p>You can now:</p>
        <ul>
          <li>View and manage your insurance policies</li>
          <li>File claims online</li>
          <li>Pay premiums securely</li>
          <li>Access your policy documents</li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  policyCreated: (user, policy) => ({
    subject: `New Policy Created - ${policy.policyNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #009688;">New Policy Created</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your new ${policy.policyType} insurance policy has been successfully created.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Policy Details:</h3>
          <p><strong>Policy Number:</strong> ${policy.policyNumber}</p>
          <p><strong>Policy Type:</strong> ${policy.policyType}</p>
          <p><strong>Coverage Amount:</strong> $${policy.coverageAmount.toLocaleString()}</p>
          <p><strong>Premium Amount:</strong> $${policy.premiumAmount.toLocaleString()}</p>
          <p><strong>Start Date:</strong> ${new Date(policy.startDate).toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${new Date(policy.endDate).toLocaleDateString()}</p>
        </div>
        <p>Your first premium payment is due on ${new Date(policy.startDate).toLocaleDateString()}.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  claimSubmitted: (user, claim) => ({
    subject: `Claim Submitted - ${claim.claimNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #009688;">Claim Submitted Successfully</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your claim has been successfully submitted and is now under review.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Claim Details:</h3>
          <p><strong>Claim Number:</strong> ${claim.claimNumber}</p>
          <p><strong>Claim Type:</strong> ${claim.claimType}</p>
          <p><strong>Claim Amount:</strong> $${claim.claimAmount.toLocaleString()}</p>
          <p><strong>Incident Date:</strong> ${new Date(claim.incidentDate).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${claim.status}</p>
        </div>
        <p>We will review your claim and get back to you within ${claim.estimatedProcessingTime} business days.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  claimApproved: (user, claim) => ({
    subject: `Claim Approved - ${claim.claimNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Claim Approved!</h2>
        <p>Dear ${user.firstName},</p>
        <p>Great news! Your claim has been approved.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Claim Details:</h3>
          <p><strong>Claim Number:</strong> ${claim.claimNumber}</p>
          <p><strong>Approved Amount:</strong> $${claim.approvedAmount.toLocaleString()}</p>
          <p><strong>Review Date:</strong> ${new Date(claim.reviewDate).toLocaleDateString()}</p>
        </div>
        <p>The payment will be processed within 3-5 business days.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  claimRejected: (user, claim) => ({
    subject: `Claim Update - ${claim.claimNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Claim Update</h2>
        <p>Dear ${user.firstName},</p>
        <p>We have completed the review of your claim ${claim.claimNumber}.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Claim Details:</h3>
          <p><strong>Claim Number:</strong> ${claim.claimNumber}</p>
          <p><strong>Status:</strong> ${claim.status}</p>
          <p><strong>Reason:</strong> ${claim.rejectionReason}</p>
          <p><strong>Review Date:</strong> ${new Date(claim.reviewDate).toLocaleDateString()}</p>
        </div>
        <p>If you have any questions about this decision, please contact our support team.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  premiumReminder: (user, premium) => ({
    subject: `Premium Payment Reminder - Due ${new Date(premium.dueDate).toLocaleDateString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9800;">Premium Payment Reminder</h2>
        <p>Dear ${user.firstName},</p>
        <p>This is a friendly reminder that your premium payment is due soon.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Payment Details:</h3>
          <p><strong>Policy Number:</strong> ${premium.policyId.policyNumber}</p>
          <p><strong>Amount Due:</strong> $${premium.finalAmount.toLocaleString()}</p>
          <p><strong>Due Date:</strong> ${new Date(premium.dueDate).toLocaleDateString()}</p>
        </div>
        <p>Please make your payment before the due date to avoid any late fees.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  premiumOverdue: (user, premium) => ({
    subject: `Overdue Premium Payment - ${premium.policyId.policyNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Overdue Premium Payment</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your premium payment is now overdue. Please make the payment immediately to avoid policy cancellation.</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Payment Details:</h3>
          <p><strong>Policy Number:</strong> ${premium.policyId.policyNumber}</p>
          <p><strong>Amount Due:</strong> $${premium.finalAmount.toLocaleString()}</p>
          <p><strong>Due Date:</strong> ${new Date(premium.dueDate).toLocaleDateString()}</p>
          <p><strong>Late Fee:</strong> $${premium.lateFee.toLocaleString()}</p>
          <p><strong>Days Overdue:</strong> ${premium.daysOverdue}</p>
        </div>
        <p>Please contact us immediately if you need assistance with your payment.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  }),

  passwordReset: (user, resetToken) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #009688;">Password Reset Request</h2>
        <p>Dear ${user.firstName},</p>
        <p>You have requested to reset your password. Click the link below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}" 
             style="background-color: #009688; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 10 minutes for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The MetLife Team</p>
      </div>
    `
  })
};

// Send specific email types
const sendWelcomeEmail = async (user) => {
  const template = emailTemplates.welcome(user);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendPolicyCreatedEmail = async (user, policy) => {
  const template = emailTemplates.policyCreated(user, policy);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendClaimSubmittedEmail = async (user, claim) => {
  const template = emailTemplates.claimSubmitted(user, claim);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendClaimApprovedEmail = async (user, claim) => {
  const template = emailTemplates.claimApproved(user, claim);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendClaimRejectedEmail = async (user, claim) => {
  const template = emailTemplates.claimRejected(user, claim);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendPremiumReminderEmail = async (user, premium) => {
  const template = emailTemplates.premiumReminder(user, premium);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendPremiumOverdueEmail = async (user, premium) => {
  const template = emailTemplates.premiumOverdue(user, premium);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const template = emailTemplates.passwordReset(user, resetToken);
  return await sendEmail({
    to: user.email,
    ...template
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPolicyCreatedEmail,
  sendClaimSubmittedEmail,
  sendClaimApprovedEmail,
  sendClaimRejectedEmail,
  sendPremiumReminderEmail,
  sendPremiumOverdueEmail,
  sendPasswordResetEmail
};