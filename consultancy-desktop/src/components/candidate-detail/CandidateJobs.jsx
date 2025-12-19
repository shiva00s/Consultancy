import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiClipboard, 
  FiPlus, 
  FiTrash2, 
  FiServer, 
  FiBriefcase,
  FiCheck,
  FiX,
  FiAlertCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/CandidateJobs.css';
import ConfirmDialog from '../common/ConfirmDialog';

function CandidateJobs({ user, candidateId, onJobAssigned }) {
  const [placements, setPlacements] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, placementId: null, jobName: '' });

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidatePlacements({
        candidateId,
      });
      if (res.success) {
        const validPlacements = (res.data || []).filter(p => 
          p && p.positionTitle && p.companyName
        );
        setPlacements(validPlacements);
      }
    } catch (err) {
      console.error('Error fetching placements:', err);
      toast.error('❌ Failed to load placements');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  const fetchUnassignedJobs = useCallback(async () => {
    try {
      const res = await window.electronAPI.getUnassignedJobs({ candidateId });
      if (res.success) setUnassignedJobs(res.data || []);
    } catch (err) {
      console.error('Error fetching unassigned jobs:', err);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchPlacements();
    fetchUnassignedJobs();
  }, [candidateId, fetchPlacements, fetchUnassignedJobs]);

  const handleAssignJob = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
      toast.error('⚠️ Please select a job first.');
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
        await fetchPlacements();
        await fetchUnassignedJobs();
        setSelectedJobId('');
        toast.success('✅ Job assigned successfully!');
        if (onJobAssigned) {
          onJobAssigned(res.data?.jobId);
        }
      } else {
        toast.error(res.error || '❌ Failed to assign job');
      }
    } catch (err) {
      console.error('Error assigning job:', err);
      toast.error('❌ Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemovePlacement = (placementId, jobName) => {
    setConfirmDialog({
      isOpen: true,
      placementId,
      jobName
    });
  };

  const confirmRemove = async () => {
    const { placementId } = confirmDialog;
    
    try {
      const res = await window.electronAPI.removeCandidateFromJob({
        user,
        placementId,
      });
      
      if (res.success) {
        await fetchPlacements();
        await fetchUnassignedJobs();
        toast.success('✅ Job assignment removed successfully');
      } else {
        toast.error(res.error || '❌ Failed to remove placement');
      }
    } catch (err) {
      console.error('Error removing placement:', err);
      toast.error('❌ Failed to remove placement');
    } finally {
      setConfirmDialog({ isOpen: false, placementId: null, jobName: '' });
    }
  };

  const cancelRemove = () => {
    setConfirmDialog({ isOpen: false, placementId: null, jobName: '' });
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Assigned':
        return 'badge-cyan';
      case 'Interviewing':
        return 'badge-blue';
      case 'Placed':
        return 'badge-green';
      case 'Rejected':
        return 'badge-red';
      default:
        return 'badge-grey';
    }
  };

  const getStatusEmoji = (status) => {
    switch(status) {
      case 'Assigned':
        return '📋';
      case 'Interviewing':
        return '🎤';
      case 'Placed':
        return '✅';
      case 'Rejected':
        return '❌';
      default:
        return '⏳';
    }
  };

  if (loading) {
    return (
      <div className="job-placement-content">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner">⏳ Loading job placements...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="job-placement-content">
      {/* Assign New Job Section */}
      <div className="form-container">
        <h3>
          <FiPlus className="section-icon" />
          <span>💼 Assign New Job</span>
        </h3>
        <form onSubmit={handleAssignJob} className="assign-job-form">
          <div className="form-group">
            <label htmlFor="jobSelect">
              🎯 Select Job Order
            </label>
            <select
              id="jobSelect"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={isAssigning || unassignedJobs.length === 0}
              required
            >
              <option value="">
                {unassignedJobs.length === 0 ? '📭 No available jobs' : '🔽 Choose a job...'}
              </option>
              {unassignedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  🏢 {job.companyName} - {job.positionTitle}
                </option>
              ))}
            </select>
          </div>
          <button 
            type="submit" 
            className="btn btn-assign"
            disabled={isAssigning || !selectedJobId}
          >
            {isAssigning ? (
              <>
                <span className="spinner-icon">⏳</span>
                <span>Assigning...</span>
              </>
            ) : (
              <>
                <FiPlus />
                <span>Assign Job</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Current Job Placements */}
      <div className="list-container">
        <h3>
          <FiBriefcase className="section-icon" />
          <span>📊 Current Job Assignments ({placements.length})</span>
        </h3>
        
        {placements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No active job assignments</p>
            <span>This candidate is not assigned to any job orders yet</span>
          </div>
        ) : (
          <div className="module-list">
            {placements.map((p) => (
              <div key={p.id} className="module-list-item">
                <div className="item-icon">
                  <FiBriefcase />
                </div>
                
                <div className="item-details">
                  <h4>💼 {p.positionTitle}</h4>
                  <p>
                    <span>🏢</span>
                    <strong>{p.companyName}</strong>
                  </p>
                  {p.assignedDate && (
                    <p className="date-info">
                      <span>📅</span>
                      <span>Assigned: {new Date(p.assignedDate).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>

                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                    <span>{getStatusEmoji(p.status)}</span>
                    <span>{p.status || 'Assigned'}</span>
                  </span>
                </div>

                <div className="item-actions">
                  <button
                    type="button"
                    onClick={() => handleRemovePlacement(p.id, `${p.positionTitle} at ${p.companyName}`)}
                    title="Remove Assignment"
                    className="btn-remove"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="🗑️ Remove Job Assignment"
        message={`Are you sure you want to remove the job assignment "${confirmDialog.jobName}"? This action will move it to the Recycle Bin.`}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        confirmText="Remove"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
}

export default CandidateJobs;
