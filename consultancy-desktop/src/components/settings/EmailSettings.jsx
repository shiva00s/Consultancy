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

    // Load Saved Settings on Mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await window.electronAPI.getSmtpSettings({ user });
                
                // ✅ Safe destructuring with fallback
                if (res && res.success && res.config) {
                    setConfig(res.config);
                }
            } catch (err) {
                console.error("Failed to load SMTP settings:", err);
                toast.error('Failed to load email settings');
            } finally {
                setLoading(false);
            }
        };
        
        if (user) {
            loadSettings();
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleCheckbox = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.checked });
    };

    const handleSave = async () => {
        if (!config.host || !config.port || !config.user || !config.pass) {
            toast.error('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const res = await window.electronAPI.saveSmtpSettings({ user, config });
            
            if (res && res.success) {
                toast.success('SMTP Settings Saved Successfully');
            } else {
                toast.error(res?.error || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Save error:', err);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!config.host || !config.port || !config.user || !config.pass) {
            toast.error('Please fill in all fields before testing');
            return;
        }

        toast.loading('Testing connection...', { id: 'test-mail' });
        
        try {
            const res = await window.electronAPI.testSmtpConnection({ config });
            
            if (res && res.success) {
                toast.success('Connection Successful!', { id: 'test-mail' });
            } else {
                toast.error(`Connection Failed: ${res?.error || 'Unknown error'}`, { id: 'test-mail' });
            }
        } catch (err) {
            console.error('Test error:', err);
            toast.error('Connection test failed', { id: 'test-mail' });
        }
    };

    if (loading) {
        return (
            <div className="settings-section-card">
                <p>Loading settings...</p>
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
                <h2><FiMail /> Email Configuration (SMTP)</h2>
                <p style={{
                    fontSize: '0.9rem', 
                    color: 'var(--text-secondary)', 
                    marginTop: '0.5rem'
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
                    borderRadius: 'var(--radius)', 
                    border: '1px solid var(--border-color)'
                }}>
                    <input 
                        type="checkbox" 
                        id="secure-checkbox"
                        name="secure" 
                        checked={config.secure} 
                        onChange={handleCheckbox} 
                        style={{width: '20px', height: '20px', margin: 0, cursor: 'pointer'}}
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
                    gap: '10px'
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
                        className="btn btn-primary" 
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
