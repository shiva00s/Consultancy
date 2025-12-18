import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft, FiEdit, FiX, FiSave,
  FiRefreshCw, FiUpload, FiDownload, 
  FiAlertTriangle, FiUser , 
  FiCamera, FiTrash2,
} from "react-icons/fi";
import toast from "react-hot-toast";
import "../css/CandidateDetailPage.css";
import Tabs from "../components/Tabs";
import CandidateProfile from "../components/candidate-detail/CandidateProfile";
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
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [selectedJobForOffer, setSelectedJobForOffer] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  
  // --- GRANULAR PERMISSION STATE ---
  const [granularPermissions, setGranularPermissions] = useState({});
  const [granularPermsLoaded, setGranularPermsLoaded] = useState(false);
  
  // ✅ ACTIVE TAB STATE
  const initialTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  // ... (keep all your existing functions - fetchDetails, loadCandidatePhoto, etc.)

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

  // ✅ Load candidate photo
  const loadCandidatePhoto = useCallback(async () => {
    if (id) {
      const result = await window.electronAPI.getCandidatePhoto({ candidateId: parseInt(id) });
      if (result.success && result.photoUrl) {
        setPhotoUrl(result.photoUrl);
      }
    }
  }, [id]);

  useEffect(() => {
    loadCandidatePhoto();
  }, [loadCandidatePhoto]);

  // 📸 Handle photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoUrl(e.target.result);
      setPhotoFile(file);
      toast.success('Photo selected. Click "Save Changes" to upload.');
    };
    reader.readAsDataURL(file);
  };

  // 🗑️ Remove photo
  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove this photo?')) return;

    try {
      const result = await window.electronAPI.deleteCandidatePhoto({ candidateId: parseInt(id) });
      if (result.success) {
        setPhotoUrl(null);
        setPhotoFile(null);
        toast.success('Photo removed successfully');
      } else {
        toast.error('Failed to remove photo: ' + result.error);
      }
    } catch (error) {
      toast.error('Error removing photo');
    }
  };

  // 📤 Upload photo to backend
  const uploadPhoto = async () => {
    if (!photoFile) return true;

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const photoResult = await window.electronAPI.uploadCandidatePhoto({
              candidateId: parseInt(id),
              fileBuffer: Array.from(new Uint8Array(reader.result)),
              fileName: photoFile.name
            });

            if (photoResult.success) {
              toast.success('📷 Photo uploaded successfully!');
              setPhotoFile(null);
              await loadCandidatePhoto();
              resolve(true);
            } else {
              toast.error('Failed to upload photo: ' + photoResult.error);
              resolve(false);
            }
          } catch (error) {
            console.error('Photo upload error:', error);
            toast.error('Failed to upload photo');
            resolve(false);
          } finally {
            setIsUploadingPhoto(false);
          }
        };

        reader.onerror = () => {
          toast.error('Failed to read photo file');
          setIsUploadingPhoto(false);
          resolve(false);
        };

        reader.readAsArrayBuffer(photoFile);
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo');
      setIsUploadingPhoto(false);
      return false;
    }
  };

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
        const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
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
      const res = await window.electronAPI.getCandidatePlacements({ candidateId: id });
      if (res.success && res.data.length > 0) {
        setPlacements(res.data);
        const latestJob = res.data.reduce((latest, current) =>
          current.placementId > latest.placementId ? current : latest
        );
        setSelectedJobForOffer(latestJob.jobId);
      } else {
        setPlacements([]);
        setSelectedJobForOffer(null);
      }
    };
    fetchPlacements();
  }, [id, fetchDetails]);

  useEffect(() => {
    if (!details || !user?.id) return;
    window.electronAPI.logAuditEvent({
      action: "view_candidate_details",
      userId: user.id,
      candidateId: details.candidate.id,
    });
  }, [details, user]);

  const handleDocumentsUpdate = (newDocs = [], docIdToDelete = null, isCategoryUpdate = false) => {
    setDetails((prev) => {
      let updatedDocuments = [...(prev?.documents || [])];
      if (docIdToDelete !== null) {
        updatedDocuments = updatedDocuments.filter((doc) => doc.id !== docIdToDelete);
      } else if (isCategoryUpdate) {
        const updateDoc = newDocs[0];
        updatedDocuments = updatedDocuments.map((doc) =>
          doc.id === updateDoc.id ? { ...doc, category: updateDoc.category } : doc
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
      const res = await window.electronAPI.getCandidatePlacements({ candidateId: id });
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

    if (photoFile) {
      const photoSuccess = await uploadPhoto();
      if (!photoSuccess) {
        toast.error('Failed to upload photo. Other changes will still be saved.');
      }
    }

    const res = await window.electronAPI.updateCandidateText({ user, id, data: cleanedData });
    if (res.success) {
      toast.success("Details saved successfully!");
      setIsEditing(false);
      fetchDetails();
    } else {
      toast.error(res.error || "Failed to save changes");
    }
  };

  const handleDeleteCandidate = async () => {
    if (window.confirm("Are you sure you want to move this candidate to the Recycle Bin?")) {
      const res = await window.electronAPI.deleteCandidate({ user, id });
      if (res.success) {
        navigate("/search");
        toast.success(`Candidate ${details.candidate.name} moved to Recycle Bin.`);
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleExportDocuments = async () => {
    toast.loading("Preparing ZIP...", { id: "zip-status" });
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

    toast.loading("Exporting...", { id: "zip-status" });
    const res = await window.electronAPI.zipCandidateDocuments({
      user,
      candidateId: id,
      destinationPath: dialogResult.filePath,
    });

    toast.dismiss("zip-status");
    if (res.success) toast.success(`Documents successfully exported!`);
    else toast.error(res.error || "Failed to create ZIP archive.");
  };

  if (loading || !granularPermsLoaded)
    return (
      <div className="detail-page-loading">
        <div className="detail-loading-spinner"></div>
        <p>Loading candidate details...</p>
      </div>
    );

  if (!details || !details.candidate)
    return (
      <div className="detail-page-loading">
        <FiAlertTriangle size={48} />
        <p>Candidate not found</p>
      </div>
    );

  const { candidate } = details;

  // 🎯 TABS CONFIGURATION - Only metadata for tabs
  // 🎯 TABS CONFIGURATION - FIXED WITH EMOJI STRINGS
const tabsConfig = [
  {
    key: "profile",
    label: "Profile",
    icon: "👤",  // ✅ EMOJI STRING
    content: (
      <CandidateProfile
        candidate={candidate}
        statusOptions={statusOptions}
        isEditing={isEditing}
        photoUrl={photoUrl}
        handleTextChange={handleTextChange}
        handleSave={handleSave}
        handleDeleteCandidate={handleDeleteCandidate}
        handleExportDocuments={handleExportDocuments}
        handlePhotoChange={handlePhotoChange}
        handleRemovePhoto={handleRemovePhoto}
        setIsEditing={setIsEditing}
        setFormData={setFormData}
        user={user}
        loadCandidatePhoto={loadCandidatePhoto}
      />
    ),
  },
  {
    key: "passport",
    label: "Passport",
    icon: "🛂",  // ✅ EMOJI STRING
    content: <CandidatePassport candidateId={id} user={user} />,
    permission: "tab_passport",
  },
  {
    key: "documents",
    label: "Documents",
    icon: "📄",  // ✅ EMOJI STRING
    content: (
      <CandidateDocuments
        candidate={candidate}
        documents={details.documents}
        user={user}
        onUpdate={handleDocumentsUpdate}
      />
    ),
    permission: "tab_documents",
  },
  {
    key: "jobs",
    label: "Job Placements",
    icon: "💼",  // ✅ EMOJI STRING
    content: (
      <CandidateJobs
        candidateId={id}
        user={user}
        onJobAssigned={handleJobAssigned}
      />
    ),
    permission: "tab_job_placements",
  },
  {
    key: "visa",
    label: "Visa Tracking",
    icon: "✈️",  // ✅ EMOJI STRING
    content: <CandidateVisa candidateId={id} user={user} />,
    permission: "tab_visa_tracking",
  },
  {
    key: "finance",
    label: "Financial",
    icon: "💰",  // ✅ EMOJI STRING
    content: <CandidateFinance candidateId={id} user={user} />,
    permission: "tab_financial",
  },
  {
    key: "medical",
    label: "Medical",
    icon: "🏥",  // ✅ EMOJI STRING
    content: <CandidateMedical candidateId={id} user={user} />,
    permission: "tab_medical",
  },
  {
    key: "interview",
    label: "Interview",
    icon: "📋",  // ✅ EMOJI STRING
    content: <CandidateInterview candidateId={id} user={user} />,
    permission: "tab_interview",
  },
  {
    key: "travel",
    label: "Travel/Tickets",
    icon: "🧳",  // ✅ EMOJI STRING
    content: <CandidateTravel candidateId={id} user={user} />,
    permission: "tab_travel",
  },
  {
    key: "offer",
    label: "Offer Letter",
    icon: "📜",  // ✅ EMOJI STRING
    content: (
      <OfferLetterGenerator
        candidateId={id}
        candidateName={candidate.name}
        jobOrderId={selectedJobForOffer}
        placements={placements}
        user={user}
      />
    ),
    permission: "tab_offer_letter",
  },
  {
    key: "history",
    label: "History",
    icon: "🕐",  // ✅ EMOJI STRING (changed from 📜 to avoid duplicate)
    content: <CandidateHistory candidateId={id} user={user} />,
    permission: "tab_history",
  },
  {
    key: "comms",
    label: "Communications Log",
    icon: "💬",  // ✅ EMOJI STRING
    content: <CommunicationHistory candidateId={id} user={user} />,
    permission: "tab_comms_log",
  },
];


  // Filter tabs based on permissions
  const visibleTabs = tabsConfig.filter((tab) => {
    if (!tab.permission) return true;
    return granularPermissions[tab.permission] === true;
  });

  // 🎯 RENDER TAB CONTENT
  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <CandidateProfile
            candidate={candidate}
            statusOptions={statusOptions}
            isEditing={isEditing}
            photoUrl={photoUrl}
            handleTextChange={handleTextChange}
            handleSave={handleSave}
            handleDeleteCandidate={handleDeleteCandidate}
            handleExportDocuments={handleExportDocuments}
            handlePhotoChange={handlePhotoChange}
            handleRemovePhoto={handleRemovePhoto}
            setIsEditing={setIsEditing}
            setFormData={setFormData}
            user={user}
            loadCandidatePhoto={loadCandidatePhoto}
          />
        );
      case "passport":
        return <CandidatePassport candidateId={id} user={user} />;
      case "documents":
        return (
          <CandidateDocuments
            candidate={candidate}
            documents={details.documents}
            user={user}
            onUpdate={handleDocumentsUpdate}
          />
        );
      case "jobs":
        return (
          <CandidateJobs
            candidateId={id}
            user={user}
            onJobAssigned={handleJobAssigned}
          />
        );
      case "visa":
        return <CandidateVisa candidateId={id} user={user} />;
      case "finance":
        return <CandidateFinance candidateId={id} user={user} />;
      case "medical":
        return <CandidateMedical candidateId={id} user={user} />;
      case "interview":
        return <CandidateInterview candidateId={id} user={user} />;
      case "travel":
        return <CandidateTravel candidateId={id} user={user} />;
      case "offer":
        return (
          <OfferLetterGenerator
            candidateId={id}
            candidateName={candidate.name}
            jobOrderId={selectedJobForOffer}
            placements={placements}
            user={user}
          />
        );
      case "history":
        return <CandidateHistory candidateId={id} user={user} />;
      case "comms":
        return <CommunicationHistory candidateId={id} user={user} />;
      default:
        return <div>Tab content not found</div>;
    }
  };

  return (
    <div className="candidate-detail-page">
      {/* HEADER - Keep as is */}
      <div className="detail-page-header">
        <div className="detail-header-back" onClick={() => navigate("/search")}>
          <FiArrowLeft />
        </div>

        {/* PHOTO */}
        <div
          className="detail-header-photo"
          onMouseEnter={() => setShowPhotoActions(true)}
          onMouseLeave={() => setShowPhotoActions(false)}
        >
          <div className="detail-photo-wrapper">
            {photoUrl ? (
              <img src={photoUrl} alt={candidate.name} className="detail-photo-img" />
            ) : (
              <div className="detail-photo-placeholder">
                <FiUser />
              </div>
            )}
            <div className="detail-photo-badge">
              <FiCamera />
            </div>
          </div>

          {/* Photo Actions Dropdown */}
          {showPhotoActions && (
            <div className="detail-photo-actions">
              <label className="photo-action-item upload">
                <FiUpload /> Upload New
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="photo-action-item refresh" onClick={loadCandidatePhoto}>
                <FiRefreshCw /> Refresh
              </button>
              {photoUrl && (
                <button className="photo-action-item delete" onClick={handleRemovePhoto}>
                  <FiTrash2 /> Remove
                </button>
              )}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="detail-header-info">
          <h1 className="detail-candidate-name">
            <span className="detail-candidate-name-emoji">👤</span>
            {candidate.name}
          </h1>
          <div className="detail-badges">
            <span className="detail-badge badge-id">🆔 ID #{candidate.id}</span>
            <span className="detail-badge badge-passport">🛂 {candidate.passportNo}</span>
            <span className="detail-badge badge-new">
              {candidate.status === 'New' ? '🆕' : '📌'} {candidate.status}
            </span>
          </div>

          {/* Quick Info Cards */}
          <div className="detail-quick-cards">
            <div className="detail-quick-card card-passport">
              <div className="detail-quick-icon">🛂</div>
              <div className="detail-quick-content">
                <div className="detail-quick-label">Passport</div>
                <div className="detail-quick-value">{candidate.passportNo}</div>
              </div>
            </div>
            <div className="detail-quick-card card-mobile">
              <div className="detail-quick-icon">📱</div>
              <div className="detail-quick-content">
                <div className="detail-quick-label">Mobile</div>
                <div className="detail-quick-value">{candidate.contact || "N/A"}</div>
              </div>
            </div>
            <div className="detail-quick-card card-aadhar">
              <div className="detail-quick-icon">🪪</div>
              <div className="detail-quick-content">
                <div className="detail-quick-label">Aadhar</div>
                <div className="detail-quick-value">{candidate.aadhar || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="detail-actions">
          {isEditing ? (
            <>
              <button className="detail-action-btn btn-save" onClick={handleSave}>
                <FiSave /> Save
              </button>
              <button className="detail-action-btn btn-cancel" onClick={() => setIsEditing(false)}>
                <FiX /> Cancel
              </button>
            </>
          ) : (
            <>
              <button className="detail-action-btn btn-edit" onClick={() => setIsEditing(true)}>
                <FiEdit /> Edit
              </button>
              <button className="detail-action-btn btn-export" onClick={handleExportDocuments}>
                <FiDownload /> Export Docs
              </button>
              <button className="detail-action-btn btn-delete" onClick={handleDeleteCandidate}>
                <FiTrash2 /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* ✅ TABS + CONTENT */}
      <div className="detail-tabs-section">
        <Tabs
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        {/* Tab Content */}
        <div className="tab-content-wrapper">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default CandidateDetailPage;
