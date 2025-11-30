import { sanitizeHTML, sanitizeText } from '../utils/sanitize';

class EmailService {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  /**
   * Load email templates
   */
  async loadTemplates() {
    try {
      const result = await window.electronAPI.getEmailTemplates();
      if (result.success) {
        result.templates.forEach(template => {
          this.templates.set(template.id, template);
        });
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  /**
   * Send email to candidate
   */
  async sendEmail(options) {
    try {
      const sanitizedOptions = {
        to: sanitizeText(options.to),
        cc: options.cc ? sanitizeText(options.cc) : undefined,
        bcc: options.bcc ? sanitizeText(options.bcc) : undefined,
        subject: sanitizeText(options.subject),
        body: sanitizeHTML(options.body),
        attachments: options.attachments || [],
        candidateId: options.candidateId,
        templateId: options.templateId,
      };

      const result = await window.electronAPI.sendEmail(sanitizedOptions);
      
      if (result.success) {
        // Log email activity
        await this.logEmailActivity({
          candidateId: options.candidateId,
          subject: options.subject,
          sentAt: new Date().toISOString(),
        });
      }

      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmail(candidateIds, emailOptions) {
    const results = {
      total: candidateIds.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const candidateId of candidateIds) {
      try {
        await this.sendEmail({
          ...emailOptions,
          candidateId,
        });
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          candidateId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get email template
   */
  getTemplate(templateId) {
    return this.templates.get(templateId);
  }

  /**
   * Replace template variables
   */
  parseTemplate(template, variables) {
    let content = template.body;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, sanitizeText(value));
    });

    return {
      subject: template.subject,
      body: content,
    };
  }

  /**
   * Log email activity
   */
  async logEmailActivity(activity) {
    try {
      await window.electronAPI.logEmailActivity(activity);
    } catch (error) {
      console.error('Error logging email activity:', error);
    }
  }

  /**
   * Get email history for candidate
   */
  async getEmailHistory(candidateId) {
    try {
      const result = await window.electronAPI.getEmailHistory({ candidateId });
      return result.success ? result.emails : [];
    } catch (error) {
      console.error('Error fetching email history:', error);
      return [];
    }
  }

  /**
   * Configure email settings
   */
  async configureEmailSettings(settings) {
    try {
      const result = await window.electronAPI.configureEmailSettings({
        smtpHost: sanitizeText(settings.smtpHost),
        smtpPort: parseInt(settings.smtpPort),
        smtpSecure: settings.smtpSecure,
        smtpUser: sanitizeText(settings.smtpUser),
        smtpPassword: settings.smtpPassword, // Don't sanitize password
        fromEmail: sanitizeText(settings.fromEmail),
        fromName: sanitizeText(settings.fromName),
      });

      return result;
    } catch (error) {
      console.error('Error configuring email settings:', error);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConnection() {
    try {
      const result = await window.electronAPI.testEmailConnection();
      return result;
    } catch (error) {
      console.error('Error testing email connection:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
