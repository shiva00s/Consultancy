import React from "react";
import { FiDownload, FiAlertTriangle } from "react-icons/fi";

const ProfileTab = ({
  candidate,
  formData,
  isEditing,
  statusOptions,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onExport,
  user,
  candidateId,
  onEditToggle
}) => {
  return (
    <div className="profile-tab-content">
      <div className="detail-card" style={{ border: "none", margin: 0 }}>
        <div className="detail-header" style={{ borderRadius: "var(--border-radius)" }}>
          <h2>{isEditing ? "Edit Profile" : "Profile Overview"}</h2>
          <div className="header-actions">
            {isEditing ? (
              <>
                <button className="btn" onClick={onSave}>
                  Save Changes
                </button>
                <button className="btn btn-secondary" onClick={onCancel}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={onExport}>
                  <FiDownload /> Export Documents
                </button>
                <button className="btn" onClick={onEditToggle}>
                  Edit Details
                </button>
              </>
            )}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            {isEditing ? (
              <select name="status" value={formData.status} onChange={onChange}>
                {statusOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={formData.status} readOnly />
            )}
          </div>

          <div className="form-group">
            <label>Contact Number</label>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="text"
                name="contact"
                value={formData.contact || ""}
                onChange={onChange}
                readOnly={!isEditing}
                style={{ flexGrow: 1 }}
              />
              {formData.contact && (
                <button
                  className="btn"
                  style={{
                    backgroundColor: "#25D366",
                    color: "white",
                    padding: "0 12px",
                    minWidth: "auto"
                  }}
                  title="Chat on WhatsApp"
                  type="button"
                  onClick={() => {
                    window.open(`https://wa.me/${formData.contact.replace(/\D/g, "")}`, "_blank");
                    window.electronAPI.logCommunication({
                      user,
                      candidateId,
                      type: "WhatsApp",
                      details: "Clicked Chat Button"
                    });
                  }}
                >
                  <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>✆</span>
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Aadhar Number</label>
            <input
              type="text"
              name="aadhar"
              value={formData.aadhar || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Passport No</label>
            <input
              type="text"
              name="passportNo"
              value={formData.passportNo}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Passport Expiry</label>
            <input
              type="date"
              name="passportExpiry"
              value={formData.passportExpiry || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Position Applying For</label>
            <input
              type="text"
              name="Position"
              value={formData.Position}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Education</label>
            <input
              type="text"
              name="education"
              value={formData.education || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Experience (years)</label>
            <input
              type="number"
              name="experience"
              value={formData.experience || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group">
            <label>Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={formData.dob || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>

          <div className="form-group full-width">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes || ""}
              onChange={onChange}
              readOnly={!isEditing}
            />
          </div>
        </div>
      </div>

      <div className="detail-card delete-zone">
        <h3>Move Candidate to Recycle Bin</h3>
        <p>Moves candidate and all linked records to Recycle Bin. Restore is possible.</p>
        <button className="btn btn-danger" onClick={onDelete}>
          <FiAlertTriangle /> Move to Recycle Bin
        </button>
      </div>
    </div>
  );
};

export default ProfileTab;
