import React, { useState, useEffect, useRef } from 'react';
import { FiCamera, FiLoader, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { readFileAsBuffer } from '../../utils/file';

function PassportScanner({ onScanSuccess }) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  const fileInputRef = useRef(null);

  // Cleanup preview URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (e) => { 
    const file = e.target.files[0];
    if (!file) return;

    // 1. Set Preview Immediately
    setPreviewUrl(URL.createObjectURL(file)); 

    setScanning(true);
    setError(null);
    setScanResult(null); // Reset previous result while scanning
    
    const toastId = toast.loading("Scanning Passport Image...");

    try {
      const arrayBuffer = await readFileAsBuffer(file); 
      
      const res = await window.electronAPI.scanPassport({ fileBuffer: arrayBuffer });
      
      if (res.success && res.data.passport) {
        toast.success("Passport Scanned Successfully!", { id: toastId });
        
        setScanResult(res.data.passport);
        setError(null);
        
        onScanSuccess({
            passport: res.data.passport,
            fileObject: file,
            filePath: file.path 
        });
      } else {
        const errMsg = "Could not detect valid Passport Data (MRZ). Please crop and try again.";
        toast.error(errMsg, { id: toastId });
        setError(errMsg);
        setScanResult(null);
      }
    } catch (err) {
      toast.error("Scanning Error: " + err.message, { id: toastId });
      setError("An unexpected error occurred during scan.");
      setScanResult(null);
    }
    
    setScanning(false);
  };

  return (
    <div className="qr-scanner-box" style={{border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '5px', marginTop: '1rem', background: 'var(--bg-secondary)'}}>
      
      {/* 1. HEADER */}
      <h4 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>
        <FiCamera /> Auto-Scan Passport
      </h4>
      
      {/* 2. DESCRIPTION */}
      <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>
        Upload a clear image of the passport (MRZ Zone). AI will extract the data.
      </p>

      {/* 3. PREVIEW IMAGE (Center aligned like Aadhaar) */}
      {previewUrl && (
          <div style={{margin: '10px 0', textAlign: 'center'}}>
              <img 
                src={previewUrl} 
                alt="Passport Preview" 
                style={{maxWidth: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '5px'}}
              />
              <p style={{marginTop: '5px', fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
                  Preview.
              </p>
          </div>
      )}

      {/* 4. ACTION BUTTON (Moved ABOVE results to match Aadhaar) */}
      <div className="custom-file-input" style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}}>
          <input 
            type="file" 
            id="passport-scan-input"
            accept="image/*, .pdf" 
            onChange={handleFileChange} 
            ref={fileInputRef}
            disabled={scanning}
            style={{display: 'none'}}
          />
          <label htmlFor="passport-scan-input" className="btn" style={{cursor: 'pointer', display:'inline-flex', alignItems:'center', gap:'8px', minWidth: '180px'}}>
             {scanning ? <><FiLoader className="spinner"/> Processing...</> : <><FiCamera /> {previewUrl ? 'Change Image' : 'Select Passport Image'}</>}
          </label>
      </div>

      {/* 5. ERROR MESSAGE */}
      {error && (
          <div className="form-message error" style={{marginBottom: '10px'}}>
              <FiAlertTriangle /> {error}
          </div>
      )}

      {/* 6. SUCCESS RESULT (Unified Design) */}
      {scanResult && (
          <div className="scan-result" style={{background: 'var(--success-color-bg)', padding: '10px', borderRadius: '5px', border: '1px solid var(--success-color)'}}>
              <div className="form-message success" style={{marginBottom: '10px', marginTop: '0', border: 'none', background: 'transparent', padding: 0}}>
                  <FiCheckCircle /> <strong>Passport Data Verified</strong>
              </div>
              <div style={{fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', color: 'var(--text-primary)'}}>
                  <div><strong>Passport No:</strong> {scanResult.passportNo}</div>
                  <div><strong>DOB:</strong> {scanResult.dob}</div>
                  <div style={{gridColumn: '1 / -1'}}><strong>Expiry:</strong> {scanResult.expiry}</div>
              </div>
          </div>
      )}
    </div>
  );
}

export default PassportScanner;