import React, { useState, useEffect } from "react";
import {
  FiEdit2, FiSave, FiX, FiTrash2, FiUser, FiCamera,
  FiDownload, FiPhone, FiMail, FiCreditCard, FiBook,
  FiBriefcase, FiCalendar, FiFileText, FiMapPin, FiHash
} from "react-icons/fi";
import toast from "react-hot-toast";
import "../../css/CandidateProfile.css";

function CandidateProfile({
  candidate,
  statusOptions,
  isEditing,
  photoUrl,
  handleTextChange,
  handleSave,
  handleDeleteCandidate,
  handleExportDocuments,
  handlePhotoChange,
  handleRemovePhoto,
  setIsEditing,
  setFormData,
  user,
  loadCandidatePhoto,
}) {
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  
  useEffect(() => {
    if (candidate?.candidateId) {
      loadCandidatePhoto?.(candidate.candidateId);
    }
  }, [candidate?.candidateId]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied! 📋`);
  };

  return (
    <div className="candidate-profile-container profile-theme-purple">
      {/* 🔥 PREMIUM TOP HEADER WITH CIRCULAR PHOTO */}
      <div className="profile-top-header">
        <div className="profile-shimmer-bg"></div>
        
        {/* Profile Photo Circle */}
        <div
          className="profile-photo-circle"
          onMouseEnter={() => setShowPhotoActions(true)}
          onMouseLeave={() => setShowPhotoActions(false)}
        >
          {photoUrl ? (
            <img src={photoUrl} alt={candidate?.name} className="profile-photo-img" />
          ) : (
            <div className="profile-photo-placeholder">
              <FiUser size={56} />
              <span className="photo-emoji">👤</span>
            </div>
          )}
          
          {showPhotoActions && (
            <div className="photo-actions-bubble">
              <label className="photo-action-item">
                <FiCamera size={16} />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </label>
              {photoUrl && (
                <button
                  className="photo-action-item delete"
                  onClick={handleRemovePhoto}
                >
                  <FiTrash2 size={16} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          )}
          <div className="photo-ring-glow"></div>
        </div>

        {/* Header Info */}
        <div className="header-info-grid">
          <div className="header-main-info">
            <h1 className="profile-name">
              <span className="name-emoji">✨</span>
              {candidate?.name || 'Unknown'}
            </h1>
            <div className="header-meta-badges">
              <span className={`status-pill status-${candidate?.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                <span className="status-dot"></span>
                {candidate?.status || 'Unknown'}
              </span>
              <span className="id-badge">
                <FiHash size={14} /> ID: {candidate?.candidateId}
              </span>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="quick-info-cards">
            <div className="quick-card passport" onClick={() => copyToClipboard(candidate?.passportNo, 'Passport')}>
              <div className="quick-icon">
                <FiBook size={20} />
                <span className="card-emoji">📘</span>
              </div>
              <div className="quick-details">
                <span className="quick-label">Passport</span>
                <span className="quick-value">{candidate?.passportNo || '—'}</span>
              </div>
              <div className="card-shine"></div>
            </div>

            <div className="quick-card mobile" onClick={() => copyToClipboard(candidate?.contact, 'Mobile')}>
              <div className="quick-icon">
                <FiPhone size={20} />
                <span className="card-emoji">📱</span>
              </div>
              <div className="quick-details">
                <span className="quick-label">Mobile</span>
                <span className="quick-value">{candidate?.contact || '—'}</span>
              </div>
              <div className="card-shine"></div>
            </div>

            <div className="quick-card aadhar" onClick={() => copyToClipboard(candidate?.aadhar, 'Aadhar')}>
              <div className="quick-icon">
                <FiCreditCard size={20} />
                <span className="card-emoji">🪪</span>
              </div>
              <div className="quick-details">
                <span className="quick-label">Aadhar ID</span>
                <span className="quick-value">{candidate?.aadhar || '—'}</span>
              </div>
              <div className="card-shine"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="header-action-buttons">
          {!isEditing ? (
            <>
              <button className="action-btn edit-btn" onClick={() => setIsEditing(true)}>
                <FiEdit2 size={18} />
                <span>Edit Profile</span>
                <span className="btn-emoji">✏️</span>
              </button>
              <button className="action-btn export-btn" onClick={handleExportDocuments}>
                <FiDownload size={18} />
                <span>Export</span>
                <span className="btn-emoji">📥</span>
              </button>
              <button className="action-btn delete-btn" onClick={handleDeleteCandidate}>
                <FiTrash2 size={18} />
                <span>Delete</span>
                <span className="btn-emoji">🗑️</span>
              </button>
            </>
          ) : (
            <>
              <button className="action-btn save-btn" onClick={handleSave}>
                <FiSave size={18} />
                <span>Save Changes</span>
                <span className="btn-emoji">💾</span>
              </button>
              <button
                className="action-btn cancel-btn"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({ ...candidate });
                }}
              >
                <FiX size={18} />
                <span>Cancel</span>
                <span className="btn-emoji">❌</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 📝 EDIT FORM SECTION */}
      <div className="profile-edit-section">
        <h2 className="section-heading">
          <FiFileText size={24} />
          <span>Candidate Details</span>
          <span className="section-emoji">📋</span>
        </h2>

        <div className="form-grid-5col">
          {/* Name */}
          <div className="form-field">
            <label>
              <FiUser size={14} /> 
              <span>Full Name</span>
              <span className="label-emoji">👤</span>
            </label>
            <input
              type="text"
              name="name"
              value={candidate?.name || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Enter full name"
              className="premium-input"
            />
          </div>

          {/* Education */}
          <div className="form-field">
            <label>
              <FiBook size={14} /> 
              <span>Education</span>
              <span className="label-emoji">🎓</span>
            </label>
            <input
              type="text"
              name="education"
              value={candidate?.education || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Educational qualification"
              className="premium-input"
            />
          </div>

          {/* Experience */}
          <div className="form-field">
            <label>
              <FiBriefcase size={14} /> 
              <span>Experience</span>
              <span className="label-emoji">💼</span>
            </label>
            <input
              type="text"
              name="experience"
              value={candidate?.experience || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Work experience"
              className="premium-input"
            />
          </div>

          {/* DOB */}
          <div className="form-field">
            <label>
              <FiCalendar size={14} /> 
              <span>Date of Birth</span>
              <span className="label-emoji">🎂</span>
            </label>
            <input
              type="date"
              name="dob"
              value={candidate?.dob || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="premium-input"
            />
          </div>

          {/* Passport Number */}
          <div className="form-field">
            <label>
              <FiBook size={14} /> 
              <span>Passport Number</span>
              <span className="label-emoji">📘</span>
            </label>
            <input
              type="text"
              name="passportNo"
              value={candidate?.passportNo || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Passport number"
              className="premium-input"
            />
          </div>

          {/* Passport Expiry */}
          <div className="form-field">
            <label>
              <FiCalendar size={14} /> 
              <span>Passport Expiry</span>
              <span className="label-emoji">📅</span>
            </label>
            <input
              type="date"
              name="passportExpiry"
              value={candidate?.passportExpiry || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="premium-input"
            />
          </div>

          {/* Contact */}
          <div className="form-field">
            <label>
              <FiPhone size={14} /> 
              <span>Mobile Number</span>
              <span className="label-emoji">📱</span>
            </label>
            <input
              type="text"
              name="contact"
              value={candidate?.contact || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Contact number"
              className="premium-input"
            />
          </div>

          {/* Aadhar */}
          <div className="form-field">
            <label>
              <FiCreditCard size={14} /> 
              <span>Aadhar Number</span>
              <span className="label-emoji">🪪</span>
            </label>
            <input
              type="text"
              name="aadhar"
              value={candidate?.aadhar || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Aadhar number"
              className="premium-input"
            />
          </div>

          {/* Status */}
          <div className="form-field">
            <label>
              <FiFileText size={14} /> 
              <span>Status</span>
              <span className="label-emoji">📊</span>
            </label>
            <select
              name="status"
              value={candidate?.status || 'New'}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="premium-input"
            >
              {statusOptions?.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div className="form-field">
            <label>
              <FiBriefcase size={14} /> 
              <span>Position</span>
              <span className="label-emoji">💼</span>
            </label>
            <input
              type="text"
              name="Position"
              value={candidate?.Position || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Job position"
              className="premium-input"
            />
          </div>

          {/* Notes - Full Width */}
          <div className="form-field full-width">
            <label>
              <FiFileText size={14} /> 
              <span>Notes</span>
              <span className="label-emoji">📝</span>
            </label>
            <textarea
              name="notes"
              value={candidate?.notes || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Additional notes..."
              rows={4}
              className="premium-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateProfile;
