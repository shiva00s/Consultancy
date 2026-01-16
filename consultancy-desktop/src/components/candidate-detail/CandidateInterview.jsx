import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiTrash2, FiBriefcase, FiEdit2, FiCheck, FiX, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import CustomDropdown from '../common/CustomDropdown';
import useDataStore from '../../store/dataStore';
import '../../css/CandidateInterview.css';
import useNotificationStore from '../../store/useNotificationStore';

const interviewStatusOptions = ['Scheduled', 'Passed', 'Failed', 'Cancelled'];
const roundOptions = ['1st Round', '2nd Round', '3rd Round', 'Final Round'];

const initialInterviewForm = {
  job_order_id: '',
  interview_date: '',
  round: '1st Round',
  status: 'Scheduled',
  notes: '',
};

// 🎯 Enhanced Confirm Dialog Component
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon ${type}`}>
          {type === 'danger' && '🗑️'}
          {type === 'warning' && '⚠️'}
          {type === 'info' && 'ℹ️'}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn-confirm-cancel" onClick={onClose}>
            <FiX /> Cancel
          </button>
          <button className={`btn-confirm-${type}`} onClick={onConfirm}>
            <FiCheck /> {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

function CandidateInterview({ user, candidateId, candidateName }) {
  const [interviewEntries, setInterviewEntries] = useState([]);
  const jobOrders = useDataStore((state) => state.jobs);
  const [loading, setLoading] = useState(true);
  const [interviewForm, setInterviewForm] = useState(initialInterviewForm);
  const [isSaving, setIsSaving] = useState(false);
  
  // ✅ INLINE EDIT STATE
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
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

  // ✅ GET JOB POSITION OPTIONS
  const jobPositionOptions = jobOrders.map((job) => job.positionTitle);

  // ✅ GET JOB POSITION NAME
  const getJobPositionName = (jobOrderId) => {
    const job = jobOrders.find((j) => j.id === parseInt(jobOrderId));
    return job ? job.positionTitle : '';
  };

  // ✅ HANDLE CUSTOM DROPDOWN CHANGE
  const handleJobPositionChange = (e) => {
    const selectedPositionTitle = e.target.value;
    const selectedJob = jobOrders.find((job) => job.positionTitle === selectedPositionTitle);
    
    setInterviewForm((prev) => ({
      ...prev,
      job_order_id: selectedJob ? selectedJob.id.toString() : ''
    }));
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
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'interview', id: res.data ? res.data.id : null },
          meta: { candidateId, candidateName, interviewDate: interviewForm.interview_date, positionId: interviewForm.job_order_id },
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
          console.error('createReminder failed:', err);
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

  // ✅ START INLINE EDIT
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      job_order_id: entry.job_order_id.toString(),
      interview_date: entry.interview_date,
      round: entry.round,
      status: entry.status,
      notes: entry.notes || '',
    });
  };

  // ✅ CANCEL INLINE EDIT
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // ✅ HANDLE EDIT FORM CHANGE
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ HANDLE EDIT DROPDOWN CHANGE
  const handleEditJobPositionChange = (e) => {
    const selectedPositionTitle = e.target.value;
    const selectedJob = jobOrders.find((job) => job.positionTitle === selectedPositionTitle);
    
    setEditForm((prev) => ({
      ...prev,
      job_order_id: selectedJob ? selectedJob.id.toString() : ''
    }));
  };

  // ✅ SAVE INLINE EDIT
  const saveEdit = async () => {
    if (!editForm.job_order_id || !editForm.interview_date) {
      toast.error('⚠️ Job and Date are required.');
      return;
    }

    const toastId = toast.loading('⏳ Updating interview...');

    try {
      const res = await window.electronAPI.updateInterviewEntry({
        user,
        id: editingId,
        data: editForm,
      });

      if (res.success) {
        setInterviewEntries((prev) =>
          prev.map((i) => (i.id === editingId ? { ...i, ...editForm } : i))
        );
        toast.success('✅ Interview updated successfully!', { id: toastId });
        cancelEdit();

        createNotification({
          title: '✅ Interview updated',
          message: `${candidateName || 'Candidate'} interview updated (${editForm.status})`,
          type: 'success',
          priority: 'normal',
          link: `/candidates/${candidateId}/interview`,
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'interview', id: editingId },
          meta: { candidateId, candidateName, interviewDate: editForm.interview_date, status: editForm.status, positionId: editForm.job_order_id },
        });
      } else {
        toast.error('❌ ' + (res.error || 'Failed to update interview'), { id: toastId });
      }
    } catch (err) {
      console.error('updateInterviewEntry error:', err);
      toast.error('❌ Failed to update interview', { id: toastId });
    }
  };

  const handleDeleteEntry = async (id, position) => {
    setConfirmDialog({
      open: true,
      title: '🗑️ Delete Interview Entry',
      message: `Are you sure you want to delete the interview entry for "${position}"? This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await window.electronAPI.deleteInterviewEntry({ user, id });
          if (res.success) {
            setInterviewEntries((prev) => prev.filter((e) => e.id !== id));
            toast.success('✅ Interview entry deleted.');

            createNotification({
              title: '🗑️ Interview deleted',
              message: `Interview for "${position}" has been deleted.`,
              type: 'warning',
              priority: 'high',
              actionRequired: false,
              actor: { id: user?.id, name: user?.name || user?.username },
              target: { type: 'interview', id },
              meta: { candidateId, candidateName, position },
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
      type: 'danger'
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
        <div className="loading-state">⏳ Loading interview tracking...</div>
      </div>
    );
  }

  return (
    <div className="interview-tracking-content">
      {/* ✅ ADD INTERVIEW FORM */}
      <div className="detail-card">
        <h3>
          <FiCalendar /> Schedule New Interview
        </h3>

        <form className="visa-form form-grid" onSubmit={handleAddEntry}>
          <div className="form-field">
            <label>
              <FiBriefcase /> Job Position *
            </label>
            <CustomDropdown
              value={getJobPositionName(interviewForm.job_order_id)}
              onChange={handleJobPositionChange}
              options={jobPositionOptions}
              placeholder="Select job position..."
              name="job_position"
              allowCustom={false}
            />
          </div>

          <div className="form-field">
            <label>
              <FiCalendar /> Interview Date *
            </label>
            <input
              type="date"
              name="interview_date"
              className="form-input"
              value={interviewForm.interview_date}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-field">
            <label>Round</label>
            <select
              name="round"
              className="form-input"
              value={interviewForm.round}
              onChange={handleFormChange}
            >
              {roundOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Status</label>
            <select
              name="status"
              className="form-input"
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

          <div className="form-field full-width">
            <label>Notes / Feedback</label>
            <textarea
              name="notes"
              className="form-input"
              value={interviewForm.notes}
              onChange={handleFormChange}
              placeholder="Add any notes or feedback here..."
              rows="3"
            />
          </div>

          <button type="submit" className="btn-full-width" disabled={isSaving}>
            <FiPlus /> {isSaving ? 'Scheduling...' : 'Schedule Interview'}
          </button>
        </form>
      </div>

      {/* ✅ INTERVIEW HISTORY */}
      <div className="visa-list-container">
        <h3>
          <FiCalendar /> Interview History
        </h3>

        {interviewEntries.length === 0 ? (
          <div className="empty-state">
            <FiCalendar size={60} />
            <p>ℹ️ No interview history found.</p>
          </div>
        ) : (
          <div className="visa-list">
            {interviewEntries.map((entry) => {
              const jobPosition = getJobPositionName(entry.job_order_id);
              const isEditing = editingId === entry.id;

              if (isEditing) {
                // ✅ INLINE EDIT MODE
                return (
                  <div key={entry.id} className="module-list-item editing-mode">
                    <div className="inline-edit-container">
                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>
                            <FiBriefcase /> Job Position *
                          </label>
                          <CustomDropdown
                            value={getJobPositionName(editForm.job_order_id)}
                            onChange={handleEditJobPositionChange}
                            options={jobPositionOptions}
                            placeholder="Select job position..."
                            name="job_position"
                            allowCustom={false}
                          />
                        </div>

                        <div className="edit-field">
                          <label>
                            <FiCalendar /> Interview Date *
                          </label>
                          <input
                            type="date"
                            name="interview_date"
                            className="edit-input"
                            value={editForm.interview_date}
                            onChange={handleEditFormChange}
                            required
                          />
                        </div>

                        <div className="edit-field">
                          <label>Round</label>
                          <select
                            name="round"
                            className="edit-input"
                            value={editForm.round}
                            onChange={handleEditFormChange}
                          >
                            {roundOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="edit-field">
                          <label>Status</label>
                          <select
                            name="status"
                            className="edit-input"
                            value={editForm.status}
                            onChange={handleEditFormChange}
                          >
                            {interviewStatusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="edit-field edit-field-full">
                          <label>Notes / Feedback</label>
                          <textarea
                            name="notes"
                            className="edit-input"
                            value={editForm.notes}
                            onChange={handleEditFormChange}
                            placeholder="Add any notes or feedback here..."
                            rows="3"
                          />
                        </div>
                      </div>

                      <div className="edit-actions">
                        <button className="btn-cancel" onClick={cancelEdit}>
                          <FiX /> Cancel
                        </button>
                        <button className="btn-save" onClick={saveEdit}>
                          <FiCheck /> Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // ✅ VIEW MODE
              return (
                <div key={entry.id} className="module-list-item">
                  <div className="item-icon">
                    <FiBriefcase />
                  </div>

                  <div className="item-details">
                    <strong>{jobPosition || 'Unknown Position'}</strong>
                    <p>
                      🔄 Round: {entry.round} | 📅 Date: {entry.interview_date}
                    </p>
                    {entry.notes && <small>📝 {entry.notes}</small>}
                  </div>

                  <div className="item-status">
                    <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                      {getStatusIcon(entry.status)} {entry.status}
                    </span>
                  </div>

                  <div className="item-actions">
                    <button
                      onClick={() => startEdit(entry)}
                      title="Edit Interview"
                      className="btn-icon"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id, jobPosition)}
                      title="Delete Interview"
                      className="btn-icon btn-danger"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ CONFIRM DIALOG */}
      {confirmDialog.open && (
        <ConfirmDialog
          isOpen={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
          type={confirmDialog.type}
        />
      )}
    </div>
  );
}

export default CandidateInterview;
