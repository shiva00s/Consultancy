import React, { useState, useEffect } from "react";
import {
  FiEdit2,
  FiSave,
  FiX,
  FiTrash2,
  FiUser,
  FiCamera,
  FiDownload,
  FiPhone,
  FiMail,
  FiCreditCard,
  FiBook,
  FiBriefcase,
  FiCalendar,
  FiFileText,
  FiMapPin,
  FiHash,
} from "react-icons/fi";
import toast from "react-hot-toast";
import ConfirmDialog from "../common/ConfirmDialog";
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
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
  });

  useEffect(() => {
    if (candidate?.candidateId) {
      loadCandidatePhoto?.(candidate.candidateId);
    }
  }, [candidate?.candidateId, loadCandidatePhoto]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied! 📋`);
  };

  const handleDeleteClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Candidate",
      message: `Are you sure you want to move "${candidate.name}" to the Recycle Bin? This action can be reversed from the Recycle Bin.`,
      onConfirm: () => {
        handleDeleteCandidate();
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      isDanger: true,
    });
  };

  const handleRemovePhotoClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Photo",
      message: "Are you sure you want to remove this profile photo?",
      onConfirm: () => {
        handleRemovePhoto();
        setShowPhotoActions(false);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      isDanger: false,
    });
  };

  const handleCancelEdit = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Discard Changes",
      message: "Are you sure you want to discard all unsaved changes?",
      onConfirm: () => {
        setIsEditing(false);
        setFormData(candidate);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
      isDanger: false,
    });
  };

  return (
    <div className="candidate-profile-container profile-theme-purple">
      {/* 📸 Top Header with Photo, Info, and Actions */}
      <div className="profile-top-header">
        <div className="profile-shimmer-bg"></div>

        {/* Left: Circular Photo */}
        <div
          className="profile-photo-circle"
          onClick={() => isEditing && setShowPhotoActions(!showPhotoActions)}
        >
          <div className="photo-ring-glow"></div>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={candidate.name}
              className="profile-photo-img"
            />
          ) : (
            <div className="profile-photo-placeholder">
              <FiUser size={60} />
              <span className="photo-emoji">📸</span>
            </div>
          )}
          {isEditing && showPhotoActions && (
            <div className="photo-actions-bubble">
              <label className="photo-action-item">
                <FiCamera size={16} />
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
              </label>
              {photoUrl && (
                <button
                  className="photo-action-item delete"
                  onClick={handleRemovePhotoClick}
                >
                  <FiTrash2 size={16} />
                  Remove Photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: Header Info Grid */}
        <div className="header-info-grid">
          <div className="header-main-info">
            <h1 className="profile-name">
              <span className="name-emoji">👤</span>
              {candidate.name}
            </h1>
            <div className="header-meta-badges">
              <span
                className={`status-pill status-${candidate.status?.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="status-dot"></span>
                {candidate.status}
              </span>
              <span className="id-badge">
                <FiHash size={14} />
                ID: {candidate.candidateId}
              </span>
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="quick-info-cards">
            <div
              className="quick-card passport"
              onClick={() =>
                candidate.passportNo &&
                copyToClipboard(candidate.passportNo, "Passport No")
              }
            >
              <div className="card-shine"></div>
              <div className="quick-icon">
                <FiBook size={20} />
                <span className="card-emoji">🛂</span>
              </div>
              <div className="quick-details">
                <div className="quick-label">Passport</div>
                <div className="quick-value">
                  {candidate.passportNo || "Not Available"}
                </div>
              </div>
            </div>

            <div
              className="quick-card mobile"
              onClick={() =>
                candidate.contactNumber &&
                copyToClipboard(candidate.contactNumber, "Contact Number")
              }
            >
              <div className="card-shine"></div>
              <div className="quick-icon">
                <FiPhone size={20} />
                <span className="card-emoji">📱</span>
              </div>
              <div className="quick-details">
                <div className="quick-label">Mobile</div>
                <div className="quick-value">
                  {candidate.contactNumber || "Not Available"}
                </div>
              </div>
            </div>

            <div
              className="quick-card aadhar"
              onClick={() =>
                candidate.aadharNumber &&
                copyToClipboard(candidate.aadharNumber, "Aadhar Number")
              }
            >
              <div className="card-shine"></div>
              <div className="quick-icon">
                <FiCreditCard size={20} />
                <span className="card-emoji">🆔</span>
              </div>
              <div className="quick-details">
                <div className="quick-label">Aadhar</div>
                <div className="quick-value">
                  {candidate.aadharNumber || "Not Available"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="header-action-buttons">
          {!isEditing ? (
            <>
              {user?.permissions?.candidates_edit && (
                <button
                  className="action-btn edit-btn"
                  onClick={() => setIsEditing(true)}
                >
                  <FiEdit2 />
                  Edit Profile
                  <span className="btn-emoji">✏️</span>
                </button>
              )}
              <button
                className="action-btn export-btn"
                onClick={handleExportDocuments}
              >
                <FiDownload />
                Export Docs
                <span className="btn-emoji">📦</span>
              </button>
              {user?.permissions?.candidates_delete && (
                <button
                  className="action-btn delete-btn"
                  onClick={handleDeleteClick}
                >
                  <FiTrash2 />
                  Delete
                  <span className="btn-emoji">🗑️</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button className="action-btn save-btn" onClick={handleSave}>
                <FiSave />
                Save Changes
                <span className="btn-emoji">💾</span>
              </button>
              <button className="action-btn cancel-btn" onClick={handleCancelEdit}>
                <FiX />
                Cancel
                <span className="btn-emoji">❌</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 📝 Edit Form Section (Only when editing) */}
      {isEditing && (
        <div className="profile-edit-section">
          <h2 className="section-heading">
            <span className="section-emoji">✍️</span>
            Edit Profile Information
          </h2>
          <div className="form-grid-5col">
            {/* Row 1: Name, Contact, Aadhar, Passport No, Passport Expiry */}
            <div className="form-field">
              <label>
                <FiUser size={14} />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={candidate.name}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="Enter full name"
              />
            </div>

            <div className="form-field">
              <label>
                <FiPhone size={14} />
                Contact Number
              </label>
              <input
                type="tel"
                name="contactNumber"
                value={candidate.contactNumber || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="9876543210"
              />
            </div>

            <div className="form-field">
              <label>
                <FiCreditCard size={14} />
                Aadhar Number
              </label>
              <input
                type="text"
                name="aadharNumber"
                value={candidate.aadharNumber || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="1234 5678 9012"
              />
            </div>

            <div className="form-field">
              <label>
                <FiBook size={14} />
                Passport No
              </label>
              <input
                type="text"
                name="passportNo"
                value={candidate.passportNo || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="M1234567"
              />
            </div>

            <div className="form-field">
              <label>
                <FiCalendar size={14} />
                Passport Expiry
              </label>
              <input
                type="date"
                name="passportExpiry"
                value={candidate.passportExpiry || ""}
                onChange={handleTextChange}
                className="premium-input"
              />
            </div>

            {/* Row 2: Position, Education, Experience, Date of Birth, Notes (2 cols) */}
            <div className="form-field">
              <label>
                <FiBriefcase size={14} />
                Position Applying For
              </label>
              <input
                type="text"
                name="positionApplyingFor"
                value={candidate.positionApplyingFor || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="Welder"
              />
            </div>

            <div className="form-field">
              <label>
                <FiBook size={14} />
                Education
              </label>
              <input
                type="text"
                name="education"
                value={candidate.education || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="ITI Welder"
              />
            </div>

            <div className="form-field">
              <label>
                <FiBriefcase size={14} />
                Experience (Years)
              </label>
              <input
                type="number"
                name="experience"
                value={candidate.experience || ""}
                onChange={handleTextChange}
                className="premium-input"
                placeholder="5"
              />
            </div>

            <div className="form-field">
              <label>
                <FiCalendar size={14} />
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={candidate.dateOfBirth || ""}
                onChange={handleTextChange}
                className="premium-input"
              />
            </div>

            {/* Notes Field - 2 columns wide with reduced height */}
            <div className="form-field notes-field-2col">
              <label>
                <FiFileText size={14} />
                Notes
                <span className="label-emoji">📝</span>
              </label>
              <textarea
                name="notes"
                value={candidate.notes || ""}
                onChange={handleTextChange}
                className="premium-input notes-textarea"
                placeholder="GCC experienced"
                rows={2}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        confirmText={confirmDialog.isDanger ? "Delete" : "Confirm"}
        cancelText="Cancel"
        isDanger={confirmDialog.isDanger}
      />
    </div>
  );
}

export default CandidateProfile;
