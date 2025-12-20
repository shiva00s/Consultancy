import React, { useState, useEffect } from 'react';
import {
  FiMail,
  FiSave,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiZap,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/Emailsettings.css';

function EmailSettings({ user }) {
  const [config, setConfig] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    user: '',
    pass: '',
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      try {
        const result = await window.electronAPI.getSmtpSettings();
        if (result.success && result.config) {
          setConfig(result.config);
        }
      } catch (error) {
        console.error('Failed to load SMTP settings:', error);
        toast.error('Failed to load email settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (e) => {
    const { name, checked } = e.target;
    setConfig((prev) => ({ ...prev, [name]: checked }));
  };

  const validatePort = () => {
    const portNum = parseInt(config.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error('Please enter a valid port number (1-65535)');
      return null;
    }
    return portNum;
  };

  const validateRequired = () => {
    if (!config.host || !config.port || !config.user || !config.pass) {
      toast.error('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const portNum = validatePort();
    if (portNum == null) return null;

    return {
      config: {
        host: config.host.trim(),
        port: portNum,
        secure: config.secure,
        user: config.user.trim(),
        pass: config.pass,
      },
    };
  };

  const handleSave = async () => {
    if (!validateRequired()) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      const res = await window.electronAPI.saveSmtpSettings(payload);
      if (res?.success) {
        toast.success('✅ Email settings saved successfully!');
      } else {
        toast.error(res?.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateRequired()) return;
    const payload = buildPayload();
    if (!payload) return;

    setTesting(true);
    const toastId = toast.loading('Testing email connection...');
    try {
      const res = await window.electronAPI.testSmtpConnection(payload);
      if (res?.success) {
        toast.success('✅ Connection successful!', { id: toastId });
      } else {
        toast.error(
          `❌ Connection failed: ${res?.error || 'Unknown error'}`,
          { id: toastId }
        );
      }
    } catch (err) {
      console.error('Test error:', err);
      toast.error('Connection test failed. Check console for details.', {
        id: toastId,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="email-settings-loading">
        <div className="loading-spinner"></div>
        <p>Loading email settings...</p>
      </div>
    );
  }

  return (
    <div className="email-settings-container">
      {/* Header */}
      <div className="email-settings-header">
        <div className="header-content">
          <div className="header-icon">
            <FiMail />
          </div>
          <div className="header-text">
            <h2 className="header-title">
              Email Configuration (SMTP)
              <span className="title-badge">PRO</span>
            </h2>
            <p className="header-description">
              📧 Configure your email provider to send Offer Letters and Alerts
              directly
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        className="email-settings-form"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Info Box */}
        <div className="info-box">
          <FiAlertCircle className="info-icon" />
          <div className="info-content">
            <strong>💡 Common SMTP Providers:</strong>
            <ul>
              <li>
                <code>Gmail:</code> smtp.gmail.com:587 (Use App Password)
              </li>
              <li>
                <code>Outlook:</code> smtp-mail.outlook.com:587
              </li>
              <li>
                <code>SendGrid:</code> smtp.sendgrid.net:587
              </li>
            </ul>
          </div>
        </div>

        {/* Connection Section */}
        <div className="settings-section">
          <div className="section-label">
            <FiMail /> SMTP Server Details
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>🌐 SMTP Host *</label>
              <input
                type="text"
                name="host"
                value={config.host}
                onChange={handleChange}
                placeholder="smtp.gmail.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>🔌 Port *</label>
              <input
                type="number"
                name="port"
                value={config.port}
                onChange={handleChange}
                placeholder="587"
                min="1"
                max="65535"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>👤 Email / Username *</label>
              <input
                type="email"
                name="user"
                value={config.user}
                onChange={handleChange}
                placeholder="you@company.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>🔑 Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="pass"
                  value={config.pass}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="form-input"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Toggle */}
        <div className="security-toggle">
          <input
            type="checkbox"
            id="secure-checkbox"
            name="secure"
            checked={config.secure}
            onChange={handleCheckbox}
            className="toggle-checkbox"
          />
          <label htmlFor="secure-checkbox" className="toggle-label">
            <div className="toggle-switch">
              <div className="toggle-slider"></div>
            </div>
            <div className="toggle-text">
              <div className="toggle-title">Secure Connection (SSL/TLS)</div>
              <div className="toggle-hint">
                Enable for Port 465, keep disabled for Port 587 (STARTTLS)
              </div>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button
            type="button"
            className="btn-test"
            onClick={handleTest}
            disabled={saving || testing}
          >
            {testing ? (
              <>
                <div className="btn-spinner"></div>
                Testing...
              </>
            ) : (
              <>
                <FiZap /> Test Connection
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-save"
            onClick={handleSave}
            disabled={saving || testing}
          >
            {saving ? (
              <>
                <div className="btn-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmailSettings;