const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
  }

  /**
   * Initialize email service with SMTP configuration
   */
  async initialize(config) {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: config.secure || false,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  /**
   * Load email template from file
   */
  async loadTemplate(templateName) {
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName);
    }

    const templatePath = path.join(__dirname, '../templates', `${templateName}.ejs`);
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      this.templates.set(templateName, templateContent);
      return templateContent;
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  /**
   * Render email template with data
   */
  async renderTemplate(templateName, data) {
    const template = await this.loadTemplate(templateName);
    
    // Default company data (can be overridden)
    const defaultData = {
      companyName: 'Consultancy Pro',
      companyTagline: 'Your Career Partner',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      recipientEmail: data.recipientEmail || data.candidateEmail,
    };

    const templateData = { ...defaultData, ...data };
    
    // Render the email body
    const body = ejs.render(template, templateData);
    
    // Load base template
    const baseTemplate = await this.loadTemplate('email-base');
    
    // Render complete email
    return ejs.render(baseTemplate, {
      ...templateData,
      body,
    });
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(options) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    const { to, subject, templateName, data, attachments } = options;

    try {
      // Render email HTML
      const html = await this.renderTemplate(templateName, {
        ...data,
        subject,
        recipientEmail: to,
      });

      // Send email
      const info = await this.transporter.sendMail({
        from: data.fromEmail || process.env.EMAIL_FROM || '"Consultancy Pro" <noreply@consultancy.com>',
        to,
        subject,
        html,
        attachments,
      });

      console.log('Email sent successfully:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new candidate
   */
  async sendCandidateWelcome(candidateData) {
    return this.sendTemplateEmail({
      to: candidateData.email,
      subject: `Welcome to ${candidateData.companyName || 'Consultancy Pro'}!`,
      templateName: 'email-candidate-welcome',
      data: {
        candidateName: candidateData.name,
        candidateEmail: candidateData.email,
        candidatePhone: candidateData.phone,
        candidatePosition: candidateData.position,
        portalLink: candidateData.portalLink || '#',
        companyName: candidateData.companyName,
      },
    });
  }

  /**
   * Send job match notification
   */
  async sendJobMatch(matchData) {
    return this.sendTemplateEmail({
      to: matchData.candidateEmail,
      subject: `New Job Opportunity: ${matchData.jobTitle}`,
      templateName: 'email-job-match',
      data: matchData,
    });
  }

  /**
   * Send interview scheduled notification
   */
  async sendInterviewScheduled(interviewData) {
    return this.sendTemplateEmail({
      to: interviewData.candidateEmail,
      subject: `Interview Scheduled: ${interviewData.jobTitle} at ${interviewData.employerName}`,
      templateName: 'email-interview-scheduled',
      data: interviewData,
    });
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(options) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    return await this.transporter.sendMail(options);
  }
}

/**
 * ✅ FIXED: Send Activation Email (Standalone Function)
 * This function works independently of the EmailService class
 */
async function sendActivationEmail({ to, machineId, activationCode, expiresIn }) {
  // ✅ FIX: Use getDb() function to get database instance
  const { getDb } = require('../db/database.cjs');
  const db = getDb();

  // Get SMTP settings
  const smtpSettings = db.prepare('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1').get();

  if (!smtpSettings || !smtpSettings.is_configured) {
    throw new Error('SMTP is not configured');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpSettings.host,
    port: smtpSettings.port,
    secure: smtpSettings.port === 465,
    auth: {
      user: smtpSettings.user,
      pass: smtpSettings.pass,
    },
  });

  const mailOptions = {
    from: smtpSettings.from_email || smtpSettings.user,
    to: to,
    subject: 'Consultancy App - Activation Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; }
          .code-box { background: white; border: 2px dashed #6366f1; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .code { font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
          .warning { color: #dc2626; font-weight: bold; background: #fee2e2; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔐 Consultancy App Activation</h1>
          </div>
          <div class="content">
            <h2 style="color: #1f2937;">Your Activation Code</h2>
            <p>You have requested an activation code for the <strong>Consultancy Desktop Application</strong>.</p>
            
            <div class="code-box">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">ACTIVATION CODE</p>
              <div class="code">${activationCode}</div>
            </div>
            
            <div class="info-box">
              <p style="margin: 5px 0;"><strong>Machine ID:</strong> <code>${machineId}</code></p>
              <p style="margin: 5px 0;"><strong>Valid for:</strong> ${expiresIn}</p>
            </div>
            
            <div class="warning">
              ⚠️ Do not share this code with anyone. This is a security-sensitive operation.
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">If you did not request this code, please contact support immediately at <strong>+91 9629 881 598</strong>.</p>
          </div>
          <div class="footer">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Consultancy App. All rights reserved.</p>
            <p style="margin: 5px 0;">📞 Support: +91 9629 881 598 | 📧 prakashshiva368@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// Singleton instance
const emailService = new EmailService();

module.exports = {
  sendActivationEmail,
  emailService,
  EmailService
};
