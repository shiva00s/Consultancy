import React, { useState } from 'react';
import { FiX, FiLock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ResetPasswordModal({currentUser, userToReset, onClose, onPasswordReset }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    
    // Call the IPC handler
    const res = await window.electronAPI.resetUserPassword({
      user: currentUser,
      id: userToReset.id,
      newPassword: newPassword,
    });

    if (res.success) {
      toast.success(`Password for ${userToReset.username} reset successfully!`);
      onPasswordReset(userToReset.id); // Notify parent to refresh/close
    } else {
      toast.error(`Failed to reset password: ${res.error}`);
    }
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', height: 'fit-content' }}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiLock /> Reset Password for {userToReset.username}</h3>
        </div>
        <div className="payment-modal-body" style={{ padding: '2rem' }}>
          
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
              <label>New Password (min 6 chars)</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                disabled={isSaving}
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                disabled={isSaving}
              />
            </div>
            
            <button type="submit" className="btn btn-full-width" disabled={isSaving}>
              {isSaving ? 'Setting New Password...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordModal;