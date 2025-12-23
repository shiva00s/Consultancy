// src/pages/WhatsApp/TwilioSettingsModal.jsx

import { useState, useEffect } from 'react';
import { X, Save, ExternalLink, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import './TwilioSettingsModal.css';
import TwilioOnboardingModal from './TwilioOnboardingModal';

const TwilioSettingsModal = ({ onClose, onSave }) => {
  const [accountSid, setAccountSid] = useState('AC7ff5862adc4fc67803722d3e8ac3bda7');
  const [authToken, setAuthToken] = useState('8db81c11ec073e5edf84330ad4d9c563');
  const [whatsappNumber, setWhatsappNumber] = useState('whatsapp:+14155238886');
  const [ngrokUrl, setNgrokUrl] = useState(''); // ✅ Moved up
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ✅ Load ngrok URL on component mount
  useEffect(() => {
    const loadNgrokUrl = async () => {
      try {
        const result = await window.electron.invoke('whatsapp:getNgrokUrl');
        if (result.success && result.url) {
          setNgrokUrl(result.url);
        }
      } catch (err) {
        console.error('Error loading ngrok URL:', err);
      }
    };
    loadNgrokUrl();
  }, []);

  const handleSave = async () => {
    if (!accountSid || !authToken || !whatsappNumber) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // ✅ Save Twilio credentials
      const response = await window.electronAPI.whatsapp.saveCredentials({
        accountSid: accountSid.trim(),
        authToken: authToken.trim(),
        whatsappNumber: whatsappNumber.trim()
      });

      if (!response.success) {
        setError(response.error || 'Failed to save credentials');
        return;
      }

      // ✅ Save ngrok URL if provided
      if (ngrokUrl && ngrokUrl.trim()) {
        const ngrokResult = await window.electron.invoke('whatsapp:setNgrokUrl', ngrokUrl.trim());
        if (!ngrokResult.success) {
          console.warn('Failed to save ngrok URL:', ngrokResult.error);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to save credentials');
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
            <button onClick={onClose} className="twilio-close-btn">
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
                <span>Credentials saved successfully!</span>
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
                <li>Use the Twilio sandbox number or get approved</li>
              </ol>
            </div>

            <div className="form-group">
              <label>Account SID *</label>
              <input
                type="text"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="form-input"
              />
              <span className="form-hint">
                Found in Twilio Console dashboard
              </span>
            </div>

            <div className="form-group">
              <label>Auth Token *</label>
              <input
                type="password"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="form-input"
              />
              <span className="form-hint">
                Found in Twilio Console dashboard (click to reveal)
              </span>
            </div>

            <div className="form-group">
              <label>WhatsApp Number *</label>
              <input
                type="text"
                placeholder="whatsapp:+14155238886"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="form-input"
              />
              <span className="form-hint">
                Format: whatsapp:+[country code][number]
                <br />
                Sandbox: whatsapp:+14155238886
              </span>
            </div>

            {/* ✅ NGROK URL FIELD */}
            <div className="form-group">
              <label htmlFor="ngrokUrl">
                Ngrok URL (for media files) <span className="optional">Optional</span>
              </label>
              <input
                type="url"
                id="ngrokUrl"
                className="form-input"
                placeholder="https://abc123.ngrok-free.app"
                value={ngrokUrl}
                onChange={(e) => setNgrokUrl(e.target.value)}
              />
              <span className="form-hint">
                Run: <code>ngrok http 3001</code> and paste the HTTPS URL here
              </span>
            </div>

            <div className="webhook-info">
              <h4>📡 Webhook Setup (for receiving messages)</h4>
              <p>
                To receive incoming messages, you'll need to set up a webhook URL in Twilio Console.
              </p>
              <p className="webhook-note">
                Note: This requires your app to have a public endpoint. You can use ngrok for testing.
              </p>
            </div>
          </div>

          <div className="twilio-modal-footer">
            {/* ⭐ How to Connect WhatsApp Button */}
            <button 
              type="button"
              onClick={() => setShowOnboarding(true)} 
              className="btn-onboarding"
              disabled={!accountSid || !authToken || !whatsappNumber}
              title={!accountSid || !authToken || !whatsappNumber ? "Please fill in credentials first" : ""}
            >
              <Smartphone size={18} />
              How to Connect WhatsApp
            </button>

            <div className="footer-right">
              <button onClick={onClose} className="btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary" disabled={loading}>
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
