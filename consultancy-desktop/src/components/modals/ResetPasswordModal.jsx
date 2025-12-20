import React, { useState } from 'react';
import { FiX, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './ResetPasswordModal.css';

function ResetPasswordModal({ currentUser, userToReset, onClose, onPasswordReset }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('🔒 Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('⚠️ Passwords do not match');
      return;
    }

    setIsSaving(true);
    const res = await window.electronAPI.resetUserPassword({
      user: currentUser,
      id: userToReset.id,
      newPassword: newPassword,
    });

    if (res.success) {
      toast.success(`✅ Password reset for ${userToReset.username}!`);
      onPasswordReset(userToReset.id);
      onClose();
    } else {
      toast.error(`❌ ${res.error || 'Failed to reset password'}`);
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
                <h2>🔐 Reset User Password</h2>
                <p>Set a new password for <strong>{userToReset.username}</strong></p>
              </div>
            </div>
            <button type="button" className="close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>

          {/* Body */}
          <div className="premium-modal-body">
            {/* Warning Banner */}
            <div className="info-banner">
              <span className="emoji">⚠️</span>
              <div>
                <strong>Important:</strong> The user will need to use this new password on their next login.
              </div>
            </div>

            {/* New Password */}
            <div className="form-group-premium">
              <label>
                <span className="emoji-label">🔑</span>
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
                  tabIndex={1}
                  autoFocus
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
                <span className="emoji-label">🔄</span>
                Confirm Password
                <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  tabIndex={2}
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
                tabIndex={4}
              >
                <FiX />
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={isSaving}
                tabIndex={3}
              >
                {isSaving ? (
                  <>
                    <span className="spinner"></span>
                    Resetting...
                  </>
                ) : (
                  <>
                    <FiLock />
                    Reset Password
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

export default ResetPasswordModal;
