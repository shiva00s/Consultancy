import React, { useState, useEffect, useCallback } from 'react';
import { FiClipboard, FiPlus, FiTrash2, FiServer, FiBriefcase } from 'react-icons/fi';
import toast from 'react-hot-toast';

function CandidateJobs({user, candidateId, onJobAssigned }) {
  const [placements, setPlacements] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidatePlacements({
        candidateId,
      });
      console.log('✅ Placements response:', res); // DEBUG
      if (res.success) {
        // Filter out any invalid placements
        const validPlacements = (res.data || []).filter(p => 
          p && p.positionTitle && p.companyName
        );
        setPlacements(validPlacements);
      }
    } catch (err) {
      console.error('❌ Error fetching placements:', err);
      toast.error('Failed to load placements');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  const fetchUnassignedJobs = useCallback(async () => {
    try {
      const res = await window.electronAPI.getUnassignedJobs({ candidateId });
      console.log('✅ Unassigned jobs response:', res); // DEBUG
      if (res.success) setUnassignedJobs(res.data || []);
    } catch (err) {
      console.error('❌ Error fetching unassigned jobs:', err);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchPlacements();
    fetchUnassignedJobs();
  }, [candidateId, fetchPlacements, fetchUnassignedJobs]);

  const handleAssignJob = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
      toast.error('Please select a job first.');
      return;
    }
    
    setIsAssigning(true);
    try {
      const res = await window.electronAPI.assignCandidateToJob({
        user, 
        candidateId,
        jobId: parseInt(selectedJobId, 10),
      });
      
      if (res.success) {
        await fetchPlacements(); // Refresh the list
        await fetchUnassignedJobs();
        setSelectedJobId('');
        toast.success('Job assigned successfully!');
        
        if (onJobAssigned) {
          onJobAssigned(res.data?.jobId);
        }
      } else {
        toast.error(res.error || 'Failed to assign job');
      }
    } catch (err) {
      console.error('❌ Error assigning job:', err);
      toast.error('Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemovePlacement = async (placementId, jobName) => {
    if (window.confirm(`Are you sure you want to remove the placement for "${jobName}"? It will be moved to the Recycle Bin.`)) {
      try {
        const res = await window.electronAPI.removeCandidateFromJob({
          user,
          placementId,
        });
        if (res.success) {
          await fetchPlacements();
          await fetchUnassignedJobs();
          toast.success('Job assignment removed (soft-deleted).');
        } else {
          toast.error(res.error || 'Failed to remove placement');
        }
      } catch (err) {
        console.error('❌ Error removing placement:', err);
        toast.error('Failed to remove placement');
      }
    }
  };
  
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
                  <strong>{p.positionTitle || 'Unknown Position'}</strong>
                  <p>
                    <FiServer style={{marginRight: '5px'}}/> 
                    {p.companyName || 'Unknown Company'} 
                    {p.country ? ` (${p.country})` : ''}
                  </p>
                </div>
                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(p.placementStatus)}`}>
                    {p.placementStatus || 'Unknown'}
                  </span>
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove Assignment"
                    onClick={() => handleRemovePlacement(p.placementId, p.positionTitle || 'this job')}
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
              disabled={isAssigning}
            >
              <option value="">-- Select a job to assign --</option>
              {unassignedJobs.length === 0 && (
                <option disabled>No available jobs</option>
              )}
              {unassignedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.companyName || 'Unknown'} - {job.positionTitle || 'Unknown'} 
                  {job.country ? ` (${job.country})` : ''}
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
