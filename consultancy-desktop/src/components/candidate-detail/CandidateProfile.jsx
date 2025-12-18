import React, { useState, useEffect } from "react";
import {
  FiEdit2, FiSave, FiX, FiTrash2, FiUser, FiCamera,
  FiDownload, FiPhone, FiMail, FiCreditCard, FiBook,
  FiBriefcase, FiCalendar, FiFileText, FiMapPin, FiHash
} from "react-icons/fi";
import toast from "react-hot-toast";

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
    <div className="candidate-profile-container">
      {/* 🔥 PREMIUM TOP HEADER WITH CIRCULAR PHOTO */}
      <div className="profile-top-header">
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
              <FiUser size={48} />
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
        </div>

        {/* Header Info */}
        <div className="header-info-grid">
          <div className="header-main-info">
            <h1 className="profile-name">{candidate?.name || 'Unknown'}</h1>
            <div className="header-meta-badges">
              <span className={`status-pill status-${candidate?.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                {candidate?.status || 'Unknown'}
              </span>
              <span className="id-badge">
                <FiHash size={14} /> ID: {candidate?.candidateId}
              </span>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="quick-info-cards">
            <div className="quick-card passport">
              <div className="quick-icon">
                <FiBook size={20} />
              </div>
              <div className="quick-details">
                <span className="quick-label">Passport</span>
                <span className="quick-value">{candidate?.passportNo || '—'}</span>
              </div>
            </div>

            <div className="quick-card mobile">
              <div className="quick-icon">
                <FiPhone size={20} />
              </div>
              <div className="quick-details">
                <span className="quick-label">Mobile</span>
                <span className="quick-value">{candidate?.contact || '—'}</span>
              </div>
            </div>

            <div className="quick-card aadhar">
              <div className="quick-icon">
                <FiCreditCard size={20} />
              </div>
              <div className="quick-details">
                <span className="quick-label">Aadhar ID</span>
                <span className="quick-value">{candidate?.aadhar || '—'}</span>
              </div>
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
              </button>
              <button className="action-btn export-btn" onClick={handleExportDocuments}>
                <FiDownload size={18} />
                <span>Export</span>
              </button>
              <button className="action-btn delete-btn" onClick={handleDeleteCandidate}>
                <FiTrash2 size={18} />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <>
              <button className="action-btn save-btn" onClick={handleSave}>
                <FiSave size={18} />
                <span>Save Changes</span>
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
        </h2>

        <div className="form-grid-5col">
          {/* Name */}
          <div className="form-field">
            <label><FiUser size={14} /> Full Name</label>
            <input
              type="text"
              name="name"
              value={candidate?.name || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Enter full name"
            />
          </div>

          {/* Education */}
          <div className="form-field">
            <label><FiBook size={14} /> Education</label>
            <input
              type="text"
              name="education"
              value={candidate?.education || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Educational qualification"
            />
          </div>

          {/* Experience */}
          <div className="form-field">
            <label><FiBriefcase size={14} /> Experience</label>
            <input
              type="text"
              name="experience"
              value={candidate?.experience || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Work experience"
            />
          </div>

          {/* DOB */}
          <div className="form-field">
            <label><FiCalendar size={14} /> Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={candidate?.dob || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
            />
          </div>

          {/* Passport Number */}
          <div className="form-field">
            <label><FiBook size={14} /> Passport Number</label>
            <input
              type="text"
              name="passportNo"
              value={candidate?.passportNo || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Passport number"
            />
          </div>

          {/* Passport Expiry */}
          <div className="form-field">
            <label><FiCalendar size={14} /> Passport Expiry</label>
            <input
              type="date"
              name="passportExpiry"
              value={candidate?.passportExpiry || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
            />
          </div>

          {/* Contact */}
          <div className="form-field">
            <label><FiPhone size={14} /> Mobile Number</label>
            <input
              type="text"
              name="contact"
              value={candidate?.contact || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Contact number"
            />
          </div>

          {/* Aadhar */}
          <div className="form-field">
            <label><FiCreditCard size={14} /> Aadhar Number</label>
            <input
              type="text"
              name="aadhar"
              value={candidate?.aadhar || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Aadhar number"
            />
          </div>

          {/* Status */}
          <div className="form-field">
            <label><FiFileText size={14} /> Status</label>
            <select
              name="status"
              value={candidate?.status || 'New'}
              onChange={handleTextChange}
              disabled={!isEditing}
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
            <label><FiBriefcase size={14} /> Position</label>
            <input
              type="text"
              name="Position"
              value={candidate?.Position || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Job position"
            />
          </div>

          {/* Notes - Full Width */}
          <div className="form-field full-width">
            <label><FiFileText size={14} /> Notes</label>
            <textarea
              name="notes"
              value={candidate?.notes || ''}
              onChange={handleTextChange}
              disabled={!isEditing}
              placeholder="Additional notes..."
              rows={4}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateProfile;
