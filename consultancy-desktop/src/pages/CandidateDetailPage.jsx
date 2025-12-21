import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiUser,
  FiFileText,
  FiPackage,
  FiClipboard,
  FiDollarSign,
  FiUsers,
  FiCalendar,
  FiSend,
  FiClock,
  FiArrowLeft,
  FiDownload,
  FiAlertTriangle,
  FiMessageSquare,
} from "react-icons/fi";
import toast from "react-hot-toast";

import "../css/CandidateDetailPage.css";
import LazyRemoteImage from "../components/common/LazyRemoteImage"; 
import UniversalTabs from "../components/common/UniversalTabs"; 
import CandidateFinance from "../components/candidate-detail/CandidateFinance";
import CandidateVisa from "../components/candidate-detail/CandidateVisa";
import CandidateJobs from "../components/candidate-detail/CandidateJobs";
import CandidateMedical from "../components/candidate-detail/CandidateMedical";
import CandidateInterview from "../components/candidate-detail/CandidateInterview";
import CandidateTravel from "../components/candidate-detail/CandidateTravel";
import OfferLetterGenerator from "../components/candidate-detail/OfferLetterGenerator";
import CandidateHistory from "../components/candidate-detail/CandidateHistory";
import CandidateDocuments from "../components/candidate-detail/CandidateDocuments";
import CandidatePassport from "../components/candidate-detail/CandidatePassport";
import CommunicationHistory from "../components/candidate-detail/CommunicationHistory";
import ConfirmDialog from "../components/common/ConfirmDialog";

const statusOptions = [
  "New",
  "Documents Collected",
  "Visa Applied",
  "In Progress",
  "Completed",
  "Rejected",
];

