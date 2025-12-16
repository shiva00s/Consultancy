import React, { useRef, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import AadharQRScanner from './tools/AadharQRScanner';
import PassportScanner from './tools/PassportScanner';
import '../css/ScannerModal.css';

function ScannerModal({ open, type, onClose, onQRData, onPassportData, resetKey }) {
  const aadharScannerRef = useRef(null);
  const passportScannerRef = useRef(null);

  // ✅ FIX: Reset scanners when resetKey changes
  useEffect(() => {
    if (resetKey > 0) {
      if (aadharScannerRef.current) {
        aadharScannerRef.current.reset();
      }
      if (passportScannerRef.current) {
        passportScannerRef.current.reset();
      }
    }
  }, [resetKey]);

  if (!open) return null;

  const handleAadhaarScan = (data, fileObject) => {
  onQRData(data, fileObject);
  // ✅ Defer close to next tick
  setTimeout(() => onClose(), 0);
};


  const handlePassportScan = (data) => {
    onPassportData(data);
    onClose();
  };

  return (
    <div className="scanner-modal-overlay fade-in" onClick={onClose}>
      <div
        className="scanner-modal-content slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="scanner-modal-header">
          <h2>
            {type === 'aadhaar' ? (
              <>
                <span className="emoji-inline">🟢</span> Aadhaar QR Scanner
              </>
            ) : (
              <>
                <span className="emoji-inline">🔵</span> Passport MRZ Scanner
              </>
            )}
          </h2>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="scanner-modal-body">
          {type === 'aadhaar' ? (
            <AadharQRScanner 
              ref={aadharScannerRef}
              onQRData={handleAadhaarScan} 
            />
          ) : (
            <PassportScanner 
              ref={passportScannerRef}
              onScanSuccess={handlePassportScan}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ScannerModal;
