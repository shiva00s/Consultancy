import React, { useState } from 'react';
import { FiX, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './ChangePasswordModal.css';

function ChangePasswordModal({ user, onClose, onPasswordChange }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('🔒 New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('⚠️ Passwords do not match');
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
      toast.success('✅ Password changed successfully!');
      setTimeout(() => {
        onClose();
        onPasswordChange();
      }, 1500);
    } else {
      toast.error(`❌ ${res.error || 'Failed to change password'}`);
    }
    setIsSaving(false);
  };

  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal-container" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSave}>
          {/* Header */}
          <div className="premium-modal-header">
            <div className="header-content">
              <div className="icon-wrapper">
                <FiLock />
              </div>
              <div>
                <h2>🔐 Change Password</h2>
                <p>Keep your account secure with a strong password</p>
              </div>
            </div>
            <button type="button" className="close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>

          {/* Body */}
          <div className="premium-modal-body">
            {/* Info Banner */}
            <div className="info-banner">
              <span className="emoji">💡</span>
              <div>
                <strong>Tip:</strong> Use a mix of letters, numbers, and symbols for a stronger password.
              </div>
            </div>

            {/* Old Password */}
            <div className="form-group-premium">
              <label>
                <span className="emoji-label">🔑</span>
                Current Password
                <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type={showOld ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  tabIndex={1}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowOld(!showOld)}
                  tabIndex={-1}
                >
                  {showOld ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group-premium">
              <label>
                <span className="emoji-label">🆕</span>
                New Password
                <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  tabIndex={2}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                >
                  {showNew ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group-premium">
              <label>
                <span className="emoji-label">✅</span>
                Confirm New Password
                <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  tabIndex={3}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="premium-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSaving}
                tabIndex={5}
              >
                <FiX />
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={isSaving}
                tabIndex={4}
              >
                {isSaving ? (
                  <>
                    <span className="spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <FiLock />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
