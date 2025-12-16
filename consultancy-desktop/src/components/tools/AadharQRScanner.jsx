import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { FiCamera, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const AadharQRScanner = forwardRef(({ onQRData }, ref) => { // ✅ Changed from onScanSuccess to onQRData
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setScanResult(null);
      setError(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  }));

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
          dob: data.getAttribute('dob'), // ✅ Added DOB extraction
          co: data.getAttribute('co'),
          vtc: data.getAttribute('vtc'),
          pc: data.getAttribute('pc'),
        };
        
        setScanResult(extracted);
        setError(null);
        
        // ✅ Call parent handler with correct prop name
        if(onQRData) onQRData(extracted, fileObject);
        
        toast.success("✅ Aadhaar Verified!");
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

    setPreviewUrl(URL.createObjectURL(file));

    const html5QrCode = new Html5Qrcode("reader-hidden");
    setError(null);
    setScanResult(null);

    try {
      const result = await html5QrCode.scanFile(file, true);
      parseAadharXML(result, file);
    } catch (err) {
      console.error(err);
      setError("Could not read QR code. Ensure the image is clear.");
      setScanResult(null);
    }
  };

  return (
    <div>
      <div id="reader-hidden" style={{ display: 'none' }}></div>

      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>
          Upload an image of the Aadhaar QR Code to verify details and auto-fill.
        </p>

        {previewUrl && (
          <div style={{ marginBottom: '12px' }}>
            <img 
              src={previewUrl} 
              alt="Aadhaar Preview" 
              style={{ 
                maxWidth: '220px', 
                maxHeight: '160px', 
                borderRadius: '12px', 
                border: '2px solid var(--border-color)',
                objectFit: 'contain'
              }} 
            />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Preview.
            </p>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          id="qr-file-upload"
        />
        <label 
          htmlFor="qr-file-upload" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#ffffff',
            borderRadius: '999px',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.25s ease'
          }}
        >
          <FiCamera size={18} />
          Choose QR File
        </label>
      </div>

      {error && (
        <div style={{ 
          padding: '12px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '10px', 
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fca5a5'
        }}>
          <FiXCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {scanResult && !error && (
        <div style={{ 
          padding: '16px', 
          background: 'rgba(34, 197, 94, 0.1)', 
          borderRadius: '12px', 
          border: '1px solid rgba(34, 197, 94, 0.3)',
          marginTop: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FiCheckCircle size={20} color="#22c55e" />
            <strong style={{ color: '#22c55e', fontSize: '1rem' }}>Data Verified from QR</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.88rem' }}>
            <div><strong>UID (Last 4):</strong> ...{scanResult.uid?.slice(-4)}</div>
            <div><strong>Name:</strong> {scanResult.name}</div>
            <div><strong>YOB:</strong> {scanResult.yob}</div>
            <div><strong>Gender:</strong> {scanResult.gender}</div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Address:</strong> {scanResult.co}, {scanResult.vtc}, {scanResult.pc}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AadharQRScanner;
