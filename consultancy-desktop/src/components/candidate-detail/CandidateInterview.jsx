import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiTrash2, FiBriefcase, FiEdit2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import InterviewEditModal from '../modals/InterviewEditModal';
import useDataStore from '../../store/dataStore';
import '../../css/CandidateInterview.css';

const interviewStatusOptions = ['Scheduled', 'Passed', 'Failed', 'Cancelled'];

const initialInterviewForm = {
  job_order_id: '',
  interview_date: '',
  round: '1st Round',
  status: 'Scheduled',
  notes: '',
};

function CandidateInterview({ user, candidateId, candidateName }) {
  const [interviewEntries, setInterviewEntries] = useState([]);
  const jobOrders = useDataStore((state) => state.jobs);

  const [loading, setLoading] = useState(true);
  const [interviewForm, setInterviewForm] = useState(initialInterviewForm);
  const [isSaving, setIsSaving] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const interviewRes = await window.electronAPI.getInterviewTracking({ candidateId });
    if (interviewRes.success) setInterviewEntries(interviewRes.data || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchData();
  }, [candidateId, fetchData]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setInterviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!interviewForm.job_order_id || !interviewForm.interview_date) {
      toast.error('Job and Date are required.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Scheduling interview...');

    try {
      const res = await window.electronAPI.addInterviewEntry({
        user,
        data: { ...interviewForm, candidate_id: candidateId },
      });

      if (res.success) {
        setInterviewEntries((prev) => [res.data, ...prev]);
        setInterviewForm(initialInterviewForm);
        toast.success('Interview scheduled successfully!', { id: toastId });

        // 🔔 Create reminder for this interview
        try {
          await window.electronAPI.createReminder({
            userId: user.id,
            candidateId,
            module: 'interview',
            title: 'Interview scheduled',
            message: `${candidateName || 'Candidate'} interview on ${interviewForm.interview_date}`,
            remindAt: new Date(interviewForm.interview_date).toISOString(),
          });
        } catch (err) {
          console.error('createReminder (interview) failed:', err);
        }
      } else {
        toast.error(res.error || 'Failed to schedule interview', { id: toastId });
      }
    } catch (err) {
      console.error('addInterviewEntry error:', err);
      toast.error('Failed to schedule interview', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for saving the updated entry from the modal
  const handleUpdateInterview = (updatedInterviewData) => {
    setInterviewEntries((prev) =>
      prev.map((i) => (i.id === updatedInterviewData.id ? updatedInterviewData : i))
    );
    setEditingInterview(null);
    // Toast is handled inside the modal
  };

  const handleDeleteEntry = async (id, position) => {
    if (
      window.confirm(
        `Are you sure you want to move the interview entry for "${position}" to the Recycle Bin?`
      )
    ) {
      try {
        const res = await window.electronAPI.deleteInterviewEntry({ user, id });
        if (res.success) {
          setInterviewEntries((prev) => prev.filter((e) => e.id !== id));
          toast.success('Interview entry moved to Recycle Bin.');
        } else {
          toast.error(res.error || 'Failed to delete interview entry');
        }
      } catch (err) {
        console.error('deleteInterviewEntry error:', err);
        toast.error('Failed to delete interview entry');
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Passed':
        return 'badge-green';
      case 'Failed':
        return 'badge-red';
      case 'Cancelled':
        return 'badge-grey';
      case 'Scheduled':
      default:
        return 'badge-blue';
    }
  };

  if (loading) return <p>Loading interview tracking...</p>;

  return (
    <div className="interview-tracking-content module-vertical-stack">
      {editingInterview && (
        <InterviewEditModal
          user={user}
          interview={editingInterview}
          jobOrders={jobOrders}
          onClose={() => setEditingInterview(null)}
          onSave={handleUpdateInterview}
        />
      )}

      {/* --- ADD INTERVIEW FORM --- */}
      <div className="form-container module-form-card">
        <h3>
          <FiPlus /> Schedule New Interview
        </h3>
        <form
          onSubmit={handleAddEntry}
          className="form-grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}
        >
          <div className="form-group full-width">
            <label>Job Order</label>
            <select
              name="job_order_id"
              value={interviewForm.job_order_id}
              onChange={handleFormChange}
            >
              <option value="">-- Select a Job Order --</option>
              {jobOrders.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.companyName} - {job.positionTitle}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Interview Date</label>
            <input
              type="date"
              name="interview_date"
              value={interviewForm.interview_date}
              onChange={handleFormChange}
            />
          </div>
          <div className="form-group">
            <label>Round</label>
            <input
              type="text"
              name="round"
              value={interviewForm.round}
              onChange={handleFormChange}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              name="status"
              value={interviewForm.status}
              onChange={handleFormChange}
            >
              {interviewStatusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full-width">
            <label>Notes/Feedback</label>
            <textarea
              name="notes"
              value={interviewForm.notes}
              onChange={handleFormChange}
              rows="2"
            ></textarea>
          </div>
          <button
            type="submit"
            className="btn btn-full-width"
            disabled={isSaving}
            style={{ gridColumn: '1 / -1' }}
          >
            {isSaving ? 'Scheduling...' : 'Save Interview Entry'}
          </button>
        </form>
      </div>

      {/* --- INTERVIEW HISTORY LIST --- */}
      <div className="list-container module-list-card">
        <h3>
          <FiCalendar /> Interview History ({interviewEntries.length})
        </h3>
        <div className="module-list interview-list">
          {interviewEntries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No interview history found.
            </p>
          ) : (
            interviewEntries.map((entry) => (
              <div className="interview-item module-list-item" key={entry.id}>
                <div className="item-icon">
                  <FiBriefcase />
                </div>
                <div className="item-details">
                  <strong>
                    {entry.positionTitle} at {entry.companyName}
                  </strong>
                  <p className="mt-1">
                    Round: {entry.round} | Date: {entry.interview_date}
                  </p>
                  {entry.notes && (
                    <p className="mt-1">
                      <small>Feedback: {entry.notes}</small>
                    </p>
                  )}
                </div>
                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                    {entry.status}
                  </span>
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit Entry"
                    onClick={() => setEditingInterview(entry)}
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move to Recycle Bin"
                    onClick={() => handleDeleteEntry(entry.id, entry.positionTitle)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateInterview;
