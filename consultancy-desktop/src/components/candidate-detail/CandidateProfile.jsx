import React, { useState, useEffect } from "react";
import {
  FiEdit2, FiSave, FiX, FiTrash2, FiUser,
  FiPhone, FiCreditCard, FiBook,
  FiBriefcase, FiCalendar, FiFileText, FiMapPin
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
  const [photoHovered, setPhotoHovered] = useState(false);

  useEffect(() => {
    if (candidate?.candidateId) {
      loadCandidatePhoto?.(candidate.candidateId);
    }
  }, [candidate?.candidateId]);

  const getStatusEmoji = (status) => {
    const emojiMap = {
      'new': '🆕',
      'documents collected': '📄',
      'visa applied': '📝',
      'in progress': '⏳',
      'completed': '✅',
      'rejected': '❌',
    };
    return emojiMap[status?.toLowerCase()] || '📌';
  };

  return (
    <div className="candidate-profile-container">
      <div className="profile-section">
        <h2 className="profile-section-title">
          <FiUser /> 👤 Personal Information
        </h2>
                <div className="profile-form-grid">
          {/* Full Name */}
          <div className="form-field">
            <label className="form-label">
              <FiUser /> 👤 FULL NAME
            </label>
            <input
              type="text"
              name="name"
              value={candidate?.name || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="Enter full name"
            />
          </div>

          {/* Date of Birth */}
          <div className="form-field">
            <label className="form-label">
              <FiCalendar /> 🎂 DATE OF BIRTH
            </label>
            <input
              type="date"
              name="dob"
              value={candidate?.dob ? candidate.dob.split("T")[0] : ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
            />
          </div>

          {/* Status */}
          <div className="form-field">
            <label className="form-label">
              {getStatusEmoji(candidate?.status)} STATUS
            </label>
            <select
              name="status"
              value={candidate?.status || "New"}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-select"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Passport Number */}
          <div className="form-field">
            <label className="form-label">
              <FiFileText /> 🛂 PASSPORT NUMBER
            </label>
            <input
              type="text"
              name="passportNo"
              value={candidate?.passportNo || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="S78965412"
            />
          </div>

          {/* Passport Expiry */}
          <div className="form-field">
            <label className="form-label">
              <FiCalendar /> 📅 PASSPORT EXPIRY
            </label>
            <input
              type="date"
              name="passportExpiry"
              value={candidate?.passportExpiry ? candidate.passportExpiry.split("T")[0] : ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
            />
          </div>

          {/* Aadhar Number */}
          <div className="form-field">
            <label className="form-label">
              <FiCreditCard /> 🪪 AADHAR NUMBER
            </label>
            <input
              type="text"
              name="aadhar"
              value={candidate?.aadhar || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="555421568954"
              maxLength="12"
            />
          </div>

          {/* Mobile Number */}
          <div className="form-field">
            <label className="form-label">
              <FiPhone /> 📱 MOBILE NUMBER
            </label>
            <input
              type="tel"
              name="contact"
              value={candidate?.contact || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="9514563254"
            />
          </div>

          {/* Position */}
          <div className="form-field">
            <label className="form-label">
              <FiBriefcase /> 💼 POSITION
            </label>
            <input
              type="text"
              name="Position"
              value={candidate?.Position || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="e.g., Welder"
            />
          </div>

          {/* Education */}
          <div className="form-field">
            <label className="form-label">
              <FiBook /> 🎓 EDUCATION
            </label>
            <input
              type="text"
              name="education"
              value={candidate?.education || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="e.g., Mcom"
            />
          </div>

          {/* Experience */}
          <div className="form-field">
            <label className="form-label">
              <FiBriefcase /> 🛠️ EXPERIENCE (YEARS)
            </label>
            <input
              type="number"
              name="experience"
              value={candidate?.experience || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="1"
              min="0"
            />
          </div>

          {/* 🔥 FULL ADDRESS - NEXT TO EXPERIENCE (SAME ROW) */}
          <div className="form-field">
            <label className="form-label">
              <FiMapPin /> 🏠 FULL ADDRESS
            </label>
            <input
              type="text"
              name="address"
              value={candidate?.address || ""}
              onChange={handleTextChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="Complete residential address"
            />
          </div>

          {/* Additional Notes - Full Width */}
          {/* Additional Notes - Reduced Height */}
<div className="form-field form-field-full">
  <label className="form-label">
    <FiFileText /> 📝 ADDITIONAL NOTES
  </label>
  <textarea
    name="notes"
    value={candidate?.notes || ""}
    onChange={handleTextChange}
    disabled={!isEditing}
    className="form-textarea"
    placeholder="Any additional information about the candidate..."
    rows="3"  // 🔥 CHANGED FROM 4 TO 3
  />
</div>

        </div>

      </div>

      {/* Recycle Bin Section */}
      <div className="recycle-bin-section">
        <div className="recycle-bin-content">
          <div className="recycle-bin-icon">
            <FiTrash2 />
          </div>
          <div className="recycle-bin-text">
            <h3 className="recycle-bin-title">
              🗑️ Move to Recycle Bin
            </h3>
            <p className="recycle-bin-description">
              Moves candidate and all linked records to Recycle Bin. Restore is possible.
            </p>
          </div>
          <button
            className="recycle-bin-btn"
            onClick={handleDeleteCandidate}
          >
            <FiTrash2 /> Delete Candidate
          </button>
        </div>
      </div>
    </div>
  );
}

export default CandidateProfile;
