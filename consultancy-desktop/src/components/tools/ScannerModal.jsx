import React, { useState, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import AadharQRScanner from './AadharQRScanner';
import PassportScanner from './PassportScanner';
import '../../css/ScannerModal.css';

function ScannerModal({ type, resetKey, onClose, onQRData, onPassportData }) {
  const [aadhaarResult, setAadhaarResult] = useState(null);
  const [passportResult, setPassportResult] = useState(null);

  const aadhaarRef = useRef(null);
  const passportRef = useRef(null);

  const handleAadhaar = (data, file) => {
    // collect result but do NOT call parent yet
    setAadhaarResult({ data, file });
  };

  const handlePassport = (payload) => {
    // collect result but do NOT call parent yet
    setPassportResult(payload);
  };

  const resetCollected = () => {
    setAadhaarResult(null);
    setPassportResult(null);
    // also reset child scanner UI/previews
    try { aadhaarRef.current && aadhaarRef.current.reset && aadhaarRef.current.reset(); } catch(e) {}
    try { passportRef.current && passportRef.current.reset && passportRef.current.reset(); } catch(e) {}
  };

  const confirmAndClose = () => {
    // call original callbacks (preserve existing logic) then close
    if (aadhaarResult && onQRData) onQRData(aadhaarResult.data, aadhaarResult.file);
    if (passportResult && onPassportData) onPassportData(passportResult);
    onClose && onClose();
  };

  const canConfirm = (() => {
    if (type === 'aadhaar') return !!aadhaarResult;
    if (type === 'passport') return !!passportResult;
    // if other or both modes, require at least one present
    return !!aadhaarResult || !!passportResult;
  })();

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
              onQRData={handleAadhaar}
              ref={aadhaarRef}
            />

            <div className="scanner-actions">
              <button className="btn btn-outline" onClick={resetCollected} type="button">Reset</button>
              <button className="btn btn-primary" onClick={confirmAndClose} type="button" disabled={!canConfirm}>Confirm & Proceed</button>
            </div>
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
              onScanSuccess={handlePassport}
              ref={passportRef}
            />

            <div className="scanner-actions">
              <button className="btn btn-outline" onClick={resetCollected} type="button">Reset</button>
              <button className="btn btn-primary" onClick={confirmAndClose} type="button" disabled={!canConfirm}>Confirm & Proceed</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerModal;
