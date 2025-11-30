import React, { useState, useEffect } from 'react';
import { PERMISSION_GROUPS } from '../config/permissionKeys';
import toast from 'react-hot-toast';
import '../css/PermissionPopup.css';

function PermissionPopup({ user, targetUser, onClose, onSave }) {
    const [permissions, setPermissions] = useState({});
    const [granterPermissions, setGranterPermissions] = useState({});
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPermissions();
    }, [targetUser]);

    const loadPermissions = async () => {
        setLoading(true);
        
        // Load target user's current permissions
        const targetPerms = await window.electronAPI.getUserGranularPermissions({ 
            userId: targetUser.id 
        });
        
        if (targetPerms.success) {
            setPermissions(targetPerms.data || {});
        }

        // Load granter's permissions (to show what they can grant)
        const granterPerms = await window.electronAPI.getGranterPermissions({ 
            granterId: user.id 
        });
        
        if (granterPerms.success) {
            setIsSuperAdmin(granterPerms.isSuperAdmin);
            setGranterPermissions(granterPerms.data || {});
        }

        setLoading(false);
    };

    const handleToggle = (permKey) => {
        setPermissions(prev => ({
            ...prev,
            [permKey]: !prev[permKey]
        }));
    };

    const handleSave = async () => {
        const result = await window.electronAPI.setUserGranularPermissions({
            granterId: user.id,
            targetUserId: targetUser.id,
            permissions
        });

        if (result.success) {
            toast.success('Permissions saved successfully!');
            onSave?.();
            onClose();
        } else {
            toast.error(result.error || 'Failed to save permissions');
        }
    };

    const canGrantPermission = (permKey) => {
        // Super Admin can grant everything
        if (isSuperAdmin) return true;
        
        // Admin can only grant what they have
        return granterPermissions[permKey] === true;
    };

    if (loading) {
        return (
            <div className="permission-popup-overlay">
                <div className="permission-popup">
                    <p>Loading permissions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="permission-popup-overlay" onClick={onClose}>
            <div className="permission-popup" onClick={(e) => e.stopPropagation()}>
                <div className="permission-header">
                    <h2>Set Permissions for {targetUser.username}</h2>
                    <p className="permission-note">
                        <span className="info-icon">ℹ️</span>
                        You can only grant access to features that <em>you</em> currently possess.
                    </p>
                </div>

                <div className="permission-body">
                    {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
                        <div key={groupKey} className="permission-section">
                            <h3>{group.title}</h3>
                            <div className="permission-grid">
                                {group.permissions.map(perm => {
                                    const canGrant = canGrantPermission(perm.key);
                                    const isEnabled = permissions[perm.key] === true;
                                    
                                    return (
                                        <label 
                                            key={perm.key} 
                                            className={`permission-item ${!canGrant ? 'disabled' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={() => handleToggle(perm.key)}
                                                disabled={!canGrant}
                                            />
                                            <span className="perm-icon">{perm.icon}</span>
                                            <span className="perm-label">{perm.label}</span>
                                            {!canGrant && (
                                                <span className="locked-icon" title="You don't have this permission">🔒</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="permission-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn" onClick={handleSave}>
                        Save Permissions
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PermissionPopup;
