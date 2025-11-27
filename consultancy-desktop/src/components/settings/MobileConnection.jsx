import React, { useState, useEffect } from 'react';
import { FiSmartphone, FiWifi, FiCopy, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore'; 
import { useShallow } from 'zustand/react/shallow';
import QRCode from "react-qr-code"; // <--- NEW IMPORT

function MobileConnection({ user }) {
    const { featureFlags } = useAuthStore(
        useShallow(state => ({ featureFlags: state.featureFlags }))
    );
    
    const [serverInfo, setServerInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    const isSuperAdmin = user && user.role === 'super_admin';
    const isEnabled = featureFlags && featureFlags.isMobileAccessEnabled;
    const canShow = isSuperAdmin || isEnabled;

    const fetchIP = async () => {
        setLoading(true);
        try {
            if (canShow) {
                const ipRes = await window.electronAPI.getServerIP();
                setServerInfo(ipRes);
            }
        } catch (err) {
            console.error("Failed to fetch IP", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchIP();
    }, [canShow, user]);

    const copyUrl = () => {
        if (!serverInfo) return;
        const url = `http://${serverInfo.ip}:${serverInfo.port}`;
        navigator.clipboard.writeText(url);
        toast.success("Server URL copied!");
    };

    if (loading) return <p>Loading connection status...</p>;

    if (isSuperAdmin && !isEnabled) return (
        <div className="settings-section-card" style={{marginTop: '0', borderLeft: '4px solid var(--danger-color)'}}>
            <p className="form-message error" style={{marginBottom: '0'}}>
                <FiAlertCircle /> **Mobile App access is currently disabled.**
            </p>
            <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginTop:'10px'}}>
                Enable it in the **System Modules** tab.
            </p>
        </div>
    );
    
    if (isEnabled || isSuperAdmin) return (
        <div className="settings-section-card" style={{marginTop: '0', borderLeft: '4px solid var(--primary-color)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{flex: 1, paddingRight: '20px'}}>
                    <h2 style={{marginTop: 0}}><FiSmartphone /> Mobile App Connection</h2>
                    <p style={{color:'var(--text-secondary)', marginBottom:'1.5rem', lineHeight: '1.6'}}>
                        Scan the QR code below with the Consultancy Mobile App (Login Screen) to automatically configure the server connection.
                    </p>
                    
                    <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom: '1rem'}}>
                        <div style={{position: 'relative', flexGrow: 1}}>
                            <span style={{
                                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', 
                                color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600
                            }}>URL:</span>
                            <code style={{
                                display: 'block',
                                background:'var(--bg-input)', 
                                padding:'12px 12px 12px 50px', 
                                borderRadius:'8px', 
                                fontSize:'1rem', 
                                fontFamily:'monospace',
                                border: '1px solid var(--border-color)',
                                color: 'var(--primary-color)'
                            }}>
                                {serverInfo ? `http://${serverInfo.ip}:${serverInfo.port}` : 'Searching...'}
                            </code>
                        </div>
                        <button className="btn btn-secondary" onClick={copyUrl} title="Copy URL" style={{height: '45px'}}>
                            <FiCopy />
                        </button>
                        <button className="btn btn-secondary" onClick={fetchIP} title="Refresh IP" style={{height: '45px'}}>
                            <FiRefreshCw />
                        </button>
                    </div>
                    
                    <p style={{fontSize:'0.85rem', color:'var(--text-secondary)', background: 'rgba(255, 193, 7, 0.1)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #ffc107'}}>
                        <FiWifi style={{verticalAlign:'middle', marginRight: '8px'}}/> 
                        <strong>Note:</strong> Ensure your mobile device is connected to the same Wi-Fi network as this PC.
                    </p>
                </div>

                {/* --- QR CODE SECTION --- */}
                {serverInfo && (
                    <div style={{ 
                        background: 'white', 
                        padding: '15px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <QRCode 
                            value={JSON.stringify({ ip: serverInfo.ip, port: serverInfo.port })} 
                            size={160}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                        <span style={{marginTop: '10px', fontSize: '0.8rem', color: '#888', fontWeight: 600}}>SCAN ME</span>
                    </div>
                )}
            </div>
        </div>
    );

    return null;
}

export default MobileConnection;