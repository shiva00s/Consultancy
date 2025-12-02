import React, { useState, useEffect, useCallback } from 'react';
import { FiClipboard, FiPlus, FiTrash2, FiServer, FiBriefcase } from 'react-icons/fi'; // ADDED FiServer, FiBriefcase
import toast from 'react-hot-toast'; 

function CandidateJobs({user, candidateId, onJobAssigned }) {
  const [placements, setPlacements] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getCandidatePlacements({
      candidateId,
    });
    if (res.success) setPlacements(res.data);
    setLoading(false);
  }, [candidateId]);

  const fetchUnassignedJobs = useCallback(async () => {
    const res = await window.electronAPI.getUnassignedJobs({ candidateId });
    if (res.success) setUnassignedJobs(res.data);
  }, [candidateId]);

  useEffect(() => {
    fetchPlacements();
    fetchUnassignedJobs();
  }, [candidateId, fetchPlacements, fetchUnassignedJobs]);
  
  
  // Locate function around source line 59:
  const handleAssignJob = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
        toast.error('Please select a job first.');
        return;
    }
    
   const res = await window.electronAPI.assignCandidateToJob({
      user, 
      candidateId,
      // CRITICAL FIX: Convert ID to integer before sending to backend
      jobId: parseInt(selectedJobId, 10),
    });
    
    if (res.success) {
      setPlacements((prev) => [...prev, res.data]);
      setUnassignedJobs((prev) =>
        prev.filter((job) => job.id !== parseInt(selectedJobId, 10))
      );
      setSelectedJobId('');
      toast.success('Job assigned successfully!');
      
      if (onJobAssigned) {
        onJobAssigned(res.data.jobId);
      }
      
    } else {
      toast.error(res.error);
    }
    setIsAssigning(false);
  };

  const handleRemovePlacement = async (placementId, jobName) => {
    if (window.confirm(`Are you sure you want to remove the placement for "${jobName}"? It will be moved to the Recycle Bin.`)) {
      const res = await window.electronAPI.removeCandidateFromJob({
        user,
        placementId,
      });
      if (res.success) {
        fetchPlacements();
        fetchUnassignedJobs();
        toast.success('Job assignment removed (soft-deleted).');
      } else {
        toast.error(res.error);
      }
    }
  };
  
  // Helper for status badge
  const getStatusBadgeClass = (status) => {
    switch(status) {
        case 'Assigned': return 'badge-cyan';
        case 'Interviewing': return 'badge-blue';
        case 'Placed': return 'badge-green';
        case 'Rejected': return 'badge-red';
        default: return 'badge-grey';
    }
  };

  if (loading) return <p>Loading job placements...</p>;

  return (
    <div className="job-placement-content module-vertical-stack">
        
        {/* --- PLACEMENTS LIST --- */}
        <div className="list-container module-list-card">
            <h3><FiClipboard /> Active Job Placements ({placements.length})</h3>
            <div className="module-list">
                {placements.length === 0 ? (
                    <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>
                        This candidate is not assigned to any active job orders.
                    </p>
                ) : (
                    placements.map((p) => (
                        <div className="module-list-item" key={p.placementId}>
                            <div className="item-icon">
                                <FiBriefcase />
                            </div>
                            <div className="item-details">
                                <strong>{p.positionTitle}</strong>
                                <p>
                                    <FiServer style={{marginRight: '5px'}}/> {p.companyName} ({p.country})
                                </p>
                            </div>
                            <div className="item-status">
                                <span className={`status-badge ${getStatusBadgeClass(p.placementStatus)}`}>
                                    {p.placementStatus}
                                </span>
                            </div>
                            <div className="item-actions">
                                {/* MODIFIED: Ensure proper doc-btn styling */}
                                <button
                                    type="button"
                                    className="icon-btn"
                                    title="Remove Assignment"
                                    onClick={() => handleRemovePlacement(p.placementId, p.positionTitle)}
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* --- ASSIGN JOB FORM --- */}
        <div className="form-container module-form-card">
            <h3><FiPlus /> Assign Candidate to Job Order</h3>
            <form onSubmit={handleAssignJob} className="assign-job-form" style={{display: 'flex', gap: '10px', alignItems: 'flex-end'}}>
                <div className="form-group" style={{flexGrow: 1, marginBottom: 0}}>
                    <label>Available Job Orders</label>
                    <select
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                    >
                        <option value="">-- Select a job to assign --</option>
                        {unassignedJobs.length === 0 && (
                            <option disabled>No available jobs</option>
                        )}
                        {unassignedJobs.map((job) => (
                            <option key={job.id} value={job.id}>
                                {job.companyName} - {job.positionTitle} ({job.country})
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    type="submit"
                    className="btn"
                    disabled={isAssigning || !selectedJobId}
                    style={{ minWidth: '120px', minHeight: '36px' }}
                >
                    {isAssigning ? 'Assigning...' : 'Assign Job'}
                </button>
            </form>
        </div>
    </div>
  );
}

export default CandidateJobs;