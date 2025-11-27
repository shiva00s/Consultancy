import React, { useState, useEffect } from 'react';
import { FiLock, FiAlertTriangle, FiMail, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AiFillMobile } from 'react-icons/ai';

function ActivationPrompt() {
    const navigate = useNavigate();
    const [machineId, setMachineId] = useState('Generating...');
    const [activationKey, setActivationKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    const generateId = async () => {
        const res = await window.electronAPI.getMachineId();
        if (res.success) {
            setMachineId(res.machineId);
        } else {
            setMachineId('ERROR: Could not fetch ID.');
        }
    };

    useEffect(() => {
        generateId();
    }, []);

    const handleActivate = async (e) => {
        e.preventDefault();
        if (activationKey.length !== 5) {
            toast.error("Activation code must be exactly 5 digits.");
            return;
        }

        setIsActivating(true);
        const res = await window.electronAPI.activateApplication({ activationKey });

        if (res.success) {
            toast.success("Activation successful! Restarting application...");
            setTimeout(() => {
                window.location.reload(); // Force full reload to apply license
            }, 2000);
        } else {
            toast.error(res.error || "Activation failed.");
        }
        setIsActivating(false);
    };

    return (
        <div className="login-wrapper">
            <div className="login-container" style={{maxWidth: '500px'}}>
                <FiLock className="login-logo" />
                <h2>Application Activation Required</h2>
                <p className="login-subtext">
                    This software must be activated on your machine before use.
                    Please send the **Request Code** below to your vendor/support team to receive your **5-digit Activation Key**.
                </p>

                <div className="form-message error" style={{marginBottom: '1.5rem', wordBreak: 'break-all'}}>
                    <FiAlertTriangle /> 
                    <strong>REQUEST CODE:</strong> {machineId}
                    <button 
                        className="doc-btn view" 
                        onClick={() => { navigator.clipboard.writeText(machineId); toast.success("Code copied!"); }}
                        style={{marginLeft: '10px'}}
                    >
                        Copy
                    </button>
                </div>
                
                <form onSubmit={handleActivate} className="login-form">
                    <div className="form-group">
                        <label>Enter 5-Digit Activation Key (Provided by Vendor)</label>
                        <input
                            type="password" // <--- CRITICAL FIX: Changed from text to password
                            value={activationKey}
                            onChange={(e) => setActivationKey(e.target.value.substring(0, 5))}
                            maxLength="5"
                            disabled={isActivating}
                            placeholder="(Simulated Key)"
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-full-width" disabled={isActivating || machineId === 'Generating...'}>
                        {isActivating ? 'Activating...' : 'Activate Application'}
                    </button>
                </form>

                <div style={{marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                    <AiFillMobile /> +91 9629 881 598.
                </div>
            </div>
        </div>
    );
}

export default ActivationPrompt;