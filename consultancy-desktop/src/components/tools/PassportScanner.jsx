import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { FiCamera, FiLoader, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { readFileAsBuffer } from '../../utils/file';

const PassportScanner = forwardRef(({ onScanSuccess }, ref) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // ✅ Expose reset method to parent
  useImperativeHandle(ref, () => ({
    reset: () => {
      setScanning(false);
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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setScanning(true);
    setError(null);
    setScanResult(null);

    const toastId = toast.loading("Scanning Passport Image...");

    try {
      const arrayBuffer = await readFileAsBuffer(file);
      const res = await window.electronAPI.scanPassport({ fileBuffer: arrayBuffer });

      if (res.success && res.data.passport) {
        toast.success("✅ Passport Scanned!", { id: toastId });
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
    <div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>
          Upload a clear image of the passport (MRZ Zone). AI will extract the data.
        </p>

        {previewUrl && (
          <div style={{ marginBottom: '12px' }}>
            <img 
              src={previewUrl} 
              alt="Passport Preview" 
              style={{ 
                maxWidth: '280px', 
                maxHeight: '200px', 
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
          id="passport-file-upload"
        />
        <label 
          htmlFor="passport-file-upload" 
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
          {scanning ? 'Scanning...' : 'Select Passport Image'}
        </label>
      </div>

      {scanning && (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <FiLoader className="spin-icon" size={24} color="#3b82f6" />
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Processing...</p>
        </div>
      )}

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
          <FiAlertTriangle size={18} />
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
            <strong style={{ color: '#22c55e', fontSize: '1rem' }}>Passport Data Extracted</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.88rem' }}>
            <div><strong>Passport No:</strong> {scanResult.passportNo}</div>
            <div><strong>Name:</strong> {scanResult.name}</div>
            <div><strong>DOB:</strong> {scanResult.dob}</div>
            <div><strong>Expiry:</strong> {scanResult.expiry}</div>
            <div><strong>Nationality:</strong> {scanResult.nationality}</div>
            <div><strong>Gender:</strong> {scanResult.gender}</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PassportScanner;
