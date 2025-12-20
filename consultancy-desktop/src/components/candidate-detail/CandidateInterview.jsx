import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiTrash2, FiBriefcase, FiEdit2, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import InterviewEditModal from '../modals/InterviewEditModal';
import ConfirmDialog from '../common/ConfirmDialog';
import useDataStore from '../../store/dataStore';
import '../../css/CandidateInterview.css';
import useNotificationStore from '../../store/useNotificationStore';

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
  
  // ✅ CONFIRM DIALOG STATE
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'danger'
  });

  const createNotification = useNotificationStore((s) => s.createNotification);

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
      toast.error('⚠️ Job and Date are required.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('⏳ Scheduling interview...');

    try {
      const res = await window.electronAPI.addInterviewEntry({
        user,
        data: { ...interviewForm, candidate_id: candidateId },
      });

      if (res.success) {
        setInterviewEntries((prev) => [res.data, ...prev]);
        setInterviewForm(initialInterviewForm);
        toast.success('✅ Interview scheduled successfully!', { id: toastId });

        createNotification({
          title: '📋 Interview scheduled',
          message: `${candidateName || 'Candidate'} interview on ${interviewForm.interview_date}`,
          type: 'info',
          priority: 'normal',
          link: `/candidates/${candidateId}/interview`,
        });

        try {
          await window.electronAPI.createReminder({
            userId: user.id,
            candidateId,
            module: 'interview',
            title: '📋 Interview scheduled',
            message: `${candidateName || 'Candidate'} interview on ${interviewForm.interview_date}`,
            remindAt: new Date(interviewForm.interview_date).toISOString(),
          });
        } catch (err) {
          console.error('createReminder (interview) failed:', err);
        }
      } else {
        toast.error('❌ ' + (res.error || 'Failed to schedule interview'), { id: toastId });
      }
    } catch (err) {
      console.error('addInterviewEntry error:', err);
      toast.error('❌ Failed to schedule interview', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateInterview = (updatedInterviewData) => {
    setInterviewEntries((prev) =>
      prev.map((i) => (i.id === updatedInterviewData.id ? updatedInterviewData : i))
    );
    setEditingInterview(null);

    createNotification({
      title: '✅ Interview updated',
      message: `${candidateName || 'Candidate'} interview updated (${updatedInterviewData.status})`,
      type: 'success',
      priority: 'normal',
      link: `/candidates/${candidateId}/interview`,
    });
  };

  // ✅ CONFIRM DIALOG INTEGRATION
  const handleDeleteEntry = async (id, position) => {
    setConfirmDialog({
      open: true,
      title: '🗑️ Delete Interview Entry',
      message: `Are you sure you want to move the interview entry for "${position}" to the Recycle Bin? This action can be undone from the Recycle Bin.`,
      onConfirm: async () => {
        try {
          const res = await window.electronAPI.deleteInterviewEntry({ user, id });
          if (res.success) {
            setInterviewEntries((prev) => prev.filter((e) => e.id !== id));
            toast.success('✅ Interview entry moved to Recycle Bin.');

            createNotification({
              title: '🗑️ Interview deleted',
              message: `Interview for "${position}" moved to Recycle Bin.`,
              type: 'warning',
              priority: 'high',
              actionRequired: false,
            });
          } else {
            toast.error('❌ ' + (res.error || 'Failed to delete interview entry'));
          }
        } catch (err) {
          console.error('deleteInterviewEntry error:', err);
          toast.error('❌ Failed to delete interview entry');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      },
      variant: 'danger'
    });
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Passed':
        return <FiCheckCircle />;
      case 'Failed':
        return <FiXCircle />;
      case 'Cancelled':
        return <FiXCircle />;
      case 'Scheduled':
      default:
        return <FiClock />;
    }
  };

  if (loading) {
    return (
      <div className="interview-tracking-content">
        <div className="interview-loading">
          <div className="loading-spinner"></div>
          <p>⏳ Loading interview tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-tracking-content">
      {/* ✅ ADD INTERVIEW FORM */}
      <div className="form-container">
        <h3>
          <FiPlus /> ➕ Schedule New Interview
        </h3>
        <form onSubmit={handleAddEntry} className="interview-form">
          <div className="form-row">
            <div className="form-group">
              <label>
                <FiBriefcase /> 💼 Job Position *
              </label>
              <select
                name="job_order_id"
                value={interviewForm.job_order_id}
                onChange={handleFormChange}
                required
                className="form-input"
              >
                <option value="">Select Job Position...</option>
                {jobOrders.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.company} - {job.position}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                <FiCalendar /> 📅 Interview Date *
              </label>
              <input
                type="date"
                name="interview_date"
                value={interviewForm.interview_date}
                onChange={handleFormChange}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <FiClock /> 🔄 Interview Round
              </label>
              <select
                name="round"
                value={interviewForm.round}
                onChange={handleFormChange}
                className="form-input"
              >
                <option value="1st Round">1st Round</option>
                <option value="2nd Round">2nd Round</option>
                <option value="3rd Round">3rd Round</option>
                <option value="Final Round">Final Round</option>
                <option value="HR Round">HR Round</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <FiCheckCircle /> ✅ Status
              </label>
              <select
                name="status"
                value={interviewForm.status}
                onChange={handleFormChange}
                className="form-input"
              >
                {interviewStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>📝 Notes / Feedback (Optional)</label>
            <textarea
              name="notes"
              value={interviewForm.notes}
              onChange={handleFormChange}
              placeholder="Add interview notes or feedback..."
              rows="3"
              className="form-input"
            />
          </div>

          <button type="submit" disabled={isSaving} className="btn-full-width btn-add">
            <FiPlus />
            {isSaving ? 'Scheduling...' : '➕ Schedule Interview'}
          </button>
        </form>
      </div>

      {/* ✅ INTERVIEW LIST */}
      <div className="list-container">
        <h3>
          <FiCalendar /> 📋 Interview History ({interviewEntries.length})
        </h3>

        {interviewEntries.length === 0 ? (
          <div className="interview-empty">
            <div className="empty-icon">📋</div>
            <p>ℹ️ No interview history found.</p>
            <small>Schedule your first interview above ⬆️</small>
          </div>
        ) : (
          <div className="interview-list">
            {interviewEntries.map((entry) => (
              <div key={entry.id} className="interview-item">
                <div className="item-icon">
                  <FiBriefcase />
                </div>

                <div className="item-details">
                  <strong>{entry.company} - {entry.position}</strong>
                  <p>
                    🔄 Round: {entry.round} | 📅 Date: {entry.interview_date}
                  </p>
                  {entry.notes && (
                    <small>
                      📝 Feedback: {entry.notes}
                    </small>
                  )}
                </div>

                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                    {getStatusIcon(entry.status)}
                    {entry.status}
                  </span>
                </div>

                <div className="item-actions">
                  <button
                    onClick={() => setEditingInterview(entry)}
                    title="Edit Interview"
                    className="btn-edit"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id, entry.position)}
                    title="Delete Interview"
                    className="btn-delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ EDIT MODAL */}
      {editingInterview && (
        <InterviewEditModal
          user={user}
          interview={editingInterview}
          onClose={() => setEditingInterview(null)}
          onUpdate={handleUpdateInterview}
        />
      )}

      {/* ✅ CONFIRM DIALOG */}
      {confirmDialog.open && (
        <ConfirmDialog
          isOpen={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
          variant={confirmDialog.variant}
        />
      )}
    </div>
  );
}

export default CandidateInterview;
