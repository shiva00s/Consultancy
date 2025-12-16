import React from 'react';
import { FiX } from 'react-icons/fi';
import AadharQRScanner from './AadharQRScanner';
import PassportScanner from './PassportScanner';
import '../../css/ScannerModal.css';

function ScannerModal({ type, resetKey, onClose, onQRData, onPassportData }) {
  return (
    <div className="scanner-modal-overlay" onClick={onClose}>
      <div className="scanner-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <FiX size={20} />
        </button>

        {type === 'aadhaar' && (
          <div className="scanner-wrapper">
            <div className="scanner-header">
              <span className="scanner-icon">🔐</span>
              <div>
                <h2>Scan Aadhaar QR Code</h2>
                <p>Upload Aadhaar card with visible QR code</p>
              </div>
            </div>
            <AadharQRScanner 
              key={`aadhaar-modal-${resetKey}`} 
              onQRData={onQRData}
            />
          </div>
        )}

        {type === 'passport' && (
          <div className="scanner-wrapper">
            <div className="scanner-header">
              <span className="scanner-icon">🛄</span>
              <div>
                <h2>Scan Passport MRZ</h2>
                <p>Upload passport with clear MRZ (bottom 2 lines)</p>
              </div>
            </div>
            <PassportScanner 
              key={`passport-modal-${resetKey}`} 
              onScanSuccess={onPassportData}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerModal;
