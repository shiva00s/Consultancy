import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiUser, FiFileText, FiPackage, FiClipboard, FiDollarSign, FiUsers, FiCalendar, FiSend, FiClock, FiArrowLeft, FiDownload, FiAlertTriangle
} from 'react-icons/fi';
import toast from 'react-hot-toast';


import '../css/CandidateDetailPage.css';
import Tabs from '../components/Tabs'; 
import CandidateFinance from '../components/candidate-detail/CandidateFinance';
import CandidateVisa from '../components/candidate-detail/CandidateVisa';
import CandidateJobs from '../components/candidate-detail/CandidateJobs'; 
import CandidateMedical from '../components/candidate-detail/CandidateMedical'; 
import CandidateInterview from '../components/candidate-detail/CandidateInterview'; 
import CandidateTravel from '../components/candidate-detail/CandidateTravel'; 
import OfferLetterGenerator from '../components/candidate-detail/OfferLetterGenerator'; 
import CandidateHistory from '../components/candidate-detail/CandidateHistory';
import CandidateDocuments from '../components/candidate-detail/CandidateDocuments'; 
import CandidatePassport from '../components/candidate-detail/CandidatePassport';


const statusOptions = [
  'New', 'Documents Collected', 'Visa Applied', 'In Progress', 'Completed', 'Rejected',
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
  
  // --- Staff Permission State ---
  const [staffPermissions, setStaffPermissions] = useState({}); 
  const [permsLoaded, setPermsLoaded] = useState(false);


  // Determine Initial Tab from URL
  const initialTab = searchParams.get('tab') || 'profile';


  // 1. Fetch Candidate Details
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


  // 2. Fetch Staff Permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (user.role === 'staff') {
        const res = await window.electronAPI.getUserPermissions({ userId: user.id });
        if (res.success) {
          setStaffPermissions(res.data || {}); 
        }
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


  const handleDocumentsUpdate = (newDocs = [], docIdToDelete = null, isCategoryUpdate = false) => {
    setDetails(prev => {
        let updatedDocuments = [...(prev?.documents || [])];
        if (docIdToDelete !== null) {
            updatedDocuments = updatedDocuments.filter(doc => doc.id !== docIdToDelete);
        } else if (isCategoryUpdate) {
            const updateDoc = newDocs[0];
            updatedDocuments = updatedDocuments.map(doc => 
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
   const res = await window.electronAPI.updateCandidateText({ user, id, data: formData });
    if (res.success) {
      toast.success('Details saved successfully!');
      setIsEditing(false);
      fetchDetails();
    } else {
      toast.error(res.error);
    }
  };


  const handleDeleteCandidate = async () => {
    if (window.confirm('Are you sure you want to move this candidate to the Recycle Bin?')) {
      const res = await window.electronAPI.deleteCandidate({ user, id });
      if (res.success) {
        navigate('/search'); 
        toast.success(`Candidate ${details.candidate.name} moved to Recycle Bin.`);
      } else {
        toast.error(res.error);
      }
    }
  };


  const handleExportDocuments = async () => {
    toast.loading('Preparing ZIP...', { id: 'zip-status' });
    const dialogResult = await window.electronAPI.showSaveDialog({
      title: 'Save Candidate Documents ZIP',
      defaultPath: `${details.candidate.name.replace(/\s/g, '_')}_Docs.zip`,
      buttonLabel: 'Save ZIP',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });


    if (dialogResult.canceled || !dialogResult.filePath) {
      toast.dismiss('zip-status');
      return; 
    }
    
    toast.loading('Exporting...', { id: 'zip-status' });
    const res = await window.electronAPI.zipCandidateDocuments({
      user, 
      candidateId: id,
      destinationPath: dialogResult.filePath,
    });
    toast.dismiss('zip-status');


    if (res.success) toast.success(`Documents successfully exported!`);
    else toast.error(res.error || 'Failed to create ZIP archive.');
  };
  
  if (loading || !permsLoaded) return <h2>Loading Candidate Details...</h2>;
  if (!details) return <h2>Candidate not found.</h2>;


  const { candidate, documents } = details;


  // --- PERMISSION CHECKER HELPER (FIXED) ---
  const canAccess = (featureKey) => {
      // 1. Safety Check: If flags aren't loaded yet, default to hidden or wait
      if (!flags) return false; 


      // 2. Global Switch Check (The Ceiling)
      if (!flags[featureKey]) return false;


      // 3. Role Checks
      if (user.role === 'super_admin') return true; 
      if (user.role === 'admin') return true;       
      
      // 4. Staff Delegation Check
      if (user.role === 'staff') {
          return staffPermissions[featureKey] === true;
      }
      return false;
  };


  const ProfileTabContent = (
    <div className="profile-tab-content">
        <div className="detail-card" style={{border: 'none', margin: 0}}>
            <div className="detail-header" style={{borderRadius: 'var(--border-radius)'}}>
                <h2>{isEditing ? 'Edit Profile' : 'Profile Overview'}</h2>
                <div className="header-actions">
                    {isEditing ? (
                        <>
                            <button className="btn" onClick={handleSave}>Save Changes</button>
                            <button className="btn btn-secondary" onClick={() => { setIsEditing(false); setFormData(candidate); }}>Cancel</button>
                        </>
                    ) : (
                      <>
                        <button className="btn btn-secondary" onClick={handleExportDocuments}><FiDownload /> Export Documents</button>
                        <button className="btn" onClick={() => setIsEditing(true)}>Edit Details</button>
                      </>
                    )}
                </div>
            </div>
            <div className="form-grid">
                <div className="form-group"><label>Name</label><input type="text" name="name" value={formData.name} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Status</label>{isEditing ? (<select name="status" value={formData.status} onChange={handleTextChange}>{statusOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select>) : (<input type="text" value={formData.status} readOnly />)}</div>
                <div className="form-group">
                  <div className="form-group">
                    <label>Contact Number</label>
                    <div style={{display: 'flex', gap: '5px'}}>
                        <input 
                            type="text" 
                            name="contact" 
                            value={formData.contact || ''} 
                            onChange={handleTextChange} 
                            readOnly={!isEditing} 
                            style={{flexGrow: 1}}
                        />
                        {formData.contact && (
                            <button 
                                className="btn" 
                                style={{backgroundColor: '#25D366', color: 'white', padding: '0 12px', minWidth: 'auto'}}
                                title="Chat on WhatsApp"
                                type="button" 
                                onClick={() => {
                                    window.open(`https://wa.me/${formData.contact.replace(/\D/g,'')}`, '_blank');
                                    window.electronAPI.logCommunication({ 
                                        user, 
                                        candidateId: id, 
                                        type: 'WhatsApp', 
                                        details: 'Clicked Chat Button' 
                                    });
                                }}
                            >
                                <span style={{fontSize: '1.2rem', fontWeight: 'bold'}}>✆</span>
                            </button>
                        )}
                    </div>
                </div>
                </div>
                <div className="form-group"><label>Aadhar Number</label><input type="text" name="aadhar" value={formData.aadhar || ''} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Passport No</label><input type="text" name="passportNo" value={formData.passportNo} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Passport Expiry</label><input type="date" name="passportExpiry" value={formData.passportExpiry || ''} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Position Applying For</label><input type="text" name="Position" value={formData.Position} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Education</label><input type="text" name="education" value={formData.education || ''} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Experience (years)</label><input type="number" name="experience" value={formData.experience || ''} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob || ''} onChange={handleTextChange} readOnly={!isEditing} /></div>
                <div className="form-group full-width"><label>Notes</label><textarea name="notes" value={formData.notes || ''} onChange={handleTextChange} readOnly={!isEditing}></textarea></div>
            </div>
        </div>
        <div className="detail-card delete-zone">
            <h3>Move Candidate to Recycle Bin</h3>
            <p>Moves candidate and all linked records to Recycle Bin. Restore is possible.</p>
            <button className="btn btn-danger" onClick={handleDeleteCandidate}><FiAlertTriangle /> Move to Recycle Bin</button>
        </div>
    </div>
  );


  const DocumentTabContent = (
    <CandidateDocuments user={user} candidateId={id} documents={documents} onDocumentsUpdate={handleDocumentsUpdate} />
  );
  
  const OfferLetterTabContent = (
    <div>
      <div className="form-group" style={{maxWidth: '500px', marginBottom: '1.5rem'}}>
        <label>Select Job Assignment:</label>
        <select value={selectedJobForOffer || ''} onChange={(e) => setSelectedJobForOffer(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">-- Select a Job --</option>
          {placements.length === 0 && <option disabled>No jobs assigned</option>}
          {placements.map((p) => (<option key={p.placementId} value={p.jobId}>{p.companyName} - {p.positionTitle}</option>))}
        </select>
      </div>
      <OfferLetterGenerator user={user} candidateId={id} jobId={selectedJobForOffer} />
    </div>
  );


  // --- DYNAMIC TAB FILTERING ---
  const tabConfig = [
    { key: 'profile', title: 'Profile', icon: <FiUser />, content: ProfileTabContent, alwaysVisible: true },
    
    { key: 'passport', title: 'Passport Tracking', icon: <FiPackage />, content: <CandidatePassport candidateId={id} documents={documents}  />, 
      check: 'isDocumentsEnabled' }, 
    
    { key: 'documents', title: `Documents (${documents.length})`, icon: <FiFileText />, content: DocumentTabContent, 
      check: 'isDocumentsEnabled' },
    
    { key: 'jobs', title: 'Job Placements', icon: <FiClipboard />, content: <CandidateJobs user={user} candidateId={id} onJobAssigned={handleJobAssigned} />, 
      check: 'isJobsEnabled' },
    
    { key: 'visa', title: 'Visa Tracking', icon: <FiPackage />, content: <CandidateVisa user={user} candidateId={id} />, 
      check: 'isVisaTrackingEnabled' },
    
    { key: 'finance', title: 'Financial Tracking', icon: <FiDollarSign />, 
      content: <CandidateFinance user={user} candidateId={id} flags={flags} />, 
      check: 'isFinanceTrackingEnabled' },
    
    { key: 'medical', title: 'Medical', icon: <FiUsers />, content: <CandidateMedical user={user} candidateId={id} />, 
      check: 'isMedicalEnabled' }, 
    
    { key: 'interview', title: 'Interview/Schedule', icon: <FiCalendar />, content: <CandidateInterview user={user} candidateId={id} />, 
      check: 'isInterviewEnabled' },
    
    { key: 'travel', title: 'Travel/Tickets', icon: <FiSend />, content: <CandidateTravel user={user} candidateId={id} />, 
      check: 'isTravelEnabled' },
    
    { key: 'offer', title: 'Offer Letter', icon: <FiFileText />, content: OfferLetterTabContent, 
      check: 'isJobsEnabled' },
    
    { key: 'history', title: 'History', icon: <FiClock />, content: <CandidateHistory candidateId={id} />, 
      check: 'isHistoryEnabled' },
  
  ].filter(tab => {
      if (tab.alwaysVisible) return true;
      return canAccess(tab.check);
  });


  return (
    <div className="detail-page-container">
      {/* HEADER SECTION WITH NAME */}
      <div style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '1px solid var(--border-color)'
      }}>
          <button 
            onClick={() => navigate('/search')} 
            className="btn btn-secondary back-button" 
            style={{marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px'}}
          >
              <FiArrowLeft /> Back to Search
          </button>


          <div style={{textAlign: 'right'}}>
              <h1 style={{margin: '0 0 5px 0', fontSize: '1.8rem', color: 'var(--text-primary)'}}>
                  <FiUser style={{marginRight:'10px', verticalAlign:'middle'}}/>
                  {formData?.name || candidate.name}
              </h1>
              <div style={{display:'flex', gap:'15px', justifyContent:'flex-end', fontSize:'0.9rem', color:'var(--text-secondary)'}}>
                  <span><strong>ID:</strong> #{candidate.id}</span>
                  <span><strong>Passport:</strong> {formData?.passportNo || candidate.passportNo}</span>
                  <span className="badge neutral" style={{padding:'2px 8px', borderRadius:'4px', background:'var(--bg-secondary)'}}>
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
