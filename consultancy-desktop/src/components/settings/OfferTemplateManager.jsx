import React, { useState, useEffect, useRef } from 'react';
import {
  FiFileText,
  FiSave,
  FiAlertTriangle,
  FiRefreshCw,
  FiRotateCcw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// --- FACTORY DEFAULT TEMPLATE ---
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
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const didMountRef = useRef(false);

  const fetchTemplate = async () => {
    if (!user) {
      setLoading(false);
      toast.error('You must be logged in to load the offer template.');
      setTemplateContent('');
      return;
    }

    try {
      setLoading(true);
      const res = await window.electronAPI.readOfferTemplate({ user });

      if (!res || res.success === false) {
        if (res?.error === 'AUTH_REQUIRED') {
          toast.error('You must be logged in to load the offer template.');
          setTemplateContent('');
          return;
        }
        if (res?.error === 'ACCESS_DENIED') {
          toast.error('You do not have permission to edit offer templates.');
          setTemplateContent('');
          return;
        }
        toast.error(res?.error || 'Failed to read template file.');
        setTemplateContent('');
        return;
      }

      if (!res.data || res.data.trim() === '') {
        setTemplateContent(DEFAULT_TEMPLATE);
        toast('Loaded default template (file was empty).', { icon: 'ℹ️' });
      } else {
        setTemplateContent(res.data);
        toast.success('Template loaded successfully.');
      }
    } catch (err) {
      console.error('readOfferTemplate failed', err);
      toast.error('Unexpected error while reading template.');
      setTemplateContent('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!didMountRef.current && user) {
      didMountRef.current = true;
      fetchTemplate();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      toast.error('You must be logged in to save the offer template.');
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
          toast.error('Login required to save offer template.');
        } else if (res?.error === 'ACCESS_DENIED') {
          toast.error('You are not allowed to modify offer templates.');
        } else {
          toast.error(res?.error || 'Failed to save template file.');
        }
      } else {
        toast.success('Offer Letter Template saved!');
      }
    } catch (err) {
      console.error('writeOfferTemplate failed', err);
      toast.error('Unexpected error while saving template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    if (
      window.confirm(
        'Are you sure you want to overwrite the current editor content with the Factory Default template?'
      )
    ) {
      setTemplateContent(DEFAULT_TEMPLATE);
      toast.success('Restored Factory Default Template.');
    }
  };

  const handleRevert = () => {
    fetchTemplate();
  };

  return (
    <div
      className="settings-section-card"
      style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}
    >
      <h2>
        <FiFileText /> Offer Letter Template Editor
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        Edit the EJS template content below. Use variables like{' '}
        <code>&lt;%= candidateName %&gt;</code> and{' '}
        <code>&lt;%= monthlySalary %&gt;</code>. Saving overwrites the existing
        file on disk.
      </p>

      {loading ? (
        <p>Loading template...</p>
      ) : (
        <>
          <textarea
            value={templateContent}
            onChange={(e) => setTemplateContent(e.target.value)}
            rows="20"
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              marginBottom: '1rem',
              padding: '10px',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              outline: 'none',
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '15px',
              marginTop: '1.5rem',
            }}
          >
            <button
              className="btn"
              onClick={handleSave}
              disabled={isSaving || loading}
            >
              <FiSave /> Save Changes
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRevert}
              disabled={isSaving || loading}
            >
              <FiRefreshCw /> Revert Changes
            </button>
            <button
              className="btn btn-danger"
              onClick={handleRestoreDefault}
              disabled={isSaving || loading}
            >
              <FiRotateCcw /> Factory Default
            </button>
          </div>

          <p
            className="form-message error"
            style={{ marginTop: '1.5rem' }}
          >
            <FiAlertTriangle /> <strong>WARNING:</strong> Editing raw EJS/HTML
            may cause PDF generation errors if syntax is invalid.
          </p>
        </>
      )}
    </div>
  );
}

export default OfferTemplateManager;
