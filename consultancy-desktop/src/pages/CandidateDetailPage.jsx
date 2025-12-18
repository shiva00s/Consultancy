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
  FiMessageSquare,
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

  // --- GRANULAR PERMISSION STATE ---
  const [granularPermissions, setGranularPermissions] = useState({});
  const [granularPermsLoaded, setGranularPermsLoaded] = useState(false);

  const initialTab = searchParams.get("tab") || "profile";

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
      const result = await window.electronAPI.getCandidatePhoto({
        candidateId: parseInt(id),
      });
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

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo size must be less than 5MB");
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
    if (!window.confirm("Are you sure you want to remove this photo?")) return;

    try {
      const result = await window.electronAPI.deleteCandidatePhoto({
        candidateId: parseInt(id),
      });
      if (result.success) {
        setPhotoUrl(null);
        setPhotoFile(null);
        toast.success("Photo removed successfully");
      } else {
        toast.error("Failed to remove photo: " + result.error);
      }
    } catch (error) {
      toast.error("Error removing photo");
    }
  };

  // 📤 Upload photo to backend
  const uploadPhoto = async () => {
    if (!photoFile) return true;

    try {
      const reader = new FileReader();

      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const photoResult = await window.electronAPI.uploadCandidatePhoto({
              candidateId: parseInt(id),
              fileBuffer: Array.from(new Uint8Array(reader.result)),
              fileName: photoFile.name,
            });

            if (photoResult.success) {
              toast.success("📷 Photo uploaded successfully!");
              setPhotoFile(null);
              await loadCandidatePhoto();
              resolve(true);
            } else {
              toast.error("Failed to upload photo: " + photoResult.error);
              resolve(false);
            }
          } catch (error) {
            console.error("Photo upload error:", error);
            toast.error("Failed to upload photo");
            resolve(false);
          }
        };

        reader.onerror = () => {
          toast.error("Failed to read photo file");
          resolve(false);
        };

        reader.readAsArrayBuffer(photoFile);
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.error("Failed to upload photo");
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

  const handleDocumentsUpdate = (
    newDocs = [],
    docIdToDelete = null,
    isCategoryUpdate = false
  ) => {
    setDetails((prev) => {
      let updatedDocuments = [...(prev?.documents || [])];
      if (docIdToDelete !== null) {
        updatedDocuments = updatedDocuments.filter(
          (doc) => doc.id !== docIdToDelete
        );
      } else if (isCategoryUpdate) {
        const updateDoc = newDocs[0];
        updatedDocuments = updatedDocuments.map((doc) =>
          doc.id === updateDoc.id
            ? { ...doc, category: updateDoc.category }
            : doc
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

    // 📤 Upload photo first if selected
    if (photoFile) {
      const photoSuccess = await uploadPhoto();
      if (!photoSuccess) {
        toast.error(
          "Failed to upload photo. Other changes will still be saved."
        );
      }
    }

    const res = await window.electronAPI.updateCandidateText({
      user,
      id,
      data: cleanedData,
    });

    if (res.success) {
      toast.success("Details saved successfully!");
      setIsEditing(false);
      fetchDetails();
    } else {
      toast.error(res.error || "Failed to save changes");
    }
  };

  const handleDeleteCandidate = async () => {
    if (
      window.confirm(
        "Are you sure you want to move this candidate to the Recycle Bin?"
      )
    ) {
      const res = await window.electronAPI.deleteCandidate({ user, id });
      if (res.success) {
        navigate("/search");
        toast.success(
          `Candidate ${details.candidate.name} moved to Recycle Bin.`
        );
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
    return <h2>Loading Candidate Details...</h2>;
  if (!details) return <h2>Candidate not found.</h2>;

  const { candidate, documents } = details;

  // --- GRANULAR PERMISSION CHECKER ---
  const canAccessTab = (permissionKey) => {
    if (permissionKey === "tab_profile") return true;
    return granularPermissions[permissionKey] === true;
  };

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
        <label>Select Job Assignment:</label>
        <select
          value={selectedJobForOffer || ""}
          onChange={(e) =>
            setSelectedJobForOffer(
              e.target.value ? parseInt(e.target.value) : null
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

  const tabConfig = [
    {
      key: "profile",
      title: "Profile",
      icon: <FiUser />,
      content: (
        <CandidateProfile
          candidate={formData}
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
      permKey: "tab_profile",
    },
    {
      key: "passport",
      title: "Passport Tracking",
      icon: <FiPackage />,
      content: <CandidatePassport candidateId={id} documents={documents} />,
      permKey: "tab_passport",
    },
    {
      key: "documents",
      title: `Documents (${documents.length})`,
      icon: <FiFileText />,
      content: DocumentTabContent,
      permKey: "tab_documents",
    },
    {
      key: "jobs",
      title: "Job Placements",
      icon: <FiClipboard />,
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
      title: "Visa Tracking",
      icon: <FiPackage />,
      content: <CandidateVisa user={user} candidateId={id} />,
      permKey: "tab_visa_tracking",
    },
    {
      key: "finance",
      title: "Financial Tracking",
      icon: <FiDollarSign />,
      content: <CandidateFinance user={user} candidateId={id} flags={flags} />,
      permKey: "tab_financial",
    },
    {
      key: "medical",
      title: "Medical",
      icon: <FiUsers />,
      content: <CandidateMedical user={user} candidateId={id} />,
      permKey: "tab_medical",
    },
    {
      key: "interview",
      title: "Interview/Schedule",
      icon: <FiCalendar />,
      content: <CandidateInterview user={user} candidateId={id} />,
      permKey: "tab_interview",
    },
    {
      key: "travel",
      title: "Travel/Tickets",
      icon: <FiSend />,
      content: <CandidateTravel user={user} candidateId={id} />,
      permKey: "tab_travel",
    },
    {
      key: "offer",
      title: "Offer Letter",
      icon: <FiFileText />,
      content: OfferLetterTabContent,
      permKey: "tab_offer_letter",
    },
    {
      key: "history",
      title: "History",
      icon: <FiClock />,
      content: <CandidateHistory candidateId={id} />,
      permKey: "tab_history",
    },
    {
      key: "communications",
      title: "Comms Log",
      icon: <FiMessageSquare />,
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
          className="btn btn-secondary back-button"
          style={{
            marginBottom: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiArrowLeft /> Back to Search
        </button>

        <div style={{ textAlign: "right" }}>
          <h1
            style={{
              margin: "0 0 5px 0",
              fontSize: "1.8rem",
              color: "var(--text-primary)",
            }}
          >
            <FiUser style={{ marginRight: "10px", verticalAlign: "middle" }} />
            {formData?.name || candidate.name}
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
              <strong>ID:</strong> #{candidate.id}
            </span>
            <span>
              <strong>Passport:</strong>{" "}
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
              {formData?.status || candidate.status}
            </span>
          </div>
        </div>
      </div>

      <Tabs tabs={tabConfig} defaultActiveTab={initialTab} />
    </div>
  );
}

export default CandidateDetailPage;
