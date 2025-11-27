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
      this.transporter = nodemailer.createTransporter({
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

// Singleton instance
const emailService = new EmailService();

module.exports = { emailService, EmailService };
