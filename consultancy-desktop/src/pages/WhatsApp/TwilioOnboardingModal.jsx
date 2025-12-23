// src/pages/WhatsApp/TwilioOnboardingModal.jsx
import { useState } from 'react';
import { X, ExternalLink, Copy, Check, Info } from 'lucide-react';
import './TwilioOnboardingModal.css';

const TwilioOnboardingModal = ({ onClose, twilioNumber, sandboxCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format Twilio number for display
  const formattedNumber = twilioNumber || '+1 415 523 8886';
  const joinCode = sandboxCode || 'join event-union';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="onboarding-header">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2Z" fill="#25D366"/>
            </svg>
          </div>
          <div>
            <h2>Connect Your WhatsApp</h2>
            <p>Follow these steps to start messaging</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="onboarding-content">
          {/* Step 1 */}
          <div className="onboarding-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Open WhatsApp on Your Phone</h3>
              <p>Launch the WhatsApp app on your mobile device</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="onboarding-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Scan QR Code or Send Message</h3>
              
              <div className="connection-options">
                {/* Option A: QR Code */}
                <div className="option-card">
                  <h4>Option A: Scan QR Code</h4>
                  <div className="qr-section">
                    <div className="qr-placeholder">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://wa.me/${formattedNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(joinCode)}`)}`}
                        alt="WhatsApp QR Code"
                        className="qr-code"
                      />
                    </div>
                    <p className="qr-note">Use WhatsApp camera to scan</p>
                  </div>
                </div>

                {/* Option B: Manual */}
                <div className="option-card">
                  <h4>Option B: Send Message Manually</h4>
                  
                  <div className="manual-steps">
                    <div className="copy-field">
                      <label>Twilio WhatsApp Number:</label>
                      <div className="copy-input">
                        <input 
                          type="text" 
                          value={formattedNumber}
                          readOnly
                        />
                        <button 
                          className="copy-btn"
                          onClick={() => handleCopy(formattedNumber)}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="copy-field">
                      <label>Join Code to Send:</label>
                      <div className="copy-input">
                        <input 
                          type="text" 
                          value={joinCode}
                          readOnly
                        />
                        <button 
                          className="copy-btn"
                          onClick={() => handleCopy(joinCode)}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="open-whatsapp-btn-container">
                      <a 
                        href={`https://wa.me/${formattedNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(joinCode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="open-whatsapp-btn"
                      >
                        Open WhatsApp
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="onboarding-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Wait for Confirmation</h3>
              <p>You'll receive a confirmation message from Twilio. Once confirmed, you can start messaging!</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="info-box">
            <Info size={20} />
            <div>
              <strong>Twilio Sandbox Limitations:</strong>
              <ul>
                <li>Each phone number must join the sandbox before messaging</li>
                <li>Sandbox connection expires after 72 hours of inactivity</li>
                <li>For production use, apply for WhatsApp Business API approval</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          <button className="btn-secondary" onClick={onClose}>
            I'll Do This Later
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done, Let's Start Messaging!
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwilioOnboardingModal;