function CandidateDetailPage({ user, flags }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [selectedJobForOffer, setSelectedJobForOffer] = useState(null);

  // --- GRANULAR PERMISSION STATE ---
  const [granularPermissions, setGranularPermissions] = useState({});
  const [granularPermsLoaded, setGranularPermsLoaded] = useState(false);

  const initialTab = searchParams.get("tab") || "profile";

  // ... (keep all your existing functions: fetchDetails, loadGranularPermissions, etc.)

  // 1. Fetch Candidate Details
  const fetchDetails = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getCandidateDetails({ id, user });
    if (res.success) {
      setDetails(res.data);
      setFormData(res.data.candidate);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }, [id, user]);

  // 2. Load Granular Permissions
  useEffect(() => {
    const loadGranularPermissions = async () => {
      if (user.role === "super_admin") {
        const allPerms = {
          tab_profile: true,
          tab_passport: true,
          tab_documents: true,
          tab_job_placements: true,
          tab_visa_tracking: true,
          tab_financial: true,
          tab_medical: true,
          tab_interview: true,
          tab_travel: true,
          tab_offer_letter: true,
          tab_history: true,
          tab_comms_log: true,
        };
        setGranularPermissions(allPerms);
        setGranularPermsLoaded(true);
      } else {
        const res = await window.electronAPI.getUserGranularPermissions({
          userId: user.id,
        });
        if (res.success) {
          setGranularPermissions(res.data || {});
        }
        setGranularPermsLoaded(true);
      }
    };
    loadGranularPermissions();
  }, [user]);

  useEffect(() => {
    fetchDetails();

    const fetchPlacements = async () => {
      const res = await window.electronAPI.getCandidatePlacements({
        candidateId: id,
      });
      if (res.success && res.data.length > 0) {
        setPlacements(res.data);
        const latestJob = res.data.reduce((latest, current) =>
          current.placementId > latest.placementId ? current : latest,
        );
        setSelectedJobForOffer(latestJob.jobId);
      } else {
        setPlacements([]);
        setSelectedJobForOffer(null);
      }
    };
    fetchPlacements();
  }, [id, fetchDetails]);

  // Load candidate photo once details are available
  useEffect(() => {
    const loadPhoto = async () => {
      try {
        const photoPath = details?.candidate?.photo_path || details?.candidate?.photoPath || null;
        if (!photoPath) {
          setPhotoUrl(null);
          return;
        }
        const res = await window.electronAPI.getImageBase64({ filePath: photoPath });
        if (res && res.success) setPhotoUrl(res.data);
        else setPhotoUrl(null);
      } catch (err) {
        console.error('Failed to load candidate photo:', err);
        setPhotoUrl(null);
      }
    };
    loadPhoto();
  }, [details]);

  useEffect(() => {
    if (!details || !user?.id) return;

    window.electronAPI.logAuditEvent({
      action: "view_candidate_details",
      userId: user.id,
      candidateId: details.candidate.id,
    });
  }, [details, user]);

  const handleDocumentsUpdate = (
    newDocs = [],
    docIdToDelete = null,
    isCategoryUpdate = false,
  ) => {
    setDetails((prev) => {
      let updatedDocuments = [...(prev?.documents || [])];
      if (docIdToDelete !== null) {
        updatedDocuments = updatedDocuments.filter(
          (doc) => doc.id !== docIdToDelete,
        );
      } else if (isCategoryUpdate) {
        const updateDoc = newDocs[0];
        updatedDocuments = updatedDocuments.map((doc) =>
          doc.id === updateDoc.id
            ? { ...doc, category: updateDoc.category }
            : doc,
        );
      } else if (newDocs.length > 0) {
        updatedDocuments = [...updatedDocuments, ...newDocs];
      }
      return { ...prev, documents: updatedDocuments };
    });
  };

  const handleJobAssigned = (newJobId) => {
    setSelectedJobForOffer(newJobId);
    const fetchPlacements = async () => {
      const res = await window.electronAPI.getCandidatePlacements({
        candidateId: id,
      });
      if (res.success) setPlacements(res.data);
    };
    fetchPlacements();
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const cleanedData = {
      ...formData,
      passportNo: formData.passportNo
        ? formData.passportNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
        : formData.passportNo,
    };

    const res = await window.electronAPI.updateCandidateText({
      user,
      id,
      data: cleanedData,
    });

    if (res.success) {
      toast.success("✅ Details saved successfully!");
      setIsEditing(false);
      fetchDetails();
    } else {
      toast.error(res.error || "Failed to save changes");
    }
  };

  const handleDeleteCandidate = async () => {
    // open confirm dialog instead of native confirm
    setDeleteConfirmOpen(true);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const performDeleteCandidate = async () => {
    const res = await window.electronAPI.deleteCandidate({ user, id });
    if (res.success) {
      navigate("/search");
      toast.success(`🗑️ Candidate ${details.candidate.name} moved to Recycle Bin.`);
    } else {
      toast.error(res.error);
    }
    setDeleteConfirmOpen(false);
  };

  const handleExportDocuments = async () => {
    toast.loading("📦 Preparing ZIP...", { id: "zip-status" });
    const dialogResult = await window.electronAPI.showSaveDialog({
      title: "Save Candidate Documents ZIP",
      defaultPath: `${details.candidate.name.replace(/\s/g, "_")}_Docs.zip`,
      buttonLabel: "Save ZIP",
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      toast.dismiss("zip-status");
      return;
    }

    toast.loading("📥 Exporting...", { id: "zip-status" });
    const res = await window.electronAPI.zipCandidateDocuments({
      user,
      candidateId: id,
      destinationPath: dialogResult.filePath,
    });
    toast.dismiss("zip-status");

    if (res.success) toast.success(`✅ Documents successfully exported!`);
    else toast.error(res.error || "Failed to create ZIP archive.");
  };

  // Upload / replace candidate photo by clicking the avatar
  const handleUploadPhoto = async (e) => {
    try {
      const pick = await window.electronAPI.openFileDialog({
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
      });

      if (!pick || !pick.success) return;

      toast.loading('⬆️ Uploading photo...', { id: 'photo-upload' });

      const { fileBuffer, fileName, filePath } = pick;

      const res = await window.electronAPI.uploadPhoto({
        candidateId: id,
        fileBuffer,
        fileName,
      });

      toast.dismiss('photo-upload');

      if (res && res.success) {
        const absolutePath = res.photoPath || filePath;
        const base = await window.electronAPI.getImageBase64({ filePath: absolutePath });
        if (base && base.success) setPhotoUrl(base.data);

        // update local details so UI reflects change immediately
        setDetails((prev) => ({
          ...prev,
          candidate: { ...(prev?.candidate || {}), photo_path: absolutePath },
        }));

        toast.success('✅ Photo updated');
      } else {
        toast.error(res?.error || 'Failed to upload photo');
      }
    } catch (err) {
      toast.dismiss('photo-upload');
      console.error('Photo upload failed', err);
      toast.error('Photo upload failed');
    }
  };

  if (loading || !granularPermsLoaded)
    return <h2>⏳ Loading Candidate Details...</h2>;
  if (!details) return <h2>⚠️ Candidate not found.</h2>;

  const { candidate, documents } = details;

  // --- GRANULAR PERMISSION CHECKER ---
  const canAccessTab = (permissionKey) => {
    if (permissionKey === "tab_profile") return true;
    return granularPermissions[permissionKey] === true;
  };

  // --- TAB CONTENT COMPONENTS ---
  const ProfileTabContent = (
    <div className="profile-tab-content">
      <div className="detail-card" style={{ border: "none", margin: 0 }}>
        <div
          className="detail-header"
          style={{ borderRadius: "var(--border-radius)" }}
        >
          <h2>{isEditing ? "✏️ Edit Profile" : "👤 Profile Overview"}</h2>
          <div className="header-actions">
            {isEditing ? (
              <>
                <button className="btn" onClick={handleSave}>
                  💾 Save Changes
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(candidate);
                  }}
                >
                  ❌ Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportDocuments}
                >
                  <FiDownload /> 📥 Export Documents
                </button>
                <button className="btn" onClick={() => setIsEditing(true)}>
                  ✏️ Edit Details
                </button>
              </>
            )}
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>👤 Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>📊 Status</label>
            {isEditing ? (
              <select
                name="status"
                value={formData.status}
                onChange={handleTextChange}
              >
                {statusOptions.map((opt) => (
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
            <label>📱 Contact Number</label>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="text"
                name="contact"
                value={formData.contact || ""}
                onChange={handleTextChange}
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
                    minWidth: "auto",
                  }}
                  title="Chat on WhatsApp"
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const phone = formData.contact.replace(/\D/g, "");

                    try {
                      window.open(`https://wa.me/${phone}`, "_blank");

                      const result = await window.electronAPI.logCommunication({
                        user: user,
                        candidateId: id,
                        communication_type: "WhatsApp",
                        details: `Opened WhatsApp chat with +${phone}`,
                      });

                      if (result.success) {
                        toast.success("✅ WhatsApp opened and logged");
                      } else {
                        toast.error("Failed to log: " + result.error);
                      }
                    } catch (err) {
                      toast.error("Error: " + err.message);
                    }
                  }}
                >
                  <FiMessageSquare style={{ fontSize: "1.1rem" }} />
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>🪪 Aadhar Number</label>
            <input
              type="text"
              name="aadhar"
              value={formData.aadhar || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>🛂 Passport No</label>
            <input
              type="text"
              name="passportNo"
              value={formData.passportNo}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>📅 Passport Expiry</label>
            <input
              type="date"
              name="passportExpiry"
              value={formData.passportExpiry || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>💼 Position Applying For</label>
            <input
              type="text"
              name="Position"
              value={formData.Position}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>🎓 Education</label>
            <input
              type="text"
              name="education"
              value={formData.education || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>📊 Experience (years)</label>
            <input
              type="number"
              name="experience"
              value={formData.experience || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>🎂 Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={formData.dob || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            />
          </div>
          <div className="form-group full-width">
            <label>📝 Notes</label>
            <textarea
              name="notes"
              value={formData.notes || ""}
              onChange={handleTextChange}
              readOnly={!isEditing}
            ></textarea>
          </div>
        </div>
      </div>
      <div className="detail-card delete-zone">
        <h3>🗑️ Move Candidate to Recycle Bin</h3>
        <p>
          Moves candidate and all linked records to Recycle Bin. Restore is
          possible.
        </p>
        <button className="btn btn-danger" onClick={handleDeleteCandidate}>
          <FiAlertTriangle /> ⚠️ Move to Recycle Bin
        </button>
      </div>
    </div>
  );

  const DocumentTabContent = (
    <CandidateDocuments
      user={user}
      candidateId={id}
      documents={documents}
      onDocumentsUpdate={handleDocumentsUpdate}
    />
  );

  const OfferLetterTabContent = (
    <div>
      <div
        className="form-group"
        style={{ maxWidth: "500px", marginBottom: "1.5rem" }}
      >
        <label>💼 Select Job Assignment:</label>
        <select
          value={selectedJobForOffer || ""}
          onChange={(e) =>
            setSelectedJobForOffer(
              e.target.value ? parseInt(e.target.value) : null,
            )
          }
        >
          <option value="">-- Select a Job --</option>
          {placements.length === 0 && (
            <option disabled>No jobs assigned</option>
          )}
          {placements.map((p) => (
            <option key={p.placementId} value={p.jobId}>
              {p.companyName} - {p.positionTitle}
            </option>
          ))}
        </select>
      </div>
      <OfferLetterGenerator
        user={user}
        candidateId={id}
        jobId={selectedJobForOffer}
      />
    </div>
  );

  // ✅ CONVERT TO UNIVERSAL TABS FORMAT
  const universalTabs = [
    {
      key: "profile",
      label: "Profile",
      icon: "👤",
      content: ProfileTabContent,
      permKey: "tab_profile",
    },
    {
      key: "passport",
      label: "Passport Tracking",
      icon: "🛂",
      content: <CandidatePassport candidateId={id} candidateData={candidate} />,
      permKey: "tab_passport",
    },
    {
      key: "documents",
      label: "Documents",
      icon: "📁",
      badge: documents.length > 0 ? `${documents.length}` : null,
      content: DocumentTabContent,
      permKey: "tab_documents",
    },
    {
      key: "jobs",
      label: "Job Placements",
      icon: "💼",
      content: (
        <CandidateJobs
          user={user}
          candidateId={id}
          onJobAssigned={handleJobAssigned}
        />
      ),
      permKey: "tab_job_placements",
    },
    {
      key: "visa",
      label: "Visa Tracking",
      icon: "✈️",
      content: <CandidateVisa user={user} candidateId={id} />,
      permKey: "tab_visa_tracking",
    },
    {
      key: "finance",
      label: "Financial Tracking",
      icon: "💰",
      content: <CandidateFinance user={user} candidateId={id} flags={flags} />,
      permKey: "tab_financial",
    },
    {
      key: "medical",
      label: "Medical",
      icon: "🏥",
      content: <CandidateMedical user={user} candidateId={id} />,
      permKey: "tab_medical",
    },
    {
      key: "interview",
      label: "Interview/Schedule",
      icon: "📋",
      content: <CandidateInterview user={user} candidateId={id} />,
      permKey: "tab_interview",
    },
    {
      key: "travel",
      label: "Travel/Tickets",
      icon: "🧳",
      content: <CandidateTravel user={user} candidateId={id} />,
      permKey: "tab_travel",
    },
    {
      key: "offer",
      label: "Offer Letter",
      icon: "📜",
      content: OfferLetterTabContent,
      permKey: "tab_offer_letter",
    },
    {
      key: "history",
      label: "History",
      icon: "🕐",
      content: <CandidateHistory candidateId={id} />,
      permKey: "tab_history",
    },
    {
      key: "communications",
      label: "Comms Log",
      icon: "💬",
      content: <CommunicationHistory candidateId={id} />,
      permKey: "tab_comms_log",
    },
  ].filter((tab) => canAccessTab(tab.permKey));

  return (
    <div className="detail-page-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "15px",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <button
          onClick={() => navigate("/search")}
          className="back-to-search-btn"
        >
          <FiArrowLeft size={16} />
          <span>Back to Search</span>
        </button>

        <div style={{ textAlign: "right" }}>
          <h1
            style={{
              margin: "0 0 5px 0",
              fontSize: "1.8rem",
              color: "var(--text-primary)",
            }}
          >
            {photoUrl ? (
              <LazyRemoteImage
                filePath={photoUrl}
                className="candidate-header-photo"
                onLoad={() => {}}
              />
            ) : (
              <div onClick={handleUploadPhoto} title="Click to add photo" style={{ display: 'inline-block', cursor: 'pointer', marginRight: 10 }}>
                <FiUser style={{ marginRight: "10px", verticalAlign: "middle" }} />
              </div>
            )}
            👤 {formData?.name || candidate.name}
          </h1>
          <div
            style={{
              display: "flex",
              gap: "15px",
              justifyContent: "flex-end",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
            }}
          >
            <span>
              <strong>🆔 ID:</strong> #{candidate.id}
            </span>
            <span>
              <strong>🛂 Passport:</strong>{" "}
              {formData?.passportNo || candidate.passportNo}
            </span>
            <span
              className="badge neutral"
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: "var(--bg-secondary)",
              }}
            >
              📊 {formData?.status || candidate.status}
            </span>
          </div>
        </div>
      </div>

      {/* ✅ USE UNIVERSAL TABS */}
      <UniversalTabs tabs={universalTabs} defaultActiveTab={initialTab} />
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Move Candidate to Recycle Bin"
        message={`⚠️ Move candidate ${candidate.name} to Recycle Bin? This will move all linked records.`}
        isDanger={true}
        confirmText="Move to Recycle Bin"
        cancelText="Cancel"
        onConfirm={performDeleteCandidate}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

export default CandidateDetailPage;
