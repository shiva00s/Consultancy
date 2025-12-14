import React, { useState, useEffect } from 'react';
import { FiMail, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';

function EmailSettings({ user }) {
    const [config, setConfig] = useState({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: ''
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // ✅ FIX: Load Saved Settings with proper error handling
    useEffect(() => {
        const loadSettings = async () => {
            // ✅ Check if user exists
            if (!user || !user.id) {
                console.warn('User not available for loading email settings');
                setLoading(false);
                return;
            }

            try {
                // ✅ FIX: Call without parameters or with userId only
                const res = await window.electronAPI.getSmtpSettings();
                
                if (res && res.success && res.config) {
                    setConfig({
                        host: res.config.host || 'smtp.gmail.com',
                        port: res.config.port || 587,
                        secure: res.config.secure || false,
                        user: res.config.user || '',
                        pass: res.config.pass || ''
                    });
                }
            } catch (err) {
                console.error("Failed to load SMTP settings:", err);
                // Don't show error toast on initial load - just log it
                console.log('No saved email settings found, using defaults');
            } finally {
                setLoading(false);
            }
        };
        
        loadSettings();
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckbox = (e) => {
        const { name, checked } = e.target;
        setConfig(prev => ({ ...prev, [name]: checked }));
    };

    const handleSave = async () => {
        // Validation
        if (!config.host || !config.port || !config.user || !config.pass) {
            toast.error('Please fill in all required fields');
            return;
        }

        // Validate port number
        const portNum = parseInt(config.port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            toast.error('Please enter a valid port number (1-65535)');
            return;
        }

        setSaving(true);
        try {
            // ✅ FIX: Send config directly
            const res = await window.electronAPI.saveSmtpSettings({ 
                config: {
                    host: config.host.trim(),
                    port: portNum,
                    secure: config.secure,
                    user: config.user.trim(),
                    pass: config.pass
                }
            });
            
            if (res && res.success) {
                toast.success('Email settings saved successfully!');
            } else {
                toast.error(res?.error || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Save error:', err);
            toast.error('Failed to save email settings');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        // Validation
        if (!config.host || !config.port || !config.user || !config.pass) {
            toast.error('Please fill in all fields before testing');
            return;
        }

        const portNum = parseInt(config.port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            toast.error('Please enter a valid port number');
            return;
        }

        const toastId = toast.loading('Testing email connection...');
        
        try {
            const res = await window.electronAPI.testSmtpConnection({ 
                config: {
                    host: config.host.trim(),
                    port: portNum,
                    secure: config.secure,
                    user: config.user.trim(),
                    pass: config.pass
                }
            });
            
            if (res && res.success) {
                toast.success('Connection successful! ✅', { id: toastId });
            } else {
                toast.error(`Connection failed: ${res?.error || 'Unknown error'}`, { id: toastId });
            }
        } catch (err) {
            console.error('Test error:', err);
            toast.error('Connection test failed. Check console for details.', { id: toastId });
        }
    };

    if (loading) {
        return (
            <div className="settings-section-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading email settings...</p>
            </div>
        );
    }

    return (
        <div className="settings-section-card">
            <div style={{
                marginBottom: '1.5rem', 
                paddingBottom: '1rem', 
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h2 style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    fontSize: '1.3rem',
                    margin: 0
                }}>
                    <FiMail /> Email Configuration (SMTP)
                </h2>
                <p style={{
                    fontSize: '0.9rem', 
                    color: 'var(--text-secondary)', 
                    marginTop: '0.5rem',
                    marginBottom: 0
                }}>
                    Configure your email provider to send Offer Letters and Alerts directly.
                </p>
            </div>
            
            <div className="form-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                marginTop: '20px'
            }}>
                <div className="form-group">
                    <label>SMTP Host *</label>
                    <input 
                        name="host" 
                        value={config.host} 
                        onChange={handleChange} 
                        placeholder="smtp.gmail.com"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Port *</label>
                    <input 
                        type="number" 
                        name="port" 
                        value={config.port} 
                        onChange={handleChange} 
                        placeholder="587"
                        min="1"
                        max="65535"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Email / User *</label>
                    <input 
                        type="email"
                        name="user" 
                        value={config.user} 
                        onChange={handleChange} 
                        placeholder="you@company.com"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Password (App Password) *</label>
                    <input 
                        type="password" 
                        name="pass" 
                        value={config.pass} 
                        onChange={handleChange}
                        placeholder="••••••••••••"
                        required
                        autoComplete="new-password"
                    />
                </div>
                
                {/* Checkbox Container */}
                <div className="form-group" style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    flexDirection: 'row', 
                    gap: '12px', 
                    alignItems: 'center', 
                    background: 'var(--bg-input)',
                    padding: '12px', 
                    borderRadius: 'var(--border-radius)', 
                    border: '1px solid var(--border-color)'
                }}>
                    <input 
                        type="checkbox" 
                        id="secure-checkbox"
                        name="secure" 
                        checked={config.secure} 
                        onChange={handleCheckbox} 
                        style={{
                            width: '20px', 
                            height: '20px', 
                            margin: 0, 
                            cursor: 'pointer',
                            accentColor: 'var(--primary-color)'
                        }}
                    />
                    <label 
                        htmlFor="secure-checkbox"
                        style={{
                            margin: 0, 
                            cursor: 'pointer', 
                            color: 'var(--text-primary)', 
                            fontWeight: 500
                        }}
                    >
                        Use Secure Connection (SSL/TLS for Port 465)
                    </label>
                </div>

                {/* Action Buttons */}
                <div style={{
                    gridColumn: '1 / -1', 
                    display: 'flex', 
                    justifyContent: 'flex-end',
                    gap: '12px',
                    marginTop: '10px'
                }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={handleTest} 
                        disabled={saving}
                        style={{minWidth: '160px'}}
                    >
                        Test Connection
                    </button>
                    <button 
                        className="btn" 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{minWidth: '200px'}}
                    >
                        <FiSave /> {saving ? 'Saving...' : 'Save Email Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EmailSettings;
