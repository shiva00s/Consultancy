import React, { useState, useEffect } from 'react';
import { FiLock, FiAlertTriangle } from 'react-icons/fi';
import { AiFillMobile } from 'react-icons/ai';
import toast from 'react-hot-toast';

function ActivationPrompt() {
  const [machineId, setMachineId] = useState('Generating...');
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // ✅ FIXED: Call get-machine-id instead of getActivationStatus
        const res = await window.electronAPI.invoke('get-machine-id');
        if (res && res.success) {
          setMachineId(res.machineId || 'UNKNOWN');
        } else {
          setMachineId('ERROR: Could not fetch ID.');
        }
      } catch (err) {
        console.error('get-machine-id error:', err);
        setMachineId('ERROR: Could not fetch ID.');
      }
    };
    init();
  }, []);

  const handleRequestCode = async () => {
    try {
      setIsActivating(true);
      const res = await window.electronAPI.invoke('request-activation-code');
      if (res && res.success) {
        setMachineId(res.machineId || 'UNKNOWN');
        toast.success('Activation code sent to email.');
      } else {
        toast.error(res?.error || 'Failed to request activation code.');
      }
    } catch (err) {
      console.error('requestActivationCode error:', err);
      toast.error('Failed to request activation code.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    const code = activationKey.trim();

    if (code.length !== 6) {
      toast.error('Activation code must be exactly 6 digits.');
      return;
    }

    setIsActivating(true);
    try {
      // ✅ FIXED: Use proper license activation with correct format
      const res = await window.electronAPI.invoke('activate-license', { 
        licenseKey: code 
      });
      
      if (res && res.success) {
        toast.success('Activation successful! Restarting application...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(res?.error || 'Activation failed.');
      }
    } catch (err) {
      console.error('activate-license error:', err);
      toast.error('Activation failed.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCopy = () => {
    if (!machineId || machineId.startsWith('ERROR')) return;
    navigator.clipboard.writeText(machineId);
    toast.success('Request code copied!');
  };

  return (
    <div className="login-wrapper">
      <div className="login-container" style={{ maxWidth: '500px' }}>
        <FiLock className="login-logo" />
        <h2>Application Activation Required</h2>
        <p className="login-subtext">
          This software must be activated on this machine before use.
          Share the <strong>Request Code</strong> with your vendor to receive a
          <strong> 6‑digit Activation Code</strong>.
        </p>

        <div
          className="form-message error"
          style={{ marginBottom: '1.5rem', wordBreak: 'break-all' }}
        >
          <FiAlertTriangle />
          <strong style={{ marginLeft: '6px' }}>REQUEST CODE:</strong> {machineId}
          <button
            type="button"
            className="doc-btn view"
            onClick={handleCopy}
            style={{ marginLeft: '10px' }}
            disabled={machineId === 'Generating...' || machineId.startsWith('ERROR')}
          >
            Copy
          </button>
        </div>

        <button
          type="button"
          className="btn btn-full-width"
          onClick={handleRequestCode}
          disabled={isActivating || machineId.startsWith('ERROR')}
          style={{ marginBottom: '12px' }}
        >
          {isActivating ? 'Sending code...' : 'Email Activation Code'}
        </button>

        <form onSubmit={handleActivate} className="login-form">
          <div className="form-group">
            <label>Enter 6‑Digit Activation Code</label>
            <input
              type="password"
              value={activationKey}
              onChange={(e) =>
                setActivationKey(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              maxLength={6}
              disabled={isActivating}
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-full-width"
            disabled={isActivating || machineId === 'Generating...'}
          >
            {isActivating ? 'Activating...' : 'Activate Application'}
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}
        >
          <AiFillMobile /> Support: +91 9629 881 598
        </div>
      </div>
    </div>
  );
}

export default ActivationPrompt;
