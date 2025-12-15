import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiFileText,
  FiSave,
  FiAlertTriangle,
  FiRefreshCw,
  FiRotateCcw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
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
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const isMountedRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  const fetchTemplate = useCallback(async () => {
    if (!user || !user.id) {
      setTemplateContent('');
      setLoading(false);
      setHasLoaded(false);
      return;
    }

    try {
      setLoading(true);
      const res = await window.electronAPI.readOfferTemplate({ user });

      if (!res || res.success === false) {
        if (res?.error === 'AUTH_REQUIRED') {
          toast.error('Session expired. Please refresh the page.');
        } else if (res?.error === 'ACCESS_DENIED') {
          toast.error('You do not have permission to edit templates.');
        } else if (res?.error === 'Template file not found.') {
          setTemplateContent(DEFAULT_TEMPLATE);
          setHasLoaded(true);
          setLoading(false);
          return;
        } else {
          toast.error(res?.error || 'Failed to load template.');
        }
        setTemplateContent('');
        setHasLoaded(false);
        setLoading(false);
        return;
      }

      if (!res.data || res.data.trim() === '') {
        setTemplateContent(DEFAULT_TEMPLATE);
      } else {
        setTemplateContent(res.data);
      }
      
      setHasLoaded(true);
    } catch (err) {
      toast.error('Failed to load template.');
      setTemplateContent('');
      setHasLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    isMountedRef.current = true;

    if (user && user.id && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      fetchTemplate();
    } else if (!user || !user.id) {
      setTemplateContent('');
      setHasLoaded(false);
      hasInitialLoadRef.current = false;
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

  const handleSave = async () => {
    if (!user || !user.id) {
      toast.error('You must be logged in to save the template.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await window.electronAPI.writeOfferTemplate({
        user,
        content: templateContent,
      });

      if (!res || res.success === false) {
        if (res?.error === 'AUTH_REQUIRED') {
          toast.error('Session expired. Please log in again.');
        } else if (res?.error === 'ACCESS_DENIED') {
          toast.error('You do not have permission to save templates.');
        } else {
          toast.error(res?.error || 'Failed to save template.');
        }
        return;
      }

      toast.success('✅ Offer Letter Template saved!');
    } catch (err) {
      toast.error('Unexpected error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    if (window.confirm('Overwrite current content with Factory Default template?')) {
      setTemplateContent(DEFAULT_TEMPLATE);
      toast.success('🔄 Factory Default Template loaded.');
    }
  };

  const handleRevert = () => {
    if (window.confirm('Discard all unsaved changes?')) {
      fetchTemplate();
    }
  };

  if (!user || !user.id) {
    return (
      <div className="template-editor-section">
        <div className="template-editor-header">
          <h2 className="template-editor-title">
            <FiFileText /> Offer Letter Template Editor
          </h2>
        </div>
        <div className="template-auth-error">
          <FiAlertTriangle size={24} />
          <p>You must be logged in to load the offer template.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="template-editor-section">
      <div className="template-editor-header">
        <h2 className="template-editor-title">
          <FiFileText /> Offer Letter Template Editor
        </h2>
        <p className="template-editor-description">
          Edit the EJS template content below. Use variables like{' '}
          <code className="variable-code">&lt;%= candidateName %&gt;</code> and{' '}
          <code className="variable-code">&lt;%= monthlySalary %&gt;</code>. 
          Saving overwrites the existing file on disk.
        </p>
      </div>

      {loading ? (
        <div className="template-loading-state">
          <div className="spinner"></div>
          <p>⏳ Loading template...</p>
        </div>
      ) : (
        <>
          <textarea
            className="template-editor-textarea"
            value={templateContent}
            onChange={(e) => setTemplateContent(e.target.value)}
            placeholder="Enter your EJS/HTML template here..."
          />

          <div className="template-editor-actions">
            <button
              className="btn btn-save"
              onClick={handleSave}
              disabled={isSaving || loading}
            >
              <FiSave /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            
            <button
              className="btn btn-secondary btn-revert"
              onClick={handleRevert}
              disabled={isSaving || loading || !hasLoaded}
            >
              <FiRefreshCw /> Revert Changes
            </button>
            
            <button
              className="btn btn-danger btn-default"
              onClick={handleRestoreDefault}
              disabled={isSaving || loading}
            >
              <FiRotateCcw /> Factory Default
            </button>
          </div>

          <div className="template-warning-message">
            <FiAlertTriangle className="warning-icon" />
            <div className="warning-text">
              <strong>WARNING:</strong> Editing raw EJS/HTML may cause PDF generation 
              errors if syntax is invalid. Always test after making changes.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OfferTemplateManager;
