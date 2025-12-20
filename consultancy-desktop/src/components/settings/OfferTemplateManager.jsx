import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiFileText,
  FiSave,
  FiAlertTriangle,
  FiRefreshCw,
  FiRotateCcw,FiAlertCircle ,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import ConfirmDialog from '../common/ConfirmDialog';
import '../../css/OfferTemplateManager.css';

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Offer Letter</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            color: #333;
        }
        .container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #0056b3;
            margin: 0;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            border: 1px solid #ddd;
        }
        .details-table th,
        .details-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .details-table th {
            background-color: #f9f9f9;
            width: 30%;
        }
        strong {
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            font-size: 0.9em;
        }
        .signature-line {
            margin-top: 60px;
            border-top: 1px solid #555;
            width: 300px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OFFER OF EMPLOYMENT</h1>
            <p><strong>Date:</strong> <%= currentDate %></p>
        </div>

        <p>Dear <strong><%= candidateName %></strong>,</p>

        <p>Following our recent discussions, we are pleased to offer you the position of <strong><%= positionTitle %></strong> with our client, <strong><%= companyName %></strong>. This position is based in <strong><%= employerCountry %></strong>.</p>

        <p>This offer is contingent upon the successful completion of all pre-employment checks and processing.</p>

        <h3>Key Terms of Offer</h3>
        <table class="details-table">
            <tr>
                <th>Candidate Name</th>
                <td><%= candidateName %></td>
            </tr>
            <tr>
                <th>Passport No.</th>
                <td><%= passportNo %></td>
            </tr>
            <tr>
                <th>Position</th>
                <td><%= positionTitle %></td>
            </tr>
            <tr>
                <th>Employer</th>
                <td><%= companyName %></td>
            </tr>
            <tr>
                <th>Work Location</th>
                <td><%= employerCountry %></td>
            </tr>
            <tr>
                <th>Monthly Salary</th>
                <td><%= monthlySalary %></td>
            </tr>
            <tr>
                <th>Expected Joining Date</th>
                <td><%= joiningDate %></td>
            </tr>
        </table>

        <p>Please review this offer carefully. To accept, please sign and return a copy of this letter by <strong><%= acceptanceDate %></strong>.</p>

        <div class="footer">
            <p>We look forward to welcoming you.</p>
            <p>Best Regards,</p>
            
            <p><%= contactPerson %><br>
            <%= companyName %></p>

            <div class="signature-line" style="margin-top: 80px;">
                <p><strong>Candidate Acceptance:</strong></p>
                <p>I, <%= candidateName %>, accept this offer of employment.</p>
                <br>
                <p>Signature: ___________________________</p>
                <p>Date: ___________________________</p>
            </div>
        </div>
    </div>
</body>
</html>`;

function OfferTemplateManager({ user }) {
  const [templateContent, setTemplateContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', title: '', message: '' });

  const loadTemplate = async () => {
    setLoading(true);
    
    try {
      // Determine current user (prop takes precedence, otherwise global store)
      const authUser = useAuthStore.getState().user;
      const currentUser = user || authUser || null;

      // Load regardless of user, as template is global
      if (!window.electronAPI || typeof window.electronAPI.readOfferTemplate !== 'function') {
        // Not running in Electron environment - fallback to default
        setTemplateContent(DEFAULT_TEMPLATE);
        setLoading(false);
        return;
      }

      const res = await window.electronAPI.readOfferTemplate({ user: currentUser });

      if (res && res.success && res.data) {
        setTemplateContent(res.data);
      } else if (res && res.error === 'Template file not found.') {
        setTemplateContent(DEFAULT_TEMPLATE);
      } else if (res && res.error) {
        if (res.error === 'AUTH_REQUIRED') {
          toast.error('Authentication required. Please log in again.');
        } else {
          toast.error(res.error || 'Failed to load template.');
        }
        setTemplateContent(DEFAULT_TEMPLATE);
      } else {
        setTemplateContent(DEFAULT_TEMPLATE);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load offer template.');
      setTemplateContent(DEFAULT_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, []);

  const handleSave = async () => {
    // Template is global; allow saving even if `user` prop is not provided. Use auth store user if needed.
    setConfirmDialog({
      isOpen: true,
      type: 'save',
      title: '💾 Save Template Changes?',
      message: 'Are you sure you want to overwrite the current offer letter template?'
    });
  };

  const handleRevert = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'revert',
      title: '🔄 Revert Changes?',
      message: 'Discard all unsaved changes and reload the saved template?'
    });
  };

  const handleRestoreDefault = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'factory',
      title: '🏭 Restore Factory Default?',
      message: 'Overwrite current template with the original factory default? This cannot be undone.'
    });
  };

  const handleConfirm = async () => {
    setConfirmDialog({ isOpen: false, type: '', title: '', message: '' });
    
    if (confirmDialog.type === 'save') {
      setSaving(true);
      try {
        const authUser = useAuthStore.getState().user;
        const currentUser = user || authUser || null;

        const res = await window.electronAPI.writeOfferTemplate({
          user: currentUser,
          content: templateContent,
        });
        
        if (res.success) {
          toast.success('✅ Template saved successfully!');
        } else {
          if (res.error === 'AUTH_REQUIRED') {
            toast.error('Authentication required. Please log in again.');
          } else {
            toast.error(res.error || 'Failed to save template.');
          }
        }
      } catch (err) {
        console.error('Save error:', err);
        toast.error('Failed to save template.');
      } finally {
        setSaving(false);
      }
    } else if (confirmDialog.type === 'revert') {
      await loadTemplate();
      toast.success('🔄 Changes reverted successfully!');
    } else if (confirmDialog.type === 'factory') {
      setTemplateContent(DEFAULT_TEMPLATE);
      toast.success('🏭 Factory default restored!');
    }
  };

  const handleCancel = () => {
    setConfirmDialog({ isOpen: false, type: '', title: '', message: '' });
  };

  if (loading) {
    return (
      <div className="template-loading">
        <div className="loading-spinner"></div>
        <p>⏳ Loading offer template...</p>
      </div>
    );
  }

  return (
    <>
      <div className="template-container">
        {/* Header */}
        <div className="template-header">
          <div className="header-content">
            <div className="header-icon">
              <FiFileText />
            </div>
            <div className="header-text">
              <h2 className="header-title">
                📝 Offer Letter Template Editor ✨
                <span className="title-badge">PRO</span>
              </h2>
              <p className="header-description">
                ✏️ Customize the EJS/HTML template below. Use placeholders like <code>&lt;%= candidateName %&gt;</code> and <code>&lt;%= monthlySalary %&gt;</code> for dynamic content. Save to update the template used for offer letters! 🚀
              </p>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="template-editor">
          <textarea
            id="templateEditor"
            value={templateContent}
            onChange={(e) => setTemplateContent(e.target.value)}
            placeholder="Enter your EJS/HTML template here... 📄"
            className="template-textarea"
          />
        </div>

        {/* Help Box */}
        <div className="template-help">
          <FiAlertCircle className="help-icon" />
          <div className="help-content">
            <strong>💡 Pro Tips:</strong>
            <ul>
              <li>Use EJS syntax for variables: <code>&lt;%= variable %&gt;</code> 📌</li>
              <li>Available variables: candidateName, passportNo, positionTitle, companyName, employerCountry, monthlySalary, joiningDate, currentDate, acceptanceDate, contactPerson 🔑</li>
              <li>Test PDF generation after changes to ensure no errors ⚠️</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="template-actions">
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <div className="btn-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> 💾 Save Changes
              </>
            )}
          </button>

          <button
            className="btn-revert"
            onClick={handleRevert}
            disabled={saving || loading}
          >
            <FiRefreshCw /> 🔄 Revert Changes
          </button>

          <button
            className="btn-factory"
            onClick={handleRestoreDefault}
            disabled={saving || loading}
          >
            <FiRotateCcw /> 🏭 Factory Default
          </button>
        </div>

        {/* Warning */}
        <div className="template-warning">
          <FiAlertTriangle className="warning-icon" />
          <div className="warning-text">
            ⚠️ <strong>Caution:</strong> Invalid EJS/HTML may break PDF generation. Always preview after edits! 🛡️
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </>
  );
}

export default OfferTemplateManager;