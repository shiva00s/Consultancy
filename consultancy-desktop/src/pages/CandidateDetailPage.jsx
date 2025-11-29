import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FiUser, FiFileText, FiPackage, FiClipboard, FiDollarSign, FiUsers, FiCalendar, FiSend, FiClock } from "react-icons/fi";
import toast from "react-hot-toast";
import "../css/CandidateDetailPage.css";
import Tabs from "../components/Tabs";
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
import CandidateHeaderBar from "../components/candidate-detail/CandidateHeaderBar";
import ProfileTab from "../components/candidate-detail/ProfileTab";
import CandidateHeader from "../components/candidate-detail/CandidateHeader";
import DocumentChecker from "../components/candidate-detail/DocumentChecker";
import ExperienceTab from "../components/candidate-detail/ExperienceTab";
import SkillsTab from "../components/candidate-detail/SkillsTab";
import PersonalInfoTab from "../components/candidate-detail/PersonalInfoTab";
import DocumentSection from "../components/candidate-detail/DocumentSection";
import HistoryTimeline from "../components/candidate-detail/HistoryTimeline";


const statusOptions = ["New", "Documents Collected", "Visa Applied", "In Progress", "Completed", "Rejected"];

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

  const [staffPermissions, setStaffPermissions] = useState({});
  const [permsLoaded, setPermsLoaded] = useState(false);

  const initialTab = searchParams.get("tab") || "profile";

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getCandidateDetails({ id });
    if (res.success) {
      setDetails(res.data);
      setFormData(res.data.candidate);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const loadPermissions = async () => {
      if (user.role === "staff") {
        const res = await window.electronAPI.getUserPermissions({ userId: user.id });
        if (res.success) setStaffPermissions(res.data || {});
      }
      setPermsLoaded(true);
    };
    loadPermissions();
  }, [user]);

  useEffect(() => {
    fetchDetails();
    const fetchPlacements = async () => {
      const res = await window.electronAPI.getCandidatePlacements({ candidateId: id });
      if (res.success && res.data.length > 0) {
        setPlacements(res.data);
        const latestJob = res.data.reduce((latest, current) => (current.placementId > latest.placementId ? current : latest));
        setSelectedJobForOffer(latestJob.jobId);
      } else {
        setPlacements([]);
        setSelectedJobForOffer(null);
      }
    };
    fetchPlacements();
  }, [id, fetchDetails]);

  const handleDocumentsUpdate = (newDocs = [], docIdToDelete = null, isCategoryUpdate = false) => {
    setDetails(prev => {
      let updatedDocuments = [...(prev?.documents || [])];
      if (docIdToDelete !== null) {
        updatedDocuments = updatedDocuments.filter(doc => doc.id !== docIdToDelete);
      } else if (isCategoryUpdate) {
        const updateDoc = newDocs;
        updatedDocuments = updatedDocuments.map(doc => (doc.id === updateDoc.id ? { ...doc, category: updateDoc.category } : doc));
      } else if (newDocs.length > 0) {
        updatedDocuments = [...updatedDocuments, ...newDocs];
      }
      return { ...prev, documents: updatedDocuments };
    });
  };

  const handleJobAssigned = newJobId => {
    setSelectedJobForOffer(newJobId);
    const fetchPlacements = async () => {
      const res = await window.electronAPI.getCandidatePlacements({ candidateId: id });
      if (res.success) setPlacements(res.data);
    };
    fetchPlacements();
  };

  const handleTextChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const res = await window.electronAPI.updateCandidateText({ user, id, data: formData });
    if (res.success) {
      toast.success("Details saved successfully!");
      setIsEditing(false);
      fetchDetails();
    } else {
      toast.error(res.error);
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
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
    });
    if (dialogResult.canceled || !dialogResult.filePath) {
      toast.dismiss("zip-status");
      return;
    }
    toast.loading("Exporting...", { id: "zip-status" });
    const res = await window.electronAPI.zipCandidateDocuments({
      user,
      candidateId: id,
      destinationPath: dialogResult.filePath
    });
    toast.dismiss("zip-status");
    if (res.success) toast.success("Documents successfully exported!");
    else toast.error(res.error || "Failed to create ZIP archive.");
  };

  if (loading || !permsLoaded) return <h2>Loading Candidate Details...</h2>;
  if (!details) return <h2>Candidate not found.</h2>;

  const { candidate, documents } = details;

  const canAccess = featureKey => {
    if (!flags) return false;
    if (!flags[featureKey]) return false;
    if (user.role === "super_admin") return true;
    if (user.role === "admin") return true;
    if (user.role === "staff") return staffPermissions[featureKey] === true;
    return false;
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
      <div className="form-group" style={{ maxWidth: "500px", marginBottom: "1.5rem" }}>
        <label>Select Job Assignment:</label>
        <select
          value={selectedJobForOffer || ""}
          onChange={e => setSelectedJobForOffer(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">-- Select a Job --</option>
          {placements.length === 0 && <option disabled>No jobs assigned</option>}
          {placements.map(p => (
            <option key={p.placementId} value={p.jobId}>
              {p.companyName} - {p.positionTitle}
            </option>
          ))}
        </select>
      </div>
      <OfferLetterGenerator user={user} candidateId={id} jobId={selectedJobForOffer} />
    </div>
  );

    const tabConfig = [
    {
      key: "profile",
      title: "Profile",
      icon: <FiUser />,
      content: (
        <ProfileTab
          candidate={candidate}
          formData={formData}
          isEditing={isEditing}
          statusOptions={statusOptions}
          onChange={handleTextChange}
          onSave={handleSave}
          onCancel={() => {
            setIsEditing(false);
            setFormData(candidate);
          }}
          onDelete={handleDeleteCandidate}
          onExport={handleExportDocuments}
          user={user}
          candidateId={id}
          onEditToggle={() => setIsEditing(true)}
        />
      ),
      alwaysVisible: true
    },

        {
      key: "basic-info",
      title: "Basic Info",
      icon: <FiUser />,
      content: (
        <div>
          <CandidateHeader candidate={candidate} documents={documents || []} />
          <PersonalInfoTab data={candidate} />
        </div>
      ),
      alwaysVisible: true
    },


    // NEW: Skills
    {
      key: "skills",
      title: "Skills",
      icon: <FiClipboard />,
      content: <SkillsTab data={candidate.skills_list || []} />,
      alwaysVisible: true
    },

    // NEW: Experience
    {
      key: "experience",
      title: "Experience",
      icon: <FiUsers />,
      content: <ExperienceTab data={candidate.job_history || []} />,
      alwaysVisible: true
    },

     {
      key: "doc-overview",
      title: "Document Overview",
      icon: <FiFileText />,
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <DocumentChecker candidateId={id} documents={documents || []} />
          <DocumentSection candidateId={id} documents={documents || []} />
          <HistoryTimeline candidateId={id} />
        </div>
      ),
      check: "isDocumentsEnabled"
    },



    {
      key: "passport",
      title: "Passport Tracking",
      icon: <FiPackage />,
      content: <CandidatePassport candidateId={id} documents={documents} />,
      check: "isDocumentsEnabled"
    },
    {
      key: "documents",
      title: `Documents (${documents.length})`,
      icon: <FiFileText />,
      content: DocumentTabContent,
      check: "isDocumentsEnabled"
    },
    {
      key: "jobs",
      title: "Job Placements",
      icon: <FiClipboard />,
      content: <CandidateJobs user={user} candidateId={id} onJobAssigned={handleJobAssigned} />,
      check: "isJobsEnabled"
    },
    {
      key: "visa",
      title: "Visa Tracking",
      icon: <FiPackage />,
      content: <CandidateVisa user={user} candidateId={id} />,
      check: "isVisaTrackingEnabled"
    },
    {
      key: "finance",
      title: "Financial Tracking",
      icon: <FiDollarSign />,
      content: <CandidateFinance user={user} candidateId={id} flags={flags} />,
      check: "isFinanceTrackingEnabled"
    },
    {
      key: "medical",
      title: "Medical",
      icon: <FiUsers />,
      content: <CandidateMedical user={user} candidateId={id} />,
      check: "isMedicalEnabled"
    },
    {
      key: "interview",
      title: "Interview/Schedule",
      icon: <FiCalendar />,
      content: <CandidateInterview user={user} candidateId={id} />,
      check: "isInterviewEnabled"
    },
    {
      key: "travel",
      title: "Travel/Tickets",
      icon: <FiSend />,
      content: <CandidateTravel user={user} candidateId={id} />,
      check: "isTravelEnabled"
    },
    {
      key: "offer",
      title: "Offer Letter",
      icon: <FiFileText />,
      content: OfferLetterTabContent,
      check: "isJobsEnabled"
    },
    {
      key: "history",
      title: "History",
      icon: <FiClock />,
      content: <CandidateHistory candidateId={id} />,
      check: "isHistoryEnabled"
    }
  ].filter(tab => {
    if (tab.alwaysVisible) return true;
    return canAccess(tab.check);
  });


  return (
    <div className="detail-page-container">
      <CandidateHeaderBar
        candidate={candidate}
        formData={formData}
        onBack={() => navigate("/search")}
      />
      <Tabs tabs={tabConfig} defaultActiveTab={initialTab} />
    </div>
  );
}

export default CandidateDetailPage;
