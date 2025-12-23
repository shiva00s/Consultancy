// src/pages/WhatsApp/TwilioSettingsModal.jsx

import { useState, useEffect } from 'react';
import { X, Save, ExternalLink, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import './TwilioSettingsModal.css';
import TwilioOnboardingModal from './TwilioOnboardingModal';

const TwilioSettingsModal = ({ onClose, onSave }) => {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('whatsapp:+14155238886');
  const [ngrokUrl, setNgrokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ✅ Load saved credentials and ngrok URL on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load Twilio credentials
        const statusResult = await window.electronAPI.whatsapp.getStatus();
        if (statusResult.success && statusResult.credentials) {
          setAccountSid(statusResult.credentials.accountSid || '');
          setAuthToken(statusResult.credentials.authToken || '');
          setWhatsappNumber(statusResult.credentials.whatsappNumber || 'whatsapp:+14155238886');
        }

        // ✅ FIXED: Load ngrok URL using correct API
        const ngrokResult = await window.electronAPI.whatsapp.getNgrokUrl();
        if (ngrokResult.success && ngrokResult.ngrokUrl) {
          setNgrokUrl(ngrokResult.ngrokUrl);
          console.log('✅ Loaded ngrok URL:', ngrokResult.ngrokUrl);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    // Validate required fields
    if (!accountSid?.trim() || !authToken?.trim() || !whatsappNumber?.trim()) {
      setError('Please fill in all required fields (Account SID, Auth Token, WhatsApp Number)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // ✅ 1. Save Twilio credentials
      const credentialsResult = await window.electronAPI.whatsapp.saveCredentials({
        accountSid: accountSid.trim(),
        authToken: authToken.trim(),
        whatsappNumber: whatsappNumber.trim()
      });

      if (!credentialsResult.success) {
        throw new Error(credentialsResult.error || 'Failed to save Twilio credentials');
      }

      console.log('✅ Twilio credentials saved successfully');

      // ✅ 2. Save ngrok URL (if provided)
      if (ngrokUrl && ngrokUrl.trim()) {
        const trimmedUrl = ngrokUrl.trim();
        
        // Basic URL validation
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          console.warn('⚠️ Ngrok URL should start with http:// or https://');
          setError('Ngrok URL should start with http:// or https://');
          setLoading(false);
          return;
        }

        // ✅ FIXED: Save ngrok URL using correct API
        const ngrokResult = await window.electronAPI.whatsapp.saveNgrokUrl(trimmedUrl);
        
        if (ngrokResult.success) {
          console.log('✅ Ngrok URL saved:', ngrokResult.ngrokUrl);
        } else {
          console.warn('⚠️ Failed to save ngrok URL:', ngrokResult.error);
          // Don't fail the entire save, just warn
        }
      } else {
        console.log('ℹ️ No ngrok URL provided, skipping...');
      }

      // ✅ 3. Show success
      setSuccess(true);
      
      // ✅ 4. Close modal after delay
      setTimeout(() => {
        if (onSave) onSave();
        onClose();
      }, 1500);

    } catch (err) {
      console.error('❌ Error saving settings:', err);
      setError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="twilio-modal-overlay" onClick={onClose}>
        <div className="twilio-modal" onClick={(e) => e.stopPropagation()}>
          <div className="twilio-modal-header">
            <h3>🔐 Twilio WhatsApp Configuration</h3>
            <button onClick={onClose} className="twilio-close-btn" disabled={loading}>
              <X size={20} />
            </button>
          </div>

          <div className="twilio-modal-content">
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <CheckCircle size={18} />
                <span>✅ Settings saved successfully!</span>
              </div>
            )}

            <div className="setup-instructions">
              <h4>📋 Setup Instructions</h4>
              <ol>
                <li>
                  Go to{' '}
                  <a
                    href="https://console.twilio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    Twilio Console <ExternalLink size={14} />
                  </a>
                </li>
                <li>Get your Account SID and Auth Token from the dashboard</li>
                <li>
                  Enable WhatsApp in{' '}
                  <a
                    href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    Messaging → Try it Out → WhatsApp <ExternalLink size={14} />
                  </a>
                </li>
                <li>Use the Twilio sandbox number: <code>whatsapp:+14155238886</code></li>
              </ol>
            </div>

            {/* Account SID */}
            <div className="form-group">
              <label htmlFor="accountSid">Account SID *</label>
              <input
                type="text"
                id="accountSid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="form-input"
                disabled={loading}
              />
              <span className="form-hint">
                Found in Twilio Console dashboard (starts with AC)
              </span>
            </div>

            {/* Auth Token */}
            <div className="form-group">
              <label htmlFor="authToken">Auth Token *</label>
              <input
                type="password"
                id="authToken"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="form-input"
                disabled={loading}
              />
              <span className="form-hint">
                Found in Twilio Console dashboard (click "Show" to reveal)
              </span>
            </div>

            {/* WhatsApp Number */}
            <div className="form-group">
              <label htmlFor="whatsappNumber">WhatsApp Number *</label>
              <input
                type="text"
                id="whatsappNumber"
                placeholder="whatsapp:+14155238886"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="form-input"
                disabled={loading}
              />
              <span className="form-hint">
                Format: <code>whatsapp:+[country code][number]</code>
                <br />
                Sandbox: <code>whatsapp:+14155238886</code>
              </span>
            </div>

            {/* ✅ NGROK URL FIELD */}
            <div className="form-group">
              <label htmlFor="ngrokUrl">
                NGROK URL (FOR MEDIA FILES) <span className="optional">OPTIONAL</span>
              </label>
              <input
                type="url"
                id="ngrokUrl"
                className="form-input"
                placeholder="https://oillike-unbrilliantly-meghan.ngrok-free.dev"
                value={ngrokUrl}
                onChange={(e) => setNgrokUrl(e.target.value)}
                disabled={loading}
              />
              <span className="form-hint">
                Run: <code>ngrok http 3001</code> and paste the HTTPS URL here
              </span>
            </div>

            {/* Webhook Info */}
            <div className="webhook-info">
              <h4>📡 Webhook Setup (for receiving messages)</h4>
              <p>
                To receive incoming messages, you'll need to set up a webhook URL in Twilio Console.
              </p>
              <button 
                type="button"
                onClick={() => setShowOnboarding(true)} 
                className="btn-link"
                disabled={loading || !accountSid || !authToken || !whatsappNumber}
              >
                <Smartphone size={16} />
                How to Connect WhatsApp
              </button>
            </div>
          </div>

          <div className="twilio-modal-footer">
            <button 
              onClick={onClose} 
              className="btn-secondary" 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              className="btn-primary" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner-small"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save & Connect
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ⭐ Onboarding Modal */}
      {showOnboarding && (
        <TwilioOnboardingModal
          onClose={() => setShowOnboarding(false)}
          twilioNumber={whatsappNumber}
          sandboxCode="join event-union"
        />
      )}
    </>
  );
};

export default TwilioSettingsModal;
