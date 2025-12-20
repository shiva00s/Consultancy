import React, { useState, useEffect, useCallback } from 'react';
import { FiClipboard, FiPlus, FiTrash2, FiServer, FiBriefcase, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/CandidateJobs.css';
import ConfirmDialog from '../common/ConfirmDialog';

function CandidateJobs({ user, candidateId, onJobAssigned }) {
  const [placements, setPlacements] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    placementId: null,
    jobName: ''
  });

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidatePlacements({ candidateId });
      if (res.success) {
        const validPlacements = (res.data || []).filter(
          p => p && p.positionTitle && p.companyName
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
      case 'Assigned': return 'badge-cyan';
      case 'Interviewing': return 'badge-blue';
      case 'Placed': return 'badge-green';
      case 'Rejected': return 'badge-red';
      default: return 'badge-grey';
    }
  };

  const getStatusEmoji = (status) => {
    switch(status) {
      case 'Assigned': return '📋';
      case 'Interviewing': return '🎤';
      case 'Placed': return '✅';
      case 'Rejected': return '❌';
      default: return '⏳';
    }
  };

  if (loading) {
    return (
      <div className="job-placement-content">
        <div className="loading-spinner">
          <FiServer /> Loading job assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="job-placement-content">
      {/* Assign Job Form */}
      <div className="form-container">
        <h3>
          <span className="section-icon"><FiPlus /></span>
          Assign to Job Order
        </h3>
        <form className="assign-job-form" onSubmit={handleAssignJob}>
          <div className="form-group">
            <label>
              <FiBriefcase /> Select Job Order
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={isAssigning || unassignedJobs.length === 0}
            >
              <option value="">
                {unassignedJobs.length === 0 
                  ? 'No available job orders' 
                  : 'Choose a job order...'
                }
              </option>
              {unassignedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.positionTitle} at {job.companyName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn"
            disabled={isAssigning || !selectedJobId}
          >
            {isAssigning ? (
              <>
                <span className="spinner-icon">⏳</span>
                Assigning...
              </>
            ) : (
              <>
                <FiCheck /> Assign Job
              </>
            )}
          </button>
        </form>
      </div>

      {/* Current Job Assignments List */}
      <div className="list-container">
        <h3>
          <span className="section-icon"><FiClipboard /></span>
          Current Job Assignments ({placements.length})
        </h3>

        {placements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <p>No active job assignments</p>
            <span>This candidate is not assigned to any job orders yet</span>
          </div>
        ) : (
          <div className="module-list">
            {placements.map((p) => (
              <div 
                key={p.placementId || p.id || `placement-${p.jobId}-${p.candidateId}`} 
                className="module-list-item"
              >
                <div className="item-icon">
                  <FiBriefcase />
                </div>

                <div className="item-details">
                  <h4>{p.positionTitle}</h4>
                  <p>
                    <strong>🏢 {p.companyName}</strong>
                  </p>
                  <p className="date-info">
                    📅 Assigned: {new Date(p.assignedDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                    {getStatusEmoji(p.status)} {p.status || 'Assigned'}
                  </span>
                </div>

                <div className="item-actions">
                  <button
                    onClick={() => handleRemovePlacement(p.placementId || p.id, p.positionTitle)}
                    title="Remove job assignment"
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
        title="Remove Job Assignment"
        message={`Are you sure you want to remove the assignment for "${confirmDialog.jobName}"?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        type="danger"
      />
    </div>
  );
}

export default CandidateJobs;
