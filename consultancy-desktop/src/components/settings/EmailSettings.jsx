import React, { useState, useEffect } from 'react';
import { 
  FiMail, FiSave, FiZap, FiShield, FiServer, FiKey, FiUser, 
  FiCheckCircle, FiAlertCircle, FiEye, FiEyeOff, FiRefreshCw,
  FiAlertTriangle, FiCheck
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConfirmDialog from '../common/ConfirmDialog';
import '../../css/EmailSettings.css';

function EmailSettings({ user }) {
  const [config, setConfig] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    user: '',
    pass: ''
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // 'success' | 'error' | null
  const [isEditing, setIsEditing] = useState(false);
  const [originalConfig, setOriginalConfig] = useState({});

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Load saved settings
  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const res = await window.electronAPI.getSmtpSettings();
      if (res?.success && res.config) {
        const loadedConfig = {
          host: res.config.host || 'smtp.gmail.com',
          port: String(res.config.port || '587'),
          secure: Boolean(res.config.secure),
          user: res.config.user || '',
          pass: res.config.pass || ''
        };
        setConfig(loadedConfig);
        setOriginalConfig(loadedConfig);
      }
    } catch (err) {
      console.error('Failed to load SMTP settings', err);
      toast.error('❌ Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    setTestStatus(null);
    setIsEditing(true);
  };

  const handleCheckbox = (e) => {
    const { name, checked } = e.target;
    setConfig(prev => ({ ...prev, [name]: checked }));
    setTestStatus(null);
    setIsEditing(true);
  };

  const validatePort = () => {
    const portNum = parseInt(config.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error('⚠️ Please enter a valid port number (1-65535)');
      return null;
    }
    return portNum;
  };

  const validateRequired = () => {
    if (!config.host || !config.port || !config.user || !config.pass) {
      toast.error('⚠️ Please fill in all required fields');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateRequired()) return;
    const portNum = validatePort();
    if (portNum === null) return;

    setSaving(true);

    try {
      const res = await window.electronAPI.saveSmtpSettings({
        host: config.host.trim(),
        port: portNum,
        secure: config.secure,
        user: config.user.trim(),
        pass: config.pass
      });

      if (res?.success) {
        toast.success('✅ Email settings saved successfully!');
        setTestStatus(null);
        setIsEditing(false);
        setOriginalConfig(config);
      } else {
        toast.error(`❌ ${res?.error || 'Failed to save settings'}`);
      }
    } catch (err) {
      console.error('Save error', err);
      toast.error('❌ Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateRequired()) return;
    const portNum = validatePort();
    if (portNum === null) return;

    setTesting(true);
    setTestStatus(null);
    const toastId = toast.loading('📧 Testing email connection...');

    try {
      const res = await window.electronAPI.testSmtpConnection({
        host: config.host.trim(),
        port: portNum,
        secure: config.secure,
        user: config.user.trim(),
        pass: config.pass
      });

      if (res?.success) {
        setTestStatus('success');
        toast.success('✅ Connection successful! Email is ready to use.', { id: toastId });
      } else {
        setTestStatus('error');
        toast.error(`❌ Connection failed: ${res?.error || 'Unknown error'}`, {
          id: toastId,
          duration: 5000
        });
      }
    } catch (err) {
      console.error('Test error', err);
      setTestStatus('error');
      toast.error('❌ Connection test failed. Check console for details.', { id: toastId });
    } finally {
      setTesting(false);
    }
  };

  const handleCancel = () => {
    setConfirmDialog({
      isOpen: true,
      title: '🔄 Discard Changes?',
      message: 'Are you sure you want to discard your unsaved changes? This action cannot be undone.',
      onConfirm: () => {
        setConfig(originalConfig);
        setIsEditing(false);
        setTestStatus(null);
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        toast.success('✅ Changes discarded');
      }
    });
  };

  const handleReset = () => {
    setConfirmDialog({
      isOpen: true,
      title: '⚠️ Reset to Default?',
      message: 'This will reset all email settings to their default values. Saved settings will be lost.',
      onConfirm: async () => {
        const defaultConfig = {
          host: 'smtp.gmail.com',
          port: '587',
          secure: false,
          user: '',
          pass: ''
        };
        setConfig(defaultConfig);
        setOriginalConfig(defaultConfig);
        setTestStatus(null);
        setIsEditing(false);
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        toast.success('🔄 Settings reset to default');
      }
    });
  };

  if (loading) {
    return (
      <div className="email-settings-loading">
        <div className="loading-spinner-modern">
          <FiRefreshCw className="spinning" />
        </div>
        <p className="loading-text">⏳ Loading email settings...</p>
      </div>
    );
  }

  return (
    <>
      <div className="email-settings-container-premium">
        {/* HEADER with animated gradient */}
        <div className="email-settings-header-premium">
          <div className="header-icon-wrapper">
            <FiMail className="header-icon-main animated-pulse" />
          </div>
          <div className="header-content-premium">
            <h2 className="header-title-premium">
              📧 Email Configuration
              <span className="title-badge-premium">SMTP</span>
            </h2>
            <p className="header-description-premium">
              Configure your email provider to send <strong>Offer Letters</strong>, <strong>Alerts</strong>, and <strong>Notifications</strong> automatically.
            </p>
            {testStatus === 'success' && (
              <span className="status-badge-premium success">
                <FiCheckCircle /> Connected & Ready
              </span>
            )}
            {testStatus === 'error' && (
              <span className="status-badge-premium error">
                <FiAlertCircle /> Connection Failed
              </span>
            )}
          </div>
        </div>

        {/* FORM */}
        <div className="email-settings-form-premium">
          {/* SERVER SETTINGS */}
          <div className="settings-section-premium">
            <div className="section-header-premium">
              <FiServer className="section-icon" />
              <span className="section-title">🌐 Server Settings</span>
            </div>
            <div className="form-grid-premium">
              <div className="form-group-premium form-group-large">
                <label htmlFor="smtp-host" className="label-premium">
                  <FiServer className="label-icon" />
                  SMTP Host <span className="required-asterisk">*</span>
                </label>
                <input
                  id="smtp-host"
                  name="host"
                  type="text"
                  value={config.host}
                  onChange={handleChange}
                  placeholder="e.g., smtp.gmail.com"
                  className="input-premium"
                  required
                />
              </div>
              <div className="form-group-premium form-group-small">
                <label htmlFor="smtp-port" className="label-premium">
                  <FiZap className="label-icon" />
                  Port <span className="required-asterisk">*</span>
                </label>
                <input
                  id="smtp-port"
                  name="port"
                  type="number"
                  value={config.port}
                  onChange={handleChange}
                  placeholder="587"
                  min="1"
                  max="65535"
                  className="input-premium"
                  required
                />
              </div>
            </div>
          </div>

          {/* AUTHENTICATION */}
          <div className="settings-section-premium">
            <div className="section-header-premium">
              <FiUser className="section-icon" />
              <span className="section-title">🔐 Authentication Credentials</span>
            </div>
            <div className="form-grid-premium">
              <div className="form-group-premium">
                <label htmlFor="smtp-user" className="label-premium">
                  <FiUser className="label-icon" />
                  Email Address <span className="required-asterisk">*</span>
                </label>
                <input
                  id="smtp-user"
                  name="user"
                  type="email"
                  value={config.user}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  className="input-premium"
                  required
                />
              </div>
              <div className="form-group-premium">
                <label htmlFor="smtp-pass" className="label-premium">
                  <FiKey className="label-icon" />
                  Password / App Password <span className="required-asterisk">*</span>
                </label>
                <div className="password-input-wrapper-premium">
                  <input
                    id="smtp-pass"
                    name="pass"
                    type={showPassword ? 'text' : 'password'}
                    value={config.pass}
                    onChange={handleChange}
                    placeholder="••••••••••••"
                    className="input-premium"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-premium"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECURITY OPTION */}
          <div className="settings-section-premium security-section">
            <div className="section-header-premium">
              <FiShield className="section-icon" />
              <span className="section-title">🔒 Security Options</span>
            </div>
            <div className="security-toggle-premium">
              <input
                type="checkbox"
                id="secure-checkbox"
                name="secure"
                checked={config.secure}
                onChange={handleCheckbox}
                className="toggle-checkbox-premium"
              />
              <label htmlFor="secure-checkbox" className="toggle-label-premium">
                <div className="toggle-switch-premium">
                  <div className="toggle-slider-premium"></div>
                </div>
                <div className="toggle-text-premium">
                  <span className="toggle-title-premium">⚡ Use Secure Connection (SSL/TLS)</span>
                  <span className="toggle-hint-premium">
                    ✅ Recommended for Port 465 | ⚠️ Uncheck for Port 587 (STARTTLS)
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* INFO BOX */}
          <div className="info-box-premium">
            <FiAlertTriangle className="info-icon-premium pulse-glow" />
            <div className="info-content-premium">
              <strong>📝 Quick Setup Tips</strong>
              <ul>
                <li><strong>Gmail:</strong> Use <code>smtp.gmail.com</code> Port <code>587</code> • Enable App Passwords in Google Account</li>
                <li><strong>Outlook:</strong> Use <code>smtp.office365.com</code> Port <code>587</code></li>
                <li>⚠️ Always use <strong>App Passwords</strong> instead of your regular password for better security</li>
              </ul>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="settings-actions-premium">
            <button
              className="btn-modern btn-secondary-modern"
              onClick={handleReset}
              disabled={saving || testing}
              title="Reset to default settings"
            >
              <FiRefreshCw className={testing ? 'spinning' : ''} />
              Reset
            </button>

            {isEditing && (
              <button
                className="btn-modern btn-cancel-modern"
                onClick={handleCancel}
                disabled={saving || testing}
              >
                Cancel
              </button>
            )}

            <button
              className="btn-modern btn-test-modern"
              onClick={handleTest}
              disabled={saving || testing}
            >
              {testing ? (
                <>
                  <div className="btn-spinner-modern"></div>
                  Testing...
                </>
              ) : (
                <>
                  <FiZap />
                  Test Connection
                </>
              )}
            </button>

            <button
              className="btn-modern btn-save-modern"
              onClick={handleSave}
              disabled={saving || testing}
            >
              {saving ? (
                <>
                  <div className="btn-spinner-modern"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </>
  );
}

export default EmailSettings;
