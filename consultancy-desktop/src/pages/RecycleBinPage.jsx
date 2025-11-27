import React, { useState, useEffect, useCallback } from 'react';
import {
  FiTrash2,
  FiRotateCcw,
  FiUsers,
  FiServer,
  FiClipboard,
  FiAlertTriangle,
} from 'react-icons/fi';
import '../css/RecycleBinPage.css';
import Tabs from '../components/Tabs';
import toast from 'react-hot-toast'; 
import PermanentDeleteModal from "../components/modals/PermanentDeleteModal";


function RecycleBinPage({ user }) {
  const [deletedCandidates, setDeletedCandidates] = useState([]);
  const [deletedEmployers, setDeletedEmployers] = useState([]);
  const [deletedJobs, setDeletedJobs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [deleteModalItem, setDeleteModalItem] = useState(null); // {item: {}, type: ''}
  
  // NOTE: Assuming canDeletePermanently flag is loaded in useAuthStore

  const fetchAllDeleted = useCallback(async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const [candRes, empRes, jobRes] = await Promise.all([
      window.electronAPI.getDeletedCandidates(),
      window.electronAPI.getDeletedEmployers(),
      window.electronAPI.getDeletedJobOrders(),
    ]);

    if (candRes.success) setDeletedCandidates(candRes.data);
    else toast.error(candRes.error); 
    
    if (empRes.success) setDeletedEmployers(empRes.data);
    else toast.error(empRes.error); 
    
    if (jobRes.success) setDeletedJobs(jobRes.data);
    else toast.error(jobRes.error); 
    
    setLoading(false);
  }, [user]); 

  useEffect(() => {
    fetchAllDeleted();
  }, [fetchAllDeleted]);
  
  // --- DELETE HANDLER (POST-MODAL) ---
  const handlePermanentDelete = (id, targetType) => {
    setDeleteModalItem(null); // Close modal
    
    // Optimistic removal from the correct array
    if (targetType === 'candidates') {
        setDeletedCandidates(prev => prev.filter(c => c.id !== id));
    } else if (targetType === 'employers') {
        setDeletedEmployers(prev => prev.filter(e => e.id !== id));
    } else if (targetType === 'job_orders') {
        setDeletedJobs(prev => prev.filter(j => j.id !== id));
    }
  };

  const handleRestoreCandidate = async (candidateId, name) => {
    if (window.confirm(`Are you sure you want to restore candidate: ${name}?`)) {
      const res = await window.electronAPI.restoreCandidate({user, id: candidateId });
      if (res.success) {
        toast.success(`Candidate ${name} restored successfully.`); 
        setDeletedCandidates(prev => prev.filter(c => c.id !== candidateId));
      } else {
        toast.error(res.error); 
      }
    }
  };
  
  const handleRestoreEmployer = async (employerId, name) => {
    if (window.confirm(`Are you sure you want to restore employer: ${name}? This will also restore their associated jobs.`)) {
      const res = await window.electronAPI.restoreEmployer({user, id: employerId });
      if (res.success) {
        toast.success(`Employer ${name} and linked jobs restored.`); 
        fetchAllDeleted(); // Refresh all lists
      } else {
        toast.error(res.error); 
      }
    }
  };
  
  const handleRestoreJob = async (jobId, name) => {
    if (window.confirm(`Are you sure you want to restore job: ${name}? This will also restore its linked placements.`)) {
      const res = await window.electronAPI.restoreJobOrder({user, id: jobId });
      if (res.success) {
        toast.success(`Job ${name} and linked placements restored.`); 
        fetchAllDeleted(); // Refresh all lists
      } else {
        toast.error(res.error); 
      }
    }
  };
  
  // Helper to check the flag locally for UI display
  const canDeletePermanently = user.role === 'super_admin'; 
  
  const renderItemActions = (item, type, restoreHandler) => (
    <div className="item-actions">
        {canDeletePermanently && (
            <button
              className="doc-btn delete"
              title={`Permanently Delete ${type}`}
              onClick={() => setDeleteModalItem({ item: item, type: type })}
            >
              <FiAlertTriangle />
            </button>
        )}
        <button
            className="doc-btn view"
            onClick={() => restoreHandler(item.id, item.name || item.companyName || item.positionTitle)}
            title={`Restore ${type}`}
        >
            <FiRotateCcw />
        </button>
    </div>
  );


  const renderCandidateList = () => (
    <div className="recycle-list-content">
      {loading ? <p>Loading...</p> : deletedCandidates.length === 0 ? (
        <p>No deleted candidates found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedCandidates.map(candidate => (
            <li key={candidate.id} className="recycle-item">
              <div className="item-info">
                <strong>{candidate.name}</strong>
                <span>Position: {candidate.Position || 'N/A'}</span>
              </div>
              {renderItemActions(candidate, 'candidates', handleRestoreCandidate)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  
  const renderEmployerList = () => (
    <div className="recycle-list-content">
      {loading ? <p>Loading...</p> : deletedEmployers.length === 0 ? (
        <p>No deleted employers found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedEmployers.map(emp => (
            <li key={emp.id} className="recycle-item">
              <div className="item-info">
                <strong>{emp.companyName}</strong>
                <span>Country: {emp.country || 'N/A'}</span>
              </div>
              {renderItemActions(emp, 'employers', handleRestoreEmployer)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  
  const renderJobList = () => (
    <div className="recycle-list-content">
      {loading ? <p>Loading...</p> : deletedJobs.length === 0 ? (
        <p>No deleted jobs found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedJobs.map(job => (
            <li key={job.id} className="recycle-item">
              <div className="item-info">
                <strong>{job.positionTitle}</strong>
                <span>Company: {job.companyName || 'N/A'}</span>
              </div>
              {renderItemActions(job, 'job_orders', handleRestoreJob)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const tabs = [
    {
      key: 'candidates',
      title: `Candidates (${deletedCandidates.length})`,
      icon: <FiUsers />,
      content: renderCandidateList(),
    },
    {
      key: 'employers',
      title: `Employers (${deletedEmployers.length})`,
      icon: <FiServer />,
      content: renderEmployerList(),
    },
    {
      key: 'jobs',
      title: `Job Orders (${deletedJobs.length})`,
      icon: <FiClipboard />,
      content: renderJobList(),
    },
  ];

  return (
    <div className="recycle-bin-container">
        {deleteModalItem && (
            <PermanentDeleteModal
              user={user}
                item={deleteModalItem.item}
                targetType={deleteModalItem.type}
                onClose={() => setDeleteModalItem(null)}
                onPermanentDelete={(id) => handlePermanentDelete(id, deleteModalItem.type)}
            />
        )}
      <h1><FiTrash2 /> Recycle Bin</h1>
      {canDeletePermanently && (
          <p className="form-message danger" style={{marginBottom: '1.5rem'}}>
              <FiAlertTriangle /> **SUPER ADMIN WARNING**: You have permission for **Permanent Deletion** (red trash icon). Use with extreme caution.
          </p>
      )}
      <p>Items moved to the recycle bin. Restoring an item will also restore its associated records (e.g., jobs, placements, documents).</p>

      <Tabs tabs={tabs} defaultActiveTab="candidates" />
      
    </div>
  );
}

export default RecycleBinPage;