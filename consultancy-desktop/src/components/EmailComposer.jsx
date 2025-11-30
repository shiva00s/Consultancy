import React, { useState, useEffect } from 'react';
import { FiSend, FiPaperclip, FiX, FiMail, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { emailService } from '../services/emailService';
import { LoadingSpinner } from './LoadingSpinner';
import { useFormValidation } from '../hooks/useFormValidation';
import { z } from 'zod';
import '../css/EmailComposer.css';

const emailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  body: z.string().min(1, 'Email body is required'),
});

function EmailComposer({ 
  candidateId, 
  candidateEmail, 
  candidateName,
  onClose,
  onSent 
}) {
  const { errors, validate, clearErrors } = useFormValidation(emailSchema);
  
  const [formData, setFormData] = useState({
    to: candidateEmail || '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
  });
  
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const result = await window.electronAPI.getEmailTemplates();
      if (result.success) {
        setTemplates(result.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearErrors();
  };

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);

    if (templateId) {
      const template = emailService.getTemplate(templateId);
      if (template) {
        const parsed = emailService.parseTemplate(template, {
          candidateName: candidateName || 'Candidate',
          companyName: 'Your Company Name',
          date: new Date().toLocaleDateString(),
        });

        setFormData(prev => ({
          ...prev,
          subject: parsed.subject,
          body: parsed.body,
        }));
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      // Max 5MB per file
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setIsSending(true);

    // Validate form
    const validation = await validate(formData);
    if (!validation.isValid) {
      toast.error('Please fix validation errors');
      setIsSending(false);
      return;
    }

    try {
      const result = await emailService.sendEmail({
        ...formData,
        candidateId,
        attachments: attachments.map(file => ({
          filename: file.name,
          path: file.path,
        })),
      });

      if (result.success) {
        toast.success('Email sent successfully!');
        if (onSent) onSent();
        if (onClose) onClose();
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Send email error:', error);
      toast.error('An error occurred while sending email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-composer-overlay">
      <div className="email-composer">
        <div className="composer-header">
          <div className="header-title">
            <FiMail />
            <h3>New Email</h3>
          </div>
          <button 
            className="btn-close"
            onClick={onClose}
            disabled={isSending}
            aria-label="Close composer"
          >
            <FiX />
          </button>
        </div>

        <div className="composer-body">
          {/* Template Selector */}
          <div className="form-group">
            <label htmlFor="template-select">
              Use Template (Optional)
            </label>
            <select
              id="template-select"
              value={selectedTemplate}
              onChange={handleTemplateSelect}
              disabled={isSending}
            >
              <option value="">-- Select Template --</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Field */}
          <div className={`form-group ${errors.to ? 'error' : ''}`}>
            <label htmlFor="email-to">To *</label>
            <input
              type="email"
              id="email-to"
              name="to"
              value={formData.to}
              onChange={handleChange}
              disabled={isSending}
              required
              placeholder="recipient@example.com"
            />
            {errors.to && <span className="error-text">{errors.to}</span>}
          </div>

          {/* CC/BCC Toggle */}
          {!showCcBcc && (
            <button
              type="button"
              className="btn-text"
              onClick={() => setShowCcBcc(true)}
              disabled={isSending}
            >
              Add Cc/Bcc
            </button>
          )}

          {/* CC Field */}
          {showCcBcc && (
            <div className="form-group">
              <label htmlFor="email-cc">Cc</label>
              <input
                type="email"
                id="email-cc"
                name="cc"
                value={formData.cc}
                onChange={handleChange}
                disabled={isSending}
                placeholder="cc@example.com"
              />
            </div>
          )}

          {/* BCC Field */}
          {showCcBcc && (
            <div className="form-group">
              <label htmlFor="email-bcc">Bcc</label>
              <input
                type="email"
                id="email-bcc"
                name="bcc"
                value={formData.bcc}
                onChange={handleChange}
                disabled={isSending}
                placeholder="bcc@example.com"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className={`form-group ${errors.subject ? 'error' : ''}`}>
            <label htmlFor="email-subject">Subject *</label>
            <input
              type="text"
              id="email-subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              disabled={isSending}
              required
              maxLength={200}
              placeholder="Email subject"
            />
            {errors.subject && <span className="error-text">{errors.subject}</span>}
          </div>

          {/* Body Field */}
          <div className={`form-group ${errors.body ? 'error' : ''}`}>
            <label htmlFor="email-body">Message *</label>
            <textarea
              id="email-body"
              name="body"
              value={formData.body}
              onChange={handleChange}
              disabled={isSending}
              required
              rows={12}
              placeholder="Write your email message here..."
            />
            {errors.body && <span className="error-text">{errors.body}</span>}
          </div>

          {/* Attachments */}
          <div className="attachments-section">
            <div className="attachments-header">
              <label>Attachments</label>
              <label className="btn-attach" htmlFor="file-input">
                <FiPaperclip />
                Add Attachment
              </label>
              <input
                type="file"
                id="file-input"
                onChange={handleFileSelect}
                disabled={isSending}
                multiple
                hidden
              />
            </div>

            {attachments.length > 0 && (
              <div className="attachments-list">
                {attachments.map((file, index) => (
                  <div key={index} className="attachment-item">
                    <FiPaperclip />
                    <span>{file.name}</span>
                    <span className="file-size">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      disabled={isSending}
                      className="btn-remove"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="composer-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={isSending || !formData.to || !formData.subject || !formData.body}
          >
            {isSending ? (
              <>
                <LoadingSpinner size="small" />
                Sending...
              </>
            ) : (
              <>
                <FiSend />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailComposer;
    