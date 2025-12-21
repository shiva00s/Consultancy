// src/pages/WhatsApp/QRCodeModal.jsx

import { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import './QRCodeModal.css';

const QRCodeModal = ({ onClose }) => {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('waiting'); // waiting, authenticated, ready, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Listen for QR code
    const handleQR = (qrDataURL) => {
      console.log('QR Code received');
      setQrCode(qrDataURL);
      setStatus('scanning');
    };

    // Listen for authenticated
    const handleAuthenticated = () => {
      console.log('Authenticated!');
      setStatus('authenticated');
    };

    // Listen for ready
    const handleReady = () => {
      console.log('WhatsApp Ready!');
      setStatus('ready');
      setTimeout(() => {
        onClose();
      }, 2000);
    };

    // Listen for disconnected
    const handleDisconnected = (reason) => {
      console.log('Disconnected:', reason);
      setStatus('error');
      setErrorMessage(reason || 'Disconnected from WhatsApp');
    };

    window.electronAPI.whatsapp.onQR(handleQR);
    window.electronAPI.whatsapp.onAuthenticated(handleAuthenticated);
    window.electronAPI.whatsapp.onReady(handleReady);
    window.electronAPI.whatsapp.onDisconnected(handleDisconnected);

    // Check current status
    checkStatus();

    return () => {
      // Cleanup listeners if needed
    };
  }, [onClose]);

  const checkStatus = async () => {
    try {
      const response = await window.electronAPI.whatsapp.getStatus();
      if (response.isReady) {
        setStatus('ready');
        setTimeout(() => onClose(), 1000);
      } else if (response.hasQR && response.qrCode) {
        setQrCode(response.qrCode);
        setStatus('scanning');
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>🔐 Connect WhatsApp</h3>
          <button onClick={onClose} className="qr-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="qr-modal-content">
          {status === 'waiting' && (
            <div className="qr-status">
              <div className="qr-spinner"></div>
              <p>Initializing WhatsApp...</p>
            </div>
          )}

          {status === 'scanning' && qrCode && (
            <>
              <div className="qr-code-container">
                <img src={qrCode} alt="WhatsApp QR Code" className="qr-code-image" />
              </div>
              <div className="qr-instructions">
                <h4><Smartphone size={18} /> Scan with WhatsApp</h4>
                <ol>
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu or Settings → Linked Devices</li>
                  <li>Tap "Link a Device"</li>
                  <li>Point your phone at this screen to scan the code</li>
                </ol>
              </div>
            </>
          )}

          {status === 'authenticated' && (
            <div className="qr-status success">
              <CheckCircle size={64} className="success-icon" />
              <p>Authenticated! Connecting...</p>
            </div>
          )}

          {status === 'ready' && (
            <div className="qr-status success">
              <CheckCircle size={64} className="success-icon" />
              <p>✅ Connected to WhatsApp!</p>
            </div>
          )}

          {status === 'error' && (
            <div className="qr-status error">
              <AlertCircle size={64} className="error-icon" />
              <p>Connection Failed</p>
              <p className="error-message">{errorMessage}</p>
              <button onClick={checkStatus} className="retry-btn">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
