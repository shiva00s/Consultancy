import React, { useState, useEffect } from 'react';
import { FiMail, FiCheckCircle, FiAlertCircle, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { emailService } from '../services/emailService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../css/EmailSettings.css';

function EmailSettingsPage() {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  
  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI.getEmailSettings();
      if (result.success && result.settings) {
        setSettings({
          ...settings,
          ...result.settings,
          smtpPassword: '', // Don't load password for security
        });
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const result = await emailService.configureEmailSettings(settings);
      
      if (result.success) {
        toast.success('Email settings saved successfully!');
      } else {
        toast.error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('An error occurred while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await emailService.testEmailConnection();
      
      setTestResult(result);
      
      if (result.success) {
        toast.success('Email connection test successful!');
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({
        success: false,
        error: error.message,
      });
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  // Only admins can access
  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return (
      <div className="email-settings-page">
        <div className="access-denied">
          <FiAlertCircle />
          <h2>Access Denied</h2>
          <p>Only administrators can configure email settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="email-settings-page">
      <div className="page-header">
        <div>
          <h1><FiMail /> Email Configuration</h1>
          <p>Configure SMTP settings for sending emails</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="card-header">
          <h3>SMTP Server Settings</h3>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="smtpHost">SMTP Host *</label>
              <input
                type="text"
                id="smtpHost"
                name="smtpHost"
                value={settings.smtpHost}
                onChange={handleChange}
                placeholder="smtp.gmail.com"
                disabled={isSaving}
                required
              />
              <small className="help-text">
                Example: smtp.gmail.com, smtp.office365.com
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="smtpPort">SMTP Port *</label>
              <input
                type="number"
                id="smtpPort"
                name="smtpPort"
                value={settings.smtpPort}
                onChange={handleChange}
                disabled={isSaving}
                required
              />
              <small className="help-text">
                Common ports: 587 (TLS), 465 (SSL), 25
              </small>
            </div>

            <div className="form-group full-width">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="smtpSecure"
                  checked={settings.smtpSecure}
                  onChange={handleChange}
                  disabled={isSaving}
                />
                Use SSL/TLS encryption
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="smtpUser">SMTP Username *</label>
              <input
                type="text"
                id="smtpUser"
                name="smtpUser"
                value={settings.smtpUser}
                onChange={handleChange}
                placeholder="your-email@example.com"
                disabled={isSaving}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="smtpPassword">SMTP Password *</label>
              <input
                type="password"
                id="smtpPassword"
                name="smtpPassword"
                value={settings.smtpPassword}
                onChange={handleChange}
                placeholder="Enter password"
                disabled={isSaving}
                required
                autoComplete="current-password"
              />
              <small className="help-text">
                For Gmail, use an App Password
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="fromEmail">From Email *</label>
              <input
                type="email"
                id="fromEmail"
                name="fromEmail"
                value={settings.fromEmail}
                onChange={handleChange}
                placeholder="noreply@company.com"
                disabled={isSaving}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fromName">From Name *</label>
              <input
                type="text"
                id="fromName"
                name="fromName"
                value={settings.fromName}
                onChange={handleChange}
                placeholder="Your Company Name"
                disabled={isSaving}
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          {testResult.success ? (
            <>
              <FiCheckCircle />
              <div>
                <strong>Connection Successful</strong>
                <p>Email server is configured correctly.</p>
              </div>
            </>
          ) : (
            <>
              <FiAlertCircle />
              <div>
                <strong>Connection Failed</strong>
                <p>{testResult.error}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="settings-actions">
        <button
          className="btn btn-secondary"
          onClick={handleTest}
          disabled={isSaving || isTesting}
        >
          {isTesting ? (
            <>
              <LoadingSpinner size="small" />
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </button>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving || isTesting}
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="small" />
              Saving...
            </>
          ) : (
            <>
              <FiSave />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Gmail Setup Guide */}
      <div className="setup-guide">
        <h4>Gmail Setup Guide</h4>
        <ol>
          <li>Enable 2-Step Verification in your Google Account</li>
          <li>Go to Security → App Passwords</li>
          <li>Generate an App Password for "Mail"</li>
          <li>Use the generated password in the SMTP Password field</li>
          <li>SMTP Host: <code>smtp.gmail.com</code></li>
          <li>SMTP Port: <code>587</code> with TLS enabled</li>
        </ol>
      </div>
    </div>
  );
}

export default EmailSettingsPage;
