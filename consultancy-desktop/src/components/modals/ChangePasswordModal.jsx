import React, { useState } from 'react';
import { FiX, FiAlertTriangle, FiCheckCircle, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ChangePasswordModal({ user, onClose, onPasswordChange }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  

  const handleSave = async (e) => {
    e.preventDefault();
    

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.'); // <--- MODIFIED
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.'); // <--- MODIFIED
      return;
    }

    setIsSaving(true);
    
    const res = await window.electronAPI.changeMyPassword({
      user,
      id: user.id,
      oldPassword: oldPassword,
      newPassword: newPassword,
    });

    if (res.success) {
      toast.success('Password updated successfully! You will be logged out shortly.'); // <--- MODIFIED
      // Force log out after successful change for security
      setTimeout(() => {
        onClose();
        onPasswordChange(); 
      }, 2000);
    } else {
      toast.error(res.error || 'Failed to change password.'); // <--- MODIFIED
    }
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', height: 'fit-content' }}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiLock /> Change Password</h3>
        </div>
        <div className="payment-modal-body" style={{ padding: '2rem' }}>
      
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>New Password (min 6 chars)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            
            <button type="submit" className="btn btn-full-width" disabled={isSaving}>
              {isSaving ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordModal;