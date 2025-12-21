// src/pages/WhatsApp/TwilioSettingsModal.jsx

import { useState, useEffect } from 'react';
import { X, Save, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import './TwilioSettingsModal.css';

const TwilioSettingsModal = ({ onClose, onSave }) => {
  const [accountSid, setAccountSid] = useState('AC7ff5862adc4fc67803722d3e8ac3bda7');
  const [authToken, setAuthToken] = useState('99edfb0989b10cdab747c55f89e227e5');
  const [whatsappNumber, setWhatsappNumber] = useState('whatsapp:+919629881598');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!accountSid || !authToken || !whatsappNumber) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await window.electronAPI.whatsapp.saveCredentials({
        accountSid: accountSid.trim(),
        authToken: authToken.trim(),
        whatsappNumber: whatsappNumber.trim()
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSave();
          onClose();
        }, 1500);
      } else {
        setError(response.error || 'Failed to save credentials');
      }
    } catch (err) {
      setError(err.message || 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
};

export default TwilioSettingsModal;
