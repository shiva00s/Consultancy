import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { FiCamera, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const AadharQRScanner = forwardRef(({ onScanSuccess }, ref) => { 
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  const fileInputRef = useRef(null);

  // Expose the reset method to the parent component
  useImperativeHandle(ref, () => ({
      reset: () => {
          setScanResult(null);
          setError(null);
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = null;
      }
  }));

  // Cleanup preview URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

 const parseAadharXML = (xmlString, fileObject) => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const data = xmlDoc.getElementsByTagName("PrintLetterBarcodeData")[0];

        if (data) {
            const extracted = {
                uid: data.getAttribute('uid'),
                name: data.getAttribute('name'),
                gender: data.getAttribute('gender'),
                yob: data.getAttribute('yob'),
                co: data.getAttribute('co'), 
                vtc: data.getAttribute('vtc'), 
                pc: data.getAttribute('pc'),   
            };
            setScanResult(extracted);
            setError(null);
            
            if(onScanSuccess) onScanSuccess(extracted, fileObject);
            toast.success("Aadhaar QR Verified Successfully!");
        } else {
            const isSecureNum = /^[0-9]+$/.test(xmlString); 
            if(isSecureNum) {
                 toast.success("Secure QR Detected.");
                 setScanResult({ raw: xmlString, note: "Secure QR Content Detected" });
            } else {
                 throw new Error("Invalid Aadhaar QR Data Format");
            }
        }
    } catch (err) {
        setError("Invalid Data: This does not look like a valid Aadhaar QR.");
        setScanResult(null);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Set Preview
    setPreviewUrl(URL.createObjectURL(file));

    const html5QrCode = new Html5Qrcode("reader-hidden");
    setError(null);
    setScanResult(null);

    try {
      // Use the raw file object directly for client-side scanning
      const result = await html5QrCode.scanFile(file, true);
     parseAadharXML(result, file);
    } catch (err) {
      console.error(err);
      setError("Could not read QR code. Ensure the image is clear.");
      setScanResult(null);
    }
  };

  return (
    <div className="qr-scanner-box" style={{border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '5px', marginTop: '1rem', background: 'var(--bg-secondary)'}}>
      <div id="reader-hidden" style={{display: 'none'}}></div>
      
      {/* 1. HEADER */}
      <h4 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>
        <FiCamera /> Offline Aadhaar Verification
      </h4>

      {/* 2. DESCRIPTION */}
      <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>
        Upload an image of the Aadhaar QR Code to verify details and auto-fill.
      </p>

      {/* 3. PREVIEW IMAGE */}
      {previewUrl && (
          <div style={{margin: '10px 0', textAlign: 'center'}}>
              <img 
                src={previewUrl} 
                alt="Aadhaar QR Preview" 
                style={{maxWidth: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '5px'}}
              />
              <p style={{marginTop: '5px', fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
                  Preview.
              </p>
          </div>
      )}
      
      {/* 4. ACTION BUTTON */}
      <div className="custom-file-input" style={{marginBottom: '1rem', display: 'flex', justifyContent: 'center'}}>
          <input 
            type="file" 
            id="aadhar-qr-input" 
            name="aadhar-qr-file"
            accept="image/*" 
            onChange={handleFileChange} 
            ref={fileInputRef}
            style={{display: 'none'}}
          />
          <label htmlFor="aadhar-qr-input" className="btn" style={{cursor: 'pointer', display:'inline-flex', alignItems:'center', gap:'8px', minWidth: '180px'}}>
             <FiCamera /> {previewUrl ? 'Change QR File' : 'Choose QR File'}
          </label>
      </div>

      {/* 5. ERROR MESSAGE */}
      {error && (
          <div className="form-message error" style={{marginBottom: '10px'}}>
              <FiXCircle /> {error}
          </div>
      )}

      {/* 6. SUCCESS RESULT */}
      {scanResult && scanResult.uid && (
          <div className="scan-result" style={{background: 'var(--success-color-bg)', padding: '10px', borderRadius: '5px', border: '1px solid var(--success-color)'}}>
              <div className="form-message success" style={{marginBottom: '10px', marginTop: '0', border: 'none', background: 'transparent', padding: 0}}>
                  <FiCheckCircle /> <strong>Data Verified from QR</strong>
              </div>
              <div style={{fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', color: 'var(--text-primary)'}}>
                  <div><strong>UID (Last 4):</strong> ...{scanResult.uid.slice(-4)}</div>
                  <div><strong>Name:</strong> {scanResult.name}</div>
                  <div><strong>YOB:</strong> {scanResult.yob}</div>
                  <div><strong>Gender:</strong> {scanResult.gender}</div>
                  <div style={{gridColumn: '1 / -1'}}><strong>Address:</strong> {scanResult.co}, {scanResult.vtc}, {scanResult.pc}</div>
              </div>
          </div>
      )}
    </div>
  );
});

export default AadharQRScanner;