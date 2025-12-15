// FILE: src/pages/ActivationPrompt.jsx
// ✅ COMPACT: Uses CSS classes, supports dark/light mode, no scrolling

import React, { useState, useEffect } from 'react';
import { FiLock, FiAlertTriangle, FiCopy, FiMail } from 'react-icons/fi';
import { AiFillMobile } from 'react-icons/ai';
import toast from 'react-hot-toast';
import '../css/ActivationPrompt.css';

function ActivationPrompt() {
  const [machineId, setMachineId] = useState('Loading...');
  const [requestCode, setRequestCode] = useState('Generating...');
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    initActivationScreen();
  }, []);

  const initActivationScreen = async () => {
    try {
      const machineRes = await window.electronAPI.getMachineId();
      if (machineRes?.success && machineRes.machineId) {
        setMachineId(machineRes.machineId);
        const reqCode = generateRequestCode(machineRes.machineId);
        setRequestCode(reqCode);
      } else {
        setMachineId('ERROR');
        setRequestCode('UNKNOWN');
      }
    } catch (err) {
      console.error('Init error:', err);
      setMachineId('ERROR');
      setRequestCode('UNKNOWN');
    }
  };

  const generateRequestCode = (machineIdFull) => {
    const hash = machineIdFull.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const code = Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
    return code.padEnd(6, 'X');
  };

  const handleEmailActivationCode = async () => {
    if (!requestCode || requestCode === 'UNKNOWN') {
      toast.error('Request code not available');
      return;
    }

    setEmailSending(true);
    try {
      const res = await window.electronAPI.sendActivationEmail({
        requestCode,
        machineId
      });

      if (res?.success) {
        toast.success('✅ Activation code sent to your email!', { duration: 4000 });
      } else {
        toast.error(res?.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Email send error:', err);
      toast.error('Failed to send activation email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    
    const code = activationCode.trim();
    if (code.length !== 6) {
      toast.error('Activation code must be 6 characters');
      return;
    }

    setIsActivating(true);
    try {
      const res = await window.electronAPI.activateApplication(code);
      
      if (res?.success) {
        toast.success('🎉 Activation successful! Redirecting to login...', { duration: 3000 });
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(res?.error || 'Invalid activation code');
      }
    } catch (err) {
      console.error('Activation error:', err);
      toast.error('Activation failed');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCopyRequestCode = () => {
    if (!requestCode || requestCode === 'UNKNOWN') return;
    navigator.clipboard.writeText(requestCode);
    toast.success('Request code copied!');
  };

  return (
    <div className="activation-container">
      <div className="activation-content">
        {/* Header */}
        <div className="activation-header">
          <div className="activation-icon-container">
            <FiLock className="activation-icon" />
          </div>
          <h1 className="activation-title">
            Application Activation Required
          </h1>
          <p className="activation-subtitle">
            This software must be activated on this machine before use.
          </p>
          <p className="activation-subtitle">
            Share the <span className="activation-highlight">Request Code</span> with your vendor to receive a{' '}
            <span className="activation-highlight">6-digit Activation Code</span>.
          </p>
        </div>

        {/* Request Code Display */}
        <div className="request-code-box">
          <div className="request-code-header">
            <div className="request-code-label">
              <FiAlertTriangle />
              <span>REQUEST CODE:</span>
            </div>
            <button
              onClick={handleCopyRequestCode}
              className="copy-button"
              title="Copy request code"
              disabled={requestCode === 'UNKNOWN' || requestCode === 'Generating...'}
            >
              <FiCopy />
            </button>
          </div>
          <div className="request-code-display">
            {requestCode}
          </div>
          <p className="machine-id-text">
            Machine ID: <code className="machine-id-code">{machineId}</code>
          </p>
        </div>

        {/* Email Activation Button */}
        <button
          onClick={handleEmailActivationCode}
          disabled={emailSending || requestCode === 'UNKNOWN'}
          className="activation-button email-button"
        >
          {emailSending ? (
            <>
              <div className="spinner" />
              <span>Sending Email...</span>
            </>
          ) : (
            <>
              <FiMail />
              <span>Email Activation Code</span>
            </>
          )}
        </button>

        {/* Activation Form */}
        <form onSubmit={handleActivate} className="activation-form">
          <label className="activation-label">
            Enter 6-Digit Activation Code
          </label>
          
          <input
            type="text"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
            placeholder="••••••"
            maxLength={6}
            className="activation-input"
          />

          <button
            type="submit"
            disabled={isActivating || activationCode.length !== 6}
            className="activation-button activate-button"
          >
            {isActivating ? (
              <>
                <div className="spinner" />
                <span>Activating...</span>
              </>
            ) : (
              <>
                <AiFillMobile />
                <span>Activate Application</span>
              </>
            )}
          </button>
        </form>

        {/* Support Info */}
        <div className="activation-support">
          <p>
            📞 Support: <span className="support-highlight">+91 9629 881 598</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ActivationPrompt;
