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
    const [loading, setLoading] = useState(true); // Add loading state

    // === NEW: Load Saved Settings on Mount ===
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await window.electronAPI.getSmtpSettings({ user });
                if (res.success && res.config) {
                    setConfig(res.config);
                }
            } catch (err) {
                console.error("Failed to load SMTP settings:", err);
            }
            setLoading(false);
        };
        loadSettings();
    }, [user]);
    // =========================================

    const handleChange = (e) => setConfig({ ...config, [e.target.name]: e.target.value });
    const handleCheckbox = (e) => setConfig({ ...config, [e.target.name]: e.target.checked }); // Fix checkbox handler

    const handleSave = async () => {
        setSaving(true);
        const res = await window.electronAPI.saveSmtpSettings({ user, config });
        if (res.success) toast.success('SMTP Settings Saved');
        else toast.error(res.error);
        setSaving(false);
    };

    // Add inside the component
const handleTest = async () => {
    toast.loading('Testing connection...', { id: 'test-mail' });
    const res = await window.electronAPI.testSmtpConnection({ config });
    if (res.success) toast.success('Connection Successful!', { id: 'test-mail' });
    else toast.error(`Connection Failed: ${res.error}`, { id: 'test-mail' });
};

    if (loading) return <p>Loading settings...</p>;

    return (
        <div className="settings-section-card">
            <div style={{marginBottom: '1.5rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-color)'}}>
                <h2><FiMail /> Email Configuration (SMTP)</h2>
                <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginTop:'0.5rem'}}>
                    Configure your email provider to send Offer Letters and Alerts directly.
                </p>
            </div>
            
            <div className="form-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', // Two equal columns
                gap: '20px',
                marginTop: '20px'
            }}>
                <div className="form-group">
                    <label>SMTP Host</label>
                    <input name="host" value={config.host} onChange={handleChange} placeholder="smtp.gmail.com" />
                </div>
                <div className="form-group">
                    <label>Port</label>
                    <input type="number" name="port" value={config.port} onChange={handleChange} placeholder="587" />
                </div>
                <div className="form-group">
                    <label>Email / User</label>
                    <input name="user" value={config.user} onChange={handleChange} placeholder="you@company.com" />
                </div>
                <div className="form-group">
                    <label>Password (App Password)</label>
                    <input type="password" name="pass" value={config.pass} onChange={handleChange} />
                </div>
                
                {/* Checkbox Container */}
                <div className="form-group full-width" style={{
                    gridColumn: '1 / -1',
                    flexDirection:'row', 
                    gap:'12px', 
                    alignItems:'center', 
                    background: 'var(--bg-input)',
                    padding: '12px', 
                    borderRadius: 'var(--radius)', 
                    border: '1px solid var(--border-color)'
                }}>
                    <input 
                        type="checkbox" 
                        name="secure" 
                        checked={config.secure} 
                        onChange={handleCheckbox} 
                        style={{width:'20px', height:'20px', margin:0}}
                    />
                    <label 
                        style={{margin:0, cursor:'pointer', color: 'var(--text-primary)', fontWeight: 500}} 
                        onClick={() => setConfig(p => ({...p, secure: !p.secure}))}
                    >
                        Use Secure Connection (SSL/TLS for Port 465)
                    </label>
                </div>

                {/* Save Button - Right Aligned */}
                <div className="full-width" style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end'}}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{minWidth: '200px'}}>
                        <FiSave /> Save Email Settings
                    </button>
                    <button className="btn btn-secondary" onClick={handleTest} disabled={saving} style={{marginRight: '10px'}}>
                    Test Connection
                    </button>
                </div>
            </div>
        </div>
    );
}
export default EmailSettings;